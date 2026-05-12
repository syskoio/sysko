# @syskoio/transport

HTTP and WebSocket server for [Sysko Observe](https://syskoio.dev). Serves the dashboard static assets, streams spans to connected browsers in real time, and optionally accepts remote spans via `POST /v1/spans`.

> This package is a dependency of `@syskoio/core` and is installed automatically. You do not need to install it directly.

## Features

- Serves the `@syskoio/dashboard` static build
- Broadcasts spans, metrics, and alerts to WebSocket clients
- Optional password protection with brute-force rate limiting (5 attempts / IP)
- Optional ingest endpoint for the standalone collector

## Configuration

Configured via `@syskoio/core`:

```ts
await init({
  dashboard: {
    port: 9999,         // default
    host: "127.0.0.1",  // default
    password: "secret", // optional
  },
});
```

## Docs

[syskoio.dev/docs](https://syskoio.dev/docs)
