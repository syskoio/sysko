import { homedir } from "node:os";
import { join } from "node:path";
import { RingBuffer, SqliteStore, type SpanStore, type RetentionOptions } from "@sysko/storage";
import { createTransport, type Transport } from "@sysko/transport";
import { dashboardAssetsPath } from "@sysko/dashboard";
import { activateHttpInstrumentation } from "./instrument-http.js";
import { activateOutboundInstrumentation } from "./instrument-outbound.js";
import { activateErrorInstrumentation } from "./instrument-errors.js";
import { setActiveStore, setSamplingRate, setRateLimit } from "./span-factory.js";
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
  RetentionOptions,
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
  password?: string;
}

export type StorageOptions =
  | "sqlite"
  | "memory"
  | { path: string };

export interface SyskoOptions {
  serviceName?: string;
  /** Only used when storage is "memory". Defaults to 1000. */
  capacity?: number;
  storage?: StorageOptions;
  retention?: RetentionOptions;
  dashboard?: DashboardOptions | false;
  sampling?: number;
  redact?: RedactOptions;
  /** Max spans stored per second. Excess spans are dropped. */
  rateLimit?: number;
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

function resolveStore(options: SyskoOptions): SpanStore {
  const storageOpt = options.storage ?? "sqlite";

  if (storageOpt === "memory") {
    return new RingBuffer(options.capacity);
  }

  const path =
    storageOpt === "sqlite"
      ? join(homedir(), ".sysko", `${options.serviceName ?? "default"}.db`)
      : storageOpt.path;

  return new SqliteStore(path, options.retention);
}

export async function init(options: SyskoOptions = {}): Promise<Sysko> {
  if (active) return active;

  const store = resolveStore(options);
  setActiveStore(store);
  setSamplingRate(options.sampling ?? 1);

  if (options.rateLimit !== undefined) {
    setRateLimit(options.rateLimit);
  }

  if (options.redact) {
    addSpanHook(buildRedactHook(options.redact));
  }

  const deactivateInbound = activateHttpInstrumentation(store);
  const deactivateErrors = activateErrorInstrumentation(store);

  const dashOpts = options.dashboard !== false ? (options.dashboard ?? {}) : undefined;
  const port = dashOpts?.port ?? DEFAULT_PORT;
  const host = dashOpts?.host ?? DEFAULT_HOST;
  const deactivateOutbound = activateOutboundInstrumentation({ host, port });

  if (
    dashOpts &&
    !dashOpts.password &&
    host !== "127.0.0.1" &&
    host !== "localhost"
  ) {
    console.warn(
      "[sysko] WARNING: dashboard bound to " +
        host +
        " without a password. Set dashboard.password to protect it.",
    );
  }

  let transport: Transport | undefined;
  let dashboardUrl: string | undefined;
  if (dashOpts) {
    transport = createTransport({
      store,
      staticDir: dashOpts.staticDir ?? dashboardAssetsPath,
      port,
      host,
      ...(dashOpts.password !== undefined ? { password: dashOpts.password } : {}),
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
      process.off("SIGTERM", handleSignal);
      process.off("SIGINT", handleSignal);
      deactivateInbound();
      deactivateOutbound();
      deactivateErrors();
      clearSpanHooks();
      setActiveStore(null);
      setSamplingRate(1);
      setRateLimit(0);
      await transport?.stop();
      store.close?.();
      active = undefined;
    },
  };

  function handleSignal(): void {
    sysko.shutdown().finally(() => process.exit(0));
  }

  process.once("SIGTERM", handleSignal);
  process.once("SIGINT", handleSignal);

  active = sysko;
  return sysko;
}
