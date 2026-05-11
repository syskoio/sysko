import { startSpan } from "@sysko/core";

// Sequelize supports both raw-string SQL and the { query, values } object form.
type SequelizeQuery = string | { query: string; values?: unknown[] };

export interface SequelizeLike {
  getDialect(): string;
  query(sql: SequelizeQuery, options?: unknown): Promise<unknown>;
}

export function instrumentSequelize(sequelize: SequelizeLike): void {
  const orig = sequelize.query.bind(sequelize);

  sequelize.query = async function (sql: SequelizeQuery, options?: unknown): Promise<unknown> {
    const sqlStr = typeof sql === "string" ? sql : sql.query;
    const operation = /^\s*(\w+)/.exec(sqlStr)?.[1]?.toUpperCase() ?? "QUERY";
    const dialect = sequelize.getDialect();

    const span = startSpan({
      kind: "db.query",
      name: `${dialect} ${operation}`,
      attributes: {
        "db.system": dialect,
        "db.operation": operation,
        "db.statement": sqlStr.length > 200 ? sqlStr.slice(0, 197) + "..." : sqlStr,
      },
    });

    try {
      const result = await orig(sql, options);
      span.end();
      return result;
    } catch (err) {
      span.setStatus("error", err);
      span.end();
      throw err;
    }
  };
}
