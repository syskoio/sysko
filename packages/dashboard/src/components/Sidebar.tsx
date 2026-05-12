import { Activity, Pause, Play, Trash2, BarChart3, ListTree, BarChartHorizontal, Cpu, Bell, AlertTriangle, Settings } from "lucide-react";
import type { ConnState } from "../lib/types";

export type SidebarView = "endpoints" | "spans" | "distribution" | "system" | "alerts" | "errors" | "settings";

export interface SidebarProps {
  view: SidebarView;
  onViewChange: (v: SidebarView) => void;
  state: ConnState;
  paused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
  alertCount: number;
  errorsCount: number;
  endpointsCount: number;
}

export function Sidebar({
  view,
  onViewChange,
  state,
  paused,
  onTogglePause,
  onClear,
  alertCount,
  errorsCount,
  endpointsCount,
}: SidebarProps): React.ReactElement {
  return (
    <aside className="w-48 shrink-0 flex flex-col border-r border-zinc-900 bg-zinc-950 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-900 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div className="absolute inset-0 bg-lime-300/30 blur-md rounded-full" />
              <Activity className="relative h-3.5 w-3.5 text-lime-300" strokeWidth={2.5} />
            </div>
            <span className="text-[13px] font-semibold tracking-tight">sysko</span>
          </div>
          <div className="flex items-center gap-0.5">
            <IconBtn onClick={onTogglePause} title={paused ? "Resume" : "Pause"} active={paused}>
              {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </IconBtn>
            <IconBtn onClick={onClear} title="Clear">
              <Trash2 className="h-3 w-3" />
            </IconBtn>
          </div>
        </div>
        <ConnDot state={state} />
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <NavBtn
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          label="Endpoints"
          active={view === "endpoints"}
          {...(endpointsCount > 0 ? { badge: endpointsCount } : {})}
          onClick={() => onViewChange("endpoints")}
        />
        <NavBtn
          icon={<ListTree className="h-3.5 w-3.5" />}
          label="Spans"
          active={view === "spans"}
          onClick={() => onViewChange("spans")}
        />
        <NavBtn
          icon={<BarChartHorizontal className="h-3.5 w-3.5" />}
          label="Distribution"
          active={view === "distribution"}
          onClick={() => onViewChange("distribution")}
        />
        <NavBtn
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="System"
          active={view === "system"}
          onClick={() => onViewChange("system")}
        />
        <NavBtn
          icon={<Bell className="h-3.5 w-3.5" />}
          label="Alerts"
          active={view === "alerts"}
          {...(alertCount > 0 ? { badge: alertCount, badgeCls: "text-red-400 bg-red-500/15" } : {})}
          onClick={() => onViewChange("alerts")}
        />
        <NavBtn
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Errors"
          active={view === "errors"}
          {...(errorsCount > 0 ? { badge: errorsCount, badgeCls: "text-orange-400 bg-orange-500/15" } : {})}
          onClick={() => onViewChange("errors")}
        />
      </nav>

      <div className="border-t border-zinc-900 px-3 py-2 shrink-0">
        <NavBtn
          icon={<Settings className="h-3.5 w-3.5" />}
          label="Settings"
          active={view === "settings"}
          onClick={() => onViewChange("settings")}
        />
      </div>
    </aside>
  );
}

function ConnDot({ state }: { state: ConnState }): React.ReactElement {
  const label = state === "connected" ? "live" : state === "connecting" ? "connecting" : "offline";
  const dot =
    state === "connected" ? "bg-lime-400" :
    state === "connecting" ? "bg-amber-400" :
    "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative inline-flex h-1.5 w-1.5">
        {state === "connected" && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-50 animate-ping" />
        )}
        <span className={"relative inline-flex h-1.5 w-1.5 rounded-full " + dot} />
      </span>
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "inline-flex items-center justify-center h-6 w-6 rounded transition-colors " +
        (active
          ? "bg-lime-300/10 text-lime-300 hover:bg-lime-300/15"
          : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800")
      }
    >
      {children}
    </button>
  );
}

function NavBtn({
  icon,
  label,
  active,
  badge,
  badgeCls = "text-zinc-400 bg-zinc-800",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  badgeCls?: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-[12.5px] transition-colors " +
        (active ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60")
      }
    >
      <span className="flex items-center gap-2">{icon}{label}</span>
      {badge !== undefined && (
        <span className={"text-[10px] font-mono px-1.5 py-px rounded-full " + badgeCls}>
          {badge}
        </span>
      )}
    </button>
  );
}
