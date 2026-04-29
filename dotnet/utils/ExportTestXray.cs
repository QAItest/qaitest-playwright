using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace QAItest.Playwright.DotNet.Utils;

public static partial class ExportTestXray
{
    private static readonly HttpClient Http = new();
    private static readonly HashSet<string> IgnoredForFolder = ["cucumber", "env:appium", "env_appium"];

    [GeneratedRegex(@"[A-Z][A-Z0-9_]+-\d+")]
    private static partial Regex IssueKeyRegex();

    public static string SecretId => Env("TEST_MANAGEMENT_SECRET_ID");
    public static string XrayProjectKey => FirstNonBlank(Env("XRAY_PROJECT_KEY"), Env("TEST_PROJECT_KEY"));
    public static string AuthUrl => Env("TEST_MGMT_AUTH_URL");
    public static string GraphqlUrl => Env("TEST_MGMT_GRAPHQL_URL");
    public static string ExportUrl => Env("TEST_MGMT_EXPORT_URL");
    public static string OutputDir => FirstNonBlank(Env("FEATURE_OUTPUT_DIR"), "tests/features");

    public static Dictionary<string, string> LoadCredentials()
    {
        if (!string.IsNullOrWhiteSpace(SecretId))
        {
            return Aws.GetSecretDict(SecretId).ToDictionary(item => item.Key, item => item.Value?.ToString() ?? string.Empty);
        }

        var creds = new Dictionary<string, string>();
        foreach (var key in new[] { "TEST_MGMT_CLIENT_ID", "TEST_MGMT_CLIENT_SECRET", "XRAY_CLIENT_ID", "XRAY_CLIENT_SECRET" })
        {
            var value = Env(key);
            if (!string.IsNullOrWhiteSpace(value))
            {
                creds[key] = value;
            }
        }

        return creds;
    }

    public static async Task<string> GetTokenAsync()
    {
        if (string.IsNullOrWhiteSpace(AuthUrl))
        {
            return string.Empty;
        }

        var creds = LoadCredentials();
        var clientId = FirstNonBlank(creds.GetValueOrDefault("TEST_MGMT_CLIENT_ID"), creds.GetValueOrDefault("XRAY_CLIENT_ID"));
        var clientSecret = FirstNonBlank(creds.GetValueOrDefault("TEST_MGMT_CLIENT_SECRET"), creds.GetValueOrDefault("XRAY_CLIENT_SECRET"));
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            throw new InvalidOperationException("Missing client credentials for remote export authentication.");
        }

        var body = JsonSerializer.Serialize(new { client_id = clientId, client_secret = clientSecret });
        using var request = new HttpRequestMessage(HttpMethod.Post, AuthUrl)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        using var response = await Http.SendAsync(request);
        await EnsureSuccessAsync(response, "authentication");
        return (await response.Content.ReadAsStringAsync()).Trim().Trim('"');
    }

    public static async Task<Dictionary<string, object>> GraphqlAsync(string token, string query, Dictionary<string, object> variables)
    {
        if (string.IsNullOrWhiteSpace(GraphqlUrl))
        {
            throw new InvalidOperationException("TEST_MGMT_GRAPHQL_URL is not configured.");
        }

        var body = JsonSerializer.Serialize(new { query, variables });
        using var request = new HttpRequestMessage(HttpMethod.Post, GraphqlUrl)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await Http.SendAsync(request);
        await EnsureSuccessAsync(response, "graphql");
        var payload = JsonSerializer.Deserialize<Dictionary<string, object>>(await response.Content.ReadAsStringAsync()) ?? new Dictionary<string, object>();
        if (payload.TryGetValue("errors", out var errors) && errors is not null && !string.IsNullOrWhiteSpace(errors.ToString()))
        {
            throw new InvalidOperationException($"GraphQL errors: {errors}");
        }

        return payload.TryGetValue("data", out var data) && data is JsonElement element && element.ValueKind == JsonValueKind.Object
            ? JsonSerializer.Deserialize<Dictionary<string, object>>(element.GetRawText()) ?? new Dictionary<string, object>()
            : new Dictionary<string, object>();
    }

    public static async Task<string> GetProjectIdAsync(string token, string projectKey)
    {
        const string query = "query($key:String!){ getProjectSettings(projectIdOrKey:$key){ projectId }}";
        var data = await GraphqlAsync(token, query, new Dictionary<string, object> { ["key"] = projectKey });
        return GetNestedString(data, "getProjectSettings", "projectId");
    }

    public static bool HasEnvAppium(IEnumerable<string> labels)
    {
        return labels.Any(label => string.Equals(label, "env:appium", StringComparison.OrdinalIgnoreCase)
            || string.Equals(label, "env_appium", StringComparison.OrdinalIgnoreCase));
    }

    public static bool HasEnvAppiumAndDomain(IEnumerable<string> labels, IEnumerable<string> domains)
    {
        var labelList = labels.ToList();
        var hasAppium = HasEnvAppium(labelList);
        var hasDomain = labelList.Any(label => domains.Any(domain =>
            string.Equals(label, domain, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(label, $"domain:{domain}", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(label, $"domain_{domain}", StringComparison.OrdinalIgnoreCase)));
        return hasAppium && hasDomain;
    }

    public static string PickFunctionalLabel(IEnumerable<string> labels)
    {
        foreach (var label in labels)
        {
            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            if (IgnoredForFolder.Contains(label.ToLowerInvariant()))
            {
                continue;
            }

            return SanitizeSegment(label);
        }

        return "unlabeled";
    }

    public static async Task<List<string>> ExportFeaturesAsync(string token, List<string> keys, Dictionary<string, List<string>> labelsByKey)
    {
        Directory.CreateDirectory(OutputDir);
        var written = new List<string>();
        var localSource = Env("FEATURE_SOURCE_PATH");

        foreach (var group in keys.GroupBy(key => PickFunctionalLabel(labelsByKey.GetValueOrDefault(key, []))))
        {
            var outDir = Path.Combine(OutputDir, group.Key);
            Directory.CreateDirectory(outDir);

            foreach (var key in group)
            {
                var raw = await FetchOneFeatureAsync(token, key, localSource);
                if (string.IsNullOrWhiteSpace(raw))
                {
                    continue;
                }

                var sanitized = GherkinSanitizer.SanitizeFeatureText(raw, key, false, true);
                var outPath = Path.Combine(outDir, $"{key}.feature");
                await File.WriteAllTextAsync(outPath, sanitized);
                written.Add(outPath);
            }
        }

        return written;
    }

    public static List<string> ParseKeysArg(string value)
    {
        return value
            .Trim()
            .Split([',', ' ', ';', '\t', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Select(item => item.Trim().ToUpperInvariant())
            .Where(item => IssueKeyRegex().IsMatch(item))
            .ToList();
    }

    public static List<string> ReadKeysFile(string path)
    {
        var keys = new List<string>();
        foreach (var line in File.ReadLines(path))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith("#", StringComparison.Ordinal))
            {
                continue;
            }

            keys.AddRange(ParseKeysArg(trimmed));
        }

        return keys.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static async Task<string?> FetchOneFeatureAsync(string token, string key, string localSource)
    {
        if (!string.IsNullOrWhiteSpace(localSource) && Directory.Exists(localSource))
        {
            var match = Directory.EnumerateFiles(localSource, "*.feature", SearchOption.AllDirectories)
                .Order()
                .FirstOrDefault(path => string.Equals(Path.GetFileNameWithoutExtension(path), key, StringComparison.OrdinalIgnoreCase));
            return match is null ? null : await File.ReadAllTextAsync(match);
        }

        if (string.IsNullOrWhiteSpace(ExportUrl))
        {
            throw new InvalidOperationException("No feature source configured. Set FEATURE_SOURCE_PATH or TEST_MGMT_EXPORT_URL.");
        }

        var uri = $"{ExportUrl}?keys={Uri.EscapeDataString(key)}";
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        if (!string.IsNullOrWhiteSpace(token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await Http.SendAsync(request);
        await EnsureSuccessAsync(response, "feature export");
        return await response.Content.ReadAsStringAsync();
    }

    private static string GetNestedString(Dictionary<string, object> source, string parent, string child)
    {
        if (!source.TryGetValue(parent, out var value) || value is null)
        {
            return string.Empty;
        }

        if (value is JsonElement element && element.ValueKind == JsonValueKind.Object)
        {
            var map = JsonSerializer.Deserialize<Dictionary<string, object>>(element.GetRawText()) ?? new Dictionary<string, object>();
            return map.TryGetValue(child, out var childValue) ? childValue?.ToString() ?? string.Empty : string.Empty;
        }

        return string.Empty;
    }

    private static string SanitizeSegment(string value)
    {
        var output = Regex.Replace(value ?? string.Empty, @"[^A-Za-z0-9._-]+", "_");
        output = Regex.Replace(output, @"^[._-]+|[._-]+$", string.Empty);
        return string.IsNullOrWhiteSpace(output) ? "unlabeled" : output;
    }

    private static string Env(string key) => Environment.GetEnvironmentVariable(key)?.Trim() ?? string.Empty;

    private static string FirstNonBlank(string? first, string? second)
    {
        return !string.IsNullOrWhiteSpace(first) ? first : second?.Trim() ?? string.Empty;
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, string operation)
    {
        if ((int)response.StatusCode >= 400)
        {
            throw new InvalidOperationException($"Failed {operation}: HTTP {(int)response.StatusCode} -> {await response.Content.ReadAsStringAsync()}");
        }
    }
}
