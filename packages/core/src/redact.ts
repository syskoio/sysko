import type { Span } from "@sysko/storage";

export interface RedactOptions {
  paths?: (string | RegExp)[];
  queryParams?: string[];
}

const REDACTED = "***";

function pathMatches(target: string, pattern: string | RegExp): boolean {
  if (pattern instanceof RegExp) return pattern.test(target);
  if (pattern.includes("*")) {
    const regex = new RegExp(
      "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
    );
    return regex.test(target);
  }
  return target === pattern;
}

function maskQueryString(url: string, params: string[]): string {
  const qIdx = url.indexOf("?");
  if (qIdx === -1) return url;
  const base = url.slice(0, qIdx);
  const query = url.slice(qIdx + 1);
  const parts = query.split("&").map((kv) => {
    const eq = kv.indexOf("=");
    const key = eq === -1 ? kv : kv.slice(0, eq);
    const decoded = decodeURIComponent(key);
    if (params.includes(decoded)) {
      return `${key}=${REDACTED}`;
    }
    return kv;
  });
  return `${base}?${parts.join("&")}`;
}

export function buildRedactHook(opts: RedactOptions): (span: Span) => Span | null {
  const paths = opts.paths ?? [];
  const queryParams = opts.queryParams ?? [];

  return (span) => {
    const path = String(span.attributes["http.path"] ?? "");
    for (const p of paths) {
      if (pathMatches(path, p)) return null;
    }

    if (queryParams.length === 0) return span;

    const url = span.attributes["http.url"];
    if (typeof url !== "string") return span;
    const masked = maskQueryString(url, queryParams);
    if (masked === url) return span;
    return {
      ...span,
      attributes: { ...span.attributes, "http.url": masked },
    };
  };
}
