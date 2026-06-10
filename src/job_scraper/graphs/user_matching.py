"""User Matching — Live Discovery + Scoring SSE pipeline.

Runs the FULL job discovery pipeline (search → scrape → extract) inline,
then scores each discovered job against the user's resume in real-time,
streaming results via SSE.

No background daemon. No MongoDB raw_jobs dependency.
The user clicks "Find Jobs" and everything happens live.

Pipeline: discover_jobs → evaluate_each → stream_to_frontend
"""

import os
import re
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from pydantic import BaseModel, Field

logger = logging.getLogger("jobflow.graphs")


class JobEvaluationOutput(BaseModel):
    """Structured output for single-job evaluation."""
    fit_score: int = 5
    matching_skills: list[str] = Field(default_factory=list)
    skill_gaps: list[str] = Field(default_factory=list)
    application_tip: str = ""


# ── Single Job Evaluator ──────────────────────────────────────────────────────

async def evaluate_single_job(job: dict, resume_text: str) -> dict:
    """Evaluate fit for a single position using unified LLM client.

    Uses call_llm_structured from error_handling.py for automatic retries
    and Pydantic validation.
    """
    from job_scraper.graphs.error_handling import call_llm_structured
    from job_scraper.graphs.llm_factory import get_deepseek_chat

    prompt = f"""You are an expert technical recruiter analyzing a candidate's fit for a specific role.

CANDIDATE RESUME:
{resume_text}

JOB POSTING:
Title: {job.get('title')}
Company: {job.get('company')}
Skills Required: {', '.join(job.get('required_skills', []))}
Responsibilities: {chr(10).join(job.get('key_responsibilities', []))}

Score this candidate's fit and identify matching/missing skills."""

    try:
        result = await call_llm_structured(
            llm=get_deepseek_chat(),
            prompt=prompt,
            output_schema=JobEvaluationOutput,
            system_prompt="You are an expert recruiter. Output structured JSON evaluation.",
        )
        return result.model_dump()
    except Exception as e:
        logger.warning(f"Failed to match job {job.get('title')}: {e}")
        return {}


# ── Payload Builder ───────────────────────────────────────────────────────────

def normalize_fit_score(score: object) -> float:
    """Normalize LLM fit scores to the 0-10 scale expected by the UI."""
    try:
        value = float(score)
    except (TypeError, ValueError):
        return 0
    if value > 10:
        value = value / 10
    return round(max(0, min(10, value)), 1)


def _compute_freshness(posted_date_str: str) -> str:
    """Compute freshness label from a posted date string."""
    if not posted_date_str or posted_date_str == "Not Listed":
        return "unknown"
    try:
        from dateutil import parser as dateparser
        posted = dateparser.parse(posted_date_str)
        if posted is None:
            return "unknown"
        now = datetime.now(timezone.utc)
        if posted.tzinfo is None:
            from datetime import timezone as tz
            posted = posted.replace(tzinfo=tz.utc)
        delta = now - posted
        hours = delta.total_seconds() / 3600
        if hours <= 24:
            return "today"
        elif hours <= 72:
            return "recent"
        else:
            return "this_week"
    except Exception:
        return "unknown"


def build_frontend_payload(job: dict, match_data: dict, job_id: str) -> dict:
    """Build the frontend-compatible payload from a discovered job + match data."""
    responsibilities = job.get("key_responsibilities", []) or []
    description = job.get("description") or "\n".join(responsibilities)

    return {
        "id": job_id,
        "_id": job_id,
        "rawJobId": job_id,
        "title": job.get("title") or "Untitled role",
        "company": job.get("company") or "Unknown company",
        "url": job.get("url") or job.get("application_url"),
        "location": job.get("location") or "Remote",
        "remotePolicy": job.get("remote_policy") or job.get("remotePolicy") or "Not Listed",
        "salaryRange": job.get("salary_range") or job.get("salaryRange") or "Not Listed",
        "experienceLevel": job.get("experience_level") or job.get("experienceLevel") or "Not Listed",
        "description": description,
        "applicationUrl": job.get("application_url") or job.get("applicationUrl") or job.get("url") or "",
        "agenticRelevance": job.get("agentic_ai_relevance") or job.get("agenticRelevance") or "Not Listed",
        "fitScore": normalize_fit_score(match_data.get("fit_score", 0)),
        "matchingSkills": match_data.get("matching_skills", []) or [],
        "skillGaps": match_data.get("skill_gaps", []) or [],
        "applicationTip": match_data.get("application_tip", "") or "",
        "requiredSkills": job.get("required_skills", []) or [],
        "responsibilities": responsibilities,
        "postedDate": job.get("posted_date") or job.get("postedDate") or "",
        "freshness": _compute_freshness(job.get("posted_date") or job.get("postedDate") or ""),
    }


# ── SSE Helper ────────────────────────────────────────────────────────────────

def _sse_status(phase: str, message: str, agent: str = "Pipeline", icon: str = "🧠",
                msg_type: str = "info") -> dict:
    """Build an SSE status event with phase, agent, and type info for the frontend log."""
    return {
        "event": "status",
        "data": json.dumps({
            "phase": phase,
            "message": message,
            "agent": agent,
            "agentIcon": icon,
            "type": msg_type,
        }),
    }


# ── Persistence ───────────────────────────────────────────────────────────────

async def persist_matched_job(payload: dict, jobs_collection) -> None:
    """Persist streamed matches to the jobs collection."""
    if jobs_collection is None:
        return

    now = datetime.now(timezone.utc)
    try:
        # Strip _id from $set payload — MongoDB's _id is immutable on existing docs
        set_payload = {k: v for k, v in payload.items() if k != "_id"}
        await jobs_collection.update_one(
            {"title": payload["title"], "company": payload["company"]},
            {
                "$set": {**set_payload, "updatedAt": now},
                "$setOnInsert": {"scrapedAt": now, "createdAt": now},
            },
            upsert=True,
        )
    except Exception as exc:
        logger.warning(f"Failed to persist matched job {payload.get('title')}: {exc}")


# ── Main Streaming Function ──────────────────────────────────────────────────

async def stream_job_matches(resume_text: str, target_role: str) -> AsyncGenerator[dict, None]:
    """Run FULL discovery pipeline + scoring and stream results live via SSE.

    Flow:
      1. Run job discovery graph (search → scrape → extract) inline
      2. For each discovered job, score it against the user's resume
      3. Stream each scored job to the frontend as an SSE event
      4. Persist to MongoDB for caching

    Yields SSE event dicts: {"event": "...", "data": <json>}
    """

    # ── Phase 1: Run Job Discovery Graph ──────────────────────────────────
    yield _sse_status("analyzing", "Initializing pipeline — analyzing your resume...",
                      "Pipeline", "🧠", "info")
    yield _sse_status("analyzing", f"Target role identified: {target_role}",
                      "Pipeline", "🧠", "result")
    yield _sse_status("searching", "Generating tailored search queries from your resume...",
                      "Search", "🔍", "action")

    try:
        from job_scraper.graphs.job_discovery import job_discovery_graph
        import uuid

        config = {"configurable": {"thread_id": f"stream_{uuid.uuid4().hex[:8]}"}}

        # Use astream_events to get progress from inside the graph
        discovered_jobs = []
        validated_jobs = []
        last_node = ""

        async for event in job_discovery_graph.astream_events(
            {
                "target_role": target_role,
                "resume_text": resume_text,
            },
            config=config,
            version="v2",
        ):
            kind = event.get("event", "")
            name = event.get("name", "")

            # Track node transitions for progress updates
            if kind == "on_chain_start" and name and name != last_node:
                last_node = name
                if name == "analyze_resume":
                    yield _sse_status("analyzing", "Analyzing resume skills and experience...",
                                      "Search", "🔍", "action")
                elif name == "generate_queries":
                    yield _sse_status("searching", "Generating search queries from your profile...",
                                      "Search", "🔍", "action")
                elif name == "search_jobs":
                    yield _sse_status("searching", "Searching across job boards and career pages...",
                                      "Search", "🔍", "tool")
                elif name == "scrape_urls":
                    yield _sse_status("scraping", "Scraping job posting pages for details...",
                                      "Scraper", "📄", "action")
                elif name == "extract_details":
                    yield _sse_status("extracting", "Extracting structured job data with AI...",
                                      "Scraper", "📄", "tool")
                elif name == "quality_gate":
                    yield _sse_status("quality", "Running quality gate on discovered jobs...",
                                      "Quality", "🔎", "action")
                elif name == "match_and_rank":
                    yield _sse_status("ranking", "Ranking jobs against your resume...",
                                      "Scorer", "🎯", "action")
                elif name == "persist":
                    yield _sse_status("ranking", "Saving results...",
                                      "Pipeline", "🧠", "action")

            # Capture the final output
            if kind == "on_chain_end" and name == "search_jobs":
                output = event.get("data", {}).get("output", {})
                urls = output.get("search_results", [])
                if urls:
                    yield _sse_status("searching",
                                      f"✅ Found {len(urls)} URLs from job boards",
                                      "Search", "🔍", "result")

            if kind == "on_chain_end" and name == "extract_details":
                output = event.get("data", {}).get("output", {})
                scraped = output.get("scraped_jobs", [])
                if scraped:
                    yield _sse_status("extracting",
                                      f"✅ Extracted {len(scraped)} unique job listings",
                                      "Scraper", "📄", "result")

            if kind == "on_chain_end" and name == "quality_gate":
                output = event.get("data", {}).get("output", {})
                validated = output.get("validated_jobs", [])
                if validated is not None:
                    yield _sse_status("quality",
                                      f"✅ {len(validated)} jobs passed quality gate",
                                      "Quality", "🔎", "result")

            if kind == "on_chain_end" and name == "match_and_rank":
                output = event.get("data", {}).get("output", {})
                rankings = output.get("job_rankings", [])
                yield _sse_status("ranking",
                                  f"✅ Ranked {len(rankings)} jobs by fit score",
                                  "Scorer", "🎯", "result")

            # Capture final graph output
            if kind == "on_chain_end" and event.get("tags", []) == []:
                output = event.get("data", {}).get("output", {})
                if isinstance(output, dict):
                    validated_jobs = output.get("validated_jobs", [])
                    if not validated_jobs:
                        validated_jobs = output.get("scraped_jobs", [])

        discovered_jobs = validated_jobs
        logger.info(f"[stream] Discovery complete: {len(discovered_jobs)} validated jobs found")

    except Exception as exc:
        logger.error(f"[stream] Discovery pipeline failed: {exc}")
        yield {
            "event": "error",
            "data": json.dumps({
                "message": f"Job discovery failed: {str(exc)}",
                "code": "DISCOVERY_ERROR",
            }),
        }
        return

    if not discovered_jobs:
        yield {
            "event": "error",
            "data": json.dumps({
                "message": "No jobs found matching your target role. Try a different role or check API keys.",
                "code": "NO_JOBS",
            }),
        }
        return

    # ── Phase 2: Score Each Job Against Resume ────────────────────────────
    yield _sse_status("scoring", f"Scoring {len(discovered_jobs)} jobs against your resume...",
                      "Scorer", "🎯", "action")

    # Get MongoDB collections for persistence (optional)
    jobs_collection = None
    applications_collection = None
    application_statuses: dict[str, str] = {}
    try:
        from api.db import jobs_collection as jc, applications_collection as ac
        jobs_collection = jc
        applications_collection = ac

        if applications_collection is not None:
            applications = await applications_collection.find(
                {}, {"jobId": 1, "status": 1}
            ).to_list(length=1000)
            application_statuses = {
                str(app.get("jobId")): app.get("status")
                for app in applications
                if app.get("jobId") and app.get("status")
            }
    except Exception:
        pass  # MongoDB is optional — SSE streaming still works without it

    yielded = 0
    batch_size = 5

    for i in range(0, len(discovered_jobs), batch_size):
        batch = discovered_jobs[i : i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(discovered_jobs) + batch_size - 1) // batch_size

        yield _sse_status("scoring",
                          f"Scoring batch {batch_num}/{total_batches} — "
                          f"evaluating {len(batch)} jobs...",
                          "Scorer", "🎯", "thinking")

        tasks = [evaluate_single_job(job, resume_text) for job in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for j, (job, match_data) in enumerate(zip(batch, results)):
            if not match_data or isinstance(match_data, Exception):
                continue

            # Skip clearly irrelevant jobs (fit score < 1)
            fit = match_data.get("fit_score", 0)
            try:
                fit = float(fit)
            except (TypeError, ValueError):
                fit = 0
            if fit < 1:
                logger.debug(f"[stream] Skipping low-fit job: {job.get('title')} (score={fit})")
                continue

            # Generate a stable ID from title + company
            title = job.get("title", "")
            company = job.get("company", "")
            id_hash = hash(f"{title}{company}") & 0xFFFFFFFF
            job_id = f"live_{i + j}_{id_hash:08x}"
            payload = build_frontend_payload(job, match_data, job_id)

            # Persist to MongoDB (non-blocking, best-effort)
            await persist_matched_job(payload, jobs_collection)

            payload["applicationStatus"] = application_statuses.get(payload["_id"])

            yield _sse_status("scoring",
                              f"✅ {title} @ {company} — Fit: {payload['fitScore']}/10",
                              "Scorer", "🎯", "result")

            yield {"event": "job_match", "data": json.dumps(payload)}
            yielded += 1

    yield _sse_status("scoring",
                      f"✅ Pipeline complete — {yielded} jobs matched from {len(discovered_jobs)} discovered",
                      "Pipeline", "🧠", "result")

    yield {
        "event": "done",
        "data": json.dumps({"total": yielded, "scanned": len(discovered_jobs)}),
    }
