import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Testler yalnızca DEV ortamına karşı çalışır.
config({ path: ".env.local", quiet: true });
// Ev ağındaki aralıklı DNS hatalarına karşı (yalnızca testlerde).
import "./scripts/flaky-network.cjs";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  // Veritabanı bulutta; kararsız ağda 5 sn'lik varsayılan bekleme yetmiyor.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "tr-TR",
  },
  projects: [
    { name: "masaustu", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobil-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // `pnpm verify` önce derler; e2e testleri gerçek üretim derlemesine karşı çalışır.
    command: `pnpm start --port ${PORT}`,
    env: { NODE_OPTIONS: "--require ./scripts/flaky-network.cjs" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
