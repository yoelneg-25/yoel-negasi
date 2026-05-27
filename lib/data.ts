export const siteConfig = {
  name: "Yoel Negasi",
  title: "Senior Full Stack & Platform Engineer",
  subtitle: "Building scalable enterprise platforms, intelligent automation systems, and AI-enabled developer workflows.",
  bio: "8+ years of software experience building modern full stack systems across React, Node.js, platform engineering, CI/CD automation, and cloud infrastructure. Currently building operational tooling and workflow platforms at PG&E focused on scalable engineering systems and developer productivity.",
  location: "Oakland, CA",
  email: "yoelneg25@gmail.com",
  github: "https://github.com/yoelneg-25/yoel-negasi",
  linkedin: "https://www.linkedin.com/in/yoel-goitom/",
  twitter: "",
  resume: "/resume.pdf",
};

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "AI Engineering", href: "#ai-engineering" },
  { label: "Projects", href: "#projects" },
  { label: "Experience", href: "#experience" },
  { label: "Skills", href: "#skills" },
  { label: "Education", href: "#education" },
  { label: "Contact", href: "#contact" },
];

export const projects = [
  {
    id: "pipelineiq",
    name: "PipelineIQ",
    tagline: "Internal CI/CD Engineering Platform",
    description:
      "Internal CI/CD platform for standardizing deployment workflows across engineering teams. Provides centralized GitHub Actions templates, deployment visibility, rollback automation, and operational monitoring across distributed services.",
    longDescription:
      "PipelineIQ addressed pipeline sprawl — teams were maintaining 60+ independently managed GitHub Actions workflows with no consistency, visibility, or reliability guarantees. The platform introduces a reusable workflow template registry, a YAML linter with custom enterprise rules, and a deployment observability dashboard that surfaces build duration trends, failure rates, and rollback events across all services.",
    problem:
      "60+ microservices each owned their own GitHub Actions pipelines independently — no shared standards, no cross-team visibility, and no consistency in testing or deployment patterns. Failed deployments went undetected for hours, rollbacks were manual, and there was no way to know the health of the platform at a glance.",
    architecture: [
      { step: "Service Registry", desc: "YAML config defines all services, teams, SLO targets, and rollback policies in one place" },
      { step: "Template Registry", desc: "Centralized GitHub Actions workflow templates — teams reference rather than duplicate pipeline logic" },
      { step: "Schema Validator", desc: "Custom YAML linter with enterprise rule sets catches misconfigured pipelines before they run" },
      { step: "Health Monitor", desc: "React dashboard aggregates build success rate, failure trends, and SLO adherence across all services" },
      { step: "Rollback Engine", desc: "Automated rollback fires when a deployment fails — restores the last known-good version without manual intervention" },
      { step: "Alert Router", desc: "Slack webhook integration surfaces incidents with full context: service name, build number, failure reason" },
    ],
    tech: ["GitHub Actions", "Node.js", "TypeScript", "Docker", "AWS ECS", "React", "PostgreSQL"],
    tags: ["CI/CD", "Developer Tooling", "Platform"],
    status: "Engineering Simulation",
    featured: true,
    color: "indigo",
    demoPath: "/pipelineiq",
    highlights: [
      "Standardized 60+ microservice pipelines under a shared template registry",
      "Custom YAML schema validator with enterprise-specific rule sets",
      "Real-time deployment health dashboard with failure trend analysis",
      "Automated rollback triggers with Slack-integrated incident alerts",
    ],
  },
  {
    id: "schemaguard",
    name: "SchemaGuard",
    tagline: "Database Schema Change Governance Platform",
    description:
      "Schema governance platform for validating database migration proposals before deployment. Engineers define schema changes in YAML, SchemaGuard analyzes dependency impact across services, detects breaking changes, and enforces approval workflows for production safety.",
    longDescription:
      "SchemaGuard was built after a dropped column in a shared PostgreSQL database silently broke 4 downstream services that were never notified of the change. The platform enforces a pull-request model for schema changes: engineers submit a YAML-formatted migration proposal, the rule engine classifies each change as safe, warning, or breaking, and breaking changes require explicit stakeholder sign-off before they can be applied.",
    problem:
      "Prevents risky schema changes from reaching production by surfacing downstream service impact before deployment. A single dropped column broke 4 services in production — none of which had been consulted before the migration ran.",
    architecture: [
      { step: "YAML Proposal", desc: "Engineer submits a YAML file describing the intended schema change — add column, drop column, rename, change type" },
      { step: "Validation Engine", desc: "Classifies each operation: SAFE (additive), WARNING (nullable → non-null), or BREAKING (drop, rename, type narrowing)" },
      { step: "Dependency Scanner", desc: "Cross-references the change against a registered service dependency map — shows which services read the affected columns" },
      { step: "Breaking Change Analyzer", desc: "Detects downstream breakage risk and surfaces all affected services with read/write access to changed columns" },
      { step: "Approval Gates", desc: "BREAKING changes require sign-off from all registered downstream service owners before the migration is unblocked" },
      { step: "Deployment Pipeline", desc: "Approved migrations flow to the deployment pipeline with a compensating rollback migration auto-generated at proposal time" },
    ],
    tech: ["Node.js", "TypeScript", "PostgreSQL", "Prisma", "React", "NestJS", "GraphQL"],
    tags: ["Database", "Governance", "DevOps"],
    status: "Production Concept",
    featured: true,
    color: "cyan",
    demoPath: "/schemaguard",
    highlights: [
      "Rule engine classifies every schema change: SAFE, WARNING, or BREAKING",
      "Impact analysis cross-references changes against downstream service dependency map",
      "Breaking changes gate on explicit approval from all affected service owners",
      "Auto-generates compensating rollback migration at proposal time",
    ],
  },
  {
    id: "opspilot",
    name: "OpsPilot",
    tagline: "Proactive AI Assistant for Engineering Workflows",
    description:
      "AI-powered engineering assistant embedded into GitHub Actions, Slack, and PR workflows. Proactively surfaces CI/CD failure analysis, deployment incident summaries, runbook answers, and PR documentation — without waiting to be asked.",
    longDescription:
      "OpsPilot was built to answer one question: where exactly does AI save engineers the most time without introducing risk? The answer was three places — PR documentation (high friction, low value), code review prep (time-consuming, pattern-heavy), and runbook lookup (slow, high-stakes). The platform wraps the OpenAI API and Claude with team-specific prompt context, surfaces answers inline in Slack and GitHub, and integrates directly into CI/CD failure events.",
    problem:
      "Engineers were spending 20–30 minutes per PR writing descriptions from scratch, another hour in review prep re-reading diffs, and long stretches searching through stale wiki pages during incidents. The cost was invisible individually but measured in days per sprint across the team.",
    architecture: [
      { step: "PR Documenter", desc: "Code diff piped to OpenAI API with a structured prompt — returns title, type, risk level, change list, and testing plan in a typed JSON response" },
      { step: "Code Review Engine", desc: "AST-level analysis detects N+1 queries, unsafe type assertions, overfetching, and unhandled async rejections — ranks findings by severity before human review begins" },
      { step: "Runbook Search", desc: "Claude API with retrieval-augmented context over internal runbook corpus — returns step-by-step procedures with exact shell commands in response to natural language queries" },
      { step: "Copilot Integration", desc: "GitHub Copilot wrapped with team-specific prompt context injected per repo — consistent output aligned with internal naming conventions and architecture patterns" },
      { step: "Slack Bot", desc: "Node.js Slack app surfaces runbook answers and review summaries inline in incident channels — no context switch to a browser required" },
      { step: "Audit Log", desc: "Every AI-generated output stored with the input hash, model version, and timestamp — allows prompt regression testing when models update" },
    ],
    tech: ["Next.js", "TypeScript", "OpenAI API", "Claude API", "Node.js", "GitHub Copilot", "Slack API"],
    tags: ["AI Tooling", "Developer Experience", "Platform"],
    status: "Active Development",
    featured: true,
    color: "fuchsia",
    demoPath: "/opspilot",
    highlights: [
      "Proactively embedded in GitHub Actions and Slack — surfaces answers without context switching",
      "OpenAI-powered PR description generation reducing documentation overhead per PR",
      "Claude-backed conversational runbook search replacing manual wiki lookup",
      "AI-assisted code review summaries flagging risk patterns before human review",
    ],
  },
  {
    id: "incident-assistant",
    name: "AI Incident Assistant",
    tagline: "Reactive AI Log Analysis & Root Cause Platform",
    description:
      "AI-powered debugging platform for reactive incident investigation. Paste or upload CI/CD logs, deployment failures, or error traces — the assistant analyzes root cause, surfaces affected services, and suggests concrete fixes. Chat with your logs to drill deeper.",
    longDescription:
      "AI Incident Assistant fills the gap OpsPilot doesn't cover: when something breaks and you need to dig in. Engineers paste raw CI/CD logs, GitHub Actions output, or deployment traces into the analysis panel. The assistant classifies the failure type, extracts root cause signals, identifies affected services, assigns severity, and generates a fix recommendation. A chat interface lets engineers ask follow-up questions against the same log context without re-pasting.",
    problem:
      "Reduces time spent debugging deployments and operational incidents. Engineers waste hours manually parsing log output, cross-referencing runbooks, and coordinating root cause analysis across Slack threads during active incidents.",
    architecture: [
      { step: "Log Ingestion", desc: "Paste raw CI/CD output, GitHub Actions logs, or deployment traces — structured and unstructured formats supported" },
      { step: "Failure Classifier", desc: "Pattern-based classification engine identifies failure type: build error, test failure, deployment timeout, OOM, dependency conflict" },
      { step: "Root Cause Analyzer", desc: "Extracts key signal lines from log noise, maps to known failure patterns, and identifies the proximate cause" },
      { step: "Impact Assessment", desc: "Cross-references failure signals against service dependency context — surfaces which downstream services are at risk" },
      { step: "Fix Suggester", desc: "Generates concrete remediation steps: config changes, retry strategies, rollback commands, dependency pin suggestions" },
      { step: "Chat Interface", desc: "Conversational follow-up against the active log context — ask targeted questions without re-pasting the full log" },
    ],
    tech: ["Next.js", "TypeScript", "OpenAI API", "Node.js", "NestJS", "PostgreSQL", "Vercel AI SDK", "Tailwind"],
    tags: ["AI Tooling", "Incident Response", "DevOps"],
    status: "Active Development",
    featured: true,
    color: "amber",
    demoPath: "/incident-assistant",
    highlights: [
      "Classifies CI/CD failures by type: build error, test failure, OOM, timeout, dependency conflict",
      "Root cause extraction isolates signal from log noise with severity scoring",
      "Concrete fix suggestions: config changes, rollback commands, dependency pins",
      "Chat interface for follow-up questions against the active log context",
    ],
  },
];

export const experience = [
  {
    id: 1,
    company: "PG&E",
    title: "Senior Software Engineer",
    period: "Sep 2025 – Present",
    location: "Oakland, CA",
    description:
      "Building modern full stack platforms and workflow systems focused on infrastructure inspection, operational efficiency, and internal engineering tooling. Developing scalable React and Node.js applications, improving platform reliability, and contributing to cloud-native engineering platforms across teams.",
    tech: ["React", "Next.js", "TypeScript", "Node.js", "GraphQL", "PostgreSQL", "AWS", "Docker"],
    current: true,
  },
  {
    id: 2,
    company: "Optum / UnitedHealth Group",
    title: "Senior Software Engineer",
    period: "Jul 2024 – Aug 2025",
    location: "Remote",
    description:
      "Designed and implemented enterprise automation systems for technology governance and developer workflows. Built GitHub Actions pipelines, YAML validation automation, audit logging systems, and CI/CD tooling used across large-scale engineering environments. Integrated AI-assisted workflows and developer productivity tooling into engineering processes.",
    tech: ["React", "Node.js", "NestJS", "TypeScript", "Prisma", "GitHub Actions", "AWS", "PostgreSQL"],
    current: false,
  },
  {
    id: 3,
    company: "The Home Depot",
    title: "Software Engineer",
    period: "Jul 2023 – Jul 2024",
    location: "Atlanta, GA",
    description:
      "Re-engineered a legacy enterprise application into a modern React and Node.js platform used by store teams for task and project management. Built scalable APIs, responsive UI systems, and workflow-driven features that improved usability, maintainability, and operational efficiency across internal users.",
    tech: ["React", "Node.js", "TypeScript", "Material UI", "MySQL", "REST APIs", "Redux"],
    current: false,
  },
  {
    id: 4,
    company: "Ergonomic Group",
    title: "Full Stack Engineer",
    period: "Sep 2022 – Jul 2023",
    location: "New York, NY",
    description:
      "Developed full stack business applications and modern UI systems with a focus on responsive design, frontend architecture, and backend service integration. Collaborated with product and UX teams to build scalable React applications and internal workflow solutions.",
    tech: ["React", "Angular", "Node.js", "JavaScript", "TypeScript", "MongoDB", "Express"],
    current: false,
  },
  {
    id: 5,
    company: "Co-Bounce Company",
    title: "Software Engineer",
    period: "Oct 2019 – Aug 2022",
    location: "Sacramento, CA",
    description:
      "Built and maintained full stack web applications for a digital platform startup, owning features end-to-end from API design to frontend delivery. Contributed to product reliability, performance improvements, and developer tooling across a fast-moving engineering team.",
    tech: ["React", "Node.js", "JavaScript", "TypeScript", "PostgreSQL", "REST APIs", "Docker"],
    current: false,
  },
  {
    id: 6,
    company: "Liya Enterprise Company",
    title: "Full Stack JavaScript Developer",
    period: "Jan 2017 – Sep 2019",
    location: "Asmara, Eritrea",
    description:
      "Developed full stack web applications for enterprise clients using JavaScript, React, and Node.js. Built internal business tooling, client-facing web portals, and RESTful APIs across a range of industries.",
    tech: ["JavaScript", "React", "Node.js", "Express", "MySQL", "HTML", "CSS"],
    current: false,
  },
];

export const skills = [
  {
    category: "Frontend",
    icon: "Monitor",
    description: "Production-scale UI engineering",
    items: [
      { name: "React", context: "7 years · Enterprise UI systems · Workflow platforms" },
      { name: "Next.js", context: "5 years · App Router · SSR · Production deployments" },
      { name: "TypeScript", context: "8 years · Strong typing · Enterprise codebases" },
      { name: "JavaScript", context: "8 years · Core language · Full stack delivery" },
      { name: "Redux", context: "5 years · State management · Large-scale apps" },
      { name: "Material UI", context: "5 years · Design systems · Internal tooling" },
    ],
  },
  {
    category: "Backend",
    icon: "Server",
    description: "Scalable service architecture",
    items: [
      { name: "Node.js", context: "7 years · Production APIs · Platform engineering" },
      { name: "NestJS", context: "5 years · Enterprise microservices · Modular architecture" },
      { name: "Express", context: "6 years · REST API design · Middleware systems" },
      { name: "GraphQL", context: "5 years · Schema design · Resolvers · API federation" },
      { name: "REST APIs", context: "8 years · Design · Versioning · Enterprise integration" },
      { name: "PostgreSQL", context: "6 years · Complex schemas · Query optimization" },
    ],
  },
  {
    category: "Cloud & DevOps",
    icon: "Cloud",
    description: "Cloud infrastructure & CI/CD engineering",
    items: [
      { name: "AWS", context: "5 years · ECS · SQS · Lambda · Production deployments" },
      { name: "GitHub Actions", context: "5 years · CI/CD automation · Enterprise pipelines" },
      { name: "Docker", context: "6 years · Containerization · Compose · Production builds" },
      { name: "Azure", context: "4 years · Cloud infrastructure · Enterprise environments" },
      { name: "GCP", context: "3 years · Cloud run · Managed services" },
      { name: "Kubernetes", context: "4 years · Cluster management · Helm · Deployment ops" },
    ],
  },
  {
    category: "AI & Automation",
    icon: "Brain",
    description: "AI-assisted engineering workflows",
    items: [
      { name: "OpenAI API", context: "3 years · AI-assisted engineering workflows · Tooling" },
      { name: "Claude API", context: "2 years · Code review · Runbook search · Doc generation" },
      { name: "GitHub Copilot", context: "3 years · Daily driver · Workflow integration" },
      { name: "Prompt Engineering", context: "Structured prompts · Context design · RAG patterns" },
      { name: "Workflow Automation", context: "CI/CD intelligence · Incident analysis · PR automation" },
      { name: "RAG", context: "Retrieval-augmented generation · Internal knowledge bases" },
    ],
  },
  {
    category: "Databases",
    icon: "Database",
    description: "Data layer engineering",
    items: [
      { name: "PostgreSQL", context: "6 years · Production schemas · Performance tuning" },
      { name: "MongoDB", context: "5 years · Document modeling · Enterprise apps" },
      { name: "MySQL", context: "6 years · Relational design · Legacy modernization" },
      { name: "Prisma", context: "4 years · ORM · Type-safe migrations · Schema management" },
      { name: "Redis", context: "4 years · Caching · Rate limiting · Session management" },
      { name: "pgvector", context: "AI-enabled vector search · Semantic retrieval" },
    ],
  },
];

export const education = [
  {
    id: 1,
    school: "Maharishi International University",
    degree: "Master's in Software Development",
    year: "2022",
    location: "Fairfield, IA",
  },
  {
    id: 2,
    school: "Eritrean Institute of Technology",
    degree: "BSc in Computer Science",
    year: "2017",
    location: "Asmara, Eritrea",
  },
];
