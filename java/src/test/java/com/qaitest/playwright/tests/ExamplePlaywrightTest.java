package com.qaitest.playwright.tests;

import com.microsoft.playwright.*;
import com.qaitest.playwright.steps.ExampleSteps;
import org.junit.jupiter.api.Test;

public class ExamplePlaywrightTest {
  @Test
  void testExampleWorkflow() {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.chromium().launch();
      BrowserContext browserContext = browser.newContext();
      Page page = browserContext.newPage();
      ExampleSteps.ExampleContext context = ExampleSteps.initialize(page);
      ExampleSteps.openHomepage(context);
      ExampleSteps.expectHomepage(context);
      browser.close();
    }
  }
}
