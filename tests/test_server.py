"""
Unit and integration tests for the FastAPI bridge server (LangGraph engine).

Run with:  uv run pytest tests/ -v
"""

import pytest
import json
from unittest.mock import patch


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """Create a TestClient with the FastAPI app.
    
    Patches the background scheduler so the test suite doesn't spin up
    APScheduler + LangGraph processes during test initialization.
    """
    from fastapi.testclient import TestClient
    with patch("api.background_scout.start_scheduler", return_value=None), \
         patch("api.db.ensure_indexes", return_value=None):
        from api.server import app
        with TestClient(app) as c:
            yield c


# ── Health ────────────────────────────────────────────────────────────────────

def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["service"] == "jobflow-api"
    assert data["engine"] == "langgraph"


# ── Session Management ────────────────────────────────────────────────────────

def test_init_session_returns_session_id(client):
    r = client.post("/init-session", json={"resume_text": "Python FastAPI developer with 5 years building production REST APIs and microservices"})
    assert r.status_code == 200
    data = r.json()
    assert "session_id" in data
    assert len(data["session_id"]) == 36  # UUID4 format
    assert data["ttl_hours"] == 4


def test_init_session_rejects_short_text(client):
    r = client.post("/init-session", json={"resume_text": "Hi"})
    assert r.status_code == 400


def test_session_status_active(client):
    # Create session with valid long-enough text
    r = client.post("/init-session", json={"resume_text": "Senior Python developer with 8 years experience in FastAPI, Docker, Kubernetes"})
    assert r.status_code == 200, f"Expected 200 but got {r.status_code}: {r.text}"
    session_id = r.json()["session_id"]

    # Verify it's active
    r2 = client.get(f"/session/{session_id}/status")
    assert r2.status_code == 200
    assert r2.json()["active"] is True


def test_session_status_not_found(client):
    r = client.get("/session/00000000-0000-0000-0000-000000000000/status")
    assert r.status_code == 404
    assert r.json()["active"] is False


# ── File Parsing ──────────────────────────────────────────────────────────────

def test_parse_pdf_empty_file(client):
    """Server should not crash on an empty PDF upload."""
    r = client.post(
        "/parse-pdf",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert r.status_code == 200
    data = r.json()
    assert "text" in data
    assert "pages" in data


def test_parse_docx_invalid_file(client):
    """Server should return an error string for a non-DOCX binary blob."""
    r = client.post(
        "/parse-docx",
        files={"file": ("fake.docx", b"not-a-real-docx", "application/octet-stream")},
    )
    assert r.status_code == 200
    # Should not crash — returns graceful error message
    assert "text" in r.json()


# ── ATS Fallback Logic ────────────────────────────────────────────────────────

def test_fallback_ats_perfect_match():
    from api.server import _fallback_ats
    result = _fallback_ats(
        "Python FastAPI CrewAI developer",
        "Python web development role",
        ["python", "fastapi", "crewai"],
    )
    assert result["keywordMatchPercent"] == 100
    assert set(result["matchedKeywords"]) == {"python", "fastapi", "crewai"}
    assert result["missingKeywords"] == []


def test_fallback_ats_no_match():
    from api.server import _fallback_ats
    result = _fallback_ats(
        "Java Spring Boot developer",
        "Python ML role",
        ["python", "pytorch", "crewai"],
    )
    assert result["keywordMatchPercent"] == 0
    assert result["matchedKeywords"] == []
    assert len(result["missingKeywords"]) == 3


def test_fallback_ats_partial_match():
    from api.server import _fallback_ats
    result = _fallback_ats(
        "Python developer with some react",
        "Full-stack role",
        ["python", "react", "kubernetes"],
    )
    assert result["keywordMatchPercent"] == pytest.approx(66, abs=2)
    assert "python" in result["matchedKeywords"]
    assert "kubernetes" in result["missingKeywords"]


# ── Role Derivation ───────────────────────────────────────────────────────────

def test_derive_target_role_agentic():
    from api.server import _derive_target_role
    assert _derive_target_role("langgraph crewai multi-agent system") == "AI Agent Engineer"


def test_derive_target_role_ml():
    from api.server import _derive_target_role
    assert _derive_target_role("pytorch tensorflow machine learning") == "Machine Learning Engineer"


def test_derive_target_role_fallback():
    from api.server import _derive_target_role
    assert _derive_target_role("general software development") == "Software Engineer"


# ── Fallback Analysis ─────────────────────────────────────────────────────────

def test_fallback_analysis_finds_skills():
    from api.server import _fallback_analysis
    result = _fallback_analysis("# John Dev\nPython, React, MongoDB, Docker, LangGraph, CrewAI")
    assert result["overallScore"] >= 3
    assert len(result["skills"]) >= 3


def test_fallback_analysis_empty_resume():
    from api.server import _fallback_analysis
    result = _fallback_analysis("")
    assert result["name"] == "Candidate"
    assert result["skills"] == []


# ── Graph Import Verification ─────────────────────────────────────────────────

def test_graphs_importable():
    """Verify all LangGraph pipelines can be imported without error."""
    from job_scraper.graphs.resume_analysis import resume_analysis_graph
    from job_scraper.graphs.ats_scoring import ats_scoring_graph
    from job_scraper.graphs.resume_enhancement import resume_enhancement_graph
    from job_scraper.graphs.job_discovery import job_discovery_graph
    from job_scraper.graphs.user_matching import stream_job_matches
    
    # Verify graph topology
    assert len(resume_analysis_graph.get_graph().nodes) == 4  # START + 2 nodes + END
    assert len(ats_scoring_graph.get_graph().nodes) == 3  # START + 1 node + END
    assert len(resume_enhancement_graph.get_graph().nodes) == 7  # START + 5 nodes + END
    assert len(job_discovery_graph.get_graph().nodes) == 10  # START + 8 nodes + END (includes conditional edge & parallel flow)


def test_state_schemas_importable():
    """Verify all typed state schemas can be imported."""
    from job_scraper.graphs.state import (
        JobDiscoveryState,
        ResumeAnalysisState,
        ATSScoringState,
        ResumeEnhancementState,
        UserMatchingState,
    )
    # Verify they're TypedDicts
    assert "resume_text" in ResumeAnalysisState.__annotations__
    assert "target_role" in JobDiscoveryState.__annotations__


def test_llm_factory_importable():
    """Verify LLM factory functions are importable."""
    from job_scraper.graphs.llm_factory import get_deepseek_chat, get_gemini_flash
    # We don't call them (would need API keys) — just verify import
    assert callable(get_deepseek_chat)
    assert callable(get_gemini_flash)
