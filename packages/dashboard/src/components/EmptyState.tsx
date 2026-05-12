import { Activity } from "lucide-react";

export function EmptyState(): React.ReactElement {
  return (
    <div className="h-full flex items-center justify-center w-full">
      <div className="text-center max-w-sm px-6">
        <div className="relative inline-flex mb-5">
          <div className="absolute inset-0 bg-lime-300/20 blur-2xl rounded-full" />
          <div className="relative h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Activity className="h-5 w-5 text-lime-300" strokeWidth={2.5} />
          </div>
        </div>
        <h3 className="text-sm font-semibold text-zinc-100 mb-1.5">waiting for traffic</h3>
        <p className="text-[12.5px] text-zinc-500 leading-relaxed">
          Sysko is connected and listening. Hit any HTTP endpoint of your app and it appears here in real time.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-400">
          <span className="text-lime-300">$</span>
          <span>curl localhost:&lt;port&gt;/your-route</span>
        </div>
      </div>
    </div>
  );
}
