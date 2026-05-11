import { useEffect, useRef, useState } from "react";
import type { ConnState, Span, WsMessage } from "./types";

export interface UseSpansResult {
  spans: Span[];
  rootSpans: Span[];
  state: ConnState;
  isNew: (id: string) => boolean;
  clear: () => void;
  paused: boolean;
  togglePause: () => void;
  getTrace: (traceId: string) => Span[];
}

export function useSpans(): UseSpansResult {
  const [spans, setSpans] = useState<Span[]>([]);
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
    const ws = new WebSocket(`${proto}${location.host}/_sysko/ws`);
    ws.addEventListener("open", () => setState("connected"));
    ws.addEventListener("close", () => setState("disconnected"));
    ws.addEventListener("message", (ev) => {
      const msg: WsMessage = JSON.parse(ev.data as string);
      if (msg.type === "history") {
        setSpans(msg.spans.slice().reverse());
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
  }, []);

  const rootSpans = spans.filter((s) => s.parentSpanId === undefined);

  return {
    spans,
    rootSpans,
    state,
    isNew: (id) => recentlyAdded.current.has(id),
    clear: () => setSpans([]),
    paused,
    togglePause: () => setPaused((p) => !p),
    getTrace: (traceId) => spans.filter((s) => s.traceId === traceId),
  };
}
