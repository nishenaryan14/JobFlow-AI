"""ATS Scoring Graph — Calculates ATS compatibility between resume and JD.

Replaces: crews/ats_scorer.py (ATSScorerCrew)

Pipeline: score_ats (single node — analyzes JD + scores match in one LLM call)
Input:    {"resume_text": ..., "job_title": ..., "job_description": ..., "required_skills": ...}
Output:   {"score": <ATSScoreOutput dict>}
"""

from langgraph.graph import StateGraph, START, END

from job_scraper.graphs.state import ATSScoringState
from job_scraper.graphs.llm_factory import get_deepseek_reasoner
from job_scraper.graphs.error_handling import call_llm_structured
from job_scraper.graphs.tracing import log_node
from job_scraper.models import ATSScoreOutput


# ── Node: Score ATS (single-pass) ────────────────────────────────────────────

@log_node("score_ats")
async def score_ats(state: ATSScoringState) -> dict:
    """Analyze JD and calculate ATS score in a single LLM call.
    
    Merged from the previous two-step (analyze_jd → score_match) pipeline
    to reduce latency and API costs.
    """
    llm = get_deepseek_reasoner()

    prompt = f"""Analyze the job description and score the resume for ATS compatibility.

Job Title: {state["job_title"]}
Job Description: {state["job_description"]}
Listed Required Skills: {state.get("required_skills", "")}

Resume:
{state["resume_text"]}

Perform TWO tasks:

TASK 1 — JD Analysis: Extract ONLY concrete technical skills, languages, frameworks, developer tools, databases, cloud systems, technical methodologies, and certifications from the job description. 
* DO NOT extract soft skills (e.g. communication, teamwork, leadership, cross-functional collaboration).
* DO NOT extract generic resume vocabulary (e.g. years, experience, developer, engineer, candidate).

TASK 2 — ATS Scoring: Using the extracted hard requirements, score the resume:
* **Keyword Match** — What percentage of the extracted technical keywords from TASK 1 appear in the resume? (This must strictly measure concrete hard skills).
* **Skills Alignment** — How well do the candidate's core technologies align with the role?
* **Experience Relevance** — Does the technical experience align with the responsibilities?
* **Section Structure** — Does the resume have proper ATS-friendly sections?

CRITICAL: The presence or absence of soft skills (e.g. communication, collaboration) or generic filler verbs must NOT affect the keywordMatchPercent, overallScore, or sectionScores. Focus 100% on hard technical qualifications, tools, and certifications.

Return a JSON object with:
- overallScore (0-100)
- keywordMatchPercent (0-100)
- matchedKeywords (array of matched keyword strings)
- missingKeywords (array of missing keyword strings)
- sectionScores: {{skills: 0-100, experience: 0-100, education: 0-100}}
- recommendations (array of 3-5 actionable improvement tips)"""

    score = await call_llm_structured(
        llm=llm,
        prompt=prompt,
        output_schema=ATSScoreOutput,
        system_prompt="You are an ATS scoring expert. Analyze the JD and score the resume. Focus strictly on hard technical skills. Output only valid JSON.",
    )

    return {"score": score.model_dump()}


# ── Graph Assembly ────────────────────────────────────────────────────────────

def build_ats_scoring_graph() -> StateGraph:
    """Construct the ATS Scoring graph.

    Pipeline: score_ats (single node)
    """
    graph = StateGraph(ATSScoringState)

    graph.add_node("score_ats", score_ats)

    graph.add_edge(START, "score_ats")
    graph.add_edge("score_ats", END)

    return graph


# Compiled graph
ats_scoring_graph = build_ats_scoring_graph().compile()
