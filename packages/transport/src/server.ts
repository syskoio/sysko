import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import type { Span, SpanStore } from "@syskoio/storage";
import { INTERNAL_SERVER } from "./internal-marker.js";
import { FALLBACK_HTML } from "./static-fallback.js";

export interface MetricsSource {
  list(): unknown[];
  subscribe(listener: (sample: unknown) => void): () => void;
}

export interface AlertsSource {
  list(): unknown[];
  subscribe(listener: (alert: unknown) => void): () => void;
}

export interface TransportOptions {
  port?: number;
  host?: string;
  store: SpanStore;
  staticDir?: string;
  password?: string;
  metrics?: MetricsSource;
  alerts?: AlertsSource;
  /** Accept remote spans via POST /v1/spans (used by the collector). */
  ingest?: boolean;
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

function checkBasicAuth(req: IncomingMessage, password: string): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const colonIdx = decoded.indexOf(":");
  if (colonIdx === -1) return false;
  return decoded.slice(colonIdx + 1) === password;
}

function checkWsAuth(req: IncomingMessage, password: string): boolean {
  if (checkBasicAuth(req, password)) return true;
  const qs = (req.url ?? "").split("?")[1] ?? "";
  const params = new URLSearchParams(qs);
  const pw = params.get("pw");
  return pw !== null && Buffer.from(pw, "base64").toString("utf8") === password;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

interface LoginEntry { count: number; lockedUntil: number }
const loginAttempts = new Map<string, LoginEntry>();

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]?.trim() ?? "unknown";
  return req.socket.remoteAddress ?? "unknown";
}

function isRateLimited(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil > Date.now()) return true;
  // Lockout expired — reset.
  loginAttempts.delete(ip);
  return false;
}

function recordFailure(ip: string): void {
  const entry = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) entry.lockedUntil = Date.now() + LOCKOUT_MS;
  loginAttempts.set(ip, entry);
}

function rejectUnauthorized(res: ServerResponse): void {
  res.writeHead(401, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "unauthorized" }));
}

function handleMeta(res: ServerResponse, passwordRequired: boolean): void {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ passwordRequired }));
}

function handleAuthCheck(req: IncomingMessage, res: ServerResponse, password: string): void {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.writeHead(429, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "too many attempts, try again later" }));
    return;
  }

  req.setEncoding("utf8");
  const chunks: string[] = [];
  req.on("data", (chunk: string) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const body = JSON.parse(chunks.join("")) as { password?: unknown };
      if (body.password === password) {
        loginAttempts.delete(ip);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } else {
        recordFailure(ip);
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid password" }));
      }
    } catch {
      res.writeHead(400);
      res.end();
    }
  });
  req.on("error", () => { res.writeHead(500); res.end(); });
}

export function createTransport(options: TransportOptions): Transport {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const store = options.store;
  const staticDir = options.staticDir ? resolve(options.staticDir) : undefined;
  const password = options.password;
  const metrics = options.metrics;
  const alerts = options.alerts;
  const ingest = options.ingest ?? false;

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

  function handleIngest(req: IncomingMessage, res: ServerResponse): void {
    req.setEncoding("utf8");
    const chunks: string[] = [];
    req.on("data", (chunk: string) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const spans = JSON.parse(chunks.join("")) as Span[];
        for (const span of spans) {
          store.push(span);
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, received: spans.length }));
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid payload" }));
      }
    });
    req.on("error", () => {
      res.writeHead(500);
      res.end();
    });
  }

  function onRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? "/";

    // Unauthenticated endpoints — must come before the auth gate.
    if (req.method === "GET" && url === "/_sysko/meta") {
      handleMeta(res, password !== undefined);
      return;
    }
    if (req.method === "POST" && url === "/_sysko/auth") {
      if (password === undefined) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } else {
        handleAuthCheck(req, res, password);
      }
      return;
    }

    // Ingest endpoint: protect with auth when password is set.
    if (ingest && req.method === "POST" && url === "/v1/spans") {
      if (password && !checkBasicAuth(req, password)) {
        rejectUnauthorized(res);
        return;
      }
      handleIngest(req, res);
      return;
    }

    // Static assets are served without auth so the React app can load
    // and render the login screen. The WS connection enforces auth on upgrade.
    void handleStatic(url, res);
  }

  function send(ws: WebSocket, payload: unknown): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function attachClient(ws: WebSocket): void {
    send(ws, { type: "history", spans: store.list() });

    const offSpans = store.subscribe((span: Span) => {
      send(ws, { type: "span", span });
    });

    let offMetrics: (() => void) | undefined;
    if (metrics) {
      send(ws, { type: "metrics-history", samples: metrics.list() });
      offMetrics = metrics.subscribe((sample) => {
        send(ws, { type: "metric", sample });
      });
    }

    let offAlerts: (() => void) | undefined;
    if (alerts) {
      send(ws, { type: "alerts-history", alerts: alerts.list() });
      offAlerts = alerts.subscribe((alert) => {
        send(ws, { type: "alert", alert });
      });
    }

    const cleanup = (): void => {
      offSpans();
      offMetrics?.();
      offAlerts?.();
    };
    ws.on("close", cleanup);
    ws.on("error", cleanup);
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
        if (password && !checkWsAuth(req, password)) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
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
