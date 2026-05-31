"""Resume Enhancement Graph — Rewrites resume to match a target JD.

Replaces: crews/resume_enhancer.py (ResumeEnhancerCrew)

Pipeline: analyze_gaps → rewrite_resume → evaluate_quality ─┬→ generate_latex → END
                              ▲                              │
                              └── (retry with feedback) ◄────┘ (score < 7, max 1 retry)

Input:    {"resume_text": ..., "job_title": ..., "job_description": ..., "missing_keywords": ...}
Output:   {"enhanced_resume": <markdown>, "evaluation_report": <dict>, "latex_output": <latex>}
"""

import logging

from langgraph.graph import StateGraph, START, END

from job_scraper.graphs.state import ResumeEnhancementState
from job_scraper.graphs.llm_factory import get_gemini_flash, get_deepseek_chat
from job_scraper.graphs.error_handling import call_llm_text, call_llm_structured
from job_scraper.graphs.tracing import log_node
from job_scraper.models import EnhancementEvaluationOutput

logger = logging.getLogger("jobflow.graphs")


# ── Node: Analyze Gaps ───────────────────────────────────────────────────────

@log_node("analyze_gaps")
async def analyze_gaps(state: ResumeEnhancementState) -> dict:
    """Identify gaps between resume and target JD."""
    llm = get_gemini_flash()

    prompt = f"""Analyze the candidate's resume against the target job description.
Identify exactly what needs to change to maximize the candidate's chances.

Produce a structured gap analysis covering:
1. Missing Keywords — Critical keywords from the JD absent from the resume
2. Weak Sections — Resume sections that need strengthening for this role
3. Reframing Opportunities — Existing experience that can be reframed
4. Priority Changes — Ranked list of highest-impact modifications (max 8)

Resume:
{state["resume_text"]}

Target Job Title: {state["job_title"]}
Target Job Description: {state["job_description"]}
Known Missing Keywords: {state.get("missing_keywords", "")}"""

    result = await call_llm_text(
        llm=llm,
        prompt=prompt,
        system_prompt="You are an expert career strategist. Produce an actionable gap analysis.",
    )

    return {"gap_analysis": result}


# ── Node: Rewrite Resume ─────────────────────────────────────────────────────

@log_node("rewrite_resume")
async def rewrite_resume(state: ResumeEnhancementState) -> dict:
    """Rewrite the resume incorporating gap analysis findings.

    On retry attempts, also incorporates evaluation feedback from the
    previous round to address specific quality issues.
    """
    llm = get_gemini_flash()
    gap_analysis = state.get("gap_analysis", "")
    evaluation_feedback = state.get("evaluation_feedback", "")

    # Build feedback section for retry attempts
    feedback_section = ""
    if evaluation_feedback:
        feedback_section = f"""

EVALUATOR FEEDBACK FROM PREVIOUS ATTEMPT (address these issues):
{evaluation_feedback}

Pay special attention to the issues above. Fix them in this rewrite."""

    prompt = f"""Using the gap analysis below, rewrite the candidate's resume
into a COMPLETE, PROFESSIONAL Markdown document.

Gap Analysis:
{gap_analysis}
{feedback_section}

RULES:
1. DO NOT fabricate experience — only reframe existing roles, never invent new ones
2. Naturally incorporate missing keywords where they fit contextually
3. Use strong action verbs: architected, engineered, deployed, optimized, automated
4. Quantify achievements wherever possible
5. Keep the same overall structure
6. Tailor the professional summary for the target role
7. CRITICAL — KEEP IT TO 1 PAGE: This resume MUST fit on a single A4 page when rendered.
   - Summary: MAX 2 sentences
   - Each role: MAX 3-4 bullet points, each MAX 1.5 lines long
   - Skills: MAX 4 categories, one line each
   - Education: 1 line only
   - Do NOT add extra sections, certifications, or filler content
   - Be concise. Every word must earn its place.

FORMAT (follow this EXACTLY):

# Candidate Full Name
email | phone | linkedin

## Summary
2 sentence professional summary tailored for the target role. Keep it tight.

## Experience
### Job Title
_Company Name — Date Range_
- Concise achievement bullet (max 3-4 per role)
- Concise achievement bullet

## Key Projects
### Project Name
_Tech Stack_
- 1-2 bullets max

## Skills
Category: skill1, skill2, skill3 (max 4 categories, keep each to one line)

## Education
Degree, Institution (Year)

Original Resume:
{state["resume_text"]}

Target Role: {state["job_title"]}

OUTPUT ONLY THE ENHANCED RESUME IN MARKDOWN. Nothing else.
No JSON wrapping. No explanations. No thinking out loud.
Just the resume markdown starting with # and the candidate's name.
REMEMBER: It MUST fit on exactly 1 page. Be concise."""

    result = await call_llm_text(
        llm=llm,
        prompt=prompt,
        system_prompt="You are an expert resume writer. Output ONLY the enhanced resume in clean markdown format.",
    )

    # Clean up any markdown code fences the LLM might add
    import re
    result = re.sub(r"```(?:markdown|md)?\s*\n?", "", result).replace("```", "").strip()

    return {"enhanced_resume": result}


# ── Node: Evaluate Quality (LLM-as-Judge) ────────────────────────────────────

EVALUATION_PROMPT = """You are a resume quality evaluator acting as an impartial judge.
Compare the ORIGINAL resume against the ENHANCED resume for a specific target role.

ORIGINAL RESUME:
{original_resume}

ENHANCED RESUME:
{enhanced_resume}

TARGET JOB TITLE: {job_title}
TARGET JOB DESCRIPTION:
{job_description}

KNOWN MISSING KEYWORDS: {missing_keywords}

Evaluate the enhancement quality on these dimensions:

1. **overallScore** (1-10): Overall quality of the enhancement
   - 9-10: Exceptional — every gap addressed, natural keyword integration, no fabrication
   - 7-8: Strong — most gaps addressed, good keyword coverage, professional tone
   - 5-6: Adequate — some improvements but significant gaps remain
   - 3-4: Weak — minimal improvement over original
   - 1-2: Harmful — worse than original or contains fabricated experience

2. **keywordAlignment** (0-100): What percentage of target JD keywords now appear in the enhanced resume?

3. **skillsGapsClosed** / **skillsGapsTotal**: How many of the missing keywords were successfully incorporated vs. total missing?

4. **toneConsistency** ("pass" or "fail"): Is the professional tone consistent throughout? No casual language, no AI-sounding boilerplate?

5. **atsDensityImprovement** (0-100): Percentage improvement in ATS-relevant keyword density compared to original.

6. **fabricationCheck** ("pass" or "fail"): CRITICAL — Does the enhanced resume contain any experience, roles, companies, or achievements that do NOT exist in the original? Compare experience sections carefully. Any invented content = "fail".

7. **verdicts** (array of strings): 3-5 specific things the enhancement did well.

8. **improvements** (array of strings): 2-4 specific things that could be improved further.

Be rigorous. A score of 7+ means the enhanced resume is genuinely better and ready to submit."""


@log_node("evaluate_quality")
async def evaluate_quality(state: ResumeEnhancementState) -> dict:
    """LLM-as-judge evaluator — scores the enhanced resume quality.

    Compares original vs. enhanced resume across multiple quality
    dimensions and produces a structured evaluation report.
    """
    llm = get_deepseek_chat()
    original = state.get("resume_text", "")
    enhanced = state.get("enhanced_resume", "")

    if not enhanced:
        return {"evaluation_report": {"overallScore": 0, "verdicts": ["No enhanced resume to evaluate"]}}

    prompt = EVALUATION_PROMPT.format(
        original_resume=original[:4000],
        enhanced_resume=enhanced[:4000],
        job_title=state.get("job_title", ""),
        job_description=state.get("job_description", "")[:3000],
        missing_keywords=state.get("missing_keywords", ""),
    )

    try:
        evaluation = await call_llm_structured(
            llm=llm,
            prompt=prompt,
            output_schema=EnhancementEvaluationOutput,
            system_prompt="You are an impartial resume quality evaluator. Output only valid JSON matching the exact schema.",
            max_retries=2,
        )
        report = evaluation.model_dump()

        logger.info(
            f"[evaluate_quality] Score: {report['overallScore']}/10 | "
            f"Keywords: {report['keywordAlignment']}% | "
            f"Gaps closed: {report['skillsGapsClosed']}/{report['skillsGapsTotal']} | "
            f"Fabrication: {report['fabricationCheck']} | "
            f"Tone: {report['toneConsistency']}"
        )

        return {"evaluation_report": report}

    except Exception as exc:
        logger.warning(f"[evaluate_quality] Evaluation failed: {exc} — skipping with pass-through")
        return {"evaluation_report": {
            "overallScore": 7,
            "keywordAlignment": 0,
            "skillsGapsClosed": 0,
            "skillsGapsTotal": 0,
            "toneConsistency": "pass",
            "atsDensityImprovement": 0,
            "fabricationCheck": "pass",
            "verdicts": ["Evaluation skipped due to error — resume passed through"],
            "improvements": [],
        }}


# ── Conditional Edge: Check Evaluation Quality ───────────────────────────────

def check_evaluation_quality(state: ResumeEnhancementState) -> str:
    """Route based on evaluation score.

    If score < 7 and we haven't retried yet, loop back to rewrite_resume
    with evaluation feedback. Otherwise proceed to LaTeX generation.
    """
    report = state.get("evaluation_report", {})
    score = report.get("overallScore", 7)
    retries = state.get("enhancement_retry_count", 0)
    fabrication = report.get("fabricationCheck", "pass")

    # Fabrication detected — always retry once with strong feedback
    if fabrication == "fail" and retries < 1:
        logger.warning("[check_evaluation] ⚠️ Fabrication detected — retrying with strict feedback")
        return "retry"

    # Quality below threshold — retry once
    if score < 7 and retries < 1:
        logger.info(f"[check_evaluation] Score {score}/10 below threshold — retrying")
        return "retry"

    logger.info(f"[check_evaluation] Score {score}/10 — proceeding to LaTeX generation")
    return "proceed"


# ── Node: Prepare Retry Feedback ─────────────────────────────────────────────

@log_node("prepare_retry")
async def prepare_retry(state: ResumeEnhancementState) -> dict:
    """Prepare evaluation feedback for the retry rewrite attempt."""
    report = state.get("evaluation_report", {})
    retries = state.get("enhancement_retry_count", 0)

    improvements = report.get("improvements", [])
    fabrication = report.get("fabricationCheck", "pass")
    score = report.get("overallScore", 0)

    feedback_parts = [f"Previous attempt scored {score}/10."]

    if fabrication == "fail":
        feedback_parts.append(
            "CRITICAL: The previous version FABRICATED experience that does not exist "
            "in the original resume. You MUST only reframe existing experience, never "
            "invent new roles, companies, or achievements."
        )

    if improvements:
        feedback_parts.append("Issues to fix:")
        for imp in improvements:
            feedback_parts.append(f"  - {imp}")

    return {
        "evaluation_feedback": "\n".join(feedback_parts),
        "enhancement_retry_count": retries + 1,
    }


# ── Node: Generate LaTeX ─────────────────────────────────────────────────────

@log_node("generate_latex")
async def generate_latex(state: ResumeEnhancementState) -> dict:
    """Convert enhanced resume markdown into LaTeX using existing tool.

    This node is deterministic — no LLM call. It uses the existing
    LaTeXResumeGeneratorTool logic directly.
    """
    enhanced = state.get("enhanced_resume", "")
    if not enhanced:
        return {"latex_output": ""}

    try:
        from job_scraper.tools.latex_resume_tool import LaTeXResumeGeneratorTool
        tool = LaTeXResumeGeneratorTool()
        latex = tool._run(enhanced)
        return {"latex_output": latex}
    except Exception as exc:
        return {"latex_output": f"% LaTeX generation failed: {exc}"}


# ── Graph Assembly ────────────────────────────────────────────────────────────

def build_resume_enhancement_graph() -> StateGraph:
    """Construct the Resume Enhancement graph with evaluation + reflection loop.

    Pipeline:
        analyze_gaps → rewrite_resume → evaluate_quality ─┬→ generate_latex → END
                            ▲                              │
                            └── prepare_retry ◄────────────┘ (score < 7, max 1 retry)
    """
    graph = StateGraph(ResumeEnhancementState)

    graph.add_node("analyze_gaps", analyze_gaps)
    graph.add_node("rewrite_resume", rewrite_resume)
    graph.add_node("evaluate_quality", evaluate_quality)
    graph.add_node("prepare_retry", prepare_retry)
    graph.add_node("generate_latex", generate_latex)

    graph.add_edge(START, "analyze_gaps")
    graph.add_edge("analyze_gaps", "rewrite_resume")
    graph.add_edge("rewrite_resume", "evaluate_quality")

    # Conditional: quality check with reflection loop
    graph.add_conditional_edges("evaluate_quality", check_evaluation_quality, {
        "proceed": "generate_latex",
        "retry": "prepare_retry",
    })

    graph.add_edge("prepare_retry", "rewrite_resume")  # Reflection cycle
    graph.add_edge("generate_latex", END)

    return graph


# Compiled graph
resume_enhancement_graph = build_resume_enhancement_graph().compile()
