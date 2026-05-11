# Sysko Observe

> Observabilidade zero-config para Node.js — Chrome DevTools para backend.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-blue.svg)](#requirements)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#status)

Sysko é uma biblioteca de tracing e dashboard para Node.js que tenta substituir o stack OpenTelemetry + Grafana + Jaeger + Datadog quando você é uma startup, SaaS, microsserviço ou dev solo — sem config, sem agent externo, sem painel pago.

```ts
import { init } from "@sysko/core";

await init({ serviceName: "my-app" });

// rest of your app — requests are now traced automatically
```

Abre `http://localhost:9999` e vê tudo em tempo real.

---

## Tese

- **Zero-config.** `init()` e funciona. Defaults sensatos > opções.
- **UX absurda.** Instalar e ver dados em menos de 2 minutos.
- **Tracing automático.** Você não espalha `tracer.start(...)` no código. Instrumentação acontece via monkeypatch em `http.Server.prototype.emit`, `http.request`, `globalThis.fetch` e `AsyncLocalStorage`.
- **Dashboard realtime no navegador.** Sem Prometheus, sem Loki, sem coletor externo. Tudo embutido no processo.

Para quem **não é**: ferramenta de SRE corporativo. Sysko prioriza atrito zero sobre extensibilidade infinita.

---

## Status

Alpha. Ainda não publicado no npm — instalação atualmente via tarballs locais (veja [Instalando em um projeto existente](#instalando-em-um-projeto-existente)).

Roadmap em [ROADMAP.md](ROADMAP.md). Fases 1, 2, 3 concluídas; Fase 4 parcial.

---

## Quick start

### 1. Em um projeto novo dentro deste monorepo

```bash
pnpm install
pnpm build
pnpm --filter example-express-app start
```

Em outro terminal:

```bash
pnpm --filter example-express-app test
```

Abre [http://localhost:9999](http://localhost:9999) — dashboard ao vivo enquanto o tráfego flui.

### 2. Instalando em um projeto existente

Como ainda não publicamos no npm, distribuímos via tarballs:

```bash
# no diretório do sysko
pnpm pack:all
# gera dist-packs/sysko-*.tgz

# no seu projeto
mkdir vendor
cp /path/to/sysko/dist-packs/*.tgz vendor/
```

Adicione ao `package.json` do seu projeto:

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

Instale e inicialize:

```bash
pnpm add ./vendor/sysko-core-0.0.1.tgz
pnpm add ./vendor/sysko-plugins-0.0.1.tgz   # opcional, para route templates
```

```ts
// no topo do seu entry
import { init } from "@sysko/core";
await init({ serviceName: "my-app" });
```

Ou use o CLI para fazer isso automaticamente:

```bash
node /path/to/sysko/packages/cli/dist/index.js init --yes
```

---

## O que você ganha

- **Captura automática de requests HTTP** entrando e saindo do processo (`http.request`, `https.request`, `fetch` global)
- **Span hierarchy** com `traceId` e `parentSpanId` propagados via `AsyncLocalStorage`
- **Captura de erros**: status 5xx, request aborts, `uncaughtException`, `unhandledRejection` — todos marcam o span ativo
- **Dashboard realtime** com:
  - Lista de spans com pause/clear
  - Detail panel com waterfall view de todos os spans do trace
  - Agregação por endpoint (count, error rate, p50/p95/p99, max)
  - Histograma de latência
  - Filtros (método, faixa de status, duração mínima, search em path)
  - Compare traces (split view)
  - Export trace como JSON
  - URLs compartilháveis (`#/trace/<id>` e `#/trace/<A>/vs/<B>`)
  - Keyboard shortcuts (`/`, `j`/`k`, `Esc`, `Space`, `c`)
- **Hook API** para enriquecer ou descartar spans antes de gravar
- **Sampling** propagado por trace (zero alocação em spans não amostrados)
- **Redação PII** para query params sensíveis e paths inteiros

---

## Frameworks suportados

| Framework        | Tracing automático | Route templates                    |
| ---------------- | ------------------ | ---------------------------------- |
| Express          | sim                | `@sysko/plugins/express`           |
| Fastify          | sim                | `@sysko/plugins/fastify`           |
| Qualquer http.Server | sim            | n/a                                |
| Prisma (queries) | n/a                | `@sysko/plugins/prisma`            |

NestJS e Next.js funcionam para captura automática (ambos usam `http.Server` por baixo), mas ainda não têm plugin específico para route templates.

---

## Configuração

```ts
await init({
  serviceName: "my-app",         // aparece nos spans
  capacity: 1000,                // tamanho do ring buffer in-memory
  sampling: 1,                   // 0..1 — fração de traces a capturar
  redact: {
    paths: ["/healthz", "/internal/*"],   // glob ou RegExp
    queryParams: ["token", "apiKey"],     // mascarados como ***
  },
  dashboard: {
    port: 9999,                  // ou `false` para desligar o dashboard
    host: "127.0.0.1",
  },
});
```

### Hook API

```ts
const sysko = await init({...});

sysko.onSpan((span) => {
  span.attributes["service.region"] = process.env.REGION ?? "local";
  return span;          // retorna Span para substituir
                        // retorna null para descartar
                        // não retorna nada (void) para manter
});
```

### Spans customizados

```ts
import { withSpan } from "@sysko/core";

await withSpan({ kind: "internal", name: "expensive-job" }, async () => {
  // suas operações; span fecha automaticamente (mesmo se throw)
});
```

---

## Arquitetura

```
packages/
├── core/        # API pública; orquestra storage + transport; tracing automático
├── storage/     # Ring buffer in-memory
├── transport/   # Servidor HTTP+WS que serve dashboard e broadcasta spans
├── dashboard/   # UI React + Vite + Tailwind v4
├── plugins/     # Integrações opt-in: Express, Fastify, Prisma
└── cli/         # `sysko init`
```

Direção de dependências:

```
core       →  storage, transport      (core orquestra)
plugins    →  core
dashboard  →  (build estático servido pelo transport)
transport, storage  →  (autônomos)
```

---

## Desenvolvimento

Requer Node ≥ 20, pnpm ≥ 10.

```bash
pnpm install
pnpm build         # compila tudo (turbo cache)
pnpm dev           # tsc --watch em paralelo + Vite no dashboard
pnpm typecheck
pnpm pack:all      # gera tarballs em dist-packs/ para instalação externa
```

Para mexer só na UI:

```bash
pnpm --filter @sysko/dashboard dev
```

Vite roda em `:5173` com proxy WS para `:9999` — você precisa também rodar um exemplo (ex.: `pnpm --filter example-express-app start`) para ter o transport em `:9999`.

---

## Examples

- [`examples/express-app`](examples/express-app/) — Express 4 com plugin
- [`examples/fastify-app`](examples/fastify-app/) — Fastify 5 com plugin

Cada example tem `pnpm start` (sobe o app) e `pnpm test` (dispara tráfego em todas as rotas, mostra resumo). Os spans aparecem no dashboard em `:9999` em tempo real.

---

## Contributing

Issues e PRs bem-vindos. Algumas dicas:

- Comentários em código só quando o *porquê* não é óbvio — nomes de identificadores já devem dizer o *quê*
- Para mudanças visuais no dashboard, valide manualmente no browser. Backend tests não capturam regressões visuais
- TypeScript estrito (`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Não adicione dependências ao `@sysko/core` sem necessidade clara — esse é o package que o usuário final instala
- Veja o [ROADMAP](ROADMAP.md) para o que tá planejado e o que **não** vamos fazer (anti-roadmap)

---

## License

MIT — veja [LICENSE](LICENSE).
