"""Typed state schemas for all LangGraph pipelines.

Each graph uses a TypedDict as its state type, giving compile-time safety
and self-documenting APIs. LangGraph reads these to understand which
keys exist and how reducers merge node outputs into state.
"""

from __future__ import annotations

from typing import Annotated, Optional
from typing_extensions import TypedDict

from langgraph.graph.message import add_messages

from job_scraper.models import (
    RawJobData,
    ResumeParseOutput,
    ResumeAssessmentOutput,
    ATSScoreOutput,
)


# ── Job Discovery Graph ──────────────────────────────────────────────────────

class JobDiscoveryState(TypedDict, total=False):
    """State for the Job Discovery pipeline.

    Fields:
        target_role: The job title to search for.
        resume_text: User's resume (empty string = daemon mode → skip scoring).
        resume_profile: Structured intelligence from the resume analysis agent.
            Contains: {skills, strong_skills, seniority, domains, search_queries}
        raw_urls: URLs discovered by the search node.
        raw_search_results: Full Serper results with title/link/snippet.
        scraped_jobs: Structured job data extracted from each URL.
        validated_jobs: Jobs that passed the quality gate (clean, relevant, real).
        scored_report: Markdown report with ranked jobs (only when resume provided).
        persisted_count: Number of jobs saved to MongoDB.
        errors: Error messages collected during execution.
    """
    target_role: str
    resume_text: str
    resume_profile: dict
    search_retry_count: int
    raw_urls: list[str]
    raw_search_results: list[dict]
    api_jobs: list[dict]
    scraped_jobs: list[dict]
    validated_jobs: list[dict]
    scored_report: str
    job_rankings: list[dict]
    persisted_count: int
    errors: list[str]


# ── Resume Analysis Graph ────────────────────────────────────────────────────

class ResumeAnalysisState(TypedDict, total=False):
    """State for the Resume Analysis pipeline.

    Fields:
        resume_text: Raw resume text input.
        parsed: Structured extraction (name, skills, experience, etc.).
        assessment: Full career assessment with scoring.
    """
    resume_text: str
    parsed: Optional[dict]
    assessment: Optional[dict]


# ── ATS Scoring Graph ────────────────────────────────────────────────────────

class ATSScoringState(TypedDict, total=False):
    """State for the ATS Scoring pipeline.

    Fields:
        resume_text: User's resume text.
        job_title: Target job title.
        job_description: Full job description text.
        required_skills: Skills listed as required in the JD.
        jd_analysis: Extracted JD requirements from the analysis node.
        score: Final ATS compatibility score output.
    """
    resume_text: str
    job_title: str
    job_description: str
    required_skills: str
    jd_analysis: Optional[dict]
    score: Optional[dict]


# ── Resume Enhancement Graph ─────────────────────────────────────────────────

class ResumeEnhancementState(TypedDict, total=False):
    """State for the Resume Enhancement pipeline.

    Fields:
        resume_text: Original resume text.
        job_title: Target job title.
        job_description: Target job description.
        missing_keywords: Known missing keywords from ATS analysis.
        gap_analysis: Structured gap report from the analysis node.
        enhanced_resume: Rewritten resume in Markdown format.
        evaluation_report: Structured quality evaluation from the LLM-as-judge.
        evaluation_feedback: Feedback string passed to rewrite on retry.
        enhancement_retry_count: Number of enhancement retry attempts (max 1).
        latex_output: LaTeX source code for Overleaf.
    """
    resume_text: str
    job_title: str
    job_description: str
    missing_keywords: str
    gap_analysis: Optional[str]
    enhanced_resume: Optional[str]
    evaluation_report: Optional[dict]
    evaluation_feedback: Optional[str]
    enhancement_retry_count: int
    latex_output: Optional[str]


# ── User Matching Graph (SSE streaming) ──────────────────────────────────────

class UserMatchingState(TypedDict, total=False):
    """State for the per-user SSE matching pipeline.

    Fields:
        resume_text: User's resume text.
        target_role: Derived target role for filtering.
        raw_jobs: Raw job documents fetched from MongoDB.
        matched_jobs: Evaluated and scored job payloads.
        total_scanned: Total number of raw jobs scanned.
    """
    resume_text: str
    target_role: str
    raw_jobs: list[dict]
    matched_jobs: list[dict]
    total_scanned: int
