using Microsoft.Playwright;

namespace QAItest.Playwright.DotNet.Tests.Steps;

public static class ExampleSteps
{
    public sealed class ExampleContext
    {
        public IPage Page { get; init; } = default!;
        public bool Executed { get; set; }
    }

    public static ExampleContext Initialize(IPage page) => new() { Page = page, Executed = false };

    public static async Task OpenHomepageAsync(ExampleContext context)
    {
        context.Executed = true;
        await context.Page.GotoAsync("https://playwright.dev/");
    }

    public static async Task ExpectHomepageAsync(ExampleContext context)
    {
        await context.Page.GetByRole(AriaRole.Link, new() { Name = "Get started" }).WaitForAsync();
        if (!context.Executed)
        {
            throw new InvalidOperationException("Scenario did not execute.");
        }
    }
}
