import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";

import mongoose from "mongoose";

// GET: fetch existing jobs + merge application status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    await connectDB();

    if (id) {
      let job = null;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        job = await Job.findById(id).lean();
      } else {
        const rawCollection = mongoose.connection.db?.collection("jobs");
        if (rawCollection) {
          job = await rawCollection.findOne({ _id: id });
        }
      }
      if (job) {
        // Check if user has an application for this job
        const app = await Application.findOne({ jobId: String(job._id) }).lean();
        return NextResponse.json({
          job: { ...job, applicationStatus: app?.status || null },
        });
      }
      return NextResponse.json({ job: null });
    }

    // Fetch all jobs
    const jobs = await Job.find().sort({ fitScore: -1 }).limit(50).lean();

    // Fetch all applications to cross-reference
    const applications = await Application.find({}, "jobId status").lean();
    const appMap = new Map<string, string>();
    for (const app of applications) {
      appMap.set(String(app.jobId), app.status);
    }

    // Merge application status into each job
    const jobsWithStatus = jobs.map((j) => ({
      ...j,
      applicationStatus: appMap.get(String(j._id)) || null,
    }));

    return NextResponse.json({ jobs: jobsWithStatus });
  } catch (err) {
    console.error("Jobs fetch error:", err);
    // MongoDB not configured — return empty so the POST trigger fires
    return NextResponse.json({ jobs: [] });
  }
}

// POST: trigger job search via FastAPI or return mock data
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText } = body;

    const apiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

    // Try FastAPI first
    try {
      const res = await fetch(`${apiUrl}/search-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeText }),
        signal: AbortSignal.timeout(300000), // 5 min timeout for crew
      });

      if (res.ok) {
        const data = await res.json();
        // Save jobs to MongoDB (with dedup by title+company)
        await connectDB();
        const savedJobs = [];
        for (const job of data.jobs || []) {
          const saved = await Job.findOneAndUpdate(
            { title: job.title, company: job.company },
            { $set: job, $setOnInsert: { scrapedAt: new Date() } },
            { upsert: true, new: true }
          );
          savedJobs.push(saved);
        }
        return NextResponse.json({ jobs: savedJobs });
      }
    } catch (fetchErr) {
      console.warn("FastAPI not available, using demo data");
    }

    // Try MongoDB for cached jobs
    try {
      await connectDB();
      const existingJobs = await Job.find().sort({ fitScore: -1 }).limit(50);
      if (existingJobs.length > 0) {
        return NextResponse.json({ jobs: existingJobs });
      }
      // Seed demo data into MongoDB (with dedup)
      const demoJobs = getDemoJobs();
      const saved = [];
      for (const job of demoJobs) {
        const s = await Job.findOneAndUpdate(
          { title: job.title, company: job.company },
          { $set: job, $setOnInsert: { scrapedAt: new Date() } },
          { upsert: true, new: true }
        );
        saved.push(s);
      }
      return NextResponse.json({ jobs: saved });
    } catch {
      // MongoDB not configured yet — return demo data directly without DB
      return NextResponse.json({ jobs: getDemoJobs().map((j, i) => ({ ...j, _id: `demo_${i}` })) });
    }
  } catch (err: any) {
    console.error("Job search error:", err);
    return NextResponse.json(
      { error: err.message || "Job search failed" },
      { status: 500 }
    );
  }
}

function getDemoJobs() {
  return [
    {
      title: "AI/ML Engineer (AI Agent Engineer)",
      company: "ASSYST, Inc.",
      location: "Remote",
      remotePolicy: "Fully Remote",
      salaryRange: "Not Listed",
      requiredSkills: ["LangGraph", "CrewAI", "AutoGPT", "RAG", "Python", "LLM APIs"],
      experienceLevel: "4+ years",
      description: "Build multi-agent AI workflows using LangGraph, CrewAI, and AutoGPT. Design RAG architectures and AI governance frameworks.",
      applicationUrl: "https://jobs.lever.co/leverhq/bb79dfeb-e1ff-484d-bea3-455b85a3c9be",
      agenticRelevance: "High",
      fitScore: 9,
      matchingSkills: ["LangGraph", "CrewAI", "RAG", "Python", "Multi-agent workflows"],
      skillGaps: ["4+ years AI/ML experience", "AI governance", "MCP"],
      applicationTip: "Lead with 'Architected and implemented multi-agent AI systems' from your Ascendion experience.",
    },
    {
      title: "AI Agent Engineer",
      company: "Redpanda Data",
      location: "Poland (Remote)",
      remotePolicy: "Fully Remote",
      salaryRange: "Not Listed",
      requiredSkills: ["Agentic workflows", "Python", "Git", "Testing", "Data pipelines"],
      experienceLevel: "Mid-Senior",
      description: "Design, develop, and maintain AI agents and agentic workflows for data streaming platform.",
      applicationUrl: "https://boards.greenhouse.io/greenhouse/jobs/5201633003",
      agenticRelevance: "High",
      fitScore: 8,
      matchingSkills: ["Agentic workflows", "Python", "Git", "Testing"],
      skillGaps: ["Redpanda ADP", "Security logging", "Data access patterns"],
      applicationTip: "Frame your Ascendion work as identifying and automating AI automation opportunities.",
    },
    {
      title: "AI/ML Engineer",
      company: "Greenlight Financial Technology",
      location: "Remote US",
      remotePolicy: "Fully Remote",
      salaryRange: "Not Listed",
      requiredSkills: ["Multi-agent orchestration", "LangGraph", "RAG", "Python", "Prompt Engineering", "Node.js"],
      experienceLevel: "Senior",
      description: "Design and deploy production AI agents for financial education platform. Multi-agent orchestration and RAG.",
      applicationUrl: "https://example.com/apply/greenlight",
      agenticRelevance: "High",
      fitScore: 8,
      matchingSkills: ["Multi-agent orchestration", "LangGraph", "RAG", "Python", "Prompt Engineering"],
      skillGaps: ["JVM languages", "Cloud platforms", "Databricks"],
      applicationTip: "Create a parallel between your Ascendion multi-agent work and Greenlight's financial AI agents.",
    },
    {
      title: "Staff AI Engineer - MCP Services",
      company: "Datadog",
      location: "New York (Remote)",
      remotePolicy: "Hybrid/Remote",
      salaryRange: "$180k-$260k",
      requiredSkills: ["LangGraph", "CrewAI", "Agent orchestration", "Evaluation", "MCP"],
      experienceLevel: "Staff",
      description: "Build MCP servers and public-facing agent tools. Design advanced evaluation pipelines for LLM-powered automation.",
      applicationUrl: "https://example.com/apply/datadog",
      agenticRelevance: "High",
      fitScore: 8,
      matchingSkills: ["LangGraph", "CrewAI", "Agent orchestration", "Evaluation"],
      skillGaps: ["Staff-level seniority", "MCP standard", "Leadership experience"],
      applicationTip: "Position your multi-agent job search project as a precursor to working on MCP servers.",
    },
    {
      title: "AI Agent Engineer",
      company: "Lumos",
      location: "Remote US",
      remotePolicy: "Fully Remote",
      salaryRange: "$150k-$200k",
      requiredSkills: ["LangGraph", "Python", "TypeScript", "React", "API design", "Go"],
      experienceLevel: "5+ years",
      description: "Build composable agent SDKs with safety and fallback strategies for identity management platform.",
      applicationUrl: "https://example.com/apply/lumos",
      agenticRelevance: "High",
      fitScore: 7,
      matchingSkills: ["LangGraph", "Python", "TypeScript", "React", "API design"],
      skillGaps: ["5+ years scaling production", "Go", "SCIM/OAuth2/SAML"],
      applicationTip: "Highlight enterprise documentation integration from Ascendion to demonstrate secure data system experience.",
    },
    {
      title: "Senior Forward Deployed Engineer (AI Agent)",
      company: "Cresta",
      location: "Remote US",
      remotePolicy: "Fully Remote",
      salaryRange: "Not Listed",
      requiredSkills: ["Python", "AI agent frameworks", "Prompt Engineering", "RAG", "Golang"],
      experienceLevel: "Senior (3+ years)",
      description: "Build AI agent integrations with external systems. Customer-facing role optimizing AI agent performance.",
      applicationUrl: "https://example.com/apply/cresta",
      agenticRelevance: "High",
      fitScore: 7,
      matchingSkills: ["Python", "AI agent frameworks", "Prompt Engineering", "RAG"],
      skillGaps: ["Senior (3+ yrs) experience", "Golang", "Cloud platforms"],
      applicationTip: "Stress the 'configure' and 'optimize' aspects of your Ascendion work for agent performance tuning.",
    },
    {
      title: "AI Automation Engineer & Architect",
      company: "Bold Business",
      location: "Remote",
      remotePolicy: "Fully Remote",
      salaryRange: "Not Listed",
      requiredSkills: ["LangGraph", "RAG", "Python", "FastAPI", "TypeScript", "AWS/GCP"],
      experienceLevel: "8+ years",
      description: "Design multi-step agentic workflows with state machines. Deep AWS/GCP and event-driven architecture.",
      applicationUrl: "https://example.com/apply/bold",
      agenticRelevance: "High",
      fitScore: 7,
      matchingSkills: ["LangGraph", "RAG", "Python", "FastAPI", "TypeScript"],
      skillGaps: ["8+ years experience", "AWS/GCP depth", "Terraform", "Event-driven architecture"],
      applicationTip: "Structure your experience bullet points to mirror their key responsibilities.",
    },
    {
      title: "Senior AI Agent Engineer (Microsoft Stack)",
      company: "CodeRoad",
      location: "Remote",
      remotePolicy: "Fully Remote",
      salaryRange: "Not Listed",
      requiredSkills: ["Azure AI", "Microsoft Graph", "Entra ID", "Semantic Kernel", "LangGraph", "Python"],
      experienceLevel: "5+ years",
      description: "Architect multi-agent workflows on Microsoft ecosystem including Azure AI Foundry and Semantic Kernel.",
      applicationUrl: "https://example.com/apply/coderoad",
      agenticRelevance: "Medium",
      fitScore: 6,
      matchingSkills: ["LangGraph", "Multi-agent workflows", "Python"],
      skillGaps: ["Microsoft ecosystem", "Azure AI", "Entra ID", "Semantic Kernel"],
      applicationTip: "Pivot the conversation to your fundamental multi-agent architecture skills as a foundation for Microsoft's stack.",
    },
    {
      title: "Agentic AI Engineer",
      company: "Netomi",
      location: "Remote",
      remotePolicy: "Fully Remote",
      salaryRange: "Not Listed",
      requiredSkills: ["JavaScript", "Python", "Node.js", "SaaS", "Salesforce", "Solution Architecture"],
      experienceLevel: "4-8 years PM",
      description: "Technical project manager/solutions consultant for SaaS platform configurations.",
      applicationUrl: "https://example.com/apply/netomi",
      agenticRelevance: "Low",
      fitScore: 4,
      matchingSkills: ["JavaScript", "Python", "Node.js"],
      skillGaps: ["4-8 years PM experience", "SaaS configuration", "Solution architecture"],
      applicationTip: "Only apply if seeking a pivot towards customer-facing solution architecture.",
    },
    {
      title: "Agentic AI Engineer - Talent Pipeline",
      company: "Atmosera",
      location: "Remote",
      remotePolicy: "Fully Remote",
      salaryRange: "Not Listed",
      requiredSkills: ["Microsoft Power Platform", "Copilot Studio", "Power Automate", "Data governance"],
      experienceLevel: "Senior",
      description: "Enterprise deployment of Microsoft Power Platform and Copilot Studio solutions.",
      applicationUrl: "https://example.com/apply/atmosera",
      agenticRelevance: "Low",
      fitScore: 3,
      matchingSkills: ["API integration concepts"],
      skillGaps: ["Power Platform", "Copilot Studio", "Enterprise deployment", "Data governance"],
      applicationTip: "Not recommended to apply — gap is too large. Focus on roles matching your core technical stack.",
    },
  ];
}
