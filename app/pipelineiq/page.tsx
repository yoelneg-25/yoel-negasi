"use client";

import { useReducer, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Play, RotateCcw, FileCode2, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, Activity, Zap,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type ServiceStatus = "idle" | "building" | "healthy" | "failed" | "rolling_back" | "restored";

interface ConfigService {
  name: string;
  team: string;
  auto_rollback: boolean;
  slo: number;
}

interface RunService extends ConfigService {
  id: string;
  status: ServiceStatus;
  buildNum: number;
  successCount: number;
  failCount: number;
  lastDeployTs?: number;
  phaseStartTs?: number;
  phaseDuration?: number;
  phaseWillFail?: boolean;
}

interface LogEvent {
  id: string;
  ts: string;
  service: string;
  action: string;
  type: "build_start" | "build_success" | "build_fail" | "rollback" | "restored" | "retry" | "system";
}

interface State {
  phase: "idle" | "running";
  services: RunService[];
  log: LogEvent[];
  tick: number;
}

type Action =
  | { type: "APPLY"; services: ConfigService[] }
  | { type: "TICK"; now: number; r: number[] }
  | { type: "RETRY"; id: string; now: number; r: number[] }
  | { type: "RESET" };

// ── YAML parser ────────────────────────────────────────────────────────────────
type ParseResult = { ok: true; services: ConfigService[] } | { ok: false; error: string };

function parseYaml(yaml: string): ParseResult {
  const lines = yaml.split("\n");
  const services: ConfigService[] = [];
  let cur: Partial<ConfigService> | null = null;
  let inServices = false;

  function flush() {
    if (!cur) return;
    if (!cur.name) throw new Error("A service is missing a name field");
    if (!cur.team) throw new Error(`"${cur.name}": missing team field`);
    services.push({
      name: cur.name,
      team: cur.team,
      auto_rollback: cur.auto_rollback ?? true,
      slo: cur.slo ?? 99.9,
    });
    cur = null;
  }

  try {
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (!inServices) {
        if (/^services:\s*$/.test(line)) { inServices = true; continue; }
        continue;
      }
      const nm = line.match(/^\s{2}-\s+name:\s*(.+)/);
      if (nm) { flush(); cur = { name: nm[1].trim().replace(/^["']|["']$/g, "") }; continue; }
      if (!cur) continue;
      const team = line.match(/^\s{4}team:\s*(.+)/);
      if (team) { cur.team = team[1].trim().replace(/^["']|["']$/g, ""); continue; }
      const ar = line.match(/^\s{4}auto_rollback:\s*(true|false)/);
      if (ar) { cur.auto_rollback = ar[1] === "true"; continue; }
      const slo = line.match(/^\s{4}slo:\s*(\d+\.?\d*)/);
      if (slo) {
        const v = parseFloat(slo[1]);
        if (v < 0 || v > 100) throw new Error(`"${cur.name}": slo must be 0-100`);
        cur.slo = v;
        continue;
      }
    }
    flush();
    if (!services.length) return { ok: false, error: "No services defined under services:" };
    if (services.length > 12) return { ok: false, error: "Maximum 12 services allowed" };
    return { ok: true, services };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Parse error" };
  }
}

// ── State machine ──────────────────────────────────────────────────────────────
let _uid = 0;
function uid() { return `l${++_uid}`; }
function tsNow() { return new Date().toISOString(); }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "APPLY": {
      const services: RunService[] = action.services.map((s, i) => ({
        ...s, id: `svc${i}`, status: "idle", buildNum: 0, successCount: 0, failCount: 0,
      }));
      return {
        phase: "running", services, tick: 0,
        log: [{ id: uid(), ts: tsNow(), service: "System", action: `Registry applied — monitoring ${services.length} service${services.length !== 1 ? "s" : ""}`, type: "system" }],
      };
    }

    case "TICK": {
      if (state.phase !== "running") return state;
      const { now, r } = action;
      const newLog: LogEvent[] = [];
      const svcs = state.services.map(s => ({ ...s }));

      // Resolve completed phases
      for (const svc of svcs) {
        if (!svc.phaseStartTs || !svc.phaseDuration) continue;
        if ((now - svc.phaseStartTs) / 1000 < svc.phaseDuration) continue;

        if (svc.status === "building") {
          if (svc.phaseWillFail) {
            svc.failCount++;
            newLog.push({ id: uid(), ts: tsNow(), service: svc.name, action: `Build #${svc.buildNum} failed — ${svc.name}`, type: "build_fail" });
            if (svc.auto_rollback) {
              svc.status = "rolling_back";
              svc.phaseStartTs = now;
              svc.phaseDuration = 3 + r[3] * 2;
              svc.phaseWillFail = undefined;
              newLog.push({ id: uid(), ts: tsNow(), service: svc.name, action: `Auto-rollback triggered — ${svc.name}`, type: "rollback" });
            } else {
              svc.status = "failed";
              svc.phaseStartTs = undefined;
              svc.phaseDuration = undefined;
              svc.phaseWillFail = undefined;
            }
          } else {
            svc.status = "healthy";
            svc.successCount++;
            svc.lastDeployTs = now;
            svc.phaseStartTs = undefined;
            svc.phaseDuration = undefined;
            svc.phaseWillFail = undefined;
            newLog.push({ id: uid(), ts: tsNow(), service: svc.name, action: `Build #${svc.buildNum} deployed — ${svc.name}`, type: "build_success" });
          }
        } else if (svc.status === "rolling_back") {
          svc.status = "restored";
          svc.phaseStartTs = undefined;
          svc.phaseDuration = undefined;
          newLog.push({ id: uid(), ts: tsNow(), service: svc.name, action: `Rollback complete — ${svc.name} restored to last stable version`, type: "restored" });
        }
      }

      // Trigger new build every 5 ticks
      const newTick = state.tick + 1;
      if (newTick % 5 === 0) {
        const eligible = svcs.filter(s => s.status === "idle" || s.status === "healthy" || s.status === "restored");
        if (eligible.length > 0) {
          const target = eligible[Math.floor(r[0] * eligible.length)];
          const svc = svcs.find(s => s.id === target.id)!;
          svc.status = "building";
          svc.buildNum++;
          svc.phaseStartTs = now;
          svc.phaseDuration = 4 + r[1] * 6;
          svc.phaseWillFail = r[2] < 0.25;
          newLog.push({ id: uid(), ts: tsNow(), service: svc.name, action: `Build #${svc.buildNum} started — ${svc.name}`, type: "build_start" });
        }
      }

      return { ...state, services: svcs, log: [...state.log, ...newLog], tick: newTick };
    }

    case "RETRY": {
      const { id, now, r } = action;
      const svcs = state.services.map(s => {
        if (s.id !== id) return s;
        return { ...s, status: "building" as ServiceStatus, buildNum: s.buildNum + 1, phaseStartTs: now, phaseDuration: 3 + r[0] * 5, phaseWillFail: r[1] < 0.25 };
      });
      const svc = svcs.find(s => s.id === id)!;
      return {
        ...state, services: svcs,
        log: [...state.log, { id: uid(), ts: tsNow(), service: svc.name, action: `Manual retry — Build #${svc.buildNum} triggered`, type: "retry" }],
      };
    }

    case "RESET":
      return { phase: "idle", services: [], log: [], tick: 0 };
  }
}

// ── Default YAML ───────────────────────────────────────────────────────────────
const DEFAULT_YAML = `# PipelineIQ Service Registry
# Edit services, toggle auto_rollback, adjust SLO targets
# Click Apply — the engine rebuilds and starts simulating

services:
  - name: api-gateway
    team: platform
    auto_rollback: true
    slo: 99.9

  - name: auth-service
    team: security
    auto_rollback: true
    slo: 99.95

  - name: payment-api
    team: payments
    auto_rollback: true
    slo: 99.99

  - name: notification-worker
    team: platform
    auto_rollback: false
    slo: 99.5

  - name: data-pipeline
    team: data
    auto_rollback: true
    slo: 99.0

  - name: search-indexer
    team: data
    auto_rollback: false
    slo: 99.5`;

// ── Style maps ─────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<ServiceStatus, {
  dot: string; border: string; bg: string;
  badge: string; badgeCls: string; pulse: boolean;
}> = {
  idle:         { dot: "bg-white/20",    border: "border-white/[0.06]",   bg: "bg-white/[0.015]",      badge: "Idle",         badgeCls: "text-white/25 bg-white/[0.04] border-white/[0.06]",         pulse: false },
  building:     { dot: "bg-violet-400",  border: "border-violet-500/35",  bg: "bg-violet-500/[0.04]",  badge: "Building",     badgeCls: "text-violet-300 bg-violet-500/15 border-violet-500/25",     pulse: true  },
  healthy:      { dot: "bg-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/[0.03]", badge: "Healthy",      badgeCls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",  pulse: false },
  failed:       { dot: "bg-red-400",     border: "border-red-500/30",     bg: "bg-red-500/[0.04]",     badge: "Failed",       badgeCls: "text-red-300 bg-red-500/15 border-red-500/25",              pulse: false },
  rolling_back: { dot: "bg-amber-400",   border: "border-amber-500/30",   bg: "bg-amber-500/[0.04]",   badge: "Rolling Back", badgeCls: "text-amber-300 bg-amber-500/15 border-amber-500/25",        pulse: true  },
  restored:     { dot: "bg-amber-300",   border: "border-amber-500/25",   bg: "bg-amber-500/[0.025]",  badge: "Restored",     badgeCls: "text-amber-200 bg-amber-500/10 border-amber-500/15",        pulse: false },
};

const LOG_DOT: Record<LogEvent["type"], string> = {
  build_start:   "bg-violet-400",
  build_success: "bg-emerald-400",
  build_fail:    "bg-red-400",
  rollback:      "bg-amber-400",
  restored:      "bg-amber-300",
  retry:         "bg-blue-400",
  system:        "bg-white/25",
};

const TEAM_COLORS = [
  "bg-blue-500/15 text-blue-300 border-blue-500/20",
  "bg-violet-500/15 text-violet-300 border-violet-500/20",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  "bg-amber-500/15 text-amber-300 border-amber-500/20",
  "bg-pink-500/15 text-pink-300 border-pink-500/20",
  "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
];

function teamColor(team: string): string {
  let h = 0;
  for (const c of team) h = (h + c.charCodeAt(0)) % TEAM_COLORS.length;
  return TEAM_COLORS[h];
}

function relativeTime(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 5) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

function fmtTs(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── ServiceCard ────────────────────────────────────────────────────────────────
function ServiceCard({ svc, onRetry }: { svc: RunService; onRetry: () => void }) {
  const st = STATUS_STYLES[svc.status];
  const total = svc.successCount + svc.failCount;
  const rate = total > 0 ? (svc.successCount / total) * 100 : null;
  const sloMet = rate === null || rate >= svc.slo;

  const phaseProgress =
    svc.phaseStartTs && svc.phaseDuration
      ? Math.min(1, (Date.now() - svc.phaseStartTs) / (svc.phaseDuration * 1000))
      : null;

  return (
    <motion.div
      layout
      className={`rounded-xl border p-4 transition-colors duration-300 ${st.border} ${st.bg}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-shrink-0 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${st.dot}`} />
            {st.pulse && <div className={`absolute inset-0 w-2 h-2 rounded-full ${st.dot} animate-ping opacity-70`} />}
          </div>
          <p className="font-semibold text-sm text-white/85 truncate">{svc.name}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${st.badgeCls}`}>
          {st.badge}
        </span>
      </div>

      {/* Team + rollback badges */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${teamColor(svc.team)}`}>
          {svc.team}
        </span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
          svc.auto_rollback
            ? "text-emerald-400/60 bg-emerald-500/[0.05] border-emerald-500/15"
            : "text-red-400/50 bg-red-500/[0.04] border-red-500/15"
        }`}>
          {svc.auto_rollback ? "auto-rollback" : "no rollback"}
        </span>
      </div>

      {/* Phase progress bar */}
      {phaseProgress !== null && (
        <div className="mb-3">
          <div className="h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${svc.status === "rolling_back" ? "bg-amber-500" : "bg-violet-500"}`}
              animate={{ width: `${Math.round(phaseProgress * 100)}%` }}
              transition={{ duration: 0.9, ease: "linear" }}
            />
          </div>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-y-2">
        <div>
          <p className="text-[9px] text-white/20 uppercase tracking-wide mb-0.5">Build</p>
          <p className="text-[11px] font-mono text-white/50">{svc.buildNum > 0 ? `#${svc.buildNum}` : "—"}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/20 uppercase tracking-wide mb-0.5">Last Deploy</p>
          <p className="text-[11px] font-mono text-white/50">{svc.lastDeployTs ? relativeTime(svc.lastDeployTs) : "—"}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/20 uppercase tracking-wide mb-0.5">SLO Target</p>
          <p className="text-[11px] font-mono text-white/50">{svc.slo}%</p>
        </div>
        <div>
          <p className="text-[9px] text-white/20 uppercase tracking-wide mb-0.5">Effective</p>
          <p className={`text-[11px] font-mono font-semibold ${
            rate === null ? "text-white/25" : sloMet ? "text-emerald-400" : "text-red-400"
          }`}>
            {rate === null ? "—" : `${rate.toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Manual retry for failed + no auto_rollback */}
      {svc.status === "failed" && !svc.auto_rollback && (
        <button
          onClick={onRetry}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/35 text-blue-300 text-xs font-semibold transition-all"
        >
          <RefreshCw size={11} />
          Retry Build
        </button>
      )}
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PipelineIQPage() {
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [state, dispatch] = useReducer(reducer, { phase: "idle", services: [], log: [], tick: 0 });
  const logRef = useRef<HTMLDivElement>(null);

  const parsed = parseYaml(yaml);
  const isValid = parsed.ok;
  const svcCount = parsed.ok ? parsed.services.length : 0;
  const lineCount = yaml.split("\n").length;

  // Simulation tick
  useEffect(() => {
    if (state.phase !== "running") return;
    const id = setInterval(() => {
      dispatch({ type: "TICK", now: Date.now(), r: Array.from({ length: 6 }, () => Math.random()) });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.log.length]);

  function handleApply() {
    if (!parsed.ok) return;
    dispatch({ type: "APPLY", services: parsed.services });
  }

  // Summary stats
  const stats = {
    healthy:  state.services.filter(s => s.status === "healthy").length,
    building: state.services.filter(s => s.status === "building" || s.status === "rolling_back").length,
    failed:   state.services.filter(s => s.status === "failed").length,
    idle:     state.services.filter(s => s.status === "idle" || s.status === "restored").length,
  };

  return (
    <main className="h-screen overflow-hidden bg-[#080810] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#080810]/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects/pipelineiq" className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors group">
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-white/[0.07]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Zap size={11} className="text-indigo-400" />
              </div>
              <span className="font-sora font-bold text-sm">PipelineIQ</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-semibold tracking-wide">
                LIVE DEMO
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {state.phase === "running" && (
              <div className="hidden sm:flex items-center gap-3 text-xs text-white/25">
                <span className="flex items-center gap-1"><Activity size={10} />{state.services.length} services</span>
                {stats.failed > 0 && <span className="text-red-400/70">{stats.failed} failed</span>}
              </div>
            )}
            <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${
              state.phase === "running"
                ? stats.failed > 0
                  ? "bg-red-500/15 text-red-300 border-red-500/25"
                  : "bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
                : "bg-white/[0.04] text-white/20 border-white/[0.07]"
            }`}>
              {state.phase === "idle" ? "Idle" : stats.failed > 0 ? `${stats.failed} incident${stats.failed > 1 ? "s" : ""}` : "● Monitoring"}
            </span>
            <button onClick={() => dispatch({ type: "RESET" })} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/35 hover:text-white/65 transition-all">
              <RotateCcw size={10} />
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* ── Three panels ── */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-[380px_1fr_300px]">

        {/* ── Panel 1: YAML Config Editor ── */}
        <div className="flex flex-col border-r border-white/[0.06] bg-[#06060e] overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <FileCode2 size={12} className="text-indigo-400/50" />
              <span className="text-xs font-mono text-white/40">services.yaml</span>
            </div>
            {isValid ? (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/70">
                <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
                {svcCount} service{svcCount !== 1 ? "s" : ""} · valid
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
                <div key={i} className="text-[10px] font-mono text-white/[0.1] leading-5 flex-shrink-0">{i + 1}</div>
              ))}
            </div>
            <textarea
              value={yaml}
              onChange={(e) => setYaml(e.target.value)}
              spellCheck={false}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-[12px] text-white/70 leading-5 pl-12 pr-4 pt-4 pb-4 outline-none overflow-y-auto"
              style={{ fontFamily: '"Fira Code", "JetBrains Mono", ui-monospace, monospace' }}
            />
          </div>

          {/* Validation error */}
          {!isValid && (
            <div className="flex-shrink-0 px-4 py-2.5 border-t border-red-500/20 bg-red-500/[0.05]">
              <p className="text-[11px] font-mono text-red-400/90">⚠ {(parsed as { ok: false; error: string }).error}</p>
            </div>
          )}

          {/* Apply button + schema hint */}
          <div className="flex-shrink-0 p-3 border-t border-white/[0.05]">
            <button
              onClick={handleApply}
              disabled={!isValid}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isValid
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
                  : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              }`}
            >
              <Play size={12} className={isValid ? "fill-white" : ""} />
              {state.phase === "idle" ? "Apply Config" : "Re-apply Config"}
            </button>
            {state.phase !== "idle" && (
              <p className="text-[10px] text-white/18 text-center mt-2">Edits take effect on re-apply</p>
            )}
            {state.phase === "idle" && (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-white/20 font-mono mb-1.5">Service fields:</p>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { k: "name", v: "string" },
                    { k: "team", v: "string" },
                    { k: "auto_rollback", v: "true|false" },
                    { k: "slo", v: "0–100" },
                  ].map(({ k, v }) => (
                    <div key={k} className="flex items-center gap-1 text-[10px]">
                      <span className="font-mono text-indigo-400/55">{k}:</span>
                      <span className="text-white/20">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Panel 2: Service Dashboard ── */}
        <div className="overflow-y-auto p-5 lg:p-6">
          {state.phase === "idle" ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-20">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Activity size={20} className="text-indigo-400/60" />
              </div>
              <div>
                <p className="font-semibold text-white/40 mb-2">No services registered</p>
                <p className="text-sm text-white/20 max-w-xs leading-relaxed">
                  Edit the service registry on the left — add services, set teams, toggle{" "}
                  <code className="text-indigo-400/50 text-[11px]">auto_rollback</code>, and configure SLO targets.
                  Then click{" "}
                  <span className="text-indigo-400/60 font-medium">Apply Config</span>.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-white/20 max-w-xs">
                <div className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 flex-shrink-0" />
                  <span><code className="text-emerald-400/60">auto_rollback: true</code> — failed deploys restore automatically</span>
                </div>
                <div className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 flex-shrink-0" />
                  <span><code className="text-red-400/60">auto_rollback: false</code> — failed deploys stay failed, need manual retry</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Stats bar */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {[
                  { label: "Healthy",  value: stats.healthy,  cls: "text-emerald-400" },
                  { label: "Building", value: stats.building, cls: "text-violet-400" },
                  { label: "Failed",   value: stats.failed,   cls: "text-red-400" },
                  { label: "Idle",     value: stats.idle,     cls: "text-white/30" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <p className={`text-xl font-bold font-mono tabular-nums ${cls}`}>{value}</p>
                    <p className="text-[10px] text-white/25 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Service grid */}
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <AnimatePresence>
                  {state.services.map((svc) => (
                    <ServiceCard
                      key={svc.id}
                      svc={svc}
                      onRetry={() => dispatch({ type: "RETRY", id: svc.id, now: Date.now(), r: [Math.random(), Math.random()] })}
                    />
                  ))}
                </AnimatePresence>
              </div>

              <p className="text-[10px] text-white/15 text-center mt-5">
                Builds trigger automatically every 5s · failed services with <code className="font-mono">auto_rollback: false</code> require manual retry
              </p>
            </>
          )}
        </div>

        {/* ── Panel 3: Activity Feed ── */}
        <div className="flex flex-col bg-[#050510] border-l border-white/[0.05] overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/55">Activity Feed</p>
              <p className="text-[10px] text-white/20 mt-0.5">Deployment event log</p>
            </div>
            <span className="text-[10px] font-mono text-white/20 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">
              {state.log.length} events
            </span>
          </div>

          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3">
            {state.log.length === 0 ? (
              <p className="text-[11px] text-white/15 text-center mt-10 leading-relaxed">
                Events appear here<br />when services are monitored
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
                      <div className={`w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0 ${LOG_DOT[event.type]}`} />
                      {i < state.log.length - 1 && <div className="w-px flex-1 bg-white/[0.04] my-1" />}
                    </div>
                    <div className="pb-3 min-w-0 flex-1">
                      <p className="text-[11px] text-white/60 leading-snug break-words">{event.action}</p>
                      <p className="text-[10px] text-white/18 mt-0.5 font-mono">{fmtTs(event.ts)}</p>
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
