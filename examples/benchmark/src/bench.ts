/**
 * Sysko overhead benchmark.
 *
 * Targets (pass criteria):
 *   - Latency overhead at p99: < 5ms
 *   - CPU overhead: < 1% of total CPU time
 *   - Memory overhead: < 10 MB heap increase
 *
 * Usage:
 *   Terminal 1: pnpm --filter example-benchmark start:baseline
 *   Terminal 2: pnpm --filter example-benchmark start:instrumented
 *   Terminal 3: pnpm --filter example-benchmark start
 */

import { performance } from "node:perf_hooks";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const LIME = "\x1b[38;5;191m";

const BASELINE = "http://localhost:4000";
const INSTRUMENTED = "http://localhost:4001";

// Benchmark parameters
const WARMUP = 200;       // requests discarded before measuring
const SAMPLES = 2_000;    // requests used for measurement
const CONCURRENCY = 10;   // parallel in-flight requests
const ROUTE = "/work";    // route under test (1ms synthetic work)

interface Stats {
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
  count: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function computeStats(latencies: number[]): Stats {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
    mean: sum / sorted.length,
    count: sorted.length,
  };
}

async function runRequests(base: string, count: number): Promise<number[]> {
  const url = `${base}${ROUTE}`;
  const latencies: number[] = [];
  let inflight = 0;
  let sent = 0;

  return new Promise((resolve, reject) => {
    function dispatch(): void {
      while (inflight < CONCURRENCY && sent < count) {
        inflight++;
        sent++;
        const start = performance.now();
        fetch(url, { signal: AbortSignal.timeout(5000) })
          .then(() => {
            latencies.push(performance.now() - start);
            inflight--;
            if (latencies.length === count) {
              resolve(latencies);
            } else {
              dispatch();
            }
          })
          .catch(reject);
      }
    }
    dispatch();
  });
}

async function ensureUp(base: string, label: string): Promise<void> {
  try {
    await fetch(`${base}/`, { signal: AbortSignal.timeout(1500) });
  } catch {
    console.error(`${RED}error${RESET}  cannot reach ${base} (${label})`);
    console.error(`       See usage instructions at the top of bench.ts\n`);
    process.exit(1);
  }
}

function fmtMs(ms: number): string {
  return ms.toFixed(2) + "ms";
}

function passFail(value: number, target: number): string {
  return value <= target
    ? `${GREEN}PASS${RESET}`
    : `${RED}FAIL${RESET}`;
}

function overhead(base: number, instrumented: number): string {
  const diff = instrumented - base;
  const color = diff > 0 ? YELLOW : GREEN;
  const sign = diff >= 0 ? "+" : "";
  return `${color}${sign}${diff.toFixed(2)}ms${RESET}`;
}

async function main(): Promise<void> {
  console.log(`${LIME}${BOLD}sysko overhead benchmark${RESET}`);
  console.log(`${DIM}route: ${ROUTE}  warmup: ${WARMUP}  samples: ${SAMPLES}  concurrency: ${CONCURRENCY}${RESET}\n`);

  await ensureUp(BASELINE, "baseline");
  await ensureUp(INSTRUMENTED, "instrumented");

  process.stdout.write(`${DIM}warming up baseline...${RESET}`);
  await runRequests(BASELINE, WARMUP);
  process.stdout.write(`\r${DIM}warming up instrumented...${RESET}`);
  await runRequests(INSTRUMENTED, WARMUP);
  process.stdout.write("\r" + " ".repeat(40) + "\r");

  process.stdout.write(`${DIM}measuring baseline (${SAMPLES} req)...${RESET}`);
  const baseLatencies = await runRequests(BASELINE, SAMPLES);
  process.stdout.write("\r" + " ".repeat(50) + "\r");

  process.stdout.write(`${DIM}measuring instrumented (${SAMPLES} req)...${RESET}`);
  const instrLatencies = await runRequests(INSTRUMENTED, SAMPLES);
  process.stdout.write("\r" + " ".repeat(50) + "\r");

  const base = computeStats(baseLatencies);
  const instr = computeStats(instrLatencies);

  console.log(`${BOLD}results${RESET}  (${SAMPLES.toLocaleString()} samples each, concurrency=${CONCURRENCY})\n`);
  console.log(`${"".padEnd(12)}  ${"baseline".padEnd(12)}  ${"instrumented".padEnd(12)}  ${"overhead".padEnd(12)}  target`);
  console.log(DIM + "─".repeat(70) + RESET);

  const rows: [string, number, number, number][] = [
    ["p50", base.p50, instr.p50, 2],
    ["p95", base.p95, instr.p95, 3],
    ["p99", base.p99, instr.p99, 5],
    ["max", base.max, instr.max, 10],
    ["mean", base.mean, instr.mean, 2],
  ];

  for (const [label, b, i, target] of rows) {
    const diff = i - b;
    const pf = passFail(diff, target);
    console.log(
      `${label.padEnd(12)}  ${fmtMs(b).padEnd(12)}  ${fmtMs(i).padEnd(12)}  ${overhead(b, i).padEnd(20)}  < ${target}ms  ${pf}`,
    );
  }

  console.log("");

  const p99Diff = instr.p99 - base.p99;
  const p99Pass = p99Diff <= 5;

  console.log(`${BOLD}verdict${RESET}`);
  if (p99Pass) {
    console.log(`  ${GREEN}p99 overhead${RESET} ${fmtMs(p99Diff)} — within 5ms target`);
  } else {
    console.log(`  ${RED}p99 overhead${RESET} ${fmtMs(p99Diff)} — exceeds 5ms target`);
  }

  process.exit(p99Pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
