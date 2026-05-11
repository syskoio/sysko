import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Span } from "../lib/types";
import { fmtDuration } from "../lib/format";
import { methodPill } from "../lib/colors";
import { Pill } from "./ui/Pill";

interface EndpointStat {
  key: string;
  method: string;
  path: string;
  count: number;
  errors: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  max: number;
}

type SortKey = "count" | "p95" | "errorRate" | "path";

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[idx] ?? 0;
}

function aggregate(spans: Span[]): EndpointStat[] {
  const groups = new Map<string, Span[]>();
  for (const s of spans) {
    if (s.parentSpanId !== undefined) continue;
    const method = String(s.attributes["http.method"] ?? "");
    const path = String(
      s.attributes["http.route"] ?? s.attributes["http.path"] ?? s.name,
    );
    const key = `${method} ${path}`;
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }

  const result: EndpointStat[] = [];
  for (const [key, group] of groups) {
    const durations = group.map((g) => g.duration).sort((a, b) => a - b);
    const errors = group.filter((g) => g.status === "error").length;
    const first = group[0];
    if (!first) continue;
    const method = String(first.attributes["http.method"] ?? "");
    const path = String(
      first.attributes["http.route"] ?? first.attributes["http.path"] ?? first.name,
    );
    const sum = durations.reduce((a, b) => a + b, 0);
    result.push({
      key,
      method,
      path,
      count: group.length,
      errors,
      errorRate: errors / group.length,
      p50: quantile(durations, 0.5),
      p95: quantile(durations, 0.95),
      p99: quantile(durations, 0.99),
      avg: sum / group.length,
      max: durations[durations.length - 1] ?? 0,
    });
  }
  return result;
}

function compare(a: EndpointStat, b: EndpointStat, key: SortKey): number {
  switch (key) {
    case "count": return b.count - a.count;
    case "p95": return b.p95 - a.p95;
    case "errorRate": return b.errorRate - a.errorRate;
    case "path": return a.path.localeCompare(b.path);
  }
}

export function EndpointStats({ spans }: { spans: Span[] }): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const rows = useMemo(() => {
    const stats = aggregate(spans);
    return stats.sort((a, b) => compare(a, b, sortKey));
  }, [spans, sortKey]);

  if (rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
        no endpoints captured yet
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-zinc-950 z-10">
          <tr className="text-left border-b border-zinc-900">
            <SortHeader col="path" current={sortKey} onSort={setSortKey} className="px-5 py-2 w-16">
              method
            </SortHeader>
            <SortHeader col="path" current={sortKey} onSort={setSortKey} className="px-2 py-2">
              endpoint
            </SortHeader>
            <SortHeader col="count" current={sortKey} onSort={setSortKey} className="px-2 py-2 w-20 text-right">
              calls
            </SortHeader>
            <SortHeader col="errorRate" current={sortKey} onSort={setSortKey} className="px-2 py-2 w-24 text-right">
              errors
            </SortHeader>
            <th className="px-2 py-2 w-20 text-right text-[10.5px] uppercase tracking-wider text-zinc-500 font-medium">
              p50
            </th>
            <SortHeader col="p95" current={sortKey} onSort={setSortKey} className="px-2 py-2 w-20 text-right">
              p95
            </SortHeader>
            <th className="px-2 py-2 w-20 text-right text-[10.5px] uppercase tracking-wider text-zinc-500 font-medium">
              p99
            </th>
            <th className="px-5 py-2 w-20 text-right text-[10.5px] uppercase tracking-wider text-zinc-500 font-medium">
              max
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mp = methodPill(r.method);
            const errCls = r.errorRate > 0.1 ? "text-red-400" : r.errorRate > 0 ? "text-amber-400" : "text-zinc-500";
            const p95Cls = r.p95 > 1000 ? "text-red-400" : r.p95 > 250 ? "text-amber-400" : "text-zinc-300";
            return (
              <tr key={r.key} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                <td className="px-5 py-2">
                  <Pill bg={mp.bg} text={mp.text}>{r.method || "—"}</Pill>
                </td>
                <td className="px-2 py-2 font-mono text-zinc-200">{r.path}</td>
                <td className="px-2 py-2 font-mono tabular-nums text-right text-zinc-200">{r.count}</td>
                <td className={"px-2 py-2 font-mono tabular-nums text-right " + errCls}>
                  {r.errors > 0 ? `${r.errors} (${(r.errorRate * 100).toFixed(0)}%)` : "—"}
                </td>
                <td className="px-2 py-2 font-mono tabular-nums text-right text-zinc-400">
                  {fmtDuration(r.p50)}
                </td>
                <td className={"px-2 py-2 font-mono tabular-nums text-right " + p95Cls}>
                  {fmtDuration(r.p95)}
                </td>
                <td className="px-2 py-2 font-mono tabular-nums text-right text-zinc-400">
                  {fmtDuration(r.p99)}
                </td>
                <td className="px-5 py-2 font-mono tabular-nums text-right text-zinc-500">
                  {fmtDuration(r.max)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  col,
  current,
  onSort,
  children,
  className = "",
}: {
  col: SortKey;
  current: SortKey;
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  const active = col === current;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={
          "inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider font-medium transition-colors " +
          (active ? "text-lime-300" : "text-zinc-500 hover:text-zinc-300")
        }
      >
        {children}
        {active && <ArrowDown className="h-3 w-3" />}
        {!active && col !== "path" && <ArrowUp className="h-3 w-3 opacity-0 group-hover:opacity-50" />}
      </button>
    </th>
  );
}
