import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Uses the locally installed Chrome; run `npx playwright install chromium` and drop this line to use bundled Chromium.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    // Production build: realistic and avoids dev-mode on-demand compilation delays.
    command: `node -e "require('fs').rmSync('.data-e2e',{recursive:true,force:true})" && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/status`,
    reuseExistingServer: false,
    timeout: 240_000,
    // Deterministic demo mode + throwaway storage, regardless of the developer's .env.local
    env: { DEMO_MODE: "true", DATA_DIR: ".data-e2e", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
