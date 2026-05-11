# Sysko Observe

> Zero-config observability for Node.js — Chrome DevTools for your backend.

[![CI](https://github.com/syskoio/sysko/actions/workflows/ci.yml/badge.svg)](https://github.com/syskoio/sysko/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-blue.svg)](#requirements)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#status)

Sysko is a tracing library and realtime dashboard for Node.js. It aims to replace the OpenTelemetry + Grafana + Jaeger + Datadog stack when you're a startup, SaaS, microservice, or solo developer — no config, no external agent, no paid panel.

```ts
import { init } from "@sysko/core";

await init({ serviceName: "my-app" });

// rest of your app — requests are now traced automatically
```

Open `http://localhost:9999` and watch everything live.

---

## Thesis

- **Zero-config.** Call `init()` and it works. Sensible defaults beat options.
- **Absurd UX.** From install to seeing data in under 2 minutes.
- **Automatic tracing.** You don't sprinkle `tracer.start(...)` across your code. Instrumentation happens through monkeypatching `http.Server.prototype.emit`, `http.request`, `globalThis.fetch`, and `AsyncLocalStorage`.
- **Realtime dashboard in the browser.** No Prometheus, no Loki, no external collector. Everything embedded in your process.

What Sysko is **not**: an enterprise SRE platform. We prioritize zero friction over infinite extensibility.

---

## Status

Alpha. Not yet published to npm — currently distributed as local tarballs (see [Installing in an existing project](#installing-in-an-existing-project)).

Roadmap in [ROADMAP.md](ROADMAP.md). Phases 1, 2, 3 complete; phase 4 partial.

---

## Quick start

### 1. Inside this monorepo

```bash
pnpm install
pnpm build
pnpm --filter example-express-app start
```

In another terminal:

```bash
pnpm --filter example-express-app test
```

Open [http://localhost:9999](http://localhost:9999) — the dashboard shows traffic live as the test runner fires requests.

### 2. Installing in an existing project

While we haven't published to npm yet, we distribute via tarballs:

```bash
# in the sysko repo
pnpm pack:all
# generates dist-packs/sysko-*.tgz
```

In your project:

```bash
mkdir vendor
cp /path/to/sysko/dist-packs/*.tgz vendor/
```

Add the following to your project's `package.json`:

```jsonc
{
  "pnpm": {
    "overrides": {
      "@sysko/storage":   "file:./vendor/sysko-storage-0.0.1.tgz",
      "@sysko/transport": "file:./vendor/sysko-transport-0.0.1.tgz",
      "@sysko/dashboard": "file:./vendor/sysko-dashboard-0.0.1.tgz"
    }
  }
}
```

Then install and initialize:

```bash
pnpm add ./vendor/sysko-core-0.0.1.tgz
pnpm add ./vendor/sysko-plugins-0.0.1.tgz   # optional, for route templates
```

```ts
// at the top of your entry file
import { init } from "@sysko/core";
await init({ serviceName: "my-app" });
```

Or use the CLI to do this automatically:

```bash
node /path/to/sysko/packages/cli/dist/index.js init --yes
```

---

## What you get

- **Automatic capture of HTTP requests** entering and leaving the process (`http.request`, `https.request`, `fetch` global)
- **Span hierarchy** with `traceId` and `parentSpanId` propagated through `AsyncLocalStorage`
- **Error capture**: 5xx responses, request aborts, `uncaughtException`, `unhandledRejection` — all mark the active span
- **Realtime dashboard** featuring:
  - Span list with pause/clear
  - Detail panel with full trace waterfall view
  - Per-endpoint aggregation (count, error rate, p50/p95/p99, max)
  - Latency histogram
  - Filters (method, status range, minimum duration, path search)
  - Compare traces (side-by-side split view)
  - Trace export as JSON
  - Shareable URLs (`#/trace/<id>` and `#/trace/<A>/vs/<B>`)
  - Keyboard shortcuts (`/`, `j`/`k`, `Esc`, `Space`, `c`)
- **Hook API** to enrich or drop spans before they get stored
- **Sampling** propagated per trace (zero allocation for unsampled spans)
- **PII redaction** for sensitive query params and entire paths

---

## Supported frameworks

| Framework             | Auto-tracing | Route templates             |
| --------------------- | ------------ | --------------------------- |
| Express               | yes          | `@sysko/plugins/express`    |
| Fastify               | yes          | `@sysko/plugins/fastify`    |
| Any `http.Server`     | yes          | n/a                         |
| Prisma (DB queries)   | n/a          | `@sysko/plugins/prisma`     |

NestJS and Next.js work for automatic capture (both use `http.Server` underneath), but don't have dedicated plugins for route templates yet.

---

## Configuration

```ts
await init({
  serviceName: "my-app",         // appears in spans
  capacity: 1000,                // in-memory ring buffer size
  sampling: 1,                   // 0..1 — fraction of traces to capture
  redact: {
    paths: ["/healthz", "/internal/*"],   // glob or RegExp
    queryParams: ["token", "apiKey"],     // masked as ***
  },
  dashboard: {
    port: 9999,                  // or `false` to disable the dashboard
    host: "127.0.0.1",
  },
});
```

### Hook API

```ts
const sysko = await init({...});

sysko.onSpan((span) => {
  span.attributes["service.region"] = process.env.REGION ?? "local";
  return span;          // return a Span to replace
                        // return null to drop
                        // return nothing (void) to keep as-is
});
```

### Custom spans

```ts
import { withSpan } from "@sysko/core";

await withSpan({ kind: "internal", name: "expensive-job" }, async () => {
  // your work; span closes automatically (even on throw)
});
```

---

## Architecture

```
packages/
├── core/        # Public API; orchestrates storage + transport; automatic tracing
├── storage/     # In-memory ring buffer
├── transport/   # HTTP + WebSocket server that serves the dashboard and broadcasts spans
├── dashboard/   # React + Vite + Tailwind v4 UI
├── plugins/     # Opt-in integrations: Express, Fastify, Prisma
└── cli/         # `sysko init`
```

Dependency direction:

```
core       →  storage, transport      (core orchestrates)
plugins    →  core
dashboard  →  (static build served by transport)
transport, storage  →  (standalone)
```

---

## Requirements

- **Node.js ≥ 20** (uses modern `AsyncLocalStorage` and `perf_hooks`)
- **pnpm ≥ 10** (recommended for the monorepo; other package managers should work in consumer projects)

---

## Development

```bash
pnpm install
pnpm build         # builds everything (turbo caches)
pnpm dev           # tsc --watch in parallel + Vite dashboard
pnpm typecheck
pnpm pack:all      # generates tarballs in dist-packs/ for external use
```

To work on just the UI:

```bash
pnpm --filter @sysko/dashboard dev
```

Vite runs on `:5173` and proxies WebSocket to `:9999`, so you also need an example running (e.g. `pnpm --filter example-express-app start`) to have a transport on `:9999`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on the dev workflow, commit style, and PR process.

---

## Examples

- [`examples/express-app`](examples/express-app/) — Express 4 with route template plugin
- [`examples/fastify-app`](examples/fastify-app/) — Fastify 5 with route template plugin

Each example has `pnpm start` (boots the app) and `pnpm test` (fires traffic across every route and prints a summary). The spans show up live on the `:9999` dashboard.

---

## Contributing

PRs and issues are welcome. A few quick tips:

- Comment in code only when the *why* is non-obvious — well-named identifiers already say *what*
- For dashboard visual changes, validate manually in the browser. Backend tests don't catch visual regressions
- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Don't add dependencies to `@sysko/core` without a clear need — that's the package consumers install
- See the [ROADMAP](ROADMAP.md) for what's planned and the **anti-roadmap** for what we explicitly **won't** do

Full guidelines in [CONTRIBUTING.md](CONTRIBUTING.md). By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

MIT — see [LICENSE](LICENSE).
