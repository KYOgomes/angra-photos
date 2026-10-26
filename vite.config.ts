import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: {
    // heic2any (~1,3 MB) só é baixado quando aparece um HEIC que o navegador não abre.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    // Em desenvolvimento a API roda no `wrangler dev` (porta 8787).
    proxy: { "/api": "http://localhost:8787" },
  },
});
