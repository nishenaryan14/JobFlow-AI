"use client";

import { useEffect, useState } from "react";

interface Stage {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const stages: Stage[] = [
  {
    id: "parsing",
    icon: "📄",
    title: "Parsing Resume",
    description: "Extracting text, sections, and metadata",
  },
  {
    id: "skills",
    icon: "🧠",
    title: "Identifying Skills & Experience",
    description: "AI agents analyzing your technical profile",
  },
  {
    id: "strengths",
    icon: "💪",
    title: "Evaluating Strengths",
    description: "Mapping your competitive advantages",
  },
  {
    id: "profile",
    icon: "📊",
    title: "Building Career Profile",
    description: "Generating comprehensive career assessment",
  },
];

interface AnalysisAnimationProps {
  isRunning: boolean;
  currentStage?: string;
  onComplete?: () => void;
}

export default function AnalysisAnimation({
  isRunning,
  currentStage,
  onComplete,
}: AnalysisAnimationProps) {
  const [completedStages, setCompletedStages] = useState<Set<string>>(
    new Set()
  );
  const [activeStage, setActiveStage] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    let i = 0;
    const interval = setInterval(() => {
      if (i < stages.length) {
        setActiveStage(stages[i].id);
        if (i > 0) {
          setCompletedStages((prev) => new Set([...prev, stages[i - 1].id]));
        }
        i++;
      } else {
        setCompletedStages(
          (prev) => new Set([...prev, stages[stages.length - 1].id])
        );
        setActiveStage(null);
        clearInterval(interval);
        onComplete?.();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isRunning, onComplete]);

  useEffect(() => {
    if (currentStage) {
      setActiveStage(currentStage);
      const idx = stages.findIndex((s) => s.id === currentStage);
      if (idx > 0) {
        const completed = stages.slice(0, idx).map((s) => s.id);
        setCompletedStages(new Set(completed));
      }
    }
  }, [currentStage]);

  const getStageClass = (id: string) => {
    if (completedStages.has(id)) return "analysis-stage completed";
    if (activeStage === id) return "analysis-stage active";
    return "analysis-stage";
  };

  return (
    <div className="analysis-container">
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h2
          style={{ fontSize: "var(--font-2xl)", fontWeight: 800, marginBottom: 8 }}
        >
          🔬 Analyzing Your Resume
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>
          AI agents are working together to understand your profile
        </p>
      </div>

      <div className="analysis-stages">
        {stages.map((stage) => (
          <div key={stage.id} className={getStageClass(stage.id)}>
            <div className="stage-icon">{stage.icon}</div>
            <div className="stage-content">
              <h4>{stage.title}</h4>
              <p>{stage.description}</p>
            </div>
            <div className="stage-status">
              {completedStages.has(stage.id) ? (
                <span className="done">✓ Done</span>
              ) : activeStage === stage.id ? (
                <span className="running">
                  <span className="spinner" />
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
