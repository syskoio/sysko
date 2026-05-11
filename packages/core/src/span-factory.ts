import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { Span, SpanAttributes, SpanError, SpanKind, SpanLog, SpanLogLevel, SpanStore } from "@sysko/storage";
import { spanContext, type SpanContext } from "./context.js";
import { applyHooks } from "./hooks.js";

export interface StartSpanOptions {
  kind: SpanKind;
  name: string;
  attributes?: SpanAttributes;
}

export interface SpanHandle {
  readonly id: string;
  readonly traceId: string;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: "ok" | "error", error?: unknown): void;
  addLog(level: SpanLogLevel, message: string): void;
  end(): void;
}

let activeStore: SpanStore | null = null;
let samplingRate = 1;
let rateLimit = Infinity;
let rateBucket = Infinity;
let rateLastRefill = 0;

export function setActiveStore(store: SpanStore | null): void {
  activeStore = store;
}

export function setSamplingRate(rate: number): void {
  samplingRate = Math.max(0, Math.min(1, rate));
}

export function setRateLimit(spansPerSecond: number): void {
  rateLimit = spansPerSecond > 0 ? spansPerSecond : Infinity;
  rateBucket = rateLimit;
  rateLastRefill = Date.now();
}

function acquireRateToken(): boolean {
  if (rateLimit === Infinity) return true;
  const now = Date.now();
  const elapsed = (now - rateLastRefill) / 1000;
  rateBucket = Math.min(rateLimit, rateBucket + elapsed * rateLimit);
  rateLastRefill = now;
  if (rateBucket >= 1) {
    rateBucket -= 1;
    return true;
  }
  return false;
}

const activeHandles = new Map<string, SpanHandle>();

export function getActiveHandle(spanId: string): SpanHandle | undefined {
  return activeHandles.get(spanId);
}

const NOOP_HANDLE: SpanHandle = {
  id: "",
  traceId: "",
  setAttribute() {},
  setStatus() {},
  addLog() {},
  end() {},
};

function toError(err: unknown): SpanError {
  if (err instanceof Error) {
    const result: SpanError = { message: err.message };
    if (err.stack !== undefined) result.stack = err.stack;
    if (err.name !== undefined) result.name = err.name;
    return result;
  }
  // plain object with message (e.g. { message, name } from HTTP body capture)
  if (typeof err === "object" && err !== null && "message" in err) {
    const obj = err as { message: unknown; name?: unknown };
    const result: SpanError = { message: String(obj.message) };
    if (typeof obj.name === "string") result.name = obj.name;
    return result;
  }
  return { message: String(err) };
}

function decideSampling(parent: SpanContext | undefined): boolean {
  if (parent) return parent.sampled;
  return Math.random() < samplingRate;
}

function createSpanHandle(opts: StartSpanOptions, parent: SpanContext | undefined): {
  handle: SpanHandle;
  context: SpanContext;
} {
  const sampled = decideSampling(parent);

  if (!sampled) {
    return {
      handle: NOOP_HANDLE,
      context: {
        traceId: parent?.traceId ?? "",
        spanId: "",
        sampled: false,
      },
    };
  }

  const id = randomUUID();
  const traceId = parent?.traceId ?? id;
  const startTime = Date.now();
  const startPerf = performance.now();
  const attributes: SpanAttributes = { ...(opts.attributes ?? {}) };
  const logs: SpanLog[] = [];

  let status: "ok" | "error" = "ok";
  let error: SpanError | undefined;
  let ended = false;

  const handle: SpanHandle = {
    id,
    traceId,
    setAttribute(key, value) {
      attributes[key] = value;
    },
    setStatus(s, err) {
      status = s;
      // first error set wins — thrown exceptions always fire before the HTTP finish handler
      if (s === "error" && err !== undefined && error === undefined) {
        error = toError(err);
      }
    },
    addLog(level, message) {
      logs.push({ ts: Date.now(), level, message });
    },
    end() {
      if (ended) return;
      ended = true;
      activeHandles.delete(id);
      const duration = performance.now() - startPerf;
      const span: Span = {
        id,
        traceId,
        kind: opts.kind,
        name: opts.name,
        startTime,
        duration,
        status,
        attributes,
        ...(parent?.spanId !== undefined && parent.spanId !== ""
          ? { parentSpanId: parent.spanId }
          : {}),
        ...(error !== undefined ? { error } : {}),
        ...(logs.length > 0 ? { logs } : {}),
      };
      const transformed = applyHooks(span);
      if (transformed && activeStore && acquireRateToken()) {
        activeStore.push(transformed);
      }
    },
  };

  activeHandles.set(id, handle);
  return { handle, context: { traceId, spanId: id, sampled: true } };
}

export function startSpan(opts: StartSpanOptions): SpanHandle {
  const parent = spanContext.getStore();
  const { handle } = createSpanHandle(opts, parent);
  return handle;
}

export function startSpanWithContext(opts: StartSpanOptions, explicitParent?: SpanContext): {
  handle: SpanHandle;
  context: SpanContext;
} {
  const parent = explicitParent ?? spanContext.getStore();
  return createSpanHandle(opts, parent);
}

export function withSpan<T>(opts: StartSpanOptions, fn: (span: SpanHandle) => T): T {
  const parent = spanContext.getStore();
  const { handle, context } = createSpanHandle(opts, parent);

  return spanContext.run(context, () => {
    try {
      const result = fn(handle);
      if (result instanceof Promise) {
        return result.then(
          (v) => {
            handle.end();
            return v;
          },
          (err: unknown) => {
            handle.setStatus("error", err);
            handle.end();
            throw err;
          },
        ) as T;
      }
      handle.end();
      return result;
    } catch (err) {
      handle.setStatus("error", err);
      handle.end();
      throw err;
    }
  });
}
