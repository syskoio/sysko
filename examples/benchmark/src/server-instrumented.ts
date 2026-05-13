// Instrumented server — Sysko active with in-memory storage and no dashboard.
import { init } from "@syskoio/core";
import express from "express";

await init({
  serviceName: "bench",
  storage: "memory",
  dashboard: { port: false as unknown as number },
  sampling: 1,
});

const app = express();

app.get("/", (_req, res) => res.json({ ok: true }));
app.get("/work", async (_req, res) => {
  await new Promise<void>((r) => setTimeout(r, 1));
  res.json({ result: 42 });
});

app.listen(4001, () => console.log("[bench] instrumented listening on http://localhost:4001"));
