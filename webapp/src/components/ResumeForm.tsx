"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderOpen,
  Award,
  Globe,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
}
export interface ExperienceItem {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}
export interface EducationItem {
  degree: string;
  institution: string;
  location: string;
  year: string;
  gpa: string;
  honors: string;
}
export interface SkillCategory {
  name: string;
  skills: string[];
}
export interface ProjectItem {
  name: string;
  description: string;
  technologies: string[];
  url: string;
  bullets: string[];
}
export interface PreciseResumeData {
  contact: ContactInfo;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillCategory[];
  projects: ProjectItem[];
  certifications: string[];
  languages: string[];
}

interface ResumeFormProps {
  data: PreciseResumeData | null;
  onChange: (data: PreciseResumeData) => void;
}

// ── Shared Styles ──────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border-primary)",
  color: "var(--text-primary)",
  padding: "8px 12px",
  borderRadius: "var(--radius-sm, 8px)",
  width: "100%",
  fontSize: "var(--font-sm)",
  fontFamily: "var(--font-family)",
  outline: "none",
  transition: "border-color var(--transition-fast)",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 100,
  resize: "vertical" as const,
  lineHeight: 1.6,
};

const gridTwoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--font-xs)",
  fontWeight: 500,
  color: "var(--text-secondary)",
  marginBottom: 4,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  cursor: "pointer",
  userSelect: "none",
  borderBottom: "1px solid var(--border-primary)",
};

const sectionHeaderLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const sectionIconWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: "var(--radius-sm, 8px)",
  background: "rgba(55, 114, 255, 0.1)",
  color: "var(--accent-primary)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--font-base)",
  fontWeight: 700,
  color: "var(--text-primary)",
};

const countBadge: React.CSSProperties = {
  fontSize: "var(--font-xs)",
  fontWeight: 600,
  color: "var(--text-tertiary)",
  background: "var(--bg-surface)",
  padding: "2px 10px",
  borderRadius: "var(--radius-full, 9999px)",
  border: "1px solid var(--border-primary)",
};

const sectionBody: React.CSSProperties = {
  padding: "20px",
};

const addBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: "var(--radius-sm, 8px)",
  background: "rgba(55, 114, 255, 0.08)",
  border: "1px dashed rgba(55, 114, 255, 0.3)",
  color: "var(--accent-primary)",
  fontSize: "var(--font-sm)",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-family)",
  transition: "all var(--transition-fast)",
};

const removeBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: "var(--radius-sm, 8px)",
  background: "rgba(239, 68, 68, 0.1)",
  border: "none",
  color: "#f87171",
  cursor: "pointer",
  flexShrink: 0,
  transition: "all var(--transition-fast)",
};

const entryCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-primary)",
  background: "var(--bg-surface)",
  marginBottom: 12,
  position: "relative",
};

const entryHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 12,
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 10px",
  borderRadius: "var(--radius-full, 9999px)",
  background: "rgba(55, 114, 255, 0.15)",
  color: "var(--accent-primary)",
  fontSize: "var(--font-xs)",
  fontWeight: 600,
};

const chipRemoveBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  color: "var(--accent-primary)",
  cursor: "pointer",
  padding: 0,
  marginLeft: 2,
  opacity: 0.6,
  transition: "opacity var(--transition-fast)",
};

// ── Default Data ───────────────────────────────────────────────────────────────
function getDefaultData(): PreciseResumeData {
  return {
    contact: { name: "", email: "", phone: "", linkedin: "", github: "", portfolio: "" },
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: [],
  };
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ResumeForm({ data, onChange }: ResumeFormProps) {
  const resumeData = data ?? getDefaultData();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newSkillInputs, setNewSkillInputs] = useState<Record<number, string>>({});
  const [newTechInputs, setNewTechInputs] = useState<Record<number, string>>({});

  const toggle = useCallback((section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const update = useCallback(
    (partial: Partial<PreciseResumeData>) => {
      onChange({ ...resumeData, ...partial });
    },
    [resumeData, onChange]
  );

  // ── Contact Handlers ─────────────────────────────────────────────────────
  const updateContact = useCallback(
    (field: keyof ContactInfo, value: string) => {
      update({ contact: { ...resumeData.contact, [field]: value } });
    },
    [resumeData, update]
  );

  // ── Experience Handlers ──────────────────────────────────────────────────
  const updateExperience = useCallback(
    (index: number, field: keyof ExperienceItem, value: string | string[]) => {
      const items = [...resumeData.experience];
      items[index] = { ...items[index], [field]: value };
      update({ experience: items });
    },
    [resumeData, update]
  );

  const addExperience = useCallback(() => {
    update({
      experience: [
        ...resumeData.experience,
        { title: "", company: "", location: "", startDate: "", endDate: "", bullets: [""] },
      ],
    });
  }, [resumeData, update]);

  const removeExperience = useCallback(
    (index: number) => {
      update({ experience: resumeData.experience.filter((_, i) => i !== index) });
    },
    [resumeData, update]
  );

  const addBullet = useCallback(
    (expIndex: number) => {
      const items = [...resumeData.experience];
      items[expIndex] = { ...items[expIndex], bullets: [...items[expIndex].bullets, ""] };
      update({ experience: items });
    },
    [resumeData, update]
  );

  const updateBullet = useCallback(
    (expIndex: number, bulletIndex: number, value: string) => {
      const items = [...resumeData.experience];
      const bullets = [...items[expIndex].bullets];
      bullets[bulletIndex] = value;
      items[expIndex] = { ...items[expIndex], bullets };
      update({ experience: items });
    },
    [resumeData, update]
  );

  const removeBullet = useCallback(
    (expIndex: number, bulletIndex: number) => {
      const items = [...resumeData.experience];
      items[expIndex] = {
        ...items[expIndex],
        bullets: items[expIndex].bullets.filter((_, i) => i !== bulletIndex),
      };
      update({ experience: items });
    },
    [resumeData, update]
  );

  // ── Education Handlers ───────────────────────────────────────────────────
  const updateEducation = useCallback(
    (index: number, field: keyof EducationItem, value: string) => {
      const items = [...resumeData.education];
      items[index] = { ...items[index], [field]: value };
      update({ education: items });
    },
    [resumeData, update]
  );

  const addEducation = useCallback(() => {
    update({
      education: [
        ...resumeData.education,
        { degree: "", institution: "", location: "", year: "", gpa: "", honors: "" },
      ],
    });
  }, [resumeData, update]);

  const removeEducation = useCallback(
    (index: number) => {
      update({ education: resumeData.education.filter((_, i) => i !== index) });
    },
    [resumeData, update]
  );

  // ── Skills Handlers ──────────────────────────────────────────────────────
  const updateSkillCategory = useCallback(
    (index: number, name: string) => {
      const items = [...resumeData.skills];
      items[index] = { ...items[index], name };
      update({ skills: items });
    },
    [resumeData, update]
  );

  const addSkillToCategory = useCallback(
    (catIndex: number) => {
      const skillText = (newSkillInputs[catIndex] || "").trim();
      if (!skillText) return;
      const items = [...resumeData.skills];
      items[catIndex] = { ...items[catIndex], skills: [...items[catIndex].skills, skillText] };
      update({ skills: items });
      setNewSkillInputs((prev) => ({ ...prev, [catIndex]: "" }));
    },
    [resumeData, update, newSkillInputs]
  );

  const removeSkillFromCategory = useCallback(
    (catIndex: number, skillIndex: number) => {
      const items = [...resumeData.skills];
      items[catIndex] = {
        ...items[catIndex],
        skills: items[catIndex].skills.filter((_, i) => i !== skillIndex),
      };
      update({ skills: items });
    },
    [resumeData, update]
  );

  const addSkillCategory = useCallback(() => {
    update({ skills: [...resumeData.skills, { name: "", skills: [] }] });
  }, [resumeData, update]);

  const removeSkillCategory = useCallback(
    (index: number) => {
      update({ skills: resumeData.skills.filter((_, i) => i !== index) });
    },
    [resumeData, update]
  );

  // ── Projects Handlers ────────────────────────────────────────────────────
  const updateProject = useCallback(
    (index: number, field: keyof ProjectItem, value: string | string[]) => {
      const items = [...resumeData.projects];
      items[index] = { ...items[index], [field]: value };
      update({ projects: items });
    },
    [resumeData, update]
  );

  const addProject = useCallback(() => {
    update({
      projects: [
        ...resumeData.projects,
        { name: "", description: "", technologies: [], url: "", bullets: [""] },
      ],
    });
  }, [resumeData, update]);

  const removeProject = useCallback(
    (index: number) => {
      update({ projects: resumeData.projects.filter((_, i) => i !== index) });
    },
    [resumeData, update]
  );

  const addProjectBullet = useCallback(
    (projIndex: number) => {
      const items = [...resumeData.projects];
      items[projIndex] = { ...items[projIndex], bullets: [...items[projIndex].bullets, ""] };
      update({ projects: items });
    },
    [resumeData, update]
  );

  const updateProjectBullet = useCallback(
    (projIndex: number, bulletIndex: number, value: string) => {
      const items = [...resumeData.projects];
      const bullets = [...items[projIndex].bullets];
      bullets[bulletIndex] = value;
      items[projIndex] = { ...items[projIndex], bullets };
      update({ projects: items });
    },
    [resumeData, update]
  );

  const removeProjectBullet = useCallback(
    (projIndex: number, bulletIndex: number) => {
      const items = [...resumeData.projects];
      items[projIndex] = {
        ...items[projIndex],
        bullets: items[projIndex].bullets.filter((_, i) => i !== bulletIndex),
      };
      update({ projects: items });
    },
    [resumeData, update]
  );

  const addProjectTech = useCallback(
    (projIndex: number) => {
      const techText = (newTechInputs[projIndex] || "").trim();
      if (!techText) return;
      const items = [...resumeData.projects];
      items[projIndex] = {
        ...items[projIndex],
        technologies: [...items[projIndex].technologies, techText],
      };
      update({ projects: items });
      setNewTechInputs((prev) => ({ ...prev, [projIndex]: "" }));
    },
    [resumeData, update, newTechInputs]
  );

  const removeProjectTech = useCallback(
    (projIndex: number, techIndex: number) => {
      const items = [...resumeData.projects];
      items[projIndex] = {
        ...items[projIndex],
        technologies: items[projIndex].technologies.filter((_, i) => i !== techIndex),
      };
      update({ projects: items });
    },
    [resumeData, update]
  );

  // ── Simple List Handlers (Certifications / Languages) ────────────────────
  const updateListItem = useCallback(
    (field: "certifications" | "languages", index: number, value: string) => {
      const items = [...resumeData[field]];
      items[index] = value;
      update({ [field]: items });
    },
    [resumeData, update]
  );

  const addListItem = useCallback(
    (field: "certifications" | "languages") => {
      update({ [field]: [...resumeData[field], ""] });
    },
    [resumeData, update]
  );

  const removeListItem = useCallback(
    (field: "certifications" | "languages", index: number) => {
      update({ [field]: resumeData[field].filter((_, i) => i !== index) });
    },
    [resumeData, update]
  );

  // ── Focus handler ────────────────────────────────────────────────────────
  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = "var(--accent-primary)";
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = "var(--border-primary)";
  };

  // ── Section Header Component ─────────────────────────────────────────────
  const SectionHeader = ({
    id,
    icon: Icon,
    title: titleText,
    count,
  }: {
    id: string;
    icon: React.ElementType;
    title: string;
    count?: number;
  }) => (
    <div style={sectionHeaderStyle} onClick={() => toggle(id)}>
      <div style={sectionHeaderLeft}>
        <div style={sectionIconWrap}>
          <Icon size={16} />
        </div>
        <span style={sectionTitle}>{titleText}</span>
        {count !== undefined && <span style={countBadge}>{count}</span>}
      </div>
      {collapsed[id] ? (
        <ChevronRight size={18} color="var(--text-tertiary)" />
      ) : (
        <ChevronDown size={18} color="var(--text-tertiary)" />
      )}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Contact Section ───────────────────────────────────────────────── */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <SectionHeader id="contact" icon={User} title="Contact Information" />
        {!collapsed.contact && (
          <div style={sectionBody}>
            <div style={gridTwoCol}>
              {(
                [
                  ["name", "Full Name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["linkedin", "LinkedIn URL"],
                  ["github", "GitHub URL"],
                  ["portfolio", "Portfolio URL"],
                ] as [keyof ContactInfo, string][]
              ).map(([field, label]) => (
                <div key={field}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    style={inputStyle}
                    value={resumeData.contact[field]}
                    onChange={(e) => updateContact(field, e.target.value)}
                    placeholder={label}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Summary Section ───────────────────────────────────────────────── */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <SectionHeader id="summary" icon={FileText} title="Professional Summary" />
        {!collapsed.summary && (
          <div style={sectionBody}>
            <textarea
              style={textareaStyle}
              value={resumeData.summary}
              onChange={(e) => update({ summary: e.target.value })}
              placeholder="Write a compelling professional summary..."
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 6,
                fontSize: "var(--font-xs)",
                color: "var(--text-tertiary)",
              }}
            >
              {resumeData.summary.length} characters
            </div>
          </div>
        )}
      </div>

      {/* ── Experience Section ────────────────────────────────────────────── */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <SectionHeader
          id="experience"
          icon={Briefcase}
          title="Work Experience"
          count={resumeData.experience.length}
        />
        {!collapsed.experience && (
          <div style={sectionBody}>
            {resumeData.experience.map((exp, idx) => (
              <div key={idx} style={entryCardStyle}>
                <div style={entryHeaderStyle}>
                  <span
                    style={{ fontSize: "var(--font-xs)", color: "var(--text-tertiary)", fontWeight: 600 }}
                  >
                    Experience #{idx + 1}
                  </span>
                  <button style={removeBtnStyle} onClick={() => removeExperience(idx)} title="Remove">
                    <X size={14} />
                  </button>
                </div>
                <div style={gridTwoCol}>
                  <div>
                    <label style={labelStyle}>Job Title</label>
                    <input
                      style={inputStyle}
                      value={exp.title}
                      onChange={(e) => updateExperience(idx, "title", e.target.value)}
                      placeholder="Software Engineer"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Company</label>
                    <input
                      style={inputStyle}
                      value={exp.company}
                      onChange={(e) => updateExperience(idx, "company", e.target.value)}
                      placeholder="Google"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                </div>
                <div style={{ ...gridTwoCol, marginTop: 8 }}>
                  <div>
                    <label style={labelStyle}>Location</label>
                    <input
                      style={inputStyle}
                      value={exp.location}
                      onChange={(e) => updateExperience(idx, "location", e.target.value)}
                      placeholder="San Francisco, CA"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Start Date</label>
                      <input
                        style={inputStyle}
                        value={exp.startDate}
                        onChange={(e) => updateExperience(idx, "startDate", e.target.value)}
                        placeholder="Jan 2022"
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>End Date</label>
                      <input
                        style={inputStyle}
                        value={exp.endDate}
                        onChange={(e) => updateExperience(idx, "endDate", e.target.value)}
                        placeholder="Present"
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                      />
                    </div>
                  </div>
                </div>

                {/* Bullets */}
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>Bullet Points</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {exp.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span
                          style={{
                            color: "var(--text-tertiary)",
                            fontSize: "var(--font-xs)",
                            width: 16,
                            textAlign: "center",
                            flexShrink: 0,
                          }}
                        >
                          •
                        </span>
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          value={bullet}
                          onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                          placeholder="Describe your achievement..."
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                        />
                        <button
                          style={{
                            ...removeBtnStyle,
                            width: 24,
                            height: 24,
                          }}
                          onClick={() => removeBullet(idx, bIdx)}
                          title="Remove bullet"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    style={{ ...addBtnStyle, marginTop: 8, fontSize: "var(--font-xs)", padding: "6px 12px" }}
                    onClick={() => addBullet(idx)}
                  >
                    <Plus size={12} /> Add Bullet
                  </button>
                </div>
              </div>
            ))}
            <button style={addBtnStyle} onClick={addExperience}>
              <Plus size={14} /> Add Experience
            </button>
          </div>
        )}
      </div>

      {/* ── Education Section ─────────────────────────────────────────────── */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <SectionHeader
          id="education"
          icon={GraduationCap}
          title="Education"
          count={resumeData.education.length}
        />
        {!collapsed.education && (
          <div style={sectionBody}>
            {resumeData.education.map((edu, idx) => (
              <div key={idx} style={entryCardStyle}>
                <div style={entryHeaderStyle}>
                  <span
                    style={{ fontSize: "var(--font-xs)", color: "var(--text-tertiary)", fontWeight: 600 }}
                  >
                    Education #{idx + 1}
                  </span>
                  <button style={removeBtnStyle} onClick={() => removeEducation(idx)} title="Remove">
                    <X size={14} />
                  </button>
                </div>
                <div style={gridTwoCol}>
                  <div>
                    <label style={labelStyle}>Degree</label>
                    <input
                      style={inputStyle}
                      value={edu.degree}
                      onChange={(e) => updateEducation(idx, "degree", e.target.value)}
                      placeholder="B.S. Computer Science"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Institution</label>
                    <input
                      style={inputStyle}
                      value={edu.institution}
                      onChange={(e) => updateEducation(idx, "institution", e.target.value)}
                      placeholder="Stanford University"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Location</label>
                    <input
                      style={inputStyle}
                      value={edu.location}
                      onChange={(e) => updateEducation(idx, "location", e.target.value)}
                      placeholder="Stanford, CA"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Year</label>
                    <input
                      style={inputStyle}
                      value={edu.year}
                      onChange={(e) => updateEducation(idx, "year", e.target.value)}
                      placeholder="2024"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>GPA</label>
                    <input
                      style={inputStyle}
                      value={edu.gpa}
                      onChange={(e) => updateEducation(idx, "gpa", e.target.value)}
                      placeholder="3.9/4.0"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Honors</label>
                    <input
                      style={inputStyle}
                      value={edu.honors}
                      onChange={(e) => updateEducation(idx, "honors", e.target.value)}
                      placeholder="Summa Cum Laude"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button style={addBtnStyle} onClick={addEducation}>
              <Plus size={14} /> Add Education
            </button>
          </div>
        )}
      </div>

      {/* ── Skills Section ────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <SectionHeader
          id="skills"
          icon={Wrench}
          title="Skills"
          count={resumeData.skills.length}
        />
        {!collapsed.skills && (
          <div style={sectionBody}>
            {resumeData.skills.map((cat, catIdx) => (
              <div key={catIdx} style={entryCardStyle}>
                <div style={entryHeaderStyle}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <label style={labelStyle}>Category Name</label>
                    <input
                      style={inputStyle}
                      value={cat.name}
                      onChange={(e) => updateSkillCategory(catIdx, e.target.value)}
                      placeholder="Programming Languages"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                  <button
                    style={{ ...removeBtnStyle, marginTop: 18 }}
                    onClick={() => removeSkillCategory(catIdx)}
                    title="Remove category"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {cat.skills.map((skill, sIdx) => (
                    <span key={sIdx} style={chipStyle}>
                      {skill}
                      <button
                        style={chipRemoveBtn}
                        onClick={() => removeSkillFromCategory(catIdx, sIdx)}
                        title="Remove skill"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={newSkillInputs[catIdx] || ""}
                    onChange={(e) =>
                      setNewSkillInputs((prev) => ({ ...prev, [catIdx]: e.target.value }))
                    }
                    placeholder="Add a skill..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkillToCategory(catIdx);
                      }
                    }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  <button
                    style={{
                      ...addBtnStyle,
                      padding: "8px 12px",
                      fontSize: "var(--font-xs)",
                      flexShrink: 0,
                    }}
                    onClick={() => addSkillToCategory(catIdx)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            ))}
            <button style={addBtnStyle} onClick={addSkillCategory}>
              <Plus size={14} /> Add Category
            </button>
          </div>
        )}
      </div>

      {/* ── Projects Section ──────────────────────────────────────────────── */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <SectionHeader
          id="projects"
          icon={FolderOpen}
          title="Projects"
          count={resumeData.projects.length}
        />
        {!collapsed.projects && (
          <div style={sectionBody}>
            {resumeData.projects.map((proj, idx) => (
              <div key={idx} style={entryCardStyle}>
                <div style={entryHeaderStyle}>
                  <span
                    style={{ fontSize: "var(--font-xs)", color: "var(--text-tertiary)", fontWeight: 600 }}
                  >
                    Project #{idx + 1}
                  </span>
                  <button style={removeBtnStyle} onClick={() => removeProject(idx)} title="Remove">
                    <X size={14} />
                  </button>
                </div>
                <div style={gridTwoCol}>
                  <div>
                    <label style={labelStyle}>Project Name</label>
                    <input
                      style={inputStyle}
                      value={proj.name}
                      onChange={(e) => updateProject(idx, "name", e.target.value)}
                      placeholder="Project Name"
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>URL</label>
                    <input
                      style={inputStyle}
                      value={proj.url}
                      onChange={(e) => updateProject(idx, "url", e.target.value)}
                      placeholder="https://github.com/..."
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    style={{ ...textareaStyle, minHeight: 60 }}
                    value={proj.description}
                    onChange={(e) => updateProject(idx, "description", e.target.value)}
                    placeholder="Brief project description..."
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>

                {/* Technologies Chips */}
                <div style={{ marginTop: 8 }}>
                  <label style={labelStyle}>Technologies</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    {proj.technologies.map((tech, tIdx) => (
                      <span key={tIdx} style={chipStyle}>
                        {tech}
                        <button
                          style={chipRemoveBtn}
                          onClick={() => removeProjectTech(idx, tIdx)}
                          title="Remove"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      value={newTechInputs[idx] || ""}
                      onChange={(e) =>
                        setNewTechInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      placeholder="Add technology..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addProjectTech(idx);
                        }
                      }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                    <button
                      style={{
                        ...addBtnStyle,
                        padding: "8px 12px",
                        fontSize: "var(--font-xs)",
                        flexShrink: 0,
                      }}
                      onClick={() => addProjectTech(idx)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                {/* Project Bullets */}
                <div style={{ marginTop: 8 }}>
                  <label style={labelStyle}>Key Points</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {proj.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span
                          style={{
                            color: "var(--text-tertiary)",
                            fontSize: "var(--font-xs)",
                            width: 16,
                            textAlign: "center",
                            flexShrink: 0,
                          }}
                        >
                          •
                        </span>
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          value={bullet}
                          onChange={(e) => updateProjectBullet(idx, bIdx, e.target.value)}
                          placeholder="Describe what you built..."
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                        />
                        <button
                          style={{ ...removeBtnStyle, width: 24, height: 24 }}
                          onClick={() => removeProjectBullet(idx, bIdx)}
                          title="Remove bullet"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    style={{ ...addBtnStyle, marginTop: 8, fontSize: "var(--font-xs)", padding: "6px 12px" }}
                    onClick={() => addProjectBullet(idx)}
                  >
                    <Plus size={12} /> Add Bullet
                  </button>
                </div>
              </div>
            ))}
            <button style={addBtnStyle} onClick={addProject}>
              <Plus size={14} /> Add Project
            </button>
          </div>
        )}
      </div>

      {/* ── Certifications Section ────────────────────────────────────────── */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <SectionHeader
          id="certifications"
          icon={Award}
          title="Certifications"
          count={resumeData.certifications.length}
        />
        {!collapsed.certifications && (
          <div style={sectionBody}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {resumeData.certifications.map((cert, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={cert}
                    onChange={(e) => updateListItem("certifications", idx, e.target.value)}
                    placeholder="AWS Certified Solutions Architect"
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  <button
                    style={removeBtnStyle}
                    onClick={() => removeListItem("certifications", idx)}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button style={{ ...addBtnStyle, marginTop: 10 }} onClick={() => addListItem("certifications")}>
              <Plus size={14} /> Add Certification
            </button>
          </div>
        )}
      </div>

      {/* ── Languages Section ─────────────────────────────────────────────── */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <SectionHeader
          id="languages"
          icon={Globe}
          title="Languages"
          count={resumeData.languages.length}
        />
        {!collapsed.languages && (
          <div style={sectionBody}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {resumeData.languages.map((lang, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={lang}
                    onChange={(e) => updateListItem("languages", idx, e.target.value)}
                    placeholder="English (Native)"
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  <button
                    style={removeBtnStyle}
                    onClick={() => removeListItem("languages", idx)}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button style={{ ...addBtnStyle, marginTop: 10 }} onClick={() => addListItem("languages")}>
              <Plus size={14} /> Add Language
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
