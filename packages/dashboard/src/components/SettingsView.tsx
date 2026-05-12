import { Trash2 } from "lucide-react";

export interface SettingsViewProps {
  onClear: () => void;
}

export function SettingsView({ onClear }: SettingsViewProps): React.ReactElement {
  return (
    <div className="flex-1 min-w-0 overflow-auto px-8 py-8">
      <h1 className="text-[15px] font-semibold text-zinc-100 mb-6">Settings</h1>

      <section>
        <h2 className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-3">Data</h2>
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-zinc-900/30">
            <div>
              <p className="text-[13px] text-zinc-100 font-medium">Clear all data</p>
              <p className="text-[11.5px] text-zinc-500 mt-0.5">
                Remove all captured spans, traces, and metrics from memory.
              </p>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors shrink-0 ml-6"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
