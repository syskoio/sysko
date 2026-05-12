# @syskoio/dashboard

Real-time observability dashboard for [Sysko Observe](https://syskoio.dev), built with React, Vite, and Tailwind CSS.

> This package is a dependency of `@syskoio/core` and is installed automatically. You do not need to install it directly. The dashboard is served as static assets by `@syskoio/transport` at `http://localhost:9999`.

## Features

- **Spans** — live request list with waterfall trace view and inline diff comparison
- **Endpoints** — aggregated stats per route: count, p50, p95, p99, error rate
- **Distribution** — latency histogram with 12 buckets
- **Dashboard** — system metrics: event loop lag, CPU, heap, GC (time-series charts)
- **Alerts** — history of fired alert rules
- **Errors** — grouped by fingerprint with 24h sparkline and link to trace
- Keyboard shortcuts, URL hash routing, shareable trace links, JSON export

## Docs

[syskoio.dev/docs/concepts/the-dashboard](https://syskoio.dev/docs/concepts/the-dashboard)
