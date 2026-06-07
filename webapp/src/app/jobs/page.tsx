"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Target, CheckCircle2, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import JobCard from "@/components/JobCard";
import type { JobData } from "@/components/JobCard";
import AgentLogFeed from "@/components/AgentLogFeed";
import type { LogEntry } from "@/components/AgentLogFeed";

type FilterType = "all" | "high" | "mid" | "low" | "applied" | "not-applied";

const JOB_MATCHES_CACHE_PREFIX = "jobMatchesCache_";
const JOB_MATCHES_CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Map SSE phase strings to the 3 pipeline stage indices.
 *   0 = Search Node
 *   1 = Extract Node
 *   2 = Match Node
 */
function phaseToStageIndex(phase: string): number {
  switch (phase) {
    case "analyzing":
    case "searching":
      return 0;
    case "scraping":
    case "extracting":
    case "quality":
      return 1;
    case "ranking":
    case "scoring":
      return 2;
    default:
      return 0;
  }
}

/**
 * Derive a search-appropriate target role from the resume analysis result.
 * Falls back gracefully when analysis data is unavailable.
 */
function deriveTargetRole(analysisResult: Record<string, unknown> | null): string {
  if (!analysisResult) return "Software Engineer";

  const strongSkills: string[] = (analysisResult.strongSkills as string[]) || [];
  const skills: string[] = (analysisResult.skills as string[]) || [];
  const allSkills = [...strongSkills, ...skills].map((s) => s.toLowerCase());

  // AI / Agentic
  if (allSkills.some((s) => ["crewai", "langgraph", "autogen", "multi-agent", "agentic"].includes(s)))
    return "AI Agent Engineer";
  // ML / Data Science
  if (allSkills.some((s) => ["pytorch", "tensorflow", "machine learning", "deep learning", "computer vision", "nlp"].includes(s)))
    return "Machine Learning Engineer";
  if (allSkills.some((s) => ["pandas", "scikit-learn", "data analysis", "statistics", "jupyter", "r"].includes(s)))
    return "Data Scientist";
  if (allSkills.some((s) => ["spark", "hadoop", "airflow", "data pipeline", "etl", "snowflake", "dbt"].includes(s)))
    return "Data Engineer";
  // Full-Stack
  if (allSkills.some((s) => ["react", "next.js", "vue", "angular", "svelte"].includes(s)) &&
      allSkills.some((s) => ["node.js", "fastapi", "django", "express"].includes(s)))
    return "Full-Stack Engineer";
  // Backend
  if (allSkills.some((s) => ["fastapi", "django", "node.js", "express", "spring boot", "go", "rust", "java"].includes(s)))
    return "Backend Engineer";
  // Frontend
  if (allSkills.some((s) => ["react", "next.js", "vue", "angular", "css", "tailwind", "figma"].includes(s)))
    return "Frontend Engineer";
  // DevOps / Cloud
  if (allSkills.some((s) => ["kubernetes", "terraform", "aws", "devops", "docker", "ci/cd", "gcp", "azure"].includes(s)))
    return "DevOps Engineer";
  // Mobile
  if (allSkills.some((s) => ["react native", "flutter", "swift", "kotlin", "ios", "android"].includes(s)))
    return "Mobile Developer";
  // Security
  if (allSkills.some((s) => ["cybersecurity", "penetration testing", "soc", "siem", "security"].includes(s)))
    return "Security Engineer";
  // Design
  if (allSkills.some((s) => ["figma", "sketch", "adobe xd", "ui/ux", "user research", "wireframing"].includes(s)))
    return "UX Designer";
  // Product
  if (allSkills.some((s) => ["product management", "roadmap", "agile", "stakeholder", "okr", "jira"].includes(s)))
    return "Product Manager";
  // Marketing
  if (allSkills.some((s) => ["seo", "google analytics", "content marketing", "social media", "hubspot", "copywriting"].includes(s)))
    return "Digital Marketing Manager";
  // Finance
  if (allSkills.some((s) => ["financial modeling", "valuation", "excel", "bloomberg", "accounting", "cfa"].includes(s)))
    return "Financial Analyst";

  return "Software Engineer";
}

interface JobMatchesCache {
  jobs: JobData[];
  cachedAt: number;
}

function getCacheKey(): string {
  const sessionId = sessionStorage.getItem("resumeSessionId") || "no_session";
  return `${JOB_MATCHES_CACHE_PREFIX}${sessionId}`;
}

function readCachedJobs(): JobData[] {
  try {
    const cacheKey = getCacheKey();
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as JobMatchesCache;
    const isFresh = Date.now() - parsed.cachedAt < JOB_MATCHES_CACHE_TTL_MS;
    return isFresh && Array.isArray(parsed.jobs) ? parsed.jobs : [];
  } catch {
    return [];
  }
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [activeStage, setActiveStage] = useState<number>(0);
  const [completedStages, setCompletedStages] = useState<Set<number>>(new Set());
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const logIdCounter = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const addLogEntry = useCallback((
    agent: string, agentIcon: string, message: string,
    type: "info" | "action" | "tool" | "result" | "thinking"
  ) => {
    const now = new Date();
    const ts = now.toLocaleTimeString("en-US", {
      hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const id = logIdCounter.current++;
    setLogEntries((prev) => [...prev, { id, timestamp: ts, agent, agentIcon, message, type }]);
  }, []);

  const cacheJobs = useCallback((nextJobs: JobData[]) => {
    const cacheKey = getCacheKey();
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ jobs: nextJobs, cachedAt: Date.now() })
    );
  }, []);

  const closeStream = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const triggerSearch = useCallback((clearExisting: boolean = true) => {
    closeStream();
    const cacheKey = getCacheKey();
    sessionStorage.removeItem(cacheKey);
    setSearching(true);
    setLoading(true);
    setError(null);
    setActiveStage(0);
    setCompletedStages(new Set());
    setLogEntries([]);
    logIdCounter.current = 0;
    if (clearExisting) setJobs([]);

    const sessionId = sessionStorage.getItem("resumeSessionId");
    const rawAnalysis = sessionStorage.getItem("analysisResult");
    let analysisResult: Record<string, unknown> | null = null;
    try {
      analysisResult = rawAnalysis ? JSON.parse(rawAnalysis) : null;
    } catch {
      analysisResult = null;
    }
    const targetRole = deriveTargetRole(analysisResult);

    if (!sessionId) {
      console.warn("[jobs] No resume session found. Re-upload your resume or start FastAPI.");
      setLoading(false);
      setSearching(false);
      setError(
        "Resume session not found. Please go back and re-upload your resume with the FastAPI server running."
      );
      return;
    }

    const params = new URLSearchParams({ session_id: sessionId, target_role: targetRole });
    const backendUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000";
    const sseUrl = `${backendUrl}/stream-matches?${params}`;

    console.log(`[jobs] Opening SSE stream: ${sseUrl}`);
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    // status: granular phase updates from the live pipeline
    eventSource.addEventListener("status", (event) => {
      try {
        const status = JSON.parse(event.data) as {
          phase: string; message: string;
          agent?: string; agentIcon?: string; type?: string;
        };
        console.log(`[jobs] Phase: ${status.phase} — ${status.message}`);
        setStatusMessage(status.message);

        // Update stage cards based on phase
        const newStageIdx = phaseToStageIndex(status.phase);
        setActiveStage(newStageIdx);
        setCompletedStages((prev) => {
          const next = new Set(prev);
          for (let i = 0; i < newStageIdx; i++) next.add(i);
          return next;
        });

        // Add to live log feed
        addLogEntry(
          status.agent || "Pipeline",
          status.agentIcon || "🧠",
          status.message,
          (status.type as "info" | "action" | "tool" | "result" | "thinking") || "info"
        );
      } catch {}
    });

    eventSource.addEventListener("job_match", (event) => {
      try {
        const newJob = JSON.parse(event.data) as JobData & { id?: string };
        setJobs((prev) => {
          const normalizedJob = { ...newJob, _id: newJob._id || newJob.id || "" };
          if (prev.some((j) => j._id === normalizedJob._id)) return prev;

          const nextJobs = [...prev, normalizedJob].sort((a, b) => b.fitScore - a.fitScore);
          cacheJobs(nextJobs);
          return nextJobs;
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to parse SSE event", err);
      }
    });

    // done: server signals clean stream completion
    eventSource.addEventListener("done", (event) => {
      try {
        const summary = JSON.parse(event.data) as { total: number; scanned: number };
        console.log(`[jobs] Stream complete — ${summary.total} matches from ${summary.scanned} scanned jobs.`);
      } catch {
        console.log("[jobs] Stream complete.");
      }
      // Mark all stages completed
      setCompletedStages(new Set([0, 1, 2]));
      setActiveStage(-1);
      closeStream();
      setSearching(false);
      setLoading(false);
    });

    eventSource.addEventListener("error", (e: Event) => {
      if (eventSourceRef.current !== eventSource) return;

      const msgEvent = e as MessageEvent;
      if (msgEvent.data) {
        try {
          const errData = JSON.parse(msgEvent.data) as { message?: string; code?: string };
          if (errData.code === "SESSION_EXPIRED") {
            setError("Resume session expired (4h TTL). Please go back and re-upload your resume.");
            closeStream(); setSearching(false); setLoading(false);
            return;
          }
          if (errData.code === "NO_JOBS" || errData.code === "DISCOVERY_ERROR") {
            setError(errData.message || "No jobs found. Check your API keys and try again.");
            closeStream(); setSearching(false); setLoading(false);
            return;
          }
        } catch {
          // Not structured JSON — treat as connection close
        }
      }

      console.log("[jobs] SSE stream closed.");
      closeStream();
      setSearching(false);
      setLoading(false);

      setJobs((prev) => {
        if (prev.length === 0) {
          setError(
            "Connection lost before any jobs were found. Check that FastAPI is running and try again."
          );
        }
        return prev;
      });
    });
  }, [addLogEntry, cacheJobs, closeStream]);

  const fetchJobs = useCallback(async () => {
    const cachedJobs = readCachedJobs();
    if (cachedJobs.length > 0) {
      setJobs(cachedJobs);
      setLoading(false);
      return;
    }
    triggerSearch();
  }, [triggerSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchJobs();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      closeStream();
    };
  }, [fetchJobs, closeStream]);

  const handleJobClick = (job: JobData) => {
    sessionStorage.setItem("selectedJob", JSON.stringify(job));
    router.push(`/jobs/${job._id}`);
  };

  const appliedCount = jobs.filter((j) => j.applicationStatus).length;
  const notAppliedCount = jobs.filter((j) => !j.applicationStatus).length;

  const filteredJobs = jobs.filter((j) => {
    if (filter === "all") return true;
    if (filter === "high") return j.fitScore >= 7;
    if (filter === "mid") return j.fitScore >= 5 && j.fitScore < 7;
    if (filter === "low") return j.fitScore < 5;
    if (filter === "applied") return !!j.applicationStatus;
    if (filter === "not-applied") return !j.applicationStatus;
    return true;
  });

  const STAGES = [
    { icon: <Search size={20} />, title: "Search Node", desc: "Querying job boards and career pages" },
    { icon: <FileText size={20} />, title: "Extract Node", desc: "Scraping and structuring job details" },
    { icon: <Target size={20} />, title: "Match Node", desc: "Ranking jobs by profile fit" },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Job Matches</h1>
        <p>
          {loading
            ? "Scanning thousands of listings for the best opportunities..."
            : `Found ${jobs.length} jobs matching your profile${
                appliedCount > 0 ? ` · ${appliedCount} applied` : ""
              }`}
        </p>
      </div>

      {!loading && jobs.length > 0 && (
        <div className="filters-bar">
          {(
            [
              { key: "all", label: `All (${jobs.length})` },
              {
                key: "not-applied",
                label: `New (${notAppliedCount})`,
              },
              {
                key: "applied",
                label: `Applied (${appliedCount})`,
              },
              {
                key: "high",
                label: `Strong (${jobs.filter((j) => j.fitScore >= 7).length})`,
              },
              {
                key: "mid",
                label: `Moderate (${jobs.filter((j) => j.fitScore >= 5 && j.fitScore < 7).length})`,
              },
              {
                key: "low",
                label: `Needs Work (${jobs.filter((j) => j.fitScore < 5).length})`,
              },
            ] as { key: FilterType; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              className={`filter-btn ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}

          <div style={{ flex: 1 }} />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => triggerSearch()}
            disabled={searching}
          >
            {searching ? "Searching..." : "New Search"}
          </button>
        </div>
      )}

      {loading ? (
        <div>
          <div className="analysis-container">
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: "var(--font-2xl)",
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                Searching for Jobs
              </h2>
              <p style={{ color: "var(--text-secondary)" }}>
                {statusMessage || "Scanning the web for matching opportunities..."}
              </p>
            </div>
            <div className="analysis-stages">
              {STAGES.map((s, i) => {
                const isCompleted = completedStages.has(i);
                const isActive = activeStage === i && searching;
                return (
                  <div
                    key={i}
                    className={`analysis-stage ${isCompleted ? "completed" : isActive ? "active" : ""}`}
                    style={{ animationDelay: `${i * 0.2}s` }}
                  >
                    <div className="stage-icon">
                      {isCompleted ? <CheckCircle2 size={20} style={{ color: "#22c55e" }} /> : s.icon}
                    </div>
                    <div className="stage-content">
                      <h4>{s.title}</h4>
                      <p>{s.desc}</p>
                    </div>
                    <div className={`stage-status ${isCompleted ? "done" : isActive ? "running" : ""}`}>
                      {isActive && <span className="spinner" />}
                      {isCompleted && <span style={{ color: "#22c55e", fontWeight: 700, fontSize: "0.8rem" }}>Done</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Agent Activity Log — real SSE events */}
            <AgentLogFeed active={searching || loading} entries={logEntries} />
          </div>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-icon"><AlertTriangle size={48} strokeWidth={1.5} /></div>
          <h3>Search Error</h3>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => triggerSearch()}
          >
            Retry Search
          </button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Search size={48} strokeWidth={1.5} /></div>
          <h3>No Jobs Found</h3>
          <p>Try adjusting your filters or run a new search</p>
        </div>
      ) : (
        <div className="jobs-grid stagger-enter">
          {filteredJobs
            .sort((a, b) => b.fitScore - a.fitScore)
            .map((job) => (
              <JobCard key={job._id} job={job} onClick={handleJobClick} />
            ))}
        </div>
      )}
    </div>
  );
}
