import path from "node:path";
import { defineConfig } from "vite";

// Build separado do service worker: um único arquivo clássico em dist/sw.js,
// sem imports, para funcionar em qualquer navegador.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "sw/sw.ts"),
      formats: ["iife"],
      name: "albumSw",
      fileName: () => "sw.js",
    },
  },
});
