import { useMemo } from "react";
import type { Span } from "./types";

export interface ErrorOccurrence {
  spanId: string;
  traceId: string;
  startTime: number;
  context: string;
}

export interface ErrorGroup {
  fingerprint: string;
  errorName: string;
  message: string;
  count: number;
  lastSeen: number;
  contexts: string[];
  occurrences: ErrorOccurrence[];
  trend: number[];
}

const HOURS = 24;

function extractTopFrame(stack: string): string {
  const lines = stack.split("\n");
  const frameLine = lines.find((l) => l.trim().startsWith("at "));
  if (!frameLine) return "";
  return frameLine
    .trim()
    .replace(/\(.*[/\\]([^/\\:]+:\d+)(?::\d+)?\)/, "($1)")
    .replace(/^at\s+/, "");
}

function makeFingerprint(span: Span): string {
  const errorName = span.error?.name ?? "Error";
  const frame = span.error?.stack ? extractTopFrame(span.error.stack) : "";
  const key = frame || (span.error?.message ?? "").slice(0, 80);
  return `${errorName}:${key}`;
}

function spanContext(span: Span): string {
  const method = span.attributes["http.method"];
  const path = span.attributes["http.route"] ?? span.attributes["http.path"];
  if (method && path) return `${method} ${String(path)}`;
  if (path) return String(path);
  return span.name;
}

export function useErrors(spans: Span[]): ErrorGroup[] {
  return useMemo(() => {
    const now = Date.now();
    const groups = new Map<string, ErrorGroup>();

    for (const span of spans) {
      if (span.status !== "error" || !span.error) continue;

      const fp = makeFingerprint(span);
      const ctx = spanContext(span);

      let group = groups.get(fp);
      if (!group) {
        group = {
          fingerprint: fp,
          errorName: span.error.name ?? "Error",
          message: span.error.message,
          count: 0,
          lastSeen: span.startTime,
          contexts: [],
          occurrences: [],
          trend: new Array<number>(HOURS).fill(0),
        };
        groups.set(fp, group);
      }

      group.count++;
      if (span.startTime > group.lastSeen) group.lastSeen = span.startTime;
      if (!group.contexts.includes(ctx)) group.contexts.push(ctx);

      group.occurrences.push({
        spanId: span.id,
        traceId: span.traceId,
        startTime: span.startTime,
        context: ctx,
      });

      const hoursAgo = Math.floor((now - span.startTime) / (60 * 60 * 1000));
      if (hoursAgo < HOURS) {
        const idx = HOURS - 1 - hoursAgo;
        group.trend[idx] = (group.trend[idx] ?? 0) + 1;
      }
    }

    return [...groups.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }, [spans]);
}
