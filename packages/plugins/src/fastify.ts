import { getActiveHandle, getCurrentContext } from "@sysko/core";

interface FastifyRouteOptions {
  url?: string;
}

interface FastifyLikeRequest {
  routeOptions?: FastifyRouteOptions;
  routerPath?: string;
  method?: string;
}

interface FastifyLikeReply {
  prependOnceListener?(event: string, listener: () => void): void;
}

interface FastifyLikeInstance {
  addHook(
    event: "onRequest",
    handler: (request: FastifyLikeRequest, reply: FastifyLikeReply, done: () => void) => void,
  ): void;
}

function routeOf(req: FastifyLikeRequest): string | undefined {
  return req.routeOptions?.url ?? req.routerPath;
}

export function instrumentFastify(app: FastifyLikeInstance): void {
  app.addHook("onRequest", (request, _reply, done) => {
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
    done();
  });
}
