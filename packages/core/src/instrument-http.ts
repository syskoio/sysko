import { Server as HttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { SpanStore } from "@syskoio/storage";
import { INTERNAL_SERVER } from "@syskoio/transport";
import { spanContext, type SpanContext } from "./context.js";
import { setActiveStore, startSpanWithContext } from "./span-factory.js";

let patched = false;
let active = false;
let activeServiceName: string | undefined;

// Parses the W3C traceparent header and returns an external SpanContext
// to continue the incoming distributed trace.
function parseTraceparent(header: string): SpanContext | null {
  const parts = header.trim().split("-");
  if (parts.length < 4) return null;
  const [ver, traceHex, spanHex, flags] = parts;
  if (ver !== "00" || traceHex?.length !== 32 || spanHex?.length !== 16) return null;
  const sampled = (parseInt(flags ?? "0", 16) & 1) === 1;
  // Convert 32-hex traceId to UUID format for internal storage
  const traceId = [
    traceHex.slice(0, 8),
    traceHex.slice(8, 12),
    traceHex.slice(12, 16),
    traceHex.slice(16, 20),
    traceHex.slice(20, 32),
  ].join("-");
  // spanHex (16 chars) becomes the spanId — it identifies the upstream span
  // and will be stored as parentSpanId on our root span.
  return { traceId, spanId: spanHex, sampled };
}

type RawEmit = (this: HttpServer, event: string | symbol, ...args: unknown[]) => boolean;

function pathOf(rawUrl: string | undefined): string {
  if (!rawUrl) return "/";
  const q = rawUrl.indexOf("?");
  return q === -1 ? rawUrl : rawUrl.slice(0, q);
}

function ensurePatched(): void {
  if (patched) return;
  patched = true;

  const originalEmit = HttpServer.prototype.emit as unknown as RawEmit;

  const patchedEmit: RawEmit = function patchedEmit(this: HttpServer, event, ...args) {
    if (!active || event !== "request") {
      return originalEmit.call(this, event, ...args);
    }
    if ((this as unknown as Record<symbol, unknown>)[INTERNAL_SERVER] === true) {
      return originalEmit.call(this, event, ...args);
    }

    const req = args[0] as IncomingMessage | undefined;
    const res = args[1] as ServerResponse | undefined;
    if (!req || !res) {
      return originalEmit.call(this, event, ...args);
    }

    const method = req.method ?? "UNKNOWN";
    const path = pathOf(req.url);

    const traceparentHeader = req.headers["traceparent"];
    const upstream = typeof traceparentHeader === "string"
      ? parseTraceparent(traceparentHeader)
      : null;

    const attrs: Record<string, string | number | boolean> = {
      "http.method": method,
      "http.path": path,
    };
    if (activeServiceName) attrs["service.name"] = activeServiceName;

    const { handle: span, context } = startSpanWithContext(
      { kind: "http.server", name: `${method} ${path}`, attributes: attrs },
      upstream ?? undefined,
    );

    // Capture up to 2 KB of response body to surface as error.message on 4xx/5xx.
    // Cast required because write/end have complex overloads not expressible generically.
    let errorBody = "";
    const MAX_BODY = 2048;
    const captureChunk = (chunk: unknown): void => {
      if (errorBody.length >= MAX_BODY) return;
      const text =
        typeof chunk === "string"
          ? chunk
          : Buffer.isBuffer(chunk) || chunk instanceof Uint8Array
          ? Buffer.from(chunk).toString("utf8")
          : null;
      if (text !== null) {
        errorBody += errorBody.length + text.length > MAX_BODY
          ? text.slice(0, MAX_BODY - errorBody.length) + "…"
          : text;
      }
    };
    type AnyFn = (...args: unknown[]) => unknown;
    const origWrite = (res.write as unknown as AnyFn).bind(res);
    const origEnd = (res.end as unknown as AnyFn).bind(res);
    (res as unknown as { write: AnyFn }).write = (...args) => { captureChunk(args[0]); return origWrite(...args); };
    (res as unknown as { end: AnyFn }).end = (...args) => { captureChunk(args[0]); return origEnd(...args); };

    let finalized = false;
    const finishOk = (): void => {
      if (finalized) return;
      finalized = true;
      const status = res.statusCode;
      span.setAttribute("http.status_code", status);
      if (status >= 400) {
        const body = errorBody.trim();
        span.setStatus("error", body
          ? { message: body, name: `HTTP ${status}` }
          : { message: `HTTP ${status}`, name: `HTTP ${status}` });
      }
      span.end();
    };
    const closeMaybeAborted = (): void => {
      if (finalized) return;
      finalized = true;
      if (res.headersSent) {
        span.setAttribute("http.status_code", res.statusCode);
      }
      span.setAttribute("http.aborted", true);
      span.setStatus("error");
      span.end();
    };

    res.once("finish", finishOk);
    res.once("close", closeMaybeAborted);

    return spanContext.run(context, () => originalEmit.call(this, event, ...args));
  };

  HttpServer.prototype.emit = patchedEmit as unknown as typeof HttpServer.prototype.emit;
}

export function activateHttpInstrumentation(store: SpanStore, serviceName?: string): () => void {
  activeServiceName = serviceName;
  ensurePatched();
  setActiveStore(store);
  active = true;
  return () => {
    active = false;
    activeServiceName = undefined;
    setActiveStore(null);
  };
}
