"use client";

// ── Types ──────────────────────────────────────────────────────────────────────
type TemplateType = "modern" | "classic" | "minimal" | "ats";

interface TemplatePickerProps {
  selected: TemplateType;
  onSelect: (template: TemplateType) => void;
}

// ── Template Definitions ───────────────────────────────────────────────────────
interface TemplateDef {
  id: TemplateType;
  name: string;
  icon: string;
  subtitle: string;
  accent: string;
  accentGlow: string;
  previewBg: string;
  previewAccent: string;
  previewTextPrimary: string;
  previewTextSecondary: string;
}

const templates: TemplateDef[] = [
  {
    id: "modern",
    name: "Modern",
    icon: "✨",
    subtitle: "Clean & Professional",
    accent: "#3772ff",
    accentGlow: "rgba(55, 114, 255, 0.35)",
    previewBg: "#ffffff",
    previewAccent: "#3772ff",
    previewTextPrimary: "#1a1a1a",
    previewTextSecondary: "#bbb",
  },
  {
    id: "classic",
    name: "Classic",
    icon: "📜",
    subtitle: "Traditional & Elegant",
    accent: "#e6a817",
    accentGlow: "rgba(230, 168, 23, 0.35)",
    previewBg: "#fffdf5",
    previewAccent: "#c89a15",
    previewTextPrimary: "#222",
    previewTextSecondary: "#d5cdb5",
  },
  {
    id: "minimal",
    name: "Minimal",
    icon: "◻️",
    subtitle: "Simple & Clean",
    accent: "#9a9fa5",
    accentGlow: "rgba(154, 159, 165, 0.35)",
    previewBg: "#fafafa",
    previewAccent: "#e0e0e0",
    previewTextPrimary: "#444",
    previewTextSecondary: "#e5e5e5",
  },
  {
    id: "ats",
    name: "ATS",
    icon: "🤖",
    subtitle: "Maximum ATS Score",
    accent: "#22c55e",
    accentGlow: "rgba(34, 197, 94, 0.35)",
    previewBg: "#ffffff",
    previewAccent: "#000",
    previewTextPrimary: "#000",
    previewTextSecondary: "#ccc",
  },
];

// ── Mini Resume Preview ────────────────────────────────────────────────────────
function MiniPreview({ t }: { t: TemplateDef }) {
  const blockBase: React.CSSProperties = {
    borderRadius: 2,
    transition: "all var(--transition-fast)",
  };

  return (
    <div
      style={{
        width: "100%",
        height: 120,
        background: t.previewBg,
        borderRadius: 6,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      {/* Name block */}
      <div
        style={{
          ...blockBase,
          width: "55%",
          height: 8,
          background: t.previewTextPrimary,
          opacity: 0.85,
          borderRadius: 3,
        }}
      />
      {/* Contact line */}
      <div style={{ display: "flex", gap: 4 }}>
        <div
          style={{
            ...blockBase,
            width: "20%",
            height: 4,
            background: t.previewTextSecondary,
          }}
        />
        <div
          style={{
            ...blockBase,
            width: "25%",
            height: 4,
            background: t.previewTextSecondary,
          }}
        />
        <div
          style={{
            ...blockBase,
            width: "15%",
            height: 4,
            background: t.previewTextSecondary,
          }}
        />
      </div>

      {/* Section header */}
      <div
        style={{
          ...blockBase,
          width: "35%",
          height: 5,
          background: t.previewAccent,
          marginTop: 4,
          opacity: 0.9,
          borderRadius: 2,
        }}
      />
      {/* Content lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          style={{
            ...blockBase,
            width: "90%",
            height: 3,
            background: t.previewTextSecondary,
            opacity: 0.7,
          }}
        />
        <div
          style={{
            ...blockBase,
            width: "78%",
            height: 3,
            background: t.previewTextSecondary,
            opacity: 0.7,
          }}
        />
        <div
          style={{
            ...blockBase,
            width: "85%",
            height: 3,
            background: t.previewTextSecondary,
            opacity: 0.7,
          }}
        />
      </div>

      {/* Another section header */}
      <div
        style={{
          ...blockBase,
          width: "28%",
          height: 5,
          background: t.previewAccent,
          marginTop: 3,
          opacity: 0.9,
          borderRadius: 2,
        }}
      />
      {/* More content lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          style={{
            ...blockBase,
            width: "80%",
            height: 3,
            background: t.previewTextSecondary,
            opacity: 0.5,
          }}
        />
        <div
          style={{
            ...blockBase,
            width: "65%",
            height: 3,
            background: t.previewTextSecondary,
            opacity: 0.5,
          }}
        />
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TemplatePicker({ selected, onSelect }: TemplatePickerProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        width: "100%",
      }}
    >
      {templates.map((t) => {
        const isSelected = selected === t.id;

        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              flex: 1,
              background: "var(--bg-card)",
              border: isSelected
                ? `2px solid ${t.accent}`
                : "1px solid var(--border-primary)",
              borderRadius: "var(--radius-lg)",
              padding: 14,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              transition: "all var(--transition-base)",
              transform: isSelected ? "scale(1.02)" : "scale(1)",
              boxShadow: isSelected
                ? `0 0 20px ${t.accentGlow}, 0 8px 30px rgba(0,0,0,0.2)`
                : "var(--shadow-sm)",
              fontFamily: "var(--font-family)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                const el = e.currentTarget;
                el.style.transform = "scale(1.01)";
                el.style.boxShadow = `0 0 12px ${t.accentGlow}, var(--shadow-md)`;
                el.style.borderColor = `${t.accent}66`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                const el = e.currentTarget;
                el.style.transform = "scale(1)";
                el.style.boxShadow = "var(--shadow-sm)";
                el.style.borderColor = "var(--border-primary)";
              }
            }}
          >
            {/* Selected indicator dot */}
            {isSelected && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: t.accent,
                  boxShadow: `0 0 8px ${t.accent}`,
                }}
              />
            )}

            {/* Mini Preview */}
            <MiniPreview t={t} />

            {/* Icon */}
            <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{t.icon}</span>

            {/* Name */}
            <span
              style={{
                fontSize: "var(--font-sm)",
                fontWeight: 700,
                color: isSelected ? t.accent : "var(--text-primary)",
                transition: "color var(--transition-fast)",
              }}
            >
              {t.name}
            </span>

            {/* Subtitle */}
            <span
              style={{
                fontSize: "var(--font-xs)",
                color: "var(--text-tertiary)",
                fontWeight: 400,
                lineHeight: 1.3,
              }}
            >
              {t.subtitle}
            </span>
          </button>
        );
      })}
    </div>
  );
}
