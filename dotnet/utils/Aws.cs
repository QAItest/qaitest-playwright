namespace QAItest.Playwright.DotNet.Utils;

public static class Aws
{
    public static Dictionary<string, object> GetSecretDict(string secretId)
    {
        return SecretLoader.GetSecretDict(secretId);
    }
}
