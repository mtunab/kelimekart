import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    setupFiles: ["tests/setup-env.ts"],
    // Güvenlik testleri ağ üzerinden gerçek veritabanına gider.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ["tests/unit/**/*.test.ts", "tests/security/**/*.test.ts"],
    // Güvenlik testleri gerçek (dev) veritabanına gider; aynı anda çalışıp birbirini bozmasınlar.
    fileParallelism: false,
  },
});
