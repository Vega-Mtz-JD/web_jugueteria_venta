import { defineConfig, devices } from "@playwright/test";

// PLAYWRIGHT_BASE_URL permite correr las pruebas contra una vista previa de Netlify.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // Base local como el seed y build desde cero: el build pre-renderiza fichas con el stock
        // y la caché de "use cache" en .next guardaría ids viejos tras un `supabase db reset`.
        command: "node e2e/reset-db.mts && rm -rf .next && npm run build && npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
