import { useMemo } from "react";
import type { Span } from "../lib/types";
import { fmtDuration } from "../lib/format";
import { methodPill } from "../lib/colors";

export interface RouteEntry {
  key: string;
  method: string;
  path: string;
  count: number;
  p50: number;
  errors: number;
}

export function buildRouteEntries(rootSpans: Span[]): RouteEntry[] {
  const groups = new Map<string, Span[]>();
  for (const s of rootSpans) {
    const method = String(s.attributes["http.method"] ?? "");
    const path = String(s.attributes["http.route"] ?? s.attributes["http.path"] ?? s.name);
    const key = `${method} ${path}`;
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }
  const result: RouteEntry[] = [];
  for (const [key, group] of groups) {
    const durations = group.map((s) => s.duration).sort((a, b) => a - b);
    const first = group[0];
    if (!first) continue;
    result.push({
      key,
      method: String(first.attributes["http.method"] ?? ""),
      path: String(first.attributes["http.route"] ?? first.attributes["http.path"] ?? first.name),
      count: group.length,
      p50: durations[Math.floor(durations.length * 0.5)] ?? 0,
      errors: group.filter((s) => s.status === "error").length,
    });
  }
  return result.sort((a, b) => b.count - a.count);
}

export interface RoutesListProps {
  rootSpans: Span[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function RoutesList({ rootSpans, selectedKey, onSelect }: RoutesListProps): React.ReactElement {
  const routes = useMemo(() => buildRouteEntries(rootSpans), [rootSpans]);

  return (
    <div className="w-64 shrink-0 border-r border-zinc-900 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-900 shrink-0">
        <span className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">Routes</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {routes.length === 0 && (
          <div className="px-4 py-4 text-[11px] text-zinc-600">no requests yet</div>
        )}
        {routes.map((r) => {
          const mp = methodPill(r.method);
          const isSelected = selectedKey === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onSelect(r.key)}
              className={
                "w-full text-left px-4 py-3 border-b border-zinc-900/50 transition-colors " +
                (isSelected
                  ? "bg-zinc-800 border-l-2 border-l-lime-300"
                  : "hover:bg-zinc-900/60")
              }
            >
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <span
                  className={
                    "shrink-0 text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wide " +
                    mp.bg + " " + mp.text
                  }
                >
                  {r.method || "—"}
                </span>
                <span className="font-mono text-[11.5px] text-zinc-100 truncate">{r.path}</span>
              </div>
              <div className="flex items-center gap-3 pl-0.5">
                <span className="font-mono text-[10.5px] text-zinc-500 tabular-nums">{r.count} calls</span>
                <span className="font-mono text-[10.5px] text-zinc-500 tabular-nums">{fmtDuration(r.p50)}</span>
                {r.errors > 0 && (
                  <span className="font-mono text-[10.5px] text-red-400 tabular-nums">{r.errors} err</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
