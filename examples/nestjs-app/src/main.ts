import "reflect-metadata";
import { init } from "@syskoio/core";
import { instrumentExpress } from "@syskoio/plugins/express";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";

// init() must run before NestFactory.create() so HTTP monkeypatching is
// active before the underlying http.Server is created.
const sysko = await init({
  serviceName: "example-nestjs",
  redact: {
    queryParams: ["token", "apiKey"],
    paths: ["/healthz"],
  },
});

sysko.onSpan((span) => {
  span.attributes["service.name"] = "example-nestjs";
  return span;
});

const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });

// Extract http.route (/users/:id) via Express middleware on the underlying adapter.
instrumentExpress(app.getHttpAdapter().getInstance());

const port = 3006;
await app.listen(port);
console.log(`[example] nestjs listening on http://localhost:${port}`);
