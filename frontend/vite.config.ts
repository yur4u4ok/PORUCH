/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, fileURLToPath(new URL("..", import.meta.url)), ""), ...process.env };
  const proxyTarget = env.VITE_PROXY_TARGET || "http://localhost:8000";

  return {
    envDir: "..",
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    plugins: [
      react(),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "autoUpdate",
        injectRegister: false,
        injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,woff2}"] },
        devOptions: { enabled: true, type: "module", navigateFallback: "index.html" },
        includeAssets: ["icons/favicon.svg", "icons/apple-touch-icon.png"],
        manifest: {
          id: "/",
          name: "Поруч — локальна мережа взаємодопомоги",
          short_name: "Поруч",
          description: "Попроси допомогу в людей поруч або допоможи сам.",
          lang: "uk",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          theme_color: "#1F3A5F",
          background_color: "#F3F5F7",
          categories: ["social", "lifestyle"],
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
      }),
    ],
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": { target: proxyTarget },
        "/admin": { target: proxyTarget },
        "/static": { target: proxyTarget },
        "/ws": { target: proxyTarget.replace(/^http/, "ws"), ws: true },
      },
    },
    worker: { format: "es" },
    build: { sourcemap: true, chunkSizeWarningLimit: 1200 },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
    },
  };
});
