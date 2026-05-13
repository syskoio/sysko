import { performance } from "node:perf_hooks";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const LIME = "\x1b[38;5;191m";

const APP_BASE = "http://localhost:3008";
const DASHBOARD_WS = "ws://127.0.0.1:9999/_sysko/ws";

interface RouteCase {
  method: string;
  path: string;
}

const CASES: RouteCase[] = [
  { method: "GET", path: "/" },
  { method: "GET", path: "/api/health" },
  { method: "GET", path: "/api/slow" },
  { method: "GET", path: "/api/error" },
  { method: "GET", path: "/api/users/42" },
  { method: "GET", path: "/api/users/99?token=SECRET" },
  { method: "GET", path: "/api/zen" },
  { method: "GET", path: "/api/work" },
  { method: "GET", path: "/api/logs" },
  { method: "GET", path: "/api/traceparent/echo" },
  { method: "GET", path: "/api/traceparent/self-call" },
];

interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  kind: string;
  startTime: number;
  status: "ok" | "error";
  attributes: Record<string, unknown>;
  logs?: { ts: number; level: string; message: string }[];
}

function colorStatus(status: number): string {
  if (status >= 500) return RED + status + RESET;
  if (status >= 400) return YELLOW + status + RESET;
  if (status >= 200) return GREEN + status + RESET;
  return DIM + status + RESET;
}

async function ensureServerUp(): Promise<void> {
  try {
    await fetch(APP_BASE + "/", { signal: AbortSignal.timeout(2000) });
  } catch {
    console.error(`${RED}error${RESET}  cannot reach ${APP_BASE}`);
    console.error(`       start the server first:`);
    console.error(`         ${LIME}pnpm --filter example-nextjs-app start${RESET}\n`);
    process.exit(1);
  }
}

async function fetchHistory(): Promise<Span[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DASHBOARD_WS);
    const timeout = setTimeout(() => { ws.close(); reject(new Error("ws timeout")); }, 2000);
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data as string) as { type: string; spans?: Span[] };
      if (msg.type === "history") {
        clearTimeout(timeout);
        ws.close();
        resolve(msg.spans ?? []);
      }
    });
    ws.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("ws error")); });
  });
}

async function main(): Promise<void> {
  console.log(`${LIME}${BOLD}sysko · example-nextjs test${RESET}`);
  console.log(`${DIM}firing ${CASES.length} requests against ${APP_BASE}${RESET}`);
  console.log(`${DIM}watch live at http://localhost:9999${RESET}\n`);

  await ensureServerUp();
  const startMark = Date.now();

  interface Result { label: string; statusCell: string; duration: string; }
  const results: Result[] = [];

  for (const c of CASES) {
    const url = `${APP_BASE}${c.path}`;
    const start = performance.now();
    let statusCell: string;

    try {
      const res = await fetch(url, {
        method: c.method,
        signal: AbortSignal.timeout(5000),
      });
      statusCell = colorStatus(res.status);
    } catch {
      statusCell = `${RED}fail${RESET}`;
    }

    const duration = (performance.now() - start).toFixed(1) + "ms";
    results.push({ label: `${c.method} ${c.path}`, statusCell, duration });
  }

  await new Promise((r) => setTimeout(r, 150));

  const labelWidth = Math.max(...results.map((r) => r.label.length));
  console.log(`${DIM}${"method+path".padEnd(labelWidth)}   status         duration${RESET}`);
  console.log(DIM + "─".repeat(labelWidth + 35) + RESET);

  for (const r of results) {
    console.log(`${r.label.padEnd(labelWidth)}   ${r.statusCell.padEnd(20)} ${r.duration.padStart(10)}`);
  }

  console.log("");

  try {
    const allSpans = await fetchHistory();
    const fromRun = allSpans.filter((s) => s.startTime >= startMark - 50);
    const traces = new Set(fromRun.map((s) => s.traceId));
    const children = fromRun.filter((s) => s.parentSpanId !== undefined).length;
    const errored = fromRun.filter((s) => s.status === "error").length;

    console.log(`${BOLD}captured by sysko (this run)${RESET}`);
    console.log(`  ${LIME}${fromRun.length}${RESET} spans across ${LIME}${traces.size}${RESET} traces`);
    console.log(`  ${children} child spans (outbound HTTP / withSpan)`);
    console.log(`  ${errored} errored\n`);
  } catch {
    console.log(`${DIM}(skipped span summary — dashboard not reachable on :9999)${RESET}\n`);
  }

  console.log(`${BOLD}W3C traceparent propagation${RESET}`);
  try {
    const res = await fetch(`${APP_BASE}/api/traceparent/self-call`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json() as {
      propagated: boolean;
      receivedTraceparent: string | null;
    };
    if (data.propagated && data.receivedTraceparent) {
      console.log(`  ${GREEN}outbound injection${RESET}   traceparent header delivered to inner request`);
      console.log(`  ${DIM}traceparent: ${data.receivedTraceparent}${RESET}`);
    } else {
      console.log(`  ${YELLOW}no traceparent propagated${RESET}`);
    }
  } catch {
    console.log(`  ${DIM}(skipped — dashboard not reachable on :9999)${RESET}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
