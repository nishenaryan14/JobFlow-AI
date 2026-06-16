"""ATS Gap Analysis Graph — Identifies keyword gaps between resume and JD.

Pipeline: extract_jd_keywords → scan_resume_gaps → classify_suggestions → END
Input:    {"resume_data": <dict>, "job_description": <str>}
Output:   {"suggestions": [...], "jd_keywords": [...], "matched_keywords": [...]}
"""

import json
from typing import TypedDict

from langgraph.graph import StateGraph, START, END

from job_scraper.graphs.llm_factory import get_deepseek_chat, get_deepseek_reasoner
from job_scraper.graphs.error_handling import call_llm_structured
from job_scraper.graphs.tracing import log_node
from job_scraper.models import PreciseResumeData, KeywordSuggestion, ATSGapAnalysisOutput


# ── State ─────────────────────────────────────────────────────────────────────

class ATSGapState(TypedDict, total=False):
    resume_data: dict
    job_description: str
    jd_keywords: list
    matched_keywords: list
    suggestions: list


# ── Intermediate schemas for structured LLM output ────────────────────────────

from pydantic import BaseModel, Field
from typing import List


class JDKeyword(BaseModel):
    keyword: str = ""
    importance: str = "important"  # critical | important | nice_to_have
    category: str = "technical"  # technical | soft_skill | certification | tool


class JDKeywordsOutput(BaseModel):
    keywords: List[JDKeyword] = Field(default_factory=list)


class GapItem(BaseModel):
    keyword: str = ""
    status: str = "missing"  # matched | missing
    action_type: str = "add"  # add | rephrase
    section: str = "skills"  # skills | experience | summary | projects
    suggestion: str = ""
    rephrase_target: str = ""
    rephrase_result: str = ""


class GapScanOutput(BaseModel):
    matched_keywords: List[str] = Field(default_factory=list)
    gaps: List[GapItem] = Field(default_factory=list)


# ── Node 1: Extract JD Keywords ──────────────────────────────────────────────

@log_node("extract_jd_keywords")
async def extract_jd_keywords(state: ATSGapState) -> dict:
    """Extract required and preferred keywords from the job description using DeepSeek Reasoner."""
    llm = get_deepseek_reasoner()

    prompt = f"""Analyze this job description and extract key search terms, technologies, and competencies.

Job Description:
{state["job_description"]}

CRITICAL FILTERING RULES:
1. ONLY extract concrete hard skills, programming languages, frameworks, tools, systems, methodologies, and certifications.
2. DO NOT extract soft skills (e.g., communication, teamwork, leadership, collaboration) or generic action verbs (e.g., develop, manage, build).
3. DO NOT extract noise/filler words (e.g., years, experience, candidate, responsibilities, track record).
4. Classify each extracted keyword category:
   - "technical" = programming languages, frameworks, technical concepts, databases
   - "tool" = developer tools, SaaS platforms, cloud services, libraries
   - "certification" = certified credentials (e.g., AWS, PMP)
   - "soft_skill" = ONLY extract if it is a highly specialized industry-standard domain competency (e.g., "Agile", "Scrum"), otherwise do not extract generic soft skills at all.

For each keyword, classify its importance:
- "critical" = explicitly required tech/tool, a clear deal-breaker if missing
- "important" = strongly preferred tech/tool or mentioned multiple times
- "nice_to_have" = mentioned once or in preferred section

Return a JSON object with:
- keywords: array of objects with {{keyword, importance, category}}
  where category is one of: technical, soft_skill, certification, tool"""

    result = await call_llm_structured(
        llm=llm,
        prompt=prompt,
        output_schema=JDKeywordsOutput,
        system_prompt="You are an ATS keyword extraction expert. Extract every relevant keyword from the job description. Output only valid JSON.",
    )

    jd_keywords = [
        {"keyword": kw.keyword, "importance": kw.importance, "category": kw.category}
        for kw in result.keywords
    ]

    return {"jd_keywords": jd_keywords}


# ── Node 2: Scan Resume Gaps ─────────────────────────────────────────────────

@log_node("scan_resume_gaps")
async def scan_resume_gaps(state: ATSGapState) -> dict:
    """Compare resume data against JD keywords to identify matches and gaps."""
    llm = get_deepseek_chat()

    resume_json = json.dumps(state["resume_data"], indent=2, default=str)
    keywords_json = json.dumps(state["jd_keywords"], indent=2, default=str)

    prompt = f"""Compare this resume against the required job keywords and identify gaps.

RESUME DATA (structured):
{resume_json}

JOB KEYWORDS (extracted from JD):
{keywords_json}

For each keyword:
1. Check if it's already present in the resume (matched)
2. If missing, determine the best action:
   - "add": Add the keyword as a new skill or bullet point
   - "rephrase": Modify an existing bullet to naturally incorporate the keyword

For REPHRASE actions:
- Identify the specific existing bullet point that could be modified
- Provide the rephrased version that naturally incorporates the keyword
- Do NOT fabricate experience — only rephrase existing content

For ADD actions:
- Suggest the exact text/bullet to add
- Specify which section it belongs in (skills, experience, summary, projects)

Return a JSON object with:
- matched_keywords: array of keyword strings found in the resume
- gaps: array of objects with {{keyword, status, action_type, section, suggestion, rephrase_target, rephrase_result}}
  - status: "matched" or "missing"
  - action_type: "add" or "rephrase"
  - section: "skills" | "experience" | "summary" | "projects"
  - suggestion: the exact text to add (for "add" actions)
  - rephrase_target: the original bullet text (for "rephrase" actions, empty for "add")
  - rephrase_result: the rephrased bullet text (for "rephrase" actions, empty for "add")"""

    result = await call_llm_structured(
        llm=llm,
        prompt=prompt,
        output_schema=GapScanOutput,
        system_prompt="You are a resume optimization expert. Analyze keyword gaps precisely. Never fabricate experience. Output only valid JSON.",
    )

    return {
        "matched_keywords": result.matched_keywords,
        "suggestions": [
            {
                "keyword": gap.keyword,
                "action_type": gap.action_type,
                "section": gap.section,
                "suggestion": gap.suggestion,
                "rephrase_target": gap.rephrase_target,
                "rephrase_result": gap.rephrase_result,
            }
            for gap in result.gaps
            if gap.status == "missing"
        ],
    }


# ── Node 3: Classify Suggestions ─────────────────────────────────────────────

@log_node("classify_suggestions")
async def classify_suggestions(state: ATSGapState) -> dict:
    """Rank and finalize suggestions with reasoning using Gemini Flash."""
    llm = get_deepseek_reasoner()

    suggestions_json = json.dumps(state.get("suggestions", []), indent=2, default=str)
    jd_keywords_json = json.dumps(state.get("jd_keywords", []), indent=2, default=str)
    matched_json = json.dumps(state.get("matched_keywords", []), indent=2, default=str)

    prompt = f"""Review and finalize these ATS gap analysis suggestions.

JD KEYWORDS EXTRACTED:
{jd_keywords_json}

ALREADY MATCHED IN RESUME:
{matched_json}

SUGGESTED IMPROVEMENTS (from gap scan):
{suggestions_json}

For each suggestion:
1. Assign an importance level: "critical", "important", or "nice_to_have"
2. Provide clear reasoning for why this keyword matters for the role
3. Verify the suggestion text is professional and natural-sounding
4. Remove any suggestions that would fabricate non-existent experience

Also calculate the overall match percentage:
- match_percentage = (matched hard-skills count) / (total unique hard-skills JD keywords) × 100
  where hard-skills are keywords with category 'technical', 'tool', or 'certification'.
  Do NOT include 'soft_skill' keywords or generic/behavioral competencies in the match_percentage calculation, as these must not affect the candidate's core ATS compatibility score.

Return a JSON object with:
- suggestions: array of objects with {{keyword, importance, section, suggestion, reasoning, rephrase_target, rephrase_result, action_type}}
- jd_keywords: flat array of all keyword strings from the JD
- matched_keywords: flat array of matched keyword strings
- match_percentage: integer 0-100"""

    result = await call_llm_structured(
        llm=llm,
        prompt=prompt,
        output_schema=ATSGapAnalysisOutput,
        system_prompt="You are a career coaching expert. Rank and validate ATS suggestions for maximum impact. Output only valid JSON.",
    )

    return {
        "suggestions": [s.model_dump() for s in result.suggestions],
        "jd_keywords": result.jd_keywords,
        "matched_keywords": result.matched_keywords,
        "match_percentage": result.match_percentage,
    }


# ── Graph Assembly ────────────────────────────────────────────────────────────

def build_ats_gap_graph() -> StateGraph:
    """Construct the ATS Gap Analysis graph.

    Pipeline: extract_jd_keywords → scan_resume_gaps → classify_suggestions → END
    """
    graph = StateGraph(ATSGapState)

    graph.add_node("extract_jd_keywords", extract_jd_keywords)
    graph.add_node("scan_resume_gaps", scan_resume_gaps)
    graph.add_node("classify_suggestions", classify_suggestions)

    graph.add_edge(START, "extract_jd_keywords")
    graph.add_edge("extract_jd_keywords", "scan_resume_gaps")
    graph.add_edge("scan_resume_gaps", "classify_suggestions")
    graph.add_edge("classify_suggestions", END)

    return graph


# Compiled graph
ats_gap_graph = build_ats_gap_graph().compile()
