# @syskoio/storage

Storage layer for [Sysko Observe](https://syskoio.dev). Provides an in-memory `RingBuffer` and a persistent `SqliteStore` with configurable retention.

> This package is a dependency of `@syskoio/core` and is installed automatically. You do not need to install it directly.

## Stores

### RingBuffer (in-memory)

Fast, zero-dependency circular buffer. Spans are lost on process restart.

### SqliteStore

Persists spans to a SQLite database (default: `~/.sysko/<serviceName>.db`). Supports WAL mode, retention by age and row count.

Configured via `@syskoio/core`:

```ts
await init({
  storage: "sqlite",                      // default
  storage: "memory",                      // in-memory only
  storage: { path: "/data/sysko.db" },    // custom path
  retention: { days: 7, maxRows: 5_000 },
});
```

## Docs

[syskoio.dev/docs/configuration/storage](https://syskoio.dev/docs/configuration/storage)
