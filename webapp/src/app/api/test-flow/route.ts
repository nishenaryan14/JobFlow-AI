import { NextRequest, NextResponse } from "next/server";

// Test endpoint: GET /api/test-analyze?redirect=true
// Injects a test resume into sessionStorage and redirects to /analyze
export async function GET(req: NextRequest) {
  const html = `<!DOCTYPE html>
<html>
<head><title>JobFlow Test</title></head>
<body>
<script>
const resumeText = \`# Aryan Nishen
Phone: +91-9876543210 | Email: aryan@example.com | LinkedIn: linkedin.com/in/aryan

## Summary
Senior AI Agent Engineer with 4 years experience building production-grade multi-agent systems. Expert in LangGraph, CrewAI, and RAG pipelines deployed on AWS.

## Experience

### Senior AI Agent Engineer
Ascendion Inc
2021 - Present
- Architected 20+ LangGraph agentic workflows processing 1M+ documents/day
- Built CrewAI multi-agent systems with DeepSeek and OpenAI LLMs
- Deployed RAG pipelines using Pinecone and MongoDB vector search on AWS
- CI/CD pipelines with GitHub Actions and Docker

### Full Stack Developer
Tech Solutions Pvt Ltd
2020 - 2021
- Built React + TypeScript frontend applications
- Node.js microservices with PostgreSQL and MongoDB
- Deployed on AWS EC2 with Nginx

## Skills
Python, LangGraph, CrewAI, LangChain, RAG, Prompt Engineering, AI Agents, Multi-Agent, LLM, FastAPI, React, TypeScript, Node.js, MongoDB, PostgreSQL, Docker, AWS, Git, GitHub Actions, Pinecone, Redis

## Education
B.Tech Computer Science - VIT University 2020

## Projects
JobFlow AI - Full-stack AI Career Platform using CrewAI
RAG Document Intelligence - Enterprise document Q&A system
Multi-Agent Research Assistant - Automated research with LangGraph\`;

sessionStorage.setItem('resumeText', resumeText);
sessionStorage.setItem('resumeFileName', 'aryan_nishen_resume.pdf');
window.location.href = '/analyze';
</script>
<p>Loading test resume and redirecting to /analyze...</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
