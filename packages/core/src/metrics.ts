import { monitorEventLoopDelay, PerformanceObserver } from "node:perf_hooks";

export interface MetricSample {
  ts: number;
  eventLoopLag: number; // ms (mean over interval)
  heapUsed: number;     // bytes
  heapTotal: number;    // bytes
  rss: number;          // bytes
  cpuPercent: number;   // 0–100
  gcDuration: number;   // ms of GC pause in this interval
}

export type MetricListener = (sample: MetricSample) => void;

const INTERVAL_MS = 5_000;
const MAX_SAMPLES = 720; // 1h at 5s interval

export class MetricsCollector {
  private readonly samples: MetricSample[] = [];
  private readonly listeners = new Set<MetricListener>();

  private timer: NodeJS.Timeout | undefined;
  private eld: ReturnType<typeof monitorEventLoopDelay> | undefined;
  private gcObserver: PerformanceObserver | undefined;

  private gcAccum = 0;
  private prevCpu = process.cpuUsage();
  private prevCpuTime = Date.now();

  start(): void {
    this.eld = monitorEventLoopDelay({ resolution: 20 });
    this.eld.enable();

    try {
      this.gcObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.gcAccum += entry.duration;
        }
      });
      this.gcObserver.observe({ entryTypes: ["gc"] });
    } catch {
      // gc perf entries unavailable in this environment
    }

    this.timer = setInterval(() => { this.collect(); }, INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    clearInterval(this.timer);
    this.eld?.disable();
    this.gcObserver?.disconnect();
    this.timer = undefined;
    this.eld = undefined;
    this.gcObserver = undefined;
  }

  list(): MetricSample[] {
    return this.samples.slice();
  }

  subscribe(listener: MetricListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private collect(): void {
    const now = Date.now();
    const elapsedMs = now - this.prevCpuTime;

    const cpuDelta = process.cpuUsage(this.prevCpu);
    const cpuPercent = elapsedMs > 0
      ? Math.min(100, ((cpuDelta.user + cpuDelta.system) / 1000 / elapsedMs) * 100)
      : 0;
    this.prevCpu = process.cpuUsage();
    this.prevCpuTime = now;

    const mem = process.memoryUsage();
    const eldMean = this.eld?.mean ?? 0; // nanoseconds
    this.eld?.reset();

    const sample: MetricSample = {
      ts: now,
      eventLoopLag: eldMean / 1e6,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      cpuPercent,
      gcDuration: this.gcAccum,
    };
    this.gcAccum = 0;

    if (this.samples.length >= MAX_SAMPLES) {
      this.samples.shift();
    }
    this.samples.push(sample);

    for (const listener of this.listeners) {
      listener(sample);
    }
  }
}
