import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { resumeText } = await req.json();
  const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

  try {
    const res = await fetch(`${apiUrl}/parse-resume-precise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_text: resumeText }),
      signal: AbortSignal.timeout(60000),
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {
    // Fall through to local parsing
  }

  // Fallback: use local parsing from resume text
  return NextResponse.json(parseLocally(resumeText));
}

function parseLocally(text: string) {
  // Basic local parser as fallback
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\+?[\d\s\-().]{10,17})/);
  const linkedinMatch = text.match(/linkedin\.com\/in\/([\w-]+)/i);
  const githubMatch = text.match(/github\.com\/([\w-]+)/i);

  // Extract name from first line
  let name = lines[0] || "";
  if (name.includes("@") || name.includes("http")) name = "";

  return {
    contact: {
      name: name.replace(/[#*_`]/g, "").trim(),
      email: emailMatch?.[0] || "",
      phone: phoneMatch?.[1]?.trim() || "",
      linkedin: linkedinMatch ? `linkedin.com/in/${linkedinMatch[1]}` : "",
      github: githubMatch ? `github.com/${githubMatch[1]}` : "",
      portfolio: "",
    },
    summary: "",
    experience: [],
    education: [],
    skills: [{ name: "Technical Skills", skills: [] }],
    projects: [],
    certifications: [],
    languages: [],
  };
}
