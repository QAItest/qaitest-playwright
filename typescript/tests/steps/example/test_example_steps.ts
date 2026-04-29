import type { Page } from "@playwright/test";

export type ExampleContext = {
  page: Page;
  executed: boolean;
};

export async function initializeExampleContext(page: Page): Promise<ExampleContext> {
  return { page, executed: false };
}

export async function openPlaywrightHomepage(context: ExampleContext): Promise<void> {
  context.executed = true;
  await context.page.goto("/");
}

export async function expectPlaywrightHomepage(context: ExampleContext): Promise<void> {
  await context.page.getByRole("link", { name: "Get started" }).waitFor();
  if (!context.executed) {
    throw new Error("Example scenario did not execute.");
  }
}
