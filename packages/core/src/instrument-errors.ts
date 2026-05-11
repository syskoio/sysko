import { randomUUID } from "node:crypto";
import type { Span, SpanError, SpanStore } from "@sysko/storage";
import { spanContext } from "./context.js";
import { getActiveHandle } from "./span-factory.js";

let active = false;
let store: SpanStore | null = null;

function toError(err: unknown): SpanError {
  if (err instanceof Error) {
    const result: SpanError = { message: err.message };
    if (err.stack !== undefined) result.stack = err.stack;
    if (err.name !== undefined) result.name = err.name;
    return result;
  }
  return { message: String(err) };
}

function emitOrphanErrorSpan(err: unknown): void {
  if (!store) return;
  const id = randomUUID();
  const span: Span = {
    id,
    traceId: id,
    kind: "internal",
    name: "uncaught error",
    startTime: Date.now(),
    duration: 0,
    status: "error",
    attributes: { "error.uncaught": true },
    error: toError(err),
  };
  store.push(span);
}

function handleError(err: unknown): void {
  if (!active) return;
  const ctx = spanContext.getStore();
  if (ctx) {
    const handle = getActiveHandle(ctx.spanId);
    if (handle) {
      handle.setStatus("error", err);
      return;
    }
  }
  emitOrphanErrorSpan(err);
}

function onUncaughtException(err: Error): void {
  handleError(err);
}

function onUnhandledRejection(reason: unknown): void {
  handleError(reason);
}

export function activateErrorInstrumentation(s: SpanStore): () => void {
  store = s;
  active = true;
  process.on("uncaughtException", onUncaughtException);
  process.on("unhandledRejection", onUnhandledRejection);
  return () => {
    active = false;
    store = null;
    process.off("uncaughtException", onUncaughtException);
    process.off("unhandledRejection", onUnhandledRejection);
  };
}
