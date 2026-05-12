# @syskoio/collector

Standalone span collector for [Sysko Observe](https://syskoio.dev). Aggregates spans from multiple services into a single dashboard — useful for microservice architectures.

## Usage

### Docker (recommended)

```bash
docker run -p 9999:9999 syskoio/collector
```

### CLI

```bash
npx @syskoio/collector
# or
npm install -g @syskoio/collector
sysko-collector
```

## How it works

The collector runs an HTTP server that accepts spans via `POST /v1/spans` and serves the Sysko dashboard at `http://localhost:9999`. Each service sends its spans to the collector instead of (or in addition to) serving its own dashboard.

Configure each service to export spans:

```ts
await init({
  serviceName: "orders-api",
  export: { url: "http://collector:9999" },
});
```

## Docs

[syskoio.dev/docs/guides/collector](https://syskoio.dev/docs/guides/collector)
