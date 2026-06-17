"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Wand2,
  ScanSearch,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Terminal,
} from "lucide-react";
import type { PreciseResumeData } from "@/components/ResumeForm";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  type?: "text" | "action" | "result" | "error";
  isLoading?: boolean;
}

interface CommandCenterProps {
  resumeData: PreciseResumeData | null;
  jobDescription: string;
  onResumeUpdate: (data: PreciseResumeData) => void;
  onAnalyzeGaps: () => void;
  isAnalyzing: boolean;
  onJobDescriptionChange: (jd: string) => void;
}

// ── Quick Action Buttons ───────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: "Analyze Gaps",
    icon: ScanSearch,
    prompt: "/analyze-gaps",
    description: "Run ATS gap analysis against JD",
  },
  {
    label: "Enhance Resume",
    icon: Wand2,
    prompt: "/enhance",
    description: "AI-rewrite resume for target role",
  },
  {
    label: "Add Keywords",
    icon: Sparkles,
    prompt: "/add-keywords",
    description: "Intelligently embed missing keywords",
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function CommandCenter({
  resumeData,
  jobDescription,
  onResumeUpdate,
  onAnalyzeGaps,
  isAnalyzing,
  onJobDescriptionChange,
}: CommandCenterProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "Welcome to the Command Center. Upload a resume and paste a JD to get started. You can type commands or use the quick actions below.",
      timestamp: new Date(),
      type: "text",
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Add a message
  const addMessage = useCallback(
    (
      role: ChatMessage["role"],
      content: string,
      type: ChatMessage["type"] = "text"
    ) => {
      const msg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        content,
        timestamp: new Date(),
        type,
      };
      setMessages((prev) => [...prev, msg]);
      return msg.id;
    },
    []
  );

  // Handle sending a prompt
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isProcessing) return;

    setInput("");
    addMessage("user", text);

    // Route commands
    if (text === "/analyze-gaps" || text.toLowerCase().startsWith("analyze gap")) {
      await handleAnalyzeGaps();
    } else if (text === "/enhance" || text.toLowerCase().startsWith("enhance")) {
      await handleEnhance(text);
    } else if (
      text === "/add-keywords" ||
      text.toLowerCase().startsWith("add keyword")
    ) {
      await handleAddKeywords(text);
    } else {
      // Free-form prompt to the AI
      await handleFreePrompt(text);
    }
  };

  // ── Command Handlers ─────────────────────────────────────────────────────────

  const handleAnalyzeGaps = async () => {
    if (!resumeData) {
      addMessage(
        "assistant",
        "Please upload a resume first before analyzing gaps.",
        "error"
      );
      return;
    }
    if (!jobDescription.trim()) {
      addMessage(
        "assistant",
        "Please paste a job description in the JD field first.",
        "error"
      );
      return;
    }

    addMessage("assistant", "🔍 Running ATS gap analysis against the job description...", "action");
    onAnalyzeGaps();
  };

  const handleEnhance = async (prompt: string) => {
    if (!resumeData) {
      addMessage("assistant", "Upload a resume first.", "error");
      return;
    }

    setIsProcessing(true);
    addMessage("assistant", "✨ Enhancing your resume with AI...", "action");

    try {
      const resumeText = sessionStorage.getItem("resumeText") || "";
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobTitle: "",
          jobDescription,
          missingKeywords: [],
        }),
      });

      if (!res.ok) throw new Error("Enhancement failed");
      const data = await res.json();
      addMessage(
        "assistant",
        `✅ Resume enhanced successfully!\n\nChanges made:\n${(data.changes || []).map((c: string) => `• ${c}`).join("\n")}`,
        "result"
      );
    } catch {
      addMessage(
        "assistant",
        "Failed to enhance resume. Make sure the AI backend is running.",
        "error"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddKeywords = async (prompt: string) => {
    if (!resumeData) {
      addMessage("assistant", "Upload a resume first.", "error");
      return;
    }

    setIsProcessing(true);
    addMessage(
      "assistant",
      "🔑 Extracting keywords and finding optimal placement...",
      "action"
    );

    try {
      // Extract keywords from the prompt if any specified
      const keywordsMatch = prompt.match(
        /add keywords?\s*:?\s*(.+)/i
      );
      const keywords = keywordsMatch
        ? keywordsMatch[1].split(",").map((k) => k.trim())
        : [];

      if (keywords.length === 0) {
        addMessage(
          "assistant",
          'Specify keywords to add, e.g.: "add keywords: Python, Docker, Kubernetes"',
          "text"
        );
        return;
      }

      const resumeText = sessionStorage.getItem("resumeText") || "";
      const res = await fetch("/api/apply-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          selected_keywords: keywords,
        }),
      });

      if (!res.ok) throw new Error("Apply keywords failed");
      const data = await res.json();
      addMessage(
        "assistant",
        `✅ Keywords integrated into your resume:\n${keywords.map((k) => `• ${k}`).join("\n")}\n\nThe AI agent found the most natural placement for each keyword.`,
        "result"
      );
    } catch {
      addMessage(
        "assistant",
        "Failed to add keywords. Ensure the AI backend is running.",
        "error"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFreePrompt = async (prompt: string) => {
    if (!resumeData) {
      addMessage(
        "assistant",
        "Upload a resume first to interact with the AI agents.",
        "error"
      );
      return;
    }

    setIsProcessing(true);
    addMessage("assistant", "🧠 Thinking...", "action");

    try {
      const resumeText = sessionStorage.getItem("resumeText") || "";
      const res = await fetch("/api/studio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          resumeText,
          jobDescription,
          resumeData,
        }),
      });

      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();

      // Remove the "Thinking..." message and add the real response
      setMessages((prev) => prev.filter((m) => m.content !== "🧠 Thinking..."));
      addMessage("assistant", data.response || "Done.", "result");

      if (data.updatedResumeData) {
        onResumeUpdate(data.updatedResumeData);
        addMessage(
          "system",
          "Resume data updated based on AI response.",
          "action"
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.content !== "🧠 Thinking..."));
      addMessage(
        "assistant",
        "Could not process your request. The AI backend may be offline — try a specific command like `/analyze-gaps` instead.",
        "error"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Update messages when gap analysis state changes
  useEffect(() => {
    if (isAnalyzing) {
      // Already handled by the command
    }
  }, [isAnalyzing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="command-center">
      {/* Header */}
      <div className="cc-header">
        <div className="cc-header-left">
          <Terminal size={16} />
          <span className="cc-title">Command Center</span>
        </div>
        <div className="cc-header-right">
          <span className="cc-status-dot" />
          <span className="cc-status-text">
            {isProcessing || isAnalyzing ? "Processing" : "Ready"}
          </span>
        </div>
      </div>

      {/* JD Input Area */}
      <div className="cc-jd-area">
        <label className="cc-jd-label">
          <Wand2 size={11} />
          JOB DESCRIPTION
        </label>
        <textarea
          className="cc-jd-textarea"
          placeholder="Paste the target job description here..."
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          rows={3}
        />
      </div>

      {/* Quick Actions */}
      <div className="cc-quick-actions">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          const isDisabled =
            !resumeData ||
            (action.prompt === "/analyze-gaps" && !jobDescription.trim());
          return (
            <button
              key={action.prompt}
              className="cc-action-btn"
              disabled={isDisabled || isProcessing || isAnalyzing}
              onClick={() => {
                setInput("");
                addMessage("user", action.prompt);
                if (action.prompt === "/analyze-gaps") {
                  handleAnalyzeGaps();
                } else if (action.prompt === "/enhance") {
                  handleEnhance(action.prompt);
                } else if (action.prompt === "/add-keywords") {
                  addMessage(
                    "assistant",
                    'Type which keywords you want to add, e.g.: "add keywords: Python, Docker"',
                    "text"
                  );
                }
              }}
            >
              <Icon size={13} />
              {action.label}
            </button>
          );
        })}
      </div>

      {/* Chat Messages */}
      <div className="cc-messages" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`cc-msg cc-msg-${msg.role}`}>
            <div className="cc-msg-avatar">
              {msg.role === "user" ? (
                <User size={14} />
              ) : msg.role === "system" ? (
                <Zap size={14} />
              ) : (
                <Bot size={14} />
              )}
            </div>
            <div className="cc-msg-body">
              <div
                className={`cc-msg-bubble ${msg.type === "error" ? "cc-msg-error" : ""} ${msg.type === "action" ? "cc-msg-action" : ""} ${msg.type === "result" ? "cc-msg-result" : ""}`}
              >
                {msg.content.split("\n").map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < msg.content.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
              <span className="cc-msg-time">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
        {(isProcessing || isAnalyzing) && (
          <div className="cc-msg cc-msg-assistant">
            <div className="cc-msg-avatar">
              <Bot size={14} />
            </div>
            <div className="cc-msg-body">
              <div className="cc-msg-bubble cc-msg-action">
                <Loader2 size={14} className="spin-icon" />
                <span style={{ marginLeft: 6 }}>
                  {isAnalyzing
                    ? "Analyzing keyword gaps..."
                    : "Processing..."}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="cc-input-area">
        <textarea
          ref={inputRef}
          className="cc-input"
          placeholder={
            resumeData
              ? 'Type a command or ask the AI... (e.g., "add keywords: Python, Docker")'
              : "Upload a resume to start..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!resumeData || isProcessing || isAnalyzing}
        />
        <button
          className="cc-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isProcessing || isAnalyzing}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
