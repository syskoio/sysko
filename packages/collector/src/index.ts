import { homedir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "@syskoio/storage";
import { createTransport } from "@syskoio/transport";
import { dashboardAssetsPath } from "@syskoio/dashboard";

export interface CollectorOptions {
  port?: number;
  host?: string;
  storagePath?: string;
  password?: string;
}

export interface CollectorHandle {
  url: string;
  stop(): Promise<void>;
}

export async function startCollector(options: CollectorOptions = {}): Promise<CollectorHandle> {
  const port = options.port ?? 9999;
  const host = options.host ?? "0.0.0.0";
  const storagePath =
    options.storagePath ?? join(homedir(), ".sysko", "collector.db");

  const store = new SqliteStore(storagePath);

  const transport = createTransport({
    store,
    staticDir: dashboardAssetsPath,
    port,
    host,
    ingest: true,
    ...(options.password !== undefined ? { password: options.password } : {}),
  });

  const { url } = await transport.start();

  return {
    url,
    async stop() {
      await transport.stop();
      store.close?.();
    },
  };
}
