import "reflect-metadata";
import type { NextFunction, Request, Response } from "express";
import { getCurrentContext, getActiveHandle } from "@sysko/core";
import { AppExpress } from "@expressots/adapter-express";
import { ContainerModule } from "@expressots/core";
import { UserController } from "./controllers/users.controller.js";
import { DemoController } from "./controllers/demo.controller.js";

export class App extends AppExpress {
  protected override async globalConfiguration(): Promise<void> {
    // Registers controllers with the inversify container used by InversifyExpressServer.
    this.configContainer([
      new ContainerModule((bind) => {
        bind(UserController).toSelf();
        bind(DemoController).toSelf();
      }),
    ]);
  }

  protected override async configureServices(): Promise<void> {
    this.Middleware.addBodyParser();
    // Captures the matched route template (e.g. /users/:id) and writes it to the
    // active span as http.route. Equivalent to instrumentExpress() but registered
    // through the ExpressoTS middleware pipeline instead of app.use().
    this.Middleware.addMiddleware(syskoRouteMiddleware);
    this.Middleware.setErrorHandler();
  }

  protected override async postServerInitialization(): Promise<void> {}
  protected override async serverShutdown(): Promise<void> {}
}

function syskoRouteMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.prependOnceListener("finish", () => {
    const path = req.route?.path;
    if (!path || typeof path !== "string") return;
    const ctx = getCurrentContext();
    if (!ctx?.sampled) return;
    const handle = getActiveHandle(ctx.spanId);
    if (!handle) return;
    const route = `${req.baseUrl ?? ""}${path}`;
    handle.setAttribute("http.route", route);
    handle.setAttribute("http.target", `${req.method} ${route}`);
  });
  next();
}
