import type { Express } from "express";
import { withSpan, type Sysko } from "@syskoio/core";
import { randomUUID } from "node:crypto";
import { instrumentRedis } from "@syskoio/plugins/redis";
import { instrumentAxios } from "@syskoio/plugins/axios";
import { instrumentBullMQQueue, instrumentBullMQProcessor } from "@syskoio/plugins/bullmq";
import type { BullMQJob } from "@syskoio/plugins/bullmq";
import { instrumentMongoose } from "@syskoio/plugins/mongoose";
import { instrumentSequelize } from "@syskoio/plugins/sequelize";
import { instrumentTypeORM } from "@syskoio/plugins/typeorm";
import { instrumentPrisma } from "@syskoio/plugins/prisma";
import type { PrismaMiddlewareParams } from "@syskoio/plugins/prisma";

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

// ─── Prisma stub ───────────────────────────────────────────────────────────────
// Simulates the $use middleware chain without a real database.
type PrismaMiddleware = (
  params: PrismaMiddlewareParams,
  next: (params: PrismaMiddlewareParams) => Promise<unknown>,
) => Promise<unknown>;

const _prismaMiddlewares: PrismaMiddleware[] = [];

const _prismaData: Record<string, unknown[]> = {
  User: [
    { id: 1, name: "alice", email: "alice@example.com" },
    { id: 2, name: "bob",   email: "bob@example.com"   },
  ],
  Post: [
    { id: 1, title: "hello sysko", published: true, authorId: 1 },
  ],
};

async function runPrismaOp(model: string, action: string, args: unknown = {}): Promise<unknown> {
  const params: PrismaMiddlewareParams = {
    model,
    action,
    args,
    dataPath: [],
    runInTransaction: false,
  };

  // Walk the middleware chain, then execute the stub at the end.
  const execute = async (p: PrismaMiddlewareParams): Promise<unknown> => {
    await new Promise((r) => setTimeout(r, 8 + Math.random() * 12));
    const rows = _prismaData[p.model ?? ""] ?? [];
    if (p.action === "findMany") return rows;
    if (p.action === "findUnique") return rows[0] ?? null;
    if (p.action === "create") return { id: rows.length + 1, ...(p.args as Record<string, unknown>) };
    if (p.action === "update") return { ...(rows[0] as Record<string, unknown>), ...(p.args as Record<string, unknown>) };
    if (p.action === "delete") return rows[0] ?? null;
    if (p.action === "count") return rows.length;
    return null;
  };

  // Build the chain: each middleware calls next(), which invokes the next one.
  const chain = _prismaMiddlewares.reduceRight<(p: PrismaMiddlewareParams) => Promise<unknown>>(
    (next, mw) => (p) => mw(p, next),
    execute,
  );

  return chain(params);
}

const prismaStub = {
  $use: (mw: PrismaMiddleware) => { _prismaMiddlewares.push(mw); },
};
instrumentPrisma(prismaStub);

// ─── Error fingerprinting demo helpers ─────────────────────────────────────────
// Defined at module scope so their line numbers are stable and fingerprints
// remain consistent across restarts. Errors thrown from throwValidationError
// share the same stack frame regardless of which route called it, so they
// land in the same group in the errors tab.

function throwValidationError(field: string): never {
  const err = new Error(`validation failed: '${field}' is required`);
  err.name = "ValidationError";
  throw err;
}

class DatabaseError extends Error {
  constructor(operation: string) {
    super(`database unavailable during ${operation}: ECONNREFUSED`);
    this.name = "DatabaseError";
  }
}

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

  // Prisma — findMany (db.model: User)
  app.get("/plugins/prisma/find", async (_req, res) => {
    const users = await runPrismaOp("User", "findMany");
    res.json(users);
  });

  // Prisma — findUnique (db.model: Post)
  app.get("/plugins/prisma/find-one", async (_req, res) => {
    const post = await runPrismaOp("Post", "findUnique", { where: { id: 1 } });
    res.json(post);
  });

  // Prisma — create (db.model: User)
  app.get("/plugins/prisma/create", async (_req, res) => {
    const user = await runPrismaOp("User", "create", { data: { name: "carol", email: "carol@example.com" } });
    res.json(user);
  });

  // Prisma — count (db.model: Post)
  app.get("/plugins/prisma/count", async (_req, res) => {
    const count = await runPrismaOp("Post", "count");
    res.json({ count });
  });

  // ─── W3C traceparent / distributed tracing demo ──────────────────────────────

  // Echoes back the traceparent header this request received (if any).
  // Used by /traceparent/self-call to confirm the header was injected.
  app.get("/traceparent/echo", (req, res) => {
    res.json({
      traceparent: req.headers["traceparent"] ?? null,
      traceId: req.headers["traceparent"]
        ? String(req.headers["traceparent"]).split("-")[1] ?? null
        : null,
    });
  });

  // Makes an outbound fetch to /traceparent/echo on the same server.
  // This creates three spans that share the same traceId:
  //   1. http.server  GET /traceparent/self-call  (root, traceId = T)
  //   2. http.client  GET localhost/traceparent/echo  (child, traceId = T, injects traceparent)
  //   3. http.server  GET /traceparent/echo  (continues trace, traceId = T)
  app.get("/traceparent/self-call", async (req, res) => {
    const port = (req.socket.localPort ?? 3000).toString();
    const response = await fetch(`http://localhost:${port}/traceparent/echo`);
    const data = await response.json() as { traceparent: string | null; traceId: string | null };
    res.json({
      propagated: data.traceparent !== null,
      receivedTraceparent: data.traceparent,
      sharedTraceId: data.traceId,
    });
  });

  // ─── Error fingerprinting demo ────────────────────────────────────────────────
  // Each route below creates a child span via withSpan that ends up with
  // status: error. The errors tab groups them by (error.name, top stack frame).

  // TypeError — always the same frame → collapses into one group however often hit.
  app.get("/errors/type-error", async (_req, res) => {
    try {
      await withSpan({ kind: "internal", name: "parse response" }, async () => {
        throw new TypeError("Cannot read properties of null (reading 'id')");
      });
    } catch {
      res.status(500).json({ error: "internal error" });
    }
  });

  // RangeError — distinct name → separate group from TypeError.
  app.get("/errors/range-error", async (_req, res) => {
    try {
      await withSpan({ kind: "internal", name: "validate range" }, async () => {
        throw new RangeError("value 150 is out of range [0, 100]");
      });
    } catch {
      res.status(400).json({ error: "range error" });
    }
  });

  // Two routes share throwValidationError() — the top stack frame is identical
  // so both land in the same fingerprint group in the errors tab, even though
  // they serve different endpoints (visible in the "seen on" list).
  app.get("/errors/validation/name", async (_req, res) => {
    try {
      await withSpan({ kind: "internal", name: "validate user name" }, async () => {
        throwValidationError("name");
      });
    } catch {
      res.status(400).json({ error: "validation", field: "name" });
    }
  });

  app.get("/errors/validation/email", async (_req, res) => {
    try {
      await withSpan({ kind: "internal", name: "validate user email" }, async () => {
        throwValidationError("email");
      });
    } catch {
      res.status(400).json({ error: "validation", field: "email" });
    }
  });

  // Custom error class — separate group, different name and constructor frame.
  app.get("/errors/db", async (_req, res) => {
    try {
      await withSpan({ kind: "db.query", name: "users.findById" }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        throw new DatabaseError("findById");
      });
    } catch {
      res.status(503).json({ error: "service unavailable" });
    }
  });

  // Nested withSpan cascade — outer span wraps inner; only the inner span
  // (inventory.decrement) is error. Waterfall shows the full chain.
  app.get("/errors/cascade", async (_req, res) => {
    try {
      await withSpan({ kind: "internal", name: "process order" }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        await withSpan({ kind: "db.query", name: "inventory.decrement" }, async () => {
          await new Promise((r) => setTimeout(r, 15));
          throw new Error("insufficient stock: SKU-42 is out of stock");
        });
      });
    } catch {
      res.status(409).json({ error: "conflict", reason: "insufficient stock" });
    }
  });
}
