import { Activity, Pause, Play, Trash2 } from "lucide-react";
import type { ConnState } from "../lib/types";

export interface HeaderProps {
  state: ConnState;
  paused: boolean;
  onTogglePause: () => void;
  onClear: () => void;
  spanCount: number;
}

export function Header({ state, paused, onTogglePause, onClear, spanCount }: HeaderProps): React.ReactElement {
  return (
    <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center justify-between px-5 h-12">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-lime-300/30 blur-md rounded-full" />
              <Activity className="relative h-4 w-4 text-lime-300" strokeWidth={2.5} />
            </div>
            <span className="text-[13px] font-semibold tracking-tight">sysko</span>
            <span className="text-[11px] text-zinc-500 font-mono">observe</span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <ConnIndicator state={state} />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500 font-mono mr-2 tabular-nums">
            {spanCount} {spanCount === 1 ? "span" : "spans"}
          </span>
          <IconButton onClick={onTogglePause} title={paused ? "Resume stream" : "Pause stream"} active={paused}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton onClick={onClear} title="Clear spans">
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
    </header>
  );
}

function ConnIndicator({ state }: { state: ConnState }): React.ReactElement {
  const cfg = {
    connecting: { dot: "bg-amber-400", label: "connecting", pulse: true },
    connected: { dot: "bg-lime-400", label: "live", pulse: false },
    disconnected: { dot: "bg-red-400", label: "offline", pulse: false },
  }[state];

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative inline-flex h-2 w-2">
        {state === "connected" && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-50 animate-ping" />
        )}
        <span
          className={
            "relative inline-flex h-2 w-2 rounded-full " +
            cfg.dot +
            (cfg.pulse ? " animate-pulse" : "")
          }
        />
      </span>
      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">{cfg.label}</span>
    </div>
  );
}

function IconButton({
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
        "inline-flex items-center justify-center h-7 w-7 rounded-md " +
        "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors " +
        (active ? "bg-lime-300/10 text-lime-300 hover:bg-lime-300/15 hover:text-lime-200" : "")
      }
    >
      {children}
    </button>
  );
}
