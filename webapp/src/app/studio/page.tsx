"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  Wand2,
  Download,
  Sparkles,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  X,
  Brain,
  ScanSearch,
  FileCode,
  Check,
} from "lucide-react";

import ResumeForm from "@/components/ResumeForm";
import type { PreciseResumeData } from "@/components/ResumeForm";
import ResumePreview from "@/components/ResumePreview";
import KeywordSuggestionsComponent from "@/components/KeywordSuggestions";
import type { KeywordSuggestion } from "@/components/KeywordSuggestions";
import TemplatePicker from "@/components/TemplatePicker";
import ResumeDropzone from "@/components/ResumeDropzone";

export default function StudioPage() {
  const [resumeData, setResumeData] = useState<PreciseResumeData | null>(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeFileName, setResumeFileName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [matchPercentage, setMatchPercentage] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<
    "modern" | "classic" | "minimal" | "ats"
  >("modern");
  const [error, setError] = useState<string | null>(null);
  const [parseStage, setParseStage] = useState(0);
  const parseInterval = useRef<NodeJS.Timeout | null>(null);

  // Advance parsing stages for animation
  useEffect(() => {
    if (isParsing) {
      setParseStage(0);
      let stage = 0;
      parseInterval.current = setInterval(() => {
        stage++;
        if (stage <= 4) setParseStage(stage);
      }, 800);
    } else {
      if (parseInterval.current) clearInterval(parseInterval.current);
      if (resumeUploaded) setParseStage(5);
    }
    return () => {
      if (parseInterval.current) clearInterval(parseInterval.current);
    };
  }, [isParsing, resumeUploaded]);

  // Handle resume upload and parse into structured data
  const handleResumeUploaded = async (
    file: File,
    text: string,
    _sessionId: string | null
  ) => {
    setResumeFileName(file.name);
    setIsParsing(true);
    setError(null);

    // Store text in sessionStorage for potential reuse
    sessionStorage.setItem("resumeText", text);

    try {
      const res = await fetch("/api/studio/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text }),
      });

      if (!res.ok) throw new Error("Failed to parse resume");

      const parsed: PreciseResumeData = await res.json();
      setResumeData(parsed);
      setResumeUploaded(true);
    } catch (err) {
      console.error("Parse error:", err);
      setError("Failed to parse resume. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  // Analyze gaps between resume and JD
  const handleAnalyzeGaps = async () => {
    if (!resumeData || !jobDescription.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/studio/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData, jobDescription }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gap analysis failed");
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setMatchedKeywords(data.matched_keywords || []);
      setMatchPercentage(data.match_percentage || 0);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gap analysis failed";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Accept a keyword suggestion and modify resume data
  const handleAcceptSuggestion = (suggestion: KeywordSuggestion) => {
    if (!resumeData) return;

    const updated = { ...resumeData };

    if (suggestion.action_type === "add") {
      if (suggestion.section === "skills") {
        // Add keyword to first skill category
        const skills = [...(updated.skills || [])];
        if (skills.length > 0) {
          skills[0] = {
            ...skills[0],
            skills: [...skills[0].skills, suggestion.keyword],
          };
        } else {
          skills.push({
            name: "Technical Skills",
            skills: [suggestion.keyword],
          });
        }
        updated.skills = skills;
      } else if (suggestion.section === "summary") {
        // Append keyword mention to summary
        updated.summary = updated.summary
          ? `${updated.summary} Experienced with ${suggestion.keyword}.`
          : `Experienced with ${suggestion.keyword}.`;
      } else if (suggestion.section === "experience") {
        // Add as bullet to most recent experience
        const experience = [...(updated.experience || [])];
        if (experience.length > 0) {
          experience[0] = {
            ...experience[0],
            bullets: [
              ...(experience[0].bullets || []),
              `Utilized ${suggestion.keyword} to drive project outcomes and deliver measurable results.`,
            ],
          };
        }
        updated.experience = experience;
      }
    } else if (suggestion.action_type === "rephrase") {
      // Find the rephrase_target bullet in experience and replace
      if (suggestion.rephrase_target && suggestion.rephrase_result) {
        const experience = [...(updated.experience || [])];
        for (let i = 0; i < experience.length; i++) {
          const bullets = [...(experience[i].bullets || [])];
          const bulletIdx = bullets.findIndex(
            (b) => b === suggestion.rephrase_target
          );
          if (bulletIdx !== -1) {
            bullets[bulletIdx] = suggestion.rephrase_result;
            experience[i] = { ...experience[i], bullets };
            break;
          }
        }
        updated.experience = experience;
      }
    }

    setResumeData(updated);

    // Remove accepted suggestion from list
    setSuggestions((prev) =>
      prev.filter((s) => s.keyword !== suggestion.keyword)
    );
  };

  // Dismiss a keyword suggestion
  const handleDismissSuggestion = (index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Download resume in specified format
  const handleDownload = async (format: "pdf" | "docx") => {
    setIsExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeData,
          template: selectedTemplate,
          format,
        }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume_${selectedTemplate}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1>
          <Sparkles
            size={28}
            style={{ display: "inline", verticalAlign: "middle", marginRight: 10 }}
          />
          Resume Studio
        </h1>
        <p>
          Build, optimize, and export your resume with AI-powered gap analysis
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-md)",
            marginBottom: 20,
            color: "#f87171",
            fontSize: "var(--font-sm)",
          }}
        >
          <AlertTriangle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Upload area or file badge */}
      {!resumeUploaded && !isParsing && (
        <div style={{ marginBottom: 24 }}>
          <ResumeDropzone onFileAccepted={handleResumeUploaded} />
        </div>
      )}

      {isParsing && (
        <div className="studio-parse-animation">
          <div className="parse-pipeline">
            {[
              { icon: <Upload size={18} />, label: "Uploading Resume", stage: 0 },
              { icon: <ScanSearch size={18} />, label: "Connecting to AI Engine", stage: 1 },
              { icon: <Brain size={18} />, label: "Extracting Every Detail", stage: 2 },
              { icon: <FileCode size={18} />, label: "Structuring Data", stage: 3 },
              { icon: <Check size={18} />, label: "Complete", stage: 4 },
            ].map((step) => (
              <div
                key={step.stage}
                className={`parse-step ${
                  parseStage > step.stage
                    ? "parse-step-done"
                    : parseStage === step.stage
                      ? "parse-step-active"
                      : "parse-step-pending"
                }`}
              >
                <div className="parse-step-icon">
                  {parseStage > step.stage ? (
                    <CheckCircle2 size={18} />
                  ) : parseStage === step.stage ? (
                    <Loader2 size={18} className="spin-icon" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span className="parse-step-label">{step.label}</span>
              </div>
            ))}
          </div>
          <div className="parse-progress-bar">
            <div
              className="parse-progress-fill"
              style={{ width: `${Math.min((parseStage + 1) * 20, 100)}%` }}
            />
          </div>
        </div>
      )}

      {resumeUploaded && resumeData && (
        <>
          {/* File badge */}
          <div className="studio-fade-in" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div
              className="badge badge-high"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
              }}
            >
              <FileText size={14} />
              {resumeFileName}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setResumeUploaded(false);
                setResumeData(null);
                setResumeFileName("");
                setSuggestions([]);
                setMatchedKeywords([]);
                setMatchPercentage(0);
                setJobDescription("");
              }}
              style={{ fontSize: "var(--font-xs)" }}
            >
              <Upload size={12} />
              Upload Different
            </button>
          </div>

          {/* Three-panel layout */}
          <div className="studio-layout studio-slide-up">
            {/* LEFT PANEL - Resume Form */}
            <div className="studio-left">
              <ResumeForm data={resumeData} onChange={setResumeData} />
            </div>

            {/* RIGHT PANEL */}
            <div className="studio-right">
              {/* JD Paste Area */}
              <div className="jd-paste-area">
                <label className="form-label" style={{ marginBottom: 8 }}>
                  <Wand2
                    size={12}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                      marginRight: 6,
                    }}
                  />
                  JOB DESCRIPTION
                </label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Paste the job description here to analyze keyword gaps..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  style={{ minHeight: 120 }}
                />
                <div className="jd-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAnalyzeGaps}
                    disabled={
                      isAnalyzing || !jobDescription.trim() || !resumeData
                    }
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={14} className="spin-icon" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Analyze Gaps
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Keyword Suggestions */}
              {(suggestions.length > 0 || isAnalyzing) && (
                <KeywordSuggestionsComponent
                  suggestions={suggestions}
                  matchedKeywords={matchedKeywords}
                  matchPercentage={matchPercentage}
                  onAccept={handleAcceptSuggestion}
                  onReject={handleDismissSuggestion}
                  isLoading={isAnalyzing}
                />
              )}

              {/* Template Picker */}
              <TemplatePicker
                selected={selectedTemplate}
                onSelect={setSelectedTemplate}
              />

              {/* Resume Preview */}
              <ResumePreview
                data={resumeData}
                template={selectedTemplate}
              />

              {/* Download Bar */}
              <div className="download-bar">
                <button
                  className="btn btn-primary"
                  onClick={() => handleDownload("pdf")}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 size={16} className="spin-icon" />
                  ) : (
                    <FileText size={16} />
                  )}
                  Download PDF
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleDownload("docx")}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 size={16} className="spin-icon" />
                  ) : (
                    <Download size={16} />
                  )}
                  Download DOCX
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
