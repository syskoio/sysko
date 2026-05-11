import { GitCompare, X } from "lucide-react";

export function CompareBanner({ onCancel }: { onCancel: () => void }): React.ReactElement {
  return (
    <div className="bg-lime-300/[0.07] border-b border-lime-300/30 px-5 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[12px] text-lime-200">
        <GitCompare className="h-3.5 w-3.5" />
        <span>click another trace in the list to compare with the selected one</span>
        <span className="text-zinc-500 text-[10.5px] font-mono">· press Esc to cancel</span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-zinc-400 hover:text-zinc-200 text-[10.5px] uppercase tracking-wide font-medium inline-flex items-center gap-1"
      >
        <X className="h-3 w-3" />
        cancel
      </button>
    </div>
  );
}
