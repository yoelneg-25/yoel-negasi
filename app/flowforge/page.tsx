"use client";

import { useReducer, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Play, RotateCcw, CheckCircle2, XCircle,
  AlertTriangle, Clock, Zap, FileCode2, Activity,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type OnExpire = "escalate" | "block";
type StepStatus = "pending" | "active" | "approved" | "rejected" | "escalated" | "skipped";
type WorkflowStatus = "idle" | "running" | "completed" | "rejected";

interface ConfigStep {
  name: string;
  role: string;
  sla: number;
  on_expire: OnExpire;
}

interface WorkflowConfig {
  name: string;
  steps: ConfigStep[];
}

interface RunStep extends ConfigStep {
  id: string;
  status: StepStatus;
  actor?: string;
}

interface AuditEvent {
  id: string;
  ts: string;
  actor: string;
  action: string;
  type: "approved" | "rejected" | "escalated" | "started" | "system";
}

interface State {
  status: WorkflowStatus;
  workflowName: string;
  steps: RunStep[];
  stepIndex: number;
  slaRemaining: number;
  log: AuditEvent[];
}

type Action =
  | { type: "RUN"; config: WorkflowConfig }
  | { type: "APPROVE" }
  | { type: "REJECT" }
  | { type: "ESCALATE" }
  | { type: "BLOCK" }
  | { type: "TICK" }
  | { type: "RESET" };

// ── YAML Parser ────────────────────────────────────────────────────────────────
type ParseResult =
  | { ok: true; config: WorkflowConfig }
  | { ok: false; error: string };

function parseYaml(yaml: string): ParseResult {
  const lines = yaml.split("\n");
  let name = "";
  const steps: ConfigStep[] = [];
  let cur: Partial<ConfigStep> | null = null;
  let inSteps = false;

  function flush() {
    if (!cur) return;
    if (!cur.name) throw new Error("A step is missing a name field");
    if (!cur.role) throw new Error(`"${cur.name}": missing role field`);
    if (!cur.sla || cur.sla < 5)
      throw new Error(`"${cur.name}": sla must be >= 5 seconds`);
    steps.push({
      name: cur.name,
      role: cur.role,
      sla: cur.sla,
      on_expire: cur.on_expire ?? "escalate",
    });
    cur = null;
  }

  try {
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim() || line.trim().startsWith("#")) continue;

      if (!inSteps) {
        const n = line.match(/^name:\s*(.+)/);
        if (n) { name = n[1].trim().replace(/^["']|["']$/g, ""); continue; }
        if (line.match(/^steps:\s*$/)) { inSteps = true; continue; }
        continue;
      }

      const stepName = line.match(/^\s{2}-\s+name:\s*(.+)/);
      if (stepName) {
        flush();
        cur = { name: stepName[1].trim().replace(/^["']|["']$/g, "") };
        continue;
      }
      if (!cur) continue;

      const role = line.match(/^\s{4}role:\s*(.+)/);
      if (role) { cur.role = role[1].trim().replace(/^["']|["']$/g, ""); continue; }
      const sla = line.match(/^\s{4}sla:\s*(\d+)/);
      if (sla) { cur.sla = parseInt(sla[1]); continue; }
      const expire = line.match(/^\s{4}on_expire:\s*(escalate|block)/);
      if (expire) { cur.on_expire = expire[1] as OnExpire; continue; }
    }

    flush();
    if (!name) return { ok: false, error: "Missing required field: name" };
    if (steps.length === 0) return { ok: false, error: "No steps defined under steps:" };
    if (steps.length > 8) return { ok: false, error: "Maximum 8 steps allowed" };
    return { ok: true, config: { name, steps } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Parse error" };
  }
}

// ── State machine ──────────────────────────────────────────────────────────────
let _uid = 0;
function uid() { return `e${++_uid}`; }
function ts() { return new Date().toISOString(); }

function advance(
  state: State,
  outcome: "approved" | "rejected" | "escalated" | "blocked",
  actor: string
): State {
  const steps = state.steps.map((s) => ({ ...s }));
  const cur = steps[state.stepIndex];
  cur.actor = actor;
  const newLog: AuditEvent[] = [];

  if (outcome === "blocked" || outcome === "rejected") {
    cur.status = "rejected";
    for (let i = state.stepIndex + 1; i < steps.length; i++) steps[i].status = "skipped";
    newLog.push(
      {
        id: uid(), ts: ts(), actor,
        action: outcome === "blocked"
          ? `SLA exceeded — workflow blocked at "${cur.name}"`
          : `Rejected: ${cur.name}`,
        type: "rejected",
      },
      { id: uid(), ts: ts(), actor: "System", action: "Workflow terminated — release blocked", type: "system" }
    );
    return { ...state, steps, status: "rejected", log: [...state.log, ...newLog] };
  }

  cur.status = outcome;
  newLog.push({
    id: uid(), ts: ts(), actor,
    action: outcome === "approved"
      ? `Approved: ${cur.name}`
      : `Escalated: ${cur.name} (SLA exceeded)`,
    type: outcome,
  });

  const next = state.stepIndex + 1;
  if (next >= steps.length) {
    newLog.push({ id: uid(), ts: ts(), actor: "System", action: "All approvals received — cleared for deployment", type: "system" });
    return { ...state, steps, status: "completed", log: [...state.log, ...newLog] };
  }

  steps[next].status = "active";
  newLog.push({ id: uid(), ts: ts(), actor: "System", action: `Step activated: ${steps[next].name}`, type: "started" });
  return { ...state, steps, stepIndex: next, slaRemaining: steps[next].sla, log: [...state.log, ...newLog] };
}

const IDLE: State = { status: "idle", workflowName: "", steps: [], stepIndex: 0, slaRemaining: 0, log: [] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RUN": {
      const steps: RunStep[] = action.config.steps.map((s, i) => ({
        ...s, id: `s${i}`, status: i === 0 ? "active" : "pending",
      }));
      return {
        status: "running",
        workflowName: action.config.name,
        steps,
        stepIndex: 0,
        slaRemaining: action.config.steps[0].sla,
        log: [
          { id: uid(), ts: ts(), actor: "System", action: `Workflow started — ${action.config.name}`, type: "system" },
          { id: uid(), ts: ts(), actor: "System", action: `Step activated: ${steps[0].name}`, type: "started" },
        ],
      };
    }
    case "APPROVE":
      if (state.status !== "running") return state;
      return advance(state, "approved", state.steps[state.stepIndex].role);
    case "REJECT":
      if (state.status !== "running") return state;
      return advance(state, "rejected", state.steps[state.stepIndex].role);
    case "ESCALATE":
      if (state.status !== "running") return state;
      return advance(state, "escalated", `System (${state.steps[state.stepIndex].role} unresponsive)`);
    case "BLOCK":
      if (state.status !== "running") return state;
      return advance(state, "blocked", `System (SLA policy: block)`);
    case "TICK":
      if (state.status !== "running") return state;
      if (state.slaRemaining <= 1)
        return reducer(state, { type: state.steps[state.stepIndex].on_expire === "block" ? "BLOCK" : "ESCALATE" });
      return { ...state, slaRemaining: state.slaRemaining - 1 };
    case "RESET":
      return IDLE;
  }
}

// ── Default YAML ───────────────────────────────────────────────────────────────
const DEFAULT_YAML = `# FlowForge Workflow Definition
# Edit any field and click Run — the engine rebuilds from config

name: Software Release v2.4.1

steps:
  - name: Tech Lead Review
    role: Tech Lead
    sla: 60
    on_expire: escalate

  - name: Security Review
    role: Security Engineer
    sla: 45
    on_expire: escalate

  - name: Platform Review
    role: Platform Engineer
    sla: 30
    on_expire: block

  - name: VP Sign-off
    role: VP Engineering
    sla: 20
    on_expire: escalate`;

// ── Style maps ─────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<StepStatus, {
  border: string; bg: string;
  badge: string; badgeCls: string; numCls: string;
}> = {
  pending:   { border: "border-white/[0.06]",   bg: "bg-white/[0.015]",      badge: "Pending",   badgeCls: "text-white/25 bg-white/[0.04] border-white/[0.07]",         numCls: "border-white/[0.08] bg-white/[0.03] text-white/25" },
  active:    { border: "border-violet-500/40",  bg: "bg-violet-500/[0.04]",  badge: "In Review", badgeCls: "text-violet-300 bg-violet-500/15 border-violet-500/25",      numCls: "border-violet-500/40 bg-violet-500/15 text-violet-300" },
  approved:  { border: "border-emerald-500/30", bg: "bg-emerald-500/[0.04]", badge: "Approved",  badgeCls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",   numCls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  rejected:  { border: "border-red-500/30",     bg: "bg-red-500/[0.04]",     badge: "Rejected",  badgeCls: "text-red-300 bg-red-500/15 border-red-500/25",               numCls: "border-red-500/30 bg-red-500/10 text-red-400" },
  escalated: { border: "border-amber-500/30",   bg: "bg-amber-500/[0.04]",   badge: "Escalated", badgeCls: "text-amber-300 bg-amber-500/15 border-amber-500/25",         numCls: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  skipped:   { border: "border-white/[0.04]",   bg: "bg-white/[0.01]",       badge: "Skipped",   badgeCls: "text-white/15 bg-white/[0.02] border-white/[0.04]",          numCls: "border-white/[0.04] bg-transparent text-white/15" },
};

const AUDIT_DOT: Record<AuditEvent["type"], string> = {
  approved: "bg-emerald-400",
  rejected: "bg-red-400",
  escalated: "bg-amber-400",
  started: "bg-violet-400",
  system: "bg-white/25",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function FlowForgePage() {
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [state, dispatch] = useReducer(reducer, IDLE);
  const logRef = useRef<HTMLDivElement>(null);

  const parsed = parseYaml(yaml);
  const isValid = parsed.ok;
  const stepCount = parsed.ok ? parsed.config.steps.length : 0;
  const lineCount = yaml.split("\n").length;

  // SLA ticker
  useEffect(() => {
    if (state.status !== "running") return;
    const id = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.stepIndex]);

  // Auto-scroll audit log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.log.length]);

  function handleRun() {
    if (!parsed.ok) return;
    dispatch({ type: "RUN", config: parsed.config });
  }

  const cur = state.status === "running" ? state.steps[state.stepIndex] : null;
  const slaMax = cur?.sla ?? 60;
  const slaPercent = cur ? (state.slaRemaining / slaMax) * 100 : 100;
  const slaBarCls =
    state.slaRemaining > slaMax * 0.5 ? "bg-violet-500" :
    state.slaRemaining > slaMax * 0.25 ? "bg-amber-500" : "bg-red-500";
  const slaTextCls =
    state.slaRemaining > slaMax * 0.5 ? "text-violet-400" :
    state.slaRemaining > slaMax * 0.25 ? "text-amber-400" : "text-red-400";

  const doneSteps = state.steps.filter(
    (s) => s.status === "approved" || s.status === "escalated"
  ).length;

  return (
    <main className="h-screen overflow-hidden bg-[#080810] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#080810]/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/projects/flowforge"
              className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors group"
            >
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-white/[0.07]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Zap size={11} className="text-violet-400" />
              </div>
              <span className="font-sora font-bold text-sm">FlowForge</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20 font-semibold tracking-wide">
                LIVE DEMO
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {state.status === "running" && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/25">
                <Activity size={11} />
                <span>{doneSteps}/{state.steps.length} steps</span>
              </div>
            )}
            <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${
              state.status === "completed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" :
              state.status === "rejected"  ? "bg-red-500/15 text-red-300 border-red-500/25" :
              state.status === "running"   ? "bg-violet-500/15 text-violet-300 border-violet-500/25" :
              "bg-white/[0.04] text-white/20 border-white/[0.07]"
            }`}>
              {state.status === "completed" ? "✓ Approved" :
               state.status === "rejected"  ? "✗ Rejected" :
               state.status === "running"   ? "● Running"  : "Idle"}
            </span>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/35 hover:text-white/65 transition-all"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* ── Three-panel body ── */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-[400px_1fr_300px]">

        {/* ── Panel 1: YAML Config Editor ── */}
        <div className="flex flex-col border-r border-white/[0.06] bg-[#06060e] overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <FileCode2 size={12} className="text-violet-400/50" />
              <span className="text-xs font-mono text-white/40">workflow.yaml</span>
            </div>
            {isValid ? (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/70">
                <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
                {stepCount} step{stepCount !== 1 ? "s" : ""} · valid
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-red-400/70">
                <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
                parse error
              </span>
            )}
          </div>

          {/* Editor with line numbers */}
          <div className="flex-1 overflow-hidden relative min-h-0">
            <div
              aria-hidden
              className="absolute left-0 top-0 bottom-0 w-9 flex flex-col items-end pt-4 pb-4 pr-2 bg-[#04040b] border-r border-white/[0.04] z-10 pointer-events-none select-none overflow-hidden"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-[10px] font-mono text-white/[0.1] leading-5 flex-shrink-0">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={yaml}
              onChange={(e) => setYaml(e.target.value)}
              spellCheck={false}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-[12px] text-white/70 leading-5 pl-12 pr-4 pt-4 pb-4 outline-none overflow-y-auto"
              style={{ fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", ui-monospace, monospace' }}
            />
          </div>

          {/* Validation error */}
          {!isValid && (
            <div className="flex-shrink-0 px-4 py-2.5 border-t border-red-500/20 bg-red-500/[0.05]">
              <p className="text-[11px] font-mono text-red-400/90">
                ⚠ {(parsed as { ok: false; error: string }).error}
              </p>
            </div>
          )}

          {/* Run button + schema hint */}
          <div className="flex-shrink-0 p-3 border-t border-white/[0.05]">
            <button
              onClick={handleRun}
              disabled={!isValid}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isValid
                  ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 active:scale-[0.98]"
                  : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              }`}
            >
              <Play size={12} className={isValid ? "fill-white" : ""} />
              {state.status === "idle" ? "Run Workflow" : "Re-run with Config"}
            </button>
            {state.status !== "idle" ? (
              <p className="text-[10px] text-white/18 text-center mt-2">
                Edits take effect on next run
              </p>
            ) : (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-white/20 font-mono mb-1.5">Step fields:</p>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { k: "name", v: "string" },
                    { k: "role", v: "string" },
                    { k: "sla", v: "seconds ≥ 5" },
                    { k: "on_expire", v: "escalate|block" },
                  ].map(({ k, v }) => (
                    <div key={k} className="flex items-center gap-1 text-[10px]">
                      <span className="font-mono text-violet-400/55">{k}:</span>
                      <span className="text-white/20">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Panel 2: Workflow Execution ── */}
        <div className="overflow-y-auto p-5 lg:p-7">
          {state.status === "idle" ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-20">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Play size={20} className="text-violet-400/60 ml-0.5" />
              </div>
              <div>
                <p className="font-semibold text-white/40 mb-2">No workflow running</p>
                <p className="text-sm text-white/20 max-w-xs leading-relaxed">
                  Edit the config on the left — change step names, SLAs, roles, or{" "}
                  <code className="text-violet-400/50 text-[11px]">on_expire</code> behavior —
                  then click{" "}
                  <span className="text-violet-400/60 font-medium">Run Workflow</span>.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-white/20 max-w-xs">
                <div className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50 flex-shrink-0" />
                  <span>
                    <code className="text-amber-400/55">on_expire: escalate</code> — auto-advances
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/50 flex-shrink-0" />
                  <span>
                    <code className="text-red-400/55">on_expire: block</code> — terminates workflow
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <div className="mb-5">
                <p className="text-[10px] font-mono text-white/25 mb-1">workflow.name</p>
                <h2 className="font-sora font-bold text-xl text-white/90">{state.workflowName}</h2>
                <p className="text-xs text-white/25 mt-1">
                  {state.steps.length} steps ·{" "}
                  {state.steps.filter((s) => s.on_expire === "block").length > 0
                    ? `${state.steps.filter((s) => s.on_expire === "block").length} block polic${state.steps.filter((s) => s.on_expire === "block").length > 1 ? "ies" : "y"}`
                    : "all escalate on expire"}
                </p>
              </div>

              <AnimatePresence>
                {state.status === "completed" && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 flex gap-3 mb-5"
                  >
                    <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-300">Cleared for deployment</p>
                      <p className="text-xs text-emerald-400/50 mt-0.5">All {state.steps.length} approval gates passed</p>
                    </div>
                  </motion.div>
                )}
                {state.status === "rejected" && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4 flex gap-3 mb-5"
                  >
                    <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-300">Release blocked</p>
                      <p className="text-xs text-red-400/50 mt-0.5">See audit trail for the rejection reason</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                {state.steps.map((step, i) => {
                  const s = STATUS_STYLES[step.status];
                  const isActive = step.status === "active" && state.status === "running";
                  return (
                    <div key={step.id} className="relative">
                      {i < state.steps.length - 1 && (
                        <div className="absolute left-[1.45rem] top-full w-px h-2 bg-white/[0.04]" />
                      )}
                      <motion.div
                        layout
                        className={`rounded-xl border p-4 transition-colors duration-300 ${s.border} ${s.bg}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] font-bold font-mono flex-shrink-0 ${s.numCls}`}>
                              {step.status === "approved"  ? <CheckCircle2 size={12} /> :
                               step.status === "rejected"  ? <XCircle size={12} /> :
                               step.status === "escalated" ? <AlertTriangle size={12} /> :
                               step.status === "skipped"   ? "—" : i + 1}
                            </div>
                            <div className="min-w-0">
                              <p className={`font-semibold text-sm truncate ${step.status === "skipped" ? "text-white/20" : "text-white/85"}`}>
                                {step.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[11px] text-white/30">{step.role}</p>
                                <span className={`text-[9px] font-mono px-1 py-px rounded border ${
                                  step.on_expire === "block"
                                    ? "text-red-400/50 bg-red-500/[0.06] border-red-500/15"
                                    : "text-amber-400/40 bg-amber-500/[0.04] border-amber-500/10"
                                }`}>
                                  {step.on_expire}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${s.badgeCls}`}>
                            {s.badge}
                          </span>
                        </div>

                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              style={{ overflow: "hidden" }}
                            >
                              <div className="pl-10 mt-3 mb-3.5">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                                    <Clock size={10} />
                                    <span>
                                      SLA ·{" "}
                                      {step.on_expire === "block"
                                        ? <span className="text-red-400/70">block on expire</span>
                                        : <span className="text-amber-400/60">escalate on expire</span>}
                                    </span>
                                  </div>
                                  <span className={`text-xs font-mono font-bold tabular-nums ${slaTextCls}`}>
                                    {String(Math.floor(state.slaRemaining / 60)).padStart(2, "0")}:
                                    {String(state.slaRemaining % 60).padStart(2, "0")}
                                  </span>
                                </div>
                                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                  <motion.div
                                    className={`h-full rounded-full transition-colors duration-500 ${slaBarCls}`}
                                    animate={{ width: `${slaPercent}%` }}
                                    transition={{ duration: 0.9, ease: "linear" }}
                                  />
                                </div>
                                {state.slaRemaining <= Math.ceil(slaMax * 0.25) && (
                                  <p className="text-[10px] text-red-400/80 mt-1.5 animate-pulse">
                                    ⚠ {step.on_expire === "block" ? "Workflow will be blocked" : "Auto-escalating"} in {state.slaRemaining}s
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2 pl-10">
                                <button
                                  onClick={() => dispatch({ type: "APPROVE" })}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 hover:border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all"
                                >
                                  <CheckCircle2 size={12} />
                                  Approve
                                </button>
                                <button
                                  onClick={() => dispatch({ type: "REJECT" })}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/40 text-red-300 text-xs font-semibold transition-all"
                                >
                                  <XCircle size={12} />
                                  Reject
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {(step.status === "approved" || step.status === "escalated" || step.status === "rejected") && step.actor && (
                          <p className="text-[10px] text-white/20 pl-10 mt-2 truncate font-mono">
                            by {step.actor}
                          </p>
                        )}
                      </motion.div>
                    </div>
                  );
                })}
              </div>

              {state.status === "running" && (
                <p className="text-[10px] text-white/18 text-center mt-5">
                  Approve or reject · or wait for SLA to fire automatically
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Panel 3: Audit Log ── */}
        <div className="flex flex-col bg-[#050510] border-l border-white/[0.05] overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/55">Audit Trail</p>
              <p className="text-[10px] text-white/20 mt-0.5">Append-only event log</p>
            </div>
            <span className="text-[10px] font-mono text-white/20 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">
              {state.log.length} events
            </span>
          </div>

          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3">
            {state.log.length === 0 ? (
              <p className="text-[11px] text-white/15 text-center mt-10 leading-relaxed">
                Events appear here<br />when the workflow runs
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {state.log.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-2.5"
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0 ${AUDIT_DOT[event.type]}`} />
                      {i < state.log.length - 1 && (
                        <div className="w-px flex-1 bg-white/[0.04] my-1" />
                      )}
                    </div>
                    <div className="pb-3 min-w-0 flex-1">
                      <p className="text-[11px] text-white/60 leading-snug break-words">
                        {event.action}
                      </p>
                      <p className="text-[10px] text-white/18 mt-0.5 font-mono">
                        {fmtTime(event.ts)}
                      </p>
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
