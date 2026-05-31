from pydantic import BaseModel, Field, field_validator
from typing import Any, List, Optional, Union


class RawJobData(BaseModel):
    title: str = ""
    company: str = ""
    url: str = ""
    source_board: str = ""
    company_description: str = ""
    location: str = "Not Listed"
    remote_policy: str = "Not Listed"
    required_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    experience_level: str = "Not Listed"
    salary_range: str = "Not Listed"
    key_responsibilities: List[str] = Field(default_factory=list)
    application_url: str = ""
    agentic_ai_relevance: str = "Not Listed"
    posted_date: str = "Not Listed"
    skipped_reason: Optional[str] = None


class ScrapedJobsOutput(BaseModel):
    jobs: List[RawJobData]


# ── Resume Analyzer Output Models ────────────────────────────────────────

class ExperienceEntry(BaseModel):
    title: str = ""
    company: str = ""
    duration: str = ""

    @classmethod
    def from_any(cls, v: Any) -> "ExperienceEntry":
        """Accept dict, string, or existing instance."""
        if isinstance(v, cls):
            return v
        if isinstance(v, dict):
            return cls(
                title=str(v.get("title", v.get("jobTitle", v.get("role", "")))),
                company=str(v.get("company", v.get("employer", v.get("organization", "")))),
                duration=str(v.get("duration", v.get("dates", v.get("period", "")))),
            )
        if isinstance(v, str):
            return cls(title=v)
        return cls()


def _coerce_str_list(values: Any) -> List[str]:
    """Coerce a list where items may be dicts or strings into List[str]."""
    if not isinstance(values, list):
        return []
    result = []
    for item in values:
        if isinstance(item, str):
            result.append(item)
        elif isinstance(item, dict):
            # Best-effort: concatenate meaningful fields
            parts = []
            for key in ("degree", "name", "title", "institution", "school",
                        "university", "description", "graduationYear", "year"):
                if key in item and item[key]:
                    parts.append(str(item[key]))
            result.append(", ".join(parts) if parts else str(item))
        else:
            result.append(str(item))
    return result


def _coerce_exp_list(values: Any) -> List[ExperienceEntry]:
    """Coerce a list where items may be dicts, strings, or ExperienceEntry."""
    if not isinstance(values, list):
        return []
    return [ExperienceEntry.from_any(v) for v in values]


class ResumeParseOutput(BaseModel):
    """Structured output for the resume_parser node.

    Validators accept dict-typed fields that LLMs sometimes return
    despite prompt instructions to use plain strings.
    """
    name: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    skills: List[str] = Field(default_factory=list)
    strongSkills: List[str] = Field(default_factory=list)
    experience: List[ExperienceEntry] = Field(default_factory=list)
    education: List[str] = Field(default_factory=list)
    projects: List[str] = Field(default_factory=list)

    @field_validator("education", "projects", "skills", "strongSkills", mode="before")
    @classmethod
    def coerce_string_lists(cls, v: Any) -> List[str]:
        return _coerce_str_list(v)

    @field_validator("experience", mode="before")
    @classmethod
    def coerce_experience(cls, v: Any) -> List[ExperienceEntry]:
        return _coerce_exp_list(v)


class ResumeAssessmentOutput(ResumeParseOutput):
    """Structured output for the assess_skills node.
    Merges parsed resume data with the career assessment."""
    overallScore: int = 5
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    summary: str = ""

    @field_validator("strengths", "weaknesses", mode="before")
    @classmethod
    def coerce_assessment_lists(cls, v: Any) -> List[str]:
        return _coerce_str_list(v)


# ── ATS Scorer Output Models ─────────────────────────────────────────────

class SectionScores(BaseModel):
    skills: int = 0
    experience: int = 0
    education: int = 0


class ATSScoreOutput(BaseModel):
    """Structured output for the ats_matcher node."""
    overallScore: int = 0
    keywordMatchPercent: int = 0
    matchedKeywords: List[str] = Field(default_factory=list)
    missingKeywords: List[str] = Field(default_factory=list)
    sectionScores: SectionScores = Field(default_factory=SectionScores)
    recommendations: List[str] = Field(default_factory=list)

    @field_validator("matchedKeywords", "missingKeywords", "recommendations", mode="before")
    @classmethod
    def coerce_keyword_lists(cls, v: Any) -> List[str]:
        return _coerce_str_list(v)


# ── Enhancement Evaluation Output Models ─────────────────────────────────

class EnhancementEvaluationOutput(BaseModel):
    """Structured output for the evaluate_quality node (LLM-as-judge).

    Measures whether the enhanced resume is actually better than the
    original, using multiple quality dimensions.
    """
    overallScore: int = 0
    keywordAlignment: int = 0
    skillsGapsClosed: int = 0
    skillsGapsTotal: int = 0
    toneConsistency: str = "pass"
    atsDensityImprovement: int = 0
    fabricationCheck: str = "pass"
    verdicts: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)

    @field_validator("verdicts", "improvements", mode="before")
    @classmethod
    def coerce_eval_lists(cls, v: Any) -> List[str]:
        return _coerce_str_list(v)
