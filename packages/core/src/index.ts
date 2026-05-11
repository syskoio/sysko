import { RingBuffer, type SpanStore } from "@sysko/storage";
import { createTransport, type Transport } from "@sysko/transport";
import { dashboardAssetsPath } from "@sysko/dashboard";
import { activateHttpInstrumentation } from "./instrument-http.js";
import { activateOutboundInstrumentation } from "./instrument-outbound.js";
import { activateErrorInstrumentation } from "./instrument-errors.js";
import { setActiveStore, setSamplingRate } from "./span-factory.js";
import { addSpanHook, clearSpanHooks, type SpanHook } from "./hooks.js";
import { buildRedactHook, type RedactOptions } from "./redact.js";

export type {
  Span,
  SpanStore,
  SpanListener,
  SpanAttributes,
  SpanKind,
  SpanStatus,
  SpanError,
} from "@sysko/storage";
export { getCurrentSpanId, getCurrentTraceId, getCurrentContext } from "./context.js";
export {
  startSpan,
  withSpan,
  getActiveHandle,
  type SpanHandle,
  type StartSpanOptions,
} from "./span-factory.js";
export type { SpanHook } from "./hooks.js";
export type { RedactOptions } from "./redact.js";

export interface DashboardOptions {
  port?: number;
  host?: string;
  staticDir?: string;
}

export interface SyskoOptions {
  serviceName?: string;
  capacity?: number;
  dashboard?: DashboardOptions | false;
  sampling?: number;
  redact?: RedactOptions;
}

export interface Sysko {
  readonly store: SpanStore;
  readonly transport: Transport | undefined;
  readonly dashboardUrl: string | undefined;
  onSpan(hook: SpanHook): () => void;
  shutdown(): Promise<void>;
}

const DEFAULT_PORT = 9999;
const DEFAULT_HOST = "127.0.0.1";

let active: Sysko | undefined;

export async function init(options: SyskoOptions = {}): Promise<Sysko> {
  if (active) return active;

  const store = new RingBuffer(options.capacity);
  setActiveStore(store);
  setSamplingRate(options.sampling ?? 1);

  if (options.redact) {
    addSpanHook(buildRedactHook(options.redact));
  }

  const deactivateInbound = activateHttpInstrumentation(store);
  const deactivateErrors = activateErrorInstrumentation(store);

  const port = options.dashboard !== false ? options.dashboard?.port ?? DEFAULT_PORT : DEFAULT_PORT;
  const host = options.dashboard !== false ? options.dashboard?.host ?? DEFAULT_HOST : DEFAULT_HOST;
  const deactivateOutbound = activateOutboundInstrumentation({ host, port });

  let transport: Transport | undefined;
  let dashboardUrl: string | undefined;
  if (options.dashboard !== false) {
    const d = options.dashboard ?? {};
    transport = createTransport({
      store,
      staticDir: d.staticDir ?? dashboardAssetsPath,
      port,
      host,
    });
    const started = await transport.start();
    dashboardUrl = started.url;
    console.log(`[sysko] dashboard ready at ${dashboardUrl}`);
  }

  const sysko: Sysko = {
    store,
    transport,
    dashboardUrl,
    onSpan(hook) {
      return addSpanHook(hook);
    },
    async shutdown() {
      deactivateInbound();
      deactivateOutbound();
      deactivateErrors();
      clearSpanHooks();
      setActiveStore(null);
      setSamplingRate(1);
      await transport?.stop();
      active = undefined;
    },
  };
  active = sysko;
  return sysko;
}
