const { test } = require("@playwright/test");
const {
  initializeExampleContext,
  openPlaywrightHomepage,
  expectPlaywrightHomepage
} = require("../steps/example/test_example_steps");

test("TEST-101 example workflow", async ({ page }) => {
  const context = await initializeExampleContext(page);
  await openPlaywrightHomepage(context);
  await expectPlaywrightHomepage(context);
});
