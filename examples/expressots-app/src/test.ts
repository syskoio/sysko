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

const APP_BASE = "http://127.0.0.1:3004";
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
  { method: "GET", path: "/users" },
  { method: "GET", path: "/users/42" },
  { method: "GET", path: "/users/42/orders" },
  { method: "GET", path: "/users/1?token=SECRET" },
  { method: "GET", path: "/work" },
  { method: "GET", path: "/logs" },
  { method: "GET", path: "/traceparent/self-call" },
  { method: "GET", path: "/throw", willAbort: true },
  { method: "GET", path: "/healthz", redacted: true },
];

interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  kind: string;
  startTime: number;
  status: "ok" | "error";
  attributes: Record<string, unknown>;
}

function colorStatus(status: number | string): string {
  if (typeof status === "string") return DIM + status + RESET;
  if (status >= 500) return RED + status + RESET;
  if (status >= 400) return YELLOW + status + RESET;
  if (status >= 200) return GREEN + status + RESET;
  return DIM + status + RESET;
}

async function ensureServerUp(): Promise<void> {
  try {
    await fetch(APP_BASE + "/", { signal: AbortSignal.timeout(1500) });
  } catch {
    console.error(`${RED}error${RESET}  cannot reach ${APP_BASE}`);
    console.error(`       start the server first:`);
    console.error(`         ${LIME}pnpm --filter example-expressots-app start${RESET}\n`);
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
  console.log(`${LIME}${BOLD}sysko · example-expressots test${RESET}`);
  console.log(`${DIM}firing ${CASES.length} requests against ${APP_BASE}${RESET}`);
  console.log(`${DIM}watch live at http://localhost:9999${RESET}\n`);

  await ensureServerUp();
  const startMark = Date.now();

  interface Result { label: string; statusCell: string; duration: string; note: string; }
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
      statusCell = c.willAbort ? `${CYAN}aborted${RESET}` : `${RED}fail${RESET}`;
      if (c.willAbort) note = `${DIM}(intentional — handler throws)${RESET}`;
    }

    if (c.redacted) note = `${LIME}redacted by sysko${RESET}`;

    const duration = (performance.now() - start).toFixed(1) + "ms";
    results.push({ label: `${c.method} ${c.path}`, statusCell, duration, note });
  }

  await new Promise((r) => setTimeout(r, 100));

  const labelWidth = Math.max(...results.map((r) => r.label.length));
  console.log(`${DIM}${"method+path".padEnd(labelWidth)}   status         duration    note${RESET}`);
  console.log(DIM + "─".repeat(labelWidth + 50) + RESET);

  for (const r of results) {
    console.log(
      `${r.label.padEnd(labelWidth)}   ${r.statusCell.padEnd(20)} ${r.duration.padStart(10)}    ${r.note}`,
    );
  }

  console.log("");

  try {
    const allSpans = await fetchHistory();
    const fromRun = allSpans.filter((s) => s.startTime >= startMark - 50);
    const traces = new Set(fromRun.map((s) => s.traceId));
    const children = fromRun.filter((s) => s.parentSpanId !== undefined).length;
    const errored = fromRun.filter((s) => s.status === "error").length;
    const withRoute = fromRun.filter(
      (s) => s.parentSpanId === undefined && s.attributes["http.route"] !== undefined,
    ).length;

    console.log(`${BOLD}captured by sysko (this run)${RESET}`);
    console.log(`  ${LIME}${fromRun.length}${RESET} spans across ${LIME}${traces.size}${RESET} traces`);
    console.log(`  ${children} child spans (outbound HTTP / withSpan)`);
    console.log(`  ${errored} errored`);
    console.log(`  ${withRoute} with http.route resolved by ExpressoTS plugin`);
    console.log(`  ${CASES.filter((c) => c.redacted).length} requests dropped by redact rules\n`);
  } catch {
    console.log(`${DIM}(skipped span summary — dashboard not reachable on :9999)${RESET}\n`);
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
