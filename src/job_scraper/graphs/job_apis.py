"""Free Job Board API Integrations — No scraping needed.

These APIs return pre-structured job data (title, company, URL, description),
bypassing the entire scrape → LLM extraction pipeline.
"""

import asyncio
import logging
import os

import requests

logger = logging.getLogger("jobflow.graphs")


async def fetch_remotive_jobs(search_term: str, limit: int = 30) -> list[dict]:
    """Fetch remote jobs from Remotive API (free, no key required)."""
    try:
        resp = await asyncio.to_thread(
            requests.get,
            "https://remotive.com/api/remote-jobs",
            params={"search": search_term, "limit": limit},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        jobs = []
        for item in data.get("jobs", [])[:limit]:
            jobs.append({
                "title": item.get("title", ""),
                "company": item.get("company_name", ""),
                "url": item.get("url", ""),
                "description": (item.get("description", "") or "")[:2000],
                "location": item.get("candidate_required_location", "Remote"),
                "posted_date": item.get("publication_date", ""),
                "source": "remotive",
            })
        # Filter to last 30 days only
        from datetime import datetime, timedelta
        cutoff = datetime.now() - timedelta(days=7)
        fresh_jobs = []
        for j in jobs:
            try:
                posted = j.get("posted_date", "")
                if posted:
                    posted_dt = datetime.fromisoformat(posted.replace("Z", "+00:00").replace("+00:00", ""))
                    if posted_dt < cutoff:
                        continue
            except (ValueError, TypeError):
                pass  # Keep jobs with unparseable dates
            fresh_jobs.append(j)
        jobs = fresh_jobs
        logger.info(f"[job_apis] Remotive: {len(jobs)} jobs for '{search_term}'")
        return jobs

    except Exception as exc:
        logger.warning(f"[job_apis] Remotive fetch failed: {exc}")
        return []


async def fetch_adzuna_jobs(
    search_term: str, country: str = "us", limit: int = 30
) -> list[dict]:
    """Fetch jobs from Adzuna API (requires ADZUNA_APP_ID + ADZUNA_APP_KEY env vars)."""
    app_id = os.environ.get("ADZUNA_APP_ID", "")
    app_key = os.environ.get("ADZUNA_APP_KEY", "")
    if not app_id or not app_key:
        return []  # Silently skip if not configured

    try:
        resp = await asyncio.to_thread(
            requests.get,
            f"https://api.adzuna.com/v1/api/jobs/{country}/search/1",
            params={
                "app_id": app_id,
                "app_key": app_key,
                "results_per_page": limit,
                "what": search_term,
                "max_days_old": 7,
                "content-type": "application/json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        jobs = []
        for item in data.get("results", [])[:limit]:
            jobs.append({
                "title": item.get("title", ""),
                "company": (item.get("company", {}) or {}).get("display_name", ""),
                "url": item.get("redirect_url", ""),
                "description": (item.get("description", "") or "")[:2000],
                "location": (item.get("location", {}) or {}).get("display_name", ""),
                "posted_date": item.get("created", ""),
                "source": "adzuna",
            })
        logger.info(f"[job_apis] Adzuna: {len(jobs)} jobs for '{search_term}'")
        return jobs

    except Exception as exc:
        logger.warning(f"[job_apis] Adzuna fetch failed: {exc}")
        return []


async def fetch_all_job_apis(
    target_role: str, skills: list[str] | None = None
) -> list[dict]:
    """Run all API fetchers concurrently. Returns deduplicated, normalized results."""
    skills = skills or []

    # Build search terms: primary role + top skills variant
    search_terms = [target_role]
    if skills:
        search_terms.append(f"{target_role} {' '.join(skills[:3])}")

    # Run all fetchers concurrently
    all_tasks = []
    for term in search_terms:
        all_tasks.append(fetch_remotive_jobs(term, limit=20))
    all_tasks.append(fetch_adzuna_jobs(target_role, limit=20))

    results = await asyncio.gather(*all_tasks, return_exceptions=True)

    # Flatten and deduplicate
    seen: set[str] = set()
    jobs: list[dict] = []
    for result in results:
        if isinstance(result, Exception):
            logger.warning(f"[job_apis] API fetcher failed: {result}")
            continue
        for job in result:
            key = f"{job.get('title', '').lower()}|{job.get('company', '').lower()}"
            if key not in seen and key != "|":
                seen.add(key)
                jobs.append(job)

    logger.info(f"[job_apis] Total: {len(jobs)} unique jobs from free APIs")
    return jobs
