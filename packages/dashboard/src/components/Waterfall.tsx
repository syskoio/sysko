import { Database, Globe, Server, AlertCircle, ChevronRight } from "lucide-react";
import type { Span } from "../lib/types";
import { fmtDuration } from "../lib/format";

export interface WaterfallProps {
  trace: Span[];
  selectedId: string;
  onSelect: (id: string) => void;
}

interface Node {
  span: Span;
  children: Node[];
  depth: number;
}

function buildTree(trace: Span[]): { roots: Node[]; flat: Node[] } {
  const byId = new Map<string, Node>();
  for (const span of trace) {
    byId.set(span.id, { span, children: [], depth: 0 });
  }
  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parentId = node.span.parentSpanId;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const root of roots) root.depth = 0;

  const flat: Node[] = [];
  const visit = (node: Node, depth: number): void => {
    node.depth = depth;
    flat.push(node);
    node.children.sort((a, b) => a.span.startTime - b.span.startTime);
    for (const child of node.children) visit(child, depth + 1);
  };
  roots.sort((a, b) => a.span.startTime - b.span.startTime);
  for (const root of roots) visit(root, 0);

  return { roots, flat };
}

function kindIcon(kind: string): React.ReactNode {
  if (kind === "http.server") return <Server className="h-3 w-3" strokeWidth={2.25} />;
  if (kind === "http.client") return <Globe className="h-3 w-3" strokeWidth={2.25} />;
  if (kind === "db.query") return <Database className="h-3 w-3" strokeWidth={2.25} />;
  if (kind === "internal") return <AlertCircle className="h-3 w-3" strokeWidth={2.25} />;
  return <ChevronRight className="h-3 w-3" strokeWidth={2.25} />;
}

function kindColor(kind: string, isError: boolean): string {
  if (isError) return "bg-red-500/70";
  if (kind === "http.server") return "bg-sky-500/70";
  if (kind === "http.client") return "bg-emerald-500/70";
  if (kind === "db.query") return "bg-violet-500/70";
  if (kind === "internal") return "bg-amber-500/70";
  return "bg-zinc-500/70";
}

export function Waterfall({ trace, selectedId, onSelect }: WaterfallProps): React.ReactElement {
  if (trace.length === 0) {
    return <div className="text-[12px] text-zinc-500 px-5 py-4">no spans in this trace</div>;
  }

  const { flat, roots } = buildTree(trace);

  const rootStart = Math.min(...trace.map((s) => s.startTime));
  const traceEnd = Math.max(...trace.map((s) => s.startTime + s.duration));
  const totalDuration = Math.max(1, traceEnd - rootStart);
  const childCount = trace.length - roots.length;

  return (
    <div className="px-5 pb-4">
      <div className="flex items-center justify-between mb-2 text-[10px] uppercase tracking-wider font-medium text-zinc-500">
        <span>waterfall</span>
        <span className="font-mono normal-case tracking-normal">
          {trace.length} {trace.length === 1 ? "span" : "spans"}
          {childCount > 0 && <span className="text-zinc-600"> · {childCount} child</span>}
          <span className="text-zinc-600"> · {fmtDuration(totalDuration)}</span>
        </span>
      </div>

      <div className="space-y-0.5">
        {flat.map((node) => {
          const s = node.span;
          const offset = s.startTime - rootStart;
          const leftPct = (offset / totalDuration) * 100;
          const widthPct = Math.max(0.5, (s.duration / totalDuration) * 100);
          const isErr = s.status === "error";
          const isSelected = s.id === selectedId;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={
                "w-full text-left group rounded-sm transition-colors " +
                (isSelected ? "bg-lime-300/[0.08]" : "hover:bg-zinc-900/60")
              }
            >
              <div className="flex items-stretch gap-2 py-1 px-1.5">
                <div
                  className="flex items-center gap-1.5 min-w-0"
                  style={{ paddingLeft: node.depth * 14, width: "45%" }}
                >
                  <span className={"shrink-0 " + (isErr ? "text-red-400" : "text-zinc-400")}>
                    {kindIcon(s.kind)}
                  </span>
                  <span className="font-mono text-[11.5px] text-zinc-200 truncate">{s.name}</span>
                </div>

                <div className="relative flex-1 h-4 self-center">
                  <div className="absolute inset-y-1 left-0 right-0 bg-zinc-900 rounded-full" />
                  <div
                    className={"absolute inset-y-1 rounded-full " + kindColor(s.kind, isErr)}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "2px" }}
                  />
                </div>

                <div className="w-14 text-right font-mono tabular-nums text-[11px] text-zinc-400 self-center">
                  {fmtDuration(s.duration)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
