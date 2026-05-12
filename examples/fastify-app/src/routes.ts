import type { FastifyInstance } from "fastify";
import { withSpan } from "@syskoio/core";

export function defineRoutes(app: FastifyInstance): void {
  app.get("/", async () => "hello sysko");

  app.get("/slow", async () => {
    await new Promise((r) => setTimeout(r, 250));
    return { ok: true };
  });

  app.get("/error", async (_req, reply) => {
    reply.code(500);
    return "boom";
  });

  app.get<{ Params: { id: string } }>("/users/:id", async (req) => {
    return { id: req.params.id, name: "alice" };
  });

  app.get("/zen", async () => {
    const r = await fetch("https://api.github.com/zen");
    return await r.text();
  });

  app.get("/fanout", async () => {
    const [a, b] = await Promise.all([
      fetch("https://api.github.com/zen").then((r) => r.text()),
      fetch("https://api.github.com/octocat").then((r) => r.text()),
    ]);
    return { a, b: b.slice(0, 80) };
  });

  app.get("/work", async () => {
    const result = await withSpan(
      { kind: "internal", name: "expensive computation" },
      async () => {
        await new Promise((r) => setTimeout(r, 80));
        return 42;
      },
    );
    return { result };
  });

  app.get("/throw", async () => {
    throw new Error("intentional handler failure");
  });
}
