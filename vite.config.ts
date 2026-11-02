import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/ChipToons/",
  plugins: [react()],
  server: { allowedHosts: ["terminal.local"] },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
