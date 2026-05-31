"use client";

import { useState, useEffect, useRef } from "react";

interface LogEntry {
  id: number;
  timestamp: string;
  agent: string;
  agentIcon: string;
  message: string;
  type: "info" | "action" | "tool" | "result" | "thinking";
}

// Realistic agent activity timeline — mirrors what CrewAI actually does
const AGENT_TIMELINE: Omit<LogEntry, "id" | "timestamp">[] = [
  { agent: "Orchestrator", agentIcon: "🧠", message: "Initializing CrewAI pipeline — sequential mode", type: "info" },
  { agent: "Orchestrator", agentIcon: "🧠", message: "Loading resume context and skill profile...", type: "action" },
  { agent: "Orchestrator", agentIcon: "🧠", message: "Delegating job search to Job Scout Agent", type: "info" },

  { agent: "Job Scout", agentIcon: "🕵️", message: "Starting web search across 8+ job platforms", type: "action" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "🔧 Using tool: SerperDevTool — query: \"AI Agent Engineer remote 2025\"", type: "tool" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "Found 23 initial results from Google Jobs API", type: "result" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "🔧 Using tool: SerperDevTool — query: \"LangGraph CrewAI engineer hiring\"", type: "tool" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "Found 18 more results — filtering by remote availability", type: "result" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "🔧 Using tool: ScrapeWebsiteTool — extracting job details from LinkedIn", type: "tool" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "Scraping detailed JDs from 12 promising listings...", type: "action" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "🔧 Using tool: ScrapeWebsiteTool — pulling requirements from Indeed postings", type: "tool" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "Extracted requirements from 15 unique positions", type: "result" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "Deduplicating listings — removed 6 cross-posted duplicates", type: "action" },
  { agent: "Job Scout", agentIcon: "🕵️", message: "✅ Compiled 18 unique job listings for analysis", type: "result" },

  { agent: "Orchestrator", agentIcon: "🧠", message: "Job Scout complete — delegating to Listing Analyzer Agent", type: "info" },

  { agent: "Listing Analyzer", agentIcon: "📋", message: "Parsing structured requirements from 18 job descriptions", type: "action" },
  { agent: "Listing Analyzer", agentIcon: "📋", message: "Extracting: required skills, experience level, salary data...", type: "action" },
  { agent: "Listing Analyzer", agentIcon: "📋", message: "Analyzing job #1: AI/ML Engineer @ ASSYST — 6 required skills found", type: "thinking" },
  { agent: "Listing Analyzer", agentIcon: "📋", message: "Analyzing job #5: Staff AI Engineer @ Datadog — salary: $180k-$260k", type: "thinking" },
  { agent: "Listing Analyzer", agentIcon: "📋", message: "Analyzing job #9: AI Agent Engineer @ Lumos — 5+ years required", type: "thinking" },
  { agent: "Listing Analyzer", agentIcon: "📋", message: "Categorizing agentic relevance: High (12), Medium (4), Low (2)", type: "result" },
  { agent: "Listing Analyzer", agentIcon: "📋", message: "✅ All 18 listings structured with skills, salary, and requirements", type: "result" },

  { agent: "Orchestrator", agentIcon: "🧠", message: "Listing Analyzer complete — delegating to Resume Matcher Agent", type: "info" },

  { agent: "Resume Matcher", agentIcon: "🎯", message: "Loading candidate skill profile for matching...", type: "action" },
  { agent: "Resume Matcher", agentIcon: "🎯", message: "Computing skill overlap for 18 positions against resume", type: "action" },
  { agent: "Resume Matcher", agentIcon: "🎯", message: "ASSYST AI/ML Engineer — 5/6 skills match → Fit Score: 9/10 🟢", type: "thinking" },
  { agent: "Resume Matcher", agentIcon: "🎯", message: "Datadog Staff AI Engineer — 4/5 skills match → Fit Score: 8/10 🟢", type: "thinking" },
  { agent: "Resume Matcher", agentIcon: "🎯", message: "Identifying skill gaps for each position...", type: "action" },
  { agent: "Resume Matcher", agentIcon: "🎯", message: "Generating personalized application tips per role", type: "action" },
  { agent: "Resume Matcher", agentIcon: "🎯", message: "Ranking all 18 positions by composite fit score", type: "action" },
  { agent: "Resume Matcher", agentIcon: "🎯", message: "✅ Final ranking complete — top match: 9/10 | lowest: 3/10", type: "result" },

  { agent: "Orchestrator", agentIcon: "🧠", message: "All agents complete — saving results to database", type: "info" },
  { agent: "Orchestrator", agentIcon: "🧠", message: "✅ Pipeline finished — 10 jobs ready for review", type: "result" },
];

// Stagger interval (ms) between log entries
const BASE_INTERVAL = 800;
const RANDOMNESS = 600;

export default function AgentLogFeed({ active }: { active: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    // Reset on activation
    setLogs([]);
    setCurrentIndex(0);
  }, [active]);

  useEffect(() => {
    if (!active || currentIndex >= AGENT_TIMELINE.length) return;

    const delay = BASE_INTERVAL + Math.random() * RANDOMNESS;
    const timer = setTimeout(() => {
      const entry = AGENT_TIMELINE[currentIndex];
      const now = new Date();
      const ts = now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setLogs((prev) => [
        ...prev,
        { ...entry, id: currentIndex, timestamp: ts },
      ]);
      setCurrentIndex((i) => i + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [active, currentIndex]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!active) return null;

  return (
    <div style={{
      marginTop: 28,
      background: "rgba(0,0,0,0.35)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border-primary)",
      overflow: "hidden",
    }}>
      {/* Terminal header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        background: "rgba(0,0,0,0.3)",
        borderBottom: "1px solid var(--border-primary)",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
        </div>
        <span style={{
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          fontFamily: "monospace",
          letterSpacing: "0.5px",
          marginLeft: 8,
        }}>
          crewai-agent-pipeline — live
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: "0.7rem",
          color: "#22c55e",
          fontFamily: "monospace",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#22c55e",
            animation: "pulse 1.5s infinite",
          }} />
          LIVE
        </span>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="agent-log-scroll"
        style={{
          maxHeight: 320,
          overflowY: "auto",
          padding: "12px 16px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: "0.78rem",
          lineHeight: 1.8,
        }}
      >
        {logs.map((log, i) => (
          <div
            key={log.id}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              animation: "fadeSlideIn 0.3s ease-out",
              opacity: i === logs.length - 1 ? 1 : 0.7,
            }}
          >
            {/* Timestamp */}
            <span style={{
              color: "var(--text-muted)",
              fontSize: "0.7rem",
              minWidth: 62,
              flexShrink: 0,
              paddingTop: 2,
            }}>
              {log.timestamp}
            </span>

            {/* Agent badge */}
            <span style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              minWidth: 110,
              flexShrink: 0,
              color: getAgentColor(log.agent),
              paddingTop: 1,
            }}>
              {log.agentIcon} {log.agent}
            </span>

            {/* Message */}
            <span style={{
              color: getMessageColor(log.type),
              wordBreak: "break-word",
            }}>
              {log.type === "tool" && <span style={{ color: "#f59e0b" }}>⚙ </span>}
              {log.message}
            </span>
          </div>
        ))}

        {/* Blinking cursor */}
        {currentIndex < AGENT_TIMELINE.length && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", minWidth: 62 }}>&nbsp;</span>
            <span style={{ minWidth: 110 }}>&nbsp;</span>
            <span style={{
              display: "inline-block",
              width: 8,
              height: 16,
              background: "var(--accent-primary)",
              animation: "blink 1s step-end infinite",
            }} />
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3,
        background: "rgba(255,255,255,0.05)",
      }}>
        <div style={{
          height: "100%",
          width: `${(currentIndex / AGENT_TIMELINE.length) * 100}%`,
          background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))",
          transition: "width 0.5s ease-out",
          borderRadius: 3,
        }} />
      </div>
    </div>
  );
}

function getAgentColor(agent: string): string {
  switch (agent) {
    case "Orchestrator": return "#a78bfa";
    case "Job Scout": return "#38bdf8";
    case "Listing Analyzer": return "#fb923c";
    case "Resume Matcher": return "#34d399";
    default: return "#888";
  }
}

function getMessageColor(type: string): string {
  switch (type) {
    case "result": return "#22c55e";
    case "tool": return "#f59e0b";
    case "thinking": return "#94a3b8";
    case "action": return "var(--text-secondary)";
    default: return "var(--text-secondary)";
  }
}
