import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  build: {
    outDir: "dist-client",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/_sysko/ws": {
        target: "ws://127.0.0.1:9999",
        ws: true,
      },
    },
  },
});
