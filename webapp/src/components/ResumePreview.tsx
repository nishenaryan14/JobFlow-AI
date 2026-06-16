"use client";

import type {
  PreciseResumeData,
  ContactInfo,
  ExperienceItem,
  EducationItem,
  SkillCategory,
  ProjectItem,
} from "./ResumeForm";

// ── Types ──────────────────────────────────────────────────────────────────────
type TemplateType = "modern" | "classic" | "minimal" | "ats";

interface ResumePreviewProps {
  data: PreciseResumeData | null;
  template: TemplateType;
}

// ── Template Style Factories ───────────────────────────────────────────────────
interface TemplateStyles {
  container: React.CSSProperties;
  name: React.CSSProperties;
  contactRow: React.CSSProperties;
  contactItem: React.CSSProperties;
  sectionTitle: React.CSSProperties;
  sectionDivider: React.CSSProperties;
  entryTitle: React.CSSProperties;
  entrySubtitle: React.CSSProperties;
  entryDate: React.CSSProperties;
  entryHeader: React.CSSProperties;
  bodyText: React.CSSProperties;
  bulletList: React.CSSProperties;
  bulletItem: React.CSSProperties;
  skillsGrid: React.CSSProperties;
  skillCategory: React.CSSProperties;
  skillCategoryName: React.CSSProperties;
  skillCategoryItems: React.CSSProperties;
  chipStyle: React.CSSProperties;
  summaryText: React.CSSProperties;
}

function getModernStyles(): TemplateStyles {
  return {
    container: {
      fontFamily: "'Inter', sans-serif",
      color: "#1a1a1a",
      fontSize: "0.92rem",
      lineHeight: 1.55,
    },
    name: {
      fontSize: "1.8rem",
      fontWeight: 800,
      color: "#1a1a1a",
      letterSpacing: "-0.02em",
      marginBottom: 4,
    },
    contactRow: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: 12,
      marginBottom: 24,
      fontSize: "0.82rem",
      color: "#555",
    },
    contactItem: {
      display: "inline",
    },
    sectionTitle: {
      fontSize: "1rem",
      fontWeight: 700,
      color: "#3772ff",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      marginBottom: 10,
      paddingLeft: 12,
      borderLeft: "3px solid #3772ff",
    },
    sectionDivider: {
      marginTop: 20,
      marginBottom: 16,
    },
    entryTitle: {
      fontSize: "0.95rem",
      fontWeight: 700,
      color: "#1a1a1a",
    },
    entrySubtitle: {
      fontSize: "0.85rem",
      color: "#555",
      fontWeight: 500,
    },
    entryDate: {
      fontSize: "0.82rem",
      color: "#777",
      fontWeight: 500,
      textAlign: "right" as const,
      whiteSpace: "nowrap" as const,
    },
    entryHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 4,
    },
    bodyText: {
      fontSize: "0.88rem",
      color: "#333",
      lineHeight: 1.6,
    },
    bulletList: {
      paddingLeft: 18,
      margin: "4px 0 0 0",
      listStyleType: "disc",
    },
    bulletItem: {
      fontSize: "0.86rem",
      color: "#333",
      lineHeight: 1.5,
      marginBottom: 2,
    },
    skillsGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
    skillCategory: {
      marginBottom: 4,
    },
    skillCategoryName: {
      fontWeight: 700,
      fontSize: "0.85rem",
      color: "#1a1a1a",
      marginBottom: 3,
    },
    skillCategoryItems: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: 4,
    },
    chipStyle: {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 4,
      background: "rgba(55, 114, 255, 0.08)",
      color: "#3772ff",
      fontSize: "0.78rem",
      fontWeight: 500,
    },
    summaryText: {
      fontSize: "0.88rem",
      color: "#444",
      lineHeight: 1.65,
      fontStyle: "italic",
    },
  };
}

function getClassicStyles(): TemplateStyles {
  return {
    container: {
      fontFamily: "'Georgia', serif",
      color: "#222",
      fontSize: "0.92rem",
      lineHeight: 1.4,
    },
    name: {
      fontSize: "1.7rem",
      fontWeight: 700,
      color: "#222",
      textAlign: "center" as const,
      marginBottom: 4,
    },
    contactRow: {
      display: "flex",
      flexWrap: "wrap" as const,
      justifyContent: "center",
      gap: 10,
      marginBottom: 20,
      fontSize: "0.82rem",
      color: "#555",
    },
    contactItem: {
      display: "inline",
    },
    sectionTitle: {
      fontSize: "1rem",
      fontWeight: 700,
      color: "#222",
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      marginBottom: 8,
      paddingBottom: 4,
      borderBottom: "2px solid #222",
    },
    sectionDivider: {
      marginTop: 18,
      marginBottom: 14,
    },
    entryTitle: {
      fontSize: "0.93rem",
      fontWeight: 700,
      color: "#222",
    },
    entrySubtitle: {
      fontSize: "0.85rem",
      color: "#555",
      fontStyle: "italic",
    },
    entryDate: {
      fontSize: "0.82rem",
      color: "#666",
      fontStyle: "italic",
      textAlign: "right" as const,
      whiteSpace: "nowrap" as const,
    },
    entryHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 4,
    },
    bodyText: {
      fontSize: "0.88rem",
      color: "#333",
      lineHeight: 1.5,
    },
    bulletList: {
      paddingLeft: 20,
      margin: "4px 0 0 0",
      listStyleType: "disc",
    },
    bulletItem: {
      fontSize: "0.86rem",
      color: "#333",
      lineHeight: 1.45,
      marginBottom: 2,
    },
    skillsGrid: {
      display: "block",
    },
    skillCategory: {
      marginBottom: 6,
    },
    skillCategoryName: {
      fontWeight: 700,
      fontSize: "0.85rem",
      color: "#222",
      display: "inline",
    },
    skillCategoryItems: {
      display: "inline",
    },
    chipStyle: {
      display: "inline",
      fontSize: "0.85rem",
      color: "#333",
    },
    summaryText: {
      fontSize: "0.88rem",
      color: "#444",
      lineHeight: 1.5,
    },
  };
}

function getMinimalStyles(): TemplateStyles {
  return {
    container: {
      fontFamily: "'Inter', sans-serif",
      color: "#333",
      fontSize: "0.9rem",
      lineHeight: 1.6,
    },
    name: {
      fontSize: "1.6rem",
      fontWeight: 600,
      color: "#333",
      letterSpacing: "-0.01em",
      marginBottom: 4,
    },
    contactRow: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: 14,
      marginBottom: 28,
      fontSize: "0.8rem",
      color: "#888",
    },
    contactItem: {
      display: "inline",
    },
    sectionTitle: {
      fontSize: "0.68rem",
      fontWeight: 700,
      color: "#999",
      textTransform: "uppercase" as const,
      letterSpacing: "2px",
      marginBottom: 12,
    },
    sectionDivider: {
      marginTop: 28,
      marginBottom: 20,
      borderTop: "1px solid #e5e5e5",
      paddingTop: 20,
    },
    entryTitle: {
      fontSize: "0.92rem",
      fontWeight: 600,
      color: "#333",
    },
    entrySubtitle: {
      fontSize: "0.82rem",
      color: "#888",
      fontWeight: 400,
    },
    entryDate: {
      fontSize: "0.78rem",
      color: "#aaa",
      fontWeight: 400,
      textAlign: "right" as const,
      whiteSpace: "nowrap" as const,
    },
    entryHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 4,
    },
    bodyText: {
      fontSize: "0.86rem",
      color: "#555",
      lineHeight: 1.6,
    },
    bulletList: {
      paddingLeft: 16,
      margin: "4px 0 0 0",
      listStyleType: "disc",
    },
    bulletItem: {
      fontSize: "0.84rem",
      color: "#555",
      lineHeight: 1.55,
      marginBottom: 2,
    },
    skillsGrid: {
      display: "block",
    },
    skillCategory: {
      marginBottom: 6,
    },
    skillCategoryName: {
      fontWeight: 600,
      fontSize: "0.82rem",
      color: "#555",
      marginBottom: 2,
    },
    skillCategoryItems: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: 6,
    },
    chipStyle: {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 3,
      background: "#f5f5f5",
      color: "#555",
      fontSize: "0.78rem",
      fontWeight: 500,
    },
    summaryText: {
      fontSize: "0.86rem",
      color: "#666",
      lineHeight: 1.65,
    },
  };
}

function getATSStyles(): TemplateStyles {
  return {
    container: {
      fontFamily: "'Times New Roman', serif",
      color: "#000",
      fontSize: "0.9rem",
      lineHeight: 1.35,
    },
    name: {
      fontSize: "1.5rem",
      fontWeight: 700,
      color: "#000",
      textAlign: "center" as const,
      textTransform: "uppercase" as const,
      marginBottom: 2,
    },
    contactRow: {
      display: "flex",
      flexWrap: "wrap" as const,
      justifyContent: "center",
      gap: 8,
      marginBottom: 16,
      fontSize: "0.82rem",
      color: "#000",
    },
    contactItem: {
      display: "inline",
    },
    sectionTitle: {
      fontSize: "0.92rem",
      fontWeight: 700,
      color: "#000",
      textTransform: "uppercase" as const,
      marginBottom: 6,
      borderBottom: "1px solid #000",
      paddingBottom: 2,
    },
    sectionDivider: {
      marginTop: 12,
      marginBottom: 10,
    },
    entryTitle: {
      fontSize: "0.9rem",
      fontWeight: 700,
      color: "#000",
    },
    entrySubtitle: {
      fontSize: "0.85rem",
      color: "#000",
    },
    entryDate: {
      fontSize: "0.82rem",
      color: "#000",
      textAlign: "right" as const,
      whiteSpace: "nowrap" as const,
    },
    entryHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 2,
    },
    bodyText: {
      fontSize: "0.86rem",
      color: "#000",
      lineHeight: 1.35,
    },
    bulletList: {
      paddingLeft: 18,
      margin: "2px 0 0 0",
      listStyleType: "disc",
    },
    bulletItem: {
      fontSize: "0.86rem",
      color: "#000",
      lineHeight: 1.35,
      marginBottom: 1,
    },
    skillsGrid: {
      display: "block",
    },
    skillCategory: {
      marginBottom: 3,
    },
    skillCategoryName: {
      fontWeight: 700,
      fontSize: "0.86rem",
      color: "#000",
      display: "inline",
    },
    skillCategoryItems: {
      display: "inline",
    },
    chipStyle: {
      display: "inline",
      fontSize: "0.86rem",
      color: "#000",
    },
    summaryText: {
      fontSize: "0.86rem",
      color: "#000",
      lineHeight: 1.4,
    },
  };
}

function getStyles(template: TemplateType): TemplateStyles {
  switch (template) {
    case "modern":
      return getModernStyles();
    case "classic":
      return getClassicStyles();
    case "minimal":
      return getMinimalStyles();
    case "ats":
      return getATSStyles();
  }
}

// ── Helper: join contact items ─────────────────────────────────────────────────
function buildContactItems(c: ContactInfo): string[] {
  const items: string[] = [];
  if (c.email) items.push(c.email);
  if (c.phone) items.push(c.phone);
  if (c.linkedin) items.push(c.linkedin);
  if (c.github) items.push(c.github);
  if (c.portfolio) items.push(c.portfolio);
  return items;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ResumePreview({ data, template }: ResumePreviewProps) {
  const s = getStyles(template);

  const containerStyle: React.CSSProperties = {
    background: "white",
    color: "#1a1a1a",
    aspectRatio: "210 / 297",
    overflowY: "auto",
    padding: "40px 50px",
    boxShadow: "0 4px 30px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)",
    minHeight: 800,
    borderRadius: 4,
    ...s.container,
  };

  if (!data) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#bbb",
            fontSize: "0.95rem",
            fontStyle: "italic",
          }}
        >
          Start editing your resume to see a live preview here.
        </div>
      </div>
    );
  }

  const {
    contact,
    summary,
    experience,
    education,
    skills,
    projects,
    certifications,
    languages,
  } = data;

  const contactItems = buildContactItems(contact);
  const hasContact = contact.name || contactItems.length > 0;
  const hasSummary = summary.trim().length > 0;
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasSkills = skills.length > 0;
  const hasProjects = projects.length > 0;
  const hasCerts = certifications.filter(Boolean).length > 0;
  const hasLangs = languages.filter(Boolean).length > 0;

  // Classic & ATS: render skills inline (comma-separated)
  const isInlineSkills = template === "classic" || template === "ats";

  // Section ordering helper
  let sectionIndex = 0;
  const sectionDivider = () => {
    sectionIndex++;
    return sectionIndex > 1 ? <div style={s.sectionDivider} /> : null;
  };

  return (
    <div style={containerStyle}>
      {/* ── Contact / Name Header ─────────────────────────────────────────── */}
      {hasContact && (
        <div>
          {contact.name && <div style={s.name}>{contact.name}</div>}
          {contactItems.length > 0 && (
            <div style={s.contactRow}>
              {contactItems.map((item, idx) => (
                <span key={idx} style={s.contactItem}>
                  {item}
                  {idx < contactItems.length - 1 && (
                    <span style={{ margin: "0 4px", color: "#ccc" }}>|</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Summary ───────────────────────────────────────────────────────── */}
      {hasSummary && (
        <div>
          {sectionDivider()}
          <div style={s.sectionTitle}>Summary</div>
          <p style={s.summaryText}>{summary}</p>
        </div>
      )}

      {/* ── Experience ────────────────────────────────────────────────────── */}
      {hasExperience && (
        <div>
          {sectionDivider()}
          <div style={s.sectionTitle}>Experience</div>
          {experience.map((exp, idx) => (
            <div key={idx} style={{ marginBottom: idx < experience.length - 1 ? 14 : 0 }}>
              <div style={s.entryHeader}>
                <div>
                  <div style={s.entryTitle}>{exp.title || "Untitled Position"}</div>
                  <div style={s.entrySubtitle}>
                    {[exp.company, exp.location].filter(Boolean).join(" — ")}
                  </div>
                </div>
                {(exp.startDate || exp.endDate) && (
                  <div style={s.entryDate}>
                    {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
                  </div>
                )}
              </div>
              {exp.bullets.filter(Boolean).length > 0 && (
                <ul style={s.bulletList}>
                  {exp.bullets.filter(Boolean).map((b, bIdx) => (
                    <li key={bIdx} style={s.bulletItem}>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Education ─────────────────────────────────────────────────────── */}
      {hasEducation && (
        <div>
          {sectionDivider()}
          <div style={s.sectionTitle}>Education</div>
          {education.map((edu, idx) => (
            <div key={idx} style={{ marginBottom: idx < education.length - 1 ? 10 : 0 }}>
              <div style={s.entryHeader}>
                <div>
                  <div style={s.entryTitle}>{edu.degree || "Degree"}</div>
                  <div style={s.entrySubtitle}>
                    {[edu.institution, edu.location].filter(Boolean).join(" — ")}
                    {edu.gpa && <span> • GPA: {edu.gpa}</span>}
                    {edu.honors && <span> • {edu.honors}</span>}
                  </div>
                </div>
                {edu.year && <div style={s.entryDate}>{edu.year}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Skills ────────────────────────────────────────────────────────── */}
      {hasSkills && (
        <div>
          {sectionDivider()}
          <div style={s.sectionTitle}>Skills</div>
          <div style={s.skillsGrid}>
            {skills.map((cat, idx) => (
              <div key={idx} style={s.skillCategory}>
                <span style={s.skillCategoryName}>
                  {cat.name || "General"}
                  {isInlineSkills ? ": " : ""}
                </span>
                {isInlineSkills ? (
                  <span style={s.skillCategoryItems}>
                    {cat.skills.map((sk, sIdx) => (
                      <span key={sIdx} style={s.chipStyle}>
                        {sk}
                        {sIdx < cat.skills.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </span>
                ) : (
                  <div style={s.skillCategoryItems}>
                    {cat.skills.map((sk, sIdx) => (
                      <span key={sIdx} style={s.chipStyle}>
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Projects ──────────────────────────────────────────────────────── */}
      {hasProjects && (
        <div>
          {sectionDivider()}
          <div style={s.sectionTitle}>Projects</div>
          {projects.map((proj, idx) => (
            <div key={idx} style={{ marginBottom: idx < projects.length - 1 ? 12 : 0 }}>
              <div style={s.entryHeader}>
                <div>
                  <div style={s.entryTitle}>
                    {proj.name || "Untitled Project"}
                    {proj.url && (
                      <span
                        style={{
                          fontWeight: 400,
                          fontSize: "0.78rem",
                          color: "#888",
                          marginLeft: 6,
                        }}
                      >
                        ({proj.url})
                      </span>
                    )}
                  </div>
                  {proj.technologies.length > 0 && (
                    <div style={{ ...s.entrySubtitle, marginTop: 2 }}>
                      {proj.technologies.join(", ")}
                    </div>
                  )}
                </div>
              </div>
              {proj.description && <p style={{ ...s.bodyText, marginTop: 2 }}>{proj.description}</p>}
              {proj.bullets.filter(Boolean).length > 0 && (
                <ul style={s.bulletList}>
                  {proj.bullets.filter(Boolean).map((b, bIdx) => (
                    <li key={bIdx} style={s.bulletItem}>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Certifications ────────────────────────────────────────────────── */}
      {hasCerts && (
        <div>
          {sectionDivider()}
          <div style={s.sectionTitle}>Certifications</div>
          <ul style={s.bulletList}>
            {certifications.filter(Boolean).map((cert, idx) => (
              <li key={idx} style={s.bulletItem}>
                {cert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Languages ─────────────────────────────────────────────────────── */}
      {hasLangs && (
        <div>
          {sectionDivider()}
          <div style={s.sectionTitle}>Languages</div>
          <p style={s.bodyText}>{languages.filter(Boolean).join(", ")}</p>
        </div>
      )}
    </div>
  );
}
