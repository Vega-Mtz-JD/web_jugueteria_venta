import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// INTEGRATION=1 corre solo las pruebas *.int.test.ts (necesitan Supabase local).
const integration = process.env.INTEGRATION === "1";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: integration ? "node" : "jsdom",
    setupFiles: integration ? [] : ["./vitest.setup.ts"],
    include: integration ? ["src/**/*.int.test.ts"] : ["src/**/*.test.{ts,tsx}"],
    exclude: integration ? [] : ["src/**/*.int.test.ts"],
  },
});
