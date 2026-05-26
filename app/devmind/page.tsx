"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RotateCcw, Brain, AlertTriangle, Info,
  CheckCircle2, Zap, BookOpen, GitPullRequest, Search,
  ChevronRight, Loader2, FileCode2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Mode = "pr-doc" | "code-review" | "runbook";

interface PRDoc {
  title: string;
  prType: "Feature" | "Bug Fix" | "Refactor" | "Security" | "Chore";
  risk: "Low" | "Medium" | "High";
  summary: string;
  changes: string[];
  testing: string[];
}

interface ReviewIssue {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  detail: string;
  suggestion: string;
  line?: number;
}

interface RunbookStep { title: string; commands: string[]; }
interface RunbookResult { title: string; tags: string[]; steps: RunbookStep[]; related: string[]; }

type OutputData =
  | { mode: "pr-doc"; data: PRDoc }
  | { mode: "code-review"; issues: ReviewIssue[]; score: number }
  | { mode: "runbook"; result: RunbookResult | null };

interface LogEntry { id: string; ts: string; msg: string; type: "info" | "ok" | "warn"; }

// ── Helpers ────────────────────────────────────────────────────────────────────
let _lid = 0;
function lid() { return `l${++_lid}`; }
function tsNow() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

// ── Default inputs ─────────────────────────────────────────────────────────────
const DEFAULT_INPUTS: Record<Mode, string> = {
  "pr-doc": `// middleware/rate-limit.ts
import { Redis } from 'ioredis';

export class RateLimiter {
  constructor(
    private redis: Redis,
    private limit: number,
    private window: number
  ) {}

  async check(key: string): Promise<boolean> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, this.window);
    }
    return count <= this.limit;
  }
}

export function rateLimitMiddleware(limiter: RateLimiter) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = \`rl:\${req.ip}:\${req.path}\`;
    const allowed = await limiter.check(key);
    if (!allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    next();
  };
}`,
  "code-review": `async function processOrders(userId: string) {
  const user = await db.query(
    'SELECT * FROM users WHERE id = ?', [userId]
  );

  const orders = await db.query(
    'SELECT * FROM orders WHERE user_id = ?', [userId]
  );

  const results = [];
  for (const order of orders) {
    const items = await db.query(
      'SELECT * FROM items WHERE order_id = ?', [order.id]
    );
    results.push({ order, items });
  }

  const data = results as any;
  return data;
}`,
  "runbook": `How do I roll back a failed deployment to the previous version?`,
};

// ── PR Doc generator ───────────────────────────────────────────────────────────
// Scores each category by counting distinct signal matches, then picks the winner.
function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0);
}

function generatePRDoc(code: string): PRDoc {
  const c = code.toLowerCase();
  const lines = c.split("\n");
  const hasAsync = /async|await|promise/.test(c);

  // ── Score each category ───────────────────────────────────────────────────
  const scores = {
    rateLimit: countMatches(c, [
      /rate.?limit/, /throttle/, /\b429\b/, /sliding.?window/,
      /incr\b/, /expire\b/, /quota/,
    ]),
    auth: countMatches(c, [
      /\bjwt\b/, /\brefresh.?token/, /\baccess.?token/, /\bpassword\b/,
      /\boauth\b/, /\bsign(?:in|up)\b/, /\bbcrypt\b/, /\bhmac\b/,
      /verifytoken|decodetoken|signtoken/,
    ]),
    security: countMatches(c, [
      /encrypt/, /decrypt/, /\bsecret\b/, /sanitize/, /\bcsrf\b/,
      /\bcors\b/, /\bsql.?inject/, /\bxss\b/,
    ]),
    database: countMatches(c, [
      /\bprisma\b/, /\bpostgres\b/, /\bmysql\b/, /\bmongo\b/,
      /db\.(query|find|insert|update|delete)/, /\bselect\b.*\bfrom\b/,
      /\bknex\b/, /\bdrizzle\b/, /\bsequelize\b/, /\brepository\b/,
    ]),
    api: countMatches(c, [
      /\bexpress\b/, /\bfastify\b/, /\bhono\b/, /\brouter\b/,
      /res\.(json|send|status)/, /req\.(body|params|query)/,
      /\bendpoint\b/, /\bcontroller\b/, /\bget\(|post\(|put\(|delete\(/,
    ]),
    test: countMatches(c, [
      /\bdescribe\b/, /\bit\(/, /\btest\(/, /\bexpect\b/,
      /\bjest\b/, /\bvitest\b/, /\bbeforeEach\b/, /\bafterAll\b/,
      /\bmock\b/, /\bstub\b/, /\bspy\b/,
    ]),
    refactor: countMatches(c, [
      /\brename\b/, /\bcleanup\b/, /\bremove\b/, /\bextract\b/,
      /\bdeprecated\b/, /\bmigrate\b/, /\bdeadcode\b/, /\btodo\b.*\bremove/,
    ]),
    validation: countMatches(c, [
      /\bajv\b/, /\bzod\b/, /\byup\b/, /\bjoi\b/, /\bvalibot\b/,
      /\.parse\(/, /\.validate\(/, /\.safeParse\(/,
      /\$schema/, /jsonschema/, /\.compile\(/, /\bschema\b.*\{/,
      /\brequired\b.*\[/, /additionalproperties/, /\benum\b.*\[/,
    ]),
    queue: countMatches(c, [
      /\bbullmq\b/, /\bbull\b/, /\bqueue\b/, /\.add\(.*job/, /\bjob\.data\b/,
      /\bworker\b/, /\bprocessor\b/, /\bpublish\b.*channel/, /\bsubscribe\b/,
      /\bkafka\b/, /\brabbitmq\b/, /\.enqueue\(/,
    ]),
    cache: countMatches(c, [
      /\bredis\b/, /\.get\(.*key/, /\.set\(.*ttl/, /\.del\(/,
      /\bmemcache\b/, /\.invalidate\(/, /cache\.(get|set|del)/,
      /\bttl\b/, /\.expire\(/, /\bstale\b.*while.*revalidate/,
    ]),
  };

  // ── Combine related scores ────────────────────────────────────────────────
  const secTotal  = scores.rateLimit * 2 + scores.auth * 2 + scores.security;
  const dbTotal   = scores.database;
  const apiTotal  = scores.api;
  const testTotal = scores.test;
  const refTotal  = scores.refactor;
  const valTotal  = scores.validation;
  const queueTotal = scores.queue;
  const cacheTotal = scores.cache;

  // Need a clear winner: at least 2 signals and leading by margin
  const categories = [
    { key: "rateLimit",  score: scores.rateLimit * 2 },
    { key: "auth",       score: scores.auth * 2 },
    { key: "security",   score: secTotal },
    { key: "database",   score: dbTotal },
    { key: "api",        score: apiTotal },
    { key: "test",       score: testTotal },
    { key: "refactor",   score: refTotal },
    { key: "validation", score: valTotal },
    { key: "queue",      score: queueTotal },
    { key: "cache",      score: cacheTotal },
  ].sort((a, b) => b.score - a.score);

  const top    = categories[0];
  const second = categories[1];
  const dominated = top.score >= 2 && top.score >= second.score + 2;

  const isRateLimit   = dominated && top.key === "rateLimit";
  const isAuth        = dominated && top.key === "auth";
  const isSecurity    = dominated && top.key === "security";
  const isDB          = dominated && top.key === "database";
  const isDBAndAPI    = isDB && apiTotal >= 2;
  const isTest        = dominated && top.key === "test";
  const isRefactor    = dominated && top.key === "refactor";
  const isAPI         = dominated && top.key === "api";
  const isValidation  = dominated && top.key === "validation";
  const isQueue       = dominated && top.key === "queue";
  const isCache       = dominated && top.key === "cache";

  // ── Detect dominant library name for titles ───────────────────────────────
  const validationLib =
    /\bajv\b/.test(c) ? "AJV" : /\bzod\b/.test(c) ? "Zod" :
    /\byup\b/.test(c) ? "Yup" : /\bjoi\b/.test(c) ? "Joi" :
    /\bvalibot\b/.test(c) ? "Valibot" : "schema validation";
  const queueLib =
    /\bbullmq\b/.test(c) ? "BullMQ" : /\bkafka\b/.test(c) ? "Kafka" :
    /\brabbitmq\b/.test(c) ? "RabbitMQ" : "queue";
  const cacheLib =
    /\bredis\b/.test(c) ? "Redis" : /\bmemcache\b/.test(c) ? "Memcache" : "cache";

  // ── Determine type ────────────────────────────────────────────────────────
  const prType: PRDoc["prType"] =
    isTest                             ? "Chore"    :
    isRefactor                         ? "Refactor" :
    (isRateLimit || isAuth || isSecurity) ? "Security" :
    "Feature";

  // ── Risk: only elevate if the dominant signals are strong ─────────────────
  const risk: PRDoc["risk"] =
    isRateLimit || isAuth || isSecurity ? "Medium" :
    isDB && dbTotal >= 3               ? "Medium"  :
    isQueue && queueTotal >= 3         ? "Medium"  :
    "Low";

  // ── Title ─────────────────────────────────────────────────────────────────
  const hasClass   = /class\s+\w+/.test(code);
  const className  = (code.match(/class\s+(\w+)/) || [])[1] ?? "";
  const funcNames  = [...code.matchAll(/(?:function|const)\s+(\w+)/g)].map(m => m[1]).slice(0, 2);
  const mainSymbol = className || funcNames[0] || "";

  const title =
    isRateLimit   ? "Add Redis-backed sliding window rate limiting to API gateway" :
    isAuth        ? "Add JWT authentication with short-lived access + refresh token rotation" :
    isSecurity    ? "Harden security layer with encryption and secret management" :
    isDBAndAPI    ? `Add ${mainSymbol ? mainSymbol + " " : ""}database-backed endpoint with parameterized queries` :
    isDB          ? `Optimize ${mainSymbol ? mainSymbol + " " : ""}data access layer` :
    isAPI         ? `Add ${mainSymbol ? mainSymbol + " " : ""}API route handlers` :
    isTest        ? `Add test coverage for ${mainSymbol || "service"} logic` :
    isRefactor    ? `Refactor ${mainSymbol || "module"} — remove dead code and simplify` :
    isValidation  ? `Add ${validationLib} schema validation layer` :
    isQueue       ? `Add ${queueLib} background job processing` :
    isCache       ? `Add ${cacheLib} caching layer` :
    mainSymbol    ? `Add ${mainSymbol} feature` :
    "Add feature with typed service layer";

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary =
    isRateLimit  ? "Introduces a Redis-backed sliding window rate limiter enforcing per-IP, per-endpoint request limits. Protects downstream services from overload and API abuse without adding latency to allowed requests." :
    isAuth       ? "Adds JWT-based auth with short-lived access tokens and rotating refresh tokens. Token rotation minimises the exposure window on compromise without requiring a full re-login." :
    isSecurity   ? "Adds encryption, secret management, and hardened input handling to the service boundary." :
    isDB         ? "Adds parameterised queries throughout to prevent injection attacks. Connection pooling configured for production concurrency." :
    isTest       ? "Expands test coverage with unit and integration tests for critical paths." :
    isRefactor   ? "Cleans up dead code, extracts reusable helpers, and improves module clarity without changing behaviour." :
    isAPI        ? "Adds API route handlers with typed request/response contracts and consistent error handling." :
    isValidation ? `Introduces ${validationLib}-based schema validation at the service boundary. Rejects malformed input early with structured error messages before it reaches business logic.` :
    isQueue      ? `Adds ${queueLib}-backed background job processing with retry logic and dead-letter handling. Moves slow operations off the request path.` :
    isCache      ? `Adds ${cacheLib} caching layer with TTL-based expiry. Reduces database load for read-heavy paths without sacrificing consistency.` :
    "Introduces new functionality with typed interfaces and consistent error handling.";

  // ── Changes ───────────────────────────────────────────────────────────────
  const changes: string[] = [];
  if (hasClass)                                      changes.push(`${className || "New class"} added with clean public interface`);
  // Generic async/export bullets only when no specific category won
  if (hasAsync && !isTest && !dominated)             changes.push("Async/await throughout — no raw promise chains");
  if (isRateLimit)                                   changes.push("RateLimiter wraps Redis INCR/EXPIRE for atomic sliding window");
  if (isRateLimit)                                   changes.push("Middleware factory — configurable per route, not global");
  if (isDB && dbTotal >= 2)                          changes.push("Parameterised queries throughout — no string interpolation");
  if (isAuth)                                        changes.push("Refresh token rotation on every use — old token immediately invalidated");
  if (isSecurity && !isAuth && !isRateLimit)         changes.push("Secrets handled via environment — no hardcoded values");
  if (scores.api >= 2 && (isAPI || isDBAndAPI))      changes.push("Route handlers return consistent JSON shape");
  if (/export/.test(code) && !dominated)             changes.push("All exports typed and consistent with existing module API");
  if (isRefactor)                                    changes.push("Behaviour unchanged — covered by existing test suite");
  if (isValidation)                                  changes.push(`${validationLib} schema defined centrally — reused across all entry points`);
  if (isValidation && valTotal >= 3)                 changes.push("Validation errors serialised to structured JSON with field-level detail");
  if (isQueue)                                       changes.push(`${queueLib} worker registered — configurable concurrency and retry backoff`);
  if (isQueue && queueTotal >= 3)                    changes.push("Failed jobs routed to dead-letter queue for manual inspection");
  if (isCache)                                       changes.push(`${cacheLib} keys namespaced to prevent collisions across services`);
  if (isCache && cacheTotal >= 3)                    changes.push("Cache invalidation hooked into write path — no stale reads");
  if (changes.length === 0)                          changes.push("New logic added with typed interfaces");

  // ── Testing plan ──────────────────────────────────────────────────────────
  const testing: string[] =
    isRateLimit ? [
      "Unit: RateLimiter.check() at exact limit boundary (n requests)",
      "Integration: burst scenario — 11 requests at limit 10, expect 429 on last",
      "Load test against staging — confirm p99 latency unchanged under burst",
    ] :
    isAuth ? [
      "Unit: token generation and verify round-trip",
      "Integration: refresh rotation — old token rejected after first use",
      "Security: expired token, tampered signature — both must 401",
    ] :
    isDB ? [
      "Unit: mock DB layer, verify parameterised query shape",
      "Integration: full request cycle against test database fixture",
    ] :
    isTest ? [
      "CI: all new specs must pass in isolation and in suite",
      "Coverage: target ≥ 80% for changed modules",
    ] :
    isRefactor ? [
      "Regression: existing tests must pass unchanged",
      "Manual smoke test on staging before merge",
    ] :
    isValidation ? [
      `Unit: valid payload passes, invalid payload returns structured error`,
      `Edge cases: missing required fields, wrong types, extra properties`,
      `Integration: validation runs at the actual entry point (route/controller)`,
    ] :
    isQueue ? [
      "Unit: job data shape validated before enqueue",
      "Integration: worker processes job end-to-end in test environment",
      "Failure path: verify retry count and dead-letter routing",
    ] :
    isCache ? [
      "Unit: cache hit returns value without DB call",
      "Integration: cache miss fetches from DB and primes cache",
      "TTL: verify key expires and triggers re-fetch",
    ] : [
      "Unit tests added for all new logic branches",
      "Manual verification in staging before merge",
    ];

  return { title, prType, risk, summary, changes, testing };
}

// ── Code review generator ──────────────────────────────────────────────────────
function generateReview(code: string): { issues: ReviewIssue[]; score: number } {
  const issues: ReviewIssue[] = [];
  const lines = code.split("\n");

  if (/for\s*\(.*of[\s\S]*?await/.test(code)) {
    issues.push({
      severity: "high", title: "N+1 Query Pattern",
      detail: "await inside a for...of loop fires one DB round-trip per iteration. At 1,000 orders, that's 1,000 sequential queries.",
      suggestion: "Collect all IDs first, then batch: SELECT * FROM items WHERE order_id = ANY($1) with an array.",
      line: lines.findIndex(l => /for\s*\(.*of/.test(l)) + 1 || undefined,
    });
  }

  if (/as\s+any/.test(code)) {
    issues.push({
      severity: "medium", title: "Unsafe Type Assertion (as any)",
      detail: "Casting to `any` erases all type information. Downstream code has no type safety on this value.",
      suggestion: "Define an explicit return type and validate the shape with a type guard or Zod schema at runtime.",
      line: lines.findIndex(l => /as\s+any/.test(l)) + 1 || undefined,
    });
  }

  if (/SELECT\s+\*/i.test(code)) {
    issues.push({
      severity: "medium", title: "SELECT * — Overfetching",
      detail: "Selecting all columns transfers unneeded data and breaks silently if column names change.",
      suggestion: "Enumerate only the columns your code uses: SELECT id, email, created_at FROM users.",
    });
  }

  const hasAsync    = /^async\s+function/.test(code.trim());
  const hasTryCatch = /try\s*\{/.test(code);
  if (hasAsync && !hasTryCatch) {
    issues.push({
      severity: "high", title: "Unhandled Async Rejection",
      detail: "The async function body has no try/catch. Any thrown error propagates as an unhandled promise rejection.",
      suggestion: "Wrap the function body in try/catch, or ensure every call site handles the rejection.",
      line: 1,
    });
  }

  if (issues.length === 0) {
    issues.push({
      severity: "info", title: "No issues detected",
      detail: "Code follows async/await patterns correctly, types are used, and no common anti-patterns found.",
      suggestion: "Consider adding JSDoc return type docs to public-facing functions.",
    });
  }

  const penalty = issues.reduce((s, i) =>
    s + (i.severity === "high" || i.severity === "critical" ? 25 : i.severity === "medium" ? 12 : i.severity === "low" ? 5 : 0), 0);

  return { issues, score: Math.max(0, 100 - penalty) };
}

// ── Runbook search ─────────────────────────────────────────────────────────────
const RUNBOOKS: Record<string, RunbookResult> = {
  rollback: {
    title: "Rolling Back a Failed Deployment",
    tags: ["kubernetes", "deployment", "incident"],
    steps: [
      { title: "Identify current state", commands: ["kubectl rollout history deployment/<name>", "kubectl get pods -n production"] },
      { title: "Roll back to previous revision", commands: ["kubectl rollout undo deployment/<name>", "# Or to a specific revision:", "kubectl rollout undo deployment/<name> --to-revision=3"] },
      { title: "Monitor rollback progress", commands: ["kubectl rollout status deployment/<name>", "watch -n2 kubectl get pods -n production"] },
      { title: "Verify health after rollback", commands: ["curl -f https://api.example.com/health", "kubectl logs -l app=<name> --tail=50"] },
    ],
    related: ["Standard Deployment Procedure", "Incident Response Playbook"],
  },
  "503": {
    title: "Resolving 503 Service Unavailable",
    tags: ["incident", "kubernetes", "networking"],
    steps: [
      { title: "Check pod health", commands: ["kubectl get pods -n production", "kubectl describe pod <pod-name> -n production"] },
      { title: "Inspect recent cluster events", commands: ["kubectl get events -n production --sort-by=.lastTimestamp | tail -20"] },
      { title: "Check HPA and resource pressure", commands: ["kubectl get hpa -n production", "kubectl top pods -n production"] },
      { title: "Review logs for crash loops", commands: ["kubectl logs <pod-name> --previous", "kubectl logs -l app=<name> --tail=100"] },
    ],
    related: ["Rolling Back a Deployment", "Memory Pressure Runbook"],
  },
  memory: {
    title: "Diagnosing Memory Pressure / OOMKill",
    tags: ["performance", "kubernetes", "OOM"],
    steps: [
      { title: "Identify high-memory pods", commands: ["kubectl top pods -n production --sort-by=memory"] },
      { title: "Check OOMKill events", commands: ["kubectl get events -n production | grep OOMKill", "kubectl describe pod <pod> | grep -A5 'Last State'"] },
      { title: "Capture heap snapshot (Node.js)", commands: ["kubectl exec -it <pod> -- node --inspect=0.0.0.0:9229", "# Connect Chrome DevTools to debug port for heap snapshot"] },
      { title: "Temporary mitigation", commands: ["# Increase memory limits:", "kubectl set resources deployment/<name> --limits=memory=1Gi"] },
    ],
    related: ["503 Service Unavailable", "Performance Profiling Guide"],
  },
  deploy: {
    title: "Standard Deployment Procedure",
    tags: ["deployment", "release", "ci-cd"],
    steps: [
      { title: "Pre-deployment checklist", commands: ["# Confirm all CI tests green", "# Verify staging is healthy", "# Post to #engineering-deploys"] },
      { title: "Tag the release", commands: ["git tag v1.x.x && git push origin v1.x.x", "# CI builds and pushes image automatically"] },
      { title: "Deploy to production", commands: ["kubectl set image deployment/<name> app=registry/app:v1.x.x", "kubectl rollout status deployment/<name>"] },
      { title: "Post-deploy verification", commands: ["curl -f https://api.example.com/health", "# Monitor error rate for 15 min in Datadog"] },
    ],
    related: ["Rolling Back a Deployment", "Feature Flag Procedure"],
  },
  database: {
    title: "Investigating Slow Database Queries",
    tags: ["postgres", "performance", "database"],
    steps: [
      { title: "Find slow queries", commands: ["SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;"] },
      { title: "Analyze a specific query", commands: ["EXPLAIN (ANALYZE, BUFFERS) SELECT ...;", "# Look for: Seq Scan on large tables, Hash Join cost > 10000"] },
      { title: "Check for missing indexes", commands: ["SELECT relname, seq_scan, idx_scan FROM pg_stat_user_tables WHERE seq_scan > 1000 ORDER BY seq_scan DESC;"] },
      { title: "Add index safely (production)", commands: ["-- Non-blocking:", "CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders (user_id);"] },
    ],
    related: ["Query Optimization Guide", "Database Maintenance Procedures"],
  },
};

function searchRunbook(q: string): RunbookResult | null {
  const s = q.toLowerCase();
  if (/rollback|undo|revert|previous version/.test(s)) return RUNBOOKS.rollback;
  if (/503|502|service unavailable|unhealthy/.test(s))  return RUNBOOKS["503"];
  if (/memory|oom|heap|out of memory/.test(s))          return RUNBOOKS.memory;
  if (/slow query|database|postgres|sql perf/.test(s))  return RUNBOOKS.database;
  if (/deploy|release|ship|push to prod/.test(s))       return RUNBOOKS.deploy;
  return null;
}

// ── Mode config ────────────────────────────────────────────────────────────────
const MODE_CONFIG: Record<Mode, { label: string; hint: string }> = {
  "pr-doc":      { label: "PR Documenter",   hint: "Paste code → get PR title, summary & testing plan" },
  "code-review": { label: "Code Review",     hint: "Paste code → severity-ranked review comments" },
  "runbook":     { label: "Runbook Search",  hint: "Ask a question → get step-by-step procedure" },
};

const SEV_BORDER: Record<ReviewIssue["severity"], string> = {
  critical: "border-red-500/35 bg-red-500/[0.06]",
  high:     "border-red-500/25 bg-red-500/[0.04]",
  medium:   "border-amber-500/30 bg-amber-500/[0.05]",
  low:      "border-white/[0.08] bg-white/[0.02]",
  info:     "border-emerald-500/25 bg-emerald-500/[0.04]",
};
const SEV_BADGE: Record<ReviewIssue["severity"], string> = {
  critical: "text-red-300 bg-red-500/15 border-red-500/25",
  high:     "text-red-300 bg-red-500/15 border-red-500/25",
  medium:   "text-amber-300 bg-amber-500/15 border-amber-500/25",
  low:      "text-white/40 bg-white/[0.06] border-white/[0.1]",
  info:     "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function DevMindPage() {
  const [mode, setMode] = useState<Mode>("pr-doc");
  const [input, setInput] = useState(DEFAULT_INPUTS["pr-doc"]);
  const [output, setOutput] = useState<OutputData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revealedItems, setRevealedItems] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const totalItems = useRef(0);

  const lineCount = input.split("\n").length;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length]);

  // Progressive reveal when output arrives
  useEffect(() => {
    if (!output || generating) return;
    setRevealedItems(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setRevealedItems(i);
      if (i >= totalItems.current) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [output, generating]);

  function handleModeChange(m: Mode) {
    setMode(m); setInput(DEFAULT_INPUTS[m]);
    setOutput(null); setRevealedItems(0);
  }

  function handleGenerate() {
    setGenerating(true); setOutput(null); setRevealedItems(0);
    const snap = { mode, input };

    setLog(prev => [...prev, {
      id: lid(), ts: tsNow(),
      msg: `${MODE_CONFIG[snap.mode].label}: processing ${snap.input.split("\n").length} lines`,
      type: "info" as const,
    }].slice(-50));

    setTimeout(() => {
      let result: OutputData;

      if (snap.mode === "pr-doc") {
        const data = generatePRDoc(snap.input);
        result = { mode: "pr-doc", data };
        totalItems.current = data.changes.length + data.testing.length;
        setLog(prev => [...prev, { id: lid(), ts: tsNow(), msg: `PR doc: "${data.title}"`, type: "ok" as const }].slice(-50));

      } else if (snap.mode === "code-review") {
        const { issues, score } = generateReview(snap.input);
        result = { mode: "code-review", issues, score };
        totalItems.current = issues.length;
        setLog(prev => [...prev, {
          id: lid(), ts: tsNow(),
          msg: `Code review: ${issues.length} issue${issues.length !== 1 ? "s" : ""} — score ${score}/100`,
          type: score >= 70 ? "ok" as const : "warn" as const,
        }].slice(-50));

      } else {
        const found = searchRunbook(snap.input);
        result = { mode: "runbook", result: found };
        totalItems.current = found ? found.steps.length : 1;
        setLog(prev => [...prev, {
          id: lid(), ts: tsNow(),
          msg: found ? `Runbook: "${found.title}"` : "No matching runbook found",
          type: found ? "ok" as const : "warn" as const,
        }].slice(-50));
      }

      setOutput(result);
      setGenerating(false);
    }, 750 + Math.random() * 450);
  }

  return (
    <main className="h-screen overflow-hidden bg-[#080810] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#080810]/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects/devmind" className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors group">
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-white/[0.07]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
                <Brain size={11} className="text-fuchsia-400" />
              </div>
              <span className="font-sora font-bold text-sm">DevMind</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/20 font-semibold tracking-wide">LIVE DEMO</span>
            </div>
          </div>
          <button onClick={() => { setOutput(null); setLog([]); setRevealedItems(0); setGenerating(false); }}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/35 hover:text-white/65 transition-all">
            <RotateCcw size={10} />Reset
          </button>
        </div>
      </header>

      {/* ── Three panels ── */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-[360px_1fr_260px]">

        {/* ── Panel 1: Input ── */}
        <div className="flex flex-col border-r border-white/[0.06] bg-[#06060e] overflow-hidden">
          {/* Mode tabs */}
          <div className="flex-shrink-0 flex border-b border-white/[0.05]">
            {(["pr-doc", "code-review", "runbook"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold border-b-2 transition-all ${
                  mode === m
                    ? "border-fuchsia-500 text-fuchsia-300"
                    : "border-transparent text-white/25 hover:text-white/50"
                }`}
              >
                {m === "pr-doc" && <GitPullRequest size={10} />}
                {m === "code-review" && <Search size={10} />}
                {m === "runbook" && <BookOpen size={10} />}
                <span className="hidden sm:inline text-[10px]">{MODE_CONFIG[m].label}</span>
              </button>
            ))}
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <FileCode2 size={11} className="text-fuchsia-400/50" />
              <span className="text-[11px] font-mono text-white/35">
                {mode === "pr-doc" ? "diff.ts" : mode === "code-review" ? "review.ts" : "query.txt"}
              </span>
            </div>
            <span className="text-[10px] font-mono text-white/20">{lineCount}L</span>
          </div>

          <div className="flex-1 overflow-hidden relative min-h-0">
            <div aria-hidden className="absolute left-0 top-0 bottom-0 w-9 flex flex-col items-end pt-4 pb-4 pr-2 bg-[#04040b] border-r border-white/[0.04] z-10 pointer-events-none select-none overflow-hidden">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-[10px] font-mono text-white/[0.1] leading-5 flex-shrink-0">{i + 1}</div>
              ))}
            </div>
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); setOutput(null); }}
              spellCheck={false}
              placeholder={mode === "runbook" ? "Type your question…" : "Paste your code…"}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-[12px] text-white/70 leading-5 pl-12 pr-4 pt-4 pb-4 outline-none overflow-y-auto placeholder-white/15"
              style={{ fontFamily: '"Fira Code", "JetBrains Mono", ui-monospace, monospace' }}
            />
          </div>

          <div className="flex-shrink-0 p-3 border-t border-white/[0.05]">
            <button
              onClick={handleGenerate}
              disabled={!input.trim() || generating}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                input.trim() && !generating
                  ? "bg-fuchsia-700 hover:bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/15 active:scale-[0.98]"
                  : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              }`}
            >
              {generating
                ? <><Loader2 size={12} className="animate-spin" />Generating…</>
                : <><Zap size={12} />{MODE_CONFIG[mode].label}</>
              }
            </button>
            <p className="text-[10px] text-white/15 text-center mt-2">{MODE_CONFIG[mode].hint}</p>
          </div>
        </div>

        {/* ── Panel 2: Output ── */}
        <div className="overflow-y-auto p-5 lg:p-6 bg-[#070710]">
          {generating && (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
              <div className="w-12 h-12 rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-500 animate-spin" />
              <p className="text-sm text-white/30 font-mono">Analyzing with Claude…</p>
            </div>
          )}

          {!generating && !output && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-20">
              <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
                <Brain size={20} className="text-fuchsia-400/60" />
              </div>
              <div>
                <p className="font-semibold text-white/40 mb-2">No output yet</p>
                <p className="text-sm text-white/20 max-w-xs leading-relaxed">
                  Pick a mode, edit the input if you want, and click generate.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-white/20 max-w-xs">
                {[
                  "PR Documenter — paste code, get a complete PR description",
                  "Code Review — detects N+1s, unsafe types, missing error handling",
                  "Runbook Search — ask a question, get step-by-step commands",
                ].map(s => (
                  <div key={s} className="flex items-start gap-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04] text-left">
                    <ChevronRight size={9} className="text-fuchsia-400/40 flex-shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PR Doc output */}
          {!generating && output?.mode === "pr-doc" && (() => {
            const d = output.data;
            return (
              <div className="max-w-lg mx-auto space-y-4">
                <div className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.05] p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <GitPullRequest size={16} className="text-fuchsia-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white/85 leading-snug">{d.title}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[9px] px-2 py-0.5 rounded-full border font-semibold bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25">{d.prType}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold ${
                          d.risk === "Low"    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" :
                          d.risk === "Medium" ? "bg-amber-500/15 text-amber-300 border-amber-500/25" :
                          "bg-red-500/15 text-red-300 border-red-500/25"
                        }`}>Risk: {d.risk}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed">{d.summary}</p>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Changes</p>
                  <div className="space-y-2">
                    {d.changes.map((c, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: revealedItems > i ? 1 : 0, x: revealedItems > i ? 0 : -8 }} transition={{ duration: 0.2 }} className="flex items-start gap-2">
                        <CheckCircle2 size={11} className="text-fuchsia-400/60 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-white/55">{c}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Testing Plan</p>
                  <div className="space-y-2">
                    {d.testing.map((t, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: revealedItems > d.changes.length + i ? 1 : 0, x: revealedItems > d.changes.length + i ? 0 : -8 }} transition={{ duration: 0.2 }} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-white/25 flex-shrink-0 mt-1.5" />
                        <p className="text-xs text-white/55">{t}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Code Review output */}
          {!generating && output?.mode === "code-review" && (() => {
            const { issues, score } = output;
            const scoreColor = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
            const scoreBorder = score >= 80 ? "border-emerald-500/30 bg-emerald-500/[0.06]" : score >= 60 ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-red-500/30 bg-red-500/[0.06]";
            return (
              <div className="max-w-lg mx-auto space-y-4">
                <div className={`rounded-xl border px-4 py-3 inline-flex items-center gap-3 ${scoreBorder}`}>
                  <span className={`text-2xl font-bold font-mono ${scoreColor}`}>{score}</span>
                  <div>
                    <p className="text-[10px] text-white/35">Review Score / 100</p>
                    <p className="text-[10px] text-white/20">{issues.length} issue{issues.length !== 1 ? "s" : ""} found</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {issues.map((issue, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: revealedItems > i ? 1 : 0, y: revealedItems > i ? 0 : 8 }} transition={{ duration: 0.22 }}
                      className={`rounded-xl border p-4 ${SEV_BORDER[issue.severity]}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {issue.severity === "info" ? <CheckCircle2 size={12} className="text-emerald-400" /> :
                           issue.severity === "low"  ? <Info size={12} className="text-white/40" /> :
                           <AlertTriangle size={12} className={issue.severity === "medium" ? "text-amber-400" : "text-red-400"} />}
                          <p className="text-sm font-semibold text-white/80">{issue.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {issue.line && <span className="text-[9px] font-mono text-white/25">L{issue.line}</span>}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase ${SEV_BADGE[issue.severity]}`}>{issue.severity}</span>
                        </div>
                      </div>
                      <p className="text-xs text-white/45 leading-relaxed mb-2">{issue.detail}</p>
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.05]">
                        <p className="text-[10px] text-white/30 font-semibold mb-0.5">Suggestion:</p>
                        <p className="text-[11px] text-white/55 leading-snug">{issue.suggestion}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Runbook output */}
          {!generating && output?.mode === "runbook" && (() => {
            const { result } = output;
            if (!result) return (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-20 text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center">
                  <BookOpen size={18} className="text-white/20" />
                </div>
                <p className="text-white/35 font-semibold">No runbook found</p>
                <p className="text-sm text-white/20 max-w-xs">Try: "roll back deployment", "503 error", "slow database query", "memory / OOM"</p>
              </div>
            );
            return (
              <div className="max-w-lg mx-auto space-y-4">
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.05] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen size={14} className="text-blue-400 flex-shrink-0" />
                    <p className="text-sm font-bold text-white/85">{result.title}</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {result.tags.map(t => (
                      <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300/70 font-mono">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {result.steps.map((step, si) => (
                    <motion.div key={si} initial={{ opacity: 0, y: 8 }} animate={{ opacity: revealedItems > si ? 1 : 0, y: revealedItems > si ? 0 : 8 }} transition={{ duration: 0.22 }}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                      <p className="text-xs font-semibold text-white/55 mb-3">
                        <span className="text-blue-400/60 font-mono mr-2">{si + 1}.</span>{step.title}
                      </p>
                      <div className="bg-[#04040b] rounded-lg p-3 border border-white/[0.05] space-y-1.5">
                        {step.commands.map((cmd, ci) => (
                          <p key={ci} className={`text-[11px] font-mono leading-relaxed ${cmd.startsWith("#") ? "text-white/25 italic" : "text-emerald-300/70"}`}>{cmd}</p>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
                {result.related.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-2">Related</p>
                    {result.related.map(r => (
                      <div key={r} className="flex items-center gap-2 text-xs text-white/35 py-1">
                        <ChevronRight size={9} className="text-blue-400/40" />
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── Panel 3: Session log ── */}
        <div className="flex flex-col bg-[#050510] border-l border-white/[0.05] overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/55">Session Log</p>
              <p className="text-[10px] text-white/20 mt-0.5">Generation history</p>
            </div>
            <Brain size={11} className="text-fuchsia-400/40" />
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3">
            {log.length === 0 ? (
              <p className="text-[11px] text-white/15 text-center mt-10 leading-relaxed">
                Events appear here<br />after generating
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {log.map((e, i) => (
                  <motion.div key={e.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className="flex gap-2.5">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0 ${e.type === "ok" ? "bg-emerald-400" : e.type === "warn" ? "bg-amber-400" : "bg-white/25"}`} />
                      {i < log.length - 1 && <div className="w-px flex-1 bg-white/[0.04] my-1" />}
                    </div>
                    <div className="pb-3 min-w-0 flex-1">
                      <p className="text-[11px] text-white/60 leading-snug break-words">{e.msg}</p>
                      <p className="text-[10px] text-white/[0.18] mt-0.5 font-mono">{e.ts}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
