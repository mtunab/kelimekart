import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Testler yalnızca DEV ortamına karşı çalışır.
config({ path: ".env.local", quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
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
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
