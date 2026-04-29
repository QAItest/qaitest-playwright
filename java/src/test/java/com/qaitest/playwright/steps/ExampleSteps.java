package com.qaitest.playwright.steps;

import com.microsoft.playwright.Page;

public final class ExampleSteps {
  private ExampleSteps() {}

  public static ExampleContext initialize(Page page) {
    return new ExampleContext(page, false);
  }

  public static void openHomepage(ExampleContext context) {
    context.executed = true;
    context.page.navigate("https://playwright.dev/");
  }

  public static void expectHomepage(ExampleContext context) {
    context.page.getByRole(com.microsoft.playwright.options.AriaRole.LINK,
      new Page.GetByRoleOptions().setName("Get started")).waitFor();
    if (!context.executed) {
      throw new IllegalStateException("Scenario did not execute");
    }
  }

  public static final class ExampleContext {
    public final Page page;
    public boolean executed;

    public ExampleContext(Page page, boolean executed) {
      this.page = page;
      this.executed = executed;
    }
  }
}
