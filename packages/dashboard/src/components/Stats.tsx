import { useMemo } from "react";
import { Activity, AlertTriangle, Clock, Zap } from "lucide-react";
import type { Span } from "../lib/types";
import { fmtDuration } from "../lib/format";

const THROUGHPUT_WINDOW_MS = 10_000;

export function Stats({ spans }: { spans: Span[] }): React.ReactElement {
  const stats = useMemo(() => {
    const total = spans.length;
    const errors = spans.filter(
      (s) => s.status === "error" || (s.attributes["http.status_code"] ?? 0) >= 400,
    ).length;

    let p95 = 0;
    if (spans.length > 0) {
      const sorted = spans.map((s) => s.duration).sort((a, b) => a - b);
      p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    }

    const now = Date.now();
    const recent = spans.filter((s) => now - s.startTime < THROUGHPUT_WINDOW_MS).length;
    const rps = recent / (THROUGHPUT_WINDOW_MS / 1000);

    const errorRate = total > 0 ? (errors / total) * 100 : 0;

    return { total, errors, p95, rps, errorRate };
  }, [spans]);

  return (
    <div className="grid grid-cols-4 gap-px bg-zinc-900 border-b border-zinc-900">
      <StatCard
        icon={<Activity className="h-3.5 w-3.5" />}
        label="requests"
        value={stats.total.toLocaleString()}
        accent="text-zinc-100"
      />
      <StatCard
        icon={<Zap className="h-3.5 w-3.5" />}
        label="throughput"
        value={stats.rps.toFixed(stats.rps < 10 ? 1 : 0)}
        suffix="req/s"
        accent="text-lime-300"
        sub={`last ${THROUGHPUT_WINDOW_MS / 1000}s`}
      />
      <StatCard
        icon={<Clock className="h-3.5 w-3.5" />}
        label="p95 duration"
        value={fmtDuration(stats.p95)}
        accent={stats.p95 > 250 ? "text-amber-300" : "text-zinc-100"}
      />
      <StatCard
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        label="errors"
        value={stats.errors.toLocaleString()}
        suffix={stats.total > 0 ? `${stats.errorRate.toFixed(1)}%` : undefined}
        accent={stats.errors > 0 ? "text-red-400" : "text-zinc-100"}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string | undefined;
  sub?: string | undefined;
  accent: string;
}): React.ReactElement {
  return (
    <div className="bg-zinc-950 px-5 py-3.5">
      <div className="flex items-center gap-1.5 text-zinc-500">
        {icon}
        <span className="text-[10.5px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={"text-2xl font-semibold tabular-nums tracking-tight " + accent}>{value}</span>
        {suffix && <span className="text-xs text-zinc-500 font-mono">{suffix}</span>}
      </div>
      {sub && <div className="text-[10px] text-zinc-600 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}
