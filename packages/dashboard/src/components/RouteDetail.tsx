import { useMemo, useState } from "react";
import type { Span } from "../lib/types";
import { fmtDuration } from "../lib/format";
import { methodPill } from "../lib/colors";
import { Pill } from "./ui/Pill";
import { LatencyTimeline } from "./LatencyTimeline";
import { Waterfall } from "./Waterfall";

interface RouteStats {
  count: number;
  p50: number;
  p95: number;
  errors: number;
  errorRate: number;
}

function computeStats(spans: Span[]): RouteStats {
  if (spans.length === 0) return { count: 0, p50: 0, p95: 0, errors: 0, errorRate: 0 };
  const durations = spans.map((s) => s.duration).sort((a, b) => a - b);
  const errors = spans.filter((s) => s.status === "error").length;
  return {
    count: spans.length,
    p50: durations[Math.floor(durations.length * 0.5)] ?? 0,
    p95: durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] ?? 0,
    errors,
    errorRate: errors / spans.length,
  };
}

export interface RouteDetailProps {
  method: string;
  path: string;
  routeRoots: Span[];
  allSpans: Span[];
  getTrace: (traceId: string) => Span[];
}

export function RouteDetail({ method, path, routeRoots, allSpans, getTrace }: RouteDetailProps): React.ReactElement {
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>(undefined);
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(undefined);

  const stats = useMemo(() => computeStats(routeRoots), [routeRoots]);
  const mp = methodPill(method);

  const effectiveRoot = useMemo(() => {
    if (selectedTraceId) {
      const found = routeRoots.find((s) => s.traceId === selectedTraceId);
      if (found) return found;
    }
    return routeRoots[0];
  }, [selectedTraceId, routeRoots]);

  const trace = useMemo(
    () => (effectiveRoot ? getTrace(effectiveRoot.traceId) : []),
    [effectiveRoot, getTrace],
  );

  function selectTrace(traceId: string): void {
    setSelectedTraceId(traceId);
    setSelectedSpanId(undefined);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-900 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Pill bg={mp.bg} text={mp.text}>{method || "—"}</Pill>
          <span className="font-mono text-[15px] text-zinc-100">{path}</span>
        </div>
        <div className="flex items-center gap-5">
          <StatCell label="calls" value={String(stats.count)} />
          <StatCell label="p50" value={fmtDuration(stats.p50)} />
          <StatCell
            label="p95"
            value={fmtDuration(stats.p95)}
            {...(stats.p95 >= 1000 ? { highlight: "error" as const } : stats.p95 >= 250 ? { highlight: "warn" as const } : {})}
          />
          {stats.errors > 0 && (
            <StatCell
              label="errors"
              value={`${stats.errors} (${(stats.errorRate * 100).toFixed(0)}%)`}
              highlight="error"
            />
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <LatencyTimeline
          spans={routeRoots}
          allSpans={allSpans}
          selectedTraceId={effectiveRoot?.traceId}
          onSelect={selectTrace}
        />

        <div className="w-px bg-zinc-900 shrink-0" />

        <div className="w-[480px] shrink-0 flex flex-col overflow-hidden border-l border-zinc-900">
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-medium text-zinc-500 border-b border-zinc-900 shrink-0">
            Waterfall
          </div>
          <div className="flex-1 overflow-auto">
            {trace.length > 0 ? (
              <Waterfall
                trace={trace}
                selectedId={selectedSpanId ?? effectiveRoot?.id ?? ""}
                onSelect={setSelectedSpanId}
              />
            ) : (
              <div className="px-4 py-4 text-[11px] text-zinc-600">select a request on the left</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "warn" | "error";
}): React.ReactElement {
  const valueCls =
    highlight === "error" ? "text-red-400" :
    highlight === "warn" ? "text-amber-400" :
    "text-zinc-100";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={"font-mono text-[13px] tabular-nums " + valueCls}>{value}</span>
    </div>
  );
}
