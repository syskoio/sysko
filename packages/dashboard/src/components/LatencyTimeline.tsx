import { AlertTriangle, GitBranch } from "lucide-react";
import type { Span } from "../lib/types";
import { fmtDuration, fmtRelativeTime } from "../lib/format";
import { statusColor } from "../lib/colors";

export interface LatencyTimelineProps {
  spans: Span[];
  allSpans: Span[];
  selectedTraceId: string | undefined;
  onSelect: (traceId: string) => void;
}

function barColor(span: Span): string {
  if (span.status === "error") return "bg-red-500/70";
  if (span.duration >= 1000) return "bg-red-400/70";
  if (span.duration >= 250) return "bg-amber-400/70";
  return "bg-lime-400/70";
}

export function LatencyTimeline({ spans, allSpans, selectedTraceId, onSelect }: LatencyTimelineProps): React.ReactElement {
  const visible = spans.slice(0, 40);
  const maxDuration = visible.reduce((m, s) => Math.max(m, s.duration), 1);

  const childCounts = new Map<string, number>();
  for (const s of allSpans) {
    if (s.parentSpanId === undefined) continue;
    childCounts.set(s.traceId, (childCounts.get(s.traceId) ?? 0) + 1);
  }

  if (visible.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[11px] text-zinc-600">
        no requests yet
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="px-5 py-2 text-[10px] uppercase tracking-wider font-medium text-zinc-500 sticky top-0 bg-zinc-950 border-b border-zinc-900">
        <span>Timeline</span>
        <span className="ml-2 normal-case tracking-normal text-zinc-600">{spans.length} requests</span>
      </div>
      {visible.map((s) => {
        const widthPct = Math.max(1, (s.duration / maxDuration) * 100);
        const code = s.attributes["http.status_code"];
        const isErr = s.status === "error";
        const children = childCounts.get(s.traceId) ?? 0;
        const isSelected = s.traceId === selectedTraceId;

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.traceId)}
            className={
              "w-full flex items-center gap-3 px-5 py-2 text-left transition-colors border-b border-zinc-900/50 " +
              (isSelected ? "bg-zinc-800/80" : "hover:bg-zinc-900/50")
            }
          >
            <span className={"font-mono tabular-nums text-[11.5px] w-7 shrink-0 " + statusColor(code, isErr)}>
              {code ?? "—"}
            </span>

            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className={"h-full rounded-full " + barColor(s)}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-[11px] text-zinc-400 shrink-0 w-14 text-right">
                {fmtDuration(s.duration)}
              </span>
            </div>

            {children > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-zinc-600 shrink-0">
                <GitBranch className="h-2.5 w-2.5" />
                {children}
              </span>
            )}
            {isErr && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}

            <span className="font-mono tabular-nums text-[10.5px] text-zinc-600 shrink-0 w-14 text-right">
              {fmtRelativeTime(s.startTime)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
