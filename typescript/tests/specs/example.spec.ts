import { test } from "@playwright/test";
import {
  initializeExampleContext,
  openPlaywrightHomepage,
  expectPlaywrightHomepage
} from "../steps/example/test_example_steps";

test("TEST-201 example workflow", async ({ page }) => {
  const context = await initializeExampleContext(page);
  await openPlaywrightHomepage(context);
  await expectPlaywrightHomepage(context);
});
