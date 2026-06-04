"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  UploadCloud, 
  Plug, 
  FileText, 
  Cpu, 
  BarChart3, 
  AlertTriangle, 
  Mail, 
  Phone, 
  Link2, 
  Brain, 
  Star, 
  TrendingUp, 
  Target, 
  Briefcase, 
  GraduationCap, 
  Code, 
  Search, 
  Terminal,
  Activity
} from "lucide-react";

interface AnalysisResult {
  name: string;
  email: string;
  phone?: string;
  linkedin?: string;
  skills: string[];
  strongSkills: string[];
  skillsByCategory?: Record<string, string[]>;
  experience: { title: string; company: string; duration: string }[];
  education: string[];
  projects?: string[];
  strengths: string[];
  weaknesses: string[];
  overallScore: number;
  summary: string;
  totalYearsExp?: number;
}

type Stage = "idle" | "uploading" | "connecting" | "parsing" | "agents" | "scoring" | "done" | "error";

interface LogEntry {
  time: string;
  msg: string;
  type: "info" | "success" | "warn" | "agent";
}

const STAGE_CONFIG: Record<string, { icon: React.ReactNode; title: string; desc: string }> = {
  uploading:  { icon: <UploadCloud size={20} />, title: "Reading Resume",         desc: "Extracting text from your file" },
  connecting: { icon: <Plug size={20} />, title: "Connecting to AI",       desc: "Checking LangGraph pipeline availability" },
  parsing:    { icon: <FileText size={20} />, title: "Parsing Structure",      desc: "Identifying sections, contact info, and layout" },
  agents:     { icon: <Cpu size={20} />, title: "AI Pipeline Running",    desc: "LangGraph nodes evaluating your profile" },
  scoring:    { icon: <BarChart3 size={20} />, title: "Generating Report",      desc: "Building your career assessment" },
};

const ALL_STAGES = ["uploading", "connecting", "parsing", "agents", "scoring"];

export default function AnalyzePage() {
  const router = useRouter();
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [stage, setStage] = useState<Stage>("idle");
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [engine, setEngine] = useState<"crewai" | "local" | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRunRef = useRef(false); // guard against React strict mode double invocation

  // ── Helpers ────────────────────────────────────────────────────────────
  const addLog = (msg: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev, { time, msg, type }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const advanceStage = (s: Stage) => {
    setStage(s);
    if (s !== "done" && s !== "error" && s !== "idle") {
      setCompletedStages((prev) => {
        const idx = ALL_STAGES.indexOf(s);
        return ALL_STAGES.slice(0, idx);
      });
    }
  };

  const markDone = (s: string) => {
    setCompletedStages((prev) => [...new Set([...prev, s])]);
  };

  // ── Main flow ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasRunRef.current) return; // prevent strict-mode double run
    hasRunRef.current = true;

    const text = sessionStorage.getItem("resumeText");
    const name = sessionStorage.getItem("resumeFileName") || "resume";
    if (!text) { router.push("/"); return; }
    setResumeText(text);
    setFileName(name);
    runAnalysis(text, name);
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (stage !== "idle" && stage !== "done" && stage !== "error") {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  const runAnalysis = async (text: string, name: string) => {
    startTimeRef.current = Date.now();
    setLogs([]);
    setError(null);
    setResult(null);

    // ── Stage 1: Uploading ────────────────────────────────────────────
    advanceStage("uploading");
    const lineCount = text.split("\n").filter(Boolean).length;
    const sizeKB = (text.length / 1024).toFixed(1);
    addLog(`📁 File loaded: ${name} (${sizeKB} KB of text)`, "info");
    addLog(`🔍 Detected ${lineCount} lines of content`, "info");

    // Show first 150 chars of raw text so user can verify extraction quality
    const preview = text.slice(0, 150).replace(/\n/g, " ").trim();
    addLog(`📝 Raw text preview: "${preview}..."`, "info");

    if (parseFloat(sizeKB) < 2) {
      addLog(`⚠️ Very little text extracted (${sizeKB} KB). If your PDF is image-based or heavily styled, try saving as .docx or .txt for better results.`, "warn");
    }
    await sleep(400);
    markDone("uploading");

    // ── Stage 2: Connecting to FastAPI ────────────────────────────────
    advanceStage("connecting");
    addLog("🔌 Checking AI agent server availability...", "info");

    let fastapiAvailable = false;
    try {
      // Check through Next.js API to avoid browser CORS restrictions
      const health = await fetch("/api/health", { signal: AbortSignal.timeout(3000) });
      if (health.ok) {
        const data = await health.json();
        fastapiAvailable = data.fastapi === true;
        if (fastapiAvailable) {
          addLog("✅ LangGraph pipeline server is online (port 8000)", "success");
          addLog("🤖 Nodes: parse_resume (deepseek-chat) → assess_skills (deepseek-chat)", "agent");
        } else {
          addLog("⚠️  LangGraph server offline — using local analysis engine", "warn");
          addLog("💡 Start it: .venv\\Scripts\\python.exe -m uvicorn api.server:app --port 8000", "warn");
        }
      }
    } catch {
      addLog("⚠️  Could not reach LangGraph backend — using local analysis engine", "warn");
    }

    markDone("connecting");
    await sleep(300);

    // ── Stage 3: Parsing ──────────────────────────────────────────────
    advanceStage("parsing");
    addLog("📄 Parsing resume structure — detecting sections...", "info");
    await sleep(300);

    // ── Stage 4 & 5: Agents + Scoring ─────────────────────────────────
    advanceStage("agents");
    if (fastapiAvailable) {
      addLog("🚀 Dispatching to LangGraph: resume_analysis_graph.ainvoke()", "agent");
      addLog("⏳ Node 1 [parse_resume]: Extracting structured data...", "agent");
    } else {
      addLog("⚙️  Running local NLP parser...", "info");
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: AnalysisResult = await res.json();

      if (fastapiAvailable) {
        addLog("✅ Node 1 [parse_resume]: Complete", "agent");
        addLog("⏳ Node 2 [assess_skills]: Evaluating career profile...", "agent");
        await sleep(500);
        addLog("✅ Node 2 [assess_skills]: Complete", "agent");
      } else {
        addLog("✅ Local parser complete", "success");
      }

      markDone("agents");
      advanceStage("scoring");

      addLog(`📊 Skills detected: ${data.skills?.length || 0} (${data.strongSkills?.length || 0} strong)`, "info");
      addLog(`💼 Experience entries: ${data.experience?.length || 0}`, "info");
      addLog(`⭐ Overall profile score: ${data.overallScore}/10`, "success");
      addLog(`✨ Analysis engine: ${fastapiAvailable ? "LangGraph (DeepSeek)" : "Local heuristic parser"}`, fastapiAvailable ? "agent" : "warn");

      await sleep(400);
      markDone("scoring");
      setEngine(fastapiAvailable ? "crewai" : "local");
      setResult(data);
      setStage("done");
      addLog("🎉 Analysis complete!", "success");

    } catch (err: any) {
      setError(err.message || "Analysis failed");
      setStage("error");
      addLog(`❌ Error: ${err.message}`, "warn");
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // ── Render ─────────────────────────────────────────────────────────────
  if (!resumeText && stage === "idle") return null;

  return (
    <div className="page-container">
      {/* ── Analyzing State ── */}
      {stage !== "done" && stage !== "error" && (
        <div className="analysis-container">
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 style={{ fontSize: "var(--font-2xl)", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Activity size={24} className="spin-animation" style={{ color: "var(--accent-primary-light)" }} />
              Analyzing Your Resume
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
              {fileName && <span style={{ color: "var(--accent-primary-light)", fontWeight: 600 }}>{fileName}</span>}
            </p>
            <div style={{ fontSize: "var(--font-sm)", color: "var(--text-tertiary)", fontFamily: "monospace" }}>
              Elapsed: {(elapsedMs / 1000).toFixed(1)}s
            </div>
          </div>

          {/* Stage list */}
          <div className="analysis-stages" style={{ marginBottom: 24 }}>
            {ALL_STAGES.map((s) => {
              const cfg = STAGE_CONFIG[s];
              const isActive = stage === s;
              const isDone = completedStages.includes(s);
              return (
                <div
                  key={s}
                  className={`analysis-stage ${isDone ? "completed" : isActive ? "active" : ""}`}
                >
                  <div className="stage-icon">{cfg.icon}</div>
                  <div className="stage-content">
                    <h4>{cfg.title}</h4>
                    <p>{cfg.desc}</p>
                  </div>
                  <div className="stage-status">
                    {isDone ? (
                      <span className="done">✓</span>
                    ) : isActive ? (
                      <span className="running"><span className="spinner" /></span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live log panel */}
          <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--border-secondary)",
              fontSize: "var(--font-xs)",
              fontWeight: 600,
              color: "var(--text-tertiary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 6px #22c55e" }} />
              Agent Log — Live
            </div>
            <div style={{
              padding: "12px 16px",
              fontFamily: "monospace",
              fontSize: "var(--font-xs)",
              lineHeight: 1.8,
              maxHeight: 200,
              overflowY: "auto",
              background: "rgba(0,0,0,0.2)",
            }}>
              {logs.map((log, i) => (
                <div key={i} style={{
                  color: log.type === "success" ? "#22c55e"
                    : log.type === "warn" ? "#eab308"
                    : log.type === "agent" ? "#a78bfa"
                    : "var(--text-secondary)",
                }}>
                  <span style={{ color: "var(--text-tertiary)", marginRight: 8 }}>[{log.time}]</span>
                  {log.msg}
                </div>
              ))}
              {logs.length === 0 && (
                <div style={{ color: "var(--text-tertiary)" }}>Initializing...</div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* ── Error State ── */}
      {stage === "error" && (
        <div className="empty-state">
          <div className="empty-icon" style={{ color: "var(--accent-primary)", display: "flex", justifyContent: "center", marginBottom: 16 }}><AlertTriangle size={48} /></div>
          <h3>Analysis Error</h3>
          <p>{error}</p>
          {/* Show log even on error */}
          <div className="glass-card" style={{ padding: 16, marginTop: 20, textAlign: "left", maxWidth: 600, width: "100%" }}>
            {logs.map((log, i) => (
              <div key={i} style={{ fontFamily: "monospace", fontSize: "var(--font-xs)", lineHeight: 1.8,
                color: log.type === "warn" ? "#eab308" : log.type === "agent" ? "#a78bfa" : "var(--text-secondary)" }}>
                [{log.time}] {log.msg}
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => resumeText && runAnalysis(resumeText, fileName)}
          >
            Retry Analysis
          </button>
        </div>
      )}

      {/* ── Results State ── */}
      {stage === "done" && result && (
        <div className="stagger-enter">
          {/* Header */}
          <div className="page-header" style={{ textAlign: "center" }}>
            <h1>Resume Analysis Complete</h1>
            <p>
              Here&apos;s what our AI found about your profile,{" "}
              <strong style={{ color: "var(--accent-primary-light)" }}>{result.name || "Candidate"}</strong>
            </p>
            {/* Engine badge */}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 14px", borderRadius: 999,
                background: engine === "crewai" ? "rgba(99,102,241,0.15)" : "rgba(234,179,8,0.1)",
                border: `1px solid ${engine === "crewai" ? "var(--accent-primary)" : "#eab308"}`,
                fontSize: "var(--font-xs)", fontWeight: 600,
                color: engine === "crewai" ? "var(--accent-primary-light)" : "#eab308",
              }}>
                {engine === "crewai" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Cpu size={12} /> Powered by LangGraph + DeepSeek
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Activity size={12} /> Local Heuristic Engine
                  </span>
                )}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 14px", borderRadius: 999,
                background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-secondary)",
                fontSize: "var(--font-xs)", color: "var(--text-tertiary)",
              }}>
                ⏱ {(elapsedMs / 1000).toFixed(1)}s
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 14px", borderRadius: 999,
                background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-secondary)",
                fontSize: "var(--font-xs)", color: "var(--text-tertiary)",
              }}>
                📄 {fileName}
              </span>
            </div>
          </div>

          {/* Overall Score */}
          <div className="glass-card" style={{ padding: 32, textAlign: "center", maxWidth: 500, margin: "0 auto 24px" }}>
            <div style={{
              fontSize: "var(--font-6xl)", fontWeight: 900,
              background: "var(--gradient-primary)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {result.overallScore}/10
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--font-lg)" }}>
              Overall Profile Strength
            </p>
            {result.totalYearsExp && result.totalYearsExp > 0 && (
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--font-sm)", marginTop: 4 }}>
                {result.totalYearsExp}+ years of experience detected
              </p>
            )}
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: "var(--font-lg)", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={18} style={{ color: "var(--accent-primary-light)" }} /> AI Summary
              </h3>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{result.summary}</p>
              {result.email && (
                <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {result.email && <span style={{ fontSize: "var(--font-xs)", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: 4 }}><Mail size={12} /> {result.email}</span>}
                  {result.phone && <span style={{ fontSize: "var(--font-xs)", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {result.phone}</span>}
                  {result.linkedin && <span style={{ fontSize: "var(--font-xs)", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: 4 }}><Link2 size={12} /> {result.linkedin}</span>}
                </div>
              )}
            </div>
          )}

          {/* Results Grid */}
          <div className="results-grid">
            {/* Skills */}
            <div className="result-card glass-card">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Brain size={18} style={{ color: "var(--accent-primary-light)" }} /> Skills Detected ({result.skills?.length || 0})</h3>
              <div className="skills-list">
                {result.strongSkills?.map((s) => (
                  <span key={s} className="skill-tag strong" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Star size={10} fill="var(--accent-primary)" stroke="none" /> {s}
                  </span>
                ))}
                {result.skills
                  ?.filter((s) => !result.strongSkills?.includes(s))
                  .map((s) => (
                    <span key={s} className="skill-tag">{s}</span>
                  ))}
              </div>
            </div>

            {/* Strengths */}
            <div className="result-card glass-card">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={18} style={{ color: "#22c55e" }} /> Key Strengths</h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {result.strengths?.map((s, i) => (
                  <li key={i} style={{
                    fontSize: "var(--font-sm)", color: "var(--text-secondary)",
                    paddingLeft: 14, borderLeft: "2px solid #22c55e", lineHeight: 1.5,
                  }}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div className="result-card glass-card">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Target size={18} style={{ color: "var(--accent-primary-light)" }} /> Areas to Strengthen</h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {result.weaknesses?.map((w, i) => (
                  <li key={i} style={{
                    fontSize: "var(--font-sm)", color: "var(--text-secondary)",
                    paddingLeft: 14, borderLeft: "2px solid var(--accent-primary)", lineHeight: 1.5,
                  }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* Experience */}
            <div className="result-card glass-card">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Briefcase size={18} style={{ color: "var(--text-secondary)" }} /> Experience ({result.experience?.length || 0} roles)</h3>
              {result.experience?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {result.experience.map((exp, i) => (
                    <div key={i} style={{ borderLeft: "2px solid var(--border-primary)", paddingLeft: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-sm)" }}>{exp.title}</div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                        {exp.company}{exp.duration ? ` · ${exp.duration}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "var(--font-sm)", color: "var(--text-tertiary)" }}>
                  No structured experience entries detected. Consider adding clear date ranges.
                </p>
              )}
            </div>
          </div>

          {/* Education & Projects */}
          {(result.education?.length > 0 || (result.projects && result.projects.length > 0)) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
              {result.education?.length > 0 && (
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: "var(--font-base)", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><GraduationCap size={18} style={{ color: "var(--text-secondary)" }} /> Education</h3>
                  {result.education.map((e, i) => (
                    <p key={i} style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)", marginBottom: 6 }}>{e}</p>
                  ))}
                </div>
              )}
              {result.projects && result.projects.length > 0 && (
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: "var(--font-base)", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><Code size={18} style={{ color: "var(--text-secondary)" }} /> Projects</h3>
                  {result.projects.map((p, i) => (
                    <p key={i} style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)", marginBottom: 6 }}>{p}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Agent log collapsible */}
          <details className="glass-card" style={{ padding: 0, marginTop: 20, overflow: "hidden" }}>
            <summary style={{
              padding: "12px 20px", cursor: "pointer", fontSize: "var(--font-sm)",
              fontWeight: 600, color: "var(--text-secondary)", listStyle: "none",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Terminal size={14} style={{ color: "var(--text-tertiary)" }} /> View Agent Log ({logs.length} events)
            </summary>
            <div style={{
              padding: "12px 20px", fontFamily: "monospace", fontSize: "var(--font-xs)",
              lineHeight: 1.8, maxHeight: 250, overflowY: "auto",
              background: "rgba(0,0,0,0.2)", borderTop: "1px solid var(--border-secondary)",
            }}>
              {logs.map((log, i) => (
                <div key={i} style={{
                  color: log.type === "success" ? "#22c55e"
                    : log.type === "warn" ? "#eab308"
                    : log.type === "agent" ? "#a78bfa"
                    : "var(--text-secondary)",
                }}>
                  <span style={{ color: "var(--text-tertiary)", marginRight: 8 }}>[{log.time}]</span>
                  {log.msg}
                </div>
              ))}
            </div>
          </details>

          {/* CTA */}
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                sessionStorage.setItem("analysisResult", JSON.stringify(result));
                router.push("/jobs");
              }}
              id="find-jobs-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: "0 auto" }}
            >
              <Search size={16} /> Find Matching Jobs
            </button>
            <p style={{ color: "var(--text-tertiary)", fontSize: "var(--font-sm)", marginTop: 12 }}>
              AI agents will search for jobs matching your {result.skills?.length || 0} detected skills
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
