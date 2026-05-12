import type { Span } from "@syskoio/storage";

export type SpanHook = (span: Span) => Span | null | void;

const hooks: SpanHook[] = [];

export function addSpanHook(hook: SpanHook): () => void {
  hooks.push(hook);
  return () => {
    const idx = hooks.indexOf(hook);
    if (idx >= 0) hooks.splice(idx, 1);
  };
}

export function clearSpanHooks(): void {
  hooks.length = 0;
}

export function applyHooks(span: Span): Span | null {
  let current: Span = span;
  for (const hook of hooks) {
    let result: Span | null | void;
    try {
      result = hook(current);
    } catch {
      continue;
    }
    if (result === null) return null;
    if (result !== undefined) current = result;
  }
  return current;
}
