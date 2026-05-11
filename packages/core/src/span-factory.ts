import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { Span, SpanAttributes, SpanError, SpanKind, SpanStore } from "@sysko/storage";
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
  end(): void;
}

let activeStore: SpanStore | null = null;
let samplingRate = 1;

export function setActiveStore(store: SpanStore | null): void {
  activeStore = store;
}

export function setSamplingRate(rate: number): void {
  samplingRate = Math.max(0, Math.min(1, rate));
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
  end() {},
};

function toError(err: unknown): SpanError {
  if (err instanceof Error) {
    const result: SpanError = { message: err.message };
    if (err.stack !== undefined) result.stack = err.stack;
    if (err.name !== undefined) result.name = err.name;
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
      if (s === "error" && err !== undefined) error = toError(err);
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
      };
      const transformed = applyHooks(span);
      if (transformed && activeStore) {
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

export function startSpanWithContext(opts: StartSpanOptions): {
  handle: SpanHandle;
  context: SpanContext;
} {
  const parent = spanContext.getStore();
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
