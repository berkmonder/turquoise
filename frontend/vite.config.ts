import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The chat as a script any page can load: `vite build` writes dist/widget/turquoise.js (a fixed name the
// page links to) and its chunks (hashed names, cached for good), which the server serves at /widget/.
// `vite` (npm run dev) opens index.html, a playground page, and sends /api to the backend (:8000).
export default defineConfig({
  plugins: [react()],
  base: "./", // chunks load relative to turquoise.js, wherever it's served
  build: {
    outDir: "dist/widget",
    modulePreload: false,
    rollupOptions: {
      input: "src/turquoise.ts",
      output: { entryFileNames: "turquoise.js", chunkFileNames: "[name]-[hash].js" },
    },
  },
  server: { proxy: { "/api": { target: "http://localhost:8000", changeOrigin: false } } },
});
