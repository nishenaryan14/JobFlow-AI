"""
LaTeX Resume Generator Tool
============================
Converts a Markdown resume into a professional, Overleaf-compatible
LaTeX document using the moderncv template.

Called directly by the resume_enhancement graph node — no framework dependency.
"""

import re
from pydantic import BaseModel, Field


class LaTeXInput(BaseModel):
    """Input schema for the LaTeX Resume Generator tool."""
    markdown_resume: str = Field(
        description="The complete enhanced resume in Markdown format. "
                    "Must include candidate name as H1, and sections as H2.")


class LaTeXResumeGeneratorTool(BaseModel):
    """
    Converts an enhanced Markdown resume into a professional LaTeX document
    ready to compile and download on Overleaf (overleaf.com).
    Returns the LaTeX source code as a string.
    """
    name: str = "latex_resume_generator"
    description: str = (
        "Converts a full Markdown-formatted resume into a professional LaTeX document "
        "compatible with Overleaf. Call this AFTER you have written the complete enhanced "
        "resume markdown. Returns a LaTeX string ready to paste into Overleaf."
    )

    args_schema: type[BaseModel] = LaTeXInput

    def _run(self, markdown_resume: str) -> str:
        try:
            return self._convert_to_latex(markdown_resume)
        except Exception as e:
            return f"% ERROR: LaTeX generation failed — {e}"

    def _escape(self, text: str) -> str:
        """Escape special LaTeX characters."""
        replacements = [
            ("\\", "\\textbackslash{}"),
            ("&", "\\&"),
            ("%", "\\%"),
            ("$", "\\$"),
            ("#", "\\#"),
            ("_", "\\_"),
            ("{", "\\{"),
            ("}", "\\}"),
            ("~", "\\textasciitilde{}"),
            ("^", "\\textasciicircum{}"),
        ]
        for char, rep in replacements:
            text = text.replace(char, rep)
        return text

    def _inline_format(self, text: str) -> str:
        """Convert Markdown inline formatting to LaTeX."""
        # Already escaped — apply formatting on top
        text = re.sub(r"\*\*\*(.+?)\*\*\*", r"\\textbf{\\textit{\1}}", text)
        text = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", text)
        text = re.sub(r"\*(.+?)\*", r"\\textit{\1}", text)
        return text

    def _convert_to_latex(self, markdown: str) -> str:
        lines = markdown.strip().split("\n")

        # ── Parse core fields ──────────────────────────────────────────────
        name = ""
        email = ""
        phone = ""
        linkedin = ""
        github = ""

        for line in lines[:10]:
            stripped = line.strip()
            if stripped.startswith("# "):
                name = stripped[2:].strip()
            m = re.search(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", stripped)
            if m:
                email = m.group(0)
            m = re.search(r"\+?[\d\s\-().]{10,17}", stripped)
            if m and not email:
                phone = m.group(0).strip()
            elif m and not phone:
                phone = m.group(0).strip()
            m = re.search(r"linkedin\.com/in/([\w-]+)", stripped, re.I)
            if m:
                linkedin = m.group(1)
            m = re.search(r"github\.com/([\w-]+)", stripped, re.I)
            if m:
                github = m.group(1)

        # ── LaTeX preamble (moderncv) ──────────────────────────────────────
        preamble = r"""\documentclass[10pt,a4paper,sans]{moderncv}

% Style: 'classic', 'casual', 'banking', 'oldstyle', or 'fancy'
\moderncvstyle{banking}
% Color: 'black', 'blue' (default), 'grey', 'green', 'orange', 'red'
\moderncvcolor{black}

\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{microtype}
\usepackage[scale=0.91]{geometry}
\usepackage{enumitem}
\setlist[itemize]{leftmargin=*, topsep=1pt, itemsep=0pt, parsep=0pt}

% Tighter section spacing
\setlength{\hintscolumnwidth}{2.2cm}

% Personal info
"""
        # Personal data
        esc_name = self._escape(name)
        parts = esc_name.rsplit(" ", 1)
        first_name = parts[0] if len(parts) > 1 else esc_name
        last_name = parts[1] if len(parts) > 1 else ""

        personal_data = f"\\name{{{first_name}}}{{{last_name}}}\n"
        if phone:
            personal_data += f"\\phone[mobile]{{{self._escape(phone)}}}\n"
        if email:
            personal_data += f"\\email{{{self._escape(email)}}}\n"
        if linkedin:
            personal_data += f"\\social[linkedin]{{{self._escape(linkedin)}}}\n"
        if github:
            personal_data += f"\\social[github]{{{self._escape(github)}}}\n"

        doc_open = "\n\\begin{document}\n\\makecvtitle\n\\vspace{-8mm}\n"

        # ── Parse sections ─────────────────────────────────────────────────
        sections: list[tuple[str, list[str]]] = []  # (section_name, [lines])
        current_section = ""
        current_lines: list[str] = []

        for line in lines:
            stripped = line.strip()
            if stripped.startswith("## "):
                if current_section:
                    sections.append((current_section, current_lines))
                current_section = stripped[3:].strip()
                current_lines = []
            elif stripped.startswith("# ") or re.search(r"[@|📧📱🔗]|linkedin|github|\+\d", stripped):
                continue  # skip name/contact lines — already in preamble
            else:
                current_lines.append(line)

        if current_section:
            sections.append((current_section, current_lines))

        # ── Render sections ────────────────────────────────────────────────
        body = ""

        for sec_name, sec_lines in sections:
            body += f"\n\\section{{{self._escape(sec_name)}}}\n"

            # Join back to text
            text = "\n".join(sec_lines).strip()
            if not text:
                continue

            # Detect sub-entries (### Job Title)
            if re.search(r"^### ", text, re.MULTILINE):
                # Experience / Projects section with jobs
                entries = re.split(r"\n(?=### )", text)
                for entry in entries:
                    if not entry.strip():
                        continue
                    entry_lines = entry.strip().split("\n")

                    job_title = ""
                    meta_line = ""
                    bullets: list[str] = []
                    desc_lines: list[str] = []

                    for el in entry_lines:
                        el_stripped = el.strip()
                        if el_stripped.startswith("### "):
                            job_title = self._escape(el_stripped[4:].strip())
                        elif el_stripped.startswith(("- ", "* ", "• ")):
                            bullet_text = el_stripped[2:].strip()
                            bullets.append(self._inline_format(self._escape(bullet_text)))
                        elif el_stripped.startswith("_") and el_stripped.endswith("_"):
                            meta_line = self._escape(el_stripped.strip("_"))
                        elif el_stripped:
                            desc_lines.append(self._escape(el_stripped))

                    # Split meta_line into company | date
                    company, date = "", ""
                    if " – " in meta_line or " - " in meta_line or "|" in meta_line:
                        sep = " – " if " – " in meta_line else (" - " if " - " in meta_line else "|")
                        parts_m = meta_line.split(sep, 1)
                        company = parts_m[0].strip()
                        date = parts_m[1].strip() if len(parts_m) > 1 else ""
                    else:
                        company = meta_line

                    body += f"\\cventry{{{date}}}{{{job_title}}}{{{company}}}{{}}{{}}{{%\n"
                    if desc_lines:
                        body += "\n".join(desc_lines) + "\n"
                    if bullets:
                        body += "\\begin{itemize}\n"
                        for b in bullets:
                            body += f"  \\item {b}\n"
                        body += "\\end{itemize}\n"
                    body += "}\n"

            # Skills section — render as cvitem rows
            elif sec_name.lower() in ("skills", "technical skills", "technologies"):
                skill_lines = [l.strip() for l in sec_lines if l.strip()]
                for sl in skill_lines:
                    if sl.startswith(("- ", "* ", "• ")):
                        sl = sl[2:].strip()
                    # Strip markdown bold markers before processing
                    sl = sl.replace("**", "")
                    if ":" in sl:
                        cat, vals = sl.split(":", 1)
                        body += f"\\cvitem{{\\textbf{{{self._escape(cat.strip())}}}}}{{{self._escape(vals.strip())}}}\n"
                    else:
                        body += f"\\cvitem{{}}{{{self._escape(sl)}}}\n"

            # Education section
            elif sec_name.lower() in ("education", "academics"):
                edu_lines = [l.strip() for l in sec_lines if l.strip()]
                for el in edu_lines:
                    if el.startswith(("- ", "* ", "• ")):
                        el = el[2:].strip()
                    # Try to detect degree | institution | year
                    body += f"\\cventry{{}}{{{self._inline_format(self._escape(el))}}}{{}}{{}}{{}}{{}}  \n"

            # Generic paragraph section (Summary, etc.)
            else:
                all_bullets = [l.strip() for l in sec_lines if l.strip() and l.strip().startswith(("- ", "* ", "• "))]
                all_plain = [l.strip() for l in sec_lines if l.strip() and not l.strip().startswith(("- ", "* ", "• ")) and not l.strip().startswith("#")]

                if all_plain:
                    para = " ".join(self._inline_format(self._escape(p)) for p in all_plain)
                    body += f"\\cvitem{{}}{{{para}}}\n"
                if all_bullets:
                    body += "\\begin{itemize}\n"
                    for b in all_bullets:
                        body += f"  \\item {self._inline_format(self._escape(b[2:].strip()))}\n"
                    body += "\\end{itemize}\n"

        doc_close = "\n\\end{document}\n"

        return preamble + personal_data + doc_open + body + doc_close
