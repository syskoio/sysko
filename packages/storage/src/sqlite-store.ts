import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Span } from "./span.js";
import type { SpanListener, SpanStore } from "./ring-buffer.js";

export interface RetentionOptions {
  days?: number;
  maxRows?: number;
}

export class SqliteStore implements SpanStore {
  private readonly db: InstanceType<typeof Database>;
  private readonly listeners = new Set<SpanListener>();
  private readonly maxRows: number;
  private readonly insertStmt: Database.Statement<[string, string, number]>;
  private readonly pruneStmt: Database.Statement<[number]>;
  private pushCount = 0;

  constructor(path: string, retention: RetentionOptions = {}) {
    mkdirSync(dirname(path), { recursive: true });

    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS spans (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        start_time INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_spans_start_time ON spans(start_time);
    `);

    const days = retention.days ?? 7;
    this.maxRows = retention.maxRows ?? 5000;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    this.db.prepare<[number]>("DELETE FROM spans WHERE start_time < ?").run(cutoff);

    this.insertStmt = this.db.prepare<[string, string, number]>(
      "INSERT OR REPLACE INTO spans (id, data, start_time) VALUES (?, ?, ?)",
    );
    this.pruneStmt = this.db.prepare<[number]>(
      `DELETE FROM spans WHERE id IN (
         SELECT id FROM spans ORDER BY start_time ASC
         LIMIT MAX(0, (SELECT COUNT(*) FROM spans) - ?)
       )`,
    );
  }

  push(span: Span): void {
    this.insertStmt.run(span.id, JSON.stringify(span), span.startTime);

    if (++this.pushCount % 100 === 0) {
      this.pruneStmt.run(this.maxRows);
    }

    for (const listener of this.listeners) {
      listener(span);
    }
  }

  list(): Span[] {
    const rows = this.db
      .prepare("SELECT data FROM spans ORDER BY start_time ASC")
      .all() as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data) as Span);
  }

  subscribe(listener: SpanListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    this.db.close();
  }
}
