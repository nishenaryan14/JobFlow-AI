import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, jobTitle, jobDescription, requiredSkills } = body;

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: "Resume text and job description required" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

    // Try FastAPI
    try {
      const res = await fetch(`${apiUrl}/ats-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_title: jobTitle,
          job_description: jobDescription,
          required_skills: requiredSkills,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (fetchErr) {
      console.warn("FastAPI not available, using local ATS scoring");
    }

    // Fallback: local ATS scoring
    const result = calculateATSLocally(resumeText, jobDescription, requiredSkills || []);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("ATS score error:", err);
    return NextResponse.json(
      { error: err.message || "ATS scoring failed" },
      { status: 500 }
    );
  }
}

function calculateATSLocally(
  resumeText: string,
  jobDescription: string,
  requiredSkills: string[]
) {
  const resumeLower = resumeText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  // Extract keywords from JD
  const techKeywords = [
    "python", "javascript", "typescript", "react", "node.js", "express",
    "mongodb", "sql", "docker", "kubernetes", "aws", "gcp", "azure",
    "git", "langgraph", "crewai", "langchain", "fastapi", "next.js",
    "rest api", "graphql", "ci/cd", "linux", "machine learning",
    "deep learning", "rag", "llm", "prompt engineering", "ai agents",
    "multi-agent", "tensorflow", "pytorch", "go", "golang", "rust",
    "java", "kotlin", "redis", "postgresql", "mysql", "oauth",
    "saml", "scim", "terraform", "ansible", "microservices",
    "mcp", "agent orchestration", "vector database", "embeddings",
  ];

  // Find keywords present in JD
  const jdKeywords = techKeywords.filter((kw) => jdLower.includes(kw));
  // Add required skills
  const allRequired = [...new Set([...jdKeywords, ...requiredSkills.map((s) => s.toLowerCase())])];

  // Check which are in resume
  const matched = allRequired.filter((kw) => resumeLower.includes(kw));
  const missing = allRequired.filter((kw) => !resumeLower.includes(kw));

  const keywordMatchPercent = allRequired.length > 0
    ? Math.round((matched.length / allRequired.length) * 100)
    : 50;

  // Section analysis
  const hasSkillsSection = /skills|technical|technologies/i.test(resumeText);
  const hasExperienceSection = /experience|employment|work/i.test(resumeText);
  const hasEducationSection = /education|degree|university/i.test(resumeText);

  const skillsScore = Math.min(100, keywordMatchPercent + (hasSkillsSection ? 10 : 0));
  const experienceScore = hasExperienceSection ? Math.min(100, 50 + matched.length * 5) : 30;
  const educationScore = hasEducationSection ? 75 : 40;

  const overallScore = Math.round(
    skillsScore * 0.5 + experienceScore * 0.35 + educationScore * 0.15
  );

  // Recommendations
  const recommendations: string[] = [];
  if (missing.length > 0) {
    recommendations.push(
      `Add these keywords to your resume: ${missing.slice(0, 5).join(", ")}`
    );
  }
  if (!hasSkillsSection) {
    recommendations.push("Add a dedicated 'Technical Skills' section");
  }
  if (keywordMatchPercent < 60) {
    recommendations.push("Your keyword match is below 60% — tailor your resume more closely to this role");
  }
  if (keywordMatchPercent >= 70) {
    recommendations.push("Good keyword alignment — focus on quantifying your achievements");
  }

  return {
    overallScore,
    keywordMatchPercent,
    matchedKeywords: matched,
    missingKeywords: missing,
    sectionScores: {
      skills: skillsScore,
      experience: experienceScore,
      education: educationScore,
    },
    recommendations,
  };
}
