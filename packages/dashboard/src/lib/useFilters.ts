import { useMemo, useState } from "react";
import type { Span } from "./types";

export type StatusBucket = "all" | "ok" | "4xx" | "5xx" | "error";

export interface Filters {
  search: string;
  methods: Set<string>;
  statusBucket: StatusBucket;
  minDuration: number;
}

export const INITIAL_FILTERS: Filters = {
  search: "",
  methods: new Set(),
  statusBucket: "all",
  minDuration: 0,
};

export function isEmpty(f: Filters): boolean {
  return (
    f.search === "" &&
    f.methods.size === 0 &&
    f.statusBucket === "all" &&
    f.minDuration === 0
  );
}

function pathOf(span: Span): string {
  return String(
    span.attributes["http.route"] ?? span.attributes["http.path"] ?? span.name,
  );
}

export function applyFilters(spans: Span[], f: Filters): Span[] {
  if (isEmpty(f)) return spans;
  const search = f.search.trim().toLowerCase();
  return spans.filter((s) => {
    if (f.methods.size > 0) {
      const method = String(s.attributes["http.method"] ?? "");
      if (!f.methods.has(method)) return false;
    }
    const code = Number(s.attributes["http.status_code"] ?? 0);
    if (f.statusBucket === "ok" && !(code >= 200 && code < 400)) return false;
    if (f.statusBucket === "4xx" && !(code >= 400 && code < 500)) return false;
    if (f.statusBucket === "5xx" && !(code >= 500)) return false;
    if (f.statusBucket === "error" && s.status !== "error") return false;
    if (f.minDuration > 0 && s.duration < f.minDuration) return false;
    if (search.length > 0) {
      const path = pathOf(s).toLowerCase();
      if (!path.includes(search)) return false;
    }
    return true;
  });
}

export interface UseFiltersResult {
  filters: Filters;
  setSearch(v: string): void;
  toggleMethod(m: string): void;
  setStatusBucket(b: StatusBucket): void;
  setMinDuration(v: number): void;
  reset(): void;
  apply(spans: Span[]): Span[];
}

export function useFilters(): UseFiltersResult {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const apply = useMemo(() => {
    return (spans: Span[]): Span[] => applyFilters(spans, filters);
  }, [filters]);

  return {
    filters,
    setSearch: (v) => setFilters((f) => ({ ...f, search: v })),
    toggleMethod: (m) =>
      setFilters((f) => {
        const next = new Set(f.methods);
        if (next.has(m)) next.delete(m);
        else next.add(m);
        return { ...f, methods: next };
      }),
    setStatusBucket: (b) => setFilters((f) => ({ ...f, statusBucket: b })),
    setMinDuration: (v) => setFilters((f) => ({ ...f, minDuration: v })),
    reset: () => setFilters(INITIAL_FILTERS),
    apply,
  };
}
