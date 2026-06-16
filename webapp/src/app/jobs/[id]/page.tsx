"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ATSScoreGauge from "@/components/ATSScoreGauge";
import ResumeComparison from "@/components/ResumeComparison";

interface Job {
  _id: string;
  title: string;
  company: string;
  location: string;
  remotePolicy: string;
  fitScore: number;
  matchingSkills: string[];
  skillGaps: string[];
  applicationTip: string;
  applicationUrl: string;
  description: string;
  salaryRange: string;
  experienceLevel: string;
  requiredSkills: string[];
}

interface ATSResult {
  overallScore: number;
  keywordMatchPercent: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  sectionScores: {
    skills: number;
    experience: number;
    education: number;
  };
  recommendations: string[];
}

const JOB_MATCHES_CACHE_KEY = "jobMatchesCache";

function updateCachedJobStatus(jobId: string, status: string) {
  try {
    const rawCache = sessionStorage.getItem(JOB_MATCHES_CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache) as {
        jobs?: Array<{ _id: string; applicationStatus?: string | null }>;
        cachedAt?: number;
      };
      if (Array.isArray(parsed.jobs)) {
        sessionStorage.setItem(
          JOB_MATCHES_CACHE_KEY,
          JSON.stringify({
            ...parsed,
            jobs: parsed.jobs.map((job) =>
              job._id === jobId ? { ...job, applicationStatus: status } : job
            ),
          })
        );
      }
    }

    const rawSelected = sessionStorage.getItem("selectedJob");
    if (rawSelected) {
      const selected = JSON.parse(rawSelected) as { _id?: string; applicationStatus?: string | null };
      if (selected._id === jobId) {
        sessionStorage.setItem(
          "selectedJob",
          JSON.stringify({ ...selected, applicationStatus: status })
        );
      }
    }
  } catch {
    // Cache updates are best-effort; DB persistence remains the source of truth.
  }
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [atsResult, setAtsResult] = useState<ATSResult | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedResume, setEnhancedResume] = useState<string | null>(null);
  const [enhanceChanges, setEnhanceChanges] = useState<string[]>([]);
  const [latexTemplate, setLatexTemplate] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [applied, setApplied] = useState(false);
  const [isAutoApplying, setIsAutoApplying] = useState(false);
  const [autoApplyStatus, setAutoApplyStatus] = useState<string | null>(null);

  const [selectedRecommendations, setSelectedRecommendations] = useState<string[]>([]);
  const [isApplyingRecs, setIsApplyingRecs] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("selectedJob");
    if (stored) {
      const parsedJob = JSON.parse(stored);
      setJob(parsedJob);
      // Check if the job has applicationStatus from the listing page
      if (parsedJob.applicationStatus) {
        setApplied(true);
      }
    }
    // Always fetch from DB to get fresh data (including applicationStatus)
    fetch(`/api/jobs?id=${jobId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.job) {
          setJob(d.job);
          if (d.job.applicationStatus) {
            setApplied(true);
          }
        } else if (!stored) {
          router.push("/jobs");
        }
      })
      .catch(() => {
        if (!stored) router.push("/jobs");
      });
  }, [jobId, router]);

  const runATSScore = async () => {
    if (!job) return;
    setIsScoring(true);
    try {
      const resumeText = sessionStorage.getItem("resumeText") || "";
      const res = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobTitle: job.title,
          jobDescription: job.description || `${job.title} at ${job.company}`,
          requiredSkills: job.requiredSkills || job.matchingSkills,
        }),
      });
      if (!res.ok) throw new Error("ATS scoring failed");
      const data = await res.json();
      setAtsResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScoring(false);
    }
  };

  const enhanceResume = async () => {
    if (!job) return;
    setIsEnhancing(true);
    try {
      const resumeText = sessionStorage.getItem("resumeText") || "";
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobTitle: job.title,
          jobDescription: job.description || `${job.title} at ${job.company}`,
          missingKeywords: atsResult?.missingKeywords || job.skillGaps || [],
        }),
      });
      if (!res.ok) throw new Error("Enhancement failed");
      const data = await res.json();
      setEnhancedResume(data.enhancedResume);
      setEnhanceChanges(data.changes || []);
      setLatexTemplate(data.latexTemplate || null);
      setShowComparison(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const applyRecommendations = async () => {
    if (!job || selectedRecommendations.length === 0) return;
    setIsApplyingRecs(true);
    try {
      const resumeText = sessionStorage.getItem("resumeText") || "";
      const res = await fetch("/api/apply-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription: job.description || `${job.title} at ${job.company}`,
          selectedRecommendations,
        }),
      });
      if (!res.ok) throw new Error("Apply recommendations failed");
      const data = await res.json();
      setEnhancedResume(data.enhancedResume);
      setEnhanceChanges(["Applied selected recommendations: " + selectedRecommendations.join(", ")]);
      setShowComparison(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsApplyingRecs(false);
    }
  };

  const toggleRecommendation = (rec: string) => {
    setSelectedRecommendations((prev) =>
      prev.includes(rec) ? prev.filter((r) => r !== rec) : [...prev, rec]
    );
  };

  const triggerAutoApply = async () => {
    if (!job) return;
    setIsAutoApplying(true);
    setAutoApplyStatus("Spinning up browser agent...");
    
    try {
      const res = await fetch("/api/auto-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job._id,
          job_url: job.applicationUrl || "",
          candidate_name: "Aryan Nishen",
          candidate_email: "aryannishen27@gmail.com",
          candidate_phone: "555-012-3456",
          candidate_linkedin: "linkedin.com/in/aryannishen"
        })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "RPA Agent failed");
      }
      
      setAutoApplyStatus("✅ Successfully applied via " + data.ats);
      await markAsApplied(); // Auto track it
    } catch (err) {
      console.error(err);
      // @ts-expect-error Existing catch handling assumes Error-like values.
      setAutoApplyStatus("❌ AutoApply failed: " + err.message);
    } finally {
      setIsAutoApplying(false);
    }
  };

  const markAsApplied = async () => {
    if (!job) return;
    try {
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job._id,
          jobTitle: job.title,
          company: job.company,
          status: "applied",
          atsScore: atsResult?.overallScore,
        }),
      });
      setApplied(true);
      updateCachedJobStatus(job._id, "applied");
    } catch (err) {
      console.error(err);
    }
  };

  if (!job) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <h3>Loading Job Details...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Back button */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => router.push("/jobs")}
        style={{ marginBottom: 16 }}
      >
        ← Back to Jobs
      </button>

      {/* Job Header */}
      <div
        className="glass-card"
        style={{ padding: 32, marginBottom: 24 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div
            className="company-avatar"
            style={{ width: 60, height: 60, fontSize: "var(--font-xl)" }}
          >
            {job.company
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontSize: "var(--font-2xl)",
                fontWeight: 800,
                marginBottom: 4,
              }}
            >
              {job.title}
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "var(--font-lg)",
                marginBottom: 12,
              }}
            >
              {job.company}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="meta-tag">📍 {job.location || "Remote"}</span>
              {job.remotePolicy && (
                <span className="meta-tag">🏠 {job.remotePolicy}</span>
              )}
              {job.salaryRange && (
                <span className="meta-tag">💰 {job.salaryRange}</span>
              )}
              {job.experienceLevel && (
                <span className="meta-tag">📊 {job.experienceLevel}</span>
              )}
              <span
                className={`badge ${job.fitScore >= 7 ? "badge-high" : job.fitScore >= 5 ? "badge-mid" : "badge-low"}`}
              >
                ⭐ {job.fitScore}/10 Fit Score
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {job.applicationUrl && (
              <a
                href={job.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                🔗 Apply Now
              </a>
             )}
             <button
              className="btn btn-secondary"
              onClick={triggerAutoApply}
              disabled={isAutoApplying || applied || !job.applicationUrl}
            >
              {isAutoApplying ? "🤖 Agent Applying..." : "🤖 Auto-Apply"}
            </button>
            <button
              className={`btn ${applied ? "btn-ghost" : "btn-secondary"}`}
              onClick={markAsApplied}
              disabled={applied}
            >
              {applied ? "✅ Tracked" : "📌 Track Application"}
            </button>
          </div>
          {autoApplyStatus && (
            <div style={{ marginTop: 12, fontSize: "var(--font-sm)", color: autoApplyStatus.includes("✅") ? "#4ade80" : "var(--text-tertiary)" }}>
              {autoApplyStatus}
            </div>
          )}
        </div>

        {/* Application Tip */}
        {job.applicationTip && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: "rgba(99, 102, 241, 0.05)",
              borderLeft: "3px solid var(--accent-primary)",
              borderRadius: "0 var(--radius-md) var(--radius-md) 0",
            }}
          >
            <div
              style={{
                fontSize: "var(--font-sm)",
                fontWeight: 600,
                color: "var(--accent-primary-light)",
                marginBottom: 4,
              }}
            >
              💡 Application Tip
            </div>
            <p style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)" }}>
              {job.applicationTip}
            </p>
          </div>
        )}
      </div>

      {/* Skills Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: 24 }}>
          <h3
            style={{
              fontSize: "var(--font-lg)",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            ✅ Matching Skills
          </h3>
          <div className="skills-list">
            {job.matchingSkills?.map((s) => (
              <span key={s} className="skill-tag strong">
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 24 }}>
          <h3
            style={{
              fontSize: "var(--font-lg)",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            🎯 Skills to Develop
          </h3>
          <div className="skills-list">
            {job.skillGaps?.map((s) => (
              <span key={s} className="skill-tag">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ATS Score Section */}
      <div
        className="glass-card"
        style={{ padding: 32, marginBottom: 24, textAlign: "center" }}
      >
        <h2
          style={{
            fontSize: "var(--font-xl)",
            fontWeight: 800,
            marginBottom: 20,
          }}
        >
          📊 ATS Compatibility Score
        </h2>

        {atsResult ? (
          <div className="ats-layout">
            <div className="ats-score-panel glass-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 24,
                }}
              >
                <ATSScoreGauge score={atsResult.overallScore} size={180} />
              </div>

              <div className="ats-breakdown">
                {Object.entries(atsResult.sectionScores).map(([key, value]) => (
                  <div key={key} className="breakdown-item">
                    <span
                      style={{
                        fontSize: "var(--font-sm)",
                        fontWeight: 600,
                        textTransform: "capitalize",
                        width: 100,
                      }}
                    >
                      {key}
                    </span>
                    <div className="breakdown-bar">
                      <div
                        className="breakdown-bar-fill"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "var(--font-sm)",
                        fontWeight: 700,
                        width: 40,
                        textAlign: "right",
                      }}
                    >
                      {value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="keywords-section glass-card">
              <h3
                style={{
                  fontSize: "var(--font-base)",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                ✅ Matched Keywords
              </h3>
              <div className="keyword-list">
                {atsResult.matchedKeywords?.map((k) => (
                  <span key={k} className="keyword-match">
                    {k}
                  </span>
                ))}
              </div>

              <h3
                style={{
                  fontSize: "var(--font-base)",
                  fontWeight: 700,
                  marginTop: 20,
                  marginBottom: 8,
                }}
              >
                ❌ Missing Keywords
              </h3>
              <div className="keyword-list">
                {atsResult.missingKeywords?.map((k) => (
                  <span key={k} className="keyword-missing">
                    {k}
                  </span>
                ))}
              </div>

              {atsResult.recommendations?.length > 0 && (
                <>
                  <h3
                    style={{
                      fontSize: "var(--font-base)",
                      fontWeight: 700,
                      marginTop: 20,
                      marginBottom: 8,
                    }}
                  >
                    💡 Recommendations
                  </h3>
                  <ul
                    style={{
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {atsResult.recommendations.map((r, i) => (
                      <li
                        key={i}
                        onClick={() => toggleRecommendation(r)}
                        style={{
                          fontSize: "var(--font-sm)",
                          color: "var(--text-secondary)",
                          paddingLeft: 14,
                          borderLeft: "2px solid var(--accent-primary)",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRecommendations.includes(r)}
                          onChange={() => {}} // Handled by li onClick
                          style={{ marginTop: "3px", cursor: "pointer" }}
                        />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  {selectedRecommendations.length > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 12, width: "100%" }}
                      onClick={applyRecommendations}
                      disabled={isApplyingRecs}
                    >
                      {isApplyingRecs ? "Applying to Resume..." : `Apply ${selectedRecommendations.length} Recommendations to Resume`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              Check how well your resume matches this job&apos;s requirements
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={runATSScore}
              disabled={isScoring}
              id="ats-score-btn"
            >
              {isScoring ? (
                <>
                  <span className="spinner" /> Analyzing...
                </>
              ) : (
                "🔍 Calculate ATS Score"
              )}
            </button>
          </>
        )}
      </div>

      {/* Resume Enhancement */}
      {atsResult && (
        <div
          className="glass-card"
          style={{ padding: 32, marginBottom: 24 }}
        >
          <h2
            style={{
              fontSize: "var(--font-xl)",
              fontWeight: 800,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            ✨ Resume Enhancement
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            AI will rewrite your resume to better match this role&apos;s requirements
          </p>

          {showComparison && enhancedResume ? (
            <ResumeComparison
              original={sessionStorage.getItem("resumeText") || ""}
              enhanced={enhancedResume}
              changes={enhanceChanges}
              latexTemplate={latexTemplate}
            />
          ) : (
            <div style={{ textAlign: "center" }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={enhanceResume}
                disabled={isEnhancing}
                id="enhance-resume-btn"
              >
                {isEnhancing ? (
                  <>
                    <span className="spinner" /> Enhancing...
                  </>
                ) : (
                  "✨ Enhance Resume for This Role"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
