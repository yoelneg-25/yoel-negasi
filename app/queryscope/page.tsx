"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Play, RotateCcw, Database, Zap,
  AlertTriangle, CheckCircle2, ChevronRight, TrendingUp,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type NodeType =
  | "seq_scan" | "index_scan" | "bitmap_heap_scan"
  | "hash_join" | "nested_loop" | "merge_join"
  | "sort" | "hash" | "aggregate" | "limit"
  | "cte_scan" | "subquery_scan" | "result";

type CostLevel = "low" | "medium" | "high" | "critical";

interface PlanNode {
  id: string;
  type: NodeType;
  label: string;
  detail: string;
  cost: number;       // 0–100
  costLevel: CostLevel;
  rows: number;
  children: PlanNode[];
  width?: number;     // layout hint
  indexSuggestion?: string;
}

interface Analysis {
  tree: PlanNode;
  totalCost: number;
  warnings: string[];
  indexSuggestions: { table: string; column: string; reason: string; sql: string }[];
  optimizedQuery: string;
  planSummary: string;
}

// ── SQL parser / plan generator ────────────────────────────────────────────────
function classify(cost: number): CostLevel {
  if (cost < 20) return "low";
  if (cost < 50) return "medium";
  if (cost < 75) return "high";
  return "critical";
}

let _nid = 0;
function nid() { return `n${++_nid}`; }

function makeNode(type: NodeType, label: string, detail: string, cost: number, rows: number, children: PlanNode[] = [], indexSuggestion?: string): PlanNode {
  return { id: nid(), type, label, detail, cost, costLevel: classify(cost), rows, children, indexSuggestion };
}

// Parse SQL and build a plausible execution plan
function analyzeSQL(sql: string): Analysis | { error: string } {
  const q = sql.trim().replace(/\s+/g, " ").toLowerCase();

  if (!q.startsWith("select")) return { error: "Only SELECT queries are supported" };
  if (q.length < 10) return { error: "Query too short" };

  const hasJoin       = /\bjoin\b/.test(q);
  const hasSubquery   = /\bselect\b.*?\bfrom\b.*?\bselect\b/.test(q) || /\(\s*select\b/.test(q);
  const hasGroupBy    = /\bgroup by\b/.test(q);
  const hasOrderBy    = /\border by\b/.test(q);
  const hasLimit      = /\blimit\b/.test(q);
  const hasWhere      = /\bwhere\b/.test(q);
  const hasAgg        = /\b(count|sum|avg|max|min)\s*\(/.test(q);
  const hasWith       = /^\s*with\b/.test(q);

  // Extract table names (rough heuristic)
  const fromMatch = q.match(/\bfrom\s+(\w+)/g) ?? [];
  const joinMatch = q.match(/\bjoin\s+(\w+)/g) ?? [];
  const tables = [
    ...fromMatch.map(s => s.replace(/from\s+/, "")),
    ...joinMatch.map(s => s.replace(/join\s+/, "")),
  ].filter(Boolean);

  // Extract WHERE columns (rough)
  const whereColMatch = q.match(/\bwhere\b.*?(\w+)\s*[=<>!]/);
  const whereCol = whereColMatch ? whereColMatch[1] : null;

  // Determine if we're doing a seq scan (no obvious index usage)
  const likeyScan = hasWhere && whereCol && !["id", "user_id", "order_id", whereCol + "_id"].some(k => whereCol.endsWith("_id") || whereCol === "id");

  const warnings: string[] = [];
  const indexSuggestions: Analysis["indexSuggestions"] = [];
  const nodes: PlanNode[] = [];

  // Build scan nodes per table
  const scanNodes: PlanNode[] = tables.slice(0, 2).map((table, i) => {
    const isFirst = i === 0;
    const rows = isFirst ? 250000 : 15000;
    const hasIndex = table.endsWith("s") && (whereCol?.endsWith("_id") || whereCol === "id");

    if (!hasIndex && hasWhere && isFirst) {
      warnings.push(`Sequential scan on "${table}" — no index on filtered column`);
      if (whereCol) {
        indexSuggestions.push({
          table, column: whereCol,
          reason: `WHERE ${whereCol} = ? performs a full table scan on "${table}" (${rows.toLocaleString()} rows)`,
          sql: `CREATE INDEX idx_${table}_${whereCol} ON ${table} (${whereCol});`,
        });
      }
      return makeNode("seq_scan", `Seq Scan`, table, 82, rows, [],
        whereCol ? `CREATE INDEX idx_${table}_${whereCol} ON ${table} (${whereCol});` : undefined);
    }
    return makeNode("index_scan", `Index Scan`, `${table} using idx_${table}_${whereCol ?? "id"}`, 12, rows / 20);
  });

  // Subquery node
  if (hasSubquery) {
    const subSelect = makeNode("seq_scan", "Seq Scan", "subquery_source", 60, 50000);
    const subAgg = makeNode("aggregate", "Aggregate", "subquery result", 25, 1, [subSelect]);
    nodes.push(makeNode("subquery_scan", "Subquery Scan", "derived table", 35, 1000, [subAgg]));
    warnings.push("Correlated subquery detected — consider rewriting as a JOIN");
  }

  // CTE node
  let cteNode: PlanNode | undefined;
  if (hasWith) {
    const cteScan = makeNode("seq_scan", "Seq Scan", "cte_source", 45, 100000);
    cteNode = makeNode("cte_scan", "CTE Scan", "WITH clause", 20, 5000, [cteScan]);
  }

  // Join node
  let topNode: PlanNode;
  if (hasJoin && scanNodes.length >= 2) {
    const joinCost = scanNodes[0].costLevel === "critical" || scanNodes[1].cost > 60 ? 88 : 35;
    const joinChildren = cteNode ? [...scanNodes, cteNode] : scanNodes;

    // Pick join type heuristically
    const joinType: NodeType = joinCost > 70 ? "hash_join" : "nested_loop";
    const joinLabel = joinType === "hash_join" ? "Hash Join" : "Nested Loop";

    if (joinType === "hash_join") warnings.push("Hash join on large tables — ensure join columns are indexed");
    topNode = makeNode(joinType, joinLabel, "join condition", joinCost, 80000, joinChildren);
  } else {
    topNode = scanNodes[0] ?? makeNode("seq_scan", "Seq Scan", tables[0] ?? "unknown", 55, 10000);
    if (cteNode) topNode = makeNode("nested_loop", "Nested Loop", "with CTE", 40, 8000, [topNode, cteNode]);
    if (hasSubquery && nodes[0]) topNode = makeNode("hash_join", "Hash Join", "with subquery", 65, 5000, [topNode, nodes[0]]);
  }

  // Sort node
  if (hasOrderBy) {
    const sortCost = topNode.cost > 60 ? 72 : 38;
    if (sortCost > 60) warnings.push("Sort operation on a large dataset — consider an index on the ORDER BY column");
    topNode = makeNode("sort", "Sort", "ORDER BY clause", sortCost, topNode.rows, [topNode]);
  }

  // Aggregate node
  if (hasAgg || hasGroupBy) {
    topNode = makeNode("aggregate", "Aggregate", hasGroupBy ? "GROUP BY + aggregate" : "aggregate function", 30, Math.max(1, topNode.rows / 100), [topNode]);
  }

  // Limit node
  if (hasLimit) {
    topNode = makeNode("limit", "Limit", "LIMIT clause", 5, 100, [topNode]);
  }

  const totalCost = Math.min(100, topNode.cost + (hasJoin ? 10 : 0) + (hasSubquery ? 15 : 0));

  // Build optimized query suggestion
  let optimizedQuery = sql.trim();
  if (warnings.some(w => w.includes("Sequential scan"))) {
    const table = tables[0];
    const col = whereCol;
    optimizedQuery = `-- After adding index:\n${sql.trim()}\n\n-- Index suggestion:\n${col ? `CREATE INDEX CONCURRENTLY idx_${table}_${col}\n  ON ${table} (${col});` : `-- Analyze ${table} for missing indexes`}`;
  }
  if (hasSubquery) {
    optimizedQuery += "\n\n-- Rewrite subquery as JOIN for better planner statistics";
  }

  const planSummary = [
    `${tables.length} table${tables.length !== 1 ? "s" : ""}`,
    hasJoin ? "with JOIN" : "",
    hasSubquery ? "with subquery" : "",
    hasGroupBy ? "with GROUP BY" : "",
    hasOrderBy ? "with ORDER BY" : "",
  ].filter(Boolean).join(", ");

  return {
    tree: topNode,
    totalCost,
    warnings,
    indexSuggestions,
    optimizedQuery,
    planSummary,
  };
}

// ── Sample queries ─────────────────────────────────────────────────────────────
const SAMPLES = [
  {
    label: "JOIN + filter",
    sql: `SELECT u.id, u.email, o.total, o.created_at
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.signup_source = 'organic'
ORDER BY o.created_at DESC
LIMIT 100;`,
  },
  {
    label: "Aggregation",
    sql: `SELECT 
  product_id,
  COUNT(*) AS order_count,
  SUM(total) AS revenue,
  AVG(total) AS avg_order
FROM orders
WHERE status = 'completed'
  AND created_at >= '2026-01-01'
GROUP BY product_id
ORDER BY revenue DESC;`,
  },
  {
    label: "Correlated subquery",
    sql: `SELECT p.name, p.price
FROM products p
WHERE p.price > (
  SELECT AVG(price) 
  FROM products 
  WHERE category_id = p.category_id
)
ORDER BY p.price DESC;`,
  },
  {
    label: "Multi-join",
    sql: `SELECT 
  u.email,
  o.id AS order_id,
  i.quantity,
  p.name AS product
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN order_items i ON i.order_id = o.id
JOIN products p ON p.id = i.product_id
WHERE u.country = 'US'
  AND o.status != 'cancelled';`,
  },
];

// ── Node styles ────────────────────────────────────────────────────────────────
const NODE_COLORS: Record<NodeType, { border: string; bg: string; dot: string; label: string }> = {
  seq_scan:       { border: "border-red-500/40",     bg: "bg-red-500/[0.08]",     dot: "bg-red-400",     label: "text-red-300" },
  index_scan:     { border: "border-emerald-500/35", bg: "bg-emerald-500/[0.06]", dot: "bg-emerald-400", label: "text-emerald-300" },
  bitmap_heap_scan:{ border: "border-blue-500/35",   bg: "bg-blue-500/[0.06]",    dot: "bg-blue-400",    label: "text-blue-300" },
  hash_join:      { border: "border-amber-500/35",   bg: "bg-amber-500/[0.06]",   dot: "bg-amber-400",   label: "text-amber-300" },
  nested_loop:    { border: "border-violet-500/35",  bg: "bg-violet-500/[0.06]",  dot: "bg-violet-400",  label: "text-violet-300" },
  merge_join:     { border: "border-blue-500/35",    bg: "bg-blue-500/[0.06]",    dot: "bg-blue-400",    label: "text-blue-300" },
  sort:           { border: "border-orange-500/35",  bg: "bg-orange-500/[0.06]",  dot: "bg-orange-400",  label: "text-orange-300" },
  hash:           { border: "border-indigo-500/35",  bg: "bg-indigo-500/[0.06]",  dot: "bg-indigo-400",  label: "text-indigo-300" },
  aggregate:      { border: "border-cyan-500/35",    bg: "bg-cyan-500/[0.06]",    dot: "bg-cyan-400",    label: "text-cyan-300" },
  limit:          { border: "border-white/15",       bg: "bg-white/[0.03]",       dot: "bg-white/40",    label: "text-white/50" },
  cte_scan:       { border: "border-fuchsia-500/35", bg: "bg-fuchsia-500/[0.06]", dot: "bg-fuchsia-400", label: "text-fuchsia-300" },
  subquery_scan:  { border: "border-pink-500/35",    bg: "bg-pink-500/[0.06]",    dot: "bg-pink-400",    label: "text-pink-300" },
  result:         { border: "border-white/15",       bg: "bg-white/[0.03]",       dot: "bg-white/30",    label: "text-white/40" },
};

const COST_BAR: Record<CostLevel, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

// ── Tree renderer ──────────────────────────────────────────────────────────────
function PlanNodeCard({ node, depth = 0 }: { node: PlanNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const s = NODE_COLORS[node.type];
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: depth * 0.06 }}
        className={`rounded-xl border px-3.5 py-3 min-w-[170px] max-w-[220px] cursor-pointer select-none ${s.border} ${s.bg} hover:brightness-110 transition-all`}
        onClick={() => hasChildren && setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
          <span className={`text-[11px] font-bold ${s.label}`}>{node.label}</span>
          {hasChildren && (
            <ChevronRight size={10} className={`ml-auto text-white/30 transition-transform ${expanded ? "rotate-90" : ""}`} />
          )}
        </div>
        <p className="text-[10px] text-white/40 font-mono truncate mb-2">{node.detail}</p>
        {/* Cost bar */}
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mb-1.5">
          <div className={`h-full rounded-full ${COST_BAR[node.costLevel]}`} style={{ width: `${node.cost}%` }} />
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono text-white/25">
          <span>cost {node.cost}</span>
          <span>{node.rows.toLocaleString()} rows</span>
        </div>
        {node.indexSuggestion && (
          <div className="mt-2 text-[9px] text-amber-300/70 bg-amber-500/[0.08] rounded px-2 py-1 border border-amber-500/15 font-mono break-all">
            {node.indexSuggestion.slice(0, 50)}…
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {hasChildren && expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            {/* Connector line */}
            <div className="flex justify-center">
              <div className="w-px h-5 bg-white/[0.08]" />
            </div>
            <div className={`flex gap-6 items-start ${node.children.length > 1 ? "border-t border-white/[0.06] pt-5 relative" : ""}`}>
              {node.children.length > 1 && (
                <div className="absolute top-0 left-[25%] right-[25%] h-px bg-white/[0.06]" />
              )}
              {node.children.map(child => (
                <div key={child.id} className="flex flex-col items-center">
                  {node.children.length > 1 && <div className="w-px h-5 bg-white/[0.08]" />}
                  <PlanNodeCard node={child} depth={depth + 1} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function QueryScopePage() {
  const [sql, setSql] = useState(SAMPLES[0].sql);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState(0);

  const analysis = useMemo(() => {
    if (!submitted) return null;
    return analyzeSQL(submitted);
  }, [submitted]);

  const lineCount = sql.split("\n").length;
  const isError = analysis && "error" in analysis;

  function handleAnalyze() {
    _nid = 0; // reset node id counter
    setSubmitted(sql);
  }

  function loadSample(i: number) {
    setSql(SAMPLES[i].sql);
    setActiveSample(i);
    setSubmitted(null);
  }

  const result = analysis && !("error" in analysis) ? analysis : null;

  const costColor = !result ? "text-white/30" :
    result.totalCost < 30 ? "text-emerald-400" :
    result.totalCost < 60 ? "text-amber-400" : "text-red-400";

  return (
    <main className="h-screen overflow-hidden bg-[#080810] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#080810]/95 backdrop-blur-xl border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects/queryscope" className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors group">
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="w-px h-4 bg-white/[0.07]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Database size={11} className="text-emerald-400" />
              </div>
              <span className="font-sora font-bold text-sm">QueryScope</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-semibold tracking-wide">LIVE DEMO</span>
            </div>
          </div>
          {result && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-white/25">
              <span className={`font-semibold ${costColor}`}>Cost {result.totalCost}</span>
              <span>{result.planSummary}</span>
              {result.warnings.length > 0 && <span className="text-amber-400/70">{result.warnings.length} warning{result.warnings.length > 1 ? "s" : ""}</span>}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden grid lg:grid-cols-[360px_1fr_280px]">

        {/* ── Panel 1: SQL Editor ── */}
        <div className="flex flex-col border-r border-white/[0.06] bg-[#06060e] overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <Database size={11} className="text-emerald-400/50" />
              <span className="text-xs font-mono text-white/40">query.sql</span>
            </div>
            <span className="text-[10px] font-mono text-white/20">{lineCount} lines</span>
          </div>

          {/* Sample buttons */}
          <div className="flex-shrink-0 flex gap-1.5 px-3 py-2 border-b border-white/[0.04]">
            {SAMPLES.map((s, i) => (
              <button
                key={i}
                onClick={() => loadSample(i)}
                className={`text-[9px] px-2 py-1 rounded-md border font-semibold transition-all ${
                  activeSample === i && submitted
                    ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
                    : "bg-white/[0.03] border-white/[0.07] text-white/25 hover:text-white/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden relative min-h-0">
            <div aria-hidden className="absolute left-0 top-0 bottom-0 w-9 flex flex-col items-end pt-4 pb-4 pr-2 bg-[#04040b] border-r border-white/[0.04] z-10 pointer-events-none select-none overflow-hidden">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-[10px] font-mono text-white/[0.1] leading-5 flex-shrink-0">{i + 1}</div>
              ))}
            </div>
            <textarea
              value={sql}
              onChange={e => { setSql(e.target.value); setSubmitted(null); }}
              spellCheck={false}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-[12px] text-white/70 leading-5 pl-12 pr-4 pt-4 pb-4 outline-none overflow-y-auto"
              style={{ fontFamily: '"Fira Code", "JetBrains Mono", ui-monospace, monospace' }}
            />
          </div>

          {isError && (
            <div className="flex-shrink-0 px-4 py-2.5 border-t border-red-500/20 bg-red-500/[0.05]">
              <p className="text-[11px] font-mono text-red-400/90">⚠ {(analysis as { error: string }).error}</p>
            </div>
          )}

          <div className="flex-shrink-0 p-3 border-t border-white/[0.05]">
            <button
              onClick={handleAnalyze}
              disabled={!sql.trim()}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                sql.trim()
                  ? "bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/15 active:scale-[0.98]"
                  : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              }`}
            >
              <Play size={12} className={sql.trim() ? "fill-white" : ""} />
              Analyze Query
            </button>
          </div>
        </div>

        {/* ── Panel 2: Execution Plan Tree ── */}
        <div className="overflow-auto p-6 bg-[#070710]">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-20 min-h-[400px]">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-400/60" />
              </div>
              <div>
                <p className="font-semibold text-white/40 mb-2">No query analyzed</p>
                <p className="text-sm text-white/20 max-w-xs leading-relaxed">
                  Write or load a sample SQL query, then click{" "}
                  <span className="text-emerald-400/60 font-medium">Analyze Query</span>{" "}
                  to render the execution plan tree.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-white/20 max-w-xs">
                {[
                  { dot: "bg-emerald-400/70", label: "Index Scan — fast, uses an index" },
                  { dot: "bg-red-400/70",     label: "Seq Scan — slow, reads every row" },
                  { dot: "bg-amber-400/70",   label: "Hash Join — large join, high memory" },
                  { dot: "bg-violet-400/70",  label: "Nested Loop — small table join" },
                  { dot: "bg-orange-400/70",  label: "Sort — expensive on large sets" },
                ].map(({ dot, label }) => (
                  <div key={label} className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8 min-w-fit pb-8">
              {/* Total cost badge */}
              <div className="flex items-center gap-3">
                <div className={`rounded-xl border px-4 py-2 flex items-center gap-2 ${
                  result.totalCost < 30 ? "border-emerald-500/30 bg-emerald-500/[0.06]" :
                  result.totalCost < 60 ? "border-amber-500/30 bg-amber-500/[0.06]" :
                  "border-red-500/30 bg-red-500/[0.06]"
                }`}>
                  <span className={`text-2xl font-bold font-mono tabular-nums ${costColor}`}>{result.totalCost}</span>
                  <div>
                    <p className="text-[10px] text-white/35 font-mono">Total Cost</p>
                    <p className="text-[10px] text-white/20">{result.planSummary}</p>
                  </div>
                </div>
                {result.indexSuggestions.length > 0 && (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 flex items-center gap-2">
                    <AlertTriangle size={12} className="text-amber-400" />
                    <span className="text-xs text-amber-300 font-semibold">{result.indexSuggestions.length} index suggestion{result.indexSuggestions.length > 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>

              {/* Tree */}
              <div className="overflow-x-auto">
                <PlanNodeCard node={result.tree} depth={0} />
              </div>
            </div>
          )}
        </div>

        {/* ── Panel 3: Analysis sidebar ── */}
        <div className="flex flex-col bg-[#050510] border-l border-white/[0.05] overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.05]">
            <p className="text-xs font-semibold text-white/55">Query Analysis</p>
            <p className="text-[10px] text-white/20 mt-0.5">Warnings · Indexes · Rewrite</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {!result ? (
              <p className="text-[11px] text-white/15 text-center mt-8 leading-relaxed">
                Run a query to see<br />analysis results
              </p>
            ) : (
              <>
                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Warnings</p>
                    <div className="space-y-2">
                      {result.warnings.map((w, i) => (
                        <div key={i} className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-2.5">
                          <AlertTriangle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-200/70 leading-snug">{w}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No warnings */}
                {result.warnings.length === 0 && (
                  <div className="flex gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
                    <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-300/70 leading-snug">No performance warnings detected</p>
                  </div>
                )}

                {/* Index suggestions */}
                {result.indexSuggestions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">Index Advisor</p>
                    <div className="space-y-3">
                      {result.indexSuggestions.map((idx, i) => (
                        <div key={i} className="rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-3">
                          <p className="text-[10px] text-orange-300/80 mb-1.5 leading-snug">{idx.reason}</p>
                          <div className="bg-[#04040b] rounded-md p-2 border border-white/[0.06]">
                            <p className="text-[10px] font-mono text-emerald-300/80 break-all">{idx.sql}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optimized query */}
                <div>
                  <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Zap size={9} className="text-emerald-400/60" />
                      Optimized Query
                    </span>
                  </p>
                  <div className="bg-[#04040b] rounded-lg border border-white/[0.06] p-3 overflow-x-auto">
                    <pre className="text-[10px] font-mono text-white/50 whitespace-pre-wrap break-words leading-relaxed">{result.optimizedQuery}</pre>
                  </div>
                </div>

                {/* Legend */}
                <div>
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">Cost Legend</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([["low", "bg-emerald-500", "0–19"], ["medium", "bg-amber-500", "20–49"], ["high", "bg-orange-500", "50–74"], ["critical", "bg-red-500", "75–100"]] as const).map(([level, cls, range]) => (
                      <div key={level} className="flex items-center gap-1.5 text-[10px]">
                        <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${cls}`} />
                        <span className="text-white/25 capitalize">{level}</span>
                        <span className="text-white/15 ml-auto">{range}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
