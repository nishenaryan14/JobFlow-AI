import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, jobTitle, jobDescription, missingKeywords } = body;

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "Resume text and job description required" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

    // Try FastAPI
    try {
      const res = await fetch(`${apiUrl}/enhance-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_title: jobTitle,
          job_description: jobDescription,
          missing_keywords: missingKeywords,
        }),
        signal: AbortSignal.timeout(300000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (fetchErr) {
      console.warn("FastAPI not available, using local enhancement");
    }

    // Fallback: local enhancement
    const result = enhanceResumeLocally(resumeText, jobTitle, missingKeywords || []);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Enhancement error:", err);
    return NextResponse.json(
      { error: err.message || "Enhancement failed" },
      { status: 500 }
    );
  }
}

function enhanceResumeLocally(
  resumeText: string,
  jobTitle: string,
  missingKeywords: string[]
) {
  let enhanced = resumeText;
  const changes: string[] = [];

  // 1. Add missing keywords to skills section
  if (missingKeywords.length > 0) {
    const skillsSectionMatch = enhanced.match(
      /((?:##?\s*)?(?:Technical\s+)?Skills[\s\S]*?)(\n##|\n---|\n\*\*|$)/i
    );

    if (skillsSectionMatch) {
      const keywordsToAdd = missingKeywords
        .slice(0, 5)
        .map((kw) => `- ${kw.charAt(0).toUpperCase() + kw.slice(1)}`)
        .join("\n");

      enhanced = enhanced.replace(
        skillsSectionMatch[1],
        skillsSectionMatch[1] + "\n\n### Additional Relevant Skills\n" + keywordsToAdd + "\n"
      );
      changes.push(
        `Added ${Math.min(5, missingKeywords.length)} missing keywords to Skills section: ${missingKeywords.slice(0, 5).join(", ")}`
      );
    }
  }

  // 2. Optimize summary for target role
  const summaryMatch = enhanced.match(/(##?\s*Summary[\s\S]*?)(\n##|\n---)/i);
  if (summaryMatch && jobTitle) {
    const enhancedSummary = summaryMatch[1].replace(
      /\n([^#\n])/,
      `\nResults-driven professional targeting ${jobTitle} roles. $1`
    );
    enhanced = enhanced.replace(summaryMatch[1], enhancedSummary);
    changes.push(`Enhanced summary to target "${jobTitle}" roles`);
  }

  // 3. Add quantifiable achievements hint
  if (!enhanced.match(/\d+%|\d+x|\$\d+/)) {
    changes.push(
      "Recommendation: Add quantifiable achievements (e.g., 'improved efficiency by 40%', 'reduced processing time by 3x')"
    );
  }

  // 4. Ensure proper section ordering
  if (enhanced.indexOf("Experience") > enhanced.indexOf("Education") && enhanced.indexOf("Education") > 0) {
    changes.push(
      "Recommendation: Move Experience section above Education for better ATS parsing"
    );
  }

  // 5. Add action verbs
  const weakVerbs = ["worked on", "helped with", "was responsible for", "participated in"];
  const strongVerbs = ["architected", "developed", "engineered", "implemented"];
  for (const verb of weakVerbs) {
    if (enhanced.toLowerCase().includes(verb)) {
      changes.push(
        `Replace weak verb "${verb}" with strong action verbs like "${strongVerbs[Math.floor(Math.random() * strongVerbs.length)]}"`
      );
    }
  }

  return {
    enhancedResume: enhanced,
    changes,
  };
}
