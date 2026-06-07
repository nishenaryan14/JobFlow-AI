"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScanSearch, Target, BarChart3, Sparkles, Cpu, Layers, Activity } from "lucide-react";
import ResumeDropzone from "@/components/ResumeDropzone";

const features = [
  {
    icon: ScanSearch,
    title: "AI Resume Analysis",
    description:
      "Instantly parse, evaluate, and score your resume with intelligent analysis",
  },
  {
    icon: Target,
    title: "Smart Job Matching",
    description:
      "Discovers and ranks jobs based on your unique skills and experience",
  },
  {
    icon: BarChart3,
    title: "ATS Score Check",
    description:
      "Get a real ATS compatibility score for any job description instantly",
  },
  {
    icon: Sparkles,
    title: "Resume Enhancement",
    description:
      "AI-powered resume rewriting tailored to match specific job requirements",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [, setLoaded] = useState(false);

  const handleFileAccepted = async (file: File, text: string, sessionId: string | null) => {
    sessionStorage.setItem("resumeText", text);
    sessionStorage.setItem("resumeFileName", file.name);

    if (sessionId) {
      sessionStorage.setItem("resumeSessionId", sessionId);
    } else {
      sessionStorage.removeItem("resumeSessionId");
    }

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
      <div className="hero-columns-container" suppressHydrationWarning>
        {/* Hero Left Side: Content & Dropzone */}
        <section className="hero-left-section">
          <h1>
            Your AI-Powered
            <br />
            <span className="gradient-text">Career Command Center</span>
          </h1>
          <p className="subtitle">
            Drop your resume and let our autonomous AI agents crawl job boards, evaluate matching positions, score ATS alignment, and tailor your profile — all in one centralized hub.
          </p>

          <div style={{ marginTop: 28, maxWidth: "560px" }}>
            <ResumeDropzone onFileAccepted={handleFileAccepted} />
          </div>
        </section>

        {/* Hero Right Side: Floating Unity-style Dashboard Visuals */}
        <section className="hero-right-visuals desktop-only">
          <div className="visual-wrapper">
            <div className="neon-orb" />
            
            {/* Widget 1: Agent Telemetry (Drifting) */}
            <div className="floating-widget card-1 animate-float">
              <div className="widget-header">
                <span className="widget-icon"><Cpu size={14} /></span>
                <span>Agent Telemetry</span>
                <span className="status-dot green" />
              </div>
              <div className="widget-body">
                <div className="metric-row">
                  <span>ATS Match Rate</span>
                  <strong style={{ color: "#22c55e" }}>94%</strong>
                </div>
                <div className="metric-bar-bg">
                  <div className="metric-bar-fill" style={{ width: "94%" }} />
                </div>
              </div>
            </div>

            {/* Widget 2: Live Crawl Matches */}
            <div className="floating-widget card-2 animate-float-delayed">
              <div className="widget-header">
                <span className="widget-icon"><Activity size={14} /></span>
                <span>Job Discovery Node</span>
              </div>
              <div className="widget-body">
                <span className="discovery-count">31</span>
                <span className="discovery-lbl">Matched jobs processed</span>
              </div>
            </div>

            {/* Widget 3: Architecture Blueprint Card */}
            <div className="floating-widget card-3 animate-float">
              <div className="widget-header">
                <span className="widget-icon"><Layers size={14} /></span>
                <span>Pipeline Engine</span>
              </div>
              <div className="widget-body">
                <div className="bp-line active"><span>• parse_resume</span><span>100%</span></div>
                <div className="bp-line active"><span>• match_and_rank</span><span>100%</span></div>
                <div className="bp-line active"><span>• persist_mongodb</span><span>ok</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="features-grid stagger-enter">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="feature-card glass-card">
              <span className="feature-icon">
                <Icon size={28} strokeWidth={1.5} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          );
        })}
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
                  \u2192
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
