import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@lib": path.resolve(__dirname, "lib"),
      "@lib/*": path.resolve(__dirname, "lib", "*"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          query: ["@tanstack/react-query"],
          ui: [
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
            "tailwindcss-animate",
            "tailwindcss",
          ],
          motion: ["framer-motion"],
          carousel: ["embla-carousel-react", "embla-carousel-autoplay"],
          charts: ["recharts"],
          richText: ["@tinymce/tinymce-react"],
        },
      },
    },
  },
  assetsInclude: ["**/*.jpg", "**/*.jpeg", "**/*.png", "**/*.webp", "**/*.avif"],
});
