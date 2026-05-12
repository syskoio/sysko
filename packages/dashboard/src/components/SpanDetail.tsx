import { X, Copy, Check, AlertTriangle, Download, GitCompare, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import type { Span } from "../lib/types";
import { fmtAbsoluteTime, fmtDuration, fmtRelativeTime, shortId } from "../lib/format";
import { methodPill, statusColor } from "../lib/colors";
import { Pill } from "./ui/Pill";
import { exportTrace } from "../lib/export";

export interface SpanDetailProps {
  span: Span;
  trace: Span[];
  onClose: () => void;
  onSelectSpan: (id: string) => void;
  onCompare?: () => void;
  isCompare?: boolean;
}

const PROTECTED_KEYS = new Set([
  "http.method",
  "http.path",
  "http.status_code",
  "http.url",
  "http.host",
]);

export function SpanDetail({ span, trace, onClose, onSelectSpan, onCompare, isCompare }: SpanDetailProps): React.ReactElement {
  const [copied, setCopied] = useState<"link" | null>(null);

  const copyLink = (): void => {
    const origin = import.meta.env.DEV
      ? `${location.protocol}//${location.hostname}:9999`
      : location.origin;
    const url = `${origin}${location.pathname}#/trace/${span.traceId}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied("link");
      setTimeout(() => setCopied(null), 1200);
    });
  };

  const method = span.attributes["http.method"];
  const route = span.attributes["http.route"];
  const path = route ?? span.attributes["http.path"] ?? span.attributes["http.url"];
  const code = span.attributes["http.status_code"];
  const isHttp = span.kind.startsWith("http.");
  const mp = method ? methodPill(method) : undefined;
  const isError = span.status === "error";

  const extraAttrs = Object.entries(span.attributes).filter(([k]) => !PROTECTED_KEYS.has(k));

  return (
    <aside className="h-full flex flex-col border-l border-zinc-900 bg-zinc-950 overflow-auto">
      <div className="flex items-start justify-between px-5 py-3 border-b border-zinc-900">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            {mp && method && <Pill bg={mp.bg} text={mp.text}>{method}</Pill>}
            <Pill bg="bg-zinc-800" text="text-zinc-400">{span.kind}</Pill>
            {code !== undefined && (
              <span className={"font-mono text-[11px] tabular-nums " + statusColor(code, isError)}>{code}</span>
            )}
            {span.attributes["http.aborted"] === true && (
              <span className="font-mono text-[10px] tabular-nums text-red-400 uppercase tracking-wider">aborted</span>
            )}
            {isError && (
              <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-mono">
                <AlertTriangle className="h-3 w-3" /> error
              </span>
            )}
          </div>
          <h2 className="font-mono text-sm text-zinc-100 break-all">{isHttp ? path : span.name}</h2>
        </div>
        <div className="flex items-center gap-0.5 ml-4 shrink-0">
          <button
            type="button"
            onClick={copyLink}
            className="p-1 text-zinc-500 hover:text-lime-300 hover:bg-zinc-900 rounded transition-colors"
            title="Copy shareable link"
          >
            {copied === "link" ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <LinkIcon className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => exportTrace(span.traceId, trace)}
            className="p-1 text-zinc-500 hover:text-lime-300 hover:bg-zinc-900 rounded transition-colors"
            title="Export trace as JSON"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          {onCompare && !isCompare && (
            <button
              type="button"
              onClick={onCompare}
              className="p-1 text-zinc-500 hover:text-lime-300 hover:bg-zinc-900 rounded transition-colors"
              title="Compare with another trace"
            >
              <GitCompare className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 rounded"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isError && span.error && (
          <Section title="error">
            <KV label="name" value={span.error.name ?? "Error"} mono />
            <KV label="message" value={span.error.message} />
            {span.error.stack && (
              <pre className="mt-2 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap bg-zinc-900/60 rounded p-2 border border-zinc-900 max-h-48 overflow-auto">
                {span.error.stack}
              </pre>
            )}
          </Section>
        )}

        <Section title="timing">
          <KV label="duration" value={fmtDuration(span.duration)} mono />
          <KV label="started" value={fmtAbsoluteTime(span.startTime)} mono />
          <KV label="elapsed" value={fmtRelativeTime(span.startTime)} />
        </Section>

        <Section title="span">
          <KV label="span id" value={span.id} mono copyable />
          <KV label="short id" value={shortId(span.id)} mono />
          <KV label="trace id" value={span.traceId} mono copyable />
          {span.parentSpanId && <KV label="parent" value={shortId(span.parentSpanId)} mono />}
          <KV label="kind" value={span.kind} mono />
          <KV label="name" value={span.name} mono />
          <KV label="status" value={span.status} mono />
        </Section>

        {isHttp && (
          <Section title="http">
            {method && <KV label="method" value={method} mono />}
            {span.attributes["http.url"] !== undefined && (
              <KV label="url" value={String(span.attributes["http.url"])} mono />
            )}
            {span.attributes["http.path"] !== undefined && (
              <KV label="path" value={String(span.attributes["http.path"])} mono />
            )}
            {span.attributes["http.host"] !== undefined && (
              <KV label="host" value={String(span.attributes["http.host"])} mono />
            )}
            {code !== undefined && <KV label="status" value={String(code)} mono />}
          </Section>
        )}

        {extraAttrs.length > 0 && (
          <Section title="attributes">
            {extraAttrs.map(([k, v]) => (
              <KV key={k} label={k} value={String(v)} mono />
            ))}
          </Section>
        )}
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="border-b border-zinc-900 last:border-b-0">
      <div className="px-5 pt-4 pb-1.5 text-[10px] uppercase tracking-wider font-medium text-zinc-500">
        {title}
      </div>
      <div className="px-5 pb-4 space-y-1">{children}</div>
    </div>
  );
}

function KV({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const onCopy = (): void => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="flex items-start justify-between gap-3 text-[12.5px] py-0.5 group">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={"text-zinc-100 text-right break-all " + (mono ? "font-mono" : "")}>{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={onCopy}
            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-lime-300 transition"
            title="Copy"
          >
            {copied ? <Check className="h-3 w-3 text-lime-300" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  );
}
