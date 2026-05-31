import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let text = "";
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
      text = await file.text();
    } else if (fileName.endsWith(".pdf")) {
      // Try FastAPI/PyPDF2 first (much more reliable than pdf-parse for styled resumes)
      let parsedViaPython = false;
      try {
        const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
        const blob = new Blob([await file.arrayBuffer()], { type: "application/pdf" });
        const fwd = new FormData();
        fwd.append("file", blob, file.name);
        const res = await fetch(`${apiUrl}/parse-pdf`, {
          method: "POST",
          body: fwd,
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text && data.text.length > 100) {
            text = data.text;
            parsedViaPython = true;
          }
        }
      } catch {
        // FastAPI unavailable — fall through to pdf-parse
      }

      // Fallback: Node.js pdf-parse
      if (!parsedViaPython) {
        const buffer = Buffer.from(await file.arrayBuffer());
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
          const pdfData = await pdfParse(buffer);
          if (pdfData.text && pdfData.text.length > 50) {
            text = pdfData.text;
          } else {
            text = "[PDF text extraction produced no content — please upload as .docx or .txt]";
          }
        } catch {
          text = "[PDF parsing failed — please upload a .docx or .txt version of your resume]";
        }
      }
    } else if (fileName.endsWith(".docx")) {
      // For DOCX we forward to FastAPI which has python-docx
      try {
        const blob = new Blob([await file.arrayBuffer()]);
        const fwd = new FormData();
        fwd.append("file", blob, file.name);
        const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/parse-docx`, {
          method: "POST",
          body: fwd,
        });
        if (res.ok) {
          const data = await res.json();
          text = data.text;
        } else {
          text = "[DOCX parsing failed — please upload a .txt or .md version]";
        }
      } catch {
        text = "[DOCX parsing failed — please upload a .txt or .md version]";
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, MD, or TXT." },
        { status: 400 }
      );
    }

    // ── Session Initialization ───────────────────────────────────────────────
    // Store the resume text server-side in Redis (4h TTL) so that:
    //   1. /stream-matches can retrieve it via session_id query param
    //   2. We don't need to send 5-15 KB of resume text on every SSE request
    //   3. The system is ready for multi-user auth in the next phase
    let sessionId: string | null = null;
    if (text && text.length > 50 && !text.startsWith("[")) {
      try {
        const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
        const sessionRes = await fetch(`${apiUrl}/init-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume_text: text }),
          signal: AbortSignal.timeout(5000),
        });
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          sessionId = sessionData.session_id ?? null;
        }
      } catch {
        // FastAPI offline — session_id will be null; frontend falls back to
        // passing resume text directly in API calls where needed.
        console.warn("[upload] Could not initialize resume session (FastAPI offline)");
      }
    }

    // ── Persist to MongoDB ───────────────────────────────────────────────────
    try {
      const { connectDB } = await import("@/lib/mongodb");
      const { Resume } = await import("@/models/Resume");
      await connectDB();
      await Resume.findOneAndUpdate(
        { fileName: file.name },
        { $set: { rawText: text, sessionId } },
        { upsert: true, new: true }
      );
    } catch (dbErr) {
      console.warn("[upload] MongoDB save skipped:", dbErr);
    }

    return NextResponse.json({
      text,
      sessionId,           // ← frontend stores this in sessionStorage("resumeSessionId")
      fileName: file.name,
      charCount: text.length,
      lineCount: text.split("\n").filter(Boolean).length,
      preview: text.slice(0, 300),
    });
  } catch (err: any) {
    console.error("[upload] Error:", err);
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}

