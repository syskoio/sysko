export function methodPill(method: string | undefined): { bg: string; text: string } {
  switch (method) {
    case "GET":    return { bg: "bg-sky-500/10",     text: "text-sky-300" };
    case "POST":   return { bg: "bg-emerald-500/10", text: "text-emerald-300" };
    case "PUT":    return { bg: "bg-amber-500/10",   text: "text-amber-300" };
    case "PATCH":  return { bg: "bg-amber-500/10",   text: "text-amber-300" };
    case "DELETE": return { bg: "bg-red-500/10",     text: "text-red-300" };
    default:       return { bg: "bg-zinc-500/10",    text: "text-zinc-300" };
  }
}

export function statusColor(code: number | undefined, isError = false): string {
  if (isError) return "text-red-400";
  if (code === undefined) return "text-zinc-500";
  if (code >= 500) return "text-red-400";
  if (code >= 400) return "text-amber-400";
  if (code >= 300) return "text-violet-400";
  if (code >= 200) return "text-emerald-400";
  return "text-zinc-400";
}

export function statusBar(code: number | undefined): string {
  if (code === undefined) return "bg-zinc-700";
  if (code >= 500) return "bg-red-500";
  if (code >= 400) return "bg-amber-500";
  if (code >= 300) return "bg-violet-500";
  if (code >= 200) return "bg-emerald-500";
  return "bg-zinc-500";
}

export function durationBar(ms: number, max: number): { width: string; color: string } {
  const pct = max > 0 ? Math.min(100, (ms / max) * 100) : 0;
  let color = "bg-emerald-500/60";
  if (ms > 1000) color = "bg-red-500/60";
  else if (ms > 250) color = "bg-amber-500/60";
  else if (ms > 50) color = "bg-sky-500/60";
  return { width: `${pct}%`, color };
}
