"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  FilePlus2,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import ResumeForm from "@/components/ResumeForm";
import type { PreciseResumeData } from "@/components/ResumeForm";
import ResumePreview from "@/components/ResumePreview";
import KeywordSuggestionsComponent from "@/components/KeywordSuggestions";
import type { KeywordSuggestion } from "@/components/KeywordSuggestions";
import TemplatePicker from "@/components/TemplatePicker";
import ResumeDropzone from "@/components/ResumeDropzone";
import CommandCenter from "@/components/CommandCenter";

const STORAGE_KEY = "jobflow_studio_state";

interface PersistedState {
  resumeData: PreciseResumeData | null;
  resumeFileName: string;
  jobDescription: string;
  suggestions: KeywordSuggestion[];
  matchedKeywords: string[];
  matchPercentage: number;
  selectedTemplate: "modern" | "classic" | "minimal" | "ats";
  resumeUploaded: boolean;
}

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
  const isHydrated = useRef(false);

  // ── Left panel collapse state ────────────────────────────────────────────────
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  // ── Restore state from localStorage on mount ────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state: PersistedState = JSON.parse(saved);
        if (state.resumeData) setResumeData(state.resumeData);
        if (state.resumeFileName) setResumeFileName(state.resumeFileName);
        if (state.jobDescription) setJobDescription(state.jobDescription);
        if (state.suggestions) setSuggestions(state.suggestions);
        if (state.matchedKeywords) setMatchedKeywords(state.matchedKeywords);
        if (state.matchPercentage) setMatchPercentage(state.matchPercentage);
        if (state.selectedTemplate) setSelectedTemplate(state.selectedTemplate);
        if (state.resumeUploaded) setResumeUploaded(state.resumeUploaded);
      }
    } catch {
      // Ignore corrupt localStorage
    }
    isHydrated.current = true;
  }, []);

  // ── Save state to localStorage on every change ──────────────────────────────
  useEffect(() => {
    if (!isHydrated.current) return;
    const state: PersistedState = {
      resumeData,
      resumeFileName,
      jobDescription,
      suggestions,
      matchedKeywords,
      matchPercentage,
      selectedTemplate,
      resumeUploaded,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full — silently fail
    }
  }, [resumeData, resumeFileName, jobDescription, suggestions, matchedKeywords, matchPercentage, selectedTemplate, resumeUploaded]);

  // ── Start new resume (clear everything) ─────────────────────────────────────
  const handleStartNew = useCallback(() => {
    setResumeData(null);
    setResumeUploaded(false);
    setResumeFileName("");
    setJobDescription("");
    setSuggestions([]);
    setMatchedKeywords([]);
    setMatchPercentage(0);
    setSelectedTemplate("modern");
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("resumeText");
  }, []);

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
        updated.summary = updated.summary
          ? `${updated.summary} Experienced with ${suggestion.keyword}.`
          : `Experienced with ${suggestion.keyword}.`;
      } else if (suggestion.section === "experience") {
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
    <div className="page-container studio-page">
      {/* Header */}
      <div className="page-header studio-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <h1>
            <Sparkles
              size={24}
              style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }}
            />
            Resume Studio
          </h1>
        </div>
        {resumeUploaded && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div
              className="badge badge-high"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                fontSize: "var(--font-xs)",
              }}
            >
              <FileText size={12} />
              {resumeFileName}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleStartNew}
              style={{
                fontSize: "var(--font-xs)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: "var(--text-secondary)",
                border: "1px solid var(--border-primary)",
                padding: "4px 10px",
              }}
            >
              <FilePlus2 size={12} />
              New
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-md)",
            marginBottom: 16,
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

      {/* Upload area */}
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
        <div
          className={`studio-layout-3col studio-slide-up ${leftCollapsed ? "left-collapsed" : ""}`}
        >
          {/* LEFT PANEL — Resume Form */}
          <div className={`studio-col-left ${leftCollapsed ? "collapsed" : ""}`}>
            <button
              className="panel-collapse-btn"
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              title={leftCollapsed ? "Expand editor" : "Collapse editor"}
            >
              {leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            {!leftCollapsed && (
              <ResumeForm data={resumeData} onChange={setResumeData} />
            )}
          </div>

          {/* CENTER PANEL — Command Center */}
          <div className="studio-col-center">
            <CommandCenter
              resumeData={resumeData}
              jobDescription={jobDescription}
              onResumeUpdate={setResumeData}
              onAnalyzeGaps={handleAnalyzeGaps}
              isAnalyzing={isAnalyzing}
              onJobDescriptionChange={setJobDescription}
            />

            {/* Keyword Suggestions shown below command center */}
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
          </div>

          {/* RIGHT PANEL — Preview + Export */}
          <div className="studio-col-right">
            {/* Template Picker */}
            <TemplatePicker
              selected={selectedTemplate}
              onSelect={setSelectedTemplate}
            />

            {/* Resume Preview */}
            <ResumePreview data={resumeData} template={selectedTemplate} />

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
      )}
    </div>
  );
}
