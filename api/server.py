"""
FastAPI Bridge Server — Wraps LangGraph pipelines as REST endpoints.

Key responsibilities:
  • Resume session management (/init-session)
  • Real-time job-match streaming via SSE (/stream-matches)
  • Resume analysis, ATS scoring, and enhancement (delegated to LangGraph)
  • PDF/DOCX parsing helpers

Start with:
    uvicorn api.server:app --reload --port 8000
"""

import os
import sys
import json
import uuid
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel
from typing import Optional
from sse_starlette.sse import EventSourceResponse

# Add src to the Python path so graph modules resolve correctly
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Initialize structured logging
from job_scraper.graphs.tracing import setup_logging
setup_logging()


# ── Pydantic Models ───────────────────────────────────────────────────────────

class InitSessionRequest(BaseModel):
    resume_text: str

class ResumeAnalysisRequest(BaseModel):
    resume_text: str

class JobSearchRequest(BaseModel):
    resume_text: str
    target_role: str = "AI Agent Engineer"

class ATSScoreRequest(BaseModel):
    resume_text: str
    job_title: str
    job_description: str
    required_skills: list[str] = []

class ResumeEnhanceRequest(BaseModel):
    resume_text: str
    job_title: str
    job_description: str
    missing_keywords: list[str] = []

class EvaluateEnhancementRequest(BaseModel):
    original_resume: str
    enhanced_resume: str
    job_title: str
    job_description: str
    missing_keywords: list[str] = []

class AutoApplyRequestEndpoint(BaseModel):
    job_id: str
    job_url: str
    candidate_name: str
    candidate_email: str
    candidate_phone: str
    candidate_linkedin: Optional[str] = None


# ── Resume Studio Models ──────────────────────────────────────────────────────

class ApplyRecommendationsRequest(BaseModel):
    resume_text: str
    job_description: str = ""
    selected_keywords: list[str]

class PreciseParseRequest(BaseModel):
    resume_text: str

class ATSGapRequest(BaseModel):
    resume_data: dict
    job_description: str

class GenerateResumeRequest(BaseModel):
    resume_data: dict
    template: str = "modern"
    format: str = "pdf"


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[INFO] FastAPI bridge server starting (LangGraph engine)...")

    # Bootstrap MongoDB indexes for production-grade queries
    from api.db import ensure_indexes
    await ensure_indexes()

    yield

    print("[INFO] FastAPI bridge server shutting down")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="JobFlow AI — API Bridge",
    description="Bridges Next.js frontend with LangGraph Python pipelines",
    version="3.0.0",
    lifespan=lifespan,
)

import re as _re

_extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ] + _extra_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "jobflow-api", "version": "3.0.0", "engine": "langgraph"}

@app.get("/health/detailed")
async def health_detailed():
    """Extended health check — verifies MongoDB and Redis connectivity."""
    checks: dict = {}

    # MongoDB
    from api.db import client as mongo_client
    if mongo_client is not None:
        try:
            await mongo_client.admin.command("ping")
            checks["mongodb"] = "ok"
        except Exception as exc:
            checks["mongodb"] = f"error: {exc}"
    else:
        checks["mongodb"] = "not_configured"

    # Redis
    from api.db import _get_redis
    redis = _get_redis()
    if redis is not None:
        try:
            await redis.ping()
            checks["redis"] = "ok"
        except Exception as exc:
            checks["redis"] = f"error: {exc}"
    else:
        checks["redis"] = "not_configured (using memory fallback)"

    overall = "healthy" if all(v in ("ok", "not_configured") for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks, "engine": "langgraph"}


# ── Resume Session Management ─────────────────────────────────────────────────

@app.post("/init-session")
async def init_session(req: InitSessionRequest):
    """
    Store the user's parsed resume text server-side and return a session_id.

    The frontend stores this UUID in sessionStorage and passes it as a query
    parameter to /stream-matches. This avoids sending the full resume text
    (often 5-15 KB) on every SSE request and is the standard enterprise pattern.

    TTL: 4 hours. Call again after expiry or when a new resume is uploaded.
    """
    if not req.resume_text or len(req.resume_text.strip()) < 50:
        return JSONResponse(
            {"error": "Resume text is too short to be valid."},
            status_code=400,
        )

    session_id = str(uuid.uuid4())
    from api.db import store_resume_session
    await store_resume_session(session_id, req.resume_text)

    print(f"[Session] Created session {session_id[:8]}... ({len(req.resume_text)} chars)")
    return {
        "session_id": session_id,
        "ttl_hours": 4,
        "chars": len(req.resume_text),
    }


@app.get("/session/{session_id}/status")
async def session_status(session_id: str):
    """Check whether a resume session is still alive."""
    from api.db import get_resume_session
    text = await get_resume_session(session_id)
    if text is None:
        return JSONResponse({"active": False}, status_code=404)
    return {"active": True, "chars": len(text)}


# ── Resume Analysis ───────────────────────────────────────────────────────────

@app.post("/analyze-resume")
async def analyze_resume(req: ResumeAnalysisRequest):
    """Run the Resume Analysis LangGraph pipeline."""
    try:
        from job_scraper.graphs.resume_analysis import resume_analysis_graph

        result = await resume_analysis_graph.ainvoke({
            "resume_text": req.resume_text,
        })

        # assessment is already a validated dict — no fallback needed
        assessment = result.get("assessment")
        if assessment:
            return assessment

        # Shouldn't happen with structured output, but be safe
        return _fallback_analysis(req.resume_text)

    except Exception as exc:
        print(f"[analyze-resume] Error: {exc}")
        import traceback; traceback.print_exc()
        return _fallback_analysis(req.resume_text)


# ── Job Search (legacy blocking endpoint) ─────────────────────────────────────

@app.post("/search-jobs")
async def search_jobs(req: JobSearchRequest):
    """Run the Job Discovery LangGraph pipeline (blocking)."""
    try:
        from job_scraper.graphs.job_discovery import job_discovery_graph

        import uuid
        config = {"configurable": {"thread_id": f"search_{uuid.uuid4().hex[:8]}"}}
        result = await job_discovery_graph.ainvoke({
            "target_role": req.target_role,
            "resume_text": req.resume_text,
        }, config=config)

        jobs = result.get("validated_jobs") or result.get("scraped_jobs", [])
        return {"jobs": jobs}

    except Exception as exc:
        print(f"[search-jobs] Error: {exc}")
        return {"jobs": [], "error": str(exc)}


# ── Real-Time Job Matching via SSE ────────────────────────────────────────────

@app.get("/stream-matches")
async def stream_matches(
    session_id: str = Query(..., description="Resume session ID from /init-session"),
    target_role: str = Query("", description="Target role (auto-derived if empty)"),
):
    """
    Server-Sent Events endpoint — streams job match results to the frontend
    in real-time, scored against the user's own uploaded resume.
    """
    from api.db import get_resume_session
    resume_text = await get_resume_session(session_id)

    if resume_text is None:
        async def _expired():
            yield {"event": "error", "data": json.dumps({
                "message": "Session expired or not found. Please re-upload your resume.",
                "code": "SESSION_EXPIRED",
            })}
        return EventSourceResponse(_expired())

    # Auto-derive target role from resume content if not provided
    if not target_role.strip():
        target_role = _derive_target_role(resume_text)

    print(f"[stream-matches] session={session_id[:8]}… role='{target_role}' resume={len(resume_text)}chars")

    from job_scraper.graphs.user_matching import stream_job_matches
    return EventSourceResponse(stream_job_matches(resume_text, target_role))


def _derive_target_role(resume_text: str) -> str:
    """Heuristic-based role derivation from resume content."""
    text = resume_text.lower()

    if any(kw in text for kw in ["crewai", "langgraph", "autogen", "multi-agent", "agentic"]):
        return "AI Agent Engineer"
    if any(kw in text for kw in ["pytorch", "tensorflow", "machine learning", "deep learning", "llm"]):
        return "Machine Learning Engineer"
    if any(kw in text for kw in ["fastapi", "django", "node.js", "express", "spring boot"]):
        return "Backend Software Engineer"
    if any(kw in text for kw in ["react", "next.js", "vue", "angular", "svelte"]):
        return "Frontend Engineer"
    if any(kw in text for kw in ["kubernetes", "terraform", "docker", "aws", "devops"]):
        return "DevOps Engineer"

    return "Software Engineer"


# ── Auto Apply ────────────────────────────────────────────────────────────────

@app.post("/auto-apply")
async def auto_apply(req: AutoApplyRequestEndpoint):
    """
    Spins up a headless Playwright instance and fills an ATS application form.
    Supports Lever and Greenhouse. Defaults to dry_run=True (fills but does not submit).
    """
    from api.auto_apply import AutoApplyRequest, run_auto_applier_sync

    rpa_payload = AutoApplyRequest(
        job_id=req.job_id,
        job_url=req.job_url,
        candidate_name=req.candidate_name,
        candidate_email=req.candidate_email,
        candidate_phone=req.candidate_phone,
        candidate_linkedin=req.candidate_linkedin or "",
    )

    result = await asyncio.to_thread(run_auto_applier_sync, rpa_payload)
    if not result["success"]:
        return {"success": False, "error": result["error"]}
    return result


# ── ATS Score ─────────────────────────────────────────────────────────────────

# ATS score cache: {hash: (result_dict, expires_at_timestamp)}
_ats_cache: dict[int, tuple[dict, float]] = {}
_ATS_CACHE_TTL = 3600  # 1 hour

@app.post("/ats-score")
async def ats_score(req: ATSScoreRequest):
    """Run the ATS Scoring LangGraph pipeline (with caching)."""
    import time

    # Check cache first
    cache_key = hash(req.resume_text[:500] + req.job_description[:500])
    cached = _ats_cache.get(cache_key)
    if cached:
        result, expires_at = cached
        if time.time() < expires_at:
            return result

    try:
        from job_scraper.graphs.ats_scoring import ats_scoring_graph

        result = await ats_scoring_graph.ainvoke({
            "resume_text": req.resume_text,
            "job_title": req.job_title,
            "job_description": req.job_description,
            "required_skills": ", ".join(req.required_skills),
        })

        score = result.get("score")
        if score:
            _ats_cache[cache_key] = (score, time.time() + _ATS_CACHE_TTL)
            return score

        return _fallback_ats(req.resume_text, req.job_description, req.required_skills)

    except Exception as exc:
        print(f"[ats-score] Error: {exc}")
        return _fallback_ats(req.resume_text, req.job_description, req.required_skills)


# ── Resume Enhancement ────────────────────────────────────────────────────────

@app.post("/enhance-resume")
async def enhance_resume(req: ResumeEnhanceRequest):
    """Run the Resume Enhancement LangGraph pipeline with quality evaluation."""
    try:
        from job_scraper.graphs.resume_enhancement import resume_enhancement_graph

        result = await resume_enhancement_graph.ainvoke({
            "resume_text": req.resume_text,
            "job_title": req.job_title,
            "job_description": req.job_description,
            "missing_keywords": ", ".join(req.missing_keywords),
        })

        enhanced_md = result.get("enhanced_resume", req.resume_text)
        latex_code = result.get("latex_output", "")
        evaluation = result.get("evaluation_report", {})

        return {
            "enhancedResume": enhanced_md,
            "latexTemplate": latex_code,
            "evaluation": evaluation,
            "changes": [
                "Resume rewritten by LangGraph pipeline to match target role",
                f"Incorporated missing keywords: {', '.join(req.missing_keywords[:5])}",
                "Strong action verbs and quantified achievements added",
                "Professional summary tailored for the target position",
                "Overleaf LaTeX template generated for professional formatting",
                f"Quality score: {evaluation.get('overallScore', 'N/A')}/10",
            ],
        }

    except Exception as exc:
        print(f"[enhance-resume] Error: {exc}")
        import traceback; traceback.print_exc()
        return _fallback_enhance(req.resume_text, req.missing_keywords)


@app.post("/evaluate-enhancement")
async def evaluate_enhancement(req: EvaluateEnhancementRequest):
    """Standalone evaluation — score any original+enhanced resume pair without re-running enhancement."""
    try:
        from job_scraper.graphs.resume_enhancement import evaluate_quality

        state = {
            "resume_text": req.original_resume,
            "enhanced_resume": req.enhanced_resume,
            "job_title": req.job_title,
            "job_description": req.job_description,
            "missing_keywords": ", ".join(req.missing_keywords),
        }
        result = await evaluate_quality(state)
        return result.get("evaluation_report", {})

    except Exception as exc:
        print(f"[evaluate-enhancement] Error: {exc}")
        return {"overallScore": 0, "error": str(exc)}


# ── Download Generated Resume ─────────────────────────────────────────────────

@app.get("/download-resume")
async def download_resume(format: str = Query(default="pdf", description="pdf or docx")):
    """Serve the most recently generated resume file."""
    import tempfile
    out_dir = Path(tempfile.gettempdir()) / "jobflow_resumes"
    filename = f"enhanced_resume.{format}"
    file_path = out_dir / filename

    if not file_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"No generated {format.upper()} found. Run enhancement first.")

    media_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    return FileResponse(
        path=str(file_path),
        media_type=media_types.get(format, "application/octet-stream"),
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── File Parsers ──────────────────────────────────────────────────────────────

@app.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    """Parse a PDF file using PyPDF2 and return extracted text."""
    try:
        import PyPDF2
        import io

        content = await file.read()
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages_text)

        return {
            "text": text,
            "pages": len(reader.pages),
            "chars": len(text),
        }
    except Exception as exc:
        return {"text": f"[PDF parsing error: {exc}]", "pages": 0, "chars": 0}


@app.post("/parse-docx")
async def parse_docx(file: UploadFile = File(...)):
    """Parse a DOCX file and return extracted text."""
    try:
        from docx import Document as DocxDocument
        import tempfile

        content = await file.read()
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        doc = DocxDocument(tmp_path)
        text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        os.unlink(tmp_path)
        return {"text": text}
    except Exception as exc:
        return {"text": f"[DOCX parsing failed: {exc}]"}


# ── Minimal Fallbacks (safety net only) ───────────────────────────────────────
# These exist as a last resort if the LangGraph pipeline fails entirely.
# With structured output guarantees, they should rarely be needed.

def _fallback_analysis(resume_text: str) -> dict:
    """Heuristic-based resume analysis without LangGraph."""
    import re
    skills_kw = [
        "Python", "TypeScript", "JavaScript", "React", "Node.js",
        "MongoDB", "SQL", "Docker", "LangGraph", "CrewAI", "FastAPI",
        "Git", "AWS", "GCP", "Prompt Engineering", "RAG", "LLM",
    ]
    found = [s for s in skills_kw if s.lower() in resume_text.lower()]

    name = "Candidate"
    match = re.match(r"^#\s+(.+)", resume_text, re.MULTILINE)
    if match:
        name = match.group(1).strip()

    email = ""
    match = re.search(r"[\w.-]+@[\w.-]+\.\w+", resume_text)
    if match:
        email = match.group(0)

    return {
        "name": name,
        "email": email,
        "skills": found,
        "strongSkills": found[:5],
        "experience": [],
        "education": [],
        "strengths": [f"Broad skill set with {len(found)} key technologies"],
        "weaknesses": ["Connect LangGraph pipeline for deeper analysis"],
        "overallScore": min(10, max(3, len(found) // 2 + 3)),
        "summary": f"Identified {len(found)} technical skills. Connect LangGraph pipeline for comprehensive analysis.",
    }


def _fallback_ats(resume_text: str, jd: str, required_skills: list) -> dict:
    resume_lower = resume_text.lower()
    all_kw = list(set([s.lower() for s in required_skills]))
    matched = [k for k in all_kw if k in resume_lower]
    missing = [k for k in all_kw if k not in resume_lower]
    pct = round(len(matched) / max(len(all_kw), 1) * 100)
    return {
        "overallScore": min(100, pct + 15),
        "keywordMatchPercent": pct,
        "matchedKeywords": matched,
        "missingKeywords": missing,
        "sectionScores": {"skills": min(100, pct + 10), "experience": 65, "education": 70},
        "recommendations": [f"Add missing keywords: {', '.join(missing[:5])}"] if missing else [],
    }


def _fallback_enhance(resume_text: str, missing_keywords: list) -> dict:
    enhanced = resume_text
    changes = []
    if missing_keywords:
        kw_list = "\n".join([f"- {kw}" for kw in missing_keywords[:5]])
        enhanced = enhanced + "\n\n## Additional Relevant Skills\n" + kw_list + "\n"
        changes.append(f"Added {len(missing_keywords[:5])} missing keywords to resume")
    changes.append("Connect LangGraph pipeline for a deeper AI rewrite")
    latex_code = ""
    try:
        from job_scraper.tools.latex_resume_tool import LaTeXResumeGeneratorTool
        latex_code = LaTeXResumeGeneratorTool()._run(enhanced)
    except Exception as exc:
        latex_code = f"% LaTeX generation failed: {exc}"
    return {"enhancedResume": enhanced, "latexTemplate": latex_code, "changes": changes}


# ── Resume Studio Endpoints ───────────────────────────────────────────────────

@app.post("/parse-resume-precise")
async def parse_resume_precise(req: PreciseParseRequest):
    """Precise resume parsing — extracts every detail for the form editor."""
    from job_scraper.graphs.llm_factory import get_gemini_flash
    from job_scraper.graphs.error_handling import call_llm_structured
    from job_scraper.models import PreciseResumeData

    llm = get_gemini_flash()
    prompt = f"""You are an expert resume parser. Extract EVERY detail from this resume into structured JSON.

CRITICAL RULES:
- Extract EVERY bullet point VERBATIM — do NOT summarize or shorten
- Extract exact dates (e.g. "Jan 2023 - Present", "2021 - 2023")
- Categorize skills by type (Languages, Frameworks, Databases, DevOps, Tools, AI/ML, etc.)
- If a field is not found, use empty string or empty list — NEVER hallucinate
- Preserve original wording for all descriptions and bullet points
- Extract ALL experience entries, not just recent ones
- Extract ALL projects, certifications, and languages mentioned

RESUME TEXT:
{req.resume_text[:8000]}"""

    try:
        result = await call_llm_structured(
            llm=llm,
            prompt=prompt,
            output_schema=PreciseResumeData,
            system_prompt="You are a precise resume parser. Output valid JSON matching the exact schema. Extract everything verbatim.",
            max_retries=2,
        )
        return result.model_dump()
    except Exception as exc:
        print(f"[parse-resume-precise] Error: {exc}")
        return {"error": str(exc)}

# ── Apply Recommendations ─────────────────────────────────────────────────────

@app.post("/apply-recommendations")
async def apply_recommendations(req: ApplyRecommendationsRequest):
    """Run the Apply Recommendations LangGraph pipeline."""
    try:
        from job_scraper.graphs.apply_recommendations import apply_recommendations_graph

        result = await apply_recommendations_graph.ainvoke({
            "resume_text": req.resume_text,
            "job_description": req.job_description,
            "selected_keywords": req.selected_keywords,
        })

        enhanced_md = result.get("enhanced_resume", req.resume_text)

        return {
            "enhancedResume": enhanced_md,
        }

    except Exception as exc:
        from fastapi import HTTPException
        print(f"[apply-recommendations] Error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/analyze-ats-gaps")
async def analyze_ats_gaps(req: ATSGapRequest):
    """ATS gap analysis — identifies missing keywords and suggests additions/rephrases."""
    try:
        from job_scraper.graphs.ats_gap_analysis import ats_gap_graph

        result = await ats_gap_graph.ainvoke({
            "resume_data": req.resume_data,
            "job_description": req.job_description,
        })
        return {
            "suggestions": result.get("suggestions", []),
            "jd_keywords": result.get("jd_keywords", []),
            "matched_keywords": result.get("matched_keywords", []),
            "match_percentage": result.get("match_percentage", 0),
        }
    except Exception as exc:
        print(f"[analyze-ats-gaps] Error: {exc}")
        import traceback; traceback.print_exc()
        return {"error": str(exc), "suggestions": [], "jd_keywords": [], "matched_keywords": [], "match_percentage": 0}


@app.post("/generate-resume")
async def generate_resume(req: GenerateResumeRequest):
    """Generate a formatted resume as PDF or DOCX from structured data + template."""
    try:
        from job_scraper.graphs.resume_templates import generate_pdf, generate_docx, render_resume_html

        if req.format == "pdf":
            pdf_bytes = generate_pdf(req.resume_data, req.template)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="resume_{req.template}.pdf"'},
            )
        elif req.format == "docx":
            docx_bytes = generate_docx(req.resume_data, req.template)
            return Response(
                content=docx_bytes,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="resume_{req.template}.docx"'},
            )
        else:
            html = render_resume_html(req.resume_data, req.template)
            return {"html": html}
    except Exception as exc:
        print(f"[generate-resume] Error: {exc}")
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(exc)})


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=True)
