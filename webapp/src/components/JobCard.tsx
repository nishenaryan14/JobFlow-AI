"use client";

export interface JobData {
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
  applicationStatus?: string | null;
}

interface JobCardProps {
  job: JobData;
  onClick: (job: JobData) => void;
}

function getScoreBadge(score: number) {
  if (score >= 7) return "badge badge-high";
  if (score >= 5) return "badge badge-mid";
  return "badge badge-low";
}

function getInitials(company: string) {
  return company
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function getStatusStyle(status: string) {
  switch (status) {
    case "applied":
      return { label: "Applied", icon: "✅", color: "#22c55e", bg: "rgba(34,197,94,0.10)" };
    case "interview":
      return { label: "Interview", icon: "🎤", color: "#a78bfa", bg: "rgba(167,139,250,0.10)" };
    case "offer":
      return { label: "Offer", icon: "🎉", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" };
    case "rejected":
      return { label: "Rejected", icon: "❌", color: "#ef4444", bg: "rgba(239,68,68,0.10)" };
    case "interested":
      return { label: "Interested", icon: "👀", color: "#60a5fa", bg: "rgba(96,165,250,0.10)" };
    default:
      return { label: status, icon: "📌", color: "#888", bg: "rgba(136,136,136,0.08)" };
  }
}

export default function JobCard({ job, onClick }: JobCardProps) {
  const appStatus = job.applicationStatus;
  const statusInfo = appStatus ? getStatusStyle(appStatus) : null;

  return (
    <div
      className="job-card glass-card"
      onClick={() => onClick(job)}
      id={`job-card-${job._id}`}
    >
      {/* Header: Avatar + Title + Company */}
      <div className="job-card-header">
        <div className="company-avatar">{getInitials(job.company)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="job-card-title">{job.title}</div>
          <div className="job-card-company">{job.company}</div>
        </div>
      </div>

      {/* Meta: location + remote + application status (inline, no overlap) */}
      <div className="job-card-meta">
        <span className="meta-tag">📍 {job.location || "Remote"}</span>
        {job.remotePolicy && (
          <span className="meta-tag">🏠 {job.remotePolicy}</span>
        )}
        {statusInfo && (
          <span
            className="meta-tag"
            style={{
              color: statusInfo.color,
              background: statusInfo.bg,
              border: `1px solid ${statusInfo.color}40`,
              fontWeight: 700,
            }}
          >
            {statusInfo.icon} {statusInfo.label}
          </span>
        )}
      </div>

      {/* Skills */}
      <div className="job-card-skills">
        {job.matchingSkills?.slice(0, 4).map((skill) => (
          <span key={skill} className="skill-tag strong">
            {skill}
          </span>
        ))}
        {job.skillGaps?.slice(0, 2).map((gap) => (
          <span key={gap} className="skill-tag">
            {gap}
          </span>
        ))}
      </div>

      {/* Footer: score + action */}
      <div className="job-card-footer">
        <span className={getScoreBadge(job.fitScore)}>
          ⭐ {job.fitScore}/10 Fit
        </span>
        <button
          className="btn btn-sm btn-secondary"
          onClick={(e) => {
            e.stopPropagation();
            onClick(job);
          }}
        >
          {appStatus ? "View Details →" : "View & Apply →"}
        </button>
      </div>
    </div>
  );
}
