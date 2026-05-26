"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileCode2, Play, RotateCcw,
  ShieldOff, CheckCircle2, AlertTriangle, Power, Zap,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const USER_COUNT = 100;

// ── Types ──────────────────────────────────────────────────────────────────────
interface FlagConfig {
  name: string;
  enabled: boolean;
  rollout_pct: number;
  kill_switch: boolean;
}

interface LogEntry {
  id: string;
  ts: string;
  msg: string;
  type: "info" | "warn" | "ok" | "kill";
}

type UserVariant = "on" | "off" | "killed" | "disabled";

// ── Deterministic hash (djb2) ──────────────────────────────────────────────────
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function inRollout(userId: number, flagName: string, pct: number): boolean {
  return djb2(`${userId}::${flagName}`) % 100 < pct;
}

function computeCohort(flag: FlagConfig): UserVariant[] {
  return Array.from({ length: USER_COUNT }, (_, i) => {
    if (!flag.enabled) return "disabled";
    if (flag.kill_switch) return "killed";
    return inRollout(i, flag.name, flag.rollout_pct) ? "on" : "off";
  });
}

function countVariants(cohort: UserVariant[]) {
  return {
    on: cohort.filter(v => v === "on").length,
    off: cohort.filter(v => v === "off").length,
    killed: cohort.filter(v => v === "killed").length,
    disabled: cohort.filter(v => v === "disabled").length,
  };
}

// ── YAML parser ────────────────────────────────────────────────────────────────
type ParseResult = { ok: true; flags: FlagConfig[] } | { ok: false; error: string };

function parseYaml(yaml: string): ParseResult {
  const lines = yaml.split("\n");
  const flags: FlagConfig[] = [];
  let cur: Partial<FlagConfig> | null = null;
  let inFlags = false;

  function flush() {
    if (!cur) return;
    if (!cur.name) throw new Error("A flag is missing a name");
    flags.push({
      name: cur.name,
      enabled: cur.enabled ?? true,
      rollout_pct: Math.min(100, Math.max(0, cur.rollout_pct ?? 100)),
      kill_switch: cur.kill_switch ?? false,
    });
    cur = null;
  }

  try {
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (!inFlags) {
        if (/^flags:\s*$/.test(line)) { inFlags = true; continue; }
        continue;
      }
      const nm = line.match(/^\s{2}-\s+name:\s*(.+)/);
      if (nm) { flush(); cur = { name: nm[1].trim().replace(/^["']|["']$/g, "") }; continue; }
      if (!cur) continue;
      const en = line.match(/^\s{4}enabled:\s*(true|false)/);
      if (en) { cur.enabled = en[1] === "true"; continue; }
      const rp = line.match(/^\s{4}rollout_pct:\s*(\d+)/);
      if (rp) { cur.rollout_pct = parseInt(rp[1]); continue; }
      const ks = line.match(/^\s{4}kill_switch:\s*(true|false)/);
      if (ks) { cur.kill_switch = ks[1] === "true"; continue; }
    }
    flush();
    if (!flags.length) return { ok: false, error: "No flags defined under flags:" };
    if (flags.length > 6) return { ok: false, error: "Maximum 6 flags allowed" };
    return { ok: true, flags };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Parse error" };
  }
}

// ── Default YAML ───────────────────────────────────────────────────────────────
const DEFAULT_YAML = `# Switchboard Feature Flags
# Edit rollout_pct and click Apply to watch the cohort grid update

flags:
  - name: new-checkout-flow
    enabled: true
    rollout_pct: 30
    kill_switch: false

  - name: ai-recommendations
    enabled: true
    rollout_pct: 15
    kill_switch: false

  - name: dark-mode-v2
    enabled: true
    rollout_pct: 75
    kill_switch: false

  - name: legacy-payment-api
    enabled: true
    rollout_pct: 100
    kill_switch: true`;

// ── Color palette (one per flag index) ────────────────────────────────────────
const FLAG_PALETTE = [
  { cell: "bg-teal-400",   tabActive: "bg-teal-500/15 border-teal-500/30 text-teal-300",   selectedBorder: "border-teal-500/40",   accent: "rgb(45 212 191)" },
  { cell: "bg-violet-400", tabActive: "bg-violet-500/15 border-violet-500/30 text-violet-300", selectedBorder: "border-violet-500/40", accent: "rgb(167 139 250)" },
  { cell: "bg-amber-400",  tabActive: "bg-amber-500/15 border-amber-500/30 text-amber-300",  selectedBorder: "border-amber-500/40",  accent: "rgb(251 191 36)" },
  { cell: "bg-rose-400",   tabActive: "bg-rose-500/15 border-rose-500/30 text-rose-300",     selectedBorder: "border-rose-500/40",   accent: "rgb(251 113 133)" },
  { cell: "bg-blue-400",   tabActive: "bg-blue-500/15 border-blue-500/30 text-blue-300",     selectedBorder: "border-blue-500/40",   accent: "rgb(96 165 250)" },
  { cell: "bg-orange-400", tabActive: "bg-orange-500/15 border-orange-500/30 text-orange-300", selectedBorder: "border-orange-500/40", accent: "rgb(251 146 60)" },
];

const LOG_DOT: Record<LogEntry["type"], string> = {
  info: "bg-white/25", ok: "bg-teal-400", warn: "bg-amber-400", kill: "bg-red-400",
};

let _lid = 0;
function lid() { return `l${++_lid}`; }
function tsNow() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

// ── Component ──────────────────────────────────────────────────────────────────
export default function SwitchboardPage() {
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [flags, setFlags] = useState<FlagConfig[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<FlagConfig>>>({});
  const [selectedFlagName, setSelectedFlagName] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [evalCount, setEvalCount] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const parsed = parseYaml(yaml);
  const lineCount = yaml.split("\n").length;
  const isApplied = flags.length > 0;

  // Effective flags = base config + UI overrides
  const effectiveFlags = useMemo(() =>
    flags.map(f => ({ ...f, ...overrides[f.name] })),
  [flags, overrides]);

  // Selected flag object
  const selectedFlag = useMemo(() => {
    const name = selectedFlagName ?? effectiveFlags[0]?.name;
    return effectiveFlags.find(f => f.name === name) ?? effectiveFlags[0] ?? null;
  }, [selectedFlagName, effectiveFlags]);

  const selectedIndex = useMemo(() =>
    effectiveFlags.findIndex(f => f.name === selectedFlag?.name),
  [effectiveFlags, selectedFlag]);

  const palette = FLAG_PALETTE[Math.max(0, selectedIndex) % FLAG_PALETTE.length];

  // Cohort for the selected flag
  const cohort = useMemo(() =>
    selectedFlag ? computeCohort(selectedFlag) : [],
  [selectedFlag]);

  const variants = useMemo(() => countVariants(cohort), [cohort]);

  // Stats for all flags (for the summary table)
  const allStats = useMemo(() =>
    effectiveFlags.map(f => ({ ...f, ...countVariants(computeCohort(f)) })),
  [effectiveFlags]);

  // Cosmetic eval counter
  useEffect(() => {
    if (!isApplied) return;
    const id = setInterval(() => setEvalCount(c => c + Math.floor(Math.random() * 80 + 30)), 400);
    return () => clearInterval(id);
  }, [isApplied]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length]);

  function handleApply() {
    if (!parsed.ok) return;
    setFlags(parsed.flags);
    setOverrides({});
    setSelectedFlagName(parsed.flags[0]?.name ?? null);
    setEvalCount(0);
    const entries: LogEntry[] = [
      { id: lid(), ts: tsNow(), msg: `Config applied — ${parsed.flags.length} flag${parsed.flags.length !== 1 ? "s" : ""} registered`, type: "info" },
      ...parsed.flags.map(f => ({
        id: lid(), ts: tsNow(),
        msg: f.kill_switch
          ? `${f.name}: KILL SWITCH active — evaluating false for all users`
          : !f.enabled
          ? `${f.name}: disabled`
          : `${f.name}: ${f.rollout_pct}% rollout — ${computeCohort(f).filter(v => v === "on").length} / ${USER_COUNT} users`,
        type: (f.kill_switch ? "kill" : !f.enabled ? "warn" : "ok") as LogEntry["type"],
      })),
    ];
    setLog(prev => [...prev, ...entries].slice(-60));
  }

  function handleReset() {
    setFlags([]); setOverrides({}); setSelectedFlagName(null);
    setLog([]); setEvalCount(0);
  }

  function setRollout(flagName: string, pct: number) {
    setOverrides(prev => ({ ...prev, [flagName]: { ...prev[flagName], rollout_pct: pct } }));
  }

  function commitRollout(flagName: string, pct: number) {
    const baseFlag = effectiveFlags.find(f => f.name === flagName);
    if (!baseFlag) return;
    const count = computeCohort({ ...baseFlag, rollout_pct: pct }).filter(v => v === "on").length;
    setLog(prev => [...prev, {
      id: lid(), ts: tsNow(),
      msg: `${flagName}: rollout → ${pct}% (${count} / ${USER_COUNT} users)`,
      type: "ok" as const,
    }].slice(-60));
  }

  function toggleKill(flagName: string) {
    const cur = effectiveFlags.find(f => f.name === flagName);
    if (!cur) return;
    const next = !cur.kill_switch;
    setOverrides(prev => ({ ...prev, [flagName]: { ...prev[flagName], kill_switch: next } }));
    setLog(prev => [...prev, {
      id: lid(), ts: tsNow(),
      msg: next
        ? `⚡ KILL SWITCH activated on "${flagName}" — all evaluations → false`
        : `Kill switch cleared on "${flagName}" — rollout restored to ${cur.rollout_pct}%`,
      type: next ? "kill" as const : "ok" as const,
    }].slice(-60));
  }

  function toggleEnabled(flagName: string) {
    const cur = effectiveFlags.find(f => f.name === flagName);
    if (!cur) return;
    const next = !cur.enabled;
    setOverrides(prev => ({ ...prev, [flagName]: { ...prev[flagName], enabled: next } }));
    setLog(prev => [...prev, {
      id: lid(), ts: tsNow(),
      msg: `"${flagName}" ${next ? "enabled" : "disabled"}`,
      type: (next ? "ok" : "warn") as LogEntry["type"],
    }].slice(-60));
  }

  const currentRollout = overrides[selectedFlag?.name ?? ""]?.rollout_pct ?? selectedFlag?.rollout_pct ?? 0;

  return (
    <main className="h-screen overflow-hidden bg-[#080810] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#080810]/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects/switchboard" className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors group">
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-white/[0.07]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Power size={11} className="text-teal-400" />
              </div>
              <span className="font-sora font-bold text-sm">Switchboard</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/20 font-semibold tracking-wide">LIVE DEMO</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isApplied && (
              <span className="hidden sm:block text-[10px] font-mono text-white/20">
                {evalCount.toLocaleString()} evaluations
              </span>
            )}
            <button onClick={handleReset} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/35 hover:text-white/65 transition-all">
              <RotateCcw size={10} />
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* ── Three panels ── */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-[340px_1fr_280px]">

        {/* ── Panel 1: YAML editor ── */}
        <div className="flex flex-col border-r border-white/[0.06] bg-[#06060e] overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <FileCode2 size={12} className="text-teal-400/50" />
              <span className="text-xs font-mono text-white/40">flags.yaml</span>
            </div>
            {parsed.ok ? (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/70">
                <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
                {parsed.flags.length} flag{parsed.flags.length !== 1 ? "s" : ""} · valid
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-red-400/70">
                <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
                parse error
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
              <p className="text-[11px] font-mono text-red-400/90">⚠ {(parsed as { ok: false; error: string }).error}</p>
            </div>
          )}

          <div className="flex-shrink-0 p-3 border-t border-white/[0.05] space-y-3">
            <button
              onClick={handleApply}
              disabled={!parsed.ok}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                parsed.ok
                  ? "bg-teal-700 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/15 active:scale-[0.98]"
                  : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              }`}
            >
              <Play size={12} className={parsed.ok ? "fill-white" : ""} />
              {isApplied ? "Re-apply Config" : "Apply Config"}
            </button>
            {!isApplied && (
              <div className="space-y-1">
                <p className="text-[10px] text-white/20 font-mono mb-1.5">Flag fields:</p>
                {[
                  ["name", "string — unique flag identifier"],
                  ["enabled", "true | false — master on/off switch"],
                  ["rollout_pct", "0–100 — % of users receiving flag"],
                  ["kill_switch", "true — override to false for all users"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start gap-1 text-[10px]">
                    <span className="font-mono text-teal-400/55 flex-shrink-0">{k}:</span>
                    <span className="text-white/20">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel 2: Flag management + cohort grid ── */}
        <div className="overflow-y-auto p-5 lg:p-6">
          {!isApplied ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-20">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <Power size={20} className="text-teal-400/60" />
              </div>
              <div>
                <p className="font-semibold text-white/40 mb-2">No flags applied</p>
                <p className="text-sm text-white/20 max-w-xs leading-relaxed">
                  Define your flags in the editor, then click{" "}
                  <span className="text-teal-400/60 font-medium">Apply Config</span>.
                  The cohort grid shows exactly which users receive each flag.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-white/20 max-w-xs">
                {[
                  { dot: "bg-teal-400/70",     label: "ON — user is in the rollout cohort" },
                  { dot: "bg-white/20",         label: "OFF — user is outside the rollout" },
                  { dot: "bg-red-400/70",        label: "KILLED — kill switch is active" },
                  { dot: "bg-white/[0.06]",      label: "DISABLED — flag is turned off" },
                ].map(({ dot, label }) => (
                  <div key={label} className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-lg mx-auto space-y-5">

              {/* Flag selector tabs */}
              <div className="flex flex-wrap gap-1.5">
                {effectiveFlags.map((f, i) => {
                  const p = FLAG_PALETTE[i % FLAG_PALETTE.length];
                  const isSelected = selectedFlag?.name === f.name;
                  return (
                    <button
                      key={f.name}
                      onClick={() => setSelectedFlagName(f.name)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? p.tabActive
                          : "bg-white/[0.03] border-white/[0.07] text-white/30 hover:text-white/55"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        f.kill_switch ? "bg-red-400" : !f.enabled ? "bg-white/20" : p.cell
                      }`} />
                      {f.name}
                    </button>
                  );
                })}
              </div>

              {/* Selected flag controls */}
              {selectedFlag && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedFlag.name}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border p-4 space-y-4 bg-white/[0.02] ${palette.selectedBorder}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white/85 font-mono">{selectedFlag.name}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {selectedFlag.kill_switch ? "Kill switch active — evaluating false" :
                           !selectedFlag.enabled ? "Disabled" :
                           `${currentRollout}% rollout`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleEnabled(selectedFlag.name)}
                          className={`text-[10px] px-2 py-1 rounded-lg border font-semibold transition-all ${
                            selectedFlag.enabled
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20"
                              : "bg-white/[0.04] border-white/[0.07] text-white/30 hover:text-white/55"
                          }`}
                        >
                          <CheckCircle2 size={9} className="inline mr-1" />
                          {selectedFlag.enabled ? "On" : "Off"}
                        </button>
                        <button
                          onClick={() => toggleKill(selectedFlag.name)}
                          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border font-semibold transition-all ${
                            selectedFlag.kill_switch
                              ? "bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25"
                              : "bg-white/[0.04] border-white/[0.07] text-white/30 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-300"
                          }`}
                        >
                          <ShieldOff size={9} />
                          Kill
                        </button>
                      </div>
                    </div>

                    {/* Rollout slider */}
                    {!selectedFlag.kill_switch && selectedFlag.enabled && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] text-white/40">Rollout percentage</p>
                          <span className="text-sm font-bold font-mono text-white/70">{currentRollout}%</span>
                        </div>
                        <input
                          type="range"
                          min={0} max={100}
                          value={currentRollout}
                          onChange={e => setRollout(selectedFlag.name, parseInt(e.target.value))}
                          onMouseUp={e => commitRollout(selectedFlag.name, parseInt((e.target as HTMLInputElement).value))}
                          onTouchEnd={e => commitRollout(selectedFlag.name, parseInt((e.target as HTMLInputElement).value))}
                          className="w-full h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer"
                          style={{ accentColor: palette.accent }}
                        />
                        <div className="flex justify-between text-[9px] text-white/15 mt-1 font-mono">
                          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                        </div>
                      </div>
                    )}

                    {/* Variant stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "ON", value: variants.on, cls: palette.cell.replace("bg-", "text-") },
                        { label: "OFF", value: variants.off, cls: "text-white/30" },
                        { label: "INACTIVE", value: variants.killed + variants.disabled, cls: "text-red-400" },
                      ].map(({ label, value, cls }) => (
                        <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2.5 text-center">
                          <p className={`text-lg font-bold font-mono tabular-nums ${cls}`}>{value}</p>
                          <p className="text-[9px] text-white/25">{label}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* User cohort grid — 10×10 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-white/40">User Cohort — {USER_COUNT} simulated users</p>
                  <p className="text-[10px] text-white/20 font-mono">{variants.on} receiving flag</p>
                </div>
                <div className="grid grid-cols-10 gap-1.5">
                  {cohort.map((variant, i) => (
                    <motion.div
                      key={i}
                      layout
                      animate={{ opacity: variant === "disabled" ? 0.12 : variant === "off" ? 0.22 : 1 }}
                      transition={{ duration: 0.15, delay: i * 0.002 }}
                      className={`h-6 rounded-md transition-colors duration-150 ${
                        variant === "on"       ? palette.cell :
                        variant === "killed"   ? "bg-red-500/60" :
                        variant === "disabled" ? "bg-white/[0.04]" :
                        "bg-white/[0.08]"
                      }`}
                      title={`User #${i}: ${variant}`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-white/15 mt-2">
                  Deterministic assignment — same user always gets the same flag result
                </p>
              </div>

              {/* All flags summary */}
              <div>
                <p className="text-xs font-semibold text-white/40 mb-3">All Flags</p>
                <div className="space-y-1.5">
                  {allStats.map((f, i) => {
                    const p = FLAG_PALETTE[i % FLAG_PALETTE.length];
                    return (
                      <button
                        key={f.name}
                        onClick={() => setSelectedFlagName(f.name)}
                        className="w-full flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] px-3 py-2.5 transition-all"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          f.kill_switch ? "bg-red-400" : !f.enabled ? "bg-white/20" : p.cell
                        }`} />
                        <span className="text-xs font-mono text-white/60 flex-1 text-left truncate">{f.name}</span>
                        {f.kill_switch && <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />}
                        {f.kill_switch && <span className="text-[9px] text-red-400 font-semibold">KILLED</span>}
                        {!f.enabled && !f.kill_switch && <span className="text-[9px] text-white/25 font-semibold">DISABLED</span>}
                        {f.enabled && !f.kill_switch && (
                          <>
                            <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className={`h-full rounded-full ${p.cell}`} style={{ width: `${f.rollout_pct}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-white/30 w-6 text-right tabular-nums">{f.on}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Panel 3: Evaluation log ── */}
        <div className="flex flex-col bg-[#050510] border-l border-white/[0.05] overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/55">Evaluation Log</p>
              <p className="text-[10px] text-white/20 mt-0.5">Flag change history</p>
            </div>
            <Zap size={11} className="text-teal-400/40" />
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3">
            {log.length === 0 ? (
              <p className="text-[11px] text-white/15 text-center mt-10 leading-relaxed">
                Changes appear here<br />after applying config
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {log.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex gap-2.5"
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0 ${LOG_DOT[entry.type]}`} />
                      {i < log.length - 1 && <div className="w-px flex-1 bg-white/[0.04] my-1" />}
                    </div>
                    <div className="pb-3 min-w-0 flex-1">
                      <p className="text-[11px] text-white/60 leading-snug break-words">{entry.msg}</p>
                      <p className="text-[10px] text-white/[0.18] mt-0.5 font-mono">{entry.ts}</p>
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
