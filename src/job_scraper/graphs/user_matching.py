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
    }


# ── Persistence ───────────────────────────────────────────────────────────────

async def persist_matched_job(payload: dict, jobs_collection) -> None:
    """Persist streamed matches to the jobs collection."""
    if jobs_collection is None:
        return

    now = datetime.now(timezone.utc)
    try:
        await jobs_collection.update_one(
            {"title": payload["title"], "company": payload["company"]},
            {
                "$set": {**payload, "updatedAt": now},
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

    Yields SSE event dicts: {"event": "job_match", "data": <json>}

    This is the main entry point called by server.py's /stream-matches endpoint.
    """

    # ── Phase 1: Run Job Discovery Graph ──────────────────────────────────
    yield {
        "event": "status",
        "data": json.dumps({"phase": "discovery", "message": "Searching job boards..."}),
    }

    try:
        from job_scraper.graphs.job_discovery import job_discovery_graph
        import uuid

        config = {"configurable": {"thread_id": f"stream_{uuid.uuid4().hex[:8]}"}}
        result = await job_discovery_graph.ainvoke({
            "target_role": target_role,
            "resume_text": resume_text,  # Resume-aware discovery + quality gate
        }, config=config)

        # Use validated_jobs (post quality gate) if available
        discovered_jobs = result.get("validated_jobs") or result.get("scraped_jobs", [])
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
    yield {
        "event": "status",
        "data": json.dumps({
            "phase": "scoring",
            "message": f"Scoring {len(discovered_jobs)} jobs against your resume...",
        }),
    }

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
        tasks = [evaluate_single_job(job, resume_text) for job in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for j, (job, match_data) in enumerate(zip(batch, results)):
            if not match_data or isinstance(match_data, Exception):
                continue

            # Skip clearly irrelevant jobs (fit score < 3)
            fit = match_data.get("fit_score", 0)
            try:
                fit = float(fit)
            except (TypeError, ValueError):
                fit = 0
            if fit < 3:
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
            yield {"event": "job_match", "data": json.dumps(payload)}
            yielded += 1

    yield {
        "event": "done",
        "data": json.dumps({"total": yielded, "scanned": len(discovered_jobs)}),
    }
