import type { Express } from "express";
import { withSpan } from "@sysko/core";

export function defineRoutes(app: Express): void {
  app.get("/", (_req, res) => {
    res.send("hello sysko");
  });

  app.get("/slow", async (_req, res) => {
    await new Promise((r) => setTimeout(r, 250));
    res.json({ ok: true });
  });

  app.get("/error", (_req, res) => {
    res.status(500).send("boom");
  });

  app.get("/users/:id", (req, res) => {
    res.json({ id: req.params.id, name: "alice" });
  });

  app.get("/zen", async (_req, res) => {
    const r = await fetch("https://api.github.com/zen");
    const text = await r.text();
    res.send(text);
  });

  app.get("/fanout", async (_req, res) => {
    const [a, b] = await Promise.all([
      fetch("https://api.github.com/zen").then((r) => r.text()),
      fetch("https://api.github.com/octocat").then((r) => r.text()),
    ]);
    res.json({ a, b: b.slice(0, 80) });
  });

  app.get("/work", async (_req, res) => {
    const result = await withSpan(
      { kind: "internal", name: "expensive computation" },
      async () => {
        await new Promise((r) => setTimeout(r, 80));
        return 42;
      },
    );
    res.json({ result });
  });

  app.get("/throw", async () => {
    throw new Error("intentional handler failure");
  });
}
