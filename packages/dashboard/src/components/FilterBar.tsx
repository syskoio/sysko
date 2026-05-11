import { Search, X } from "lucide-react";
import { forwardRef } from "react";
import type { Filters, StatusBucket, UseFiltersResult } from "../lib/useFilters";
import { methodPill } from "../lib/colors";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const STATUS_BUCKETS: { value: StatusBucket; label: string; cls: string }[] = [
  { value: "all", label: "all", cls: "text-zinc-400" },
  { value: "ok", label: "2xx/3xx", cls: "text-emerald-300" },
  { value: "4xx", label: "4xx", cls: "text-amber-300" },
  { value: "5xx", label: "5xx", cls: "text-red-300" },
  { value: "error", label: "errored", cls: "text-red-300" },
];

const DURATION_BUCKETS = [
  { value: 0, label: "any" },
  { value: 50, label: "≥50ms" },
  { value: 250, label: "≥250ms" },
  { value: 1000, label: "≥1s" },
];

export interface FilterBarProps {
  controls: UseFiltersResult;
  resultsCount: number;
  totalCount: number;
  services: string[];
}

function hasActiveFilters(f: Filters): boolean {
  return (
    f.search !== "" ||
    f.methods.size > 0 ||
    f.statusBucket !== "all" ||
    f.minDuration > 0 ||
    f.service !== null
  );
}

export const FilterBar = forwardRef<HTMLInputElement, FilterBarProps>(
  function FilterBar({ controls, resultsCount, totalCount, services }, ref): React.ReactElement {
    const { filters } = controls;
    const active = hasActiveFilters(filters);

    return (
      <div className="border-b border-zinc-900 bg-zinc-950 px-5 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-[220px] flex-1 max-w-md">
          <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <input
            ref={ref}
            value={filters.search}
            onChange={(e) => controls.setSearch(e.target.value)}
            placeholder="search path… (press / to focus)"
            className="bg-transparent outline-none text-[12.5px] text-zinc-100 placeholder:text-zinc-600 w-full font-mono"
          />
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        <div className="flex items-center gap-1">
          {METHODS.map((m) => {
            const on = filters.methods.has(m);
            const mp = methodPill(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => controls.toggleMethod(m)}
                className={
                  "px-1.5 py-0.5 rounded-md text-[10.5px] font-mono uppercase tracking-wide font-medium transition-colors " +
                  (on
                    ? `${mp.bg} ${mp.text} ring-1 ring-current/30`
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900")
                }
              >
                {m}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        <div className="flex items-center gap-1">
          {STATUS_BUCKETS.map((b) => {
            const on = filters.statusBucket === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => controls.setStatusBucket(b.value)}
                className={
                  "px-1.5 py-0.5 rounded-md text-[10.5px] font-mono uppercase tracking-wide font-medium transition-colors " +
                  (on
                    ? `bg-zinc-800 ${b.cls}`
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900")
                }
              >
                {b.label}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        <div className="flex items-center gap-1">
          {DURATION_BUCKETS.map((b) => {
            const on = filters.minDuration === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => controls.setMinDuration(b.value)}
                className={
                  "px-1.5 py-0.5 rounded-md text-[10.5px] font-mono uppercase tracking-wide font-medium transition-colors " +
                  (on
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900")
                }
              >
                {b.label}
              </button>
            );
          })}
        </div>

        {services.length > 1 && (
          <>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => controls.setService(null)}
                className={
                  "px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-medium transition-colors " +
                  (filters.service === null
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900")
                }
              >
                all
              </button>
              {services.map((svc) => (
                <button
                  key={svc}
                  type="button"
                  onClick={() => controls.setService(svc)}
                  className={
                    "px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-medium transition-colors " +
                    (filters.service === svc
                      ? "bg-zinc-800 text-lime-300"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900")
                  }
                >
                  {svc}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
            {active ? (
              <>
                <span className="text-lime-300">{resultsCount}</span>
                <span className="text-zinc-600"> / </span>
                {totalCount}
              </>
            ) : (
              <>{totalCount}</>
            )}
          </span>
          {active && (
            <button
              type="button"
              onClick={controls.reset}
              className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wide font-medium text-zinc-500 hover:text-lime-300 transition-colors"
              title="Clear filters"
            >
              <X className="h-3 w-3" />
              clear
            </button>
          )}
        </div>
      </div>
    );
  },
);
