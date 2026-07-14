import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/cytoscape')) return 'cytoscape';
            if (id.includes('node_modules/tldraw') || id.includes('@tldraw')) return 'tldraw';
            if (id.includes('node_modules/katex')) return 'katex';
            if (id.includes('node_modules/firebase')) return 'firebase';
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'charts';
            if (id.includes('node_modules/mermaid') || id.includes('cynefin')) return 'diagrams';
          },
        },
      },
      chunkSizeWarningLimit: 800,
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: {
          // SW in dev caches stale CSS/JS and hides layout updates (e.g. full-width).
          enabled: false,
        },
        manifest: {
          name: "Memora",
          short_name: "Memora",
          description: "AI Tutoring Workspace",
          theme_color: "#ffffff",
          icons: [
            {
              src: "https://cdn-icons-png.flaticon.com/512/2965/2965306.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
          maximumFileSizeToCacheInBytes: 10000000,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."), "yjs": path.resolve(__dirname, "node_modules/yjs"),
      },
    },
    server: {
      port: 3010,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
