import { startSpan } from "@syskoio/core";
import type { SpanHandle } from "@syskoio/core";

interface MongoosePreContext {
  __sysko_span?: SpanHandle;
}

interface MongooseSchema {
  pre(op: string, fn: (this: MongoosePreContext, next: () => void) => void): this;
  post(op: string, fn: (this: MongoosePreContext, result: unknown, next: () => void) => void): this;
}

export interface InstrumentMongooseOptions {
  collection?: string;
}

const QUERY_OPS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
  "estimatedDocumentCount",
] as const;

export function instrumentMongoose(schema: MongooseSchema, options: InstrumentMongooseOptions = {}): void {
  const baseAttrs = {
    "db.system": "mongodb",
    ...(options.collection !== undefined ? { "db.collection": options.collection } : {}),
  };

  for (const op of QUERY_OPS) {
    schema.pre(op, function (next) {
      this.__sysko_span = startSpan({
        kind: "db.query",
        name: `mongoose ${op}`,
        attributes: { ...baseAttrs, "db.operation": op },
      });
      next();
    });

    schema.post(op, function (_result, next) {
      this.__sysko_span?.end();
      delete this.__sysko_span;
      next();
    });
  }

  schema.pre("save", function (next) {
    this.__sysko_span = startSpan({
      kind: "db.query",
      name: "mongoose save",
      attributes: { ...baseAttrs, "db.operation": "save" },
    });
    next();
  });

  schema.post("save", function (_result, next) {
    this.__sysko_span?.end();
    delete this.__sysko_span;
    next();
  });
}
