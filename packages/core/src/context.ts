import { AsyncLocalStorage } from "node:async_hooks";

export interface SpanContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

export const spanContext = new AsyncLocalStorage<SpanContext>();

export function getCurrentContext(): SpanContext | undefined {
  return spanContext.getStore();
}

export function getCurrentSpanId(): string | undefined {
  const ctx = spanContext.getStore();
  return ctx?.sampled ? ctx.spanId : undefined;
}

export function getCurrentTraceId(): string | undefined {
  const ctx = spanContext.getStore();
  return ctx?.sampled ? ctx.traceId : undefined;
}
