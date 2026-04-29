using Microsoft.Playwright;
using NUnit.Framework;
using QAItest.Playwright.DotNet.Tests.Steps;

namespace QAItest.Playwright.DotNet.Tests.Specs;

public class ExamplePlaywrightTests
{
    [Test]
    public async Task TestExampleWorkflow()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync();
        await using var context = await browser.NewContextAsync();
        var page = await context.NewPageAsync();

        var exampleContext = ExampleSteps.Initialize(page);
        await ExampleSteps.OpenHomepageAsync(exampleContext);
        await ExampleSteps.ExpectHomepageAsync(exampleContext);
    }
}
