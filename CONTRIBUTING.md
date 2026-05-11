# Contributing to Sysko Observe

Thanks for considering a contribution — Sysko gets better when real users push it.

Before you start, please skim [README.md](README.md) for the project's thesis, and the [ROADMAP](ROADMAP.md) — especially the **anti-roadmap** section, which lists things we explicitly **won't** accept.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Project structure](#project-structure)
- [Making changes](#making-changes)
- [Code style](#code-style)
- [Commit message style](#commit-message-style)
- [Pull request process](#pull-request-process)
- [Reporting bugs](#reporting-bugs)
- [Proposing features](#proposing-features)

---

## Ways to contribute

- **Bug reports** with reproduction steps
- **Feature proposals** that align with the [thesis](README.md#thesis) (zero-config, automatic tracing, browser-first)
- **Plugins** for additional frameworks or databases (after checking the anti-roadmap)
- **Documentation** improvements
- **Examples** for frameworks we don't cover yet
- **Performance** improvements with measurements

What we generally won't merge:

- Light theme for the dashboard — it's "DevTools" → always dark
- Interactive config wizards — zero-config means zero
- Enterprise features (SSO, RBAC, audit log) — wrong audience
- A plugin for every npm library — we cover the top 5, extension via hook API
- Support for Node < 20

---

## Development setup

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 10 (`npm install -g pnpm@10`)
- Git

### Clone and build

```bash
git clone https://github.com/syskoio/sysko.git
cd sysko
pnpm install
pnpm build
```

### Run an example

```bash
pnpm --filter example-express-app start
# in another terminal:
pnpm --filter example-express-app test
```

The dashboard is at [http://localhost:9999](http://localhost:9999).

### Dev workflow

```bash
pnpm dev           # tsc --watch in parallel + Vite dashboard
pnpm typecheck     # one-shot type check across the monorepo
pnpm build         # full build (turbo cached)
pnpm pack:all      # generates dist-packs/*.tgz for external testing
```

To iterate on the UI specifically:

```bash
pnpm --filter @sysko/dashboard dev
```

This boots Vite at `:5173` with hot reload. You still need an example running at `:3000` and the transport at `:9999` (any `pnpm --filter <example> start` provides both) — Vite proxies the WebSocket to `:9999`.

---

## Project structure

```
packages/
├── core/        # Public API; orchestrates storage + transport; auto-instrumentation
├── storage/     # In-memory ring buffer + Span type
├── transport/   # HTTP + WebSocket server, serves dashboard, broadcasts spans
├── dashboard/   # React + Vite + Tailwind v4 UI
├── plugins/     # Express, Fastify, Prisma — opt-in integrations
└── cli/         # `sysko init`
examples/
├── express-app/
└── fastify-app/
```

Dependency direction (do not invert):

```
core       →  storage, transport      (core orchestrates)
plugins    →  core
dashboard  →  (built statically, served by transport)
transport, storage  →  (standalone, no sysko-internal deps)
```

`core` is the only package consumers install directly. Keep its dependency surface minimal.

---

## Making changes

### Pick or open an issue first

For anything beyond a typo fix or one-line change, open or comment on an issue before writing code. It saves rework if the change conflicts with the roadmap or anti-roadmap.

### Branch naming

```
feat/<short-description>
fix/<short-description>
docs/<short-description>
refactor/<short-description>
```

### Keep PRs focused

One change per PR. A bug fix doesn't need surrounding cleanup; a feature doesn't need refactor commits piled on. Split unrelated work.

---

## Code style

### TypeScript

- Strict mode: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Explicit types on public APIs; inference for internals
- Never use `any` — if truly unavoidable, comment why on the same line
- ESM only (`"type": "module"`); use `.js` extension in imports

### Style

- Double quotes
- Semicolons
- Small files, one concept per file (≥ 300 lines is a smell — consider splitting)

### Comments

Default to **no comments**. Write them only when the *why* is non-obvious:

- Hidden invariants
- Workarounds for specific bugs
- Behavior that would surprise a reader

Avoid:

- Comments that re-state what the code does
- References to the current task or PR ("added for issue #42") — those belong in the PR description
- Multi-paragraph docstrings

### Performance

Sysko's auto-instrumentation runs on the hot path of other people's apps. Be mindful:

- No unnecessary allocations
- No closures created inside hot loops
- No synchronous `JSON.stringify` of large objects
- The `NOOP_HANDLE` pattern in `span-factory.ts` exists for this reason — preserve it

### What not to add

- Defensive validation at internal boundaries — trust internal callers
- Backwards-compatibility shims when you can just change the code
- Abstractions for hypothetical future requirements
- Dependencies in `@sysko/core` unless absolutely necessary

---

## Commit message style

```
<type>: <short summary>

<optional body explaining the why>
```

Types:

- `feat`: new functionality
- `fix`: bug fix
- `refactor`: code change that neither fixes a bug nor adds a feature
- `docs`: documentation only
- `chore`: build, tooling, dependencies
- `perf`: performance improvement
- `test`: adding or fixing tests

Examples:

```
feat: add Fastify plugin with route template extraction
fix: prevent URL hash from being cleared before spans hydrate
refactor: extract span factory from instrument-http
```

No issue numbers in the subject line — those go in the body or PR description.

---

## Pull request process

1. **Fork** the repo and create your branch from `main`
2. **Run `pnpm typecheck` and `pnpm build`** before pushing — CI will catch them anyway, but local feedback is faster
3. **Test manually** for UI changes — backend tests won't catch broken layouts or wrong colors
4. **Write a clear PR description**: what changed, why, and how you verified it
5. **Mark it Ready for Review** once CI is green
6. **Respond to review feedback** by pushing additional commits (don't force-push during review — squash on merge handles cleanup)

A reviewer will check:

- Does it align with the thesis?
- Does it pass typecheck and build?
- Is the change minimal and focused?
- Are there manual verification steps for UI changes?

---

## Reporting bugs

Use the [Bug report template](https://github.com/syskoio/sysko/issues/new?template=bug_report.yml).

Make it as small as possible to reproduce. A copy-pastable code snippet is worth a thousand words. Specify:

- Sysko version (commit SHA if from source)
- Node version (`node --version`)
- OS (Windows / macOS / Linux + version)
- What you expected
- What actually happened
- Stack trace if there's one

---

## Proposing features

Use the [Feature request template](https://github.com/syskoio/sysko/issues/new?template=feature_request.yml).

Before opening, please:

1. Check the [anti-roadmap](ROADMAP.md#anti-roadmap) — if your idea is there, it's a no
2. Check if it's already covered by the [hook API](README.md#hook-api) — many enrichment requests can be solved with `sysko.onSpan(...)` without a code change
3. Frame the proposal as "the problem I'm trying to solve" rather than "the feature I want" — sometimes there's a better approach

---

Thanks again. Questions? Open a [GitHub Discussion](https://github.com/syskoio/sysko/discussions) or an issue.
