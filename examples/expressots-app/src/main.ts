import "reflect-metadata";
import { init } from "@sysko/core";
import { App } from "./app.js";
import { setSysko } from "./controllers/demo.controller.js";

// init() must run before the App constructor so that HTTP instrumentation is
// active before any server socket is created.
const sysko = await init({
  serviceName: "example-expressots",
  redact: {
    queryParams: ["token", "apiKey"],
    paths: ["/healthz", "/internal/*"],
  },
});

setSysko(sysko);

sysko.onSpan((span) => {
  span.attributes["service.name"] = "example-expressots";
  return span;
});

// AppFactory.create(App) is equivalent to new App() — using new directly avoids
// a cast from IWebServerBuilder back to AppExpress.
const app = new App();
const port = 3004;
await app.listen(port);
console.log(`[example] expressots listening on http://localhost:${port}`);
