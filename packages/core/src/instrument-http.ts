import { Server as HttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { SpanStore } from "@sysko/storage";
import { INTERNAL_SERVER } from "@sysko/transport";
import { spanContext } from "./context.js";
import { setActiveStore, startSpanWithContext } from "./span-factory.js";

let patched = false;
let active = false;

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
    const { handle: span, context } = startSpanWithContext({
      kind: "http.server",
      name: `${method} ${path}`,
      attributes: { "http.method": method, "http.path": path },
    });

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

export function activateHttpInstrumentation(store: SpanStore): () => void {
  ensurePatched();
  setActiveStore(store);
  active = true;
  return () => {
    active = false;
    setActiveStore(null);
  };
}
