using System.Text.Json;

namespace QAItest.Playwright.DotNet.Utils;

public static class SecretLoader
{
    public static Dictionary<string, object> GetSecretMap(string secretId)
    {
        if (secretId.StartsWith("env:"))
        {
            var envName = secretId[4..];
            return Parse(Environment.GetEnvironmentVariable(envName));
        }

        if (secretId.StartsWith("file:"))
        {
            var filePath = Path.GetFullPath(secretId[5..]);
            return File.Exists(filePath) ? Parse(File.ReadAllText(filePath)) : new Dictionary<string, object>();
        }

        var envValue = Environment.GetEnvironmentVariable(secretId);
        if (!string.IsNullOrWhiteSpace(envValue))
        {
            return Parse(envValue);
        }

        var candidatePath = Path.GetFullPath(secretId);
        return File.Exists(candidatePath) ? Parse(File.ReadAllText(candidatePath)) : new Dictionary<string, object>();
    }

    private static Dictionary<string, object> Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return new Dictionary<string, object>();
        }

        return JsonSerializer.Deserialize<Dictionary<string, object>>(value) ?? new Dictionary<string, object>();
    }
}
