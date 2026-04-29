async function initializeExampleContext(page) {
  return { page, executed: false };
}

async function openPlaywrightHomepage(context) {
  context.executed = true;
  await context.page.goto("/");
}

async function expectPlaywrightHomepage(context) {
  await context.page.getByRole("link", { name: "Get started" }).waitFor();
  if (!context.executed) {
    throw new Error("Example scenario did not execute.");
  }
}

module.exports = {
  initializeExampleContext,
  openPlaywrightHomepage,
  expectPlaywrightHomepage
};
