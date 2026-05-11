export type SpanKind = "http.server" | "http.client" | "db.query" | "internal" | "cache.command" | "queue.publish" | "queue.consume";

export type SpanStatus = "ok" | "error";

export type SpanLogLevel = "log" | "info" | "warn" | "error";

export interface SpanLog {
  ts: number;
  level: SpanLogLevel;
  message: string;
}

export interface SpanError {
  message: string;
  stack?: string;
  name?: string;
}

export interface SpanAttributes {
  "http.method"?: string;
  "http.path"?: string;
  "http.status_code"?: number;
  "http.url"?: string;
  "http.host"?: string;
  "db.system"?: string;
  "db.operation"?: string;
  "db.statement"?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  kind: SpanKind;
  name: string;
  startTime: number;
  duration: number;
  status: SpanStatus;
  attributes: SpanAttributes;
  error?: SpanError;
  logs?: SpanLog[];
}
