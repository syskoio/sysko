import { init } from "@sysko/core";
import { instrumentFastify } from "@sysko/plugins/fastify";
import Fastify from "fastify";
import { defineRoutes } from "./routes.js";

const sysko = await init({
  serviceName: "example-fastify",
  redact: {
    queryParams: ["token", "apiKey"],
    paths: ["/healthz", "/internal/*"],
  },
});

sysko.onSpan((span) => {
  span.attributes["service.name"] = "example-fastify";
  return span;
});

const app = Fastify({ logger: false });
instrumentFastify(app);
defineRoutes(app);

const port = 3002;
await app.listen({ port, host: "0.0.0.0" });
console.log(`[example] fastify listening on http://localhost:${port}`);
