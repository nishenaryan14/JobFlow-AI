import { NextRequest, NextResponse } from "next/server";

// ── Common tech keywords for smarter extraction ────────────────────────────────
const TECH_KEYWORDS = new Set([
  "python", "javascript", "typescript", "java", "go", "golang", "rust", "c++",
  "c#", "ruby", "php", "swift", "kotlin", "scala", "r", "sql", "nosql",
  "react", "angular", "vue", "next.js", "nextjs", "node.js", "nodejs", "express",
  "django", "flask", "fastapi", "spring", "rails",
  "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
  "terraform", "ansible", "jenkins", "ci/cd", "github actions",
  "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "dynamodb",
  "kafka", "rabbitmq", "graphql", "rest", "grpc", "microservices",
  "machine learning", "deep learning", "nlp", "computer vision", "pytorch",
  "tensorflow", "langchain", "langgraph", "openai", "llm", "llms",
  "git", "linux", "agile", "scrum", "jira", "figma", "tableau",
  "html", "css", "tailwind", "sass", "webpack", "vite",
  "api", "oauth", "jwt", "sso", "rbac", "security",
  "testing", "jest", "pytest", "cypress", "selenium", "unit testing",
  "data analysis", "data engineering", "etl", "data pipeline",
  "communication", "leadership", "problem-solving", "teamwork",
  "project management", "stakeholder management",
]);

const STOP_WORDS = new Set([
  "the", "you", "your", "they", "them", "he", "she", "it", "we", "our", "us",
  "what", "who", "whom", "this", "that", "these", "those", "here", "there",
  "which", "whose", "where", "when", "why", "how", "all", "any", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "can", "will", "just", "should",
  "now", "would", "could", "must", "with", "without", "about", "into", "through",
  "during", "before", "after", "above", "below", "like", "sets", "apart", "join",
  "help", "work", "client", "opportunity", "associate", "firm", "brand", "role",
  "team", "needs", "scope", "value", "success", "pwc", "acceleration", "center",
  "india", "learn", "grow", "every", "experience", "years", "degree", "bachelor",
  "bachelors", "english", "written", "oral", "proficiency", "required", "related",
  "field", "science", "engineering", "statistics", "mathematics", "computer",
  "advisory", "assurance", "tax", "business", "services", "data", "analytics",
  "opportunites", "fast-paced", "environment", "solutions", "insights", "datasets",
  "decision-making", "problems", "projects", "knowledge", "deliver", "quality",
  "inspiring", "makes", "difference", "day", "focus", "utilizing", "advanced",
  "analytical", "techniques", "extract", "drive", "practice", "leverage",
  "manipulation", "visualization", "statistical", "modeling", "support",
  "curiosity", "contributing", "engagement", "build", "exposed", "connections",
  "manage", "inspire", "others", "personal", "deepening", "resources", "technology",
  "adapt", "variety", "members", "presents", "challenges", "ownership",
  "consistently", "delivering", "doors", "navigate", "ambiguity", "embracing",
  "moments", "responsibilities", "algorithmic", "processes", "engaging",
  "research", "innovation", "optimize", "operations", "implementing", "machine",
  "predictive", "capabilities", "programming", "automation", "tasks", "gathering",
  "discern", "patterns", "inform", "strategies", "must", "sets", "apart", "gcp",
  "sas", "predictive", "building", "deploying", "contribute", "interfaces",
  "frameworks", "equivalent", "develop", "apis", "serve", "users", "familiarity",
  "containerized", "workflows", "demonstrating", "software", "derive", "actionable",
  "development", "processing", "adapting", "diverse", "client's", "client portfolio",
  "global", "global teams", "connected", "collaboration", "hands-on", "learning",
  "cutting-edge", "tools", "inclusive", "culture", "inspiring work", "makes a difference"
]);

interface ResumeData {
  contact?: { name?: string };
  summary?: string;
  experience?: Array<{ title?: string; company?: string; bullets?: string[] }>;
  education?: Array<{ degree?: string; institution?: string }>;
  skills?: Array<{ name?: string; skills?: string[] }>;
  projects?: Array<{ name?: string; description?: string; technologies?: string[]; bullets?: string[] }>;
  certifications?: string[];
}

function extractJDKeywords(jd: string): Array<{ keyword: string; importance: string }> {
  const lower = jd.toLowerCase();
  const keywords: Array<{ keyword: string; importance: string; count: number }> = [];

  // Check each known tech keyword
  for (const kw of TECH_KEYWORDS) {
    // Use word boundary-like matching
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      const importance = matches.length >= 3 ? "critical" : matches.length >= 2 ? "important" : "nice_to_have";
      keywords.push({ keyword: kw, importance, count: matches.length });
    }
  }



  // Sort by count descending
  keywords.sort((a, b) => b.count - a.count);
  return keywords.slice(0, 30).map(({ keyword, importance }) => ({ keyword, importance }));
}

function getResumeText(resumeData: ResumeData): string {
  const parts: string[] = [];
  if (resumeData.summary) parts.push(resumeData.summary);
  for (const exp of resumeData.experience || []) {
    if (exp.title) parts.push(exp.title);
    if (exp.company) parts.push(exp.company);
    for (const b of exp.bullets || []) parts.push(b);
  }
  for (const cat of resumeData.skills || []) {
    for (const s of cat.skills || []) parts.push(s);
  }
  for (const proj of resumeData.projects || []) {
    if (proj.name) parts.push(proj.name);
    if (proj.description) parts.push(proj.description);
    for (const t of proj.technologies || []) parts.push(t);
    for (const b of proj.bullets || []) parts.push(b);
  }
  for (const cert of resumeData.certifications || []) parts.push(cert);
  for (const edu of resumeData.education || []) {
    if (edu.degree) parts.push(edu.degree);
    if (edu.institution) parts.push(edu.institution);
  }
  return parts.join(" ").toLowerCase();
}

function analyzeGapsLocally(resumeData: ResumeData, jobDescription: string) {
  const jdKeywords = extractJDKeywords(jobDescription);
  const resumeText = getResumeText(resumeData);

  const matched: string[] = [];
  const suggestions: Array<{
    keyword: string;
    importance: string;
    section: string;
    suggestion: string;
    reasoning: string;
    rephrase_target: string;
    rephrase_result: string;
    action_type: string;
  }> = [];

  for (const { keyword, importance } of jdKeywords) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(resumeText)) {
      matched.push(keyword);
    } else {
      // Determine which section to suggest adding to
      const isTechSkill = TECH_KEYWORDS.has(keyword);
      const section = isTechSkill ? "skills" : "experience";
      
      suggestions.push({
        keyword,
        importance,
        section,
        suggestion: isTechSkill
          ? `Add "${keyword}" to your skills section to match the job requirements.`
          : `Mention "${keyword}" in your experience or summary to strengthen your application.`,
        reasoning: `This keyword appears in the job description but is not found in your resume. ${
          importance === "critical" ? "It is heavily emphasized in the JD." :
          importance === "important" ? "It is mentioned multiple times." :
          "It would be a nice addition."
        }`,
        rephrase_target: "",
        rephrase_result: "",
        action_type: "add",
      });
    }
  }

  const total = matched.length + suggestions.length;
  const matchPercentage = total > 0 ? Math.round((matched.length / total) * 100) : 0;

  return {
    suggestions,
    jd_keywords: jdKeywords.map(k => k.keyword),
    matched_keywords: matched,
    match_percentage: matchPercentage,
  };
}

export async function POST(req: NextRequest) {
  const { resumeData, jobDescription } = await req.json();
  const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

  // Try AI backend first
  try {
    const res = await fetch(`${apiUrl}/analyze-ats-gaps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_data: resumeData,
        job_description: jobDescription,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.error) return NextResponse.json(data);
    }
  } catch {
    // Fall through to local analysis
  }

  // Local fallback — keyword matching without AI
  console.log("[studio/gaps] AI backend unavailable, using local keyword analysis");
  const result = analyzeGapsLocally(resumeData, jobDescription);
  return NextResponse.json(result);
}
