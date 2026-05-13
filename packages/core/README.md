# @syskoio/core

Zero-config observability SDK for Node.js. One `init()` call gives you automatic HTTP tracing, a real-time dashboard, system metrics, correlated logs, alerts, and error grouping — no YAML, no exporters, no pipeline.

## Install

```bash
npm install @syskoio/core
```

## Usage

```ts
import { init } from "@syskoio/core";

const sysko = await init({ serviceName: "my-app" });
// open http://localhost:9999
```

That's it. Sysko automatically instruments:

- Inbound HTTP requests (any framework)
- Outbound HTTP / `fetch`
- `console.log/warn/error/info` (attached to the active span)
- Uncaught exceptions and unhandled promise rejections

## Options

```ts
await init({
  serviceName: "my-app",
  storage: "sqlite",              // "memory" | "sqlite" | { path: "..." }
  retention: { days: 7, maxRows: 5_000 },
  sampling: 1,                    // 0–1
  rateLimit: 500,                 // max spans/s
  redact: {
    paths: ["/healthz"],
    queryParams: ["token", "apiKey"],
  },
  dashboard: {
    port: 9999,
    password: "secret",
  },
  alerts: [
    { name: "high-errors", type: "errorRate", threshold: 0.3, windowMs: 60_000 },
  ],
  export: { url: "http://collector:9999" },
});
```

## Framework plugins

For richer data (`http.route` parametrization, DB query spans) install `@syskoio/plugins`:

```ts
import { instrumentExpress } from "@syskoio/plugins/express";
import { instrumentPrisma } from "@syskoio/plugins/prisma";

instrumentExpress(app);
instrumentPrisma(prisma);
```

## Custom spans

```ts
import { withSpan } from "@syskoio/core";

await withSpan("invoice.generate", { orderId }, async () => {
  // everything inside is tracked as a child span
});
```

## Docs

[docs.sysko.io](https://docs.sysko.io)
