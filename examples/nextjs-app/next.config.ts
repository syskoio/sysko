import type { NextConfig } from "next";

const config: NextConfig = {
  // Required for instrumentation.ts to be loaded on server start.
  experimental: {
    instrumentationHook: true,
  },
  transpilePackages: ["@syskoio/core"],
};

export default config;
