"use client";

import { CheckCircle2, XCircle, Zap, Target, AlertTriangle, Sparkles, PartyPopper } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface KeywordSuggestion {
  keyword: string;
  importance: "critical" | "important" | "nice_to_have";
  section: string;
  suggestion: string;
  reasoning: string;
  rephrase_target: string;
  rephrase_result: string;
  action_type: "add" | "rephrase";
}

interface KeywordSuggestionsProps {
  suggestions: KeywordSuggestion[];
  matchedKeywords: string[];
  matchPercentage: number;
  onAccept: (suggestion: KeywordSuggestion) => void;
  onReject: (index: number) => void;
  isLoading: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const importanceConfig = {
  critical: {
    label: "Critical",
    emoji: "🔴",
    bg: "rgba(239, 68, 68, 0.12)",
    color: "#f87171",
    border: "rgba(239, 68, 68, 0.3)",
  },
  important: {
    label: "Important",
    emoji: "🟡",
    bg: "rgba(234, 179, 8, 0.12)",
    color: "#facc15",
    border: "rgba(234, 179, 8, 0.3)",
  },
  nice_to_have: {
    label: "Nice to Have",
    emoji: "🟢",
    bg: "rgba(34, 197, 94, 0.12)",
    color: "#4ade80",
    border: "rgba(34, 197, 94, 0.3)",
  },
};

const actionConfig = {
  add: {
    label: "Add",
    bg: "rgba(55, 114, 255, 0.12)",
    color: "#588aff",
    border: "rgba(55, 114, 255, 0.3)",
  },
  rephrase: {
    label: "Rephrase",
    bg: "rgba(151, 87, 215, 0.12)",
    color: "#b888e0",
    border: "rgba(151, 87, 215, 0.3)",
  },
};

// ── Skeleton Card ──────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="glass-card"
      style={{
        padding: 20,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 80,
            height: 22,
            borderRadius: 6,
            background: "var(--bg-surface)",
            animation: "shimmer 1.5s infinite",
          }}
        />
        <div
          style={{
            width: 60,
            height: 22,
            borderRadius: 6,
            background: "var(--bg-surface)",
            animation: "shimmer 1.5s infinite 0.1s",
          }}
        />
      </div>
      <div
        style={{
          width: "100%",
          height: 14,
          borderRadius: 4,
          background: "var(--bg-surface)",
          marginBottom: 8,
          animation: "shimmer 1.5s infinite 0.2s",
        }}
      />
      <div
        style={{
          width: "70%",
          height: 14,
          borderRadius: 4,
          background: "var(--bg-surface)",
          animation: "shimmer 1.5s infinite 0.3s",
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.3; }
          50% { opacity: 0.7; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function KeywordSuggestions({
  suggestions,
  matchedKeywords,
  matchPercentage,
  onAccept,
  onReject,
  isLoading,
}: KeywordSuggestionsProps) {
  const criticalSuggestions = suggestions.filter((s) => s.importance === "critical");

  // ── Matched keyword progress bar color ───────────────────────────────────
  const barColor =
    matchPercentage >= 80
      ? "#4ade80"
      : matchPercentage >= 50
        ? "#facc15"
        : "#f87171";

  const percentBadgeBg =
    matchPercentage >= 80
      ? "rgba(34, 197, 94, 0.15)"
      : matchPercentage >= 50
        ? "rgba(234, 179, 8, 0.15)"
        : "rgba(239, 68, 68, 0.15)";

  // Badge styles
  const badgeBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    borderRadius: "var(--radius-full, 9999px)",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
  };

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: "var(--radius-sm, 8px)",
    fontSize: "var(--font-sm)",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontFamily: "var(--font-family)",
    transition: "all var(--transition-fast)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Target size={20} color="var(--accent-primary)" />
          <span
            style={{
              fontSize: "var(--font-lg)",
              fontWeight: 800,
              color: "var(--text-primary)",
            }}
          >
            ATS Keyword Analysis
          </span>
        </div>
        <span
          style={{
            ...badgeBase,
            background: percentBadgeBg,
            color: barColor,
            border: `1px solid ${barColor}33`,
            fontSize: "0.85rem",
            padding: "5px 14px",
          }}
        >
          {matchPercentage}% Match
        </span>
      </div>

      {/* ── Progress Bar ──────────────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          height: 8,
          borderRadius: 4,
          background: "var(--bg-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(matchPercentage, 100)}%`,
            height: "100%",
            borderRadius: 4,
            background: barColor,
            transition: "width 0.8s ease, background 0.5s ease",
            boxShadow: `0 0 12px ${barColor}55`,
          }}
        />
      </div>

      {/* ── Matched Keywords ──────────────────────────────────────────────── */}
      {matchedKeywords.length > 0 && (
        <div
          className="glass-card"
          style={{ padding: "16px 20px" }}
        >
          <div
            style={{
              fontSize: "var(--font-xs)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 10,
            }}
          >
            ✓ Matched Keywords
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {matchedKeywords.map((kw, idx) => (
              <span
                key={idx}
                style={{
                  ...badgeBase,
                  background: "rgba(34, 197, 94, 0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                }}
              >
                <CheckCircle2 size={10} /> {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Bulk Accept Button ────────────────────────────────────────────── */}
      {!isLoading && criticalSuggestions.length > 0 && (
        <button
          style={{
            ...btnBase,
            background: "var(--gradient-primary)",
            color: "white",
            padding: "10px 20px",
            boxShadow: "0 4px 15px rgba(55, 114, 255, 0.3)",
            justifyContent: "center",
          }}
          onClick={() => criticalSuggestions.forEach((s) => onAccept(s))}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = "translateY(-1px)";
            (e.target as HTMLElement).style.boxShadow = "0 6px 25px rgba(55, 114, 255, 0.45)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = "translateY(0)";
            (e.target as HTMLElement).style.boxShadow = "0 4px 15px rgba(55, 114, 255, 0.3)";
          }}
        >
          <Zap size={14} /> Accept All Critical ({criticalSuggestions.length})
        </button>
      )}

      {/* ── Loading State ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* ── Suggestions List ──────────────────────────────────────────────── */}
      {!isLoading && suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {suggestions.map((suggestion, idx) => {
            const imp = importanceConfig[suggestion.importance];
            const act = actionConfig[suggestion.action_type];

            return (
              <div
                key={idx}
                className="glass-card"
                style={{
                  padding: "18px 20px",
                  overflow: "hidden",
                }}
              >
                {/* Top row: keyword + badges */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: "var(--font-base)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {suggestion.keyword}
                  </span>
                  <span
                    style={{
                      ...badgeBase,
                      background: imp.bg,
                      color: imp.color,
                      border: `1px solid ${imp.border}`,
                    }}
                  >
                    {imp.emoji} {imp.label}
                  </span>
                  <span
                    style={{
                      ...badgeBase,
                      background: act.bg,
                      color: act.color,
                      border: `1px solid ${act.border}`,
                    }}
                  >
                    {suggestion.action_type === "add" ? (
                      <Sparkles size={10} />
                    ) : (
                      <AlertTriangle size={10} />
                    )}
                    {act.label}
                  </span>
                </div>

                {/* Section target */}
                <div
                  style={{
                    fontSize: "var(--font-xs)",
                    color: "var(--text-tertiary)",
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  → {suggestion.section}
                </div>

                {/* Suggestion text */}
                <p
                  style={{
                    fontSize: "var(--font-sm)",
                    color: "var(--text-primary)",
                    lineHeight: 1.55,
                    marginBottom: 8,
                  }}
                >
                  {suggestion.suggestion}
                </p>

                {/* Rephrase diff */}
                {suggestion.action_type === "rephrase" &&
                  suggestion.rephrase_target &&
                  suggestion.rephrase_result && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "var(--radius-sm, 8px)",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-primary)",
                        marginBottom: 10,
                        fontSize: "var(--font-sm)",
                        lineHeight: 1.6,
                      }}
                    >
                      <div style={{ marginBottom: 6 }}>
                        <span
                          style={{
                            textDecoration: "line-through",
                            color: "#f87171",
                            opacity: 0.8,
                          }}
                        >
                          {suggestion.rephrase_target}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "#4ade80" }}>{suggestion.rephrase_result}</span>
                      </div>
                    </div>
                  )}

                {/* Reasoning */}
                <p
                  style={{
                    fontSize: "var(--font-xs)",
                    color: "var(--text-tertiary)",
                    lineHeight: 1.5,
                    marginBottom: 14,
                    fontStyle: "italic",
                  }}
                >
                  {suggestion.reasoning}
                </p>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{
                      ...btnBase,
                      background: "rgba(34, 197, 94, 0.12)",
                      color: "#4ade80",
                      border: "1px solid rgba(34, 197, 94, 0.25)",
                    }}
                    onClick={() => onAccept(suggestion)}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background = "rgba(34, 197, 94, 0.2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = "rgba(34, 197, 94, 0.12)";
                    }}
                  >
                    <CheckCircle2 size={14} /> Accept
                  </button>
                  <button
                    style={{
                      ...btnBase,
                      background: "transparent",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-primary)",
                    }}
                    onClick={() => onReject(idx)}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background = "var(--bg-surface)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <XCircle size={14} /> Skip
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────────── */}
      {!isLoading && suggestions.length === 0 && matchedKeywords.length > 0 && (
        <div
          className="glass-card"
          style={{
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <PartyPopper
              size={40}
              color="var(--accent-primary)"
              style={{ opacity: 0.8 }}
            />
          </div>
          <h3
            style={{
              fontSize: "var(--font-lg)",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            All Keywords Matched!
          </h3>
          <p
            style={{
              fontSize: "var(--font-sm)",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Your resume already contains all the important keywords for this job.
            Great work!
          </p>
        </div>
      )}
    </div>
  );
}
