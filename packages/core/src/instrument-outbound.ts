import http from "node:http";
import https from "node:https";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import { startSpan, type SpanHandle } from "./span-factory.js";

export interface OutboundIgnore {
  host: string;
  port: number;
}

let patched = false;
let active = false;
let ignoreEndpoints: OutboundIgnore[] = [];

// Builds a W3C traceparent header value from a span's internal UUID-based IDs.
// traceId (UUID, 36 chars) → 32-hex; spanId (UUID, 36 chars) → first 16 hex.
function makeTraceparent(traceId: string, spanId: string): string {
  const traceHex = traceId.replace(/-/g, "");
  const spanHex = spanId.replace(/-/g, "").slice(0, 16);
  return `00-${traceHex}-${spanHex}-01`;
}

type RequestFn = typeof http.request;

interface NormalizedReq {
  method: string;
  url: string;
  host: string;
  port: number;
  path: string;
}

function normalize(
  protocol: "http:" | "https:",
  args: Parameters<RequestFn>,
): NormalizedReq | undefined {
  let urlOrOptions: string | URL | RequestOptions | undefined;
  let options: RequestOptions | undefined;

  if (typeof args[0] === "string" || args[0] instanceof URL) {
    urlOrOptions = args[0];
    if (typeof args[1] === "object" && args[1] !== null && !(args[1] instanceof Function)) {
      options = args[1] as RequestOptions;
    }
  } else if (typeof args[0] === "object" && args[0] !== null) {
    options = args[0] as RequestOptions;
  }

  let host = "localhost";
  let port = protocol === "https:" ? 443 : 80;
  let path = "/";
  let method = "GET";

  if (typeof urlOrOptions === "string" || urlOrOptions instanceof URL) {
    const u = urlOrOptions instanceof URL ? urlOrOptions : new URL(urlOrOptions);
    host = u.hostname;
    if (u.port) port = parseInt(u.port, 10);
    path = u.pathname + u.search;
  }

  if (options) {
    if (typeof options.host === "string") host = options.host;
    if (typeof options.hostname === "string") host = options.hostname;
    if (typeof options.port === "number") port = options.port;
    else if (typeof options.port === "string") port = parseInt(options.port, 10);
    if (typeof options.path === "string") path = options.path;
    if (typeof options.method === "string") method = options.method;
  }

  const cleanPath = path.split("?")[0] ?? "/";
  return {
    method,
    url: `${protocol}//${host}${port !== (protocol === "https:" ? 443 : 80) ? ":" + port : ""}${path}`,
    host,
    port,
    path: cleanPath,
  };
}

function sameHost(a: string, b: string): boolean {
  if (a === b) return true;
  const local = new Set(["127.0.0.1", "localhost", "::1"]);
  return local.has(a) && local.has(b);
}

function shouldIgnore(host: string, port: number): boolean {
  return ignoreEndpoints.some((ie) => sameHost(host, ie.host) && port === ie.port);
}

function wrapRequest(protocol: "http:" | "https:", original: RequestFn): RequestFn {
  return function patchedRequest(this: unknown, ...args: Parameters<RequestFn>): ClientRequest {
    if (!active) {
      return original.apply(this as never, args);
    }
    const meta = normalize(protocol, args);
    if (!meta || shouldIgnore(meta.host, meta.port)) {
      return original.apply(this as never, args);
    }

    const span = startSpan({
      kind: "http.client",
      name: `${meta.method} ${meta.host}${meta.path}`,
      attributes: {
        "http.method": meta.method,
        "http.url": meta.url,
        "http.host": meta.host,
        "http.path": meta.path,
      },
    });

    const req = original.apply(this as never, args);

    // Inject traceparent so downstream services can continue the trace.
    // setHeader is safe here — headers aren't sent until req.end() or req.write().
    if (span.id) {
      req.setHeader("traceparent", makeTraceparent(span.traceId, span.id));
    }

    let ended = false;
    const finalize = (): void => {
      if (ended) return;
      ended = true;
      span.end();
    };

    req.once("response", (res: IncomingMessage) => {
      const status = res.statusCode ?? 0;
      span.setAttribute("http.status_code", status);
      if (status >= 500) span.setStatus("error");
      res.once("end", finalize);
      res.once("close", finalize);
      res.once("error", (err) => {
        span.setStatus("error", err);
        finalize();
      });
    });
    req.once("error", (err) => {
      span.setStatus("error", err);
      finalize();
    });
    req.once("close", finalize);

    return req;
  } as RequestFn;
}

function wrapFetch(originalFetch: typeof globalThis.fetch): typeof globalThis.fetch {
  return async function patchedFetch(input, init) {
    if (!active) return originalFetch(input, init);

    let url: URL;
    try {
      if (typeof input === "string") url = new URL(input);
      else if (input instanceof URL) url = input;
      else url = new URL((input as Request).url);
    } catch {
      return originalFetch(input, init);
    }

    const port = url.port ? parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;
    if (shouldIgnore(url.hostname, port)) {
      return originalFetch(input, init);
    }

    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const path = url.pathname;
    const span = startSpan({
      kind: "http.client",
      name: `${method} ${url.hostname}${path}`,
      attributes: {
        "http.method": method,
        "http.url": url.toString(),
        "http.host": url.hostname,
        "http.path": path,
      },
    });

    // Inject traceparent into fetch — build new headers preserving existing ones.
    let modifiedInit = init;
    if (span.id) {
      const h = new Headers(init?.headers);
      h.set("traceparent", makeTraceparent(span.traceId, span.id));
      modifiedInit = { ...init, headers: h };
    }

    try {
      const res = await originalFetch(input, modifiedInit);
      span.setAttribute("http.status_code", res.status);
      if (res.status >= 500) span.setStatus("error");
      span.end();
      return res;
    } catch (err) {
      span.setStatus("error", err);
      span.end();
      throw err;
    }
  };
}

function ensurePatched(): void {
  if (patched) return;
  patched = true;

  const httpMod = http as { request: RequestFn; get: RequestFn };
  const httpsMod = https as { request: RequestFn; get: RequestFn };

  httpMod.request = wrapRequest("http:", http.request);
  httpsMod.request = wrapRequest("https:", https.request);
  httpMod.get = wrapRequest("http:", http.get as unknown as RequestFn) as RequestFn;
  httpsMod.get = wrapRequest("https:", https.get as unknown as RequestFn) as RequestFn;

  if (typeof globalThis.fetch === "function") {
    globalThis.fetch = wrapFetch(globalThis.fetch);
  }
}

export function activateOutboundInstrumentation(ignore: OutboundIgnore[] = []): () => void {
  ignoreEndpoints = ignore;
  ensurePatched();
  active = true;
  return () => {
    active = false;
    ignoreEndpoints = [];
  };
}
