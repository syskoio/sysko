import { getCurrentContext, getActiveHandle } from "@syskoio/core";

interface ExpressLikeRequest {
  route?: { path?: string | RegExp };
  baseUrl?: string;
  method?: string;
}

interface ExpressLikeResponse {
  prependOnceListener?(event: string, listener: () => void): void;
  once(event: string, listener: () => void): void;
}

interface ExpressLikeApp {
  use(middleware: (req: ExpressLikeRequest, res: ExpressLikeResponse, next: () => void) => void): unknown;
}

function routeOf(req: ExpressLikeRequest): string | undefined {
  const raw = req.route?.path;
  if (raw === undefined) return undefined;
  const tail = raw instanceof RegExp ? raw.toString() : raw;
  const base = req.baseUrl ?? "";
  return `${base}${tail}`;
}

export function instrumentExpress(app: ExpressLikeApp): void {
  app.use((req, res, next) => {
    const recordRoute = (): void => {
      const route = routeOf(req);
      if (!route) return;
      const ctx = getCurrentContext();
      if (!ctx?.sampled) return;
      const handle = getActiveHandle(ctx.spanId);
      if (!handle) return;
      handle.setAttribute("http.route", route);
      if (req.method) {
        handle.setAttribute("http.target", `${req.method} ${route}`);
      }
    };

    if (typeof res.prependOnceListener === "function") {
      res.prependOnceListener("finish", recordRoute);
      res.prependOnceListener("close", recordRoute);
    } else {
      res.once("finish", recordRoute);
      res.once("close", recordRoute);
    }
    next();
  });
}
