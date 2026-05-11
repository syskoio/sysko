import { useState } from "react";
import type { MetricSample } from "../lib/types";

interface Props {
  samples: MetricSample[];
}

type Window = 60 | 360 | 720;

const WINDOWS: { label: string; value: Window }[] = [
  { label: "5m", value: 60 },
  { label: "30m", value: 360 },
  { label: "1h", value: 720 },
];

function fmt(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

interface AreaChartProps {
  values: number[];
  color: string;
  height?: number;
  floor?: number;
}

function AreaChart({ values, color, height = 56, floor = 0 }: AreaChartProps): React.ReactElement {
  if (values.length < 2) {
    return <div style={{ height }} className="w-full" />;
  }

  const max = Math.max(...values, floor + 0.001);
  const min = floor;
  const range = max - min;

  const toY = (v: number): number => height - ((v - min) / range) * (height - 2) - 1;
  const toX = (i: number): number => (i / (values.length - 1)) * 100;

  const linePts = values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const last = values.length - 1;
  const areaPts =
    `0,${height} ` + linePts + ` ${toX(last)},${height}`;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <polygon points={areaPts} fill={color} fillOpacity="0.12" />
      <polyline
        points={linePts}
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface CardProps {
  title: string;
  current: string;
  sub?: string;
  values: number[];
  color: string;
  floor?: number;
  warn?: boolean;
}

function MetricCard({ title, current, sub, values, color, floor, warn }: CardProps): React.ReactElement {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2">
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
      <AreaChart values={values} color={color} floor={floor ?? 0} />
    </div>
  );
}

export function SystemTab({ samples }: Props): React.ReactElement {
  const [window, setWindow] = useState<Window>(60);

  const slice = samples.slice(-window);
  const latest = slice[slice.length - 1];

  if (samples.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
        collecting metrics…
      </div>
    );
  }

  const eld = slice.map((s) => s.eventLoopLag);
  const heap = slice.map((s) => s.heapUsed / (1024 * 1024));
  const cpu = slice.map((s) => s.cpuPercent);
  const gc = slice.map((s) => s.gcDuration);

  const eldWarn = (latest?.eventLoopLag ?? 0) > 50;
  const cpuWarn = (latest?.cpuPercent ?? 0) > 80;

  return (
    <div className="flex-1 flex flex-col gap-0 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900">
        <span className="text-[11px] text-zinc-500">
          {slice.length} samples · every 5s
        </span>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => { setWindow(w.value); }}
              className={
                "px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors " +
                (window === w.value
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
          values={eld}
          color="#a3e635"
          floor={0}
          warn={eldWarn}
        />
        <MetricCard
          title="CPU Usage"
          current={(latest?.cpuPercent ?? 0).toFixed(1)}
          sub="%"
          values={cpu}
          color="#60a5fa"
          floor={0}
          warn={cpuWarn}
        />
        <MetricCard
          title="Heap Used"
          current={fmt(latest?.heapUsed ?? 0)}
          sub={`/ ${fmt(latest?.heapTotal ?? 0)}`}
          values={heap}
          color="#f472b6"
          floor={0}
        />
        <MetricCard
          title="GC Pause"
          current={(latest?.gcDuration ?? 0).toFixed(1)}
          sub="ms / interval"
          values={gc}
          color="#fb923c"
          floor={0}
        />
      </div>
    </div>
  );
}
