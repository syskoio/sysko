import type { SpanLogLevel } from "@syskoio/storage";
import { spanContext } from "./context.js";
import { getActiveHandle } from "./span-factory.js";

type PatchedLevel = "log" | "info" | "warn" | "error";

const LEVELS: PatchedLevel[] = ["log", "info", "warn", "error"];

function argToString(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function activateConsoleInstrumentation(): () => void {
  const originals = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  } as const;

  for (const level of LEVELS) {
    const orig = originals[level];
    console[level] = (...args: unknown[]): void => {
      orig(...args);
      const ctx = spanContext.getStore();
      if (!ctx?.sampled || !ctx.spanId) return;
      const handle = getActiveHandle(ctx.spanId);
      if (!handle) return;
      handle.addLog(level as SpanLogLevel, args.map(argToString).join(" "));
    };
  }

  return () => {
    console.log = originals.log;
    console.info = originals.info;
    console.warn = originals.warn;
    console.error = originals.error;
  };
}
