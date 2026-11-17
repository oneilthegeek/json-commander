import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://llh_app:llh_dev_pw@127.0.0.1:5432/llh_e2e";
export const E2E_SECRET = "sk_test_e2e_local_mock_key";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "reports/e2e-results.json" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"], testIgnore: /auth\.setup\.ts/ },
  ],
  webServer: [
    {
      command: "npx tsx tests/mocks/paystack-server.ts",
      url: "http://127.0.0.1:4010/__control/state",
      env: { MOCK_PAYSTACK_PORT: "4010", PAYSTACK_SECRET_KEY: E2E_SECRET, WEBHOOK_URL: `http://127.0.0.1:${PORT}/api/webhooks/paystack` },
      reuseExistingServer: false,
    },
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/robots.txt`,
      timeout: 120_000,
      env: {
        NODE_ENV: "production", DATABASE_URL: E2E_DB, APP_URL: `http://localhost:${PORT}`,
        APP_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret-e2e",
        PAYSTACK_SECRET_KEY: E2E_SECRET, PAYSTACK_BASE_URL: "http://127.0.0.1:4010", LLH_E2E: "1", RATE_LIMIT_DISABLED: "1",
        NEWSLETTER_PROVIDER: "substack", SUBSTACK_PUBLICATION_URL: "https://example.substack.com",
      },
      reuseExistingServer: false,
    },
  ],
});
