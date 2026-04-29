const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/specs",
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  reporter: [["list"], ["html", { outputFolder: "../reports/playwright-report/javascript", open: "never" }]],
  use: {
    baseURL: "https://playwright.dev",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  outputDir: "../reports/test-results/javascript"
});
