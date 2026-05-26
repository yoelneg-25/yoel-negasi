"use client";

import { useReducer, useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Play, Pause, RotateCcw, FileCode2, Zap,
  Activity, AlertTriangle, Server, TrendingUp,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  CartesianGrid,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ClusterConfig {
  name: string;
  replicas: number;
  rps_limit: number;
  latency_target_ms: number;
  error_budget_pct: number;
  autoscale_threshold: number;
  autoscale_max: number;
}

interface ReplicaState {
  id: number;
  utilization: number; // 0-100
  status: "healthy" | "degraded" | "down";
  latencyOffset: number; // injected extra latency
}

interface Tick {
  t: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  replicas: number;
  sloBudgetPct: number;
}

interface State {
  phase: "idle" | "running" | "paused";
  config: ClusterConfig | null;
  replicas: ReplicaState[];
  history: Tick[];
  tick: number;
  sloBudgetRemaining: number; // 0-100
  activeIncident: string | null;
  incidentTicks: number;
  log: { id: string; ts: string; msg: string; type: "info" | "warn" | "crit" | "ok" }[];
}

type Action =
  | { type: "START"; config: ClusterConfig }
  | { type: "TICK"; seed: number[] }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "INCIDENT_SURGE" }
  | { type: "INCIDENT_LATENCY" }
  | { type: "INCIDENT_KILL" }
  | { type: "RESET" };

// ── Simulation math ────────────────────────────────────────────────────────────
function baseRps(tick: number, config: ClusterConfig): number {
  // Slow ramp + sine wave pattern
  const ramp = Math.min(1, tick / 20);
  const base = config.rps_limit * config.replicas * 0.55 * ramp;
  const wave = Math.sin(tick * 0.18) * config.rps_limit * 0.15;
  return Math.max(0, base + wave);
}

function calcLatency(utilization: number, targetMs: number, extraMs: number, seed: number): { p50: number; p95: number; p99: number } {
  // Little's Law approximation: latency climbs exponentially above 80% util
  const u = Math.min(utilization / 100, 0.999);
  const factor = 1 / (1 - u);
  const p50 = targetMs * 0.5 * factor + seed * 5;
  const p95 = p50 * 1.8 + extraMs;
  const p99 = p50 * 3.2 + extraMs * 1.5 + seed * 8;
  return { p50: Math.round(p50), p95: Math.round(p95), p99: Math.round(p99) };
}

function calcErrorRate(totalRps: number, capacity: number, seed: number): number {
  if (totalRps <= capacity) return Math.max(0, seed * 0.3);
  const overload = (totalRps - capacity) / capacity;
  return Math.min(25, overload * 40 + seed * 1.5);
}

let _lid = 0;
function lid() { return `e${++_lid}`; }
function tsNow() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

const INIT: State = {
  phase: "idle", config: null, replicas: [], history: [], tick: 0,
  sloBudgetRemaining: 100, activeIncident: null, incidentTicks: 0,
  log: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START": {
      const c = action.config;
      const replicas: ReplicaState[] = Array.from({ length: c.replicas }, (_, i) => ({
        id: i, utilization: 0, status: "healthy", latencyOffset: 0,
      }));
      return {
        ...INIT, phase: "running", config: c, replicas, tick: 0, sloBudgetRemaining: 100,
        log: [{ id: lid(), ts: tsNow(), msg: `Cluster "${c.name}" started — ${c.replicas} replica${c.replicas > 1 ? "s" : ""} online`, type: "info" }],
      };
    }

    case "TICK": {
      if (state.phase !== "running" || !state.config) return state;
      const c = state.config;
      const [s0, s1, s2, s3] = action.seed;
      const t = state.tick + 1;
      const newLog = [...state.log];

      let replicas = state.replicas.map(r => ({ ...r }));
      let incidentTicks = state.incidentTicks > 0 ? state.incidentTicks - 1 : 0;
      let activeIncident = incidentTicks > 0 ? state.activeIncident : null;

      // Clear incident effects when done
      if (state.incidentTicks === 1) {
        if (state.activeIncident === "surge") {
          newLog.push({ id: lid(), ts: tsNow(), msg: "Traffic surge subsided — RPS returning to baseline", type: "ok" });
        }
        if (state.activeIncident === "latency") {
          replicas = replicas.map(r => ({ ...r, latencyOffset: 0 }));
          newLog.push({ id: lid(), ts: tsNow(), msg: "Latency spike resolved — all replicas nominal", type: "ok" });
        }
      }

      const surgeMultiplier = activeIncident === "surge" ? 2.8 : 1;
      const totalRps = baseRps(t, c) * surgeMultiplier + s0 * c.rps_limit * 0.05;
      const activeReplicas = replicas.filter(r => r.status !== "down");
      const capacity = activeReplicas.length * c.rps_limit;
      const perReplicaRps = activeReplicas.length > 0 ? totalRps / activeReplicas.length : totalRps;

      // Update utilization per replica
      replicas = replicas.map(r => {
        if (r.status === "down") return r;
        const util = Math.min(100, (perReplicaRps / c.rps_limit) * 100 + s1 * 5);
        const status: ReplicaState["status"] = util > 90 ? "degraded" : "healthy";
        return { ...r, utilization: Math.round(util), status };
      });

      // Autoscale
      const avgUtil = activeReplicas.length > 0
        ? replicas.filter(r => r.status !== "down").reduce((s, r) => s + r.utilization, 0) / activeReplicas.length
        : 100;

      let didAutoscale = false;
      if (avgUtil > c.autoscale_threshold && replicas.length < c.autoscale_max) {
        const newId = replicas.length;
        replicas.push({ id: newId, utilization: 0, status: "healthy", latencyOffset: 0 });
        newLog.push({ id: lid(), ts: tsNow(), msg: `Autoscale triggered — replica #${newId} added (util: ${Math.round(avgUtil)}%)`, type: "warn" });
        didAutoscale = true;
      }
      void didAutoscale;

      const extraLatency = replicas.reduce((m, r) => Math.max(m, r.latencyOffset), 0);
      const avgUtil2 = replicas.filter(r => r.status !== "down").reduce((s, r) => s + r.utilization, 0) / Math.max(1, replicas.filter(r => r.status !== "down").length);
      const { p50, p95, p99 } = calcLatency(avgUtil2, c.latency_target_ms, extraLatency, s2);
      const errorRate = parseFloat(calcErrorRate(totalRps, capacity, s3).toFixed(2));

      // SLO burn
      let sloBudget = state.sloBudgetRemaining;
      const sloBreached = p99 > c.latency_target_ms || errorRate > c.error_budget_pct;
      if (sloBreached) {
        sloBudget = Math.max(0, sloBudget - (errorRate > c.error_budget_pct ? 1.5 : 0.8));
        if (Math.round(sloBudget) % 10 === 0 && Math.round(sloBudget) !== Math.round(state.sloBudgetRemaining)) {
          newLog.push({ id: lid(), ts: tsNow(), msg: `SLO budget at ${Math.round(sloBudget)}% — p99 ${p99}ms > target ${c.latency_target_ms}ms`, type: "crit" });
        }
      } else {
        sloBudget = Math.min(100, sloBudget + 0.2);
      }

      const tick: Tick = {
        t, rps: Math.round(totalRps), p50, p95, p99, errorRate,
        replicas: replicas.filter(r => r.status !== "down").length,
        sloBudgetPct: Math.round(sloBudget),
      };

      const history = [...state.history, tick].slice(-40);

      return {
        ...state, replicas, history, tick: t,
        sloBudgetRemaining: sloBudget,
        activeIncident, incidentTicks,
        log: newLog.slice(-50),
      };
    }

    case "PAUSE": return { ...state, phase: "paused" };
    case "RESUME": return { ...state, phase: "running" };

    case "INCIDENT_SURGE": {
      if (!state.config) return state;
      return {
        ...state,
        activeIncident: "surge", incidentTicks: 15,
        log: [...state.log, { id: lid(), ts: tsNow(), msg: "⚡ Traffic surge injected — 2.8x RPS for 15 ticks", type: "crit" as const }].slice(-50),
      };
    }

    case "INCIDENT_LATENCY": {
      if (!state.config) return state;
      const target = state.replicas.find(r => r.status !== "down");
      if (!target) return state;
      const replicas = state.replicas.map(r =>
        r.id === target.id ? { ...r, latencyOffset: 300 } : r
      );
      return {
        ...state, replicas,
        activeIncident: "latency", incidentTicks: 12,
        log: [...state.log, { id: lid(), ts: tsNow(), msg: `⚡ Latency spike on replica #${target.id} — +300ms injected`, type: "crit" as const }].slice(-50),
      };
    }

    case "INCIDENT_KILL": {
      const alive = state.replicas.filter(r => r.status !== "down");
      if (alive.length <= 1) return state;
      const victim = alive[Math.floor(alive.length / 2)];
      const replicas = state.replicas.map(r =>
        r.id === victim.id ? { ...r, status: "down" as const, utilization: 0 } : r
      );
      return {
        ...state, replicas,
        log: [...state.log, { id: lid(), ts: tsNow(), msg: `⚡ Instance #${victim.id} killed — load redistributing to ${alive.length - 1} replica${alive.length - 1 > 1 ? "s" : ""}`, type: "crit" as const }].slice(-50),
      };
    }

    case "RESET": return INIT;
  }
}

// ── YAML parser ────────────────────────────────────────────────────────────────
type ParseResult = { ok: true; config: ClusterConfig } | { ok: false; error: string };

function parseYaml(yaml: string): ParseResult {
  const get = (key: string, str: boolean = false): string | undefined => {
    const m = yaml.match(new RegExp(`^\\s*${key}:\\s*(.+)`, "m"));
    if (!m) return undefined;
    return m[1].trim().replace(/^["']|["']$/g, "");
  };

  try {
    const name = get("name") ?? "my-cluster";
    const replicas = parseInt(get("replicas") ?? "3");
    const rps_limit = parseInt(get("rps_limit") ?? "500");
    const latency_target_ms = parseInt(get("latency_target_ms") ?? "200");
    const error_budget_pct = parseFloat(get("error_budget_pct") ?? "0.5");
    const autoscale_threshold = parseInt(get("autoscale_threshold") ?? "80");
    const autoscale_max = parseInt(get("autoscale_max") ?? "8");

    if (isNaN(replicas) || replicas < 1 || replicas > 8) return { ok: false, error: "replicas must be 1–8" };
    if (isNaN(rps_limit) || rps_limit < 100) return { ok: false, error: "rps_limit must be ≥ 100" };
    if (isNaN(latency_target_ms) || latency_target_ms < 10) return { ok: false, error: "latency_target_ms must be ≥ 10" };
    if (isNaN(autoscale_threshold) || autoscale_threshold < 50 || autoscale_threshold > 100) return { ok: false, error: "autoscale_threshold must be 50–100" };
    if (isNaN(autoscale_max) || autoscale_max < replicas) return { ok: false, error: "autoscale_max must be ≥ replicas" };

    return { ok: true, config: { name, replicas, rps_limit, latency_target_ms, error_budget_pct, autoscale_threshold, autoscale_max } };
  } catch {
    return { ok: false, error: "Parse error — check your YAML" };
  }
}

const DEFAULT_YAML = `# SurgeBoard Cluster Config
# Edit values, then click Start to run the simulation

cluster:
  name: api-gateway
  replicas: 3
  rps_limit: 800        # max RPS per replica
  latency_target_ms: 150  # p99 SLO target
  error_budget_pct: 0.5   # max error rate %
  autoscale_threshold: 78 # % utilization to trigger autoscale
  autoscale_max: 8        # max replicas autoscaler can add`;

// ── Custom tooltip ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0e0e1a] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white/35 mb-1 font-mono">t={label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.value}{unit ?? ""}
        </p>
      ))}
    </div>
  );
}

const STATUS_COLORS = { healthy: "#10b981", degraded: "#f59e0b", down: "#ef4444" };
const REPLICA_UTIL_BG = (util: number) =>
  util > 90 ? "bg-red-500" : util > 75 ? "bg-amber-500" : util > 50 ? "bg-orange-400" : "bg-emerald-500";

// ── Component ──────────────────────────────────────────────────────────────────
export default function SurgeBoardPage() {
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [state, dispatch] = useReducer(reducer, INIT);
  const logRef = useRef<HTMLDivElement>(null);

  const parsed = parseYaml(yaml);
  const lineCount = yaml.split("\n").length;

  useEffect(() => {
    if (state.phase !== "running") return;
    const id = setInterval(() => {
      dispatch({ type: "TICK", seed: Array.from({ length: 4 }, () => Math.random()) });
    }, 800);
    return () => clearInterval(id);
  }, [state.phase]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.log.length]);

  const handleStart = useCallback(() => {
    if (!parsed.ok) return;
    dispatch({ type: "START", config: parsed.config });
  }, [parsed]);

  const latest = state.history[state.history.length - 1];
  const sloColor = state.sloBudgetRemaining > 60 ? "text-emerald-400" : state.sloBudgetRemaining > 25 ? "text-amber-400" : "text-red-400";
  const sloBg = state.sloBudgetRemaining > 60 ? "bg-emerald-500" : state.sloBudgetRemaining > 25 ? "bg-amber-500" : "bg-red-500";

  return (
    <main className="h-screen overflow-hidden bg-[#080810] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#080810]/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects/surgeboard" className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors group">
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-white/[0.07]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <Activity size={11} className="text-orange-400" />
              </div>
              <span className="font-sora font-bold text-sm">SurgeBoard</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/20 font-semibold tracking-wide">LIVE DEMO</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {state.phase !== "idle" && latest && (
              <div className="hidden sm:flex items-center gap-3 text-xs text-white/30">
                <span>{latest.rps} rps</span>
                <span>p99 {latest.p99}ms</span>
                <span className={sloColor}>SLO {Math.round(state.sloBudgetRemaining)}%</span>
              </div>
            )}
            {state.phase === "running" && (
              <div className="flex items-center gap-2">
                <button onClick={() => dispatch({ type: "INCIDENT_SURGE" })} disabled={!!state.activeIncident} className="text-[10px] px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 font-semibold disabled:opacity-30 transition-all">⚡ Surge</button>
                <button onClick={() => dispatch({ type: "INCIDENT_LATENCY" })} disabled={!!state.activeIncident} className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 font-semibold disabled:opacity-30 transition-all">⚡ Latency</button>
                <button onClick={() => dispatch({ type: "INCIDENT_KILL" })} className="text-[10px] px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-300 font-semibold transition-all">⚡ Kill</button>
              </div>
            )}
            {state.phase === "running" && <button onClick={() => dispatch({ type: "PAUSE" })} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/35 hover:text-white/65 transition-all"><Pause size={10} />Pause</button>}
            {state.phase === "paused" && <button onClick={() => dispatch({ type: "RESUME" })} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 transition-all"><Play size={10} />Resume</button>}
            <button onClick={() => dispatch({ type: "RESET" })} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/35 hover:text-white/65 transition-all"><RotateCcw size={10} />Reset</button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden grid lg:grid-cols-[340px_1fr_260px]">

        {/* ── Panel 1: Cluster Config ── */}
        <div className="flex flex-col border-r border-white/[0.06] bg-[#06060e] overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <FileCode2 size={12} className="text-orange-400/50" />
              <span className="text-xs font-mono text-white/40">cluster.yaml</span>
            </div>
            {parsed.ok ? (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/70">
                <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />valid
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-red-400/70">
                <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />error
              </span>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative min-h-0">
            <div aria-hidden className="absolute left-0 top-0 bottom-0 w-9 flex flex-col items-end pt-4 pb-4 pr-2 bg-[#04040b] border-r border-white/[0.04] z-10 pointer-events-none select-none overflow-hidden">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-[10px] font-mono text-white/[0.1] leading-5 flex-shrink-0">{i + 1}</div>
              ))}
            </div>
            <textarea
              value={yaml}
              onChange={e => setYaml(e.target.value)}
              spellCheck={false}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-[12px] text-white/70 leading-5 pl-12 pr-4 pt-4 pb-4 outline-none overflow-y-auto"
              style={{ fontFamily: '"Fira Code", "JetBrains Mono", ui-monospace, monospace' }}
            />
          </div>

          {!parsed.ok && (
            <div className="flex-shrink-0 px-4 py-2.5 border-t border-red-500/20 bg-red-500/[0.05]">
              <p className="text-[11px] font-mono text-red-400/90">⚠ {parsed.error}</p>
            </div>
          )}

          <div className="flex-shrink-0 p-3 border-t border-white/[0.05] space-y-3">
            <button
              onClick={handleStart}
              disabled={!parsed.ok}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                parsed.ok
                  ? "bg-orange-700 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/15 active:scale-[0.98]"
                  : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              }`}
            >
              <Play size={12} className={parsed.ok ? "fill-white" : ""} />
              {state.phase === "idle" ? "Start Simulation" : "Restart with New Config"}
            </button>

            {/* Replica health grid */}
            {state.replicas.length > 0 && (
              <div>
                <p className="text-[10px] text-white/25 mb-2 font-mono">Replica health</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {state.replicas.map(r => (
                    <div key={r.id} className="flex flex-col items-center gap-1">
                      <div className={`w-full rounded-md p-2 border text-center ${
                        r.status === "down" ? "border-red-500/30 bg-red-500/10" :
                        r.status === "degraded" ? "border-amber-500/30 bg-amber-500/10" :
                        "border-emerald-500/20 bg-emerald-500/[0.05]"
                      }`}>
                        <Server size={10} className="mx-auto mb-1" style={{ color: STATUS_COLORS[r.status] }} />
                        <p className="text-[9px] font-mono" style={{ color: STATUS_COLORS[r.status] }}>
                          {r.status === "down" ? "DOWN" : `${r.utilization}%`}
                        </p>
                      </div>
                      {/* Util bar */}
                      {r.status !== "down" && (
                        <div className="w-full h-1 rounded-full bg-white/[0.05] overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${REPLICA_UTIL_BG(r.utilization)}`}
                            animate={{ width: `${r.utilization}%` }}
                            transition={{ duration: 0.4 }}
                          />
                        </div>
                      )}
                      <p className="text-[9px] text-white/25 font-mono">#{r.id}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Panel 2: Charts ── */}
        <div className="overflow-y-auto p-5 lg:p-6 space-y-5">
          {state.phase === "idle" ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-20">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-orange-400/60" />
              </div>
              <div>
                <p className="font-semibold text-white/40 mb-2">Simulation not running</p>
                <p className="text-sm text-white/20 max-w-xs leading-relaxed">
                  Configure your cluster in the editor, then click{" "}
                  <span className="text-orange-400/60 font-medium">Start Simulation</span>.
                  Charts update every tick.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-white/20 max-w-xs">
                {["⚡ Surge — 2.8x traffic spike for 15 ticks", "⚡ Latency — inject 300ms on one replica", "⚡ Kill — take one instance offline"].map(s => (
                  <div key={s} className="bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">{s}</div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* SLO Budget bar */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-white/50">SLO Error Budget</p>
                  <span className={`text-sm font-bold font-mono ${sloColor}`}>{Math.round(state.sloBudgetRemaining)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${sloBg} transition-colors duration-500`}
                    animate={{ width: `${state.sloBudgetRemaining}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-white/20">
                  <span>Budget burned when p99 &gt; {state.config?.latency_target_ms}ms or errors &gt; {state.config?.error_budget_pct}%</span>
                  <span>{state.tick} ticks</span>
                </div>
              </div>

              {/* Throughput chart */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs font-semibold text-white/50 mb-3">Throughput (req/s)</p>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={state.history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="t" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip unit=" rps" />} />
                    {state.config && (
                      <ReferenceLine y={state.config.rps_limit * state.replicas.filter(r => r.status !== "down").length} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.4} />
                    )}
                    <Area type="monotone" dataKey="rps" name="RPS" stroke="#f97316" strokeWidth={1.5} fill="url(#rpsGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Latency percentiles */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-white/50">Latency (ms)</p>
                  <div className="flex gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-emerald-400 inline-block rounded" />p50</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-amber-400 inline-block rounded" />p95</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-red-400 inline-block rounded" />p99</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={state.history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="t" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip unit="ms" />} />
                    {state.config && (
                      <ReferenceLine y={state.config.latency_target_ms} stroke="#f97316" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: "SLO", fill: "#f97316", fontSize: 9, position: "insideTopRight" }} />
                    )}
                    <Line type="monotone" dataKey="p50" name="p50" stroke="#10b981" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="p95" name="p95" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="p99" name="p99" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Error rate */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs font-semibold text-white/50 mb-3">Error Rate (%)</p>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={state.history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="t" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip unit="%" />} />
                    {state.config && (
                      <ReferenceLine y={state.config.error_budget_pct} stroke="#f97316" strokeDasharray="4 3" strokeOpacity={0.5} />
                    )}
                    <Bar dataKey="errorRate" name="Error Rate" fill="#ef4444" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Active incident banner */}
              <AnimatePresence>
                {state.activeIncident && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3 flex items-center gap-2.5">
                    <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-300 font-semibold">
                      {state.activeIncident === "surge" ? "Traffic surge active" :
                       state.activeIncident === "latency" ? "Latency spike active" : "Instance down"}
                      {" "}— {state.incidentTicks} ticks remaining
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* ── Panel 3: Event Log ── */}
        <div className="flex flex-col bg-[#050510] border-l border-white/[0.05] overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/55">Event Log</p>
              <p className="text-[10px] text-white/20 mt-0.5">Cluster activity stream</p>
            </div>
            <Zap size={11} className="text-orange-400/40" />
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3">
            {state.log.length === 0 ? (
              <p className="text-[11px] text-white/15 text-center mt-10 leading-relaxed">Events appear<br />when simulation runs</p>
            ) : (
              <AnimatePresence initial={false}>
                {state.log.map((e, i) => (
                  <motion.div key={e.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className="flex gap-2.5">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0 ${
                        e.type === "crit" ? "bg-red-400" : e.type === "warn" ? "bg-amber-400" : e.type === "ok" ? "bg-emerald-400" : "bg-white/25"
                      }`} />
                      {i < state.log.length - 1 && <div className="w-px flex-1 bg-white/[0.04] my-1" />}
                    </div>
                    <div className="pb-3 min-w-0 flex-1">
                      <p className="text-[11px] text-white/60 leading-snug break-words">{e.msg}</p>
                      <p className="text-[10px] text-white/18 mt-0.5 font-mono">{e.ts}</p>
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
