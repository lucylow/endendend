import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api/billing": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/api/stripe": { target: "http://127.0.0.1:3001", changeOrigin: true },
      /** Vertex FastAPI (``swarm/backend_service.py``). Override with ``VITE_SWARM_DEV_PROXY_TARGET``. Default 8090 avoids clashing with this dev server on 8080. */
      "/api/swarm": {
        target: process.env.VITE_SWARM_DEV_PROXY_TARGET ?? "http://127.0.0.1:8090",
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api\/swarm/, "") || "/",
      },
    },
  },
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    command === "serve" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  assetsInclude: ["**/*.onnx"],
  optimizeDeps: {
    include: ["onnxruntime-web", "react-dom"],
  },
}));
