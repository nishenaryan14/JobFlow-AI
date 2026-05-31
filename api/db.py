"""
Database layer — MongoDB (async via Motor) + Redis session store.

Redis is used for short-lived resume sessions (user-uploaded resume text
keyed by a UUID). It falls back to an in-memory dict when Redis is
unavailable so local development works without Docker.
"""

import os
import time
from pathlib import Path
from dotenv import load_dotenv

# ── Env Loading ───────────────────────────────────────────────────────────────
root_env = Path(__file__).parent.parent / ".env"
webapp_env = Path(__file__).parent.parent / "webapp" / ".env.local"
load_dotenv(root_env)
load_dotenv(webapp_env)

# ── MongoDB ───────────────────────────────────────────────────────────────────
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

MONGODB_URI = os.getenv("MONGODB_URI", "")

if MONGODB_URI:
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.get_default_database()
    raw_jobs_collection = db.get_collection("raw_jobs")
    jobs_collection = db.get_collection("jobs")
    resumes_collection = db.get_collection("resumes")
    applications_collection = db.get_collection("applications")
else:
    print("[WARNING] MONGODB_URI not set -- DB operations will be skipped.")
    client = db = raw_jobs_collection = jobs_collection = None
    resumes_collection = applications_collection = None


# ── MongoDB Index Bootstrap ───────────────────────────────────────────────────

async def ensure_indexes() -> None:
    """
    Create required indexes for production-grade query performance.
    Called once during FastAPI lifespan startup.
    Idempotent — safe to call multiple times.
    """
    if raw_jobs_collection is None:
        return
    try:
        await raw_jobs_collection.create_index("url", unique=True, background=True)
        await raw_jobs_collection.create_index("posted_date", background=True)

        if jobs_collection is not None:
            await jobs_collection.create_index([("fitScore", -1)], background=True)
            await jobs_collection.create_index("status", background=True)

        if applications_collection is not None:
            await applications_collection.create_index("jobId", background=True)
            await applications_collection.create_index("userId", background=True)

        if resumes_collection is not None:
            await resumes_collection.create_index("userId", background=True)
            await resumes_collection.create_index("sessionId", background=True)

        print("[OK] MongoDB indexes verified.")
    except Exception as exc:
        print(f"[WARNING] Could not ensure MongoDB indexes: {exc}")


# ── Redis Session Store ───────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
RESUME_SESSION_TTL = 60 * 60 * 4  # 4 hours

_redis_client = None
_memory_store: dict[str, tuple[str, float]] = {}  # fallback: {key: (value, expires_at)}


def _get_redis():
    """Lazy-initialise the Redis client, returning None if unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis  # type: ignore
        _redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
        return _redis_client
    except ImportError:
        return None


async def store_resume_session(session_id: str, resume_text: str) -> None:
    """
    Persist resume_text in Redis (preferred) or the in-process memory store.
    TTL: 4 hours.
    """
    key = f"resume:{session_id}"
    redis = _get_redis()
    if redis is not None:
        try:
            await redis.setex(key, RESUME_SESSION_TTL, resume_text)
            return
        except Exception as exc:
            print(f"[WARNING] Redis write failed, using memory fallback: {exc}")

    # In-memory fallback (single-process only — fine for development)
    _memory_store[key] = (resume_text, time.time() + RESUME_SESSION_TTL)


async def get_resume_session(session_id: str) -> str | None:
    """
    Retrieve resume_text for a session_id.
    Returns None if the session has expired or does not exist.
    """
    key = f"resume:{session_id}"
    redis = _get_redis()
    if redis is not None:
        try:
            return await redis.get(key)
        except Exception as exc:
            print(f"[WARNING] Redis read failed, checking memory store: {exc}")

    # Memory fallback
    entry = _memory_store.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.time() > expires_at:
        del _memory_store[key]
        return None
    return value


async def delete_resume_session(session_id: str) -> None:
    """Explicitly invalidate a session (e.g. user logs out)."""
    key = f"resume:{session_id}"
    redis = _get_redis()
    if redis is not None:
        try:
            await redis.delete(key)
        except Exception:
            pass
    _memory_store.pop(key, None)
