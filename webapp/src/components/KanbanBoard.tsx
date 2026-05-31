"use client";

import { useState } from "react";

interface Application {
  _id: string;
  jobTitle: string;
  company: string;
  status: string;
  atsScore?: number;
  appliedAt?: string;
}

const COLUMNS = [
  { id: "interested", label: "Interested", icon: "👀" },
  { id: "applied", label: "Applied", icon: "📨" },
  { id: "interview", label: "Interview", icon: "🎤" },
  { id: "offer", label: "Offer", icon: "🎉" },
  { id: "rejected", label: "Rejected", icon: "❌" },
];

interface KanbanBoardProps {
  applications: Application[];
  onStatusChange: (appId: string, newStatus: string) => void;
}

export default function KanbanBoard({
  applications,
  onStatusChange,
}: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const getColumnApps = (status: string) =>
    applications.filter((a) => a.status === status);

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const onDragLeave = () => setDragOverCol(null);

  const onDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(null);
    if (draggedId) {
      onStatusChange(draggedId, colId);
      setDraggedId(null);
    }
  };

  return (
    <div className="kanban-board">
      {COLUMNS.map((col) => {
        const colApps = getColumnApps(col.id);
        return (
          <div
            key={col.id}
            className="kanban-column"
            onDragOver={(e) => onDragOver(e, col.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, col.id)}
            style={{
              borderColor:
                dragOverCol === col.id
                  ? "var(--accent-primary)"
                  : undefined,
            }}
          >
            <div className="kanban-column-header">
              <span className="column-title">
                {col.icon} {col.label}
              </span>
              <span className="column-count">{colApps.length}</span>
            </div>

            <div className="kanban-items">
              {colApps.map((app) => (
                <div
                  key={app._id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, app._id)}
                  style={{
                    opacity: draggedId === app._id ? 0.5 : 1,
                  }}
                >
                  <div className="card-title">{app.jobTitle}</div>
                  <div className="card-company">{app.company}</div>
                  <div className="card-footer">
                    {app.atsScore !== undefined && (
                      <span
                        className={`badge ${
                          app.atsScore >= 70
                            ? "badge-high"
                            : app.atsScore >= 50
                            ? "badge-mid"
                            : "badge-low"
                        }`}
                      >
                        ATS {app.atsScore}%
                      </span>
                    )}
                    {app.appliedAt && (
                      <span
                        style={{
                          fontSize: "var(--font-xs)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {new Date(app.appliedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {colApps.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 10px",
                    fontSize: "var(--font-xs)",
                    color: "var(--text-tertiary)",
                    border: "1px dashed var(--border-secondary)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type { Application };
