import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { resumeData, template, format } = await req.json();
  const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

  try {
    const res = await fetch(`${apiUrl}/generate-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_data: resumeData,
        template,
        format,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const contentType =
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="resume_${template}.${format}"`,
        },
      });
    }
  } catch {
    // Fall through to error response
  }

  return NextResponse.json(
    { error: "Export requires the AI backend. Please try again." },
    { status: 503 }
  );
}
