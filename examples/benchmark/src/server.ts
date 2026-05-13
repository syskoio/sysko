// Baseline server — no Sysko instrumentation.
import express from "express";

const app = express();

app.get("/", (_req, res) => res.json({ ok: true }));
app.get("/work", async (_req, res) => {
  await new Promise<void>((r) => setTimeout(r, 1));
  res.json({ result: 42 });
});

app.listen(4000, () => console.log("[bench] baseline listening on http://localhost:4000"));
