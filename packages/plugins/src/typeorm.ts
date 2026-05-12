import { startSpan } from "@syskoio/core";

export interface TypeORMQueryRunnerLike {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

export interface TypeORMDataSourceLike {
  options: { type?: string };
  createQueryRunner(mode?: "master" | "slave"): TypeORMQueryRunnerLike;
}

// Patches dataSource.createQueryRunner() so that every runner it produces
// has its query() method wrapped with a db.query span. This captures both
// raw DataSource.query() calls and ORM operations (find, save, etc.) since
// TypeORM routes all SQL through QueryRunner.query() internally.
export function instrumentTypeORM(dataSource: TypeORMDataSourceLike): void {
  const origCreate = dataSource.createQueryRunner.bind(dataSource);
  const dbSystem = dataSource.options.type ?? "unknown";

  dataSource.createQueryRunner = function (mode?: "master" | "slave"): TypeORMQueryRunnerLike {
    const runner = origCreate(mode);
    const origQuery = runner.query.bind(runner);

    runner.query = async function (sql: string, parameters?: unknown[]): Promise<unknown> {
      const operation = /^\s*(\w+)/.exec(sql)?.[1]?.toUpperCase() ?? "QUERY";

      const span = startSpan({
        kind: "db.query",
        name: `${dbSystem} ${operation}`,
        attributes: {
          "db.system": dbSystem,
          "db.operation": operation,
          "db.statement": sql.length > 200 ? sql.slice(0, 197) + "..." : sql,
        },
      });

      try {
        const result = await origQuery(sql, parameters);
        span.end();
        return result;
      } catch (err) {
        span.setStatus("error", err);
        span.end();
        throw err;
      }
    };

    return runner;
  };
}
