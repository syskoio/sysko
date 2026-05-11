import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// hydrated ref: tracks whether we already initialized state from URL hash
import { Header } from "./components/Header";
import { Stats } from "./components/Stats";
import { SpanList } from "./components/SpanList";
import { SpanDetail } from "./components/SpanDetail";
import { EmptyState } from "./components/EmptyState";
import { FilterBar } from "./components/FilterBar";
import { Tabs, type TabKey } from "./components/Tabs";
import { EndpointStats } from "./components/EndpointStats";
import { Histogram } from "./components/Histogram";
import { ShortcutsHint } from "./components/ShortcutsHint";
import { CompareBanner } from "./components/CompareBanner";
import { SystemTab } from "./components/SystemTab";
import { AlertsTab } from "./components/AlertsTab";
import { ErrorsTab } from "./components/ErrorsTab";
import { useSpans } from "./lib/useSpans";
import { useErrors } from "./lib/useErrors";
import { useFilters } from "./lib/useFilters";
import { useKeyboard } from "./lib/useKeyboard";
import { useHashRoute } from "./lib/useHashRoute";

const PAGE_SIZE = 50;

export function App(): React.ReactElement {
  const { spans, rootSpans, metrics, alerts, state, isNew, clear, paused, togglePause, getTrace } = useSpans();
  const filters = useFilters();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [compareId, setCompareId] = useState<string | undefined>(undefined);
  const [pickingCompare, setPickingCompare] = useState(false);
  const [tab, setTab] = useState<TabKey>("spans");
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const { route, setRoute } = useHashRoute();
  const hydrated = useRef(false);

  const filteredRoots = useMemo(() => filters.apply(rootSpans), [filters, rootSpans]);
  const errorGroups = useErrors(spans);

  // Reset to first page whenever the active filter changes (not on new spans arriving).
  const { apply: applyFn } = filters;
  useEffect(() => { setPage(0); }, [applyFn]);

  const paginatedRoots = useMemo(
    () => filteredRoots.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRoots, page],
  );

  const selected = spans.find((s) => s.id === selectedId);
  const compare = spans.find((s) => s.id === compareId);
  const trace = useMemo(() => (selected ? getTrace(selected.traceId) : []), [selected, getTrace]);
  const compareTrace = useMemo(() => (compare ? getTrace(compare.traceId) : []), [compare, getTrace]);

  useEffect(() => {
    if (hydrated.current) return;
    if (route.traceId && rootSpans.length === 0) return;

    if (route.traceId) {
      const target = rootSpans.find((s) => s.traceId === route.traceId);
      if (target) setSelectedId(target.id);
    }
    if (route.compareTraceId) {
      const target = rootSpans.find((s) => s.traceId === route.compareTraceId);
      if (target) setCompareId(target.id);
    }
    hydrated.current = true;
  }, [route, rootSpans]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (selected) {
      setRoute({
        traceId: selected.traceId,
        compareTraceId: compare?.traceId,
      });
    } else {
      setRoute({ traceId: undefined, compareTraceId: undefined });
    }
  }, [selected, compare]);

  const onSelectRow = useCallback(
    (id: string) => {
      if (pickingCompare && id !== selectedId) {
        setCompareId(id);
        setPickingCompare(false);
        return;
      }
      setSelectedId(id === selectedId ? undefined : id);
    },
    [pickingCompare, selectedId],
  );

  const onNext = useCallback(() => {
    if (filteredRoots.length === 0) return;
    const idx = filteredRoots.findIndex((s) => s.id === selectedId);
    const nextIdx = Math.min(filteredRoots.length - 1, idx + 1);
    const next = filteredRoots[nextIdx] ?? filteredRoots[0];
    if (next) {
      setSelectedId(next.id);
      setPage(Math.floor(nextIdx / PAGE_SIZE));
    }
  }, [filteredRoots, selectedId]);

  const onPrev = useCallback(() => {
    if (filteredRoots.length === 0) return;
    const idx = filteredRoots.findIndex((s) => s.id === selectedId);
    const prevIdx = Math.max(0, idx - 1);
    const prev = filteredRoots[prevIdx] ?? filteredRoots[filteredRoots.length - 1];
    if (prev) {
      setSelectedId(prev.id);
      setPage(Math.floor(prevIdx / PAGE_SIZE));
    }
  }, [filteredRoots, selectedId]);

  const onClear = useCallback(() => {
    clear();
    setSelectedId(undefined);
    setCompareId(undefined);
    setPickingCompare(false);
  }, [clear]);

  const onSelectTrace = useCallback(
    (traceId: string) => {
      const root = rootSpans.find((s) => s.traceId === traceId);
      if (root) {
        setSelectedId(root.id);
        setTab("spans");
      }
    },
    [rootSpans],
  );

  const onEscape = useCallback(() => {
    if (pickingCompare) {
      setPickingCompare(false);
      return;
    }
    if (compareId) {
      setCompareId(undefined);
      return;
    }
    setSelectedId(undefined);
  }, [pickingCompare, compareId]);

  useKeyboard({
    onSearchFocus: () => {
      setTab("spans");
      searchRef.current?.focus();
    },
    onEscape,
    onNext,
    onPrev,
    onClear,
    onTogglePause: togglePause,
  });

  const services = useMemo(() => {
    const set = new Set<string>();
    for (const s of spans) {
      const svc = s.attributes["service.name"];
      if (svc) set.add(String(svc));
    }
    return [...set].sort();
  }, [spans]);

  const endpointsCount = useMemo(() => {
    const set = new Set<string>();
    for (const s of rootSpans) {
      const method = String(s.attributes["http.method"] ?? "");
      const path = String(
        s.attributes["http.route"] ?? s.attributes["http.path"] ?? s.name,
      );
      set.add(`${method} ${path}`);
    }
    return set.size;
  }, [rootSpans]);

  const showDetail = tab === "spans" && !!selected;
  const showCompare = tab === "spans" && !!selected && !!compare;
  const detailCols = showCompare ? "1fr 420px 420px" : showDetail ? "1fr 480px" : "1fr";

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Header
        state={state}
        paused={paused}
        onTogglePause={togglePause}
        onClear={onClear}
        spanCount={spans.length}
        alertCount={alerts.length}
      />
      <Stats spans={spans} />
      <Tabs value={tab} onChange={setTab} endpointsCount={endpointsCount} alertsCount={alerts.length} errorsCount={errorGroups.length} />

      {tab === "spans" && (
        <FilterBar
          ref={searchRef}
          controls={filters}
          resultsCount={filteredRoots.length}
          totalCount={rootSpans.length}
          services={services}
        />
      )}

      {pickingCompare && (
        <CompareBanner onCancel={() => setPickingCompare(false)} />
      )}

      <main className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: detailCols }}>
        <div className="min-h-0 overflow-hidden">
          {tab === "errors" ? (
            <ErrorsTab spans={spans} onSelectTrace={onSelectTrace} />
          ) : tab === "alerts" ? (
            <AlertsTab alerts={alerts} />
          ) : tab === "system" ? (
            <SystemTab samples={metrics} />
          ) : tab === "endpoints" ? (
            <EndpointStats spans={rootSpans} />
          ) : tab === "distribution" ? (
            <Histogram spans={spans} />
          ) : rootSpans.length === 0 ? (
            <EmptyState />
          ) : (
            <SpanList
              rootSpans={paginatedRoots}
              allSpans={spans}
              selectedId={selectedId}
              onSelect={onSelectRow}
              isNew={isNew}
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={filteredRoots.length}
              onPageChange={setPage}
            />
          )}
        </div>

        {showDetail && selected && (
          <SpanDetail
            span={selected}
            trace={trace}
            onClose={() => {
              setSelectedId(undefined);
              setCompareId(undefined);
            }}
            onSelectSpan={setSelectedId}
            onCompare={() => setPickingCompare(true)}
            isCompare={false}
          />
        )}

        {showCompare && compare && (
          <SpanDetail
            span={compare}
            trace={compareTrace}
            onClose={() => setCompareId(undefined)}
            onSelectSpan={setCompareId}
            isCompare={true}
          />
        )}
      </main>

      <ShortcutsHint />
    </div>
  );
}
