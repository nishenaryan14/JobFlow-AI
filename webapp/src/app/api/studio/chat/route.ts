import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt, resumeText, jobDescription, resumeData } = await req.json();
  const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

  // Try the Python backend first for AI-powered responses
  try {
    const res = await fetch(`${apiUrl}/studio-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, resume_text: resumeText, job_description: jobDescription }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json();
      if (!data.error) {
        return NextResponse.json(data);
      }
    }
  } catch {
    // Fall through to local handling
  }

  // Local fallback — handle common commands without AI backend
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("help") || lowerPrompt === "?") {
    return NextResponse.json({
      response: `Available commands:
• /analyze-gaps — Run ATS gap analysis against the pasted JD
• /enhance — AI-rewrite your resume for the target role
• /add-keywords: Python, Docker — Embed specific keywords into your resume
• Any free-text prompt — Ask the AI to modify your resume

Tips:
• Paste a job description first for best results
• Use specific keywords when asking for changes
• The AI will find the most natural placement for each keyword`,
    });
  }

  if (lowerPrompt.includes("status") || lowerPrompt.includes("info")) {
    const skillCount = (resumeData?.skills || []).reduce(
      (acc: number, cat: { skills?: string[] }) => acc + (cat.skills?.length || 0),
      0
    );
    const expCount = (resumeData?.experience || []).length;
    const projCount = (resumeData?.projects || []).length;

    return NextResponse.json({
      response: `Resume Status:
• Name: ${resumeData?.contact?.name || "Not set"}
• Skills: ${skillCount} keywords across ${(resumeData?.skills || []).length} categories
• Experience: ${expCount} positions
• Projects: ${projCount} listed
• JD loaded: ${jobDescription ? "Yes" : "No"}`,
    });
  }

  return NextResponse.json({
    response:
      "The AI backend is offline. Try these local commands: /analyze-gaps, /enhance, /add-keywords, or type 'help' for more options.",
  });
}
