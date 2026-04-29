using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace QAItest.Playwright.DotNet.Utils;

public static partial class ImportTestXray
{
    private static readonly HttpClient Http = new();

    [GeneratedRegex(@"[A-Z]{2,}-\d+")]
    private static partial Regex JiraKeyRegex();

    public static string SecretIdXray => Env("TEST_MGMT_SECRET_ID");
    public static string SecretIdJira => Env("ISSUE_TRACKER_SECRET_ID");
    public static string XrayBaseUrl => Env("TEST_MGMT_BASE_URL");
    public static string XrayGqlUrl => Env("TEST_MGMT_GRAPHQL_URL");
    public static string JiraBaseUrl => Env("ISSUE_TRACKER_BASE_URL");
    public static string FeaturesDir => FirstNonBlank(Env("FEATURES_DIR"), "tests/features");
    public static string LogsRoot => FirstNonBlank(Env("LOGS_ROOT"), "logs");

    public static void Log(string message) => Console.WriteLine(message);

    public static Dictionary<string, string> JiraAuthHeader()
    {
        var jiraCreds = string.IsNullOrWhiteSpace(SecretIdJira) ? new Dictionary<string, object>() : Aws.GetSecretDict(SecretIdJira);
        var email = FirstNonBlank(Env("ISSUE_TRACKER_EMAIL"),
            FirstNonBlank(Env("JIRA_EMAIL"),
                FirstNonBlank(jiraCreds.GetValueOrDefault("email")?.ToString(), jiraCreds.GetValueOrDefault("JIRA_EMAIL")?.ToString())));
        var token = FirstNonBlank(Env("ISSUE_TRACKER_TOKEN"),
            FirstNonBlank(Env("JIRA_TOKEN"),
                FirstNonBlank(jiraCreds.GetValueOrDefault("token")?.ToString(), jiraCreds.GetValueOrDefault("JIRA_TOKEN")?.ToString())));

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Missing issue tracker credentials (email/token).");
        }

        var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{email}:{token}"));
        return new Dictionary<string, string> { ["Authorization"] = $"Basic {encoded}" };
    }

    public static async Task<string> GetXrayTokenAsync()
    {
        if (string.IsNullOrWhiteSpace(XrayBaseUrl))
        {
            return string.Empty;
        }

        var xrayCreds = string.IsNullOrWhiteSpace(SecretIdXray) ? new Dictionary<string, object>() : Aws.GetSecretDict(SecretIdXray);
        var clientId = FirstNonBlank(Env("TEST_MGMT_CLIENT_ID"),
            FirstNonBlank(xrayCreds.GetValueOrDefault("client_id")?.ToString(), xrayCreds.GetValueOrDefault("XRAY_CLIENT_ID")?.ToString()));
        var clientSecret = FirstNonBlank(Env("TEST_MGMT_CLIENT_SECRET"),
            FirstNonBlank(xrayCreds.GetValueOrDefault("client_secret")?.ToString(), xrayCreds.GetValueOrDefault("XRAY_CLIENT_SECRET")?.ToString()));

        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            throw new InvalidOperationException("Missing test management credentials.");
        }

        var body = JsonSerializer.Serialize(new { client_id = clientId, client_secret = clientSecret });
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{XrayBaseUrl.TrimEnd('/')}/authenticate")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        using var response = await Http.SendAsync(request);
        await EnsureSuccessAsync(response, "xray-auth");
        return (await response.Content.ReadAsStringAsync()).Trim().Trim('"');
    }

    public static async Task<Dictionary<string, object>> PostXrayGraphqlAsync(
        string token,
        string query,
        Dictionary<string, object>? variables = null,
        string operationName = "graphql")
    {
        if (string.IsNullOrWhiteSpace(XrayGqlUrl))
        {
            throw new InvalidOperationException("TEST_MGMT_GRAPHQL_URL is not configured.");
        }

        var body = JsonSerializer.Serialize(new { query, variables = variables ?? new Dictionary<string, object>() });
        using var request = new HttpRequestMessage(HttpMethod.Post, XrayGqlUrl)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await Http.SendAsync(request);
        await EnsureSuccessAsync(response, operationName);
        var payload = JsonSerializer.Deserialize<Dictionary<string, object>>(await response.Content.ReadAsStringAsync()) ?? new Dictionary<string, object>();
        if (payload.TryGetValue("errors", out var errors) && errors is not null && !string.IsNullOrWhiteSpace(errors.ToString()))
        {
            throw new InvalidOperationException($"[{operationName}] GraphQL errors: {errors}");
        }

        return payload;
    }

    public static async Task<List<Dictionary<string, object>>> JiraSearchIssuesAsync(string jql, List<string>? fields = null, int pageSize = 50)
    {
        if (string.IsNullOrWhiteSpace(JiraBaseUrl))
        {
            return [];
        }

        var fieldString = string.Join(",", fields is null || fields.Count == 0 ? ["key"] : fields);
        var uri = $"{JiraBaseUrl.TrimEnd('/')}/rest/api/3/search?jql={Uri.EscapeDataString(jql)}&maxResults={pageSize}&fields={Uri.EscapeDataString(fieldString)}";
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        foreach (var header in JiraAuthHeader())
        {
            request.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        using var response = await Http.SendAsync(request);
        await EnsureSuccessAsync(response, "jira-search");
        var payload = JsonSerializer.Deserialize<Dictionary<string, object>>(await response.Content.ReadAsStringAsync()) ?? new Dictionary<string, object>();
        return payload.TryGetValue("issues", out var issues) && issues is JsonElement element && element.ValueKind == JsonValueKind.Array
            ? element.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.Object)
                .Select(item => JsonSerializer.Deserialize<Dictionary<string, object>>(item.GetRawText()) ?? new Dictionary<string, object>())
                .ToList()
            : [];
    }

    public static string NormalizeLabel(string value)
    {
        return Regex.Replace(value ?? string.Empty, @"[^a-zA-Z0-9._-]+", "_").Trim('_').ToLowerInvariant();
    }

    public static List<Dictionary<string, object>> LoadCucumber(string path) => Xray.LoadCucumber(path);

    public static Dictionary<string, object> ExtractLabelsAndTestKeys(string cucumberFile)
    {
        var labels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var jiraKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var testKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var statusCount = new Dictionary<string, int>
        {
            ["passed"] = 0,
            ["failed"] = 0,
            ["skipped"] = 0
        };

        if (!File.Exists(cucumberFile))
        {
            return new Dictionary<string, object>
            {
                ["labels"] = labels.ToList(),
                ["test_count"] = 0,
                ["jira_keys"] = new List<string>(),
                ["status_count"] = statusCount
            };
        }

        foreach (var feature in LoadCucumber(cucumberFile))
        {
            foreach (var element in AsObjectList(feature, "elements"))
            {
                var scenarioFailed = false;
                var scenarioPassed = true;
                foreach (var step in AsObjectList(element, "steps"))
                {
                    var status = AsNestedString(step, "result", "status").ToLowerInvariant();
                    if (status == "failed")
                    {
                        scenarioFailed = true;
                        scenarioPassed = false;
                    }
                    else if (status == "skipped")
                    {
                        scenarioPassed = false;
                    }
                }

                if (scenarioFailed)
                {
                    statusCount["failed"]++;
                }
                else if (scenarioPassed)
                {
                    statusCount["passed"]++;
                }
                else
                {
                    statusCount["skipped"]++;
                }

                foreach (var tag in AsObjectList(element, "tags"))
                {
                    var name = AsString(tag, "name").TrimStart('@').Trim();
                    if (string.IsNullOrWhiteSpace(name))
                    {
                        continue;
                    }

                    if (name.StartsWith("TEST_", StringComparison.Ordinal))
                    {
                        testKeys.Add(name["TEST_".Length..]);
                    }
                    else if (JiraKeyRegex().IsMatch(name))
                    {
                        jiraKeys.Add(name);
                    }
                    else
                    {
                        labels.Add(name);
                    }
                }
            }
        }

        return new Dictionary<string, object>
        {
            ["labels"] = labels.OrderBy(item => item).ToList(),
            ["test_count"] = testKeys.Count,
            ["jira_keys"] = jiraKeys.OrderBy(item => item).ToList(),
            ["status_count"] = statusCount
        };
    }

    public static List<string> ExtractLabelsFromReport(string cucumberPath)
    {
        return ExtractLabelsAndTestKeys(cucumberPath).TryGetValue("labels", out var labels) && labels is List<string> list ? list : [];
    }

    public static Dictionary<string, object> BuildDescriptionAdf(
        List<string> labels,
        int testCount,
        string environment,
        string dateString,
        string? apkVersion = null,
        string? apkBuildRuntime = null)
    {
        var lines = new List<string>
        {
            "Automated test execution summary.",
            string.Empty,
            $"Date: {dateString}",
            $"Environment: {environment}",
            $"Tests executed: {testCount}",
            $"Version: {(!string.IsNullOrWhiteSpace(apkVersion) ? apkVersion : "unknown")}"
        };

        if (!string.IsNullOrWhiteSpace(apkBuildRuntime))
        {
            lines.Add($"Build: {apkBuildRuntime}");
        }

        lines.Add(string.Empty);
        lines.Add($"Labels: {(labels.Count > 0 ? string.Join(", ", labels) : "none")}");
        var text = string.Join('\n', lines);

        return new Dictionary<string, object>
        {
            ["type"] = "doc",
            ["version"] = 1,
            ["content"] = new List<Dictionary<string, object>>
            {
                new()
                {
                    ["type"] = "paragraph",
                    ["content"] = new List<Dictionary<string, object>>
                    {
                        new() { ["type"] = "text", ["text"] = text }
                    }
                }
            }
        };
    }

    public static async Task Main(string[] args)
    {
        var report = Path.GetFullPath(args.Length > 0 ? args[0] : "reports/cucumber.json");
        if (!File.Exists(report))
        {
            Log($"Report not found: {report}");
            return;
        }

        var summary = ExtractLabelsAndTestKeys(report);
        var payload = new Dictionary<string, object>(summary)
        {
            ["report"] = report,
            ["features_dir"] = FeaturesDir,
            ["logs_root"] = LogsRoot,
            ["date"] = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            ["failed_scenarios"] = Xray.SummarizeFailedScenarios(report)
        };

        var output = Path.Combine(Path.GetDirectoryName(report) ?? ".", $"{Path.GetFileNameWithoutExtension(report)}.summary.json");
        await File.WriteAllTextAsync(output, JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true }));
        Log($"Summary written to {output}");
    }

    private static List<Dictionary<string, object>> AsObjectList(Dictionary<string, object> source, string key)
    {
        if (!source.TryGetValue(key, out var value) || value is not JsonElement element || element.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return element.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.Object)
            .Select(item => JsonSerializer.Deserialize<Dictionary<string, object>>(item.GetRawText()) ?? new Dictionary<string, object>())
            .ToList();
    }

    private static string AsString(Dictionary<string, object> source, string key)
    {
        if (!source.TryGetValue(key, out var value) || value is null)
        {
            return string.Empty;
        }

        return value is JsonElement element
            ? element.ValueKind == JsonValueKind.String ? element.GetString() ?? string.Empty : element.ToString()
            : value.ToString() ?? string.Empty;
    }

    private static string AsNestedString(Dictionary<string, object> source, string nestedKey, string finalKey)
    {
        if (!source.TryGetValue(nestedKey, out var nested) || nested is not JsonElement element || element.ValueKind != JsonValueKind.Object)
        {
            return string.Empty;
        }

        var map = JsonSerializer.Deserialize<Dictionary<string, object>>(element.GetRawText()) ?? new Dictionary<string, object>();
        return AsString(map, finalKey);
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
            throw new InvalidOperationException($"[{operation}] HTTP {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }
    }
}
