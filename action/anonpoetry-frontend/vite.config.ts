import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@/abi": path.resolve(__dirname, "./abi"),
    },
  },
});


