/**
 * Resume Export Utility
 * Converts AI-enhanced Markdown resumes into downloadable PDF or DOCX files.
 * PDF: rendered client-side via html2pdf.js
 * DOCX: generated server-side via /api/export-docx
 */

const RESUME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    line-height: 1.55;
    padding: 0;
    margin: 0;
    background: #fff;
  }

  #resume-wrapper {
    max-width: 780px;
    margin: 0 auto;
    padding: 40px 48px;
  }

  h1 {
    font-size: 22pt;
    font-weight: 700;
    color: #111;
    text-align: center;
    margin-bottom: 4px;
    border-bottom: 2.5px solid #1a1a1a;
    padding-bottom: 8px;
    letter-spacing: -0.3px;
  }

  /* Contact line directly under name */
  h1 + p {
    text-align: center;
    font-size: 9.5pt;
    color: #555;
    margin-bottom: 16px;
  }

  h2 {
    font-size: 11.5pt;
    font-weight: 700;
    color: #1a1a1a;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1.2px solid #bbb;
    margin-top: 18px;
    margin-bottom: 8px;
    padding-bottom: 3px;
  }

  h3 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #1a1a1a;
    margin-top: 10px;
    margin-bottom: 2px;
  }

  p {
    font-size: 10.5pt;
    color: #2a2a2a;
    margin-bottom: 6px;
  }

  ul {
    padding-left: 18px;
    margin-bottom: 8px;
  }

  li {
    font-size: 10.5pt;
    color: #2a2a2a;
    margin-bottom: 3px;
    line-height: 1.5;
  }

  a {
    color: #0066cc;
    text-decoration: none;
  }

  hr {
    border: none;
    border-top: 1px solid #ddd;
    margin: 10px 0;
  }

  strong { font-weight: 600; }
  em { font-style: italic; color: #444; }
`;

/**
 * Convert markdown text to clean HTML — synchronously, no external deps.
 */
function markdownToHtml(md: string): string {
  let html = md
    // Escape dangerous chars (basic XSS guard)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

    // Headings (must come before bold/italic)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")

    // Horizontal rule
    .replace(/^---+$/gm, "<hr/>")

    // Bold + italic combo
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")

    // Inline code
    .replace(/`(.+?)`/g, "<code>$1</code>")

    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')

    // Bullet list items (-, *, •)
    .replace(/^[\-\*•] (.+)$/gm, "<li>$1</li>")

    // Numbered list items
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")

    // Wrap consecutive <li> in <ul>
    .replace(/(<li>[\s\S]*?<\/li>)(\s*)(?!<li>)/g, (m) => `<ul>${m}</ul>`)

    // Paragraphs: blank lines separate blocks
    .split(/\n{2,}/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      // Don't wrap already-block-level HTML
      if (/^<(h[1-6]|ul|ol|li|hr|div|p)/i.test(block)) return block;
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}

/**
 * Build a complete print-ready HTML document from markdown.
 */
export function buildResumeHtml(markdownText: string): string {
  const body = markdownToHtml(markdownText);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>${RESUME_CSS}</style>
</head>
<body>
  <div id="resume-wrapper">
    ${body}
  </div>
</body>
</html>`;
}

/**
 * Download the enhanced resume as a PDF.
 * Uses html2pdf.js loaded dynamically so it only runs in the browser.
 */
export async function downloadAsPdf(
  markdownText: string,
  filename: string = "enhanced_resume.pdf"
): Promise<void> {
  if (typeof window === "undefined") throw new Error("PDF export requires a browser environment");

  // @ts-ignore — html2pdf.js has no TS types
  const html2pdf = (await import("html2pdf.js")).default;

  const htmlString = buildResumeHtml(markdownText);

  // Inject into a hidden off-screen container
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:780px;background:#fff;";
  container.innerHTML = htmlString;
  document.body.appendChild(container);

  const opt = {
    margin: [10, 12, 10, 12] as [number, number, number, number], // mm
    filename,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
  };

  try {
    await html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Download the enhanced resume as a Word (.docx) file.
 * Calls the Next.js /api/export-docx server route which uses html-to-docx.
 */
export async function downloadAsDocx(
  markdownText: string,
  filename: string = "enhanced_resume.docx"
): Promise<void> {
  const htmlString = buildResumeHtml(markdownText);

  const response = await fetch("/api/export-docx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmlString }),
  });

  if (!response.ok) {
    let msg = "Failed to generate Word document";
    try {
      const err = await response.json();
      msg = err.error || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const blob = await response.blob();

  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
