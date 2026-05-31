"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ResumeDropzone from "@/components/ResumeDropzone";

const features = [
  {
    icon: "🔬",
    title: "AI Resume Analysis",
    description:
      "LangGraph AI pipeline parses, evaluates, and scores your resume in seconds",
  },
  {
    icon: "🎯",
    title: "Smart Job Matching",
    description:
      "Discovers and ranks jobs based on your unique skills and experience",
  },
  {
    icon: "📊",
    title: "ATS Score Check",
    description:
      "Get a real ATS compatibility score for any job description instantly",
  },
  {
    icon: "✨",
    title: "Resume Enhancement",
    description:
      "AI-powered resume rewriting tailored to match specific job requirements",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [, setLoaded] = useState(false);

  const handleFileAccepted = async (file: File, text: string, sessionId: string | null) => {
    // Store the parsed resume text for the analysis page
    sessionStorage.setItem("resumeText", text);
    sessionStorage.setItem("resumeFileName", file.name);

    // Store the server-side session ID (Redis-backed, TTL 4h).
    // The jobs page will use this to call /stream-matches without resending
    // the full resume text in every SSE request.
    if (sessionId) {
      sessionStorage.setItem("resumeSessionId", sessionId);
    } else {
      // FastAPI was offline during upload — clear any stale session ID
      // so the jobs page knows to fall back to text-based matching.
      sessionStorage.removeItem("resumeSessionId");
    }

    // ── Clear ALL old job caches so new resume gets fresh results ──
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("jobMatchesCache_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));

    setLoaded(true);
    router.push("/analyze");
  };

  return (
    <>
      <section className="hero">
        <h1>
          Your AI-Powered
          <br />
          <span className="gradient-text">Career Command Center</span>
        </h1>
        <p className="subtitle">
          Drop your resume and let LangGraph pipelines analyze your profile, discover
          matching jobs, score your ATS compatibility, and enhance your resume —
          all in one place.
        </p>

        <ResumeDropzone onFileAccepted={handleFileAccepted} />
      </section>

      <section className="features-grid stagger-enter">
        {features.map((f) => (
          <div key={f.title} className="feature-card glass-card">
            <span className="feature-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.description}</p>
          </div>
        ))}
      </section>

      <section
        style={{
          textAlign: "center",
          padding: "60px 24px 80px",
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontSize: "var(--font-2xl)",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          How It Works
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
          A seamless AI-driven pipeline from resume to job offer
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {[
            "1. Upload Resume",
            "2. AI Analysis",
            "3. Job Matching",
            "4. ATS Scoring",
            "5. Enhance & Apply",
          ].map((step, i) => (
            <div
              key={step}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                className="glass-card"
                style={{
                  padding: "8px 18px",
                  fontSize: "var(--font-sm)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {step}
              </span>
              {i < 4 && (
                <span style={{ color: "var(--text-tertiary)", fontSize: 20 }}>
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
