#!/usr/bin/env python
"""Entry-point for the JobFlow AI LangGraph pipelines.

Usage:
    uv run job_scraper           # Run full job discovery pipeline
    uv run python -m job_scraper # Alternative invocation
"""

import sys
import asyncio
import warnings

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")


def run():
    """Run the Job Discovery Graph with the default target role."""
    from job_scraper.graphs.job_discovery import job_discovery_graph

    inputs = {
        "target_role": "AI Agent Engineer",
        "resume_text": "",  # No resume = discovery-only mode
    }

    try:
        config = {"configurable": {"thread_id": "cli_run"}}
        result = asyncio.run(job_discovery_graph.ainvoke(inputs, config=config))
        jobs = result.get("scraped_jobs", [])
        print(f"\n[OK] Discovery complete. Found {len(jobs)} jobs.")
        for i, job in enumerate(jobs[:10], 1):
            print(f"  {i}. {job.get('title', 'Untitled')} @ {job.get('company', 'Unknown')}")
        if len(jobs) > 10:
            print(f"  ... and {len(jobs) - 10} more.")
    except Exception as e:
        raise Exception(f"An error occurred while running the discovery graph: {e}")


def train():
    """Training is not applicable for LangGraph pipelines."""
    print("Training is a CrewAI-specific feature. LangGraph pipelines don't require training.")
    print("Use LangSmith for observability and prompt iteration instead.")
    sys.exit(0)


def replay():
    """Replay is not applicable for LangGraph pipelines."""
    print("Replay is a CrewAI-specific feature. Use LangGraph checkpointing for state recovery.")
    sys.exit(0)


def test():
    """Run a quick smoke test of all graph pipelines."""
    from job_scraper.graphs.resume_analysis import resume_analysis_graph
    from job_scraper.graphs.ats_scoring import ats_scoring_graph

    sample_resume = "# John Doe\njohn@example.com\n## Skills\nPython, FastAPI, LangGraph, Docker\n## Experience\n### Senior Engineer\n_Acme Corp — 2021-Present_\n- Built multi-agent systems"

    async def _test():
        print("Testing Resume Analysis Graph...")
        result = await resume_analysis_graph.ainvoke({"resume_text": sample_resume})
        assert result.get("assessment"), "Assessment missing from result"
        print(f"  [OK] Score: {result['assessment'].get('overallScore', 'N/A')}/10")

        print("Testing ATS Scoring Graph...")
        result = await ats_scoring_graph.ainvoke({
            "resume_text": sample_resume,
            "job_title": "AI Engineer",
            "job_description": "Build LangGraph pipelines and multi-agent systems",
            "required_skills": "Python, LangGraph, Docker",
        })
        assert result.get("score"), "Score missing from result"
        print(f"  [OK] ATS Score: {result['score'].get('overallScore', 'N/A')}/100")

        print("\n[OK] All graph smoke tests passed!")

    asyncio.run(_test())


def run_with_trigger():
    """Run the discovery graph with a JSON trigger payload."""
    import json

    if len(sys.argv) < 2:
        raise Exception("No trigger payload provided. Please provide JSON payload as argument.")

    try:
        trigger_payload = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        raise Exception("Invalid JSON payload provided as argument")

    from job_scraper.graphs.job_discovery import job_discovery_graph

    inputs = {
        "target_role": trigger_payload.get("target_role", "AI Agent Engineer"),
        "resume_text": trigger_payload.get("resume_text", ""),
    }

    config = {"configurable": {"thread_id": "trigger_run"}}
    result = asyncio.run(job_discovery_graph.ainvoke(inputs, config=config))
    return result
