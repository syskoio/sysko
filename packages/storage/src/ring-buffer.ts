import type { Span } from "./span.js";

export type SpanListener = (span: Span) => void;

export interface SpanStore {
  push(span: Span): void;
  list(): Span[];
  subscribe(listener: SpanListener): () => void;
}

const DEFAULT_CAPACITY = 1000;

export class RingBuffer implements SpanStore {
  private readonly capacity: number;
  private readonly items: (Span | undefined)[];
  private head = 0;
  private size = 0;
  private readonly listeners = new Set<SpanListener>();

  constructor(capacity: number = DEFAULT_CAPACITY) {
    if (capacity <= 0) {
      throw new Error("RingBuffer capacity must be > 0");
    }
    this.capacity = capacity;
    this.items = new Array<Span | undefined>(capacity);
  }

  push(span: Span): void {
    this.items[this.head] = span;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
    for (const listener of this.listeners) {
      listener(span);
    }
  }

  list(): Span[] {
    const result: Span[] = [];
    const start = this.size < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.size; i++) {
      const idx = (start + i) % this.capacity;
      const item = this.items[idx];
      if (item) result.push(item);
    }
    return result;
  }

  subscribe(listener: SpanListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
