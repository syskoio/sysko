import { Bell } from "lucide-react";
import type { AlertFired } from "../lib/types";

export interface AlertsTabProps {
  alerts: AlertFired[];
}

function fmtValue(type: AlertFired["type"], value: number): string {
  if (type === "errorRate") return `${(value * 100).toFixed(1)}%`;
  if (type === "p95") return `${value.toFixed(1)}ms`;
  return String(Math.round(value));
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function typeLabel(type: AlertFired["type"]): string {
  if (type === "errorRate") return "error rate";
  if (type === "p95") return "p95 latency";
  return "span count";
}

export function AlertsTab({ alerts }: AlertsTabProps): React.ReactElement {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
        <Bell className="h-8 w-8 opacity-30" />
        <p className="text-[13px]">no alerts fired</p>
        <p className="text-[11px] text-zinc-700 max-w-xs text-center">
          Configure thresholds in{" "}
          <span className="font-mono text-zinc-500">init({"{ alerts: [...] }"})</span>{" "}
          to get notified when rules breach.
        </p>
      </div>
    );
  }

  const sorted = [...alerts].sort((a, b) => b.ts - a.ts);

  return (
    <div className="overflow-auto h-full">
      <div className="px-5 py-3">
        <div className="text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-3">
          {alerts.length} {alerts.length === 1 ? "alert" : "alerts"} fired
        </div>
        <div className="space-y-2">
          {sorted.map((alert, i) => (
            <AlertRow key={i} alert={alert} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertFired }): React.ReactElement {
  const value = fmtValue(alert.type, alert.value);
  const threshold = fmtValue(alert.type, alert.threshold);

  return (
    <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-4">
      <div className="mt-0.5 shrink-0">
        <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-[13px] text-zinc-100 truncate">{alert.ruleName}</span>
          <span className="text-[10px] font-mono uppercase text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
            {typeLabel(alert.type)}
          </span>
        </div>
        <div className="text-[12px] text-zinc-400 font-mono">
          <span className="text-red-400 font-semibold">{value}</span>
          <span className="text-zinc-600"> exceeded threshold </span>
          <span className="text-zinc-300">{threshold}</span>
        </div>
      </div>
      <div className="text-[11px] font-mono text-zinc-500 shrink-0 tabular-nums">
        {fmtTime(alert.ts)}
      </div>
    </div>
  );
}
