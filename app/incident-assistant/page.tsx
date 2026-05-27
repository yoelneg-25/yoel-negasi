"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RotateCcw, Terminal, AlertTriangle, CheckCircle2,
  ChevronRight, Loader2, MessageSquare, Send, AlertCircle, Info,
  Zap, GitBranch, Clock, Cpu,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Severity = "critical" | "high" | "medium" | "low";
type FailureType = "build" | "test" | "deployment" | "oom" | "timeout" | "dependency";

interface AnalysisResult {
  failureType: FailureType;
  severity: Severity;
  rootCause: string;
  affectedServices: string[];
  errorSignals: string[];
  fixSuggestions: FixSuggestion[];
  summary: string;
}

interface FixSuggestion {
  title: string;
  command?: string;
  detail: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Sample logs ────────────────────────────────────────────────────────────────
const SAMPLE_LOGS: { label: string; type: FailureType; log: string }[] = [
  {
    label: "Docker Build Failure",
    type: "build",
    log: `[2026-05-27T14:32:01Z] INFO  Starting GitHub Actions workflow: build-and-deploy
[2026-05-27T14:32:02Z] INFO  Runner: ubuntu-22.04 | Node: 20.x
[2026-05-27T14:32:05Z] INFO  Checking out repository @ sha: a3f9c12
[2026-05-27T14:32:08Z] INFO  Setting up Docker buildx
[2026-05-27T14:32:10Z] INFO  Restoring layer cache...
[2026-05-27T14:32:11Z] INFO  Running: docker build -t api-service:a3f9c12 .
[2026-05-27T14:32:18Z] INFO  Step 1/9: FROM node:20-alpine
[2026-05-27T14:32:19Z] INFO  Step 2/9: WORKDIR /app
[2026-05-27T14:32:20Z] INFO  Step 3/9: COPY package*.json ./
[2026-05-27T14:32:21Z] INFO  Step 4/9: RUN npm ci
[2026-05-27T14:33:04Z] ERROR npm ERR! code ERESOLVE
[2026-05-27T14:33:04Z] ERROR npm ERR! ERESOLVE unable to resolve dependency tree
[2026-05-27T14:33:04Z] ERROR npm ERR! Found: @nestjs/core@9.4.3
[2026-05-27T14:33:04Z] ERROR npm ERR! node_modules/@nestjs/core
[2026-05-27T14:33:04Z] ERROR npm ERR!   @nestjs/core@"^9.0.0" from the root project
[2026-05-27T14:33:04Z] ERROR npm ERR! Could not resolve dependency:
[2026-05-27T14:33:04Z] ERROR npm ERR!   peer @nestjs/core@"^10.0.0" from @nestjs/platform-express@10.2.1
[2026-05-27T14:33:05Z] ERROR npm ERR! Fix the upstream dependency conflict, or retry
[2026-05-27T14:33:05Z] ERROR npm ERR! with --force or --legacy-peer-deps
[2026-05-27T14:33:06Z] ERROR Docker build failed with exit code 1
[2026-05-27T14:33:06Z] ERROR Workflow failed: build-and-deploy`,
  },
  {
    label: "Test Suite Failure",
    type: "test",
    log: `[2026-05-27T09:15:00Z] INFO  Starting CI pipeline: test
[2026-05-27T09:15:01Z] INFO  Node 20.x | Jest 29.x
[2026-05-27T09:15:03Z] INFO  Running: npm test -- --ci --coverage
[2026-05-27T09:15:12Z] INFO  Test Suites: running...
[2026-05-27T09:15:45Z] FAIL  src/services/payment.service.spec.ts
[2026-05-27T09:15:45Z] ERROR   ● PaymentService › processRefund › should rollback on gateway timeout
[2026-05-27T09:15:45Z] ERROR     Timeout - Async callback was not invoked within the 5000ms timeout
[2026-05-27T09:15:45Z] ERROR     at Object.setTimeout (node_modules/jest-jasmine2/build/jasmine/Env.js:529:24)
[2026-05-27T09:15:46Z] FAIL  src/services/notification.service.spec.ts
[2026-05-27T09:15:46Z] ERROR   ● NotificationService › sendAlertBatch › should retry on 429
[2026-05-27T09:15:46Z] ERROR     expect(received).toHaveBeenCalledTimes(3)
[2026-05-27T09:15:46Z] ERROR     Expected: 3
[2026-05-27T09:15:46Z] ERROR     Received: 1
[2026-05-27T09:15:47Z] INFO  Test Suites: 2 failed, 14 passed, 16 total
[2026-05-27T09:15:47Z] INFO  Tests:       3 failed, 147 passed, 150 total
[2026-05-27T09:15:47Z] INFO  Coverage:    72.4% (threshold: 80%)
[2026-05-27T09:15:47Z] ERROR Pipeline failed: coverage below threshold`,
  },
  {
    label: "Deployment OOM Kill",
    type: "oom",
    log: `[2026-05-27T22:01:00Z] INFO  Deploying worker-service:v2.4.1 to production
[2026-05-27T22:01:03Z] INFO  Rolling deployment started — 3 replicas
[2026-05-27T22:01:10Z] INFO  Replica 1 starting... healthy
[2026-05-27T22:01:18Z] INFO  Replica 2 starting... healthy
[2026-05-27T22:01:25Z] INFO  Replica 3 starting...
[2026-05-27T22:01:52Z] WARN  Replica 3: memory usage at 89% (716Mi / 800Mi limit)
[2026-05-27T22:02:01Z] WARN  Replica 3: memory usage at 96% (768Mi / 800Mi limit)
[2026-05-27T22:02:09Z] ERROR OOMKilled: container worker-service exceeded memory limit (800Mi)
[2026-05-27T22:02:09Z] ERROR Pod worker-service-7d9f6c-xkp2q killed by OOM killer
[2026-05-27T22:02:11Z] ERROR Kubernetes event: FailedCreate — 0/3 nodes available
[2026-05-27T22:02:11Z] ERROR Rolling deployment stalled — 2/3 replicas healthy
[2026-05-27T22:02:14Z] ERROR Deployment rollback triggered automatically
[2026-05-27T22:02:28Z] INFO  Rolled back to worker-service:v2.4.0`,
  },
  {
    label: "GitHub Actions Timeout",
    type: "timeout",
    log: `[2026-05-27T16:45:00Z] INFO  Workflow: integration-tests
[2026-05-27T16:45:01Z] INFO  Trigger: push to main
[2026-05-27T16:45:05Z] INFO  Spinning up services: postgres, redis, kafka
[2026-05-27T16:45:22Z] INFO  postgres: ready
[2026-05-27T16:45:28Z] INFO  redis: ready
[2026-05-27T16:47:45Z] WARN  kafka: waiting for broker to become available...
[2026-05-27T16:49:45Z] WARN  kafka: still waiting (120s elapsed)
[2026-05-27T16:51:45Z] WARN  kafka: still waiting (240s elapsed)
[2026-05-27T16:53:45Z] WARN  kafka: still waiting (360s elapsed)
[2026-05-27T17:05:00Z] ERROR Job timeout: integration-tests exceeded 20-minute limit
[2026-05-27T17:05:00Z] ERROR Cancelling all running steps
[2026-05-27T17:05:01Z] ERROR Error: The operation was canceled.
[2026-05-27T17:05:01Z] ERROR Workflow failed: integration-tests`,
  },
];

// ── Analysis engine ────────────────────────────────────────────────────────────
function analyzeLog(log: string): AnalysisResult {
  const lower = log.toLowerCase();

  if (/oomkilled|exceeded memory limit|oom killer/.test(lower)) {
    return {
      failureType: "oom",
      severity: "critical",
      rootCause: "Container exceeded configured memory limit and was killed by the OOM killer. The process was consuming more memory than the Kubernetes resource limit allows.",
      affectedServices: ["worker-service", "Kubernetes cluster (pod scheduling)"],
      errorSignals: [
        "OOMKilled: container exceeded memory limit (800Mi)",
        "Memory usage reached 96% before kill",
        "Pod killed by OOM killer during rolling deployment",
      ],
      fixSuggestions: [
        {
          title: "Increase memory limit in deployment manifest",
          command: "kubectl patch deployment worker-service -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"worker-service\",\"resources\":{\"limits\":{\"memory\":\"1.5Gi\"}}}]}}}}'",
          detail: "Raise the memory ceiling to give the process headroom. Monitor actual usage before setting a new limit.",
        },
        {
          title: "Profile memory usage in staging",
          command: "kubectl top pods -l app=worker-service -n production",
          detail: "Identify whether this is a memory leak or expected growth from increased workload. Check metrics over the last 7 days.",
        },
        {
          title: "Add memory usage alerting",
          detail: "Set a Prometheus alert at 75% memory utilization to catch this before OOM kills occur in production.",
        },
      ],
      summary: "Container OOM kill during rolling deployment. 3rd replica was killed after exceeding 800Mi memory limit at 96% utilization. Deployment auto-rolled back to v2.4.0.",
    };
  }

  if (/eresolve|unable to resolve dependency|peer.*from/.test(lower)) {
    return {
      failureType: "build",
      severity: "high",
      rootCause: "npm dependency conflict between @nestjs/core v9 (installed) and @nestjs/platform-express v10 (requires @nestjs/core v10). The peer dependency version ranges are incompatible.",
      affectedServices: ["api-service", "Docker build pipeline"],
      errorSignals: [
        "ERESOLVE unable to resolve dependency tree",
        "@nestjs/core@9.4.3 installed, @nestjs/platform-express@10.2.1 requires ^10.0.0",
        "Docker build exit code 1",
      ],
      fixSuggestions: [
        {
          title: "Upgrade @nestjs/core to v10",
          command: "npm install @nestjs/core@^10.0.0 @nestjs/common@^10.0.0 @nestjs/platform-express@^10.0.0",
          detail: "Align all NestJS packages to v10. Review the NestJS v10 migration guide for breaking changes before deploying.",
        },
        {
          title: "Pin compatible versions temporarily",
          command: "npm install @nestjs/platform-express@9.x --save-exact",
          detail: "Downgrade platform-express to match the installed core version. Use as a stopgap while planning the full v10 upgrade.",
        },
        {
          title: "Add dependency validation to CI",
          detail: "Add npm ls --depth=0 to your CI pipeline to catch peer dependency conflicts before the Docker build step.",
        },
      ],
      summary: "Docker build failed during npm ci. NestJS peer dependency conflict: @nestjs/core v9 is installed but @nestjs/platform-express v10 requires ^10.0.0. Build cannot proceed until versions are aligned.",
    };
  }

  if (/timeout.*kafka|kafka.*waiting|job timeout/.test(lower)) {
    return {
      failureType: "timeout",
      severity: "high",
      rootCause: "Kafka broker failed to become available within the CI job's 20-minute timeout. The integration test suite depends on Kafka and could not start without a healthy broker.",
      affectedServices: ["kafka broker", "integration-tests workflow", "consumer services"],
      errorSignals: [
        "Kafka waiting for broker: 360+ seconds elapsed",
        "Job timeout: integration-tests exceeded 20-minute limit",
        "All running steps cancelled",
      ],
      fixSuggestions: [
        {
          title: "Add a Kafka health check with retry logic",
          command: "timeout 300 bash -c 'until kafka-broker-api-versions.sh --bootstrap-server localhost:9092; do sleep 5; done'",
          detail: "Add an explicit readiness probe before test execution begins. This provides a clear failure message instead of a silent timeout.",
        },
        {
          title: "Switch to a lightweight Kafka alternative for CI",
          detail: "Consider replacing the full Kafka stack in CI with redpanda or kafka-in-process for faster broker startup and reduced flakiness.",
        },
        {
          title: "Investigate broker image startup time",
          command: "docker logs kafka-broker 2>&1 | tail -50",
          detail: "Check broker container logs to identify why startup is taking 3+ minutes. Look for JVM heap sizing or volume mount issues.",
        },
      ],
      summary: "Integration test workflow timed out after 20 minutes. Kafka broker never became available — the service dependency health check had no timeout or retry logic, causing the entire job to hang.",
    };
  }

  if (/timeout.*callback|coverage.*threshold|tests:.*failed/.test(lower)) {
    return {
      failureType: "test",
      severity: "medium",
      rootCause: "Two test suites failed: async callback timeout in payment service rollback test, and incorrect retry count assertion in notification service. Coverage also fell below the 80% threshold at 72.4%.",
      affectedServices: ["PaymentService", "NotificationService", "coverage gate"],
      errorSignals: [
        "Async callback not invoked within 5000ms timeout — PaymentService.processRefund",
        "Expected retry count 3, received 1 — NotificationService.sendAlertBatch",
        "Coverage 72.4% below threshold 80%",
      ],
      fixSuggestions: [
        {
          title: "Increase Jest timeout for async payment tests",
          command: "jest.setTimeout(15000); // in payment.service.spec.ts",
          detail: "The gateway timeout simulation may take longer than 5s. Increase the test timeout or mock the timer with jest.useFakeTimers().",
        },
        {
          title: "Debug retry logic in NotificationService",
          detail: "The service is only retrying once instead of 3 times on a 429. Check that the retry interceptor is wired to the test's mock HTTP client, not a live client.",
        },
        {
          title: "Add coverage for uncovered service paths",
          command: "npx jest --coverage --coverageReporters=text | grep 'Uncovered'",
          detail: "Run with coverage report to identify which lines are dragging the score below 80%. Focus on error handling paths in recently changed modules.",
        },
      ],
      summary: "3 tests failed across 2 suites. PaymentService rollback test has a 5s async timeout that's being exceeded. NotificationService retry test has a mock wiring issue. Coverage at 72.4% is below the 80% gate.",
    };
  }

  // Generic fallback
  return {
    failureType: "build",
    severity: "medium",
    rootCause: "Pipeline failure detected. Review the error signals extracted below for the proximate cause.",
    affectedServices: ["Pipeline"],
    errorSignals: log.split("\n").filter(l => /error|fail|warn/i.test(l)).slice(0, 3).map(l => l.trim()),
    fixSuggestions: [
      { title: "Review full log output", detail: "Examine the complete log for additional context around the failure point." },
    ],
    summary: "Pipeline failure detected. Paste a specific CI/CD log to get a detailed root cause analysis.",
  };
}

// ── Chat responses ─────────────────────────────────────────────────────────────
function getChatResponse(question: string, analysis: AnalysisResult): string {
  const q = question.toLowerCase();

  if (/rollback|revert|undo/.test(q)) {
    if (analysis.failureType === "oom") return "The rollback already fired automatically — Kubernetes rolled back to v2.4.0 after the OOM kill. To verify: `kubectl rollout history deployment/worker-service`. If you need to roll back manually in future, use `kubectl rollout undo deployment/worker-service`.";
    if (analysis.failureType === "build") return "No deployment occurred since the build failed before the push stage. The currently running version is unaffected. Fix the dependency conflict and re-trigger the workflow.";
    return "Check your deployment history with `kubectl rollout history` or review your CI/CD platform for the last successful run. Rollback steps depend on your deployment target.";
  }

  if (/affect|impact|service|downstream/.test(q)) {
    return `Based on the log analysis, the directly affected services are: ${analysis.affectedServices.join(", ")}. ${analysis.failureType === "oom" ? "The OOM kill prevented the new version from becoming live, so downstream consumers continued receiving traffic from the previous healthy replicas." : analysis.failureType === "build" ? "The build failure prevented any artifact from being pushed, so no downstream services were affected by a bad deployment." : "Review dependent services for any cascading failures."}`;
  }

  if (/prevent|avoid|future|again/.test(q)) {
    const top = analysis.fixSuggestions[analysis.fixSuggestions.length - 1];
    return `The most preventative fix is: ${top.title}. ${top.detail} Additionally, consider adding alerting at earlier thresholds so the issue is visible before it causes a pipeline failure.`;
  }

  if (/how long|duration|time/.test(q)) {
    if (analysis.failureType === "oom") return "The deployment started at 22:01:00 and the OOM kill occurred at 22:02:09 — about 69 seconds into the rollout. Rollback completed at 22:02:28, so total incident duration was roughly 88 seconds.";
    if (analysis.failureType === "timeout") return "The Kafka broker startup was waited on for 360+ seconds (6+ minutes) before the overall 20-minute job timeout fired. Total workflow duration was approximately 20 minutes.";
    return "Check the timestamps in the log for exact duration. Look for the first ERROR line and compare it against the workflow start timestamp.";
  }

  if (/severity|critical|priority/.test(q)) {
    const sevMap = { critical: "This is a critical severity incident — production was impacted and an automated rollback was required.", high: "This is a high severity issue — the pipeline is blocked and a code change is required to unblock it.", medium: "This is medium severity — tests are failing but no production impact has occurred yet.", low: "This is low severity — the issue is informational and does not block deployment." };
    return sevMap[analysis.severity];
  }

  return `Based on the log analysis: ${analysis.summary} The root cause is ${analysis.rootCause.toLowerCase()} For more specific answers, try asking about rollback steps, affected services, or how to prevent this.`;
}

// ── Severity config ────────────────────────────────────────────────────────────
const SEV_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  high:     { label: "High",     color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  medium:   { label: "Medium",   color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  low:      { label: "Low",      color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
};

const FAILURE_LABELS: Record<FailureType, string> = {
  build: "Build Failure", test: "Test Failure", deployment: "Deployment Failure",
  oom: "OOM Kill", timeout: "Timeout", dependency: "Dependency Conflict",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
let _mid = 0;
function mid() { return `m${++_mid}`; }

// ── Component ──────────────────────────────────────────────────────────────────
export default function IncidentAssistantPage() {
  const [logInput, setLogInput] = useState(SAMPLE_LOGS[0].log);
  const [activeLog, setActiveLog] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [revealedFixes, setRevealedFixes] = useState(0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (!analysis || analyzing) return;
    setRevealedFixes(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setRevealedFixes(i);
      if (i >= analysis.fixSuggestions.length) clearInterval(id);
    }, 180);
    return () => clearInterval(id);
  }, [analysis, analyzing]);

  function handleSelectSample(idx: number) {
    setActiveLog(idx);
    setLogInput(SAMPLE_LOGS[idx].log);
    setAnalysis(null);
    setChatMessages([]);
  }

  function handleAnalyze() {
    if (!logInput.trim()) return;
    setAnalyzing(true);
    setAnalysis(null);
    setChatMessages([]);

    setTimeout(() => {
      const result = analyzeLog(logInput);
      setAnalysis(result);
      setAnalyzing(false);
    }, 900 + Math.random() * 400);
  }

  function handleReset() {
    setAnalysis(null);
    setChatMessages([]);
    setLogInput(SAMPLE_LOGS[0].log);
    setActiveLog(0);
    setRevealedFixes(0);
  }

  function handleSendChat(e?: React.FormEvent) {
    e?.preventDefault();
    if (!chatInput.trim() || !analysis) return;
    const userMsg: ChatMessage = { id: mid(), role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    setTimeout(() => {
      const response = getChatResponse(chatInput, analysis);
      const assistantMsg: ChatMessage = { id: mid(), role: "assistant", content: response };
      setChatMessages(prev => [...prev, assistantMsg]);
      setChatLoading(false);
    }, 600 + Math.random() * 400);
  }

  const sev = analysis ? SEV_CONFIG[analysis.severity] : null;

  return (
    <main className="h-screen overflow-hidden bg-[#080810] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#080810]/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects/incident-assistant" className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors group">
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-white/[0.07]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Terminal size={11} className="text-amber-400" />
              </div>
              <span className="font-semibold text-sm">AI Incident Assistant</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 font-semibold tracking-wide">LIVE DEMO</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[10px] text-white/25 font-mono">Simulated · OpenAI / Claude API</span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/35 hover:text-white/65 transition-all"
            >
              <RotateCcw size={10} />Reset
            </button>
          </div>
        </div>
      </header>

      {/* ── Two panels ── */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-[1fr_1fr]">

        {/* ── Panel 1: Log Input ── */}
        <div className="flex flex-col border-r border-white/[0.06] bg-[#06060e] overflow-hidden">

          {/* Sample log selector */}
          <div className="flex-shrink-0 border-b border-white/[0.05] p-3 space-y-2">
            <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest px-1">Sample Logs</p>
            <div className="grid grid-cols-2 gap-1.5">
              {SAMPLE_LOGS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectSample(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                    activeLog === i
                      ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                      : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/65 hover:bg-white/[0.06]"
                  }`}
                >
                  {i === 0 && <GitBranch size={10} className="shrink-0" />}
                  {i === 1 && <CheckCircle2 size={10} className="shrink-0" />}
                  {i === 2 && <Cpu size={10} className="shrink-0" />}
                  {i === 3 && <Clock size={10} className="shrink-0" />}
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Log textarea */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <Terminal size={11} className="text-amber-500/60" />
              <span className="text-[10px] text-white/25 font-mono">CI/CD Log Input</span>
            </div>
            <span className="text-[9px] text-white/20 font-mono">{logInput.split("\n").length} lines</span>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <textarea
              value={logInput}
              onChange={e => setLogInput(e.target.value)}
              className="flex-1 bg-transparent text-[11px] font-mono text-white/55 p-4 resize-none outline-none leading-5 placeholder:text-white/15 overflow-y-auto"
              placeholder="Paste CI/CD logs, GitHub Actions output, or deployment traces here..."
              spellCheck={false}
            />
          </div>

          {/* Analyze button */}
          <div className="flex-shrink-0 p-3 border-t border-white/[0.05]">
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !logInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <><Loader2 size={14} className="animate-spin" />Analyzing...</>
              ) : (
                <><Zap size={14} />Analyze Log</>
              )}
            </button>
          </div>
        </div>

        {/* ── Panel 2: Analysis + Chat ── */}
        <div className="flex flex-col overflow-hidden">

          {!analysis && !analyzing && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Terminal size={20} className="text-amber-400/50" />
              </div>
              <p className="text-white/30 text-sm">Select a sample log or paste your own, then click Analyze.</p>
              <p className="text-white/20 text-xs font-mono">Root cause · Severity · Fix suggestions · Chat</p>
            </div>
          )}

          {analyzing && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 size={22} className="animate-spin text-amber-400/70" />
              <div className="space-y-1 text-center">
                <p className="text-white/40 text-sm">Analyzing log...</p>
                <p className="text-white/20 text-xs font-mono">Classifying failure · Extracting signals · Generating fixes</p>
              </div>
            </div>
          )}

          {analysis && !analyzing && (
            <div className="flex-1 overflow-y-auto flex flex-col">

              {/* Analysis result */}
              <div className="flex-shrink-0 p-4 space-y-4 border-b border-white/[0.05]">

                {/* Severity + type header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sev!.bg} ${sev!.border} border ${sev!.color}`}>
                    <AlertCircle size={10} />
                    {sev!.label} Severity
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-white/50">
                    {FAILURE_LABELS[analysis.failureType]}
                  </span>
                </div>

                {/* Summary */}
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                  <p className="text-[11px] text-white/25 font-semibold uppercase tracking-widest mb-1.5">Summary</p>
                  <p className="text-sm text-white/70 leading-relaxed">{analysis.summary}</p>
                </div>

                {/* Root cause */}
                <div>
                  <p className="text-[10px] text-white/25 font-semibold uppercase tracking-widest mb-2">Root Cause</p>
                  <div className="flex gap-2">
                    <div className="w-0.5 bg-amber-500/40 rounded-full shrink-0 mt-0.5" />
                    <p className="text-sm text-white/60 leading-relaxed">{analysis.rootCause}</p>
                  </div>
                </div>

                {/* Error signals */}
                <div>
                  <p className="text-[10px] text-white/25 font-semibold uppercase tracking-widest mb-2">Error Signals</p>
                  <div className="space-y-1">
                    {analysis.errorSignals.map((sig, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/[0.05] border border-red-500/10">
                        <AlertTriangle size={10} className="text-red-400/70 mt-0.5 shrink-0" />
                        <span className="text-[11px] font-mono text-red-300/70 leading-snug">{sig}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Affected services */}
                <div>
                  <p className="text-[10px] text-white/25 font-semibold uppercase tracking-widest mb-2">Affected Services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.affectedServices.map((svc, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md bg-amber-500/[0.07] border border-amber-500/20 text-xs text-amber-300/70 font-mono">
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Fix suggestions */}
                <div>
                  <p className="text-[10px] text-white/25 font-semibold uppercase tracking-widest mb-2">Fix Suggestions</p>
                  <div className="space-y-2">
                    {analysis.fixSuggestions.slice(0, revealedFixes).map((fix, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3 space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={11} className="text-emerald-400/70 shrink-0" />
                          <span className="text-sm text-white/75 font-medium">{fix.title}</span>
                        </div>
                        {fix.command && (
                          <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/[0.06]">
                            <ChevronRight size={10} className="text-amber-400/50 mt-0.5 shrink-0" />
                            <code className="text-[10px] font-mono text-amber-200/60 leading-relaxed break-all">{fix.command}</code>
                          </div>
                        )}
                        <p className="text-xs text-white/35 leading-relaxed pl-[19px]">{fix.detail}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat interface */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/[0.05] flex items-center gap-2">
                  <MessageSquare size={12} className="text-white/30" />
                  <span className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">Chat with this log</span>
                  <span className="text-[9px] text-white/15 ml-auto">Ask follow-up questions</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {["How do I roll back?", "What services are affected?", "How do I prevent this?"].map(q => (
                        <button
                          key={q}
                          onClick={() => { setChatInput(q); }}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/35 hover:text-white/60 hover:bg-white/[0.07] transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-amber-500/15 border border-amber-500/25 text-amber-200/80 rounded-br-sm"
                          : "bg-white/[0.04] border border-white/[0.07] text-white/60 rounded-bl-sm"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="px-3 py-2 rounded-xl rounded-bl-sm bg-white/[0.04] border border-white/[0.07]">
                        <div className="flex gap-1">
                          <span className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendChat} className="flex-shrink-0 flex items-center gap-2 p-3 border-t border-white/[0.05]">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder={analysis ? "Ask about this incident..." : "Analyze a log first"}
                    disabled={!analysis}
                    className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-amber-500/30 transition-colors disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || !analysis || chatLoading}
                    className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Send size={13} />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
