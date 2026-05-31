import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { resumeText } = await req.json();

    if (!resumeText) {
      return NextResponse.json(
        { error: "No resume text provided" },
        { status: 400 }
      );
    }

    // STEP 1: Always run local parser — fast, reliable for structure
    const localAnalysis = parseResumeLocally(resumeText);

    // STEP 2: Try to enrich with LangGraph pipeline for deeper qualitative analysis
    const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${apiUrl}/analyze-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeText }),
        signal: AbortSignal.timeout(60000),
      });

      if (res.ok) {
        const aiData = await res.json();

        // Merge AI results carefully:
        // - Prefer local parser for contact info (more regex-accurate)
        // - Prefer AI for skills, strengths, weaknesses, score, summary
        // - For experience/education: use whichever has more entries
        const merged = {
          // Contact: always use local (AI sometimes hallucinates these)
          name: localAnalysis.name !== "Candidate" ? localAnalysis.name : (aiData.name || localAnalysis.name),
          email: localAnalysis.email || aiData.email || "",
          phone: localAnalysis.phone || aiData.phone || "",
          linkedin: localAnalysis.linkedin || aiData.linkedin || "",

          // Skills: merge both sources — AI often finds more
          skills: mergeUnique(aiData.skills, localAnalysis.skills),
          strongSkills: mergeUnique(aiData.strongSkills, localAnalysis.strongSkills).slice(0, 8),
          skillsByCategory: localAnalysis.skillsByCategory,

          // Experience: use whichever yielded more entries
          experience: (aiData.experience?.length || 0) >= (localAnalysis.experience?.length || 0)
            ? (aiData.experience || localAnalysis.experience)
            : localAnalysis.experience,

          // Education: merge both
          education: mergeUnique(aiData.education, localAnalysis.education),

          // Projects: merge both
          projects: mergeUnique(aiData.projects, localAnalysis.projects),

          // Qualitative (prefer AI if it delivered real content)
          strengths: hasRealContent(aiData.strengths)
            ? mergeUnique(aiData.strengths, localAnalysis.strengths).slice(0, 6)
            : localAnalysis.strengths,
          weaknesses: hasRealContent(aiData.weaknesses)
            ? mergeUnique(aiData.weaknesses, localAnalysis.weaknesses).slice(0, 5)
            : localAnalysis.weaknesses,

          // Score: prefer AI if it's not a default value
          overallScore: (aiData.overallScore && aiData.overallScore !== 7)
            ? aiData.overallScore
            : localAnalysis.overallScore,

          // Summary: prefer longer/richer one
          summary: (aiData.summary && aiData.summary.length > 60)
            ? aiData.summary
            : localAnalysis.summary,

          totalYearsExp: localAnalysis.totalYearsExp,
          _engine: "langgraph+local",
        };

        // Save to MongoDB
        await saveToMongo(resumeText, merged);
        return NextResponse.json(merged);
      }
    } catch {
      // FastAPI unavailable — local analysis is sufficient
    }

    // Save to MongoDB (local-only path)
    await saveToMongo(resumeText, localAnalysis);
    return NextResponse.json({ ...localAnalysis, _engine: "local" });

  } catch (err: any) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: err.message || "Analysis failed" },
      { status: 500 }
    );
  }
}

function mergeUnique(arr1: any[], arr2: any[]): any[] {
  if (!arr1 && !arr2) return [];
  if (!arr1) return arr2 || [];
  if (!arr2) return arr1 || [];
  const seen = new Set<string>();
  const result: any[] = [];
  for (const item of [...arr1, ...arr2]) {
    const key = typeof item === "string" ? item.toLowerCase() : JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function hasRealContent(arr: string[] | undefined): boolean {
  if (!arr || arr.length === 0) return false;
  const junk = ["technical profile analyzed", "further analysis available", "run with crewai"];
  return arr.some(s => !junk.some(j => s.toLowerCase().includes(j)));
}

async function saveToMongo(resumeText: string, data: any) {
  try {
    const { connectDB } = await import("@/lib/mongodb");
    const { Resume } = await import("@/models/Resume");
    await connectDB();
    await Resume.findOneAndUpdate(
      { rawText: resumeText },
      {
        parsedData: {
          name: data.name,
          email: data.email,
          skills: data.skills,
          strongSkills: data.strongSkills,
          experience: data.experience,
          education: data.education,
        },
        analysis: {
          strengths: data.strengths,
          weaknesses: data.weaknesses,
          overallScore: data.overallScore,
          summary: data.summary,
        },
      },
      { upsert: true, new: true }
    );
  } catch {
    // Non-fatal — DB unavailable
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// LOCAL HEURISTIC PARSER — significantly improved
// ─────────────────────────────────────────────────────────────────────────────

function parseResumeLocally(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // ── STEP 1: Normalize the text ────────────────────────────────────────
  // PDFs often produce all-caps section headers. Normalize them to help parsing.
  // Do NOT lowercase the whole text — we need case for name extraction.

  // ── STEP 2: Name extraction ───────────────────────────────────────────
  let name = "Candidate";

  // Try markdown H1 first
  const h1Match = text.match(/^#\s+(.+)/m);
  if (h1Match) {
    name = h1Match[1].replace(/[*_`#]/g, "").trim();
  } else {
    // Check first 6 lines for a name-like pattern
    for (const line of lines.slice(0, 6)) {
      const clean = line.replace(/[*_`#\-|@.,:;()\[\]\/\\]/g, "").trim();
      const words = clean.split(/\s+/);
      if (
        words.length >= 2 && words.length <= 4 &&
        /^[A-Z]/.test(clean) &&
        words.every((w) => /^[A-Za-z'-]{1,20}$/.test(w)) &&
        !line.includes("@") &&
        !line.includes("http") &&
        !/\d/.test(clean) &&
        clean.length < 45
      ) {
        name = clean;
        break;
      }
    }
    // Fallback: use first non-empty line if short
    if (name === "Candidate") {
      const firstLine = lines[0]?.replace(/[*_`#]/g, "").trim() || "";
      if (firstLine.length > 2 && firstLine.length < 45 && !firstLine.includes("@") && !/^\d/.test(firstLine)) {
        name = firstLine;
      }
    }
  }

  // ── STEP 3: Contact info ──────────────────────────────────────────────
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : "";

  const phoneMatch = text.match(/(\+?[\d\s\-().]{10,17})/);
  const phone = phoneMatch
    ? phoneMatch[1].replace(/\s+/g, "").trim()
    : "";

  const linkedinMatch = text.match(/linkedin\.com\/in\/([\w-]+)/i);
  const linkedin = linkedinMatch ? `linkedin.com/in/${linkedinMatch[1]}` : "";

  const githubMatch = text.match(/github\.com\/([\w-]+)/i);
  const github = githubMatch ? `github.com/${githubMatch[1]}` : "";

  // ── STEP 4: Section splitting ─────────────────────────────────────────
  // Handle both plain-text (ALL CAPS / Title Case) and markdown (##) headers
  const sectionPatterns: Record<string, RegExp> = {
    summary:     /^(?:#{1,3}\s+)?(?:professional\s+)?(?:summary|objective|profile|about me|overview|introduction)\s*:?\s*$/i,
    skills:      /^(?:#{1,3}\s+)?(?:technical\s+)?(?:skills|technologies|tech stack|expertise|competencies|tools|capabilities)\s*:?\s*$/i,
    experience:  /^(?:#{1,3}\s+)?(?:work\s+)?(?:experience|employment|work history|positions?|career|professional experience|work experience)\s*:?\s*$/i,
    education:   /^(?:#{1,3}\s+)?(?:education|academic|degrees?|university|college|qualifications?|schooling)\s*:?\s*$/i,
    projects:    /^(?:#{1,3}\s+)?(?:projects?|portfolio|personal projects?|open[- ]source|work samples)\s*:?\s*$/i,
    certifications: /^(?:#{1,3}\s+)?(?:certif|licenses?|awards?|honors?|achievements?|accomplishments?)\s*:?\s*$/i,
  };

  const sections: Record<string, string[]> = {
    header: [], summary: [], skills: [], experience: [],
    education: [], projects: [], certifications: [],
  };
  let currentSection = "header";

  for (const line of lines) {
    let matched = false;
    for (const [key, pattern] of Object.entries(sectionPatterns)) {
      if (pattern.test(line) && line.length < 70) {
        currentSection = key;
        matched = true;
        break;
      }
    }
    if (!matched) {
      sections[currentSection] = sections[currentSection] || [];
      sections[currentSection].push(line);
    }
  }

  const secText = (key: string) => (sections[key] || []).join("\n");

  // ── STEP 5: Skills extraction ─────────────────────────────────────────
  const ALL_SKILLS: Record<string, string[]> = {
    languages: [
      "Python", "JavaScript", "TypeScript", "Java", "Go", "Golang", "Rust",
      "C++", "C#", "Ruby", "Swift", "Kotlin", "PHP", "Scala", "R", "Bash", "Shell", "Perl",
    ],
    frontend: [
      "React", "Next.js", "Vue.js", "Angular", "Svelte", "HTML", "CSS",
      "SASS", "Tailwind", "Material UI", "Chakra UI", "Vite", "D3.js",
      "Redux", "GraphQL", "Webpack", "jQuery",
    ],
    backend: [
      "Node.js", "Express", "FastAPI", "Django", "Flask", "Spring Boot",
      "REST API", "gRPC", "WebSockets", "Microservices", "NestJS", "Laravel",
      "Rails", "Hono",
    ],
    ai_ml: [
      "LangGraph", "CrewAI", "LangChain", "AutoGen", "OpenAI", "Anthropic",
      "DeepSeek", "LLM", "RAG", "Prompt Engineering", "AI Agents", "Multi-Agent",
      "Machine Learning", "Deep Learning", "NLP", "TensorFlow", "PyTorch",
      "Scikit-learn", "Hugging Face", "Vector Database", "Embeddings",
      "LlamaIndex", "Pinecone", "Weaviate", "Chroma", "FAISS",
      "Computer Vision", "Reinforcement Learning", "Fine-tuning",
    ],
    databases: [
      "MongoDB", "PostgreSQL", "MySQL", "Redis", "SQLite", "DynamoDB",
      "Supabase", "Firebase", "Elasticsearch", "SQL", "NoSQL", "Cassandra",
      "Neo4j", "Snowflake", "BigQuery", "Prisma",
    ],
    devops: [
      "Docker", "Kubernetes", "AWS", "GCP", "Azure", "CI/CD", "GitHub Actions",
      "Jenkins", "Terraform", "Ansible", "Linux", "Git", "GitHub", "GitLab",
      "Nginx", "Vercel", "Heroku", "CloudFormation", "Pulumi",
    ],
    tools: [
      "Pytest", "Jest", "Cypress", "Postman", "Jira", "Confluence",
      "Figma", "ESLint", "Chart.js", "Swagger", "k6", "Sentry",
    ],
  };

  const foundSkills: string[] = [];
  const skillsByCategory: Record<string, string[]> = {};

  for (const [category, skills] of Object.entries(ALL_SKILLS)) {
    const found = skills.filter((kw) => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, "i").test(text);
    });
    if (found.length) {
      foundSkills.push(...found);
      skillsByCategory[category] = found;
    }
  }

  // Strong skills: in skills section OR mentioned 2+ times in whole resume
  const skillsSecText = secText("skills").toLowerCase();
  const strongSkills = foundSkills.filter((s) => {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (text.match(new RegExp(escaped, "gi")) || []).length;
    return count >= 2 || skillsSecText.includes(s.toLowerCase());
  });

  // ── STEP 6: Experience parsing ────────────────────────────────────────
  const experience: { title: string; company: string; duration: string }[] = [];
  const expLines = sections.experience || [];

  if (expLines.length > 0) {
    // Strategy: look for lines containing job titles (often followed by company on next line)
    // Common patterns:
    //   Title at Company (2021 – 2023)
    //   Title | Company | 2021 – 2023
    //   Title\nCompany\nJan 2021 – Dec 2023

    const expRaw = expLines.join("\n");
    
    // Pattern A: Title | Company | Date (pipe-separated)
    const pipePattern = /^([^|\n]{5,60})\s*\|\s*([^|\n]{3,50})\s*\|\s*([^|\n]*(?:20\d\d|present|current)[^|\n]*)/gim;
    let m;
    while ((m = pipePattern.exec(expRaw)) !== null) {
      pushExp(experience, m[1], m[2], m[3]);
    }

    // Pattern B: "Title at Company, Date" on one line
    if (experience.length === 0) {
      const atPattern = /^(.{5,50})\s+at\s+(.{3,50}),?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d\d).{0,30})/gim;
      while ((m = atPattern.exec(expRaw)) !== null) {
        pushExp(experience, m[1], m[2], m[3]);
      }
    }

    // Pattern C: Consecutive lines — Title, then Company+Date together or next line
    if (experience.length === 0) {
      for (let i = 0; i < expLines.length - 1; i++) {
        const line = expLines[i];
        const nextLine = expLines[i + 1] || "";
        const afterLine = expLines[i + 2] || "";

        // Line looks like a job title: starts with capital, no date, not all-caps header
        const looksLikeTitle = /^[A-Z][a-zA-Z\s,./()-]{4,60}$/.test(line) 
          && !/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i.test(line)
          && line.split(" ").length >= 2
          && line.length < 70;

        const hasDate = /20\d\d|present|current/i.test(nextLine) || /20\d\d|present|current/i.test(afterLine);

        if (looksLikeTitle && hasDate) {
          const company = /20\d\d|present|current/i.test(nextLine) ? "" : nextLine;
          const duration = /20\d\d|present|current/i.test(nextLine) ? nextLine : afterLine;
          pushExp(experience, line, company, duration);
          i += company ? 2 : 1; // skip consumed lines
        }
      }
    }

    // Pattern D: Date ranges that mark entries (last resort)
    if (experience.length === 0) {
      const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d\d)[^.\n]{0,30}(?:–|—|-|to)\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d\d|present|current)/gi;
      const dateMatches = [...expRaw.matchAll(datePattern)];
      for (const dm of dateMatches) {
        const idx = dm.index!;
        const before = expRaw.slice(Math.max(0, idx - 150), idx);
        const beforeLines = before.split("\n").filter(l => l.trim().length > 0);
        const title = beforeLines[beforeLines.length - 1]?.trim() || "";
        const company = beforeLines[beforeLines.length - 2]?.trim() || "";
        if (title.length > 3 && title.length < 80) {
          pushExp(experience, title, company, dm[0]);
        }
      }
    }
  }

  function pushExp(arr: typeof experience, title: string, company: string, duration: string) {
    const t = title.replace(/[#*_`|]/g, "").trim();
    const c = company.replace(/[#*_`|]/g, "").trim();
    const d = duration.replace(/[#*_`|]/g, "").trim();
    // Deduplicate
    if (t.length > 3 && !arr.some(e => e.title.toLowerCase() === t.toLowerCase())) {
      arr.push({ title: t, company: c, duration: d });
    }
  }

  // Count years of experience from year spans found in the whole experience section
  const expRaw2 = (sections.experience || []).join("\n");
  const yearNums = [...expRaw2.matchAll(/20(\d\d)/g)].map(m => parseInt("20" + m[1])).filter(y => y >= 2000 && y <= new Date().getFullYear());
  const uniqueYears = [...new Set(yearNums)].sort();
  const totalYearsExp = uniqueYears.length >= 2
    ? Math.min(35, new Date().getFullYear() - uniqueYears[0])
    : 0;

  // ── STEP 7: Education parsing ─────────────────────────────────────────
  const education: string[] = [];
  const eduLines = sections.education || [];
  const eduRaw = eduLines.join("\n");

  if (eduRaw) {
    const degreePattern = /(Bachelor|Master|B\.?S\.?|M\.?S\.?|B\.?E\.?|M\.?Tech|B\.?Tech|PhD|MBA|Associate|Diploma|B\.?Sc|M\.?Sc|B\.?Com)[^\n]{0,100}/gi;
    const degreeMatches = [...eduRaw.matchAll(degreePattern)];
    for (const dm of degreeMatches) {
      const clean = dm[0].replace(/[#*_`]/g, "").trim();
      if (clean.length > 5 && !education.includes(clean)) {
        education.push(clean);
      }
    }

    // Also capture University/College lines
    const uniPattern = /(?:university|college|institute|school)\s+of[^\n]{0,80}/gi;
    const uniMatches = [...eduRaw.matchAll(uniPattern)];
    for (const um of uniMatches) {
      const clean = um[0].replace(/[#*_`]/g, "").trim();
      if (!education.some(e => e.toLowerCase().includes(clean.toLowerCase().slice(0, 20)))) {
        education.push(clean);
      }
    }

    // Fallback: first 3 lines that look meaningful
    if (education.length === 0) {
      for (const l of eduLines.slice(0, 5)) {
        if (l.length > 8 && l.length < 120) education.push(l.replace(/[#*_`]/g, "").trim());
      }
    }
  }

  // ── STEP 8: Projects ──────────────────────────────────────────────────
  const projects: string[] = [];
  const projLines = sections.projects || [];
  for (const line of projLines) {
    const clean = line.replace(/[#*_`\-•]/g, "").trim();
    if (clean.length > 5 && /^[A-Z]/.test(clean) && !projects.includes(clean)) {
      projects.push(clean);
    }
    if (projects.length >= 6) break;
  }

  // ── STEP 9: Summary ───────────────────────────────────────────────────
  const summaryText = (sections.summary || [])
    .map((l) => l.replace(/[#*_`]/g, "").trim())
    .filter((l) => l.length > 20)
    .slice(0, 3)
    .join(" ");

  // ── STEP 10: Strengths analysis ───────────────────────────────────────
  const strengths: string[] = [];

  const agenticSkills = ["LangGraph", "CrewAI", "LangChain", "AutoGen", "Multi-Agent", "AI Agents"];
  const hasAgentic = agenticSkills.filter((s) => foundSkills.includes(s));

  if (hasAgentic.length >= 2)
    strengths.push(`Rare agentic AI expertise: ${hasAgentic.join(", ")} — top 5% of candidates`);

  if ((skillsByCategory.ai_ml?.length || 0) >= 3)
    strengths.push(`Strong AI/ML stack: ${skillsByCategory.ai_ml!.slice(0, 4).join(", ")}`);
  else if ((skillsByCategory.ai_ml?.length || 0) >= 1)
    strengths.push(`AI/ML experience: ${skillsByCategory.ai_ml!.join(", ")}`);

  const hasFrontend = (skillsByCategory.frontend?.length || 0) >= 2;
  const hasBackend = (skillsByCategory.backend?.length || 0) >= 1;
  if (hasFrontend && hasBackend)
    strengths.push("Full-stack capability across frontend and backend");

  if ((skillsByCategory.languages?.length || 0) >= 3)
    strengths.push(`Polyglot developer: ${skillsByCategory.languages!.slice(0, 3).join(", ")}`);

  if (totalYearsExp >= 3)
    strengths.push(`${totalYearsExp}+ years of professional experience`);
  else if (experience.length >= 1)
    strengths.push(`${experience.length} documented professional role${experience.length > 1 ? "s" : ""}`);

  if (foundSkills.includes("Python") && (skillsByCategory.ai_ml?.length || 0) > 0)
    strengths.push("Python + AI/ML combination — highly in demand");

  const cloudSkills = (skillsByCategory.devops || []).filter(s => ["AWS", "GCP", "Azure"].includes(s));
  if (cloudSkills.length >= 1)
    strengths.push(`Cloud platform experience: ${cloudSkills.join(", ")}`);

  if (projects.length >= 2)
    strengths.push(`${projects.length} notable projects in portfolio`);

  // ── STEP 11: Weaknesses ───────────────────────────────────────────────
  const weaknesses: string[] = [];

  if (!foundSkills.some(s => ["Docker", "Kubernetes"].includes(s)))
    weaknesses.push("No containerization (Docker/Kubernetes) — critical for most senior engineering roles");

  if (cloudSkills.length === 0)
    weaknesses.push("Cloud platform skills missing (AWS/GCP/Azure) — add even basic exposure");

  if (!foundSkills.includes("CI/CD") && !foundSkills.includes("GitHub Actions"))
    weaknesses.push("CI/CD pipeline experience not listed — expected by most engineering teams");

  if (experience.length === 0)
    weaknesses.push("No work experience entries detected — ensure date ranges are clearly listed near job titles");

  if (!summaryText && !sections.summary?.length)
    weaknesses.push("No professional summary found — a 3-line summary can improve ATS pass rate by 15–20%");

  if (education.length === 0)
    weaknesses.push("Education section unclear or missing — many ATS systems require this");

  if (foundSkills.length < 8)
    weaknesses.push("Few technical keywords detected — explicitly list your tools, frameworks, and technologies");

  // ── STEP 12: Score ────────────────────────────────────────────────────
  const rawScore =
    Math.min(30, foundSkills.length * 1.5) +          // breadth of skills
    Math.min(20, (skillsByCategory.ai_ml?.length || 0) * 3) + // AI/ML depth
    Math.min(20, experience.length * 6 + (totalYearsExp > 0 ? 5 : 0)) + // experience
    Math.min(15, (hasFrontend ? 5 : 0) + (hasBackend ? 5 : 0) + ((skillsByCategory.devops?.length || 0) > 0 ? 5 : 0)) +
    (education.length > 0 ? 5 : 0) + (summaryText ? 5 : 0) + (email ? 2 : 0) +
    -weaknesses.length * 1.5;

  const overallScore = Math.min(10, Math.max(3, Math.round(rawScore / 10)));

  // ── STEP 13: Summary generation ───────────────────────────────────────
  const generatedSummary = summaryText ||
    `${name} is a ${totalYearsExp > 0 ? `${totalYearsExp}+ year` : "software"} professional with expertise in ${
      Object.keys(skillsByCategory).slice(0, 3).join(", ")
    }. ${hasAgentic.length > 0 ? `Specializes in agentic AI using ${hasAgentic.slice(0, 2).join(" and ")}.` : ""}${
      strengths.length > 0 ? ` Key strength: ${strengths[0]}.` : ""
    }`;

  return {
    name,
    email,
    phone,
    linkedin,
    github,
    skills: [...new Set(foundSkills)],
    strongSkills: [...new Set(strongSkills)],
    skillsByCategory,
    experience: experience.slice(0, 8),
    education: education.slice(0, 4),
    projects: projects.slice(0, 6),
    strengths: strengths.slice(0, 6),
    weaknesses: weaknesses.slice(0, 5),
    overallScore,
    summary: generatedSummary,
    totalYearsExp,
  };
}
