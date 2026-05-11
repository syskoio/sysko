import type { Span, SpanStore } from "@sysko/storage";

export interface AlertRule {
  name: string;
  type: "p95" | "errorRate" | "spanCount";
  /** ms for p95, 0–1 for errorRate, raw count for spanCount */
  threshold: number;
  /** seconds — default 60 */
  window?: number;
  /** minutes — default 15 */
  cooldown?: number;
  /** HTTP endpoint to POST (Slack / Discord / generic webhook) */
  webhook: string;
}

export interface AlertFired {
  ts: number;
  ruleName: string;
  type: AlertRule["type"];
  value: number;
  threshold: number;
}

type AlertListener = (alert: AlertFired) => void;

const MAX_HISTORY = 200;
const CHECK_INTERVAL_MS = 30_000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx] ?? 0;
}

function computeValue(type: AlertRule["type"], spans: Span[]): number {
  if (type === "spanCount") return spans.length;

  if (type === "errorRate") {
    const http = spans.filter((s) => s.kind === "http.server");
    if (http.length === 0) return 0;
    return http.filter((s) => s.status === "error").length / http.length;
  }

  const durations = spans.map((s) => s.duration).sort((a, b) => a - b);
  return percentile(durations, 0.95);
}

function fmtValue(type: AlertRule["type"], value: number): string {
  if (type === "errorRate") return `${(value * 100).toFixed(1)}%`;
  if (type === "p95") return `${value.toFixed(1)}ms`;
  return String(Math.round(value));
}

export class AlertEngine {
  private readonly rules: AlertRule[];
  private readonly store: SpanStore;
  private readonly history: AlertFired[] = [];
  private readonly listeners = new Set<AlertListener>();
  private readonly lastFired = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(rules: AlertRule[], store: SpanStore) {
    this.rules = rules;
    this.store = store;
  }

  start(): void {
    this.timer = setInterval(() => {
      this.check().catch(() => {});
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  list(): AlertFired[] {
    return [...this.history];
  }

  subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async check(): Promise<void> {
    const now = Date.now();
    const allSpans = this.store.list();

    for (const rule of this.rules) {
      const windowMs = (rule.window ?? 60) * 1000;
      const cooldownMs = (rule.cooldown ?? 15) * 60_000;
      const lastAt = this.lastFired.get(rule.name) ?? 0;

      if (now - lastAt < cooldownMs) continue;

      const windowSpans = allSpans.filter((s) => s.startTime >= now - windowMs);
      const value = computeValue(rule.type, windowSpans);

      if (value > rule.threshold) {
        const fired: AlertFired = {
          ts: now,
          ruleName: rule.name,
          type: rule.type,
          value,
          threshold: rule.threshold,
        };
        this.lastFired.set(rule.name, now);
        this.history.push(fired);
        if (this.history.length > MAX_HISTORY) this.history.shift();
        for (const listener of this.listeners) listener(fired);
        await this.sendWebhook(rule, fired).catch(() => {});
      }
    }
  }

  private async sendWebhook(rule: AlertRule, fired: AlertFired): Promise<void> {
    const val = fmtValue(rule.type, fired.value);
    const thr = fmtValue(rule.type, fired.threshold);
    const text = `[sysko] "${rule.name}" breached: ${rule.type}=${val} (threshold ${thr})`;

    await fetch(rule.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text, alert: fired }),
    });
  }
}
