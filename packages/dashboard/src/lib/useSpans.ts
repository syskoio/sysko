import { useEffect, useRef, useState } from "react";
import type { AlertFired, ConnState, MetricSample, Span, WsMessage } from "./types";

const MAX_METRICS = 720; // 1h at 5s interval
const MAX_ALERTS = 200;

export interface UseSpansResult {
  spans: Span[];
  rootSpans: Span[];
  state: ConnState;
  isNew: (id: string) => boolean;
  clear: () => void;
  paused: boolean;
  togglePause: () => void;
  getTrace: (traceId: string) => Span[];
  metrics: MetricSample[];
  alerts: AlertFired[];
}

export function useSpans(password: string | null = null): UseSpansResult {
  const [spans, setSpans] = useState<Span[]>([]);
  const [metrics, setMetrics] = useState<MetricSample[]>([]);
  const [alerts, setAlerts] = useState<AlertFired[]>([]);
  const [state, setState] = useState<ConnState>("connecting");
  const [paused, setPaused] = useState(false);
  const recentlyAdded = useRef<Set<string>>(new Set());
  const pausedRef = useRef(false);
  const bufferRef = useRef<Span[]>([]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused && bufferRef.current.length > 0) {
      const drained = bufferRef.current.splice(0);
      drained.forEach((s) => recentlyAdded.current.add(s.id));
      setSpans((prev) => [...drained.reverse(), ...prev]);
      setTimeout(() => {
        drained.forEach((s) => recentlyAdded.current.delete(s.id));
        setSpans((s) => [...s]);
      }, 1200);
    }
  }, [paused]);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss://" : "ws://";
    const qs = password !== null ? `?pw=${btoa(password)}` : "";
    const ws = new WebSocket(`${proto}${location.host}/_sysko/ws${qs}`);
    ws.addEventListener("open", () => setState("connected"));
    ws.addEventListener("close", () => setState("disconnected"));
    ws.addEventListener("message", (ev) => {
      const msg: WsMessage = JSON.parse(ev.data as string);
      if (msg.type === "history") {
        setSpans(msg.spans.slice().reverse());
      } else if (msg.type === "metrics-history") {
        setMetrics(msg.samples);
      } else if (msg.type === "metric") {
        setMetrics((prev) => [...prev.slice(-(MAX_METRICS - 1)), msg.sample]);
      } else if (msg.type === "alerts-history") {
        setAlerts(msg.alerts);
      } else if (msg.type === "alert") {
        setAlerts((prev) => [...prev.slice(-(MAX_ALERTS - 1)), msg.alert]);
      } else if (msg.type === "span") {
        if (pausedRef.current) {
          bufferRef.current.push(msg.span);
          return;
        }
        recentlyAdded.current.add(msg.span.id);
        setSpans((prev) => [msg.span, ...prev]);
        setTimeout(() => {
          recentlyAdded.current.delete(msg.span.id);
          setSpans((s) => [...s]);
        }, 1200);
      }
    });
    return () => ws.close();
  }, [password]);

  const rootSpans = spans.filter((s) => s.parentSpanId === undefined);

  return {
    spans,
    rootSpans,
    metrics,
    alerts,
    state,
    isNew: (id) => recentlyAdded.current.has(id),
    clear: () => setSpans([]),
    paused,
    togglePause: () => setPaused((p) => !p),
    getTrace: (traceId) => spans.filter((s) => s.traceId === traceId),
  };
}
