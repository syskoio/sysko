import type { Span } from "@sysko/storage";

export interface ExportOptions {
  url: string;
  batchSize?: number;
  flushInterval?: number;
}

export class SpanExporter {
  private readonly url: string;
  private readonly batchSize: number;
  private readonly queue: Span[] = [];
  private readonly timer: ReturnType<typeof setInterval>;
  private flushing = false;

  constructor(options: ExportOptions) {
    this.url = options.url.replace(/\/$/, "");
    this.batchSize = options.batchSize ?? 50;
    this.timer = setInterval(() => { void this.flush(); }, options.flushInterval ?? 1000);
    // Don't keep the process alive just for the flush interval.
    this.timer.unref();
  }

  enqueue(span: Span): void {
    this.queue.push(span);
    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    const batch = this.queue.splice(0, this.batchSize);
    try {
      await globalThis.fetch(`${this.url}/v1/spans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Silent drop — collector may be temporarily down.
      // Re-queuing would risk unbounded memory growth.
    } finally {
      this.flushing = false;
    }
  }

  stop(): void {
    clearInterval(this.timer);
    void this.flush();
  }
}
