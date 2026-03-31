import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({}) => {
  const cacheDir =
    process.env.VITE_CACHE_DIR ?? path.resolve(__dirname, ".vite-cache");

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "icons/favicon.ico",
          "icons/apple-touch-icon.png",
          "icons/icon-192x192.png",
          "icons/icon-512x512.png",
        ],
        manifest: {
          id: "/",
          name: "Caca Traca",
          short_name: "Caca Traca",
          description:
            "The intelligent food and digestion tracker for ileostomy and colostomy reversal recovery.",
          theme_color: "#080c14",
          background_color: "#080c14",
          display: "standalone",
          scope: "/",
          start_url: "/",
          lang: "en",
          categories: ["health", "medical", "lifestyle"],
          icons: [
            {
              src: "/icons/icon-72x72.png",
              sizes: "72x72",
              type: "image/png",
            },
            {
              src: "/icons/icon-96x96.png",
              sizes: "96x96",
              type: "image/png",
            },
            {
              src: "/icons/icon-128x128.png",
              sizes: "128x128",
              type: "image/png",
            },
            {
              src: "/icons/icon-144x144.png",
              sizes: "144x144",
              type: "image/png",
            },
            {
              src: "/icons/icon-152x152.png",
              sizes: "152x152",
              type: "image/png",
            },
            {
              src: "/icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/icons/icon-384x384.png",
              sizes: "384x384",
              type: "image/png",
            },
            {
              src: "/icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
          screenshots: [
            {
              src: "/tracking-mobile-view.png",
              sizes: "381x811",
              type: "image/png",
              form_factor: "narrow",
              label: "Meal and symptom tracking view",
            },
            {
              src: "/patterns-mobile.png",
              sizes: "484x896",
              type: "image/png",
              form_factor: "narrow",
              label: "Patterns and insights view",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,svg}"],
          navigateFallback: "index.html",
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "google-fonts-stylesheets",
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                cacheableResponse: {
                  statuses: [0, 200],
                },
                expiration: {
                  maxEntries: 8,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "app-images",
                cacheableResponse: {
                  statuses: [0, 200],
                },
                expiration: {
                  maxEntries: 64,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "./shared"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
    cacheDir,
    server: {
      host: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
            openai: ["openai"],
            convex: ["convex"],
            router: ["@tanstack/react-router"],
          },
        },
      },
    },
  };
});
