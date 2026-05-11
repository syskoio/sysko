import type { Span } from "./types";

interface TraceExport {
  traceId: string;
  exportedAt: string;
  source: "sysko";
  rootSpan: { id: string; name: string; duration: number } | undefined;
  spans: Span[];
}

export function exportTrace(traceId: string, spans: Span[]): void {
  const root = spans.find((s) => s.parentSpanId === undefined);
  const payload: TraceExport = {
    traceId,
    exportedAt: new Date().toISOString(),
    source: "sysko",
    rootSpan: root ? { id: root.id, name: root.name, duration: root.duration } : undefined,
    spans: spans.slice().sort((a, b) => a.startTime - b.startTime),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sysko-trace-${traceId.slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
