import { ListTree, BarChart3, BarChartHorizontal } from "lucide-react";

export type TabKey = "spans" | "endpoints" | "distribution";

export interface TabsProps {
  value: TabKey;
  onChange: (k: TabKey) => void;
  endpointsCount: number;
}

export function Tabs({ value, onChange, endpointsCount }: TabsProps): React.ReactElement {
  return (
    <div className="border-b border-zinc-900 px-5 flex items-center gap-1 bg-zinc-950">
      <Tab active={value === "spans"} onClick={() => onChange("spans")}>
        <ListTree className="h-3.5 w-3.5" />
        spans
      </Tab>
      <Tab active={value === "endpoints"} onClick={() => onChange("endpoints")}>
        <BarChart3 className="h-3.5 w-3.5" />
        endpoints
        {endpointsCount > 0 && (
          <span className="ml-1 text-[10px] font-mono tabular-nums text-zinc-500">
            {endpointsCount}
          </span>
        )}
      </Tab>
      <Tab active={value === "distribution"} onClick={() => onChange("distribution")}>
        <BarChartHorizontal className="h-3.5 w-3.5" />
        distribution
      </Tab>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 px-3 h-9 text-[12px] font-medium border-b-2 -mb-px transition-colors " +
        (active
          ? "border-lime-300 text-zinc-100"
          : "border-transparent text-zinc-500 hover:text-zinc-300")
      }
    >
      {children}
    </button>
  );
}
