import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { Span } from "../lib/types";
import { useErrors, type ErrorGroup } from "../lib/useErrors";
import { fmtRelativeTime, fmtAbsoluteTime } from "../lib/format";

export interface ErrorsTabProps {
  spans: Span[];
  onSelectTrace: (traceId: string) => void;
}

export function ErrorsTab({ spans, onSelectTrace }: ErrorsTabProps): React.ReactElement {
  const groups = useErrors(spans);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
        <AlertTriangle className="h-8 w-8 opacity-30" />
        <p className="text-[13px]">no errors captured</p>
        <p className="text-[11px] text-zinc-700 max-w-xs text-center">
          Errors thrown inside request handlers are automatically captured and grouped here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <div className="px-5 py-2 border-b border-zinc-900 sticky top-0 bg-zinc-950 z-10 flex items-center gap-4 text-[10.5px] uppercase tracking-wider text-zinc-500 font-medium">
        <span className="flex-1">error</span>
        <span className="w-14 text-right">count</span>
        <span className="w-20 text-right">last seen</span>
        <span className="w-[60px] shrink-0" />
      </div>
      {groups.map((group) => (
        <ErrorGroupRow
          key={group.fingerprint}
          group={group}
          expanded={expanded === group.fingerprint}
          onToggle={() =>
            setExpanded(expanded === group.fingerprint ? null : group.fingerprint)
          }
          onSelectTrace={onSelectTrace}
        />
      ))}
    </div>
  );
}

function ErrorGroupRow({
  group,
  expanded,
  onToggle,
  onSelectTrace,
}: {
  group: ErrorGroup;
  expanded: boolean;
  onToggle: () => void;
  onSelectTrace: (traceId: string) => void;
}): React.ReactElement {
  const sorted = [...group.occurrences].sort((a, b) => b.startTime - a.startTime);

  return (
    <div className="border-b border-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-zinc-900/40 transition-colors"
      >
        <ChevronRight
          className={
            "h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform " +
            (expanded ? "rotate-90" : "")
          }
        />
        <span className="text-[11px] font-mono bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded shrink-0">
          {group.errorName}
        </span>
        <span className="flex-1 font-mono text-[12px] text-zinc-300 truncate min-w-0">
          {group.message}
        </span>
        <span className="font-mono tabular-nums text-[12px] text-zinc-200 shrink-0 w-14 text-right">
          {group.count}
        </span>
        <span className="font-mono text-[11px] text-zinc-500 shrink-0 w-20 text-right">
          {fmtRelativeTime(group.lastSeen)}
        </span>
        <Sparkline data={group.trend} />
      </button>

      {expanded && (
        <div className="px-5 pb-4 bg-zinc-950/60">
          <div className="text-[10px] text-zinc-500 mb-2 font-mono">
            seen on: {group.contexts.join("  ·  ")}
          </div>
          <div className="space-y-0.5">
            {sorted.slice(0, 30).map((occ, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-1 text-[11px] font-mono border-b border-zinc-900/50 last:border-0"
              >
                <span className="text-zinc-600 w-[88px] shrink-0 tabular-nums">
                  {fmtAbsoluteTime(occ.startTime)}
                </span>
                <span className="text-zinc-400 flex-1 truncate min-w-0">{occ.context}</span>
                <button
                  type="button"
                  onClick={() => onSelectTrace(occ.traceId)}
                  className="text-lime-400 hover:text-lime-300 shrink-0 transition-colors"
                >
                  view trace →
                </button>
              </div>
            ))}
            {sorted.length > 30 && (
              <div className="text-[10px] text-zinc-600 pt-1">
                +{sorted.length - 30} older occurrences
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }): React.ReactElement {
  const max = Math.max(...data, 1);
  const W = 60;
  const H = 20;
  const step = data.length > 1 ? W / (data.length - 1) : W;

  const pts = data
    .map((v, i) => {
      const x = i * step;
      const y = H - 2 - (v / max) * (H - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const flat = data.every((v) => v === 0);

  return (
    <svg width={W} height={H} className="shrink-0">
      {flat ? (
        <line
          x1="0"
          y1={H - 2}
          x2={W}
          y2={H - 2}
          stroke="#3f3f46"
          strokeWidth="1"
        />
      ) : (
        <polyline
          points={pts}
          fill="none"
          stroke="#f87171"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
