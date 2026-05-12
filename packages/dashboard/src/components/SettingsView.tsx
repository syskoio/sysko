import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

export interface SettingsViewProps {
  onClear: () => void;
}

export function SettingsView({ onClear }: SettingsViewProps): React.ReactElement {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = (): void => {
    onClear();
    setConfirming(false);
  };

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
              onClick={() => { setConfirming(true); }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors shrink-0 ml-6"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>
      </section>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-red-500/10 shrink-0">
                <AlertTriangle className="h-4.5 w-4.5 text-red-400" />
              </div>
              <h2 className="text-[14px] font-semibold text-zinc-100">Clear all data?</h2>
            </div>
            <p className="text-[12.5px] text-zinc-400 mb-6 leading-relaxed">
              All captured spans, traces, and metrics will be permanently removed from memory. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setConfirming(false); }}
                className="px-3.5 py-1.5 rounded-md text-[12px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[12px] font-medium bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
