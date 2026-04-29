using System.Text.Json;

namespace QAItest.Playwright.DotNet.Utils;

public static class SecretLoader
{
    public static Dictionary<string, object> GetSecretMap(string secretId)
    {
        if (secretId.StartsWith("env:", StringComparison.Ordinal))
        {
            var envName = secretId[4..];
            var raw = Environment.GetEnvironmentVariable(envName);
            if (string.IsNullOrWhiteSpace(raw))
            {
                throw new InvalidOperationException($"Environment variable is empty or undefined: {envName}");
            }

            return Parse(raw);
        }

        if (secretId.StartsWith("file:", StringComparison.Ordinal))
        {
            var filePath = Path.GetFullPath(secretId[5..]);
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException("Secret file not found.", filePath);
            }

            return Parse(File.ReadAllText(filePath));
        }

        var envValue = Environment.GetEnvironmentVariable(secretId);
        if (!string.IsNullOrWhiteSpace(envValue))
        {
            return Parse(envValue);
        }

        var candidatePath = Path.GetFullPath(secretId);
        if (File.Exists(candidatePath))
        {
            return Parse(File.ReadAllText(candidatePath));
        }

        throw new InvalidOperationException($"Secret could not be resolved from env or file: {secretId}");
    }

    public static Dictionary<string, object> GetSecretDict(string secretId)
    {
        return GetSecretMap(secretId);
    }

    private static Dictionary<string, object> Parse(string value)
    {
        using var document = JsonDocument.Parse(value);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException("Expected a JSON object / dictionary payload.");
        }

        return JsonSerializer.Deserialize<Dictionary<string, object>>(value) ?? new Dictionary<string, object>();
    }
}
