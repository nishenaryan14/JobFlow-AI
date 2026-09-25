# 🚀 JobFlow AI

<p align="center">
  <strong>An agentic AI career command center built with LangGraph</strong><br/>
  Resume intelligence · Job discovery · Matching · Evaluation · Resume enhancement · Browser automation
</p>

<p align="center">
  <a href="#-why-this-project">Why this project</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-agentic-workflows">Agentic workflows</a> •
  <a href="#-evaluation--reliability">Evaluation</a> •
  <a href="#-quick-start">Quick Start</a>
</p>

---

## 🧠 Why This Project

JobFlow AI is a **full-stack agentic AI system** for the end-to-end job-search workflow.

The project goes beyond a single LLM prompt: it uses **stateful LangGraph workflows, structured outputs, conditional routing, quality gates, reflection loops, persistence, browser automation, and CI/CD** to turn loosely structured career tasks into repeatable software workflows.

### The engineering problem

A job-search assistant needs to handle several different problems at once:

- Understand a candidate's resume
- Generate useful search intent
- Discover jobs from multiple sources
- Extract and normalize inconsistent job data
- Reject low-quality results
- Match opportunities against candidate skills
- Evaluate resume compatibility
- Rewrite resumes without fabricating experience
- Recover from poor AI outputs
- Persist state and application data
- Expose results through a usable web application

JobFlow AI treats these as **separate workflows with explicit state and validation**, rather than one large prompt.

---

## ✨ What It Demonstrates

| Capability | Implementation |
|---|---|
| **Agentic orchestration** | LangGraph StateGraphs with conditional routing and cyclic workflows |
| **Resume intelligence** | Structured candidate profiling and search-intent generation |
| **Job discovery** | Search/API sources + concurrent extraction + quality filtering |
| **Quality gates** | Reject invalid, duplicate or low-quality job records before matching |
| **Matching** | Resume-aware job matching and ranking |
| **LLM evaluation** | Structured scoring and LLM-as-a-judge resume evaluation |
| **Reflection** | Conditional rewrite retry when evaluation detects weak output |
| **Reliability** | Structured-output handling, retries, checkpoints and validation |
| **Human-facing application** | Next.js UI, FastAPI APIs and real-time SSE streaming |
| **Browser automation** | Playwright-based Lever/Greenhouse application workflows |
| **Production thinking** | Docker Compose, persistence, health checks and GitHub Actions CI |

---

## 🏗️ Architecture

~~~mermaid
flowchart LR
    U[User] --> W[Next.js Web App]
    W --> API[FastAPI API]

    API --> JD[Job Discovery Graph]
    API --> RA[Resume Analysis Graph]
    API --> ATS[ATS Analysis Graph]
    API --> RE[Resume Enhancement Graph]

    JD --> SRC[Search / Job APIs]
    SRC --> EXT[Extraction]
    EXT --> QG[Quality Gate]
    QG -->|Poor results| REF[Query Reflection]
    REF --> SRC
    QG -->|Valid results| MATCH[Match & Rank]

    RE --> GAP[Gap Analysis]
    GAP --> RW[Resume Rewrite]
    RW --> EVAL[Quality Evaluation]
    EVAL -->|Weak / fabrication detected| REF2[Reflection Retry]
    REF2 --> RW
    EVAL -->|Accept| LATEX[Deterministic LaTeX Generation]

    JD --> DB[(MongoDB)]
    RA --> DB
    ATS --> DB
    RE --> DB

    JD -. checkpoint .-> CP[(SQLite)]
    RA -. checkpoint .-> CP
    RE -. checkpoint .-> CP

    API --> REDIS[(Redis)]
    API --> SSE[SSE Stream]
    SSE --> W

    API --> PA[Playwright Auto-Apply]
~~~

### Design principle

The system is intentionally split into **small, inspectable workflows** instead of treating the LLM as an opaque autonomous agent.

**State → Node → Validation → Decision → Next node**

This makes the system easier to test, debug, retry and extend.

---

## 🤖 Agentic Workflows

### 1. Job Discovery

~~~text
Resume Intelligence
       ↓
Search Intent Generation
       ↓
Parallel Job Discovery
       ↓
Job Extraction / Normalization
       ↓
Quality Gate
       ↓
 ┌─────┴─────┐
 │           │
Poor data   Valid data
 ↓           ↓
Query       Match &
Reflection  Rank
 ↓           ↓
Search      Persistence
again
~~~

The discovery graph can **change its search strategy when the quality gate determines that the current result set is insufficient**.

### 2. Resume Enhancement + Reflection

~~~text
Analyze Gaps
     ↓
Rewrite Resume
     ↓
Evaluate Output
     ↓
 ┌───┴─────────────────┐
 │                     │
Weak / fabrication    Accept
 │                     │
Reflection retry       ↓
 │                 LaTeX generation
 └──────→ Rewrite
~~~

The evaluator checks structured criteria including:

- Keyword alignment
- Skills gaps
- Tone consistency
- ATS-oriented content density
- Overall quality
- Fabrication detection
- Improvement suggestions

---

## 🔎 Evaluation & Reliability

A major design goal is **not trusting the first LLM output**.

The system uses structured Pydantic models and explicit evaluation stages for important outputs.

### Resume evaluation

The evaluator produces structured signals such as:

- Overall score
- Keyword alignment
- Skills gaps closed
- Tone consistency
- ATS-density improvement
- Fabrication check
- Verdict
- Improvement suggestions

### Reliability mechanisms

- Structured LLM outputs
- Pydantic validation
- Conditional routing
- Retry/reflection loops
- LangGraph checkpointing
- Quality gates before persistence
- Deterministic LaTeX generation
- Health checks for infrastructure
- Automated CI validation

> **Important:** ATS scoring in this project is an AI-based compatibility analysis, not a claim that it reproduces the proprietary scoring of a specific commercial ATS.

---

## 📊 Engineering Signals

The repository is intentionally structured to demonstrate several production-oriented AI engineering patterns:

**LLM → Structured Output → Validation → Evaluation → Conditional Routing → Persistence**

rather than:

**Prompt → LLM → Text**

The codebase includes:

- Multiple independently testable LangGraph pipelines
- Typed application state
- Pydantic schemas
- FastAPI REST + SSE interfaces
- MongoDB persistence
- Redis session state
- SQLite graph checkpointing
- Dockerized local deployment
- GitHub Actions CI
- Pytest coverage
- LangSmith integration for optional tracing

---

## 🎯 Core Features

| Feature | Description |
|---|---|
| 🔬 **Resume Analysis** | Structured candidate and career assessment |
| 🎯 **Smart Job Discovery** | Resume-aware search with multiple discovery paths |
| 🛡️ **Quality Gate** | Filters invalid and low-quality opportunities |
| 📊 **Job Matching** | Resume-aware matching and ranking |
| 📈 **ATS Compatibility Analysis** | AI-based JD/resume compatibility analysis |
| ✨ **Resume Enhancement** | Gap analysis → rewrite → evaluation → reflection |
| 🤖 **Auto-Apply** | Playwright automation for supported application forms |
| 📡 **SSE Streaming** | Real-time job match streaming to the frontend |
| 📋 **Application Tracker** | Application status management |
| 📄 **PDF Reports** | Career assessment and resume-related reports |

---

## 🛠️ Tech Stack

### AI / Orchestration
- **LangGraph** — stateful workflow orchestration
- **LangChain** — LLM integration
- **DeepSeek Chat** — extraction/search/query workflows
- **Gemini 2.5 Flash** — scoring, assessment and enhancement
- **LangSmith** — optional tracing and observability

### Backend
- **FastAPI**
- **Python 3.10–3.12**
- **MongoDB / Motor**
- **Redis**
- **SQLite checkpointing**
- **Playwright**

### Frontend
- **Next.js 16**
- **React**
- **TypeScript**
- **Tailwind CSS**

### Delivery
- **Docker Compose**
- **GitHub Actions**
- **uv**
- **Pytest**

---

## 📁 Project Structure

~~~text
.
├── api/                         # FastAPI API + background services
├── src/job_scraper/
│   ├── graphs/                  # LangGraph workflows
│   │   ├── job_discovery.py
│   │   ├── resume_analysis.py
│   │   ├── ats_scoring.py
│   │   ├── resume_enhancement.py
│   │   └── user_matching.py
│   ├── tools/                   # Resume/report generation tools
│   ├── models.py                # Pydantic models
│   ├── tracing.py               # Logging/tracing
│   └── error_handling.py        # Structured error/retry handling
├── webapp/                      # Next.js application
├── tests/                       # Automated tests
├── docs/                        # Architecture and design material
├── docker-compose.yml
└── .github/workflows/ci.yml
~~~

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.10–3.12 |
| Node.js | ≥ 20 |
| uv | Latest |
| MongoDB | 7+ |
| Redis | 7+ |

### Clone

~~~bash
git clone https://github.com/nishenaryan14/JobFlow-AI.git
cd JobFlow-AI
~~~

### Configure

Create a .env file:

~~~env
DEEPSEEK_API_KEY=...
GOOGLE_API_KEY=...
SERPER_API_KEY=...
MONGODB_URI=mongodb://localhost:27017/jobflow
REDIS_URL=redis://localhost:6379/0

# Optional
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
~~~

### Run with Docker

~~~bash
docker compose up -d
~~~

The stack starts:

- FastAPI API
- Next.js frontend
- MongoDB
- Redis

### Local development

~~~bash
uv sync
uv run uvicorn api.server:app --reload --port 8000
~~~

In another terminal:

~~~bash
cd webapp
npm install
npm run dev
~~~

---

## 📡 API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /health | Health check |
| GET | /health/detailed | Infrastructure health |
| POST | /init-session | Initialize resume session |
| POST | /analyze-resume | Resume analysis workflow |
| POST | /search-jobs | Job discovery workflow |
| GET | /stream-matches | Stream scored matches |
| POST | /ats-score | Compatibility analysis |
| POST | /enhance-resume | Enhancement + evaluation |
| POST | /auto-apply | Browser automation |
| POST | /parse-pdf | PDF parsing |
| POST | /parse-docx | DOCX parsing |

---

## 🧪 Testing

~~~bash
uv run pytest -v
uv run test
~~~

CI validates both sides of the application:

- Python test suite
- Frontend type checking
- Frontend production build

---

## 🐳 Docker Services

| Service | Port |
|---|---:|
| FastAPI | 8000 |
| Next.js | 3000 |
| MongoDB | 27017 |
| Redis | 6379 |

---

## 🔐 Security & Scope

API credentials belong in local environment variables and should never be committed.

The project is intended as a **portfolio / personal engineering project**. External services, job boards and application flows may change independently of this repository.

---

## 🧭 Roadmap

Potential future improvements include:

- Formal benchmark datasets for job matching and resume evaluation
- Cost and latency instrumentation per workflow
- Expanded evaluation harness for agent decisions
- More application-provider adapters
- Stronger end-to-end integration tests
- Improved observability dashboards

---

## 📄 License

Copyright © 2026 Aryan Nishen. This project is for personal/portfolio use. All rights reserved.

---

<p align="center">
  Built with ❤️ using <strong>LangGraph</strong> · <strong>FastAPI</strong> · <strong>Next.js</strong> · <strong>MongoDB</strong> · <strong>Redis</strong>
</p>
