"""LangChain-compatible tool wrappers for job discovery.

Replaces crewai_tools.SerperDevTool and crewai_tools.ScrapeWebsiteTool
with plain functions that can be called directly from graph nodes.

These are NOT agent tools (no @tool decorator needed) — they are
deterministic helper functions called explicitly by graph node code.
"""

import os
import json
import re
import requests
import logging
from typing import Optional

logger = logging.getLogger("jobflow.graphs")


def search_serper(query: str, num_results: int = 15) -> list[dict]:
    """Search for job listings using the Serper.dev API.

    Args:
        query: Search query string.
        num_results: Max results to return.

    Returns:
        List of search result dicts with keys: title, link, snippet.

    Retries up to 3 times with exponential backoff (1s, 2s, 4s)
    on transient network or server errors.
    """
    import time

    api_key = os.environ.get("SERPER_API_KEY", "")
    if not api_key:
        return []

    max_attempts = 3
    backoff_seconds = [1, 2, 4]

    for attempt in range(1, max_attempts + 1):
        try:
            resp = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": query, "num": num_results},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            results = []
            for item in data.get("organic", []):
                results.append({
                    "title": item.get("title", ""),
                    "link": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                })
            return results

        except requests.exceptions.HTTPError as exc:
            # Don't retry 4xx client errors (bad query format) — they'll never succeed
            if exc.response is not None and 400 <= exc.response.status_code < 500:
                logger.warning(
                    f"[search_serper] Query rejected (HTTP {exc.response.status_code}): {query[:60]}..."
                )
                return []
            # Retry 5xx server errors
            if attempt < max_attempts:
                delay = backoff_seconds[attempt - 1]
                logger.warning(f"[search_serper] Server error, retrying in {delay}s: {exc}")
                time.sleep(delay)
            else:
                logger.error(f"[search_serper] All {max_attempts} attempts failed: {exc}")
                return []

        except requests.exceptions.RequestException as exc:
            if attempt < max_attempts:
                delay = backoff_seconds[attempt - 1]
                logger.warning(
                    f"[search_serper] Attempt {attempt}/{max_attempts} failed: {exc} "
                    f"— retrying in {delay}s..."
                )
                time.sleep(delay)
            else:
                logger.error(
                    f"[search_serper] All {max_attempts} attempts failed for query: "
                    f"{query[:80]}... — last error: {exc}"
                )
                return []


# ── JSON-LD Structured Data Extraction ─────────────────────────────────────

def _extract_json_ld(html: str) -> Optional[str]:
    """Extract job posting data from JSON-LD <script> blocks.

    Many ATS platforms (Greenhouse, Lever, SmartRecruiters, etc.) embed
    Google-compliant structured data in <script type="application/ld+json">.
    This works even on JavaScript-heavy pages because JSON-LD is in the
    initial HTML response — no JS execution needed.

    Returns a formatted text summary of the job posting data, or None.
    """
    try:
        # Find all JSON-LD blocks
        pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
        matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)

        for match in matches:
            try:
                data = json.loads(match.strip())
            except json.JSONDecodeError:
                continue

            # Handle both single objects and arrays
            items = data if isinstance(data, list) else [data]

            for item in items:
                schema_type = item.get("@type", "")
                # Look for JobPosting schema
                if schema_type == "JobPosting" or "JobPosting" in str(schema_type):
                    return _format_json_ld_job(item)

        return None
    except Exception:
        return None


def _format_json_ld_job(data: dict) -> str:
    """Format a JSON-LD JobPosting object into readable text for LLM extraction."""
    parts = []

    title = data.get("title", "")
    if title:
        parts.append(f"Job Title: {title}")

    # Company / hiring organization
    org = data.get("hiringOrganization", {})
    if isinstance(org, dict):
        name = org.get("name", "")
        desc = org.get("description", "")
        if name:
            parts.append(f"Company: {name}")
        if desc:
            parts.append(f"Company Description: {desc}")
    elif isinstance(org, str):
        parts.append(f"Company: {org}")

    # Location
    location = data.get("jobLocation", {})
    if isinstance(location, dict):
        address = location.get("address", {})
        if isinstance(address, dict):
            loc_parts = []
            for field in ["addressLocality", "addressRegion", "addressCountry"]:
                val = address.get(field, "")
                if val:
                    loc_parts.append(str(val) if not isinstance(val, dict) else val.get("name", str(val)))
            if loc_parts:
                parts.append(f"Location: {', '.join(loc_parts)}")
    elif isinstance(location, list):
        locs = []
        for loc in location:
            if isinstance(loc, dict):
                address = loc.get("address", {})
                if isinstance(address, dict):
                    locality = address.get("addressLocality", "")
                    if locality:
                        locs.append(str(locality))
        if locs:
            parts.append(f"Location: {'; '.join(locs)}")

    # Remote policy
    job_location_type = data.get("jobLocationType", "")
    if job_location_type:
        parts.append(f"Remote Policy: {job_location_type}")

    applicant_location = data.get("applicantLocationRequirements", "")
    if applicant_location:
        if isinstance(applicant_location, dict):
            parts.append(f"Applicant Location: {applicant_location.get('name', str(applicant_location))}")
        elif isinstance(applicant_location, list):
            names = [loc.get("name", str(loc)) if isinstance(loc, dict) else str(loc) for loc in applicant_location]
            parts.append(f"Applicant Location Requirements: {', '.join(names)}")

    # Salary
    salary = data.get("baseSalary", {})
    if isinstance(salary, dict):
        currency = salary.get("currency", "")
        value = salary.get("value", {})
        if isinstance(value, dict):
            min_val = value.get("minValue", "")
            max_val = value.get("maxValue", "")
            unit = value.get("unitText", "")
            if min_val or max_val:
                parts.append(f"Salary: {currency} {min_val}-{max_val} {unit}".strip())
        elif value:
            parts.append(f"Salary: {currency} {value}")

    # Employment type
    emp_type = data.get("employmentType", "")
    if emp_type:
        if isinstance(emp_type, list):
            parts.append(f"Employment Type: {', '.join(emp_type)}")
        else:
            parts.append(f"Employment Type: {emp_type}")

    # Experience
    exp = data.get("experienceRequirements", "")
    if exp:
        if isinstance(exp, dict):
            months = exp.get("monthsOfExperience", "")
            if months:
                parts.append(f"Experience: {int(months)//12}+ years")
        else:
            parts.append(f"Experience: {exp}")

    # Description (the main content)
    desc = data.get("description", "")
    if desc:
        # Strip HTML tags from description
        clean_desc = re.sub(r"<[^>]+>", " ", desc)
        clean_desc = re.sub(r"\s+", " ", clean_desc).strip()
        parts.append(f"\nJob Description:\n{clean_desc}")

    # Skills / qualifications
    skills = data.get("skills", "")
    if skills:
        if isinstance(skills, list):
            parts.append(f"Skills: {', '.join(skills)}")
        else:
            parts.append(f"Skills: {skills}")

    qualifications = data.get("qualifications", "")
    if qualifications:
        if isinstance(qualifications, list):
            parts.append(f"Qualifications: {', '.join(qualifications)}")
        else:
            parts.append(f"Qualifications: {qualifications}")

    # Date posted
    date_posted = data.get("datePosted", "")
    if date_posted:
        parts.append(f"Posted Date: {date_posted}")

    # Valid through
    valid_through = data.get("validThrough", "")
    if valid_through:
        parts.append(f"Valid Through: {valid_through}")

    # Application URL
    apply_url = data.get("url", "") or data.get("directApply", "")
    if apply_url:
        parts.append(f"Application URL: {apply_url}")

    return "\n".join(parts)


# ── OG / Meta Tag Extraction ──────────────────────────────────────────────

def _extract_og_meta(html: str) -> str:
    """Extract OpenGraph and meta description tags from HTML.

    Many ATS pages embed job summary data in og:title, og:description,
    and meta description tags. These are in the initial HTML regardless
    of JavaScript rendering.
    """
    parts = []

    # og:title
    match = re.search(r'<meta\s+(?:property|name)=["\']og:title["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if not match:
        match = re.search(r'content=["\']([^"\']+)["\']\s+(?:property|name)=["\']og:title["\']', html, re.IGNORECASE)
    if match:
        parts.append(f"Page Title: {match.group(1)}")

    # og:description
    match = re.search(r'<meta\s+(?:property|name)=["\']og:description["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if not match:
        match = re.search(r'content=["\']([^"\']+)["\']\s+(?:property|name)=["\']og:description["\']', html, re.IGNORECASE)
    if match:
        parts.append(f"Description: {match.group(1)}")

    # meta description
    match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if not match:
        match = re.search(r'content=["\']([^"\']+)["\']\s+name=["\']description["\']', html, re.IGNORECASE)
    if match:
        desc = match.group(1)
        if desc not in str(parts):  # Avoid duplicating og:description
            parts.append(f"Meta Description: {desc}")

    # og:site_name (company name fallback)
    match = re.search(r'<meta\s+(?:property|name)=["\']og:site_name["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if not match:
        match = re.search(r'content=["\']([^"\']+)["\']\s+(?:property|name)=["\']og:site_name["\']', html, re.IGNORECASE)
    if match:
        parts.append(f"Site Name: {match.group(1)}")

    return "\n".join(parts)


def _scrape_html(url: str, timeout: int = 20) -> tuple[Optional[str], Optional[str]]:
    """Basic HTML scraping — works for static/server-rendered pages.

    Returns a tuple of (extracted_text, raw_html) so the caller can
    also run JSON-LD and meta tag extraction on the raw HTML.
    """
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)

        if resp.status_code == 403:
            return None, None
        resp.raise_for_status()

        raw_html = resp.text

        from html.parser import HTMLParser

        class TextExtractor(HTMLParser):
            def __init__(self):
                super().__init__()
                self.text_parts: list[str] = []
                self._skip = False
                self._skip_tags = {"script", "style", "noscript", "svg", "path"}

            def handle_starttag(self, tag, attrs):
                if tag in self._skip_tags:
                    self._skip = True

            def handle_endtag(self, tag):
                if tag in self._skip_tags:
                    self._skip = False

            def handle_data(self, data):
                if not self._skip:
                    text = data.strip()
                    if text:
                        self.text_parts.append(text)

        extractor = TextExtractor()
        extractor.feed(raw_html)
        text = "\n".join(extractor.text_parts)

        max_chars = 15_000
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[Content truncated]"

        return text, raw_html

    except Exception:
        return None, None


def _scrape_jina(url: str, timeout: int = 45) -> Optional[str]:
    """Jina AI Reader fallback — renders JavaScript and returns clean markdown.

    Free tier, no API key needed. Handles AshbyHQ, Lever, Wellfound, etc.
    """
    try:
        jina_url = f"https://r.jina.ai/{url}"
        headers = {
            "Accept": "text/plain",
            "User-Agent": "JobFlow/3.0",
            "X-Return-Format": "text",
            "X-With-Generated-Alt": "false",
        }
        resp = requests.get(jina_url, headers=headers, timeout=timeout)

        if not resp.ok:
            logger.debug(f"[scrape_jina] Jina returned {resp.status_code} for {url[:60]}")
            return None

        text = resp.text.strip()
        if len(text) < 100:
            return None

        max_chars = 15_000
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[Content truncated]"

        logger.info(f"[scrape_jina] ✅ Jina fallback succeeded for {url[:60]} ({len(text)} chars)")
        return text

    except Exception as exc:
        logger.debug(f"[scrape_jina] Jina failed for {url[:60]}: {exc}")
        return None


# Minimum chars for scrape to be considered "successful" —
# below this, it's likely a JS shell with only nav/footer text.
_MIN_CONTENT_CHARS = 200


def scrape_url(url: str, timeout: int = 20) -> Optional[str]:
    """Scrape text content from a URL with intelligent fallback and metadata enrichment.

    Strategy:
      1. Try basic HTML scraping (fast, free, works for static sites)
      2. Always extract JSON-LD structured data and OG meta tags from raw HTML
         (works on JS-heavy pages because this data is in the initial HTML)
      3. If body text is too short (<200 chars), fall back to Jina AI Reader
      4. Combine all sources for maximum data coverage

    Args:
        url: The URL to scrape.
        timeout: Request timeout in seconds.

    Returns:
        Extracted text content, or None if all strategies failed.
    """
    # Strategy 1: Basic HTML scraping + structured data extraction
    text, raw_html = _scrape_html(url, timeout)

    # Strategy 2: Extract structured data from HTML (works even on JS pages)
    structured_data = ""
    meta_data = ""
    if raw_html:
        json_ld = _extract_json_ld(raw_html)
        if json_ld:
            structured_data = f"\n\n=== STRUCTURED JOB DATA (JSON-LD) ===\n{json_ld}"
            logger.info(f"[scrape_url] ✅ Found JSON-LD structured data for {url[:60]} ({len(json_ld)} chars)")

        og_meta = _extract_og_meta(raw_html)
        if og_meta:
            meta_data = f"\n\n=== PAGE METADATA ===\n{og_meta}"

    # If body text is sufficient, combine it with structured data
    if text and len(text.strip()) >= _MIN_CONTENT_CHARS:
        combined = text + structured_data + meta_data
        return combined

    # If we have JSON-LD data, that alone may be enough (even without body text)
    if structured_data and len(structured_data) > 200:
        logger.info(f"[scrape_url] Using JSON-LD data as primary content for {url[:60]} (body text too short)")
        base = text if text and len(text.strip()) > 50 else ""
        return (base + structured_data + meta_data).strip()

    # Strategy 3: Jina AI Reader for JS-heavy sites
    logger.info(f"[scrape_url] Basic scrape insufficient for {url[:60]}, trying Jina fallback...")
    jina_text = _scrape_jina(url, timeout=45)
    if jina_text:
        # Also append any metadata we found from the HTML
        return jina_text + meta_data

    # Return whatever we got from basic scraping, even if short
    if text and len(text.strip()) > 50:
        return (text + structured_data + meta_data).strip() if (structured_data or meta_data) else text

    # If we have at least meta tags, return those
    if meta_data and len(meta_data.strip()) > 50:
        return meta_data.strip()

    return None
