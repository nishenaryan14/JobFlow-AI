"""Apply Recommendations Graph — Intelligently integrates selected recommendations into the resume.

Pipeline: apply_recommendations_node → END
Input:    {"resume_text": <str>, "job_description": <str>, "selected_recommendations": <list[str]>}
Output:   {"enhanced_resume": <str>}
"""

import logging
from typing import TypedDict, List

from langgraph.graph import StateGraph, START, END

from job_scraper.graphs.llm_factory import get_deepseek_reasoner
from job_scraper.graphs.error_handling import call_llm_text
from job_scraper.graphs.tracing import log_node

logger = logging.getLogger("jobflow.graphs")


# ── State ─────────────────────────────────────────────────────────────────────

class ApplyRecommendationsState(TypedDict, total=False):
    resume_text: str
    job_description: str
    selected_recommendations: List[str]
    enhanced_resume: str


# ── Node: Apply Recommendations ──────────────────────────────────────────────

@log_node("apply_recommendations")
async def apply_recommendations_node(state: ApplyRecommendationsState) -> dict:
    """Intelligently place selected recommendations into the resume."""
    llm = get_deepseek_reasoner()

    recs_formatted = "\n".join(f"- {rec}" for rec in state.get("selected_recommendations", []))

    prompt = f"""You are an expert resume writer. The candidate has selected specific improvement recommendations to apply to their resume.
Analyze the resume and determine the most logical and organic place to integrate each recommendation.

Original Resume:
{state["resume_text"]}

Target Job Description (for context):
{state.get("job_description", "")}

Selected Recommendations to Apply:
{recs_formatted}

RULES:
1. Do not just append a 'Recommendations' section at the bottom.
2. Integrate each recommendation naturally into the existing sections (e.g. modify an existing bullet point in the Experience section, add a new bullet, re-order sections as requested, or add keywords to the Skills section).
3. Do not fabricate experience — only reframe existing roles or add generic accomplishments that fit the context.
4. Output ONLY the updated resume in clean Markdown format. No JSON wrapping. No explanations. No thinking out loud.
5. Make sure the resume fits on a single page, keeping it concise and professional.
"""

    result = await call_llm_text(
        llm=llm,
        prompt=prompt,
        system_prompt="You are an expert resume writer. Output ONLY the enhanced resume in clean markdown format.",
    )

    # Clean up any markdown code fences the LLM might add
    import re
    result = re.sub(r"```(?:markdown|md)?\s*\n?", "", result).replace("```", "").strip()

    return {"enhanced_resume": result}


# ── Graph Assembly ────────────────────────────────────────────────────────────

def build_apply_recommendations_graph() -> StateGraph:
    """Construct the Apply Recommendations graph."""
    graph = StateGraph(ApplyRecommendationsState)

    graph.add_node("apply_recommendations", apply_recommendations_node)
    graph.add_edge(START, "apply_recommendations")
    graph.add_edge("apply_recommendations", END)

    return graph


# Compiled graph
apply_recommendations_graph = build_apply_recommendations_graph().compile()
