"""
Tests for the resume session store — verifies both Redis and in-memory paths.
"""

import asyncio
import pytest
import time


@pytest.fixture(autouse=True)
def clear_memory_store():
    """Reset in-memory store between tests so tests don't bleed into each other."""
    from api.db import _memory_store
    _memory_store.clear()
    yield
    _memory_store.clear()


@pytest.mark.asyncio
async def test_store_and_retrieve_memory():
    """Basic round-trip using the in-memory fallback."""
    from api.db import store_resume_session, get_resume_session

    await store_resume_session("test-001", "Python developer resume text")
    result = await get_resume_session("test-001")
    assert result == "Python developer resume text"


@pytest.mark.asyncio
async def test_retrieve_missing_session():
    """Non-existent session returns None."""
    from api.db import get_resume_session

    result = await get_resume_session("does-not-exist")
    assert result is None


@pytest.mark.asyncio
async def test_delete_session():
    """Deleted session is no longer retrievable."""
    from api.db import store_resume_session, get_resume_session, delete_resume_session

    await store_resume_session("test-del", "resume to delete")
    await delete_resume_session("test-del")
    result = await get_resume_session("test-del")
    assert result is None


@pytest.mark.asyncio
async def test_expired_session_returns_none():
    """Simulate TTL expiry in the memory store."""
    from api.db import _memory_store, get_resume_session

    # Manually insert an already-expired entry
    key = "resume:test-expired"
    _memory_store[key] = ("expired resume text", time.time() - 1)  # expired 1s ago

    result = await get_resume_session("test-expired")
    assert result is None
    # Expired entry should be cleaned up
    assert key not in _memory_store


@pytest.mark.asyncio
async def test_multiple_independent_sessions():
    """Multiple sessions don't interfere with each other."""
    from api.db import store_resume_session, get_resume_session

    await store_resume_session("user-a", "Alice's resume: Python, React")
    await store_resume_session("user-b", "Bob's resume: Java, Spring")

    assert await get_resume_session("user-a") == "Alice's resume: Python, React"
    assert await get_resume_session("user-b") == "Bob's resume: Java, Spring"


@pytest.mark.asyncio
async def test_overwrite_session():
    """Storing a new value for the same session_id overwrites the old one."""
    from api.db import store_resume_session, get_resume_session

    await store_resume_session("test-overwrite", "original resume")
    await store_resume_session("test-overwrite", "updated resume v2")

    result = await get_resume_session("test-overwrite")
    assert result == "updated resume v2"
