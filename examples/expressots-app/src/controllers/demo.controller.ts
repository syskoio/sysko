import "reflect-metadata";
import type { Request, Response } from "express";
import { withSpan, type Sysko } from "@syskoio/core";
import { controller, Get, request, response } from "@expressots/adapter-express";

// sysko handle is set by main.ts after init() resolves; lazy-read on first use.
let _sysko: Sysko | undefined;
export function setSysko(s: Sysko): void {
  _sysko = s;
}

@controller("/")
export class DemoController {
  @Get("")
  hello(@response() res: Response): void {
    res.send("hello sysko + expressots");
  }

  @Get("slow")
  async slow(@response() res: Response): Promise<void> {
    await new Promise((r) => setTimeout(r, 250));
    res.json({ ok: true });
  }

  @Get("error")
  error(@response() res: Response): void {
    res.status(500).send("boom");
  }

  @Get("zen")
  async zen(@response() res: Response): Promise<void> {
    const r = await fetch("https://api.github.com/zen");
    res.send(await r.text());
  }

  @Get("fanout")
  async fanout(@response() res: Response): Promise<void> {
    const [a, b] = await Promise.all([
      fetch("https://api.github.com/zen").then((r) => r.text()),
      fetch("https://api.github.com/octocat").then((r) => r.text()),
    ]);
    res.json({ a, b: b.slice(0, 80) });
  }

  @Get("work")
  async work(@response() res: Response): Promise<void> {
    const result = await withSpan(
      { kind: "internal", name: "expensive computation" },
      async () => {
        await new Promise((r) => setTimeout(r, 80));
        return 42;
      },
    );
    res.json({ result });
  }

  @Get("throw")
  async doThrow(): Promise<never> {
    throw new Error("intentional handler failure");
  }

  @Get("logs")
  async logs(@request() req: Request, @response() res: Response): Promise<void> {
    console.log("request received");
    console.info("fetching user from db");

    const user = await withSpan({ kind: "db.query", name: "users.findOne" }, async () => {
      await new Promise((r) => setTimeout(r, 30));
      console.log("query executed, 1 row returned");
      return { id: 1, name: "alice", role: "admin" };
    });

    if (user.role === "admin") {
      console.warn("admin access detected");
    }

    _sysko?.log("info", `serving user ${user.id} via sysko.log()`);

    console.error("simulated error mid-request (non-fatal)");
    res.json(user);
  }

  @Get("traceparent/echo")
  echoTraceparent(@request() req: Request, @response() res: Response): void {
    const header = req.headers["traceparent"] ?? null;
    res.json({
      traceparent: header,
      traceId: header ? (String(header).split("-")[1] ?? null) : null,
    });
  }

  @Get("traceparent/self-call")
  async selfCall(@request() req: Request, @response() res: Response): Promise<void> {
    const port = (req.socket.localPort ?? 3004).toString();
    const r = await fetch(`http://localhost:${port}/traceparent/echo`);
    const data = await r.json() as { traceparent: string | null; traceId: string | null };
    res.json({
      propagated: data.traceparent !== null,
      receivedTraceparent: data.traceparent,
      sharedTraceId: data.traceId,
    });
  }
}
