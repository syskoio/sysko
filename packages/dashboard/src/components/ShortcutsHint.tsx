import { Keyboard, X } from "lucide-react";
import { useState } from "react";

const SHORTCUTS = [
  { keys: ["/"], label: "focus search" },
  { keys: ["j", "↓"], label: "next span" },
  { keys: ["k", "↑"], label: "prev span" },
  { keys: ["Esc"], label: "close panel" },
  { keys: ["Space"], label: "toggle pause" },
  { keys: ["c"], label: "clear" },
];

export function ShortcutsHint(): React.ReactElement {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/80 border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors backdrop-blur text-[10.5px] font-medium uppercase tracking-wider"
        title="Keyboard shortcuts"
      >
        <Keyboard className="h-3 w-3" />
        shortcuts
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-3 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] uppercase tracking-wider font-medium text-zinc-500">shortcuts</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-zinc-500 hover:text-zinc-200"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-1.5">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-3 text-[11.5px]">
            <span className="text-zinc-400">{s.label}</span>
            <div className="flex items-center gap-1">
              {s.keys.map((k, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-zinc-600 mx-1">or</span>}
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[10.5px]">
                    {k}
                  </kbd>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
