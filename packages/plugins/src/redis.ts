import { startSpan } from "@syskoio/core";

const TRACKED_COMMANDS = new Set([
  "get", "set", "del", "exists", "expire", "ttl", "pttl", "persist",
  "hget", "hset", "hdel", "hgetall", "hkeys", "hvals", "hexists",
  "lpush", "rpush", "lpop", "rpop", "lrange", "llen",
  "sadd", "srem", "smembers", "sismember", "scard",
  "zadd", "zrem", "zrange", "zrank", "zscore", "zcard",
  "incr", "decr", "incrby", "decrby",
  "mget", "mset", "msetnx",
  "getdel", "getex", "setnx", "setex", "psetex", "getset",
]);

const RETURNS_VALUE = new Set(["get", "hget", "getdel", "getex", "getset"]);

export function instrumentRedis<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof prop !== "string" || !TRACKED_COMMANDS.has(prop) || typeof value !== "function") {
        return value;
      }

      return function (...args: unknown[]) {
        const key = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
        const span = startSpan({
          kind: "cache.command",
          name: `redis ${prop}`,
          attributes: { "cache.system": "redis", "cache.operation": prop, "cache.key": key },
        });

        let result: unknown;
        try {
          result = (value as (...a: unknown[]) => unknown).apply(target, args);
        } catch (err) {
          span.setStatus("error", err);
          span.end();
          throw err;
        }

        if (result instanceof Promise) {
          return result.then(
            (v) => {
              if (RETURNS_VALUE.has(prop)) span.setAttribute("cache.hit", v !== null && v !== undefined);
              span.end();
              return v;
            },
            (err: unknown) => {
              span.setStatus("error", err);
              span.end();
              throw err;
            },
          );
        }

        span.end();
        return result;
      };
    },
  }) as T;
}
