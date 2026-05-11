import { performance } from "node:perf_hooks";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const VIOLET = "\x1b[35m";
const CYAN = "\x1b[36m";
const LIME = "\x1b[38;5;191m";

const APP_BASE = "http://localhost:3000";
const DASHBOARD_WS = "ws://127.0.0.1:9999/_sysko/ws";

interface RouteCase {
  method: string;
  path: string;
  redacted?: boolean;
  willAbort?: boolean;
}

const CASES: RouteCase[] = [
  { method: "GET", path: "/" },
  { method: "GET", path: "/slow" },
  { method: "GET", path: "/error" },
  { method: "GET", path: "/users/42" },
  { method: "GET", path: "/users/99?token=SECRET&page=1" },
  { method: "GET", path: "/users/7?apiKey=ABCDE" },
  { method: "GET", path: "/zen" },
  { method: "GET", path: "/fanout" },
  { method: "GET", path: "/work" },
  { method: "GET", path: "/throw", willAbort: true },
  { method: "GET", path: "/logs" },
  { method: "GET", path: "/healthz", redacted: true },
  { method: "GET", path: "/internal/secret", redacted: true },
];

interface AlertFired {
  ts: number;
  ruleName: string;
  type: "p95" | "errorRate" | "spanCount";
  value: number;
  threshold: number;
}

interface SpanLog {
  ts: number;
  level: string;
  message: string;
}

interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  kind: string;
  startTime: number;
  status: "ok" | "error";
  attributes: Record<string, unknown>;
  logs?: SpanLog[];
}

function colorStatus(status: number | string): string {
  if (typeof status === "string") return DIM + status + RESET;
  if (status >= 500) return RED + status + RESET;
  if (status >= 400) return YELLOW + status + RESET;
  if (status >= 300) return VIOLET + status + RESET;
  if (status >= 200) return GREEN + status + RESET;
  return DIM + status + RESET;
}

async function ensureServerUp(): Promise<void> {
  try {
    await fetch(APP_BASE + "/", { signal: AbortSignal.timeout(1500) });
  } catch {
    console.error(`${RED}error${RESET}  cannot reach ${APP_BASE}`);
    console.error(`       start the server first in another terminal:`);
    console.error(`         ${LIME}pnpm --filter example-express-app start${RESET}\n`);
    process.exit(1);
  }
}

async function waitForAlert(timeoutMs: number): Promise<AlertFired | null> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    const timer = setTimeout(() => {
      ws.close();
      resolve(null);
    }, timeoutMs);

    ws = new WebSocket(DASHBOARD_WS);
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data as string) as {
        type: string;
        alert?: AlertFired;
        alerts?: AlertFired[];
      };
      if (msg.type === "alert" && msg.alert) {
        clearTimeout(timer);
        ws.close();
        resolve(msg.alert);
      } else if (msg.type === "alerts-history" && msg.alerts && msg.alerts.length > 0) {
        clearTimeout(timer);
        ws.close();
        resolve(msg.alerts[msg.alerts.length - 1] ?? null);
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

async function fetchHistory(): Promise<Span[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DASHBOARD_WS);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("ws timeout"));
    }, 2000);
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data as string) as { type: string; spans?: Span[] };
      if (msg.type === "history") {
        clearTimeout(timeout);
        ws.close();
        resolve(msg.spans ?? []);
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("ws error"));
    });
  });
}

async function main(): Promise<void> {
  console.log(`${LIME}${BOLD}sysko · example-express test${RESET}`);
  console.log(`${DIM}firing ${CASES.length} requests against ${APP_BASE}${RESET}`);
  console.log(`${DIM}watch live at http://localhost:9999${RESET}\n`);

  await ensureServerUp();
  const startMark = Date.now();

  interface Result {
    label: string;
    statusCell: string;
    duration: string;
    note: string;
  }
  const results: Result[] = [];

  for (const c of CASES) {
    const url = `${APP_BASE}${c.path}`;
    const start = performance.now();
    let statusCell: string;
    let note = "";

    try {
      const res = await fetch(url, {
        method: c.method,
        signal: AbortSignal.timeout(c.willAbort ? 600 : 5000),
      });
      statusCell = colorStatus(res.status);
    } catch {
      if (c.willAbort) {
        statusCell = `${CYAN}aborted${RESET}`;
        note = `${DIM}(intentional — handler throws)${RESET}`;
      } else {
        statusCell = `${RED}fail${RESET}`;
      }
    }

    if (c.redacted) {
      note = `${LIME}redacted by sysko${RESET}`;
    }

    const duration = (performance.now() - start).toFixed(1) + "ms";
    results.push({ label: `${c.method} ${c.path}`, statusCell, duration, note });
  }

  await new Promise((r) => setTimeout(r, 100));

  const labelWidth = Math.max(...results.map((r) => r.label.length));

  console.log(
    `${DIM}${"method+path".padEnd(labelWidth)}   status         duration    note${RESET}`,
  );
  console.log(DIM + "─".repeat(labelWidth + 50) + RESET);

  for (const r of results) {
    const padLabel = r.label.padEnd(labelWidth);
    const padStatus = r.statusCell.padEnd(20);
    const padDuration = r.duration.padStart(10);
    console.log(`${padLabel}   ${padStatus} ${padDuration}    ${r.note}`);
  }

  console.log("");

  try {
    const allSpans = await fetchHistory();
    const fromRun = allSpans.filter((s) => s.startTime >= startMark - 50);
    const traces = new Set(fromRun.map((s) => s.traceId));
    const children = fromRun.filter((s) => s.parentSpanId !== undefined).length;
    const errored = fromRun.filter((s) => s.status === "error").length;
    const withLogs = fromRun.filter((s) => (s.logs?.length ?? 0) > 0);
    const totalLogs = withLogs.reduce((acc, s) => acc + (s.logs?.length ?? 0), 0);

    console.log(`${BOLD}captured by sysko (this run)${RESET}`);
    console.log(
      `  ${LIME}${fromRun.length}${RESET} spans across ${LIME}${traces.size}${RESET} traces`,
    );
    console.log(`  ${children} child spans (outbound HTTP / withSpan)`);
    console.log(`  ${errored} errored`);
    console.log(`  ${totalLogs} logs attached across ${withLogs.length} spans`);
    console.log(
      `  ${CASES.filter((c) => c.redacted).length} requests dropped by redact rules\n`,
    );
  } catch {
    console.log(
      `${DIM}(skipped span summary — dashboard not reachable on :9999)${RESET}\n`,
    );
  }

  // --- alert verification ---
  // Fire enough errors to breach the 30% errorRate threshold, then
  // wait up to 8s for the engine to pick it up (check interval = 3s).
  console.log(`${BOLD}alert verification${RESET}`);
  console.log(`${DIM}firing 8 × /error to breach the errorRate threshold...${RESET}`);

  for (let i = 0; i < 8; i++) {
    await fetch(`${APP_BASE}/error`, { signal: AbortSignal.timeout(2000) }).catch(() => {});
  }

  process.stdout.write(`${DIM}waiting up to 8s for alert engine...${RESET}`);
  const fired = await waitForAlert(8000).catch(() => null);

  if (fired) {
    const value = fired.type === "errorRate"
      ? `${(fired.value * 100).toFixed(1)}%`
      : String(fired.value);
    const threshold = fired.type === "errorRate"
      ? `${(fired.threshold * 100).toFixed(1)}%`
      : String(fired.threshold);
    console.log(
      `\r  ${GREEN}alert fired${RESET}   rule="${fired.ruleName}"  ${fired.type}=${LIME}${value}${RESET} > threshold ${threshold}`,
    );
  } else {
    console.log(`\r  ${YELLOW}no alert received${RESET}  (server may not have alerts configured)\n`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
