import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { MetricSample } from "../lib/types";

interface Props {
  samples: MetricSample[];
}

type WindowSize = 60 | 360 | 720;

const WINDOWS: { label: string; value: WindowSize }[] = [
  { label: "5m", value: 60 },
  { label: "30m", value: 360 },
  { label: "1h", value: 720 },
];

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

function fmtAge(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m`;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface ChartTooltipProps extends TooltipProps<number, string> {
  unit: string;
  formatValue: (v: number) => string;
}

function ChartTooltip({ active, payload, unit, formatValue }: ChartTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const val = entry?.value;
  const ts = (entry?.payload as { ts: number } | undefined)?.ts;

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 shadow-lg text-xs">
      {ts !== undefined && (
        <p className="text-zinc-400 mb-1">{fmtTime(ts)}</p>
      )}
      <p className="font-mono font-semibold text-zinc-100">
        {val !== undefined ? formatValue(val) : "—"}
        <span className="ml-1 text-zinc-400 font-normal">{unit}</span>
      </p>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  current: string;
  sub?: string;
  data: Array<{ ts: number; value: number }>;
  color: string;
  gradientId: string;
  unit: string;
  formatValue: (v: number) => string;
  formatYAxis: (v: number) => string;
  warn?: boolean;
  windowSize: WindowSize;
}

function MetricCard({
  title,
  current,
  sub,
  data,
  color,
  gradientId,
  unit,
  formatValue,
  formatYAxis,
  warn,
  windowSize,
}: MetricCardProps): React.ReactElement {
  // show ~6 x-axis ticks regardless of window
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{title}</span>
        {warn && <span className="text-[10px] text-amber-400 font-medium">high</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-mono tabular-nums font-semibold ${warn ? "text-amber-300" : "text-zinc-100"}`}>
          {current}
        </span>
        {sub && <span className="text-[11px] text-zinc-500">{sub}</span>}
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />

          <XAxis
            dataKey="ts"
            tickFormatter={fmtAge}
            tick={{ fontSize: 9, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
          />

          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 9, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
            width={42}
          />

          <Tooltip
            content={<ChartTooltip unit={unit} formatValue={formatValue} />}
            cursor={{ stroke: "#52525b", strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-zinc-600 text-right -mt-1">
        {windowSize === 60 ? "last 5 min" : windowSize === 360 ? "last 30 min" : "last 1 hour"} · 5s interval
      </p>
    </div>
  );
}

export function SystemTab({ samples }: Props): React.ReactElement {
  const [windowSize, setWindowSize] = useState<WindowSize>(60);

  if (samples.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
        collecting metrics…
      </div>
    );
  }

  const slice = samples.slice(-windowSize);
  const latest = slice[slice.length - 1];

  const eldData = slice.map((s) => ({ ts: s.ts, value: s.eventLoopLag }));
  const cpuData = slice.map((s) => ({ ts: s.ts, value: s.cpuPercent }));
  const heapData = slice.map((s) => ({ ts: s.ts, value: s.heapUsed / (1024 * 1024) }));
  const gcData = slice.map((s) => ({ ts: s.ts, value: s.gcDuration }));

  const eldWarn = (latest?.eventLoopLag ?? 0) > 50;
  const cpuWarn = (latest?.cpuPercent ?? 0) > 80;

  return (
    <div className="flex-1 flex flex-col gap-0 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900">
        <span className="text-[11px] text-zinc-500">
          {slice.length} samples
        </span>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => { setWindowSize(w.value); }}
              className={
                "px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors " +
                (windowSize === w.value
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300")
              }
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-5">
        <MetricCard
          title="Event Loop Lag"
          current={(latest?.eventLoopLag ?? 0).toFixed(2)}
          sub="ms"
          data={eldData}
          color="#a3e635"
          gradientId="grad-eld"
          unit="ms"
          formatValue={(v) => v.toFixed(2)}
          formatYAxis={(v) => `${v.toFixed(0)}`}
          warn={eldWarn}
          windowSize={windowSize}
        />
        <MetricCard
          title="CPU Usage"
          current={(latest?.cpuPercent ?? 0).toFixed(1)}
          sub="%"
          data={cpuData}
          color="#60a5fa"
          gradientId="grad-cpu"
          unit="%"
          formatValue={(v) => v.toFixed(1)}
          formatYAxis={(v) => `${v.toFixed(0)}%`}
          warn={cpuWarn}
          windowSize={windowSize}
        />
        <MetricCard
          title="Heap Used"
          current={fmtBytes(latest?.heapUsed ?? 0)}
          sub={`/ ${fmtBytes(latest?.heapTotal ?? 0)}`}
          data={heapData}
          color="#f472b6"
          gradientId="grad-heap"
          unit="MB"
          formatValue={(v) => v.toFixed(1)}
          formatYAxis={(v) => `${v.toFixed(0)}`}
          windowSize={windowSize}
        />
        <MetricCard
          title="GC Pause"
          current={(latest?.gcDuration ?? 0).toFixed(1)}
          sub="ms / interval"
          data={gcData}
          color="#fb923c"
          gradientId="grad-gc"
          unit="ms"
          formatValue={(v) => v.toFixed(1)}
          formatYAxis={(v) => `${v.toFixed(0)}`}
          windowSize={windowSize}
        />
      </div>
    </div>
  );
}
