import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type SidebarView } from "./components/Sidebar";
import { RoutesList } from "./components/RoutesList";
import { RouteDetail } from "./components/RouteDetail";
import { SettingsView } from "./components/SettingsView";
import { SpanList } from "./components/SpanList";
import { SpanDetail } from "./components/SpanDetail";
import { EmptyState } from "./components/EmptyState";
import { FilterBar } from "./components/FilterBar";
import { Histogram } from "./components/Histogram";
import { ShortcutsHint } from "./components/ShortcutsHint";
import { CompareBanner } from "./components/CompareBanner";
import { SystemTab } from "./components/SystemTab";
import { AlertsTab } from "./components/AlertsTab";
import { ErrorsTab } from "./components/ErrorsTab";
import { LoginScreen } from "./components/LoginScreen";
import { useSpans } from "./lib/useSpans";
import { useErrors } from "./lib/useErrors";
import { useFilters } from "./lib/useFilters";
import { useKeyboard } from "./lib/useKeyboard";
import { useHashRoute } from "./lib/useHashRoute";
import { useAuth } from "./lib/useAuth";

const PAGE_SIZE = 50;

export function App(): React.ReactElement {
  const auth = useAuth();
  const { spans, rootSpans, metrics, alerts, state, isNew, clear, paused, togglePause, getTrace } =
    useSpans(auth.password);
  const filters = useFilters();
  const [view, setView] = useState<SidebarView>("spans");
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [compareId, setCompareId] = useState<string | undefined>(undefined);
  const [pickingCompare, setPickingCompare] = useState(false);
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const { route, setRoute } = useHashRoute();
  const hydrated = useRef(false);

  const filteredRoots = useMemo(() => filters.apply(rootSpans), [filters, rootSpans]);
  const errorGroups = useErrors(spans);

  const { apply: applyFn } = filters;
  useEffect(() => { setPage(0); }, [applyFn]);

  const paginatedRoots = useMemo(
    () => filteredRoots.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRoots, page],
  );

  const selected = spans.find((s) => s.id === selectedId);
  const selectedTraceId = selected?.traceId;
  const compare = spans.find((s) => s.id === compareId);
  const trace = useMemo(() => (selected ? getTrace(selected.traceId) : []), [selected, getTrace]);
  const compareTrace = useMemo(
    () => (compare ? getTrace(compare.traceId) : []),
    [compare, getTrace],
  );

  const routeRoots = useMemo(() => {
    if (!selectedRouteKey) return [];
    return rootSpans.filter((s) => {
      const method = String(s.attributes["http.method"] ?? "");
      const path = String(s.attributes["http.route"] ?? s.attributes["http.path"] ?? s.name);
      return `${method} ${path}` === selectedRouteKey;
    });
  }, [rootSpans, selectedRouteKey]);

  const [routeMethod, ...routePathParts] = selectedRouteKey?.split(" ") ?? [];
  const routePath = routePathParts.join(" ");

  const endpointsCount = useMemo(() => {
    const set = new Set<string>();
    for (const s of rootSpans) {
      const method = String(s.attributes["http.method"] ?? "");
      const path = String(s.attributes["http.route"] ?? s.attributes["http.path"] ?? s.name);
      set.add(`${method} ${path}`);
    }
    return set.size;
  }, [rootSpans]);

  useEffect(() => {
    if (hydrated.current) return;
    if (route.traceId && rootSpans.length === 0) return;
    if (route.traceId) {
      const target = rootSpans.find((s) => s.traceId === route.traceId);
      if (target) { setSelectedId(target.id); setView("spans"); }
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
      setRoute({ traceId: selected.traceId, compareTraceId: compare?.traceId });
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
    if (next) { setSelectedId(next.id); setPage(Math.floor(nextIdx / PAGE_SIZE)); }
  }, [filteredRoots, selectedId]);

  const onPrev = useCallback(() => {
    if (filteredRoots.length === 0) return;
    const idx = filteredRoots.findIndex((s) => s.id === selectedId);
    const prevIdx = Math.max(0, idx - 1);
    const prev = filteredRoots[prevIdx] ?? filteredRoots[filteredRoots.length - 1];
    if (prev) { setSelectedId(prev.id); setPage(Math.floor(prevIdx / PAGE_SIZE)); }
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
      if (root) { setSelectedId(root.id); setView("spans"); }
    },
    [rootSpans],
  );

  const onEscape = useCallback(() => {
    if (pickingCompare) { setPickingCompare(false); return; }
    if (compareId) { setCompareId(undefined); return; }
    setSelectedId(undefined);
  }, [pickingCompare, compareId]);

  useKeyboard({
    onSearchFocus: () => { setView("spans"); searchRef.current?.focus(); },
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

  if (!auth.loading && auth.passwordRequired && auth.password === null) {
    return <LoginScreen error={auth.error} onLogin={auth.login} />;
  }

  const isSpansView = view === "spans";
  const showDetail = isSpansView && !!selected;
  const showCompare = isSpansView && !!selected && !!compare;
  const detailCols = showCompare ? "1fr 420px 420px" : showDetail ? "1fr 480px" : "1fr";

  return (
    <div className="h-screen flex bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar
        view={view}
        onViewChange={setView}
        state={state}
        paused={paused}
        onTogglePause={togglePause}
        onClear={onClear}
        alertCount={alerts.length}
        errorsCount={errorGroups.length}
        endpointsCount={endpointsCount}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {isSpansView && (
          <FilterBar
            ref={searchRef}
            controls={filters}
            resultsCount={filteredRoots.length}
            totalCount={rootSpans.length}
            services={services}
          />
        )}
        {isSpansView && pickingCompare && (
          <CompareBanner onCancel={() => setPickingCompare(false)} />
        )}

        <div className="flex-1 min-h-0 flex overflow-hidden">
          {view === "endpoints" ? (
            <>
              <RoutesList
                rootSpans={rootSpans}
                selectedKey={selectedRouteKey}
                onSelect={setSelectedRouteKey}
              />
              <div className="flex-1 min-w-0 overflow-hidden">
                {selectedRouteKey ? (
                  <RouteDetail
                    method={routeMethod ?? ""}
                    path={routePath}
                    routeRoots={routeRoots}
                    allSpans={spans}
                    getTrace={getTrace}
                  />
                ) : (
                  <EmptyState />
                )}
              </div>
            </>
          ) : view === "errors" ? (
            <div className="flex-1 min-w-0 overflow-hidden">
              <ErrorsTab spans={spans} onSelectTrace={onSelectTrace} />
            </div>
          ) : view === "alerts" ? (
            <div className="flex-1 min-w-0 overflow-hidden">
              <AlertsTab alerts={alerts} />
            </div>
          ) : view === "system" ? (
            <div className="flex-1 min-w-0 overflow-hidden">
              <SystemTab samples={metrics} />
            </div>
          ) : view === "distribution" ? (
            <div className="flex-1 min-w-0 overflow-hidden">
              <Histogram spans={spans} />
            </div>
          ) : view === "settings" ? (
            <SettingsView onClear={onClear} />
          ) : rootSpans.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex-1 min-h-0 grid min-w-0" style={{ gridTemplateColumns: detailCols }}>
              <div className="min-h-0 overflow-hidden">
                <SpanList
                  rootSpans={paginatedRoots}
                  allSpans={spans}
                  selectedId={selectedId}
                  selectedTraceId={selectedTraceId}
                  onSelect={onSelectRow}
                  onSelectSpan={setSelectedId}
                  isNew={isNew}
                  page={page}
                  pageSize={PAGE_SIZE}
                  totalCount={filteredRoots.length}
                  onPageChange={setPage}
                />
              </div>
              {showDetail && selected && (
                <SpanDetail
                  span={selected}
                  trace={trace}
                  onClose={() => { setSelectedId(undefined); setCompareId(undefined); }}
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
            </div>
          )}
        </div>

        <ShortcutsHint />
      </div>
    </div>
  );
}
