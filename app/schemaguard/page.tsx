"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Play, RotateCcw, FileCode2, CheckCircle2,
  XCircle, AlertTriangle, ShieldCheck, Zap, ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type RiskLevel = "SAFE" | "WARNING" | "BREAKING";
type ApprovalStatus = "pending" | "approved" | "rejected";

interface Operation {
  id: string;
  table: string;
  op: string;
  column?: string;
  detail: string;
  risk: RiskLevel;
  affectedServices: string[];
}

interface Approval {
  service: string;
  status: ApprovalStatus;
  actor?: string;
}

interface AnalysisResult {
  operations: Operation[];
  approvals: Approval[];
  canApply: boolean;
  blockedBy: string[];
}

interface LogEntry {
  id: string;
  ts: string;
  action: string;
  type: "system" | "safe" | "warning" | "breaking" | "approved" | "rejected" | "applied";
}

// ── YAML parser ────────────────────────────────────────────────────────────────
type ParseResult = { ok: true; ops: ParsedOp[] } | { ok: false; error: string };

interface ParsedOp {
  table: string;
  op: string;
  column?: string;
  detail?: string;
}

function parseYaml(yaml: string): ParseResult {
  const lines = yaml.split("\n");
  const ops: ParsedOp[] = [];
  let cur: Partial<ParsedOp> | null = null;
  let inChanges = false;

  function flush() {
    if (!cur) return;
    if (!cur.table) throw new Error("A change is missing the table field");
    if (!cur.op) throw new Error(`"${cur.table}": missing op field`);
    const validOps = ["add_column", "drop_column", "rename_column", "change_type", "add_index", "drop_index", "add_table", "drop_table"];
    if (!validOps.includes(cur.op)) throw new Error(`"${cur.op}" is not a valid op. Use: ${validOps.slice(0, 4).join(", ")}...`);
    ops.push({ table: cur.table, op: cur.op, column: cur.column, detail: cur.detail });
    cur = null;
  }

  try {
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (!inChanges) {
        if (/^changes:\s*$/.test(line)) { inChanges = true; continue; }
        continue;
      }
      const nm = line.match(/^\s{2}-\s+table:\s*(.+)/);
      if (nm) { flush(); cur = { table: nm[1].trim().replace(/^["']|["']$/g, "") }; continue; }
      if (!cur) continue;
      const op = line.match(/^\s{4}op:\s*(.+)/);
      if (op) { cur.op = op[1].trim().replace(/^["']|["']$/g, ""); continue; }
      const col = line.match(/^\s{4}column:\s*(.+)/);
      if (col) { cur.column = col[1].trim().replace(/^["']|["']$/g, ""); continue; }
      const det = line.match(/^\s{4}detail:\s*(.+)/);
      if (det) { cur.detail = det[1].trim().replace(/^["']|["']$/g, ""); continue; }
    }
    flush();
    if (!ops.length) return { ok: false, error: "No changes defined under changes:" };
    if (ops.length > 10) return { ok: false, error: "Maximum 10 changes per proposal" };
    return { ok: true, ops };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Parse error" };
  }
}

// ── Rule engine ────────────────────────────────────────────────────────────────
// Simulated service dependency registry
const SERVICE_DEPS: Record<string, Record<string, string[]>> = {
  users:    { user_id: ["auth-service", "payment-api", "notification-worker"], email: ["auth-service", "crm-sync"], created_at: ["reporting-service"] },
  orders:   { order_id: ["payment-api", "fulfillment-service"], status: ["notification-worker", "reporting-service"], total: ["payment-api", "reporting-service"] },
  payments: { amount: ["reporting-service", "finance-api"], status: ["notification-worker"], transaction_id: ["audit-service"] },
  products: { price: ["storefront-api", "reporting-service"], stock: ["fulfillment-service"] },
};

function getRisk(op: string): RiskLevel {
  if (["drop_column", "drop_table", "rename_column"].includes(op)) return "BREAKING";
  if (["change_type"].includes(op)) return "WARNING";
  return "SAFE";
}

function getAffectedServices(table: string, column?: string): string[] {
  const tableMap = SERVICE_DEPS[table];
  if (!tableMap) return [];
  if (!column) return [...new Set(Object.values(tableMap).flat())];
  return tableMap[column] ?? [];
}

function analyzeProposal(ops: ParsedOp[]): AnalysisResult {
  const operations: Operation[] = ops.map((op, i) => ({
    id: `op${i}`,
    table: op.table,
    op: op.op,
    column: op.column,
    detail: op.detail ?? (op.column ? `${op.op.replace(/_/g, " ")} on ${op.table}.${op.column}` : `${op.op.replace(/_/g, " ")} on ${op.table}`),
    risk: getRisk(op.op),
    affectedServices: getAffectedServices(op.table, op.column),
  }));

  // Collect all unique services that need to approve breaking changes
  const breakingOps = operations.filter(o => o.risk === "BREAKING");
  const requireApproval = [...new Set(breakingOps.flatMap(o => o.affectedServices))];

  const approvals: Approval[] = requireApproval.map(svc => ({
    service: svc,
    status: "pending",
  }));

  const canApply = approvals.length === 0;
  const blockedBy = approvals.filter(a => a.status === "pending").map(a => a.service);

  return { operations, approvals, canApply, blockedBy };
}

// ── Default YAML ───────────────────────────────────────────────────────────────
const DEFAULT_YAML = `# SchemaGuard Migration Proposal
# Each change is analyzed against the rule engine
# and cross-referenced with the service dependency map

changes:
  - table: users
    op: add_column
    column: phone_verified
    detail: "Add boolean flag for phone verification status"

  - table: orders
    op: drop_column
    column: legacy_ref_id
    detail: "Remove deprecated legacy reference column"

  - table: users
    op: rename_column
    column: email
    detail: "Rename email to primary_email for consistency"

  - table: products
    op: add_index
    column: price
    detail: "Add index for price range queries"`;

// ── Style maps ─────────────────────────────────────────────────────────────────
const RISK_STYLES: Record<RiskLevel, {
  border: string; bg: string; badge: string; dot: string; icon: React.ReactNode;
}> = {
  SAFE:     { border: "border-emerald-500/30", bg: "bg-emerald-500/[0.04]", badge: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25", dot: "bg-emerald-400", icon: <CheckCircle2 size={13} /> },
  WARNING:  { border: "border-amber-500/30",   bg: "bg-amber-500/[0.04]",   badge: "text-amber-300 bg-amber-500/15 border-amber-500/25",       dot: "bg-amber-400",  icon: <AlertTriangle size={13} /> },
  BREAKING: { border: "border-red-500/35",     bg: "bg-red-500/[0.05]",     badge: "text-red-300 bg-red-500/15 border-red-500/25",             dot: "bg-red-400",    icon: <XCircle size={13} /> },
};

const LOG_DOT: Record<LogEntry["type"], string> = {
  system: "bg-white/25", safe: "bg-emerald-400", warning: "bg-amber-400",
  breaking: "bg-red-400", approved: "bg-emerald-400", rejected: "bg-red-400", applied: "bg-cyan-400",
};

function fmtTs(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
let _lid = 0;
function lid() { return `l${++_lid}`; }
function tsNow() { return new Date().toISOString(); }

const OP_LABELS: Record<string, string> = {
  add_column: "ADD COLUMN", drop_column: "DROP COLUMN", rename_column: "RENAME COLUMN",
  change_type: "CHANGE TYPE", add_index: "ADD INDEX", drop_index: "DROP INDEX",
  add_table: "ADD TABLE", drop_table: "DROP TABLE",
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function SchemaGuardPage() {
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [applied, setApplied] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const parsed = parseYaml(yaml);
  const isValid = parsed.ok;
  const opCount = parsed.ok ? parsed.ops.length : 0;
  const lineCount = yaml.split("\n").length;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length]);

  function handleAnalyze() {
    if (!parsed.ok) return;
    const r = analyzeProposal(parsed.ops);
    setResult(r);
    setApprovals(r.approvals.map(a => ({ ...a })));
    setApplied(false);

    const newLog: LogEntry[] = [
      { id: lid(), ts: tsNow(), action: `Proposal analyzed — ${r.operations.length} change${r.operations.length !== 1 ? "s" : ""}`, type: "system" },
    ];
    for (const op of r.operations) {
      newLog.push({
        id: lid(), ts: tsNow(),
        action: `${OP_LABELS[op.op] ?? op.op}: ${op.table}${op.column ? `.${op.column}` : ""} → ${op.risk}${op.affectedServices.length > 0 ? ` (affects: ${op.affectedServices.join(", ")})` : ""}`,
        type: op.risk.toLowerCase() as LogEntry["type"],
      });
    }
    if (r.approvals.length > 0) {
      newLog.push({ id: lid(), ts: tsNow(), action: `Approval required from: ${r.approvals.map(a => a.service).join(", ")}`, type: "breaking" });
    } else {
      newLog.push({ id: lid(), ts: tsNow(), action: "No breaking changes — migration cleared for application", type: "safe" });
    }
    setLog(prev => [...prev, ...newLog]);
  }

  function handleApprove(service: string) {
    const actor = `${service.split("-")[0]}-team@company.com`;
    setApprovals(prev => prev.map(a => a.service === service ? { ...a, status: "approved", actor } : a));
    setLog(prev => [...prev, { id: lid(), ts: tsNow(), action: `Approved by ${actor} — ${service} sign-off received`, type: "approved" }]);
  }

  function handleReject(service: string) {
    const actor = `${service.split("-")[0]}-team@company.com`;
    setApprovals(prev => prev.map(a => a.service === service ? { ...a, status: "rejected", actor } : a));
    setLog(prev => [...prev, { id: lid(), ts: tsNow(), action: `Rejected by ${actor} — migration blocked by ${service}`, type: "rejected" }]);
  }

  function handleApply() {
    setApplied(true);
    setLog(prev => [...prev,
      { id: lid(), ts: tsNow(), action: "Migration applied to production database", type: "applied" },
      { id: lid(), ts: tsNow(), action: "Rollback migration auto-generated and stored in registry", type: "system" },
    ]);
  }

  function handleReset() {
    setResult(null);
    setApprovals([]);
    setLog([]);
    setApplied(false);
  }

  const pendingApprovals = approvals.filter(a => a.status === "pending");
  const rejectedApprovals = approvals.filter(a => a.status === "rejected");
  const allApproved = approvals.length > 0 && approvals.every(a => a.status === "approved");
  const isRejected = rejectedApprovals.length > 0;
  const canApply = result !== null && !applied && !isRejected && (result.approvals.length === 0 || allApproved);

  const breakingCount = result?.operations.filter(o => o.risk === "BREAKING").length ?? 0;
  const warningCount = result?.operations.filter(o => o.risk === "WARNING").length ?? 0;
  const safeCount = result?.operations.filter(o => o.risk === "SAFE").length ?? 0;

  return (
    <main className="h-screen overflow-hidden bg-[#080810] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#080810]/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects/schemaguard" className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors group">
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-white/[0.07]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <ShieldCheck size={11} className="text-cyan-400" />
              </div>
              <span className="font-sora font-bold text-sm">SchemaGuard</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 font-semibold tracking-wide">LIVE DEMO</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {result && !applied && !isRejected && (
              <div className="hidden sm:flex items-center gap-2 text-xs">
                {breakingCount > 0 && <span className="text-red-400/80">{breakingCount} breaking</span>}
                {warningCount > 0 && <span className="text-amber-400/80">{warningCount} warning</span>}
                {safeCount > 0 && <span className="text-emerald-400/80">{safeCount} safe</span>}
              </div>
            )}
            {applied && <span className="text-[10px] px-2.5 py-1 rounded-full border bg-cyan-500/15 text-cyan-300 border-cyan-500/25 font-semibold">✓ Applied</span>}
            {isRejected && !applied && <span className="text-[10px] px-2.5 py-1 rounded-full border bg-red-500/15 text-red-300 border-red-500/25 font-semibold">✗ Rejected</span>}
            <button onClick={handleReset} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/35 hover:text-white/65 transition-all">
              <RotateCcw size={10} />
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* ── Three panels ── */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-[380px_1fr_300px]">

        {/* ── Panel 1: Migration Proposal Editor ── */}
        <div className="flex flex-col border-r border-white/[0.06] bg-[#06060e] overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <FileCode2 size={12} className="text-cyan-400/50" />
              <span className="text-xs font-mono text-white/40">migration.yaml</span>
            </div>
            {isValid ? (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/70">
                <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
                {opCount} change{opCount !== 1 ? "s" : ""} · valid
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
              onChange={(e) => setYaml(e.target.value)}
              spellCheck={false}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-[12px] text-white/70 leading-5 pl-12 pr-4 pt-4 pb-4 outline-none overflow-y-auto"
              style={{ fontFamily: '"Fira Code", "JetBrains Mono", ui-monospace, monospace' }}
            />
          </div>

          {!isValid && (
            <div className="flex-shrink-0 px-4 py-2.5 border-t border-red-500/20 bg-red-500/[0.05]">
              <p className="text-[11px] font-mono text-red-400/90">⚠ {(parsed as { ok: false; error: string }).error}</p>
            </div>
          )}

          <div className="flex-shrink-0 p-3 border-t border-white/[0.05]">
            <button
              onClick={handleAnalyze}
              disabled={!isValid}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isValid
                  ? "bg-cyan-700 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/15 active:scale-[0.98]"
                  : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              }`}
            >
              <Play size={12} className={isValid ? "fill-white" : ""} />
              {result ? "Re-analyze Proposal" : "Analyze Proposal"}
            </button>
            {!result && (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-white/20 font-mono mb-1.5">Change ops:</p>
                <div className="grid grid-cols-2 gap-1">
                  {["add_column", "drop_column", "rename_column", "change_type", "add_index", "drop_table"].map(op => (
                    <div key={op} className="flex items-center gap-1 text-[10px]">
                      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${getRisk(op) === "BREAKING" ? "bg-red-400/60" : getRisk(op) === "WARNING" ? "bg-amber-400/60" : "bg-emerald-400/60"}`} />
                      <span className="font-mono text-white/25">{op}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Panel 2: Analysis Results ── */}
        <div className="overflow-y-auto p-5 lg:p-6">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-20">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <ShieldCheck size={20} className="text-cyan-400/60" />
              </div>
              <div>
                <p className="font-semibold text-white/40 mb-2">No proposal analyzed</p>
                <p className="text-sm text-white/20 max-w-xs leading-relaxed">
                  Define your schema changes in the editor — add columns, drop columns, rename fields. Click{" "}
                  <span className="text-cyan-400/60 font-medium">Analyze Proposal</span> to run the rule engine.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-white/20 max-w-xs">
                {[
                  { dot: "bg-emerald-400/60", label: "SAFE — additive changes, no downstream impact" },
                  { dot: "bg-amber-400/60",   label: "WARNING — may break nullable assumptions" },
                  { dot: "bg-red-400/60",     label: "BREAKING — requires approval from affected services" },
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
              {/* Summary chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {breakingCount > 0 && <span className="text-xs px-3 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/25 font-semibold">{breakingCount} BREAKING</span>}
                {warningCount > 0 && <span className="text-xs px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 font-semibold">{warningCount} WARNING</span>}
                {safeCount > 0 && <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-semibold">{safeCount} SAFE</span>}
              </div>

              {/* Applied banner */}
              <AnimatePresence>
                {applied && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4 flex gap-3">
                    <CheckCircle2 size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-cyan-300">Migration applied to production</p>
                      <p className="text-xs text-cyan-400/50 mt-0.5">Rollback migration stored in registry</p>
                    </div>
                  </motion.div>
                )}
                {isRejected && !applied && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4 flex gap-3">
                    <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-300">Migration blocked</p>
                      <p className="text-xs text-red-400/50 mt-0.5">At least one service owner rejected this proposal</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Operation cards */}
              <div className="space-y-2">
                {result.operations.map((op) => {
                  const s = RISK_STYLES[op.risk];
                  return (
                    <motion.div key={op.id} layout className={`rounded-xl border p-4 ${s.border} ${s.bg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`flex-shrink-0 ${op.risk === "BREAKING" ? "text-red-400" : op.risk === "WARNING" ? "text-amber-400" : "text-emerald-400"}`}>
                            {s.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white/85 truncate">{op.detail}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-white/30">{op.table}{op.column ? `.${op.column}` : ""}</span>
                              <span className={`text-[9px] font-mono px-1.5 py-px rounded border font-semibold ${s.badge}`}>{OP_LABELS[op.op] ?? op.op}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-bold ${s.badge}`}>{op.risk}</span>
                      </div>
                      {op.affectedServices.length > 0 && (
                        <div className="mt-3 pl-6">
                          <p className="text-[10px] text-white/25 mb-1.5">Affected services:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {op.affectedServices.map(svc => (
                              <span key={svc} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-white/45">{svc}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Approval gates */}
              {approvals.length > 0 && !applied && (
                <div>
                  <p className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wider">Approval Gates</p>
                  <div className="space-y-2">
                    {approvals.map((approval) => (
                      <motion.div
                        key={approval.service}
                        layout
                        className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
                          approval.status === "approved" ? "border-emerald-500/25 bg-emerald-500/[0.04]" :
                          approval.status === "rejected" ? "border-red-500/25 bg-red-500/[0.04]" :
                          "border-amber-500/25 bg-amber-500/[0.04]"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-white/80 font-mono">{approval.service}</p>
                          {approval.actor && <p className="text-[10px] text-white/25 mt-0.5">{approval.actor}</p>}
                        </div>
                        {approval.status === "pending" ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleApprove(approval.service)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 text-xs font-semibold transition-all">
                              <CheckCircle2 size={11} /> Approve
                            </button>
                            <button onClick={() => handleReject(approval.service)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-xs font-semibold transition-all">
                              <XCircle size={11} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${
                            approval.status === "approved"
                              ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/25"
                              : "text-red-300 bg-red-500/15 border-red-500/25"
                          }`}>
                            {approval.status === "approved" ? "✓ Approved" : "✗ Rejected"}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply button */}
              {!applied && (
                <button
                  onClick={handleApply}
                  disabled={!canApply}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    canApply
                      ? "bg-cyan-700 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/15 active:scale-[0.98]"
                      : "bg-white/[0.04] text-white/20 cursor-not-allowed"
                  }`}
                >
                  <Zap size={14} className={canApply ? "" : "opacity-30"} />
                  {isRejected ? "Blocked — migration rejected" :
                   pendingApprovals.length > 0 ? `Waiting on ${pendingApprovals.length} approval${pendingApprovals.length > 1 ? "s" : ""}` :
                   "Apply Migration"}
                  {canApply && <ChevronRight size={13} />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Panel 3: Audit Log ── */}
        <div className="flex flex-col bg-[#050510] border-l border-white/[0.05] overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/55">Migration Registry</p>
              <p className="text-[10px] text-white/20 mt-0.5">Immutable decision log</p>
            </div>
            <span className="text-[10px] font-mono text-white/20 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">{log.length} events</span>
          </div>

          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3">
            {log.length === 0 ? (
              <p className="text-[11px] text-white/15 text-center mt-10 leading-relaxed">
                Rule engine decisions<br />will appear here
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {log.map((entry, i) => (
                  <motion.div key={entry.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="flex gap-2.5">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0 ${LOG_DOT[entry.type]}`} />
                      {i < log.length - 1 && <div className="w-px flex-1 bg-white/[0.04] my-1" />}
                    </div>
                    <div className="pb-3 min-w-0 flex-1">
                      <p className="text-[11px] text-white/60 leading-snug break-words">{entry.action}</p>
                      <p className="text-[10px] text-white/18 mt-0.5 font-mono">{fmtTs(entry.ts)}</p>
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
