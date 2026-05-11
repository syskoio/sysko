import { startSpan } from "@sysko/core";

export interface PrismaMiddlewareParams {
  model?: string;
  action: string;
  args: unknown;
  dataPath: string[];
  runInTransaction: boolean;
}

export interface PrismaLike {
  $use(
    middleware: (
      params: PrismaMiddlewareParams,
      next: (params: PrismaMiddlewareParams) => Promise<unknown>,
    ) => Promise<unknown>,
  ): void;
}

export function instrumentPrisma(client: PrismaLike): void {
  client.$use(async (params, next) => {
    const target = params.model ? `${params.model}.${params.action}` : params.action;
    const span = startSpan({
      kind: "db.query",
      name: `prisma ${target}`,
      attributes: {
        "db.system": "prisma",
        "db.operation": params.action,
        ...(params.model !== undefined ? { "db.model": params.model } : {}),
      },
    });
    try {
      const result = await next(params);
      span.end();
      return result;
    } catch (err) {
      span.setStatus("error", err);
      span.end();
      throw err;
    }
  });
}
