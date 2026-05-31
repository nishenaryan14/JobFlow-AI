"use client";

import { useEffect, useRef, useState } from "react";

interface ATSScoreGaugeProps {
  score: number; // 0-100
  label?: string;
  size?: number;
}

export default function ATSScoreGauge({
  score,
  label = "ATS Score",
  size = 160,
}: ATSScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 70) return "#22c55e";
    if (s >= 50) return "#eab308";
    return "#ef4444";
  };

  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  return (
    <div className="score-gauge" ref={ref} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className="fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(animatedScore)}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 8px ${getColor(animatedScore)}40)`,
          }}
        />
      </svg>
      <div className="value">
        <div>
          <div style={{ fontSize: size > 120 ? "var(--font-3xl)" : "var(--font-2xl)", fontWeight: 800, color: getColor(animatedScore) }}>
            {animatedScore}
          </div>
          <div
            style={{
              fontSize: "var(--font-xs)",
              color: "var(--text-tertiary)",
              marginTop: -4,
            }}
          >
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
