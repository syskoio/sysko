import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import type { Span, SpanStore } from "@sysko/storage";
import { INTERNAL_SERVER } from "./internal-marker.js";
import { FALLBACK_HTML } from "./static-fallback.js";

export interface TransportOptions {
  port?: number;
  host?: string;
  store: SpanStore;
  staticDir?: string;
}

export interface Transport {
  start(): Promise<{ url: string; port: number }>;
  stop(): Promise<void>;
}

const DEFAULT_PORT = 9999;
const DEFAULT_HOST = "127.0.0.1";
const WS_PATH = "/_sysko/ws";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

export function createTransport(options: TransportOptions): Transport {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const store = options.store;
  const staticDir = options.staticDir ? resolve(options.staticDir) : undefined;

  let httpServer: Server | undefined;
  let wss: WebSocketServer | undefined;
  let unsubscribe: (() => void) | undefined;

  async function handleStatic(url: string, res: ServerResponse): Promise<void> {
    if (!staticDir) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(FALLBACK_HTML);
      return;
    }

    const cleanPath = url.split("?")[0] ?? "/";
    const relative = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
    const target = normalize(join(staticDir, relative));

    if (!target.startsWith(staticDir + sep) && target !== staticDir) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }

    try {
      const s = await stat(target);
      if (s.isDirectory()) {
        const indexTarget = join(target, "index.html");
        const content = await readFile(indexTarget);
        res.writeHead(200, { "content-type": MIME[".html"]! });
        res.end(content);
        return;
      }
      const content = await readFile(target);
      const type = MIME[extname(target).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(content);
    } catch {
      try {
        const fallback = await readFile(join(staticDir, "index.html"));
        res.writeHead(200, { "content-type": MIME[".html"]! });
        res.end(fallback);
      } catch {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(FALLBACK_HTML);
      }
    }
  }

  function onRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? "/";
    void handleStatic(url, res);
  }

  function attachClient(ws: WebSocket): void {
    const history = store.list();
    ws.send(JSON.stringify({ type: "history", spans: history }));

    const off = store.subscribe((span: Span) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "span", span }));
      }
    });

    ws.on("close", off);
    ws.on("error", off);
  }

  return {
    async start() {
      const server = createServer(onRequest);
      (server as unknown as Record<symbol, unknown>)[INTERNAL_SERVER] = true;

      const sockets = new WebSocketServer({ noServer: true });
      server.on("upgrade", (req, socket, head) => {
        const url = req.url ?? "";
        if (!url.startsWith(WS_PATH)) {
          socket.destroy();
          return;
        }
        sockets.handleUpgrade(req, socket, head, (ws) => {
          sockets.emit("connection", ws, req);
        });
      });
      sockets.on("connection", attachClient);

      httpServer = server;
      wss = sockets;

      await new Promise<void>((resolveStart, rejectStart) => {
        server.once("error", rejectStart);
        server.listen(port, host, () => {
          server.off("error", rejectStart);
          resolveStart();
        });
      });

      return { url: `http://${host}:${port}`, port };
    },
    async stop() {
      unsubscribe?.();
      unsubscribe = undefined;
      const closeWss = wss
        ? new Promise<void>((r) => wss!.close(() => r()))
        : Promise.resolve();
      const closeHttp = httpServer
        ? new Promise<void>((r) => httpServer!.close(() => r()))
        : Promise.resolve();
      await Promise.all([closeWss, closeHttp]);
      httpServer = undefined;
      wss = undefined;
    },
  };
}
