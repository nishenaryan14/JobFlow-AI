# JobFlow AI — Personal User Guide

> **Author**: Aryan Nishen  
> **Last Updated**: May 2026  
> **Purpose**: Personal reference for operating, extending, and debugging the JobFlow AI platform.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Daily Workflow](#2-daily-workflow)
3. [LangGraph Pipelines — Deep Dive](#3-langgraph-pipelines--deep-dive)
4. [API Endpoints — Full Reference](#4-api-endpoints--full-reference)
5. [Frontend Pages & Components](#5-frontend-pages--components)
6. [Database Schema](#6-database-schema)
7. [Configuration & Environment](#7-configuration--environment)
8. [LLM Models & Costs](#8-llm-models--costs)
9. [Scraping Strategy](#9-scraping-strategy)
10. [Auto-Apply RPA Module](#10-auto-apply-rpa-module)
11. [Translation Verification Pipeline](#11-translation-verification-pipeline)
12. [Testing](#12-testing)
13. [Debugging Playbook](#13-debugging-playbook)
14. [Extending the System](#14-extending-the-system)
15. [Deployment](#15-deployment)

---

## 1. System Overview

JobFlow AI is a **personal AI-powered job application platform** that:

1. **Analyzes your resume** — parses, evaluates skills, assigns a career score (1-10)
2. **Discovers matching jobs** — searches 50+ ATS platforms using resume-aware queries
3. **Scores each job against your resume** — fit scores, skill gaps, application tips
4. **Enhances your resume** — rewrites it per-JD with gap analysis + LaTeX/PDF/DOCX export
5. **Auto-applies** — fills Lever/Greenhouse forms via headless Playwright

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| LangGraph over CrewAI | Better state management, conditional edges, reflection loops, checkpointing |
| DeepSeek Chat for extraction | Fast, cheap ($0.14/M tokens), reliable structured output |
| Gemini Flash for reasoning | Strong assessment quality, free tier available |
| SQLite checkpointing | Fault recovery without external infra dependency |
| Redis sessions (optional) | 4-hour TTL resume sessions; falls back to in-memory dict |
| SSE over WebSockets | Simpler protocol, auto-reconnect, no bidirectional comms needed |

---

## 2. Daily Workflow

### Starting the platform locally

```powershell
# Option 1: PowerShell script (starts both servers)
cd job_scraper
.\start.ps1

# Option 2: Manual (two terminals)
# Terminal 1:
cd job_scraper
uv run uvicorn api.server:app --reload --port 8000

# Terminal 2:
cd job_scraper/webapp
npm run dev
```

### Using the web app

1. **Upload resume** — Drop PDF/DOCX on the homepage dropzone
2. **View analysis** — `/analyze` page shows parsed data, skills, career score
3. **Find matching jobs** — `/jobs` page runs full discovery + scoring pipeline via SSE
4. **Check ATS score** — Click any job card to get an ATS compatibility score
5. **Enhance resume** — Click "Enhance" on a job card to get a rewritten resume + LaTeX
6. **Track applications** — `/tracker` Kanban board for managing application status

### Running the CLI

```bash
uv run job_scraper          # Full job discovery pipeline (console output)
uv run test                 # Smoke test all pipelines
uv run generate_report      # Convert output/job_report.md → output/job_report.pdf
```

---

## 3. LangGraph Pipelines — Deep Dive

### Pipeline 1: Job Discovery (`graphs/job_discovery.py`)

The most complex pipeline with **7 nodes** and a **reflection loop**.

```
START → analyze_resume → search_jobs → extract_details → quality_gate
                                                             │
                              ┌──── query_refiner ◄──────────┤ (0 valid jobs)
                              │                              │
                              └──→ search_jobs               ├──→ match_and_rank → persist → END
                                   (retry cycle)             │     (has resume)
                                                             └──→ persist → END
                                                                   (no resume / daemon mode)
```

**Node breakdown:**

| Node | LLM | Purpose |
|------|-----|---------|
| `analyze_resume` | DeepSeek | Generates structured candidate profile + tailored search queries from resume |
| `search_jobs` | None | Executes queries via Serper API, collects unique non-aggregator URLs |
| `extract_details` | DeepSeek | Per-URL LLM extraction in batches of 5 (concurrent). Scrapes HTML + JSON-LD + OG tags |
| `quality_gate` | DeepSeek | Validates/rejects jobs in batches of 10. Fixes company names, removes aggregator noise |
| `query_refiner` | DeepSeek | Reflection node — generates new broader queries when 0 valid jobs found (max 1 retry) |
| `match_and_rank` | Gemini Flash | Scores each job against resume, produces ranked markdown report |
| `persist` | None | Marks validated jobs ready for MongoDB persistence |

**State schema**: `JobDiscoveryState` in `graphs/state.py`  
**Checkpointing**: SQLite via `.langgraph.db` (enables thread-based state recovery)

**Important**: When `resume_text` is empty (daemon mode), the pipeline skips `match_and_rank` and goes straight to `persist`. This is controlled by `check_quality_results()` conditional edge.

### Pipeline 2: Resume Analysis (`graphs/resume_analysis.py`)

Simple 2-node linear pipeline.

```
START → parse_resume → assess_skills → END
```

| Node | LLM | Output |
|------|-----|--------|
| `parse_resume` | DeepSeek | `ResumeParseOutput` — name, email, skills, experience, education |
| `assess_skills` | DeepSeek | `ResumeAssessmentOutput` — overallScore (1-10), strengths, weaknesses, summary |

### Pipeline 3: ATS Scoring (`graphs/ats_scoring.py`)

```
START → analyze_jd → score_match → END
```

| Node | LLM | Output |
|------|-----|--------|
| `analyze_jd` | DeepSeek | Free-text JD analysis (skills, keywords, qualifications) |
| `score_match` | DeepSeek | `ATSScoreOutput` — overallScore (0-100), keyword match %, recommendations |

### Pipeline 4: Resume Enhancement (`graphs/resume_enhancement.py`)

```
START → analyze_gaps → rewrite_resume → generate_latex → END
```

| Node | LLM | Output |
|------|-----|--------|
| `analyze_gaps` | Gemini Flash | Free-text gap analysis (missing keywords, weak sections, reframing opportunities) |
| `rewrite_resume` | Gemini Flash | Complete enhanced resume in Markdown format |
| `generate_latex` | None | Deterministic — uses `LaTeXResumeGeneratorTool` to convert MD → LaTeX (moderncv) |

### Pipeline 5: User Matching / SSE Streaming (`graphs/user_matching.py`)

Not a compiled LangGraph — it's an async generator function that:
1. Invokes the Job Discovery graph inline
2. Scores each discovered job via DeepSeek (direct OpenAI SDK, not LangChain)
3. Yields SSE events: `status`, `job_match`, `error`, `done`
4. Persists matches to MongoDB

**Entry point**: `stream_job_matches()` — called by `server.py`'s `/stream-matches` endpoint.

---

## 4. API Endpoints — Full Reference

### Session Management

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `POST /init-session` | Body: `{resume_text}` | None | Returns `session_id` (UUID). TTL: 4 hours. |
| `GET /session/{id}/status` | — | None | Returns `{active: bool, chars: int}` |

### Core Pipelines

| Endpoint | Method | Body | Returns |
|----------|--------|------|---------|
| `POST /analyze-resume` | POST | `{resume_text}` | `ResumeAssessmentOutput` dict |
| `POST /search-jobs` | POST | `{resume_text, target_role}` | `{jobs: [...]}` (blocking) |
| `GET /stream-matches` | GET | Query: `session_id`, `target_role` | SSE stream |
| `POST /ats-score` | POST | `{resume_text, job_title, job_description, required_skills}` | `ATSScoreOutput` dict |
| `POST /enhance-resume` | POST | `{resume_text, job_title, job_description, missing_keywords}` | `{enhancedResume, latexTemplate, changes}` |
| `POST /auto-apply` | POST | `{job_id, job_url, candidate_name, ...}` | `{success, ats, message}` |

### File Utilities

| Endpoint | Method | Notes |
|----------|--------|-------|
| `POST /parse-pdf` | Multipart file upload | Returns `{text, pages, chars}` |
| `POST /parse-docx` | Multipart file upload | Returns `{text}` |
| `GET /download-resume?format=pdf` | — | Serves last generated resume |

### SSE Event Types (`/stream-matches`)

| Event | Data |
|-------|------|
| `status` | `{phase: "discovery"|"scoring", message}` |
| `job_match` | Full job payload with `fitScore`, `matchingSkills`, `skillGaps` |
| `error` | `{message, code: "SESSION_EXPIRED"|"DISCOVERY_ERROR"|"NO_JOBS"}` |
| `done` | `{total: int, scanned: int}` |

---

## 5. Frontend Pages & Components

### Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Hero + resume dropzone + feature cards |
| `/analyze` | `app/analyze/page.tsx` | Resume analysis dashboard — parsed data, skills radar, career score, ATS scoring, resume enhancement with side-by-side comparison |
| `/jobs` | `app/jobs/page.tsx` | Live job discovery with SSE streaming, job cards with fit scores |
| `/jobs/[id]` | `app/jobs/[id]/page.tsx` | Individual job detail page |
| `/tracker` | `app/tracker/page.tsx` | Application tracking Kanban board |

### Key Components

| Component | Purpose |
|-----------|---------|
| `ResumeDropzone` | Drag-and-drop PDF/DOCX upload with parse + session init |
| `JobCard` | Job listing card with fit score, skills, apply button |
| `ATSScoreGauge` | Circular gauge visualization for ATS compatibility |
| `ResumeComparison` | Side-by-side original vs. enhanced resume view |
| `AgentLogFeed` | Real-time agent activity log during pipeline execution |
| `AnalysisAnimation` | Loading animation during resume analysis |
| `KanbanBoard` | Drag-and-drop application status tracker |
| `Navbar` | Top navigation bar |

---

## 6. Database Schema

### MongoDB Collections

**`raw_jobs`** — Raw scraped job data (from background daemon)
- Index: `url` (unique), `posted_date`

**`jobs`** — Scored/matched jobs (from SSE pipeline)
- Index: `fitScore` (descending), `status`
- Key fields: `title`, `company`, `fitScore`, `matchingSkills`, `skillGaps`, `applicationTip`

**`resumes`** — Stored resume documents
- Index: `userId`, `sessionId`

**`applications`** — Application tracking entries
- Index: `jobId`, `userId`

### Redis Keys

- `resume:{session_id}` — Resume text with 4-hour TTL

### SQLite

- `.langgraph.db` — LangGraph checkpoint storage for the Job Discovery graph (enables `thread_id`-based state recovery)

---

## 7. Configuration & Environment

### Required API Keys

| Key | Get it from | Used by |
|-----|-------------|---------|
| `DEEPSEEK_API_KEY` | [platform.deepseek.com](https://platform.deepseek.com) | All extraction/parsing nodes |
| `GOOGLE_API_KEY` | [aistudio.google.com](https://aistudio.google.com) | Gemini Flash (scoring, enhancement) |
| `SERPER_API_KEY` | [serper.dev](https://serper.dev) | Google search API for job discovery |
| `MONGODB_URI` | Local or Atlas | Data persistence |

### Optional Keys

| Key | Purpose |
|-----|---------|
| `REDIS_URL` | Session store (defaults to `redis://localhost:6379/0`, falls back to in-memory) |
| `LANGCHAIN_TRACING_V2=true` | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | LangSmith API key |

### Config Validation

`api/config.py` validates all required env vars at import time. If any are missing, it prints warnings but doesn't crash — the server can still serve health-check endpoints while you fix the `.env`.

---

## 8. LLM Models & Costs

| Model | Provider | Temp | Use Case | Cost |
|-------|----------|------|----------|------|
| `deepseek-chat` | DeepSeek | 0 | Search queries, extraction, parsing, quality gate, matching | ~$0.14/M input, $0.28/M output |
| `gemini-2.5-flash` | Google | 0 | Scoring, assessment, gap analysis, resume enhancement | Free tier / $0.075/M input |

**Centralized in**: `graphs/llm_factory.py` — change a model with a single-line edit.

**Cost per full job discovery run**: ~$0.05-0.15 depending on number of URLs scraped.

---

## 9. Scraping Strategy

The scraping system (`graphs/tools.py`) uses a **multi-strategy approach**:

### Strategy 1: Direct HTML Scraping
- Basic `requests.get()` with realistic browser headers
- HTMLParser strips script/style tags, extracts visible text
- Content capped at 15K chars

### Strategy 2: JSON-LD Structured Data
- Extracts `<script type="application/ld+json">` blocks from raw HTML
- Parses `JobPosting` schema (title, company, salary, description, skills)
- **Works on JS-heavy ATS pages** because JSON-LD is in the initial HTML

### Strategy 3: OpenGraph / Meta Tags
- Extracts `og:title`, `og:description`, `og:site_name`, `meta description`
- Useful as company-name fallback

### Strategy 4: Jina AI Reader
- Fallback for JavaScript-rendered pages (AshbyHQ, Wellfound, etc.)
- Free tier, no API key needed
- Renders JS and returns clean markdown

### Quality Controls

**Aggregator Domain Blocklist**: 15+ domains (Indeed, Glassdoor, LinkedIn, etc.) are blocked at search-result collection time.

**Job Board Name Sanitization**: 30+ known job board names are stripped from company fields. If a company name is "Lever" or "Greenhouse", it's replaced with "Not Listed" and the system tries to extract the real employer from URL path patterns.

**Quality Gate Agent**: LLM-based validation that rejects non-job-postings, wrong-domain roles, and fixes company names. Processes in batches of 10.

---

## 10. Auto-Apply RPA Module

**File**: `api/auto_apply.py`

Uses **Playwright** (headless Chromium) to fill job application forms.

### Supported ATS Platforms

| Platform | Detection | Fields Filled |
|----------|-----------|---------------|
| **Lever** | URL contains `lever.co` or form `#application-form` exists | Name, email, phone, LinkedIn, resume file |
| **Greenhouse** | URL contains `greenhouse.io` or form `#application_form` exists | First name, last name, email, phone, resume file |

### Safety

- **Dry-run mode by default** — forms are filled but NOT submitted (submit button clicks are commented out)
- To enable real submission, uncomment the `page.click()` lines in `fill_lever_form()` and `fill_greenhouse_form()`

---

## 11. Translation Verification Pipeline

A **separate LangGraph pipeline** in `tr_verification/` for enterprise Android localization QA.

### Pipeline Nodes

| Node | Purpose |
|------|---------|
| `xml_ingestion` | Fetches `strings.xml` from GitHub Enterprise |
| `structural_validator` | Validates XML structure, placeholder consistency |
| `deterministic_qa` | Rule-based linguistic checks |
| `reference_generator` | DeepSeek-R1 reference translations |
| `neural_scorer` | COMET neural quality scoring |
| `semantic_reviewer` | LLM semantic accuracy review |
| `locale_compliance` | Locale-specific format validation |
| `apply_fixes` | Auto-correction of detected issues |
| `refinement` | Self-correction loop |
| `report_aggregator` | Generates per-locale quality reports |

### Running

```bash
cd tr_verification
uv sync
uv run verify
```

---

## 12. Testing

### Test Suite Location

`job_scraper/tests/`

| File | Tests |
|------|-------|
| `test_server.py` | FastAPI endpoint tests (health, analyze, ATS score, enhance) |
| `test_resume_session.py` | Redis/memory session store tests |
| `conftest.py` | Shared fixtures |

### Running Tests

```bash
cd job_scraper
uv run pytest tests/ -v --tb=short
```

### CI Pipeline

`.github/workflows/ci.yml` runs on push to `main`/`develop`:
1. **Python Tests** — `uv sync` + `pytest` with Redis service container
2. **Frontend Build** — `npm ci` + TypeScript check + `npm run build`

---

## 13. Debugging Playbook

### Problem: 0 jobs discovered

1. Check `SERPER_API_KEY` is valid and has quota
2. Check LangSmith traces (if enabled) for search query quality
3. Look at `job_discovery_run.log.txt` for `[search_jobs]` entries
4. The reflection loop (`query_refiner`) should auto-retry once with broader queries

### Problem: Jobs found but all rejected by quality gate

1. Check LangSmith for `[quality_gate]` node output
2. The gate may be too aggressive — look at rejection reasons in debug logs
3. If the candidate profile is wrong, check `[analyze_resume]` output

### Problem: LLM extraction returning empty jobs

1. Check the scraping layer — is `scrape_url()` returning content?
2. Look for `[extract_details]` logs — content might be too short
3. JSON-LD extraction (`_extract_json_ld`) may help on JS-heavy pages
4. Try the URL manually in a browser to see if it's valid

### Problem: SSE stream stalls / no events

1. Check CORS settings in `server.py` — frontend origin must be in `allow_origins`
2. Verify session is active: `GET /session/{id}/status`
3. Check backend logs for `[stream]` prefixed messages

### Problem: MongoDB connection errors

1. Verify `MONGODB_URI` in `.env`
2. Check if MongoDB is running: `docker compose ps`
3. The system gracefully degrades — SSE streaming works without MongoDB

### Useful Log Prefixes

| Prefix | Source |
|--------|--------|
| `[analyze_resume]` | Resume Intelligence Agent |
| `[search_jobs]` | Serper API search execution |
| `[extract_details]` | Per-URL scraping + LLM extraction |
| `[quality_gate]` | Job validation agent |
| `[query_refiner]` | Reflection loop |
| `[stream]` | SSE streaming pipeline |
| `[Scout]` | Background discovery daemon |
| `[AutoApplier]` | RPA auto-apply module |
| `[Session]` | Resume session management |

---

## 14. Extending the System

### Adding a new LangGraph pipeline

1. Define state in `graphs/state.py` as a `TypedDict`
2. Create `graphs/your_pipeline.py` with `@log_node` decorated async functions
3. Build and compile the graph at module level
4. Add an endpoint in `api/server.py`
5. Add a frontend page in `webapp/src/app/your-page/page.tsx`

### Adding a new LLM provider

1. Add the LangChain package to `pyproject.toml`
2. Add a factory function in `graphs/llm_factory.py`
3. Swap the `llm = get_xxx()` call in the relevant node

### Adding a new ATS platform to auto-apply

1. Add a `fill_xxx_form()` function in `api/auto_apply.py`
2. Add detection logic in `run_auto_applier_sync()` (URL pattern or form selector)
3. Map form fields to the `AutoApplyRequest` schema

### Adding new search sources

1. Add ATS site filters to `ATS_SITE_FILTERS` in `job_discovery.py`
2. Add any new aggregator domains to `AGGREGATOR_DOMAINS`
3. Add job board names to `JOB_BOARD_NAMES` for sanitization

---

## 15. Deployment

### Docker Compose (Production)

```bash
docker compose up -d --build
```

Services exposed:
- API: `localhost:8000`
- Webapp: `localhost:3000`
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`

### Production Notes

- API runs with **4 uvicorn workers** (configured in `Dockerfile` CMD)
- Playwright Chromium is pre-installed in the Docker image
- MongoDB volumes are persisted (`mongo_data`, `redis_data`)
- All services have health checks and `restart: unless-stopped`

### Scaling Considerations

- **Rate limiting**: Serper API has per-plan limits. Each discovery run fires 15-20 queries.
- **LLM costs**: A full discovery run costs ~$0.05-0.15. The background daemon runs every 4 hours.
- **MongoDB**: Indexes are auto-created on startup via `ensure_indexes()`.

---

> **Tip**: Enable LangSmith tracing (`LANGCHAIN_TRACING_V2=true`) during development for full visibility into every LLM call, token usage, and pipeline execution timing.
