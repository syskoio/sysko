export interface SpanError {
  message: string;
  stack?: string;
  name?: string;
}

export interface SpanLog {
  ts: number;
  level: "log" | "info" | "warn" | "error";
  message: string;
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  kind: string;
  name: string;
  startTime: number;
  duration: number;
  status: "ok" | "error";
  error?: SpanError;
  logs?: SpanLog[];
  attributes: {
    "http.method"?: string;
    "http.path"?: string;
    "http.route"?: string;
    "http.target"?: string;
    "http.status_code"?: number;
    "http.url"?: string;
    "http.host"?: string;
    "http.aborted"?: boolean;
    "db.system"?: string;
    "db.operation"?: string;
    "db.model"?: string;
    "db.statement"?: string;
    [k: string]: string | number | boolean | undefined;
  };
}

export interface MetricSample {
  ts: number;
  eventLoopLag: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  cpuPercent: number;
  gcDuration: number;
}

export type WsMessage =
  | { type: "history"; spans: Span[] }
  | { type: "span"; span: Span }
  | { type: "metrics-history"; samples: MetricSample[] }
  | { type: "metric"; sample: MetricSample };

export type ConnState = "connecting" | "connected" | "disconnected";
