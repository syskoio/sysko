import { init } from "@syskoio/core";
import { instrumentExpress } from "@syskoio/plugins/express";
import express from "express";
import { defineRoutes } from "./routes.js";

const sysko = await init({
  serviceName: "example-express",
  // dashboard: {
  //   password: process.env["SYSKO_PASSWORD"] ?? "MYSECRET",
  // },
  redact: {
    queryParams: ["token", "apiKey"],
    paths: ["/healthz", "/internal/*"],
  },
  alerts: [
    {
      name: "high error rate",
      type: "errorRate",
      threshold: 0.3,   // fires when > 30% of http.server spans are errors
      window: 15,        // look at the last 15 seconds
      cooldown: 0,       // re-fire every check in demo mode
      webhook: process.env["SYSKO_WEBHOOK_URL"] ?? "http://localhost:9998/noop",
    },
  ],
  alertCheckInterval: 3_000, // check every 3s so tests don't wait 30s
});

sysko.onSpan((span) => {
  span.attributes["service.name"] = "example-express";
  return span;
});

const app = express();
instrumentExpress(app);
defineRoutes(app, sysko);

const port = 3000;
app.listen(port, () => {
  console.log(`[example] express listening on http://localhost:${port}`);
});
