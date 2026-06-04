"use client";

import { useState, useEffect } from "react";
import { 
  Cpu, 
  Layers, 
  Activity, 
  Terminal, 
  X, 
  Globe, 
  Database, 
  AlertTriangle, 
  RefreshCw,
  Server,
  Zap
} from "lucide-react";

interface HealthData {
  status: string;
  fastapi: boolean;
  fastapiUrl: string;
  timestamp: string;
  mongodb?: string;
  redis?: string;
}

export default function DevConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"blueprint" | "agents" | "system">("blueprint");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [diagnosticsLog, setDiagnosticsLog] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    setDiagnosticsLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Fetching system health...`]);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setDiagnosticsLog((prev) => [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] Frontend Status: OK`,
          `[${new Date().toLocaleTimeString()}] Backend Status: ${data.fastapi ? "ONLINE" : "OFFLINE"} (${data.fastapiUrl})`
        ]);

        // Attempt detailed check
        if (data.fastapi) {
          try {
            const detailRes = await fetch(`${data.fastapiUrl}/health/detailed`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              setHealth((prev) => prev ? { ...prev, mongodb: detailData.checks?.mongodb, redis: detailData.checks?.redis } : null);
              setDiagnosticsLog((prev) => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] MongoDB Check: ${detailData.checks?.mongodb || "unknown"}`,
                `[${new Date().toLocaleTimeString()}] Redis Check: ${detailData.checks?.redis || "unknown"}`
              ]);
            }
          } catch {
            setDiagnosticsLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Detailed backend health check failed.`]);
          }
        }
      } else {
        setDiagnosticsLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Health check endpoint returned status ${res.status}`]);
      }
    } catch (err: any) {
      setDiagnosticsLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Health check error: ${err.message}`]);
    } finally {
      setLoadingHealth(false);
    }
  };

  if (!isClient) return null;

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="dev-console-toggle-btn"
        aria-label="Toggle Developer Console"
      >
        <span className="pulse-dot" />
        <Cpu size={18} />
        <span>Dev Console</span>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="dev-console-backdrop" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Main Drawer Panel */}
      <div className={`dev-console-panel ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="dev-console-header">
          <div className="title-wrapper">
            <span className="brand-logo">
              <Zap size={16} fill="var(--accent-primary-light)" color="var(--accent-primary-light)" />
            </span>
            <div>
              <h3>JobFlow AI Console</h3>
              <p>v1.0.4-agentic-beta</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="close-btn"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* System Banner */}
        <div className="dev-console-badge-bar">
          <div className="status-indicator">
            <span className="status-ping" />
            <span>Active Synthesis supervised by JobFlow Orchestrator</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="dev-console-tabs">
          <button 
            className={activeTab === "blueprint" ? "active" : ""} 
            onClick={() => setActiveTab("blueprint")}
          >
            <Layers size={14} />
            Blueprint
          </button>
          <button 
            className={activeTab === "agents" ? "active" : ""} 
            onClick={() => setActiveTab("agents")}
          >
            <Cpu size={14} />
            Agents
          </button>
          <button 
            className={activeTab === "system" ? "active" : ""} 
            onClick={() => setActiveTab("system")}
          >
            <Terminal size={14} />
            Diagnostics
          </button>
        </div>

        {/* Content Area */}
        <div className="dev-console-content">
          {/* TAB 1: BLUEPRINT */}
          {activeTab === "blueprint" && (
            <div className="blueprint-view">
              <h4>System Architecture Blueprint</h4>
              <p className="blueprint-desc">
                JobFlow AI utilizes a multi-layered agentic layout built with LangGraph, MongoDB, and Next.js.
              </p>

              {/* Architectural Nodes Flowchart */}
              <div className="flowchart">
                <div className="flow-node frontend">
                  <div className="node-hdr">Next.js Webapp</div>
                  <div className="node-body">UI, File Ingestion, Job Tracker, Dev Console</div>
                </div>
                
                <div className="flow-connector">↓ API Proxy</div>

                <div className="flow-node backend">
                  <div className="node-hdr">FastAPI Bridge Server</div>
                  <div className="node-body">Uvicorn on Port 8000, SSE Matches stream</div>
                </div>

                <div className="flow-connector">↓ invokes langgraph</div>

                <div className="flow-node graph">
                  <div className="node-hdr">LangGraph Job Discovery</div>
                  <div className="node-body">
                    Search Node → Extract Node → Quality Gate → Match & Rank Node
                  </div>
                </div>

                <div className="flow-connector">↓ database persistence</div>

                <div className="flow-node database">
                  <div className="node-hdr">Data Layer (MongoDB & Redis)</div>
                  <div className="node-body">Resume Session TTL cache, Jobs store</div>
                </div>
              </div>

              <div className="architect-note">
                <h5>Architectural Design:</h5>
                <p>
                  Built for decoupled, event-driven streaming. Resume uploads are parsed locally as a fallback, 
                  or streamed to the LangGraph node using a server-side session index to prevent massive payload transfers.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: AGENT TELEMETRY */}
          {activeTab === "agents" && (
            <div className="agents-view">
              <h4>Active Autonomous Agents</h4>
              <p className="blueprint-desc">
                Telemetry of active AI operators processing jobs and layout structures.
              </p>

              <div className="agent-cards">
                {/* JobFlow Orchestrator Agent */}
                <div className="agent-telemetry-card highlight">
                  <div className="agent-meta">
                    <span className="agent-avatar active">💼</span>
                    <div>
                      <h5>JobFlow Architect (AI Agent)</h5>
                      <span className="model-badge">Gemini 3.5 Flash</span>
                    </div>
                    <span className="status-badge running">RUNNING</span>
                  </div>
                  <p className="agent-desc">
                    Supervises active sessions, coordinates layout rendering, checks ATS alignment, and optimizes queries.
                  </p>
                  <div className="telemetry-stats">
                    <div><span>Task</span><span>Orchestrating UI</span></div>
                    <div><span>Role</span><span>System Architect</span></div>
                  </div>
                </div>

                {/* Resume Parsing Node */}
                <div className="agent-telemetry-card">
                  <div className="agent-meta">
                    <span className="agent-avatar">📄</span>
                    <div>
                      <h5>Parse Agent (parse_resume)</h5>
                      <span className="model-badge">DeepSeek Chat</span>
                    </div>
                    <span className="status-badge idle">IDLE</span>
                  </div>
                  <p className="agent-desc">
                    Extracts raw skills, education, and career details from pdf/docx files and builds structured profiles.
                  </p>
                </div>

                {/* Job Search Agent */}
                <div className="agent-telemetry-card">
                  <div className="agent-meta">
                    <span className="agent-avatar">🔍</span>
                    <div>
                      <h5>Search Agent (search_node)</h5>
                      <span className="model-badge">DeepSeek Chat</span>
                    </div>
                    <span className="status-badge idle">IDLE</span>
                  </div>
                  <p className="agent-desc">
                    Generates search queries based on profile skills, query parameters, and gathers job boards indexes.
                  </p>
                </div>

                {/* Quality Gate Agent */}
                <div className="agent-telemetry-card">
                  <div className="agent-meta">
                    <span className="agent-avatar">🛡️</span>
                    <div>
                      <h5>Quality Gate (quality_gate)</h5>
                      <span className="model-badge">Gemini 2.0 Flash</span>
                    </div>
                    <span className="status-badge idle">IDLE</span>
                  </div>
                  <p className="agent-desc">
                    Validates job descriptions, filters spam, verifies remote policies, and scores profile relevance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM DIAGNOSTICS */}
          {activeTab === "system" && (
            <div className="system-view">
              <h4>System Live Diagnostics</h4>
              
              <div className="system-grid">
                <div className="sys-metric">
                  <span>Frontend Server</span>
                  <span className="metric-val online">Online</span>
                </div>
                <div className="sys-metric">
                  <span>FastAPI Server</span>
                  <span className={`metric-val ${health?.fastapi ? "online" : "offline"}`}>
                    {health?.fastapi ? "Online" : "Offline"}
                  </span>
                </div>
                <div className="sys-metric">
                  <span>MongoDB Service</span>
                  <span className={`metric-val ${health?.mongodb === "ok" ? "online" : "offline"}`}>
                    {health?.mongodb === "ok" ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="sys-metric">
                  <span>Redis Service</span>
                  <span className={`metric-val ${health?.redis === "ok" ? "online" : "offline"}`}>
                    {health?.redis === "ok" ? "Connected" : "Memory Fallback"}
                  </span>
                </div>
              </div>

              <div className="actions-row">
                <button 
                  onClick={fetchHealth} 
                  disabled={loadingHealth}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <RefreshCw size={12} className={loadingHealth ? "spin-animation" : ""} />
                  Run Self-Diagnostics
                </button>
              </div>

              <div className="console-log-box">
                <div className="console-hdr">
                  <span>Diagnostics Shell</span>
                  <button onClick={() => setDiagnosticsLog([])} className="clear-btn">Clear</button>
                </div>
                <div className="console-body">
                  {diagnosticsLog.map((log, i) => (
                    <div key={i} className="console-line">{log}</div>
                  ))}
                  {diagnosticsLog.length === 0 && (
                    <div className="console-line empty">Console is clear. Run self-diagnostics to log system telemetry.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel Footer */}
        <div className="dev-console-footer">
          <p>
            Dynamically orchestrated and maintained by the <strong>JobFlow AI Core</strong>.
          </p>
        </div>
      </div>
    </>
  );
}
