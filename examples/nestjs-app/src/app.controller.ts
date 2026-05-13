import "reflect-metadata";
import { Controller, Get, HttpException, Param, Headers, Req } from "@nestjs/common";
import type { Request } from "express";
import { withSpan } from "@syskoio/core";

@Controller()
export class AppController {
  @Get("/")
  root(): string {
    return "hello sysko";
  }

  @Get("slow")
  async slow(): Promise<{ ok: boolean }> {
    await new Promise<void>((r) => setTimeout(r, 250));
    return { ok: true };
  }

  @Get("error")
  error(): never {
    throw new HttpException("boom", 500);
  }

  @Get("users/:id")
  users(@Param("id") id: string): { id: string; name: string } {
    return { id, name: "alice" };
  }

  @Get("zen")
  async zen(): Promise<string> {
    const r = await fetch("https://api.github.com/zen");
    return r.text();
  }

  @Get("work")
  async work(): Promise<{ result: number }> {
    const result = await withSpan(
      { kind: "internal", name: "expensive computation" },
      async () => {
        await new Promise<void>((r) => setTimeout(r, 80));
        return 42;
      },
    );
    return { result };
  }

  @Get("throw")
  doThrow(): never {
    throw new Error("intentional handler failure");
  }

  @Get("logs")
  async logs(): Promise<{ id: number; name: string; role: string }> {
    console.log("request received");
    console.info("fetching user from db");

    const user = await withSpan({ kind: "db.query", name: "users.findOne" }, async () => {
      await new Promise<void>((r) => setTimeout(r, 30));
      console.log("query executed, 1 row returned");
      return { id: 1, name: "alice", role: "admin" };
    });

    if (user.role === "admin") {
      console.warn("admin access detected");
    }

    console.error("simulated error mid-request (non-fatal)");
    return user;
  }

  @Get("traceparent/echo")
  echoTraceparent(@Headers("traceparent") traceparent: string | undefined): {
    traceparent: string | null;
    traceId: string | null;
  } {
    const header = traceparent ?? null;
    return {
      traceparent: header,
      traceId: header ? (String(header).split("-")[1] ?? null) : null,
    };
  }

  @Get("traceparent/self-call")
  async selfCall(@Req() req: Request): Promise<{
    propagated: boolean;
    receivedTraceparent: string | null;
    sharedTraceId: string | null;
  }> {
    const port = (req.socket.localPort ?? 3006).toString();
    const r = await fetch(`http://localhost:${port}/traceparent/echo`);
    const data = await r.json() as { traceparent: string | null; traceId: string | null };
    return {
      propagated: data.traceparent !== null,
      receivedTraceparent: data.traceparent,
      sharedTraceId: data.traceId,
    };
  }
}
