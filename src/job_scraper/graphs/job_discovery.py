"""Job Discovery Graph — Scouts, extracts, and optionally ranks job listings.

Replaces BOTH:
  - crews/job_discovery.py (JobDiscoveryCrew — 3 tasks)
  - crews/job_scout_crew.py (JobScoutCrew — 2 tasks, daemon variant)

Key architectural improvement: ONE graph with a conditional edge.
When state.resume_text is empty (daemon mode), scoring is skipped.
When resume is provided (user mode), scoring runs. No code duplication.

Pipeline:
  search_jobs → extract_details → [should_score?] → match_and_rank → persist
                                        ↓ (no resume)
                                      persist
"""

import json
import re
import logging
import asyncio

from langgraph.graph import StateGraph, START, END

from job_scraper.graphs.state import JobDiscoveryState
from job_scraper.graphs.llm_factory import get_deepseek_chat, get_gemini_flash
from job_scraper.graphs.error_handling import call_llm_structured, call_llm_text
from job_scraper.graphs.tools import search_serper, scrape_url
from job_scraper.graphs.tracing import log_node
from job_scraper.models import ScrapedJobsOutput

logger = logging.getLogger("jobflow.graphs")


# ── Aggregator Domain Blocklist ───────────────────────────────────────────────
# These are job board aggregators, NOT direct employer ATS pages.
# URLs from these domains list jobs from OTHER companies — scraping them
# yields the job board name as the "company" instead of the actual employer.

AGGREGATOR_DOMAINS = {
    "indeed.com", "www.indeed.com", "in.indeed.com",
    "glassdoor.com", "www.glassdoor.com",
    "ziprecruiter.com", "www.ziprecruiter.com",
    "linkedin.com", "www.linkedin.com",
    "upwork.com", "www.upwork.com",
    "monster.com", "www.monster.com",
    "careerbuilder.com", "www.careerbuilder.com",
    "dice.com", "www.dice.com",
    "naukri.com", "www.naukri.com",
    "talent.com", "www.talent.com",
    "jooble.org", "www.jooble.org",
    "jobgether.com", "www.jobgether.com",
    "salary.com", "www.salary.com",
    "snagajob.com", "www.snagajob.com",
    "learn4good.com", "www.learn4good.com",
    "lensa.com", "www.lensa.com",
    # NOTE: builtin.com, wellfound.com, otta.com, himalayas.app, remotive.com,
    # weworkremotely.com are NOT aggregators — they have direct job pages.
}

# Known job board names that should NEVER be the company name
JOB_BOARD_NAMES = {
    "indeed", "glassdoor", "ziprecruiter", "linkedin", "upwork",
    "monster", "careerbuilder", "dice", "naukri", "talent.com",
    "jooble", "jobgether", "salary.com", "snagajob", "learn4good",
    "lensa", "lever", "greenhouse", "ashby", "workable",
    "smartrecruiters", "breezy", "recruitee", "jazzhr",
    "wellfound", "remoteok", "remotive", "weworkremotely",
    "turing", "flexjobs", "remoterocketship", "nodesk",
    "otta", "builtin", "simplify", "levels.fyi", "pallet",
    "getro", "himalayas", "contra", "arc.dev",
}


def _is_aggregator_url(url: str) -> bool:
    """Check if a URL belongs to a job board aggregator."""
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.lower()
        # Strip 'www.' for matching
        clean = domain.lstrip("www.")
        return domain in AGGREGATOR_DOMAINS or clean in AGGREGATOR_DOMAINS
    except Exception:
        return False


def _sanitize_company_name(company: str, url: str = "") -> str:
    """Clean up company names that are actually job board names."""
    if not company or company == "Not Listed":
        return company

    # Check if the company name is just a job board name
    if company.lower().strip() in JOB_BOARD_NAMES:
        return "Not Listed"

    # Strip common job board suffixes
    for suffix in [" - Indeed", " | Indeed", " - Glassdoor", " | Glassdoor",
                   " - ZipRecruiter", " | ZipRecruiter", " - LinkedIn",
                   " | LinkedIn", " - Upwork", " | Upwork",
                   " | Lever", " | Greenhouse", " | Ashby", " | Workable",
                   " - Lever", " - Greenhouse", " - Ashby", " - Workable",
                   " Jobs", " Careers", " Hiring"]:
        if company.endswith(suffix):
            company = company[: -len(suffix)].strip()

    # Final check after stripping
    if company.lower().strip() in JOB_BOARD_NAMES or len(company) < 2:
        return "Not Listed"

    return company


# ── Fallback Search Queries (daemon mode only) ───────────────────────────────
# Used when no resume is provided. When a resume IS available, the
# analyze_resume agent generates tailored queries instead.

FALLBACK_QUERIES = [
    '"{role}" LangGraph remote lever.co',
    '"{role}" AI agent remote greenhouse.io',
    '"{role}" agentic AI remote smartrecruiters.com',
    '"{role}" multi-agent LLM remote wellfound.com',
    '"{role}" AI remote jobs.ashbyhq.com',
    '"agentic AI engineer" LangGraph remote hiring 2025',
    '"{role}" AI agent remote weworkremotely.com',
    '"{role}" LLM agent remote builtin.com',
    '"AI agent engineer" agentic remote hiring 2025',
    '"LangGraph" engineer remote hiring 2025',
    '"{role}" remote apply AI agent 2025',
    '"{role}" Python LangChain remote hiring',
    '"{role}" remote hiring apply',
    '"AI engineer" Python remote 2025',
    '"{role}" hiring remote 2025',
]

# ATS platforms to mention in generated queries (one per query, no OR)
ATS_JOB_BOARDS = [
    "lever.co",
    "greenhouse.io",
    "jobs.ashbyhq.com",
    "workable.com",
    "smartrecruiters.com",
    "breezy.hr",
    "wellfound.com",
    "himalayas.app",
    "weworkremotely.com",
    "builtin.com",
    "workatastartup.com",
]

RESUME_INTELLIGENCE_PROMPT = """You are an expert technical recruiter. Analyze this resume and produce a structured profile for targeted job searching.

RESUME:
{resume_text}

TARGET ROLE HINT: {target_role}

Produce a JSON response with this EXACT schema:
{{
  "primary_role": "<the best-fit job title for this candidate, e.g. 'Senior AI Engineer'>",
  "alternate_roles": ["<2-3 other job titles this person could target>"],
  "core_skills": ["<top 5-8 technical skills from actual experience, not aspirational>"],
  "seniority": "<junior|mid|senior|staff|lead — based on years of experience and role titles>",
  "years_experience": <integer estimate>,
  "domains": ["<industry domains they have experience in, e.g. 'fintech', 'healthcare', 'SaaS'>"],
  "preferred_stack": ["<primary language/framework stack, e.g. 'Python', 'FastAPI', 'LangGraph'>"],
  "search_queries": [
    "<15-20 Google search queries tailored to this candidate's actual skills>"
  ]
}}

RULES FOR GENERATING search_queries:
- Each query should target ONE job board domain (e.g. lever.co) — do NOT use OR operators between domains
- Do NOT use 'site:' operator — it is blocked. Instead just include the domain name in the query text.
- Do NOT use 'OR' between domain names — Serper blocks this. Use separate queries instead.
- Include the candidate's ACTUAL top skills in queries (e.g. "Python" "FastAPI" "LangGraph")
- Match queries to seniority level (don't search "Staff Engineer" for a junior)
- Generate 3 tiers of queries:
  TIER 1 (8 queries): Exact role + top 2 skills + one job board domain
  TIER 2 (8 queries): Role variants + broader terms + different boards
  TIER 3 (5 queries): Wide net — just role + "hiring" + year, no specific board
- Mix: some queries for primary role, some for alternate roles
- NEVER include aggregator sites (indeed.com, glassdoor.com, ziprecruiter.com, linkedin.com)
- Always include "remote" in most queries
- Example GOOD query: '"AI Engineer" "Python" "LangGraph" remote lever.co'
- Example BAD query: '"AI Engineer" remote lever.co OR greenhouse.io' (OR blocked by API)
- Example BAD query: '"engineer" indeed.com' (too broad + aggregator)
"""


# ── Node: Analyze Resume (NEW — Resume Intelligence Agent) ───────────────────

@log_node("analyze_resume")
async def analyze_resume(state: JobDiscoveryState) -> dict:
    """Resume Intelligence Agent — reads the resume and generates a structured
    candidate profile with tailored search queries.

    When resume is empty (daemon mode), returns a minimal profile with
    fallback queries. When resume is provided, the LLM generates queries
    targeting the candidate's actual skills, seniority, and domains.
    """
    resume_text = state.get("resume_text", "")
    target_role = state.get("target_role", "AI Agent Engineer")

    # Daemon mode: no resume → use fallback queries
    if not resume_text or not resume_text.strip():
        logger.info("[analyze_resume] No resume provided (daemon mode) — using fallback queries")
        return {
            "resume_profile": {
                "primary_role": target_role,
                "alternate_roles": [],
                "core_skills": [],
                "seniority": "mid",
                "years_experience": 0,
                "domains": [],
                "preferred_stack": [],
                "search_queries": [q.replace("{role}", target_role) for q in FALLBACK_QUERIES],
            }
        }

    # User mode: LLM generates tailored queries from resume
    llm = get_deepseek_chat()
    prompt = RESUME_INTELLIGENCE_PROMPT.format(
        resume_text=resume_text[:6000],  # Cap resume length for prompt
        target_role=target_role,
    )

    try:
        from pydantic import BaseModel, Field
        from typing import List

        class ResumeProfile(BaseModel):
            primary_role: str = ""
            alternate_roles: List[str] = Field(default_factory=list)
            core_skills: List[str] = Field(default_factory=list)
            seniority: str = "mid"
            years_experience: int = 0
            domains: List[str] = Field(default_factory=list)
            preferred_stack: List[str] = Field(default_factory=list)
            search_queries: List[str] = Field(default_factory=list)

        profile = await call_llm_structured(
            llm=llm,
            prompt=prompt,
            output_schema=ResumeProfile,
            system_prompt="You are an expert recruiter. Output only valid JSON matching the exact schema.",
            max_retries=2,
        )
        profile_dict = profile.model_dump()

        # Validate queries — ensure we have enough
        queries = profile_dict.get("search_queries", [])
        if len(queries) < 5:
            logger.warning(f"[analyze_resume] LLM only generated {len(queries)} queries, adding fallback queries")
            fallback = [q.replace("{role}", target_role) for q in FALLBACK_QUERIES[:10]]
            queries.extend(fallback)
            profile_dict["search_queries"] = queries

        logger.info(
            f"[analyze_resume] ✅ Profile: role={profile_dict['primary_role']}, "
            f"seniority={profile_dict['seniority']}, "
            f"skills={profile_dict['core_skills'][:5]}, "
            f"queries={len(profile_dict['search_queries'])}"
        )
        return {"resume_profile": profile_dict}

    except Exception as exc:
        logger.error(f"[analyze_resume] LLM profile generation failed: {exc} — using fallback")
        return {
            "resume_profile": {
                "primary_role": target_role,
                "alternate_roles": [],
                "core_skills": [],
                "seniority": "mid",
                "years_experience": 0,
                "domains": [],
                "preferred_stack": [],
                "search_queries": [q.replace("{role}", target_role) for q in FALLBACK_QUERIES],
            }
        }


# ── Node: Search Jobs ────────────────────────────────────────────────────────

@log_node("search_jobs")
async def search_jobs(state: JobDiscoveryState) -> dict:
    """Execute search queries from the resume profile and collect unique URLs.

    Uses resume-generated queries when available, fallback queries otherwise.
    Filters out aggregator domains and preserves full search metadata.
    """
    profile = state.get("resume_profile", {})
    target_role = profile.get("primary_role", state.get("target_role", "AI Agent Engineer"))
    queries = profile.get("search_queries", [])

    if not queries:
        queries = [q.replace("{role}", target_role) for q in FALLBACK_QUERIES]

    seen_urls: set[str] = set()
    all_urls: list[str] = []
    all_search_results: list[dict] = []

    # Run queries concurrently with semaphore (5 at a time)
    sem = asyncio.Semaphore(5)

    async def run_query(i: int, query: str):
        async with sem:
            logger.info(f"[search_jobs] Running query {i}/{len(queries)}: {query[:80]}...")
            try:
                return await asyncio.to_thread(search_serper, query, 30)
            except Exception as exc:
                logger.warning(f"[search_jobs] Query {i} failed: {exc}")
                return []

    batch_results = await asyncio.gather(
        *[run_query(i, q) for i, q in enumerate(queries, 1)]
    )

    for results in batch_results:
        for result in results:
            url = result.get("link", "")
            if not url or url in seen_urls:
                continue
            if _is_aggregator_url(url):
                logger.debug(f"[search_jobs] Skipping aggregator URL: {url[:60]}")
                continue
            seen_urls.add(url)
            all_urls.append(url)
            all_search_results.append({
                "title": result.get("title", ""),
                "link": url,
                "snippet": result.get("snippet", ""),
            })

    logger.info(f"[search_jobs] Discovered {len(all_urls)} unique URLs across {len(queries)} queries")
    return {"raw_urls": all_urls, "raw_search_results": all_search_results}


# ── Node: Extract Details ─────────────────────────────────────────────────────

SINGLE_URL_EXTRACTION_PROMPT = """Extract structured job data from this page content.
If a field is not stated in the page content, check the SEARCH CONTEXT below for clues.
If still not found, use "Not Listed".
If this is NOT a real job posting (e.g. blog post, company page, guide), return {{"jobs": []}}.

SEARCH CONTEXT (from the search engine result — use to fill gaps):
- Search Title: {search_title}
- Search Snippet: {search_snippet}

Extract the following fields:
1. Company Name — the ACTUAL EMPLOYER hiring for this role (e.g. "Cohere", "Visa", "Datadog").
   CRITICAL: The company name must be the organization that is HIRING, NOT the job board or
   platform hosting the listing. Names like "Indeed", "Glassdoor", "ZipRecruiter", "Lever",
   "Greenhouse", "Ashby", "Workable", "Upwork", "LinkedIn" are NEVER the company — these are
   job boards. Look for the actual employer name in the job description, page header, or search snippet.
   Also provide a one-line description of what the company builds.
2. Exact Job Title — the specific role title (e.g. "Senior AI Agent Engineer"), NOT a search result
   title like "200 jobs found" or "NOW HIRING".
3. Location / Remote Policy (look for "remote", "hybrid", timezone requirements)
4. Required Skills (array of specific technologies, frameworks, and tools)
5. Nice-to-Have Skills (array)
6. Experience Level (junior/mid/senior/staff + years if mentioned)
7. Salary Range
8. Key Responsibilities (top 3-5 bullet points)
9. Application URL (direct apply link — default to the page URL if not found)
10. Agentic AI Classification: REAL_AGENT or API_WRAPPER
11. Posted Date

IMPORTANT RULES:
- The company field MUST be the actual hiring company, never a job board name
- Extract skills as specific technology names (e.g. "Python", "LangGraph", "Docker"), not vague descriptions
- For responsibilities, extract actual bullet points from the JD, not summaries
- If the page has structured job data sections, prioritize those over general text
- The application URL should default to: {url}

URL: {url}
Page Content:
{content}"""


async def _extract_single_url(
    llm, url: str, content: str, search_meta: dict, index: int, total: int
) -> list[dict]:
    """Extract structured job data from a single URL's scraped content.

    Now accepts search_meta (title + snippet from Serper) to enrich
    extraction when page content is sparse.

    Returns a list of job dicts (usually 1, but a page could list multiple).
    Returns empty list on failure — never raises.
    """
    search_title = search_meta.get("title", "")
    search_snippet = search_meta.get("snippet", "")

    prompt = SINGLE_URL_EXTRACTION_PROMPT.format(
        url=url,
        content=content,
        search_title=search_title,
        search_snippet=search_snippet,
    )

    try:
        scraped = await call_llm_structured(
            llm=llm,
            prompt=prompt,
            output_schema=ScrapedJobsOutput,
            system_prompt=(
                "You are a job data extraction specialist. Output valid JSON with a 'jobs' array. "
                "Extract as much detail as possible from the page content. When the page content "
                "is limited, use the SEARCH CONTEXT (title and snippet) to fill in the company name, "
                "job title, and any details mentioned in the snippet. Never leave required_skills "
                "empty if the content mentions any technologies."
            ),
            max_retries=2,
        )
        jobs = [job.model_dump() for job in scraped.jobs]

        # Post-processing: sanitize and ensure fields are populated
        cleaned_jobs = []
        for job in jobs:
            if not job.get("url") or job["url"] == "Not Listed":
                job["url"] = url
            if not job.get("application_url") or job["application_url"] == "Not Listed":
                job["application_url"] = url
            # Sanitize company name — strip job board names
            job["company"] = _sanitize_company_name(job.get("company", ""), url)
            # Skip entries with garbage titles (aggregator search result pages)
            title = job.get("title", "")
            if any(noise in title.lower() for noise in [
                "vacancies", "jobs found", "job openings", "now hiring",
                "job posting", "jobs in", "apply now",
            ]):
                logger.debug(f"[extract_details] Skipping aggregator-style title: {title[:60]}")
                continue
            cleaned_jobs.append(job)

        if cleaned_jobs:
            logger.info(f"[extract_details] URL {index}/{total}: Extracted {len(cleaned_jobs)} job(s) from {url[:50]}")
        else:
            logger.debug(f"[extract_details] URL {index}/{total}: No jobs found at {url[:50]} (not a job posting?)")
        return cleaned_jobs
    except Exception as exc:
        logger.warning(f"[extract_details] URL {index}/{total}: LLM extraction failed for {url[:50]}: {exc}")
        return []


async def _create_minimal_job_from_search(url: str, search_meta: dict) -> list[dict]:
    """Create a minimal job entry from search metadata alone.

    Used as a last-resort when both HTML scraping and Jina fail,
    but we still have useful data from the Serper search result.
    Skips aggregator pages and validates company names.
    """
    # Skip aggregator URLs entirely
    if _is_aggregator_url(url):
        return []

    title = search_meta.get("title", "")
    snippet = search_meta.get("snippet", "")

    if not title or len(title) < 5:
        return []

    # Skip titles that look like aggregator search results
    title_lower = title.lower()
    if any(noise in title_lower for noise in [
        "vacancies", "jobs found", "job openings", "now hiring",
        "job posting", "jobs in", "apply now", "hiring alert",
        "job search", "careers page", "jobs near",
    ]):
        logger.debug(f"[fallback] Skipping aggregator-style title: {title[:60]}")
        return []

    # Parse company from common title patterns
    company = ""
    job_title = title

    # "Title at Company" pattern
    if " at " in title:
        parts = title.split(" at ", 1)
        job_title = parts[0].strip()
        company = parts[1].strip()
    # "Title - Company" or "Title | Company" pattern
    elif " - " in title or " | " in title:
        sep = " - " if " - " in title else " | "
        parts = title.split(sep, 1)
        job_title = parts[0].strip()
        company = parts[1].strip()

    # Also try "Company hiring Job Title" pattern (Glassdoor-style)
    if not company and " hiring " in title_lower:
        parts = title.split(" hiring ", 1)
        company = parts[0].strip()
        job_title = parts[1].strip()

    # Sanitize company name — removes job board names
    company = _sanitize_company_name(company, url)

    # If company is still a job board name after sanitization, skip
    if not company or company == "Not Listed":
        # Try to extract company from the URL domain as a last resort
        try:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc.lower().replace("www.", "")
            # Only use domain-based company if it's a company ATS subdomain
            if any(ats in url for ats in ["lever.co", "greenhouse.io", "ashbyhq.com", "workable.com", "breezy.hr", "recruitee.com"]):
                # e.g. "jobs.lever.co/companyname" -> companyname
                path = urlparse(url).path.strip("/").split("/")[0] if urlparse(url).path else ""
                if path and path.lower() not in JOB_BOARD_NAMES:
                    company = path.replace("-", " ").title()
        except Exception:
            pass

    if not job_title:
        return []

    # Extract any skills mentioned in the snippet
    skills = []
    skill_keywords = [
        "Python", "TypeScript", "JavaScript", "React", "Node.js",
        "LangGraph", "CrewAI", "AutoGen", "LangChain", "LLM",
        "RAG", "Docker", "Kubernetes", "AWS", "GCP", "Azure",
        "FastAPI", "Django", "Flask", "MongoDB", "PostgreSQL",
        "Pinecone", "Weaviate", "FAISS", "MCP", "A2A",
        "Terraform", "Redis", "Kafka", "GraphQL", "REST",
    ]
    snippet_lower = snippet.lower()
    for skill in skill_keywords:
        if skill.lower() in snippet_lower:
            skills.append(skill)

    # Check for remote mention
    remote_policy = "Not Listed"
    if any(word in snippet_lower for word in ["remote", "work from home", "wfh"]):
        remote_policy = "Remote"
    elif "hybrid" in snippet_lower:
        remote_policy = "Hybrid"

    return [{
        "title": job_title,
        "company": company or "Not Listed",
        "url": url,
        "source_board": "",
        "company_description": "Not Listed",
        "location": "Not Listed",
        "remote_policy": remote_policy,
        "required_skills": skills,
        "nice_to_have_skills": [],
        "experience_level": "Not Listed",
        "salary_range": "Not Listed",
        "key_responsibilities": [],
        "application_url": url,
        "agentic_ai_relevance": "Not Listed",
        "posted_date": "Not Listed",
        "skipped_reason": "Scraped from search metadata only (page inaccessible)",
    }]


@log_node("extract_details")
async def extract_details(state: JobDiscoveryState) -> dict:
    """Scrape each URL and extract structured job data via per-URL LLM calls.

    Architecture: Each URL is processed independently via its own LLM call,
    then results are aggregated. This avoids the single-call output truncation
    that caused only 2-3 jobs to appear from 30+ URLs.

    Key improvements over previous version:
    - Uses search metadata (title, snippet) to enrich LLM prompts
    - Extracts JSON-LD structured data from HTML (works on JS-heavy ATS pages)
    - Falls back to search-metadata-only entries when scraping completely fails
    - Increased content limit from 4KB to 8KB per URL

    URLs are processed in concurrent batches of 5 for throughput.
    """
    llm = get_deepseek_chat()
    urls = state.get("raw_urls", [])
    search_results = state.get("raw_search_results", [])
    # Merge in any pre-structured API jobs
    api_jobs = state.get("api_jobs", [])
    errors: list[str] = []
    all_jobs: list[dict] = list(api_jobs)  # Start with API jobs (already structured)
    seen_titles: set[str] = set()
    # Pre-populate dedup set from API jobs
    for j in api_jobs:
        seen_titles.add(f"{j.get('title','').lower()}|{j.get('company','').lower()}")

    # Build URL → search metadata lookup
    search_meta_lookup: dict[str, dict] = {}
    for result in search_results:
        link = result.get("link", "")
        if link:
            search_meta_lookup[link] = result

    # Phase 1: Scrape all URLs CONCURRENTLY with semaphore
    url_contents: list[tuple[str, str, dict]] = []  # (url, content, search_meta)
    failed_urls: list[tuple[str, dict]] = []  # (url, search_meta) — for fallback
    url_cap = min(len(urls), 100)  # Process up to 100 URLs

    scrape_sem = asyncio.Semaphore(10)
    async def scrape_one(url: str) -> tuple[str, str | None]:
        async with scrape_sem:
            content = await asyncio.to_thread(scrape_url, url)
            return (url, content)

    logger.info(f"[extract_details] Scraping {url_cap} URLs concurrently (semaphore=10)...")
    scrape_results = await asyncio.gather(
        *[scrape_one(u) for u in urls[:url_cap]], return_exceptions=True
    )

    for result in scrape_results:
        if isinstance(result, Exception):
            errors.append(f"Scrape error: {result}")
            continue
        url, content = result
        search_meta = search_meta_lookup.get(url, {})
        if content and len(content.strip()) > 100:
            url_contents.append((url, content[:12288], search_meta))
        else:
            errors.append(f"Failed to scrape: {url}")
            if search_meta:
                failed_urls.append((url, search_meta))

    logger.info(f"[extract_details] Successfully scraped {len(url_contents)}/{url_cap} URLs ({len(failed_urls)} failed with search metadata)")

    # Phase 2: Per-URL LLM extraction in batches of 5
    if url_contents:
        batch_size = 5
        total = len(url_contents)

        for batch_start in range(0, total, batch_size):
            batch = url_contents[batch_start : batch_start + batch_size]
            batch_num = batch_start // batch_size + 1
            total_batches = (total + batch_size - 1) // batch_size
            logger.info(f"[extract_details] Processing extraction batch {batch_num}/{total_batches} ({len(batch)} URLs)")

            tasks = [
                _extract_single_url(llm, url, content, search_meta, batch_start + j + 1, total)
                for j, (url, content, search_meta) in enumerate(batch)
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception):
                    errors.append(f"Batch extraction error: {result}")
                    continue
                if isinstance(result, list):
                    for job in result:
                        # Deduplicate by title + company
                        dedup_key = f"{job.get('title', '').lower()}|{job.get('company', '').lower()}"
                        if dedup_key not in seen_titles and dedup_key != "|":
                            seen_titles.add(dedup_key)
                            all_jobs.append(job)

    # Phase 3: Create minimal entries from search metadata for completely failed URLs
    for url, search_meta in failed_urls:
        fallback_jobs = await _create_minimal_job_from_search(url, search_meta)
        for job in fallback_jobs:
            dedup_key = f"{job.get('title', '').lower()}|{job.get('company', '').lower()}"
            if dedup_key not in seen_titles and dedup_key != "|":
                seen_titles.add(dedup_key)
                all_jobs.append(job)
                logger.info(f"[extract_details] Created search-metadata entry: {job.get('title')} @ {job.get('company')}")

    logger.info(f"[extract_details] ✅ Extracted {len(all_jobs)} unique structured jobs ({len(failed_urls)} from search metadata fallback)")
    return {"scraped_jobs": all_jobs, "errors": errors}

# ── Node: Quality Gate Agent (NEW) ────────────────────────────────────────────

QUALITY_GATE_PROMPT = """You are a job listing quality control agent. Review each job listing below and determine if it should be KEPT or REJECTED.

CANDIDATE PROFILE (use to assess relevance):
- Primary Role: {primary_role}
- Seniority: {seniority}
- Core Skills: {core_skills}

JOB LISTINGS TO VALIDATE:
{jobs_json}

For each job, return a JSON object in this format:
{{
  "validated_jobs": [
    {{
      "index": <original index in the list>,
      "decision": "KEEP" or "REJECT",
      "reason": "<short reason for rejection, or 'Valid posting' for kept jobs>",
      "corrected_title": "<cleaned job title if it had noise like 'NOW HIRING', else same as original>",
      "corrected_company": "<actual employer name if the current company is wrong or a job board name, else same>"
    }}
  ]
}}

REJECTION CRITERIA (reject if ANY apply):
1. NOT a real job posting — it's an aggregator search result page, blog post, or company info page
2. Title contains aggregator noise: "vacancies", "jobs found", "job openings", "hiring alert"
3. Company name is a job board (Indeed, Glassdoor, ZipRecruiter, LinkedIn, Upwork)
4. Role domain is completely wrong for the candidate (e.g. candidate is an engineer but listing is for Product Manager, Recruiter, Sales)
5. The listing is clearly expired or a talent pipeline with no actual open role
6. Seniority mismatch: If candidate is junior/mid-level, REJECT roles explicitly requiring "Staff", "Principal", "Distinguished", "VP", "Director", "Head of". However, keep "Senior" roles — they can still be worth applying to.

KEEP CRITERIA:
- Real job posting with an actual employer
- Role is in the right domain for the candidate (engineering/technical)
- Has at least some skill overlap with the candidate's profile
- Jobs from known job boards (Remotive, Adzuna, etc.) with real company names should be KEPT — they are pre-validated API results
- When in doubt, KEEP the job — let the scoring phase determine actual fit
"""


@log_node("quality_gate")
async def quality_gate(state: JobDiscoveryState) -> dict:
    """Quality Gate Agent — validates and cleans extracted job listings.

    Runs AFTER extract_details, BEFORE scoring. Uses an LLM to:
    - Reject non-job-postings (aggregator pages, blog posts)
    - Reject wrong-domain roles (PM listings for an engineer)
    - Fix company names that are actually job board names
    - Clean up noisy job titles

    Processes jobs in batches of 10 for efficiency.
    """
    llm = get_deepseek_chat()
    scraped_jobs = state.get("scraped_jobs", [])
    profile = state.get("resume_profile", {})

    if not scraped_jobs:
        logger.info("[quality_gate] No jobs to validate")
        return {"validated_jobs": []}

    primary_role = profile.get("primary_role", state.get("target_role", "Software Engineer"))
    seniority = profile.get("seniority", "mid")
    core_skills = profile.get("core_skills", [])

    validated: list[dict] = []
    batch_size = 10

    for batch_start in range(0, len(scraped_jobs), batch_size):
        batch = scraped_jobs[batch_start : batch_start + batch_size]
        batch_num = batch_start // batch_size + 1

        # Build a compact summary for the LLM
        jobs_summary = []
        for i, job in enumerate(batch):
            jobs_summary.append({
                "index": i,
                "title": job.get("title", ""),
                "company": job.get("company", ""),
                "required_skills": job.get("required_skills", [])[:8],
                "location": job.get("location", ""),
                "url": job.get("url", "")[:80],
                "source": job.get("source", "scraped"),  # remotive/adzuna = pre-validated
            })

        prompt = QUALITY_GATE_PROMPT.format(
            primary_role=primary_role,
            seniority=seniority,
            core_skills=", ".join(core_skills[:8]),
            jobs_json=json.dumps(jobs_summary, indent=2),
        )

        try:
            from pydantic import BaseModel, Field
            from typing import List

            class ValidationEntry(BaseModel):
                index: int = 0
                decision: str = "KEEP"
                reason: str = ""
                corrected_title: str = ""
                corrected_company: str = ""

            class ValidationResult(BaseModel):
                validated_jobs: List[ValidationEntry] = Field(default_factory=list)

            result = await call_llm_structured(
                llm=llm,
                prompt=prompt,
                output_schema=ValidationResult,
                system_prompt="You are a job quality control agent. Output valid JSON.",
                max_retries=2,
            )

            kept = 0
            rejected = 0
            for entry in result.validated_jobs:
                idx = entry.index
                if idx < 0 or idx >= len(batch):
                    continue

                if entry.decision.upper() == "REJECT":
                    rejected += 1
                    logger.debug(f"[quality_gate] REJECTED: {batch[idx].get('title', '')} — {entry.reason}")
                    continue

                # Apply corrections
                job = batch[idx].copy()
                if entry.corrected_title and entry.corrected_title != job.get("title"):
                    job["title"] = entry.corrected_title
                if entry.corrected_company and entry.corrected_company != job.get("company"):
                    company = _sanitize_company_name(entry.corrected_company)
                    if company != "Not Listed":
                        job["company"] = company

                validated.append(job)
                kept += 1

            logger.info(f"[quality_gate] Batch {batch_num}: {kept} kept, {rejected} rejected")

        except Exception as exc:
            logger.warning(f"[quality_gate] Batch {batch_num} validation failed: {exc} — keeping all (unverified)")
            for job in batch:
                job["quality_verified"] = False
            validated.extend(batch)

    logger.info(f"[quality_gate] ✅ {len(validated)}/{len(scraped_jobs)} jobs passed quality gate")
    return {"validated_jobs": validated}


# ── Conditional Edge: Check Quality Results ───────────────────────────────────

def check_quality_results(state: JobDiscoveryState) -> str:
    """Route based on quality gate results (Reflection Loop).
    
    If 0 valid jobs were found and we haven't hit the retry limit,
    cycle back to generate better search queries.
    Otherwise, proceed normally to scoring or persistence.
    """
    valid = state.get("validated_jobs", [])
    retries = state.get("search_retry_count", 0)
    
    if len(valid) == 0 and retries < 1:  # Limit to 1 retry cycle
        return "query_refiner"
        
    resume = state.get("resume_text", "")
    if resume and resume.strip():
        return "match_and_rank"
    return "persist"


# ── Node: Query Refiner (Reflection) ──────────────────────────────────────────

@log_node("query_refiner")
async def query_refiner(state: JobDiscoveryState) -> dict:
    """Cyclic Reflection Node: Generates new queries when previous search failed."""
    llm = get_deepseek_chat()
    target_role = state.get("target_role", "Software Engineer")
    profile = state.get("resume_profile", {})
    retries = state.get("search_retry_count", 0)
    old_queries = profile.get("search_queries", [])
    
    logger.warning(f"[query_refiner] 0 valid jobs found! Reflecting on queries and retrying (Attempt {retries + 1}).")
    
    prompt = f"""You are an expert technical recruiter. The previous job search queries yielded 0 valid results.
    
    Target Role: {target_role}
    Previous Queries Used:
    {json.dumps(old_queries, indent=2)}
    
    Generate 5 completely NEW, different Google search queries targeting actual employer ATS systems.
    Do NOT use any of the previous queries. Make them broader.
    Include job board names like: lever.co, greenhouse.io, jobs.ashbyhq.com, workable.com, builtin.com
    Do NOT use 'site:' operator. Just include the domain name in the query text.
    
    Return JSON: {{"search_queries": ["query1", "query2", ...]}}
    """
    
    try:
        from pydantic import BaseModel, Field
        from typing import List
        class RefinedQueries(BaseModel):
            search_queries: List[str] = Field(default_factory=list)
            
        result = await call_llm_structured(
            llm=llm, prompt=prompt, output_schema=RefinedQueries,
            system_prompt="You are an expert technical recruiter. Output valid JSON."
        )
        profile["search_queries"] = result.search_queries
        logger.info(f"[query_refiner] Generated {len(result.search_queries)} new refined queries.")
    except Exception as e:
        logger.error(f"[query_refiner] Failed to refine queries: {e}")
        profile["search_queries"] = [f'"{target_role}" hiring remote lever.co OR greenhouse.io apply']
        
    return {
        "resume_profile": profile,
        "search_retry_count": retries + 1,
        "raw_urls": [],
        "raw_search_results": [],
        # Preserve any partial scraped_jobs from previous attempt
    }


# ── Node: Match and Rank ─────────────────────────────────────────────────────

@log_node("match_and_rank")
async def match_and_rank(state: JobDiscoveryState) -> dict:
    """Score and rank validated jobs against the candidate's resume.
    
    Produces STRUCTURED rankings (Pydantic) with fallback to markdown report.
    """
    from pydantic import BaseModel, Field
    from typing import List

    class RankedJob(BaseModel):
        title: str = ""
        company: str = ""
        fit_score: int = 5
        matching_skills: List[str] = Field(default_factory=list)
        skill_gaps: List[str] = Field(default_factory=list)
        reasoning: str = ""

    class JobRankingOutput(BaseModel):
        ranked_jobs: List[RankedJob] = Field(default_factory=list)

    llm = get_gemini_flash()
    jobs = state.get("validated_jobs") or state.get("scraped_jobs", [])
    resume = state.get("resume_text", "")

    if not jobs:
        return {"scored_report": "No jobs to score.", "job_rankings": []}

    jobs_summary = json.dumps(jobs[:20], indent=2, default=str)

    prompt = f"""Score each job listing against the candidate's resume.

For each job produce:
- title: exact job title
- company: exact company name
- fit_score: 1-10 based on genuine skill overlap
- matching_skills: candidate skills that match requirements
- skill_gaps: required skills the candidate lacks
- reasoning: one sentence explaining the score

Sort by fit_score descending.

Jobs:
{jobs_summary}

Candidate Resume:
{resume}"""

    try:
        result = await call_llm_structured(
            llm=llm,
            prompt=prompt,
            output_schema=JobRankingOutput,
            system_prompt="You are an expert career analyst. Output structured JSON rankings.",
        )
        rankings = [r.model_dump() for r in result.ranked_jobs]
        # Generate a text report as well for backward compatibility
        report_lines = [f"## Job Rankings ({len(rankings)} jobs scored)\n"]
        for r in rankings:
            report_lines.append(f"### {r['title']} @ {r['company']} — Score: {r['fit_score']}/10")
            report_lines.append(f"**Match**: {', '.join(r['matching_skills'])}")
            report_lines.append(f"**Gaps**: {', '.join(r['skill_gaps'])}")
            report_lines.append(f"*{r['reasoning']}*\n")
        return {"scored_report": "\n".join(report_lines), "job_rankings": rankings}
    except Exception as e:
        logger.warning(f"[match_and_rank] Structured scoring failed: {e} — falling back to text")
        report = await call_llm_text(
            llm=llm,
            prompt=prompt,
            system_prompt="You are an expert career analyst. Produce a polished markdown report.",
        )
        return {"scored_report": report, "job_rankings": []}


# ── Node: Persist ─────────────────────────────────────────────────────────────

@log_node("persist")
async def persist(state: JobDiscoveryState) -> dict:
    """Persist validated jobs — actual MongoDB persistence happens in the caller."""
    # Use validated_jobs if available, fall back to scraped_jobs
    jobs = state.get("validated_jobs") or state.get("scraped_jobs", [])
    logger.info(f"[persist] {len(jobs)} validated jobs ready for persistence")
    return {"persisted_count": len(jobs)}


# ── Node: Fetch Job APIs (parallel with search_jobs) ─────────────────────────

@log_node("fetch_job_apis")
async def fetch_job_apis_node(state: JobDiscoveryState) -> dict:
    """Fetch structured jobs from free job board APIs (Remotive, Adzuna).
    
    Runs in parallel with search_jobs. Results are pre-structured,
    so they skip the scraping pipeline entirely.
    """
    from job_scraper.graphs.job_apis import fetch_all_job_apis

    profile = state.get("resume_profile", {})
    target_role = profile.get("primary_role", state.get("target_role", "AI Engineer"))
    skills = profile.get("core_skills", [])

    try:
        api_jobs = await fetch_all_job_apis(target_role, skills)
        logger.info(f"[fetch_job_apis] ✅ {len(api_jobs)} jobs from free APIs")
        return {"api_jobs": api_jobs}
    except Exception as exc:
        logger.warning(f"[fetch_job_apis] API fetch failed: {exc}")
        return {"api_jobs": []}


# ── Graph Assembly ────────────────────────────────────────────────────────────

def build_job_discovery_graph() -> StateGraph:
    """Construct the Job Discovery graph with reflection and quality gate.
    """
    graph = StateGraph(JobDiscoveryState)

    graph.add_node("analyze_resume", analyze_resume)
    graph.add_node("fetch_job_apis", fetch_job_apis_node)
    graph.add_node("search_jobs", search_jobs)
    graph.add_node("extract_details", extract_details)
    graph.add_node("quality_gate", quality_gate)
    graph.add_node("query_refiner", query_refiner)
    graph.add_node("match_and_rank", match_and_rank)
    graph.add_node("persist", persist)

    graph.add_edge(START, "analyze_resume")
    # After resume analysis, run search + API fetch in parallel
    graph.add_edge("analyze_resume", "search_jobs")
    graph.add_edge("analyze_resume", "fetch_job_apis")
    graph.add_edge("search_jobs", "extract_details")
    graph.add_edge("fetch_job_apis", "extract_details")
    graph.add_edge("extract_details", "quality_gate")
    
    # Conditional branching & Cycle
    graph.add_conditional_edges("quality_gate", check_quality_results, {
        "query_refiner": "query_refiner",
        "match_and_rank": "match_and_rank",
        "persist": "persist",
    })
    
    graph.add_edge("query_refiner", "search_jobs")  # Cycle loop!
    graph.add_edge("match_and_rank", "persist")
    graph.add_edge("persist", END)

    return graph

# Compiled graph with checkpointing (enables reflection loop state tracking)
from langgraph.checkpoint.memory import InMemorySaver

memory = InMemorySaver()

job_discovery_graph = build_job_discovery_graph().compile(checkpointer=memory)
