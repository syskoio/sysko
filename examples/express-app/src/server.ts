import { init } from "@sysko/core";
import { instrumentExpress } from "@sysko/plugins/express";
import express from "express";
import { defineRoutes } from "./routes.js";

const sysko = await init({
  serviceName: "example-express",
  redact: {
    queryParams: ["token", "apiKey"],
    paths: ["/healthz", "/internal/*"],
  },
});

sysko.onSpan((span) => {
  span.attributes["service.name"] = "example-express";
  return span;
});

const app = express();
instrumentExpress(app);
defineRoutes(app);

const port = 3000;
app.listen(port, () => {
  console.log(`[example] express listening on http://localhost:${port}`);
});
