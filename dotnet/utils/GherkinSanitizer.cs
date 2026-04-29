namespace QAItest.Playwright.DotNet.Utils;

public static class GherkinSanitizer
{
    public static string SanitizeFeatureText(string text)
    {
        return text.Replace("\r\n", "\n").Replace("\r", "\n").Replace("@env:", "@env_").Trim() + "\n";
    }
}
