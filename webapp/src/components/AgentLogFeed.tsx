"use client";

import { useEffect, useRef } from "react";

export interface LogEntry {
  id: number;
  timestamp: string;
  agent: string;
  agentIcon: string;
  message: string;
  type: "info" | "action" | "tool" | "result" | "thinking";
}

interface AgentLogFeedProps {
  active: boolean;
  entries: LogEntry[];
}

export default function AgentLogFeed({ active, entries }: AgentLogFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (!active && entries.length === 0) return null;

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
          jobflow-pipeline — live
        </span>
        <div style={{ flex: 1 }} />
        {active && (
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
        )}
        {!active && entries.length > 0 && (
          <span style={{
            fontSize: "0.7rem",
            color: "var(--text-muted)",
            fontFamily: "monospace",
          }}>
            COMPLETED
          </span>
        )}
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
        {entries.map((log, i) => (
          <div
            key={log.id}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              animation: "fadeSlideIn 0.3s ease-out",
              opacity: i === entries.length - 1 ? 1 : 0.7,
            }}
          >
            <span style={{
              color: "var(--text-muted)",
              fontSize: "0.7rem",
              minWidth: 62,
              flexShrink: 0,
              paddingTop: 2,
            }}>
              {log.timestamp}
            </span>
            <span style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              minWidth: 130,
              flexShrink: 0,
              color: getAgentColor(log.agent),
              paddingTop: 1,
            }}>
              {log.agentIcon} {log.agent}
            </span>
            <span style={{
              color: getMessageColor(log.type),
              wordBreak: "break-word",
            }}>
              {log.type === "tool" && <span style={{ color: "#f59e0b" }}>⚙ </span>}
              {log.message}
            </span>
          </div>
        ))}

        {/* Blinking cursor when active */}
        {active && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", minWidth: 62 }}>&nbsp;</span>
            <span style={{ minWidth: 130 }}>&nbsp;</span>
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
      {entries.length > 0 && (
        <div style={{
          height: 3,
          background: "rgba(255,255,255,0.05)",
        }}>
          <div style={{
            height: "100%",
            width: active ? "75%" : "100%",
            background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))",
            transition: "width 0.5s ease-out",
            borderRadius: 3,
          }} />
        </div>
      )}
    </div>
  );
}

function getAgentColor(agent: string): string {
  switch (agent) {
    case "Pipeline": return "#a78bfa";
    case "Search": return "#38bdf8";
    case "Scraper": return "#fb923c";
    case "Quality": return "#f472b6";
    case "Scorer": return "#34d399";
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
