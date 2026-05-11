# Sysko Observe — Roadmap

> Biblioteca de observabilidade simplificada para Node.js

---

## Visão

Criar uma biblioteca de observabilidade moderna para Node.js com foco em:

- zero-config
- UX absurda
- tracing automático
- dashboard realtime
- experiência estilo "Chrome DevTools para backend"

Público-alvo: startups, SaaS, microsserviços, side projects, devs solo. **Não** é ferramenta de SRE corporativo.

Pilares inegociáveis:

- Observabilidade rodando em menos de 2 minutos
- Funcionar instantaneamente, sem config
- Substituir o stack OpenTelemetry + Grafana + Jaeger + Datadog para o público acima

---

## Stack

**Backend**: Node.js ≥ 20, TypeScript, AsyncLocalStorage, perf_hooks, ws

**Frontend**: React 19, Vite 6, Tailwind v4, lucide-react

**Monorepo**: pnpm workspaces + Turborepo

---

## Estrutura de packages

```
packages/
  core/        # API pública; orquestra storage + transport; tracing automático
  storage/     # ring buffer in-memory (evolui para SQLite/Postgres)
  transport/   # servidor HTTP+WS que serve dashboard e broadcasta spans
  dashboard/   # UI React/Vite/Tailwind; consumida pelo transport como build estático
  plugins/     # integrações opt-in (Express, Prisma, etc) — depende do core
```

---

## Estado atual (linha de base)

**Fundação** (pré-Fase 1):
- Monorepo configurado (pnpm + Turborepo + TS estrito)
- `sysko.init()` zero-config; sobe storage + transport + dashboard
- Tracing automático de requests HTTP via monkeypatch em `http.Server.prototype.emit`
- `AsyncLocalStorage` plumado para contexto de request
- Spans com `perf_hooks` (id, kind, name, startTime, duration, attributes)
- Ring buffer in-memory com subscribe
- Servidor HTTP+WS que serve dashboard estático e broadcasta spans
- Dashboard com header, KPIs, lista densa, detail panel, pause/clear, empty state, **waterfall**
- Marker para ignorar o próprio servidor interno (`Symbol.for("sysko.internalServer")`)
- Distribuição via tarballs `pnpm pack` + `pnpm.overrides`

**Fase 1 concluída**:
- Span hierarchy completo (`traceId`, `parentSpanId`, propagação via ALS)
- Outbound HTTP instrumentado (`http.request`, `https.request`, `http.get`, `https.get`, `fetch` global)
- Plugin Prisma via middleware `$use` → spans `db.query` com `db.system`, `db.operation`, `db.model`
- Captura de exceções: 5xx, abort (`http.aborted`), `uncaughtException`, `unhandledRejection` marcam span ativo como `status: "error"` com stack
- Waterfall view no dashboard mostrando árvore por traceId com barras temporais
- Custom spans API: `startSpan()` + `withSpan()` (auto-close sync ou async)
- Statuscode só gravado se `headersSent === true`; lista mostra `abort` em vermelho quando aplicável

**Fase 2 concluída**:
- Express plugin (`instrumentExpress`) extrai `http.route` (`/users/:id`) via `prependOnceListener("finish")` para rodar antes do finalize do core
- Hook API `sysko.onSpan(hook)` permite transformar (retornando `Span`) ou descartar (`null`) cada span; suporta múltiplos hooks com cleanup
- Sampling configurável (`init({ sampling: 0.1 })`) — decisão no root, propagada para children via `SpanContext.sampled`. Spans não amostrados usam `NOOP_HANDLE` (zero alocação extra)
- Redação PII (`init({ redact: { paths, queryParams } })`) — descarta spans cujo path bate em pattern (suporta `*`, regex) e mascara query params sensíveis em `http.url`

**Fase 4 parcial** (CLI + plugin Fastify + exemplo):
- `@sysko/cli` com comando `init`: detecta framework por `package.json` (express/fastify/next/nestjs/generic), encontra entry file (`src/server.ts`, `src/index.ts`, etc.), tem modo dry-run e `--yes` para aplicar
- Injeta `import { init } from "@sysko/core"` + `await init({ serviceName })` no topo do entry, preservando shebang
- Adiciona `@sysko/core` (e `@sysko/plugins` se framework detectado) nas dependências do `package.json`
- Plugin Fastify (`@sysko/plugins/fastify`) via hook `onRequest` que lê `req.routeOptions.url` e grava como `http.route`
- Exemplo `examples/fastify-app` com mesmo padrão (routes + server + test runner) confirmando que zero-config funciona em qualquer http.Server (sem precisar do plugin pra captura básica)

**Fase 3 concluída** (exceto multi-serviço, que depende da Fase 4):
- Filtros funcionais no dashboard: search em path/route, método (multi-select), faixa de status (2xx/3xx/4xx/5xx/errored), duração mínima (50ms/250ms/1s)
- Tab "endpoints" com agregação por rota: count, error rate, p50/p95/p99, max — ordenável por count, p95, error rate, path
- Tab "distribution" com histograma de latência (12 buckets, contagem absoluta e relativa) + summary (count, min, avg, p50, p95, p99, max)
- Keyboard shortcuts: `/` (search), `j`/`k`/`↓`/`↑` (next/prev span), `Esc` (close panel), `Space` (pause), `c` (clear)
- URL hash routing: `#/trace/<id>` seleciona trace ao abrir; botão "copy link" no detail panel; `#/trace/<A>/vs/<B>` codifica comparação
- Export de trace como JSON (sysko-trace-<id>.json), botão Download no detail panel
- Compare traces: botão "compare with this" entra em modo de seleção; segundo trace abre lado a lado em split view (lista + 2 detail panels); banner lime de instrução com cancel via botão ou Esc
- Hint de atalhos toggleável no canto inferior direito

---

## Fase 1 — Tracing real (concluída)

**Objetivo**: parar de mostrar só "que request bateu" e passar a mostrar **o que aconteceu dentro da request**.

- [x] **Span hierarchy**: cada span tem `parentSpanId` e `traceId`. ALS propaga o span atual.
- [x] **Outbound HTTP**: hook em `http.request`/`https.request` + `fetch` global, criando span filho.
- [x] **Plugin Prisma**: wrap nas queries gerando span filho com operação/modelo e duração.
- [x] **Captura de exceções dentro do span**: status 5xx, abort, uncaughtException, unhandledRejection marcam span ativo.
- [x] **Waterfall view no dashboard**: árvore com barras temporais alinhadas, navegação entre spans.

---

## Fase 2 — Sinal de qualidade (concluída)

**Objetivo**: o que está sendo capturado vale, mas precisa estar **certo** e **enriquecido**.

- [x] **Captura de erros globais** (entregue na Fase 1)
- [x] **Custom spans API** (entregue na Fase 1 como `startSpan` / `withSpan`)
- [x] **Express plugin**: extrair route template (`/users/:id`) via middleware, gravar como `http.route`
- [x] **Hook API**: `sysko.onSpan((span) => span | null)` para o user enriquecer, filtrar ou mascarar
- [x] **Mascaramento de PII**: opções para descartar paths inteiros e mascarar query params sensíveis
- [x] **Sampling configurável**: `init({ sampling: 0.1 })` com decisão no root e propagação via ALS

---

## Fase 3 — Dashboard maduro (concluída exceto multi-serviço)

**Objetivo**: a UI tem que parecer ferramenta paga.

- [x] **Filtros funcionais**: search em path/route, método (multi-select), faixa de status, faixa de duração
- [x] **Stats por endpoint**: tab dedicada com count / error rate / p50 / p95 / p99 / max, ordenável
- [x] **Keyboard shortcuts**: `/`, `j`/`k`/`↓`/`↑`, `Esc`, `Space`, `c`
- [x] **Histograma de latência**: tab "distribution" com 12 buckets + summary
- [x] **Trace detail compartilhável**: URL hash `#/trace/<id>` e `#/trace/<A>/vs/<B>`, botão "copy link"
- [x] **Compare traces**: split view com 2 detail panels lado a lado
- [x] **Export de trace** como JSON (HAR fica como item v1.x)
- [ ] **Multi-serviço**: depende do agent collector da Fase 4 — agregação cross-processo

---

## Fase 4 — Distribuição (parcial)

**Objetivo**: alguém de fora consegue instalar sem ler o repo.

- [ ] **Publicar no npm**: `@sysko/core`, `@sysko/plugins`, `@sysko/cli`, etc.
- [x] **CLI `sysko init`**: detecta framework, injeta `await init()` no entry, atualiza `package.json` (modo dry-run por default, aplica com `--yes`)
- [x] **Exemplo Fastify** + plugin com route template via hook `onRequest`
- [ ] **Exemplos** restantes: `examples/nestjs-app`, `examples/nextjs-app`
- [ ] **Site de docs** estático (mdsvex/astro/qualquer): instalação, conceitos, plugin gallery, FAQ
- [ ] **Comparação com OTel/Datadog**: tabela honesta de quando usar Sysko e quando não usar
- [ ] **Logo e identidade visual** consistente entre lib, dashboard e site
- [ ] **Imagem Docker standalone**: agent collector separado do app, recebe spans via HTTP/UDP/gRPC e serve dashboard. Destrava multi-serviço da Fase 3

---

## Fase 5 — Produção real

**Objetivo**: pode rodar em prod sem medo.

- [ ] **Storage persistente SQLite**: default em `~/.sysko/<service>.db`. Sobrevive a restart.
- [ ] **Retention policies**: descarta spans antigos automaticamente (config por tempo ou tamanho).
- [ ] **Sampling adaptativo**: aumenta sample rate em rotas raras, baixa em rotas hot.
- [ ] **Buffer drain**: se o dashboard cair, segura no storage e re-emite quando voltar.
- [ ] **Rate limit interno**: cap total de spans/sec para nunca matar a hot path do app.
- [ ] **Graceful shutdown**: flush pendentes antes do processo morrer (SIGTERM/SIGINT).
- [ ] **Auth no dashboard**: basic auth via env var ou bind 127.0.0.1 only (com warning explícito se 0.0.0.0).
- [ ] **HTTPS**: certificado próprio ou reuso do certificado do app.
- [ ] **Benchmark de overhead**: targets explícitos (ex: < 1% CPU, < 5ms latência adicional em p99).

---

## Fase 6 — Diferenciação

**Objetivo**: virar a ferramenta que devs recomendam.

- [ ] **Distributed tracing**: propagar `traceparent` (W3C) em outbound HTTP; merge de traces entre serviços que rodam sysko.
- [ ] **Replay no histórico**: scrubber temporal (estilo Sentry session replay).
- [ ] **Self-observation**: sysko captura sysko (dogfood, e prova que overhead é aceitável).
- [ ] **Logs estruturados anexados ao span**: `console.log` dentro de uma request anexa ao span correspondente.
- [ ] **Alerting básico**: regras simples ("ping se p95 > 1s por 1min") com webhook.
- [ ] **Plugins de cache (Redis/Memcached)** e de message broker (BullMQ).

---

## Anti-roadmap

Coisas que **não** vamos fazer mesmo se pedirem, porque vão contra a tese:

- **Light theme**: dashboard é DevTools — sempre dark.
- **Config wizard interativo**: zero-config significa zero. Defaults sensatos > opções.
- **SSO, RBAC, audit log enterprise**: público errado.
- **Plugin para cada lib do npm**: cobrir 5 que importam, deixar o resto extensível via hook API.
- **App mobile**: dev abre o browser; não é status page.
- **Substituir Sentry/PostHog/etc**: somos tracing/observability, não error tracking nem product analytics. Foco.
- **Suporte a versões de Node < 20**: AsyncLocalStorage moderno vale o cutoff.

---

## Como medir "completo"

Sysko é considerado **v1.0** quando:

1. Um dev instala num app Express/Fastify/Next.js em < 2 minutos
2. Vê requests **e** suas DB queries no dashboard sem nenhuma config adicional
3. Erros do servidor aparecem com stack trace anexado
4. Pode rodar em produção com sampling, mascaramento de PII e auth no dashboard
5. Sobrevive a restart do processo (storage persistente)
6. Está publicado no npm sob `@sysko/*` com docs e ao menos 3 exemplos funcionais

Tudo da Fase 1 até Fase 5 — Fase 6 é v1.x+.
