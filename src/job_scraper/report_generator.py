"""
Converts the markdown job report into a beautifully formatted PDF.

Uses `markdown` for MD→HTML conversion and `xhtml2pdf` for HTML→PDF rendering.
Both are pure-Python and work perfectly on Windows without system dependencies.
"""

import os
import re
from datetime import datetime
from pathlib import Path

import markdown
from xhtml2pdf import pisa


# ─── Paths ────────────────────────────────────────────────────────────────────
OUTPUT_DIR = Path("output")
MD_REPORT = OUTPUT_DIR / "job_report.md"
PDF_REPORT = OUTPUT_DIR / "job_report.pdf"


# ─── Premium CSS ──────────────────────────────────────────────────────────────
REPORT_CSS = """
@page {
    size: A4;
    margin: 2cm 2.2cm;
}

body {
    font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.6;
    color: #1e293b;
    background: #ffffff;
}

/* ── Cover Header ──────────────────────────────────────────────────────── */
.cover-header {
    background-color: #6366f1;
    color: #ffffff;
    padding: 28px 32px;
    margin: -0.5cm -0.5cm 24px -0.5cm;
}

.cover-header h1 {
    font-size: 22pt;
    font-weight: 700;
    margin: 0 0 4px 0;
    letter-spacing: -0.5px;
}

.cover-header .subtitle {
    font-size: 10pt;
    color: #e0e0ff;
    margin: 0;
}

.cover-header .date {
    font-size: 9pt;
    color: #c0c0e0;
    margin-top: 8px;
}

/* ── Executive Summary Card ────────────────────────────────────────────── */
.exec-summary {
    background-color: #f8fafc;
    border-left: 4px solid #6366f1;
    padding: 16px 20px;
    margin: 20px 0;
}

.exec-summary h2 {
    color: #6366f1;
    font-size: 14pt;
    margin: 0 0 10px 0;
}

/* ── Section Headings ──────────────────────────────────────────────────── */
h1 {
    color: #312e81;
    font-size: 18pt;
    font-weight: 700;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 28px;
}

h2 {
    color: #4338ca;
    font-size: 13pt;
    font-weight: 600;
    margin-top: 22px;
}

h3 {
    color: #6366f1;
    font-size: 11pt;
    font-weight: 600;
    margin-top: 16px;
}

/* ── Tables ────────────────────────────────────────────────────────────── */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 9pt;
}

thead tr {
    background: #6366f1;
    color: #ffffff;
}

th {
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
}

td {
    padding: 10px 12px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
}

/* xhtml2pdf does not support nth-child */

/* ── Fit Score Badges ──────────────────────────────────────────────────── */
.score-high {
    background: #dcfce7;
    color: #166534;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 9pt;
}

.score-mid {
    background: #fef9c3;
    color: #854d0e;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 9pt;
}

.score-low {
    background: #fee2e2;
    color: #991b1b;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 9pt;
}

/* ── Job Cards ─────────────────────────────────────────────────────────── */
.job-card {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 14px 18px;
    margin: 14px 0;
    -pdf-keep-with-next: true;
}

.job-card h3 {
    margin-top: 0;
    margin-bottom: 8px;
    color: #312e81;
    font-size: 11pt;
}

.job-card .label {
    font-weight: 600;
    color: #6366f1;
}

/* ── Lists ─────────────────────────────────────────────────────────────── */
ul, ol {
    padding-left: 20px;
}

li {
    margin-bottom: 4px;
}

/* ── Horizontal Rules ──────────────────────────────────────────────────── */
hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 24px 0;
}

/* ── Bold/Strong ───────────────────────────────────────────────────────── */
strong {
    color: #1e1b4b;
}

/* ── Links ─────────────────────────────────────────────────────────────── */
a {
    color: #6366f1;
    text-decoration: none;
}

/* ── Strategic Recommendations ─────────────────────────────────────────── */
.recommendations {
    background-color: #eef2ff;
    border: 1px solid #c7d2fe;
    padding: 16px 20px;
    margin: 20px 0;
}

.recommendations h2 {
    color: #4338ca;
    margin-top: 0;
}
"""


def _score_to_badge(score_text: str) -> str:
    """Convert score like '9/10' into a colored badge span."""
    match = re.search(r"(\d+)/10", score_text)
    if not match:
        return score_text
    score = int(match.group(1))
    if score >= 7:
        css_class = "score-high"
    elif score >= 5:
        css_class = "score-mid"
    else:
        css_class = "score-low"
    return f'<span class="{css_class}">{score}/10</span>'


def _enhance_html(html: str) -> str:
    """Post-process the raw HTML to add semantic styling."""

    # Wrap executive summary section
    html = re.sub(
        r"<strong>Executive Summary</strong>",
        '<div class="exec-summary"><h2>📊 Executive Summary</h2>',
        html,
    )
    # Close exec-summary div at the first <hr>
    html = html.replace("</div>\n<hr", "</div></div>\n<hr", 1)

    # Wrap strategic recommendations
    html = re.sub(
        r"<strong>Strategic Recommendations</strong>",
        '<div class="recommendations"><h2>🎯 Strategic Recommendations</h2>',
        html,
    )
    # Close at end of document
    if '<div class="recommendations">' in html and html.count("</div>") < html.count("<div"):
        html += "</div>"

    # Wrap each detailed job analysis as a card
    html = re.sub(
        r"<strong>(\d+)\.\s*(.*?)\s*–\s*Fit Score (\d+/10)</strong>",
        lambda m: (
            f'<div class="job-card">'
            f'<h3>{m.group(1)}. {m.group(2)} — {_score_to_badge(m.group(3))}</h3>'
        ),
        html,
    )

    # Color-code fit scores in the table
    html = re.sub(
        r"<td>(\d+/10)</td>",
        lambda m: f"<td>{_score_to_badge(m.group(1))}</td>",
        html,
    )

    # Replace section headers
    html = re.sub(
        r"<strong>Ranked Job Analysis \(Highest to Lowest Fit Score\)</strong>",
        "<h2>📋 Ranked Job Analysis</h2>",
        html,
    )
    html = re.sub(
        r"<strong>Detailed Analysis per Job</strong>",
        "<h2>🔍 Detailed Analysis per Job</h2>",
        html,
    )

    return html


def generate_pdf(md_path: str | Path = MD_REPORT, pdf_path: str | Path = PDF_REPORT) -> Path:
    """Read the markdown report, convert to styled HTML, render as PDF."""

    md_path = Path(md_path)
    pdf_path = Path(pdf_path)

    if not md_path.exists():
        raise FileNotFoundError(f"Markdown report not found: {md_path}")

    # ── Read & convert markdown ───────────────────────────────────────────
    md_content = md_path.read_text(encoding="utf-8")
    html_body = markdown.markdown(
        md_content,
        extensions=["tables", "fenced_code", "nl2br"],
    )

    # ── Enhance with semantic classes ─────────────────────────────────────
    html_body = _enhance_html(html_body)

    # ── Build full HTML document ──────────────────────────────────────────
    today = datetime.now().strftime("%B %d, %Y")
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>{REPORT_CSS}</style>
</head>
<body>
    <div class="cover-header">
        <h1>🚀 AI Agent Job Search Report</h1>
        <p class="subtitle">Personalized Job Analysis for <strong>Aryan Nishen</strong></p>
        <p class="date">Generated on {today}</p>
    </div>

    {html_body}

    <hr>
    <p style="text-align: center; font-size: 8pt; color: #94a3b8;">
        Report generated by JobFlow AI · Powered by LangGraph + DeepSeek
    </p>
</body>
</html>"""

    # ── Render PDF ────────────────────────────────────────────────────────
    pdf_path.parent.mkdir(parents=True, exist_ok=True)

    with open(pdf_path, "wb") as f:
        pisa_status = pisa.CreatePDF(full_html, dest=f)

    if pisa_status.err:
        raise RuntimeError(f"PDF generation failed with {pisa_status.err} error(s)")

    print(f"\n✅ PDF report generated: {pdf_path.resolve()}")
    return pdf_path


# Allow running directly: python -m job_scraper.report_generator
if __name__ == "__main__":
    generate_pdf()
