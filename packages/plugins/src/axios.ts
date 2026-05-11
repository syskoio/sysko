import { startSpan } from "@sysko/core";
import type { SpanHandle } from "@sysko/core";

interface AxiosRequestConfig {
  method?: string;
  url?: string;
  baseURL?: string;
  [key: string]: unknown;
}

interface AxiosResponse {
  status: number;
  config: AxiosRequestConfig;
  [key: string]: unknown;
}

interface AxiosError {
  config?: AxiosRequestConfig;
  response?: { status?: number };
}

interface AxiosInstance {
  interceptors: {
    request: { use(onFulfilled: (config: AxiosRequestConfig) => AxiosRequestConfig): number };
    response: {
      use(
        onFulfilled: (res: AxiosResponse) => AxiosResponse,
        onRejected: (err: unknown) => unknown,
      ): number;
    };
  };
}

const SPAN_KEY = "__sysko_span";

export function instrumentAxios(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => {
    const method = (config.method ?? "GET").toUpperCase();
    const url = String(config.baseURL ?? "") + String(config.url ?? "");
    const span = startSpan({
      kind: "http.client",
      name: `${method} ${url}`,
      attributes: { "http.method": method, "http.url": url },
    });
    config[SPAN_KEY] = span;
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      const span = response.config[SPAN_KEY] as SpanHandle | undefined;
      if (span) {
        span.setAttribute("http.status_code", response.status);
        span.end();
      }
      return response;
    },
    (err: unknown) => {
      const axiosErr = err as AxiosError;
      const span = axiosErr.config?.[SPAN_KEY] as SpanHandle | undefined;
      if (span) {
        const status = axiosErr.response?.status;
        if (status !== undefined) span.setAttribute("http.status_code", status);
        span.setStatus("error", err);
        span.end();
      }
      return Promise.reject(err);
    },
  );
}
