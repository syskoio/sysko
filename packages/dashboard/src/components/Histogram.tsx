import { useMemo } from "react";
import type { Span } from "../lib/types";
import { fmtDuration } from "../lib/format";

interface Bucket {
  lower: number;
  upper: number;
  label: string;
  count: number;
}

const BUCKETS: { lower: number; upper: number; label: string }[] = [
  { lower: 0, upper: 1, label: "<1ms" },
  { lower: 1, upper: 5, label: "1–5ms" },
  { lower: 5, upper: 10, label: "5–10ms" },
  { lower: 10, upper: 25, label: "10–25ms" },
  { lower: 25, upper: 50, label: "25–50ms" },
  { lower: 50, upper: 100, label: "50–100ms" },
  { lower: 100, upper: 250, label: "100–250ms" },
  { lower: 250, upper: 500, label: "250–500ms" },
  { lower: 500, upper: 1000, label: "500ms–1s" },
  { lower: 1000, upper: 2000, label: "1–2s" },
  { lower: 2000, upper: 5000, label: "2–5s" },
  { lower: 5000, upper: Infinity, label: "≥5s" },
];

function bucketColor(lower: number): string {
  if (lower < 25) return "bg-emerald-500/60";
  if (lower < 100) return "bg-sky-500/60";
  if (lower < 250) return "bg-cyan-500/60";
  if (lower < 1000) return "bg-amber-500/60";
  return "bg-red-500/60";
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[idx] ?? 0;
}

export function Histogram({ spans }: { spans: Span[] }): React.ReactElement {
  const { buckets, max, summary } = useMemo(() => {
    const roots = spans.filter((s) => s.parentSpanId === undefined);
    const buckets: Bucket[] = BUCKETS.map((b) => ({ ...b, count: 0 }));
    for (const s of roots) {
      const d = s.duration;
      for (const b of buckets) {
        if (d >= b.lower && d < b.upper) {
          b.count++;
          break;
        }
      }
    }
    const max = Math.max(1, ...buckets.map((b) => b.count));
    const durations = roots.map((s) => s.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const summary = {
      count: roots.length,
      min: durations[0] ?? 0,
      avg: durations.length > 0 ? sum / durations.length : 0,
      p50: quantile(durations, 0.5),
      p95: quantile(durations, 0.95),
      p99: quantile(durations, 0.99),
      max: durations[durations.length - 1] ?? 0,
    };
    return { buckets, max, summary };
  }, [spans]);

  if (summary.count === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
        no spans captured yet
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full px-5 py-5">
      <div className="grid grid-cols-7 gap-px bg-zinc-900 border border-zinc-900 rounded-md mb-6">
        <SummaryCell label="count" value={summary.count.toLocaleString()} />
        <SummaryCell label="min" value={fmtDuration(summary.min)} />
        <SummaryCell label="avg" value={fmtDuration(summary.avg)} />
        <SummaryCell label="p50" value={fmtDuration(summary.p50)} />
        <SummaryCell label="p95" value={fmtDuration(summary.p95)} accent={summary.p95 > 250 ? "text-amber-300" : undefined} />
        <SummaryCell label="p99" value={fmtDuration(summary.p99)} accent={summary.p99 > 1000 ? "text-red-300" : undefined} />
        <SummaryCell label="max" value={fmtDuration(summary.max)} accent={summary.max > 1000 ? "text-red-300" : undefined} />
      </div>

      <div className="text-[10.5px] uppercase tracking-wider font-medium text-zinc-500 mb-3">
        distribution
      </div>

      <div className="space-y-1.5">
        {buckets.map((b) => {
          const pct = (b.count / max) * 100;
          const sharePct = summary.count > 0 ? (b.count / summary.count) * 100 : 0;
          return (
            <div key={b.label} className="flex items-center gap-3 text-[11.5px] font-mono">
              <div className="w-24 text-right text-zinc-500 tabular-nums">{b.label}</div>
              <div className="flex-1 relative h-5 bg-zinc-900 rounded-sm overflow-hidden">
                <div
                  className={"h-full rounded-sm transition-all " + bucketColor(b.lower)}
                  style={{ width: `${pct}%`, minWidth: b.count > 0 ? "2px" : "0" }}
                />
                {b.count > 0 && (
                  <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
                    <span className="text-zinc-100 text-[10.5px] tabular-nums">
                      {b.count}
                      <span className="text-zinc-300"> · {sharePct.toFixed(1)}%</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string | undefined;
}): React.ReactElement {
  return (
    <div className="bg-zinc-950 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={"text-base font-semibold tabular-nums mt-0.5 " + (accent ?? "text-zinc-100")}>
        {value}
      </div>
    </div>
  );
}
