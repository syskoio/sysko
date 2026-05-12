# @syskoio/cli

CLI scaffolding tool for [Sysko Observe](https://syskoio.dev). Detects your framework and wires up `@syskoio/core` into your app's entry file automatically.

## Usage

No install needed:

```bash
npx @syskoio/cli init
```

Or install globally:

```bash
npm install -g @syskoio/cli
sysko init
```

## What it does

1. Detects your framework from `package.json` (Express, Fastify, NestJS, Next.js)
2. Finds your entry file
3. Injects `await init({ serviceName: "your-app" })` at the top
4. Adds `@syskoio/core` to your dependencies

By default runs in **dry-run mode** — shows a preview without writing anything. Apply changes with `--yes`:

```bash
sysko init --yes
```

## Docs

[syskoio.dev/docs/getting-started](https://syskoio.dev/docs/getting-started)
