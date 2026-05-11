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

    let finalized = false;
    const finishOk = (): void => {
      if (finalized) return;
      finalized = true;
      span.setAttribute("http.status_code", res.statusCode);
      if (res.statusCode >= 500) span.setStatus("error");
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
