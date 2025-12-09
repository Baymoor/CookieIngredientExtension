import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Increases the warning limit to 5000kb (5MB) to account for the Cookie Database
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
        content: resolve(__dirname, "src/content/content.ts"),
      },
      output: {
        entryFileNames: "src/[name]/[name].js", // folder name / file name .js 
      },
    },
  },
});
