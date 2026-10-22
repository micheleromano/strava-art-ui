import { defineConfig, devices } from "@playwright/test";

const APP_URL = "http://localhost:5174";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL: APP_URL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "tsx e2e/mock-strava.ts",
      url: "http://localhost:8790/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      // A production build on the Workers runtime. The e2e Wrangler env points the app at the
      // mock Strava; the e2e Vite mode swaps in fixture sample data.
      command:
        "react-router build --mode e2e && vite preview --port 5174 --strictPort",
      env: { CLOUDFLARE_ENV: "e2e" },
      url: APP_URL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
