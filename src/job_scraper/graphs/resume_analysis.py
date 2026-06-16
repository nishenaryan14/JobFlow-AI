"""Resume Analysis Graph — Parses and evaluates resumes using LangGraph.

Replaces: crews/resume_analyzer.py (ResumeAnalyzerCrew)

Pipeline: parse_resume → assess_skills
Input:    {"resume_text": "<raw resume text>"}
Output:   {"assessment": <ResumeAssessmentOutput dict>}

Each node uses with_structured_output() for guaranteed schema compliance.
No fallback extraction needed — the pydantic model is enforced by the LLM.
"""

from langgraph.graph import StateGraph, START, END

from job_scraper.graphs.state import ResumeAnalysisState
from job_scraper.graphs.llm_factory import get_deepseek_chat, get_deepseek_reasoner
from job_scraper.graphs.error_handling import call_llm_structured
from job_scraper.graphs.tracing import log_node
from job_scraper.models import ResumeParseOutput, ResumeAssessmentOutput


# ── Node: Parse Resume ───────────────────────────────────────────────────────

@log_node("parse_resume")
async def parse_resume(state: ResumeAnalysisState) -> dict:
    """Extract structured data from raw resume text.

    Returns parsed name, email, skills, experience, education, etc.
    """
    llm = get_deepseek_chat()

    prompt = f"""Parse the following resume text and extract ALL structured data.
Be extremely thorough — read every line carefully.

Extract:
1. **name** — Full name of the candidate (usually the first prominent line)
2. **email** — Contact email address
3. **phone** — Phone number (with country code if present)
4. **linkedin** — LinkedIn URL if present
5. **skills** — Every technical skill, tool, framework, or language mentioned anywhere in the resume
6. **strongSkills** — Top 5-8 skills where the candidate shows clear depth (appear in work experience bullets, projects, or listed as primary expertise)
7. **experience** — ALL work experience entries. For each entry provide:
   - title: job title
   - company: employer name
   - duration: date range (e.g. "Jan 2022 – Present")
8. **education** — All education credentials (degree + institution + graduation year if present)
9. **projects** — Notable projects mentioned, with one-line description

IMPORTANT RULES:
- Read the ENTIRE resume text below, do not skip any section
- For experience, look for ALL date ranges and extract jobs associated with those dates
- If sections are not labeled, infer from context

Resume Text:
{state["resume_text"]}"""

    parsed = await call_llm_structured(
        llm=llm,
        prompt=prompt,
        output_schema=ResumeParseOutput,
        system_prompt="You are an expert resume parser. Output only valid JSON matching the exact schema requested.",
    )

    return {"parsed": parsed.model_dump()}


# ── Node: Assess Skills ──────────────────────────────────────────────────────

@log_node("assess_skills")
async def assess_skills(state: ResumeAnalysisState) -> dict:
    """Evaluate the candidate's profile and produce a career assessment.

    Takes the parsed resume data and adds: overallScore, strengths,
    weaknesses, and a professional summary.
    """
    llm = get_deepseek_reasoner()
    parsed_data = state.get("parsed", {})

    prompt = f"""You have been given the parsed resume data below.
Produce a comprehensive career assessment for this candidate's profile.

Parsed Resume Data:
{parsed_data}

Evaluate:
1. **overallScore** (integer 1-10):
   - 9-10: Outstanding — would immediately pass most senior/staff screening
   - 7-8: Strong — competitive for mid-senior roles with strong trajectory
   - 5-6: Promising — ready for mid-level positions, clear growth path
   - 3-4: Early stage — needs more experience or skills
   - 1-2: Very early — significant gaps

2. **strengths** (array of 4-6 strings):
   - Specific, not generic. E.g., "4+ years of production RAG pipeline development" NOT "good programmer"
   - Reference actual skills and experience from the parsed resume

3. **weaknesses** (array of 3-5 strings):
   - Specific and actionable. E.g., "No containerization (Docker/Kubernetes) mentioned despite senior target roles"
   - Do not fabricate gaps — only flag genuinely missing items for the tech market

4. **summary** (string, 2-4 sentences):
   - A professional paragraph-style career summary for this specific candidate
   - Mention their actual name, years of experience, top skills, and career trajectory

Combine your assessment with ALL the parsed resume data fields (name, email, phone, linkedin, skills, strongSkills, experience, education, projects).
Your output MUST include every field from the parsed data PLUS the assessment fields."""

    assessment = await call_llm_structured(
        llm=llm,
        prompt=prompt,
        output_schema=ResumeAssessmentOutput,
        system_prompt="You are an expert career advisor. Output only valid JSON merging all parsed data with your assessment.",
    )

    return {"assessment": assessment.model_dump()}


# ── Graph Assembly ────────────────────────────────────────────────────────────

def build_resume_analysis_graph() -> StateGraph:
    """Construct the Resume Analysis graph.

    Pipeline: parse_resume → assess_skills
    """
    graph = StateGraph(ResumeAnalysisState)

    graph.add_node("parse_resume", parse_resume)
    graph.add_node("assess_skills", assess_skills)

    graph.add_edge(START, "parse_resume")
    graph.add_edge("parse_resume", "assess_skills")
    graph.add_edge("assess_skills", END)

    return graph


# Compiled graph — ready to invoke
resume_analysis_graph = build_resume_analysis_graph().compile()
