import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { resumeData, jobDescription } = await req.json();
  const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

  try {
    const res = await fetch(`${apiUrl}/analyze-ats-gaps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_data: resumeData,
        job_description: jobDescription,
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {
    // Fall through to error response
  }

  return NextResponse.json(
    { error: "Gap analysis requires the AI backend. Please try again." },
    { status: 503 }
  );
}
