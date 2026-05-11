import type { Express } from "express";
import { withSpan, type Sysko } from "@sysko/core";
import { randomUUID } from "node:crypto";
import { instrumentRedis } from "@sysko/plugins/redis";
import { instrumentAxios } from "@sysko/plugins/axios";
import { instrumentBullMQQueue, instrumentBullMQProcessor } from "@sysko/plugins/bullmq";
import type { BullMQJob } from "@sysko/plugins/bullmq";
import { instrumentMongoose } from "@sysko/plugins/mongoose";
import { instrumentSequelize } from "@sysko/plugins/sequelize";
import { instrumentTypeORM } from "@sysko/plugins/typeorm";

// ─── Redis stub ────────────────────────────────────────────────────────────────
// In-memory store that satisfies instrumentRedis's structural contract.
const _redisStore = new Map<string, string>([["user:1", JSON.stringify({ id: 1, name: "alice" })]]);

const redis = instrumentRedis({
  get: (key: string) =>
    new Promise<string | null>((r) => setTimeout(() => r(_redisStore.get(key) ?? null), 5 + Math.random() * 10)),
  set: (key: string, value: string) =>
    new Promise<"OK">((r) => { _redisStore.set(key, value); setTimeout(() => r("OK"), 3); }),
  del: (key: string) =>
    new Promise<number>((r) => { const n = _redisStore.delete(key) ? 1 : 0; setTimeout(() => r(n), 3); }),
});

// ─── Axios stub ────────────────────────────────────────────────────────────────
// Fake interceptor chain — simulates latency without real HTTP (avoids double-spans).
type AConfig = { method?: string; url?: string; baseURL?: string; [key: string]: unknown };
type AResponse = { status: number; config: AConfig; data: unknown };

const _reqInterceptors: Array<(c: AConfig) => AConfig> = [];
const _resInterceptors: Array<(r: AResponse) => AResponse> = [];

const axiosInstance = {
  interceptors: {
    request: {
      use: (fn: (c: AConfig) => AConfig): number => { _reqInterceptors.push(fn); return 0; },
    },
    response: {
      use: (ok: (r: AResponse) => AResponse, _err: (e: unknown) => unknown): number => {
        _resInterceptors.push(ok);
        return 0;
      },
    },
  },
  async get(url: string): Promise<AResponse> {
    let config: AConfig = { method: "GET", url };
    for (const fn of _reqInterceptors) config = fn(config);
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 40));
    let result: AResponse = { status: 200, config, data: { url, ok: true } };
    for (const fn of _resInterceptors) result = fn(result);
    return result;
  },
};

instrumentAxios(axiosInstance);

// ─── BullMQ stub ───────────────────────────────────────────────────────────────
interface QueuedJob extends BullMQJob { id: string; }

const _pendingJobs: QueuedJob[] = [];

const bullQueue = {
  name: "emails",
  add: async (jobName: string, data: unknown): Promise<{ id: string }> => {
    await new Promise((r) => setTimeout(r, 5));
    const job: QueuedJob = { id: randomUUID(), name: jobName, queueName: "emails", data };
    _pendingJobs.push(job);
    return { id: job.id };
  },
};

instrumentBullMQQueue(bullQueue);

// withSpan inside the processor creates a child span visible in the waterfall.
const processEmail = instrumentBullMQProcessor(async (_job: BullMQJob) => {
  await withSpan({ kind: "db.query", name: "users.insert" }, async () => {
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 20));
  });
});

// ─── Mongoose stub ─────────────────────────────────────────────────────────────
// Stores pre/post hooks in memory; runMongoOp drives them like a real query would.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _preHooks = new Map<string, Array<(this: any, next: () => void) => void>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _postHooks = new Map<string, Array<(this: any, result: unknown, next: () => void) => void>>();

interface MongoStub {
  pre(op: string, fn: (this: Record<string, unknown>, next: () => void) => void): this;
  post(op: string, fn: (this: Record<string, unknown>, result: unknown, next: () => void) => void): this;
}

const mongoSchema: MongoStub = {
  pre(op, fn) {
    const list = _preHooks.get(op) ?? [];
    _preHooks.set(op, list);
    list.push(fn);
    return this;
  },
  post(op, fn) {
    const list = _postHooks.get(op) ?? [];
    _postHooks.set(op, list);
    list.push(fn);
    return this;
  },
};

// Parameters<typeof instrumentMongoose>[0] resolves the internal MongooseSchema type.
instrumentMongoose(mongoSchema as unknown as Parameters<typeof instrumentMongoose>[0], { collection: "users" });

async function runMongoOp(op: string, delayMs: number): Promise<void> {
  const ctx: Record<string, unknown> = {};
  const noop = (): void => {};
  for (const fn of _preHooks.get(op) ?? []) fn.call(ctx, noop);
  await new Promise((r) => setTimeout(r, delayMs));
  for (const fn of _postHooks.get(op) ?? []) fn.call(ctx, {}, noop);
}

// ─── Sequelize stub ────────────────────────────────────────────────────────────
// instrumentSequelize mutates .query() in-place, then we use seqStub directly.
const _seqRows = [
  { id: 1, name: "alice", email: "alice@example.com" },
  { id: 2, name: "bob", email: "bob@example.com" },
];

const seqStub = {
  getDialect: () => "postgres",
  query: async (sql: string): Promise<unknown> => {
    await new Promise((r) => setTimeout(r, 8 + Math.random() * 12));
    const op = sql.trimStart().toUpperCase();
    if (op.startsWith("SELECT")) return [_seqRows, []];
    if (op.startsWith("INSERT")) return [{ affectedRows: 1 }];
    if (op.startsWith("UPDATE")) return [{ affectedRows: 1 }];
    if (op.startsWith("DELETE")) return [{ affectedRows: 1 }];
    return [[], []];
  },
};
instrumentSequelize(seqStub);

// ─── TypeORM stub ──────────────────────────────────────────────────────────────
// instrumentTypeORM patches createQueryRunner() in-place; create runners via
// typeormStub.createQueryRunner() to get instrumented instances.
const _typeormRows = [{ id: 1, title: "post one", published: true }];

const typeormStub = {
  options: { type: "mysql" },
  createQueryRunner: () => ({
    query: async (sql: string, _parameters?: unknown[]): Promise<unknown> => {
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 15));
      const op = sql.trimStart().toUpperCase();
      if (op.startsWith("SELECT")) return _typeormRows;
      if (op.startsWith("INSERT")) return { insertId: 3, affectedRows: 1 };
      if (op.startsWith("UPDATE")) return { affectedRows: 1 };
      if (op.startsWith("DELETE")) return { affectedRows: 1 };
      return [];
    },
  }),
};
instrumentTypeORM(typeormStub);

// ──────────────────────────────────────────────────────────────────────────────

export function defineRoutes(app: Express, sysko: Sysko): void {
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

  app.get("/bad-request", (req, res) => {
    const email = req.query["email"];
    if (!email || typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "validation failed", field: "email", message: "must be a valid email address" });
      return;
    }
    res.json({ ok: true });
  });

  app.get("/not-found", (_req, res) => {
    res.status(404).json({ error: "user not found", id: 99 });
  });

  app.get("/server-error", (_req, res) => {
    res.status(500).json({ error: "database connection failed", code: "ECONNREFUSED" });
  });

  app.get("/logs", async (_req, res) => {
    console.log("request received");
    console.info("fetching user from db");

    const user = await withSpan({ kind: "db.query", name: "users.findOne" }, async () => {
      await new Promise((r) => setTimeout(r, 30));
      console.log("query executed, 1 row returned");
      return { id: 1, name: "alice", role: "admin" };
    });

    if (user.role === "admin") {
      console.warn("admin access detected — audit log recommended");
    }

    sysko.log("info", `serving user ${user.id} via sysko.log()`);

    console.error("simulated error mid-request (non-fatal)");

    res.json(user);
  });

  // ─── Plugin routes ──────────────────────────────────────────────────────────

  // Redis — cache hit (key exists)
  app.get("/plugins/redis/hit", async (_req, res) => {
    const raw = await redis.get("user:1");
    const value = raw !== null ? (JSON.parse(raw) as unknown) : null;
    res.json({ key: "user:1", hit: raw !== null, value });
  });

  // Redis — cache miss (key absent)
  app.get("/plugins/redis/miss", async (_req, res) => {
    const raw = await redis.get("user:99");
    res.json({ key: "user:99", hit: raw !== null, value: raw });
  });

  // Redis — write then read
  app.get("/plugins/redis/set", async (_req, res) => {
    const key = `demo:${Date.now()}`;
    await redis.set(key, "sysko");
    const value = await redis.get(key);
    res.json({ key, value });
  });

  // axios — simulated outbound GET with instrumented interceptors
  app.get("/plugins/axios", async (_req, res) => {
    const response = await axiosInstance.get("https://api.example.com/users");
    res.json(response.data);
  });

  // BullMQ — enqueue a job (creates queue.publish span)
  app.get("/plugins/bullmq/enqueue", async (_req, res) => {
    const job = await bullQueue.add("send-welcome", { to: "user@example.com", template: "welcome" });
    res.json({ jobId: job.id, queue: bullQueue.name, pending: _pendingJobs.length });
  });

  // BullMQ — process next pending job (creates queue.consume span with db child)
  app.get("/plugins/bullmq/process", async (_req, res) => {
    const job = _pendingJobs.shift();
    if (!job) {
      res.json({ skipped: true, reason: "no pending jobs — call /plugins/bullmq/enqueue first" });
      return;
    }
    await processEmail(job);
    res.json({ processed: job.id, name: job.name });
  });

  // mongoose — findOne (creates db.query span)
  app.get("/plugins/mongoose/find", async (_req, res) => {
    await runMongoOp("findOne", 15 + Math.random() * 20);
    res.json({ id: 1, name: "alice", role: "admin" });
  });

  // mongoose — save (creates db.query span)
  app.get("/plugins/mongoose/save", async (_req, res) => {
    await runMongoOp("save", 10 + Math.random() * 15);
    res.json({ ok: true, id: 2, name: "bob" });
  });

  // Sequelize — SELECT (db.system: postgres)
  app.get("/plugins/sequelize/find", async (_req, res) => {
    const [rows] = await seqStub.query("SELECT id, name, email FROM users WHERE active = true LIMIT 10") as [unknown[]];
    res.json({ dialect: seqStub.getDialect(), rows });
  });

  // Sequelize — INSERT (db.system: postgres)
  app.get("/plugins/sequelize/insert", async (_req, res) => {
    await seqStub.query("INSERT INTO users (name, email) VALUES ('carol', 'carol@example.com')");
    res.json({ ok: true, dialect: seqStub.getDialect() });
  });

  // TypeORM — SELECT via instrumented QueryRunner (db.system: mysql)
  app.get("/plugins/typeorm/find", async (_req, res) => {
    const runner = typeormStub.createQueryRunner();
    const rows = await runner.query("SELECT id, title, published FROM posts WHERE published = 1 LIMIT 10");
    res.json({ dbType: typeormStub.options.type, rows });
  });

  // TypeORM — INSERT via instrumented QueryRunner (db.system: mysql)
  app.get("/plugins/typeorm/insert", async (_req, res) => {
    const runner = typeormStub.createQueryRunner();
    const result = await runner.query("INSERT INTO posts (title, published) VALUES (?, ?)", ["new post", true]);
    res.json({ ok: true, dbType: typeormStub.options.type, result });
  });
}
