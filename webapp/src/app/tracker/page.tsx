"use client";

import { useEffect, useState } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import type { Application } from "@/components/KanbanBoard";

export default function TrackerPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const res = await fetch("/api/applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => (a._id === appId ? { ...a, status: newStatus } : a))
    );

    try {
      await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appId, status: newStatus }),
      });
    } catch (err) {
      console.error("Failed to update status:", err);
      fetchApplications(); // revert on error
    }
  };

  const triggerInboxSync = async () => {
    setIsSyncing(true);
    setSyncLogs(["Connecting to Mailbox Agent..."]);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${backendUrl}/sync-inbox`, {
        method: "POST"
      });
      const data = await res.json();
      
      if (data.success) {
        setSyncLogs(prev => [...prev, ...data.messages]);
        // Refresh kanban board to show automated AI transitions
        if (data.updated_applications > 0) {
            await fetchApplications(); 
        }
      } else {
        setSyncLogs(["❌ Sync Failed: " + data.error]);
      }
    } catch (err: any) {
      setSyncLogs(["❌ Sync Failed: " + err.message]);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncLogs([]), 8000); // clear after 8s
    }
  };

  const stats = {
    total: applications.length,
    applied: applications.filter((a) => a.status === "applied").length,
    interviews: applications.filter((a) => a.status === "interview").length,
    offers: applications.filter((a) => a.status === "offer").length,
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Application Tracker</h1>
          <p>Track and manage all your job applications in one place</p>
        </div>
        <div>
          <button 
             className="btn btn-secondary" 
             disabled
             title="Email inbox integration coming soon"
          >
            📧 Inbox Sync (Coming Soon)
          </button>
        </div>
      </div>
      
      {/* Inbox Logs Toast */}
      {syncLogs.length > 0 && (
         <div style={{
            background: "rgba(0,0,0,0.6)",
            border: "1px solid var(--accent-primary)",
            padding: 16,
            borderRadius: "var(--radius-md)",
            marginBottom: 24,
            fontSize: "var(--font-sm)",
            fontFamily: "monospace"
         }}>
            <strong>🤖 Inbox Tracker Logs:</strong>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {syncLogs.map((log, i) => <li key={i}>{log}</li>)}
            </ul>
         </div>
      )}

      {/* Stats */}
      <div className="stats-grid stagger-enter">
        <div className="stat-card glass-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Jobs Tracked</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-value">{stats.applied}</div>
          <div className="stat-label">Applied</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-value">{stats.interviews}</div>
          <div className="stat-label">Interviews</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-value">{stats.offers}</div>
          <div className="stat-label">Offers</div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <h3 style={{ marginTop: 16 }}>Loading Applications...</h3>
        </div>
      ) : applications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No Applications Yet</h3>
          <p>
            Start by analyzing your resume and finding matching jobs. You can
            track applications from the job detail page.
          </p>
          <a href="/jobs" className="btn btn-primary" style={{ marginTop: 20 }}>
            Browse Jobs
          </a>
        </div>
      ) : (
        <KanbanBoard
          applications={applications}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
