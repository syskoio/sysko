import { useEffect, useState } from "react";

export interface HashRoute {
  traceId: string | undefined;
  compareTraceId: string | undefined;
}

function parse(hash: string): HashRoute {
  const m = hash.replace(/^#\/?/, "");
  const segments = m.split("/").filter(Boolean);
  const route: HashRoute = { traceId: undefined, compareTraceId: undefined };
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] === "trace" && segments[i + 1]) {
      route.traceId = segments[i + 1];
      i++;
    } else if (segments[i] === "vs" && segments[i + 1]) {
      route.compareTraceId = segments[i + 1];
      i++;
    }
  }
  return route;
}

function stringify(route: HashRoute): string {
  if (!route.traceId) return "";
  let h = `#/trace/${route.traceId}`;
  if (route.compareTraceId) h += `/vs/${route.compareTraceId}`;
  return h;
}

export function useHashRoute(): {
  route: HashRoute;
  setRoute(next: HashRoute): void;
} {
  const [route, setRouteState] = useState<HashRoute>(() => parse(location.hash));

  useEffect(() => {
    const onHashChange = (): void => {
      setRouteState(parse(location.hash));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setRoute = (next: HashRoute): void => {
    const target = stringify(next);
    if (target !== location.hash) {
      if (target === "") {
        history.replaceState(null, "", location.pathname + location.search);
      } else {
        location.hash = target;
      }
    }
    setRouteState(next);
  };

  return { route, setRoute };
}
