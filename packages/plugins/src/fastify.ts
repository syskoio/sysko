import { getActiveHandle, getCurrentContext } from "@syskoio/core";

interface FastifyRouteOptions {
  url?: string | undefined;
}

interface FastifyLikeRequest {
  routeOptions?: FastifyRouteOptions;
  routerPath?: string;
  method?: string;
}

interface FastifyLikeInstance {
  addHook(
    event: "onRequest",
    handler: (request: FastifyLikeRequest, reply: unknown) => Promise<void>,
  ): void;
}

function routeOf(req: FastifyLikeRequest): string | undefined {
  return req.routeOptions?.url ?? req.routerPath;
}

export function instrumentFastify(app: FastifyLikeInstance): void {
  app.addHook("onRequest", async (request) => {
    const route = routeOf(request);
    if (route) {
      const ctx = getCurrentContext();
      if (ctx?.sampled) {
        const handle = getActiveHandle(ctx.spanId);
        handle?.setAttribute("http.route", route);
        if (request.method) {
          handle?.setAttribute("http.target", `${request.method} ${route}`);
        }
      }
    }
  });
}
