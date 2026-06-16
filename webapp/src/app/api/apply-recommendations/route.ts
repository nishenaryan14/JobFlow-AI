import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, jobDescription, selectedRecommendations } = body;

    if (!resumeText || !selectedRecommendations || selectedRecommendations.length === 0) {
      return NextResponse.json(
        { error: "Resume text and selected recommendations required" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

    // Try FastAPI
    try {
      const res = await fetch(`${apiUrl}/apply-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: jobDescription || "",
          selected_recommendations: selectedRecommendations,
        }),
        signal: AbortSignal.timeout(300000), // 5 minute timeout for DeepSeek Reasoner
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (fetchErr) {
      console.warn("FastAPI not available, using local apply recommendations");
    }

    // Fallback: local simple append
    let enhanced = resumeText;
    enhanced += "\n\n## Applied Recommendations\n";
    selectedRecommendations.forEach((rec: string) => {
      enhanced += `- ${rec}\n`;
    });

    return NextResponse.json({
      enhancedResume: enhanced,
    });
  } catch (err: any) {
    console.error("Apply recommendations error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to apply recommendations" },
      { status: 500 }
    );
  }
}
