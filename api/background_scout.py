"""
Background Job Discovery Daemon.

Runs the Job Discovery LangGraph pipeline (search + extract ONLY -- no scoring)
on a 4-hour schedule and saves raw jobs to MongoDB's raw_jobs_collection.

Per-user resume scoring happens separately in graphs/user_matching.py
when the user opens /jobs with their uploaded resume session.
"""

import asyncio
import traceback
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from api.db import raw_jobs_collection

logger = logging.getLogger("jobflow.graphs")


def fetch_and_save_jobs(target_role: str = "AI Agent Engineer") -> list | None:
    """Synchronous wrapper -- runs Job Discovery graph in a thread."""
    try:
        from job_scraper.graphs.job_discovery import job_discovery_graph

        print(f"\n[Scout] Starting discovery cycle for: '{target_role}'")

        config = {"configurable": {"thread_id": f"scout_{target_role.replace(' ', '_')}"}}
        result = asyncio.run(job_discovery_graph.ainvoke({
            "target_role": target_role,
            "resume_text": "",
        }, config=config))

        jobs = result.get("scraped_jobs", [])

        if not jobs:
            print("[Scout] No jobs extracted from graph output.")
            return None

        print(f"[Scout] Discovered {len(jobs)} raw jobs.")
        return jobs

    except Exception as exc:
        print(f"[Scout] Error during discovery: {exc}")
        traceback.print_exc()
        return None


async def run_discovery_cycle(target_role: str = "AI Agent Engineer") -> int:
    """Async entry point for APScheduler."""
    if raw_jobs_collection is None:
        print("[Scout] MongoDB not connected -- skipping cycle.")
        return 0

    jobs = await asyncio.to_thread(fetch_and_save_jobs, target_role)

    if not jobs:
        return 0

    saved = 0
    skipped = 0
    for job in jobs:
        try:
            url = job.get("url", "")
            if not url or url.strip() in ("", "Not Listed"):
                skipped += 1
                continue

            await raw_jobs_collection.update_one(
                {"url": url},
                {"$set": {
                    **job,
                    "discoveredAt": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
            saved += 1
        except Exception as exc:
            print(f"[Scout] Failed to save '{job.get('title')}': {exc}")

    print(f"[Scout] Saved {saved} jobs to MongoDB ({skipped} skipped -- no URL).")
    return saved


def start_scheduler() -> AsyncIOScheduler:
    """Initializes APScheduler with 4-hour periodic discovery."""
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_discovery_cycle,
        trigger="interval",
        hours=4,
        id="job_discovery_daemon",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc),
        kwargs={"target_role": "AI Agent Engineer"},
    )
    scheduler.start()
    print("[Scout] Scheduler started -- first cycle fires immediately, then every 4h.")
    return scheduler


async def manual_trigger_cycle(target_role: str = "AI Agent Engineer") -> int:
    """Trigger a single discovery cycle manually."""
    return await run_discovery_cycle(target_role)
