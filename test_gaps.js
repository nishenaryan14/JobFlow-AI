const fs = require('fs');

const STOP_WORDS = new Set([
  "the", "you", "your", "they", "them", "he", "she", "it", "we", "our", "us",
  "what", "who", "whom", "this", "that", "these", "those", "here", "there",
  "which", "whose", "where", "when", "why", "how", "all", "any", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "can", "will", "just", "should",
  "now", "would", "could", "must", "with", "without", "about", "into", "through",
  "during", "before", "after", "above", "below", "like", "sets", "apart", "join",
  "help", "work", "client", "opportunity", "associate", "firm", "brand", "role",
  "team", "needs", "scope", "value", "success", "pwc", "acceleration", "center",
  "india", "learn", "grow", "every", "experience", "years", "degree", "bachelor",
  "bachelors", "english", "written", "oral", "proficiency", "required", "related",
  "field", "science", "engineering", "statistics", "mathematics", "computer",
  "advisory", "assurance", "tax", "business", "services", "data", "analytics",
  "opportunites", "fast-paced", "environment", "solutions", "insights", "datasets",
  "decision-making", "problems", "projects", "knowledge", "deliver", "quality",
  "inspiring", "makes", "difference", "day", "focus", "utilizing", "advanced",
  "analytical", "techniques", "extract", "drive", "practice", "leverage",
  "manipulation", "visualization", "statistical", "modeling", "support",
  "curiosity", "contributing", "engagement", "build", "exposed", "connections",
  "manage", "inspire", "others", "personal", "deepening", "resources", "technology",
  "adapt", "variety", "members", "presents", "challenges", "ownership",
  "consistently", "delivering", "doors", "navigate", "ambiguity", "embracing",
  "moments", "responsibilities", "algorithmic", "processes", "engaging",
  "research", "innovation", "optimize", "operations", "implementing", "machine",
  "predictive", "capabilities", "programming", "automation", "tasks", "gathering",
  "discern", "patterns", "inform", "strategies", "must", "sets", "apart", "gcp",
  "sas", "predictive", "building", "deploying", "contribute", "interfaces",
  "frameworks", "equivalent", "develop", "apis", "serve", "users", "familiarity",
  "containerized", "workflows", "demonstrating", "software", "derive", "actionable",
  "development", "processing", "adapting", "diverse", "client's", "client portfolio",
  "global", "global teams", "connected", "collaboration", "hands-on", "learning",
  "cutting-edge", "tools", "inclusive", "culture", "inspiring work", "makes a difference"
]);

const TECH_KEYWORDS = new Set([
  "python", "javascript", "typescript", "java", "go", "golang", "rust", "c++",
  "c#", "ruby", "php", "swift", "kotlin", "scala", "r", "sql", "nosql",
  "react", "angular", "vue", "next.js", "nextjs", "node.js", "nodejs", "express",
  "django", "flask", "fastapi", "spring", "rails",
  "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
  "terraform", "ansible", "jenkins", "ci/cd", "github actions",
  "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "dynamodb",
  "kafka", "rabbitmq", "graphql", "rest", "grpc", "microservices",
  "machine learning", "deep learning", "nlp", "computer vision", "pytorch",
  "tensorflow", "langchain", "langgraph", "openai", "llm", "llms",
  "git", "linux", "agile", "scrum", "jira", "figma", "tableau",
  "html", "css", "tailwind", "sass", "webpack", "vite",
  "api", "oauth", "jwt", "sso", "rbac", "security",
  "testing", "jest", "pytest", "cypress", "selenium", "unit testing",
  "data analysis", "data engineering", "etl", "data pipeline",
  "communication", "leadership", "problem-solving", "teamwork",
  "project management", "stakeholder management",
]);

function extractJDKeywords(jd) {
  const lower = jd.toLowerCase();
  const keywords = [];

  for (const kw of TECH_KEYWORDS) {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "gi");
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      const importance = matches.length >= 3 ? "critical" : matches.length >= 2 ? "important" : "nice_to_have";
      keywords.push({ keyword: kw, importance, count: matches.length });
    }
  }

  const capitalizedTerms = jd.match(/[A-Z][a-zA-Z0-9+#.-]+/g) || [];
  for (const term of capitalizedTerms) {
    const termClean = term.replace(/^[.,\\/#!$%\\^&\\*;:{}=\\-_`~()]+|[.,\\/#!$%\\^&\\*;:{}=\\-_`~()]+$/g, "");
    const termLower = termClean.toLowerCase();
    if (termLower.length >= 3 && !STOP_WORDS.has(termLower) && !keywords.find(k => k.keyword === termLower)) {
      const regex = new RegExp(`\\b${termClean.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "gi");
      const matches = jd.match(regex);
      if (matches && matches.length >= 2) {
        keywords.push({ keyword: termLower, importance: "important", count: matches.length });
      }
    }
  }

  keywords.sort((a, b) => b.count - a.count);
  return keywords.slice(0, 30).map(({ keyword, importance }) => ({ keyword, importance }));
}

const jd = `The Opportunity
Join our Acceleration Center India and help shape the future of business for our diverse client portfolio across geographies and jurisdictions. You’ll work at the heart of global teams across Advisory, Assurance, Tax and Business Services—solving real client challenges through connected collaboration. We’ll help you grow your skills so you can go further. With hands-on learning, cutting-edge tools and an inclusive culture, this is your opportunity to do inspiring work that makes a difference—every day.
As an Agentic AI Developer - Associate, you will focus on utilizing advanced analytical techniques to extract insights from large datasets and drive data-driven decision-making. Within our Data, Analytics & AI practice, you will leverage skills in data manipulation, visualization, and statistical modeling to support clients in solving complex business problems. As an Associate, you will be driven by curiosity, cont`;

console.log(extractJDKeywords(jd));
