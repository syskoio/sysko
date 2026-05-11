#!/usr/bin/env node
import { parseArgs } from "node:util";
import { startCollector } from "./index.js";

const { values } = parseArgs({
  options: {
    port:           { type: "string",  short: "p", default: "9999"     },
    host:           { type: "string",              default: "0.0.0.0"  },
    "storage-path": { type: "string"                                    },
    password:       { type: "string"                                    },
  },
  allowPositionals: false,
});

const port = parseInt(values.port ?? "9999", 10);

const opts: Parameters<typeof startCollector>[0] = { port, host: values.host };
if (values["storage-path"] !== undefined) opts.storagePath = values["storage-path"];
if (values.password !== undefined)        opts.password    = values.password;

const { url } = await startCollector(opts);

console.log(`[sysko-collector] dashboard  → ${url}`);
console.log(`[sysko-collector] ingest     → ${url}/v1/spans`);
console.log(`[sysko-collector] ready — waiting for spans`);

process.once("SIGTERM", () => process.exit(0));
process.once("SIGINT",  () => process.exit(0));
