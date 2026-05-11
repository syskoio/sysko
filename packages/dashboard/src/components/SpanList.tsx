import { useMemo } from "react";
import { AlertTriangle, GitBranch } from "lucide-react";
import type { Span } from "../lib/types";
import { fmtDuration, fmtRelativeTime } from "../lib/format";
import { durationBar, methodPill, statusColor } from "../lib/colors";
import { Pill } from "./ui/Pill";

export interface SpanListProps {
  rootSpans: Span[];
  allSpans: Span[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  isNew: (id: string) => boolean;
}

export function SpanList({ rootSpans, allSpans, selectedId, onSelect, isNew }: SpanListProps): React.ReactElement {
  const childCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allSpans) {
      if (s.parentSpanId === undefined) continue;
      map.set(s.traceId, (map.get(s.traceId) ?? 0) + 1);
    }
    return map;
  }, [allSpans]);

  const maxDuration = useMemo(() => {
    if (rootSpans.length === 0) return 0;
    return Math.max(...rootSpans.map((s) => s.duration));
  }, [rootSpans]);

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-zinc-950 z-10">
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-zinc-500 border-b border-zinc-900">
            <th className="font-medium px-5 py-2 w-16">method</th>
            <th className="font-medium px-2 py-2">path</th>
            <th className="font-medium px-2 py-2 w-16">status</th>
            <th className="font-medium px-2 py-2 w-12 text-center">trace</th>
            <th className="font-medium px-2 py-2 w-40">duration</th>
            <th className="font-medium px-5 py-2 w-20 text-right">time</th>
          </tr>
        </thead>
        <tbody>
          {rootSpans.map((s) => {
            const isSelected = s.id === selectedId;
            const fresh = isNew(s.id);
            const method = s.attributes["http.method"] ?? "?";
            const route = s.attributes["http.route"];
            const rawPath = s.attributes["http.path"];
            const path = route ?? rawPath ?? s.name;
            const code = s.attributes["http.status_code"];
            const mp = methodPill(method);
            const bar = durationBar(s.duration, maxDuration);
            const children = childCounts.get(s.traceId) ?? 0;
            const isErr = s.status === "error";

            return (
              <tr
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={
                  "border-b border-zinc-900 cursor-pointer transition-colors group " +
                  (isSelected
                    ? "bg-lime-300/[0.06] border-l-2 border-l-lime-300"
                    : fresh
                    ? "bg-zinc-900/40 hover:bg-zinc-900/60"
                    : "hover:bg-zinc-900/40") +
                  (isErr && !isSelected ? " border-l-2 border-l-red-500/30" : "")
                }
              >
                <td className="px-5 py-2">
                  <Pill bg={mp.bg} text={mp.text}>{method}</Pill>
                </td>
                <td className="px-2 py-2 font-mono text-zinc-200 truncate max-w-0">
                  <div className="flex items-center gap-1.5">
                    {isErr && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
                    <span className="truncate">{path}</span>
                  </div>
                </td>
                <td className={"px-2 py-2 font-mono tabular-nums " + statusColor(code, isErr)}>
                  {s.attributes["http.aborted"] === true ? (
                    <span title="aborted before response completed">abort</span>
                  ) : (
                    code ?? "—"
                  )}
                </td>
                <td className="px-2 py-2">
                  {children > 0 ? (
                    <div className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                      <GitBranch className="h-3 w-3 text-lime-300/70" />
                      <span className="tabular-nums">{children}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-700 font-mono text-[11px]">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden min-w-[40px]">
                      <div
                        className={"h-full rounded-full transition-all " + bar.color}
                        style={{ width: bar.width }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-[11.5px] text-zinc-400 w-14 text-right">
                      {fmtDuration(s.duration)}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-2 font-mono tabular-nums text-[11px] text-zinc-500 text-right whitespace-nowrap">
                  {fmtRelativeTime(s.startTime)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
