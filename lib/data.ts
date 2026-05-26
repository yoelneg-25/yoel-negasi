export const siteConfig = {
  name: "Yoel Negasi",
  title: "Senior Full Stack Engineer",
  subtitle: "React · Node.js · Platform Engineering · Automation · AI",
  bio: "I'm a Senior Full Stack Engineer with experience building scalable enterprise platforms, modern React applications, workflow automation systems, and CI/CD infrastructure. My work spans frontend architecture, backend services, developer tooling, and automation pipelines using React, Next.js, Node.js, TypeScript, AWS, and GitHub Actions. I actively integrate AI tools — GitHub Copilot, Claude, and the OpenAI API — into real engineering workflows to accelerate delivery, improve code quality, and build smarter internal tooling.",
  location: "Oakland, CA",
  email: "yoelneg25@gmail.com",
  github: "https://github.com/yoelneg-25/profile",
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
  { label: "Contact", href: "#contact" },
];

export const projects = [
  {
    id: "flowforge",
    name: "FlowForge",
    tagline: "Enterprise Workflow Automation Engine",
    description:
      "Enterprise-grade workflow automation engine designed for orchestrating multi-step approval and change-management processes across large business units. Built for regulated environments with YAML-defined workflow schemas, role-based routing, SLA tracking, and a full immutable audit trail.",
    longDescription:
      "FlowForge replaced a fragmented mix of email chains and manual approval processes across 12 business units. The system ingests declarative YAML workflow definitions, validates them against a JSON Schema registry, and executes multi-step processes with parallel branch support, conditional routing, and SLA enforcement. Built on a NestJS microservice backend with a React-based visual workflow builder on the frontend.",
    problem:
      "Approval and change-management processes across 12 business units ran entirely through email chains, spreadsheet trackers, and manual handoffs. There was no visibility into where a request stood, no SLA enforcement, and no audit trail — creating compliance risk and delays that cost weeks per process cycle.",
    architecture: [
      { step: "YAML Schema", desc: "Teams define workflows declaratively — steps, roles, SLA windows, escalation rules" },
      { step: "Schema Validator", desc: "JSON Schema registry enforces shape and business rules before execution begins" },
      { step: "Workflow Engine", desc: "NestJS service executes steps, handles branching logic, and tracks state in PostgreSQL" },
      { step: "Role Router", desc: "Resolves the correct approver per step based on business unit and role mapping" },
      { step: "SLA Monitor", desc: "AWS SQS-backed timer detects missed deadlines and triggers escalation automatically" },
      { step: "Audit Event Store", desc: "Append-only event log captures every action — immutable, queryable, compliance-ready" },
    ],
    tech: ["React", "TypeScript", "Node.js", "NestJS", "PostgreSQL", "Prisma", "AWS SQS", "Docker"],
    tags: ["Enterprise", "Automation", "Platform"],
    featured: true,
    color: "violet",
    demoPath: "/flowforge",
    highlights: [
      "Reduced approval cycle time by 60% across 12 business units",
      "YAML-defined workflow schemas with JSON Schema validation",
      "Role-based routing with SLA enforcement and escalation triggers",
      "Immutable audit trail with full event sourcing architecture",
    ],
  },
  {
    id: "pipelineiq",
    name: "PipelineIQ",
    tagline: "Internal Developer CI/CD Platform",
    description:
      "Internal developer platform for standardizing and monitoring CI/CD pipelines across 60+ microservices. Features a centralized GitHub Actions template library, YAML schema validation, real-time deployment health dashboards, and automated rollback triggers with Slack notification integration.",
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
    id: "switchboard",
    name: "Switchboard",
    tagline: "Feature Flag & Progressive Rollout Engine",
    description:
      "Progressive rollout engine for safely shipping features to production. Define feature flags in YAML — rollout percentages, kill switches, enabled state — and watch the user cohort react in real-time. Drag the rollout slider from 10% to 50% and watch exactly those users flip. Hit the kill switch and 100% of traffic drops to false instantly.",
    longDescription:
      "Switchboard was built after a botched full-fleet deployment took down a payment flow for all users simultaneously. The platform enforces progressive rollouts: every feature ships behind a flag with a configurable percentage, evaluated deterministically per user via consistent hashing. Engineering teams control rollout speed, disable flags without a deploy, and have a kill switch that instantly zeroes out any flag. The evaluation engine is pure client-side — no round trip — so flag resolution adds zero latency.",
    problem:
      "Features shipped directly to 100% of users simultaneously. When something broke, the only option was a full rollback — a 15-minute process that impacted everyone. There was no way to ship to 5% of users first, no kill switch to stop the bleeding, and no visibility into which users were experiencing which variant.",
    architecture: [
      { step: "Flag Registry", desc: "YAML config defines all feature flags — name, rollout %, enabled state, kill switch — as code in version control" },
      { step: "Evaluation Engine", desc: "Pure deterministic function: hash(userId + flagName) % 100 < rollout_pct — same user always gets the same result" },
      { step: "Cohort Calculator", desc: "Computes the exact set of users receiving each flag — deterministic, auditable, consistent across all service replicas" },
      { step: "Kill Switch", desc: "Overrides any flag to false for 100% of traffic instantly — no code deploy, no pipeline, no downtime window" },
      { step: "Override Layer", desc: "In-memory overrides sit on top of the YAML config — ops can adjust rollout % live without touching the config file" },
      { step: "Audit Log", desc: "Every flag change recorded with actor, timestamp, previous value, and new value — full compliance and rollback trail" },
    ],
    tech: ["React", "TypeScript", "Next.js", "Framer Motion", "Node.js"],
    tags: ["Platform", "Feature Flags", "DevOps"],
    featured: false,
    color: "teal",
    demoPath: "/switchboard",
    highlights: [
      "Deterministic user assignment — same user always gets the same flag result via consistent hashing",
      "Kill switch zeroes any flag for 100% of traffic instantly — no deploy required",
      "Drag rollout slider and watch exactly those users flip in the live cohort grid",
      "Override layer lets ops adjust flags live without editing the config file",
    ],
  },
  {
    id: "devmind",
    name: "DevMind",
    tagline: "AI-Powered Internal Developer Productivity Platform",
    description:
      "Internal platform that embeds GitHub Copilot workflows, Claude, and the OpenAI API directly into the engineering cycle. Automates PR documentation, accelerates code review triage, surfaces runbook answers via natural language, and cuts incident response time — all without replacing engineer judgment.",
    longDescription:
      "DevMind was built to answer one question: where exactly does AI save engineers the most time without introducing risk? The answer was three places — PR documentation (high friction, low value), code review prep (time-consuming, pattern-heavy), and runbook lookup (slow, high-stakes). The platform wraps GitHub Copilot with team-specific prompt context, uses the OpenAI API for structured PR description generation, and serves Claude-powered conversational search over internal runbooks and architecture docs via a Next.js UI and Slack bot. No fine-tuning, no vector databases — just well-engineered prompt design and clean API integration.",
    tech: ["Next.js", "TypeScript", "OpenAI API", "Claude API", "Node.js", "GitHub Copilot", "Slack API"],
    tags: ["AI Tooling", "Developer Experience", "Platform"],
    featured: false,
    color: "fuchsia",
    demoPath: "/devmind",
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
    highlights: [
      "GitHub Copilot integrated with team-specific prompt context for consistent output",
      "OpenAI-powered PR description generation — 40% reduction in documentation time",
      "Claude-backed conversational runbook search replacing manual wiki lookup",
      "AI-assisted code review summaries flagging risk patterns before human review",
    ],
  },
  {
    id: "schemaguard",
    name: "SchemaGuard",
    tagline: "Database Schema Change Governance Platform",
    description:
      "Schema governance platform that treats database changes as code. Engineers propose schema migrations in a YAML diff format, SchemaGuard validates them against a rule engine, detects breaking changes — dropped columns, type narrowing, renamed constraints — and blocks anything that would break production contracts without explicit approval.",
    longDescription:
      "SchemaGuard was built after a dropped column in a shared PostgreSQL database silently broke 4 downstream services that were never notified of the change. The platform enforces a pull-request model for schema changes: engineers submit a YAML-formatted migration proposal, the rule engine classifies each change as safe, warning, or breaking, and breaking changes require explicit stakeholder sign-off before they can be applied.",
    problem:
      "Database schema changes were applied directly by engineers with no review process, no impact analysis, and no notification to downstream consumers. A single dropped column broke 4 services in production — none of which had been consulted before the migration ran.",
    architecture: [
      { step: "Migration Proposal", desc: "Engineer submits a YAML file describing the intended schema change — add column, drop column, rename, change type" },
      { step: "Rule Engine", desc: "Classifies each operation: SAFE (additive), WARNING (nullable → non-null), or BREAKING (drop, rename, type narrowing)" },
      { step: "Impact Analyzer", desc: "Cross-references the change against a registered service dependency map — shows which services read the affected columns" },
      { step: "Approval Gate", desc: "BREAKING changes require sign-off from all registered downstream service owners before the migration is unblocked" },
      { step: "Migration Registry", desc: "Every proposed, approved, and rejected change is recorded with actor, timestamp, and risk classification" },
      { step: "Rollback Planner", desc: "Auto-generates a compensating migration (the inverse operation) at proposal time, ready to execute if production breaks" },
    ],
    tech: ["Node.js", "TypeScript", "PostgreSQL", "Prisma", "React", "NestJS", "GraphQL"],
    tags: ["Database", "Governance", "DevOps"],
    featured: false,
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
    id: "surgeboard",
    name: "SurgeBoard",
    tagline: "Real-Time Traffic & Capacity Simulator",
    description:
      "Live infrastructure simulator for reasoning about cluster behavior under load. Engineers define a service cluster in YAML — replicas, RPS limits, latency targets, SLO budgets — and watch real-time charts respond as synthetic traffic flows through the system.",
    longDescription:
      "SurgeBoard was built to make capacity planning tangible. It simulates a real service cluster: traffic flows in, latency climbs under load, errors spike when replicas are saturated, and the SLO burn rate depletes in real-time. Engineers can inject incidents — traffic surges, latency spikes, instance failures — and observe the system's response before any production change is made. Autoscale fires when utilization crosses the configured threshold, redistributing load and recovering error rate automatically.",
    problem:
      "Capacity planning decisions were made from gut feel and last week's metrics. Engineers couldn't reason about how a 3x traffic spike would affect p99 latency, SLO burn rate, or whether the current replica count would hold — not without pushing a change to production and watching it break.",
    architecture: [
      { step: "Cluster Config", desc: "YAML defines replicas, per-replica RPS limit, latency target, error budget, and autoscale threshold" },
      { step: "Traffic Engine", desc: "Simulates realistic RPS with noise, ramp patterns, and burst events — drives all downstream calculations" },
      { step: "Latency Model", desc: "Per-replica latency derived from utilization curve — p50/p95/p99 calculated with jitter at each tick" },
      { step: "Error Model", desc: "Error rate spikes when aggregate RPS exceeds cluster capacity — proportional to overload severity" },
      { step: "SLO Tracker", desc: "Burns error budget when p99 > latency_target or error_rate > error_budget_pct — shows remaining budget live" },
      { step: "Autoscaler", desc: "Fires when avg utilization > autoscale_threshold — spawns new replica, redistributes load, recovers metrics" },
    ],
    tech: ["React", "TypeScript", "Recharts", "Next.js", "Framer Motion"],
    tags: ["Platform Engineering", "Observability", "Simulation"],
    featured: true,
    color: "orange",
    demoPath: "/surgeboard",
    highlights: [
      "YAML-defined cluster config drives the entire simulation engine",
      "Live p50 / p95 / p99 latency percentile charts update every tick",
      "Incident injection: Traffic Surge, Latency Spike, Kill Instance",
      "Autoscaler fires automatically when utilization crosses configured threshold",
    ],
  },
  {
    id: "queryscope",
    name: "QueryScope",
    tagline: "SQL Query Plan Analyzer & Optimizer",
    description:
      "Interactive SQL analyzer that parses queries and renders a visual execution plan tree. Each node shows its operation type, estimated cost, and optimization opportunities. An index advisor and query rewriter suggest concrete improvements before the query ever hits the database.",
    longDescription:
      "QueryScope was built after database engineers kept asking the same question: why is this query slow? The tool parses SQL queries into an AST, maps them to execution plan nodes (table scans, hash joins, sorts, aggregates), estimates relative cost per node, and surfaces actionable suggestions — missing indexes, implicit type casts, inefficient join orders. The query rewriter produces an equivalent optimized version. No database connection required — the analysis is purely static and structural.",
    problem:
      "Database performance issues were diagnosed reactively — engineers ran EXPLAIN on a slow query, got a wall of text, and spent hours interpreting it. There was no visual layer, no structured index advisor, and no way to explore query alternatives without running them.",
    architecture: [
      { step: "SQL Parser", desc: "Tokenizes and parses SQL into a structured AST — handles SELECT, JOIN, WHERE, GROUP BY, subqueries" },
      { step: "Plan Builder", desc: "Maps AST nodes to execution plan operations: sequential scan, index scan, hash join, sort, aggregate" },
      { step: "Cost Estimator", desc: "Assigns relative cost to each node based on operation type, selectivity hints, and join cardinality" },
      { step: "Tree Renderer", desc: "Renders the execution plan as an interactive SVG tree — nodes color-coded by cost, expandable for detail" },
      { step: "Index Advisor", desc: "Detects full table scans and missing index opportunities — recommends CREATE INDEX statements" },
      { step: "Query Rewriter", desc: "Produces an optimized equivalent query — rewrites implicit casts, reorders joins, pushes predicates down" },
    ],
    tech: ["React", "TypeScript", "Next.js", "Framer Motion"],
    tags: ["Database", "Developer Tooling", "Backend"],
    featured: false,
    color: "emerald",
    demoPath: "/queryscope",
    highlights: [
      "Visual execution plan tree with per-node cost estimates and operation labels",
      "Supports SELECT, JOIN, subqueries, GROUP BY, ORDER BY, and CTEs",
      "Index advisor surfaces missing indexes with concrete CREATE INDEX suggestions",
      "One-click query rewriter produces an optimized equivalent SQL statement",
    ],
  },
];

export const experience = [
  {
    id: 1,
    company: "PG&E",
    title: "Senior Software Engineer",
    period: "2025 — Present",
    description:
      "Building modern full stack platforms and workflow systems focused on operational efficiency, defect tracking, and internal engineering tooling. Developing scalable React and Node.js applications, improving platform reliability, and contributing to enterprise modernization initiatives across engineering teams.",
    tech: ["React", "Next.js", "TypeScript", "Node.js", "GraphQL", "PostgreSQL", "AWS", "Docker"],
    current: true,
  },
  {
    id: 2,
    company: "Optum / UnitedHealth Group",
    title: "Software Engineer",
    period: "2024 — 2025",
    description:
      "Designed and implemented enterprise automation systems for technology governance and developer workflows. Built GitHub Actions pipelines, YAML validation automation, audit logging systems, and CI/CD tooling used across large-scale engineering environments. Integrated AI-assisted workflows and developer productivity tooling into engineering processes.",
    tech: ["React", "Node.js", "NestJS", "TypeScript", "Prisma", "GitHub Actions", "AWS", "PostgreSQL"],
    current: false,
  },
  {
    id: 3,
    company: "The Home Depot",
    title: "Software Engineer",
    period: "2023 — 2024",
    description:
      "Re-engineered a legacy enterprise application into a modern React and Node.js platform used by store teams for task and project management. Built scalable APIs, responsive UI systems, and workflow-driven features that improved usability, maintainability, and operational efficiency across internal users.",
    tech: ["React", "Node.js", "TypeScript", "Material UI", "MySQL", "REST APIs", "Redux"],
    current: false,
  },
  {
    id: 4,
    company: "Ergonomic Group",
    title: "Full Stack Engineer",
    period: "2021 — 2023",
    description:
      "Developed full stack business applications and modern UI systems with a focus on responsive design, frontend architecture, and backend service integration. Collaborated closely with product and UX teams to build scalable React applications and internal workflow solutions.",
    tech: ["React", "Angular", "Node.js", "JavaScript", "TypeScript", "MongoDB", "Express"],
    current: false,
  },
];

export const skills = [
  {
    category: "Frontend",
    icon: "Monitor",
    description: "Production-scale UI engineering",
    items: [
      { name: "React", context: "5+ years · Enterprise scale" },
      { name: "Next.js", context: "App Router · SSR · ISR" },
      { name: "TypeScript", context: "5+ years · Strong typing" },
      { name: "Tailwind CSS", context: "Design systems · Utility-first" },
      { name: "Framer Motion", context: "Production animations" },
      { name: "GraphQL", context: "Apollo · Relay · Client" },
    ],
  },
  {
    category: "Backend",
    icon: "Server",
    description: "Scalable service architecture",
    items: [
      { name: "Node.js", context: "5+ years · Production APIs" },
      { name: "NestJS", context: "Enterprise microservices" },
      { name: "GraphQL", context: "Schema design · Resolvers" },
      { name: "Prisma", context: "ORM · Migrations · Type safety" },
      { name: "PostgreSQL", context: "Complex schemas · Performance" },
      { name: "REST APIs", context: "Design · Versioning · Docs" },
    ],
  },
  {
    category: "Infrastructure",
    icon: "Cloud",
    description: "Cloud & DevOps engineering",
    items: [
      { name: "AWS", context: "ECS · SQS · Lambda · EC2" },
      { name: "Docker", context: "Containerization · Compose" },
      { name: "GitHub Actions", context: "CI/CD · Template libraries" },
      { name: "CI/CD", context: "Pipeline design · Automation" },
      { name: "Terraform", context: "IaC · Cloud provisioning" },
      { name: "Kubernetes", context: "Cluster management · Helm" },
    ],
  },
  {
    category: "AI-Enhanced Engineering",
    icon: "Brain",
    description: "AI tooling in real engineering workflows",
    items: [
      { name: "GitHub Copilot", context: "Daily driver · Workflow integration" },
      { name: "OpenAI API", context: "Tooling · Automation · Internal apps" },
      { name: "Claude API", context: "Code review · Doc generation" },
      { name: "Prompt Engineering", context: "Structured prompts · Context design" },
      { name: "AI-Powered Tooling", context: "Internal tools · Dev productivity" },
      { name: "Engineering Automation", context: "AI-assisted CI/CD · Code gen" },
    ],
  },
  {
    category: "Tooling & Automation",
    icon: "Workflow",
    description: "Developer experience & automation",
    items: [
      { name: "YAML Automation", context: "Schema design · Validation" },
      { name: "Audit Systems", context: "Event sourcing · Compliance" },
      { name: "Workflow Engines", context: "Design · Implementation" },
      { name: "ESLint / Prettier", context: "Org-wide standards" },
      { name: "Storybook", context: "Component documentation" },
      { name: "Jest / Testing", context: "TDD · Integration · E2E" },
    ],
  },
];
