"use client";

import { useState } from "react";

interface ResumeComparisonProps {
  original: string;
  enhanced: string;
  changes: string[];
  latexTemplate?: string | null;
}

export default function ResumeComparison({
  original,
  enhanced,
  changes,
  latexTemplate,
}: ResumeComparisonProps) {
  const [copied, setCopied] = useState<"resume" | "latex" | null>(null);

  // ── Simple markdown → HTML renderer (no external deps) ───────────────────
  function renderMarkdown(text: string): string {
    let html = text
      // H1 → name heading
      .replace(/^# (.+)$/gm, '<h1 style="font-size:1.5em;text-align:center;margin-bottom:2px;border-bottom:2px solid #555;padding-bottom:6px;font-weight:700">$1</h1>')
      // H2 → section heading
      .replace(/^## (.+)$/gm, '<h2 style="font-size:1em;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #aaa;padding-bottom:3px;margin:16px 0 8px;font-weight:700;color:#ddd">$1</h2>')
      // H3 → job title
      .replace(/^### (.+)$/gm, '<h3 style="font-size:.95em;font-weight:600;margin:10px 0 2px;color:#eee">$1</h3>')
      // Italic meta (_Company — Date_)
      .replace(/^_(.+)_$/gm, '<p style="font-size:.82em;color:#999;margin:0 0 4px;font-style:italic">$1</p>')
      // Bold + italic combo
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Bullet points
      .replace(/^[\-\*•] (.+)$/gm, '<li style="margin-bottom:3px;color:#ccc;font-size:.88em">$1</li>')
      // Horizontal rule
      .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #333;margin:10px 0"/>')
      // Blank lines become spacers
      .replace(/\n{2,}/g, '\n<br/>\n');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul style="padding-left:18px;margin:4px 0 8px">${m}</ul>`);

    return html;
  }

  function copyToClipboard(text: string, type: "resume" | "latex") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2500);
    });
  }

  return (
    <div>
      {/* ── Changes summary ── */}
      {changes.length > 0 && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: "var(--font-base)", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            📝 Improvements Made
          </h3>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {changes.map((change, i) => (
              <li
                key={i}
                style={{
                  fontSize: "var(--font-sm)",
                  color: "var(--text-secondary)",
                  paddingLeft: 16,
                  borderLeft: "2px solid var(--accent-primary)",
                  lineHeight: 1.5,
                }}
              >
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Side-by-side comparison ── */}
      <div className="comparison-layout">
        {/* Original */}
        <div className="comparison-panel glass-card">
          <h3><span>📄</span> Original Resume</h3>
          <div
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "var(--font-xs)",
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              fontFamily: "monospace",
              maxHeight: 500,
              overflowY: "auto",
            }}
          >
            {original}
          </div>
        </div>

        {/* Enhanced — rendered as formatted HTML */}
        <div className="comparison-panel glass-card">
          <h3><span>✨</span> Enhanced Resume</h3>
          <div
            style={{ fontSize: "var(--font-xs)", lineHeight: 1.7, maxHeight: 500, overflowY: "auto" }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(enhanced) }}
          />
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: "flex", gap: 12, marginTop: 28, justifyContent: "center", flexWrap: "wrap" }}>
        {/* Copy enhanced markdown to clipboard */}
        <button
          className="btn btn-secondary"
          onClick={() => copyToClipboard(enhanced, "resume")}
          style={{ minWidth: 170 }}
        >
          {copied === "resume" ? "✅ Copied!" : "📋 Copy Enhanced Resume"}
        </button>

        {/* Copy Overleaf LaTeX template */}
        {latexTemplate && (
          <button
            className="btn btn-primary"
            onClick={() => copyToClipboard(latexTemplate, "latex")}
            style={{ minWidth: 210, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
          >
            {copied === "latex" ? (
              "✅ Copied! Paste into Overleaf"
            ) : (
              <>
                <span style={{ fontSize: "1.1em" }}>🎓</span>
                Copy Overleaf LaTeX Template
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Overleaf hint ── */}
      {latexTemplate && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 20px",
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: "var(--radius-md)",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)", margin: 0 }}>
            💡 <strong style={{ color: "var(--accent-primary-light)" }}>How to use:</strong> Copy the Overleaf template above →{" "}
            <a
              href="https://www.overleaf.com/project"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent-primary-light)", textDecoration: "underline" }}
            >
              Open Overleaf
            </a>{" "}
            → New Project → Blank Project → paste the template → Click Compile → Download PDF ✅
          </p>
        </div>
      )}

      {/* ── LaTeX preview (collapsed) ── */}
      {latexTemplate && (
        <details className="glass-card" style={{ padding: 0, marginTop: 20, overflow: "hidden" }}>
          <summary
            style={{
              padding: "12px 20px",
              cursor: "pointer",
              fontSize: "var(--font-sm)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            📜 Preview LaTeX Source
          </summary>
          <pre
            style={{
              padding: "12px 20px",
              fontFamily: "monospace",
              fontSize: "var(--font-xs)",
              lineHeight: 1.7,
              maxHeight: 300,
              overflowY: "auto",
              background: "rgba(0,0,0,0.25)",
              borderTop: "1px solid var(--border-secondary)",
              margin: 0,
              color: "#a3e635",
              whiteSpace: "pre-wrap",
            }}
          >
            {latexTemplate}
          </pre>
        </details>
      )}
    </div>
  );
}
