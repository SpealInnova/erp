const { defineConfig, devices } = require("@playwright/test");

const PORT = process.env.E2E_PORT || 3100;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  globalSetup: require.resolve("./tests/e2e/global-setup.js"),
  globalTeardown: require.resolve("./tests/e2e/global-teardown.js"),
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node src/index.js",
    url: `${BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      PORT: String(PORT),
      DB_HOST: process.env.DB_HOST || "127.0.0.1",
      DB_PORT: process.env.DB_PORT || "3307",
      DB_USER: process.env.DB_USER || "root",
      DB_PASSWORD: process.env.DB_PASSWORD || "root",
      DB_NAME: process.env.DB_NAME || "erp_test",
      JWT_SECRET: process.env.JWT_SECRET || "qa-local-test-secret",
      APP_ENV: "e2e",
    },
  },
});
