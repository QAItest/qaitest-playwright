using System.Text.Json;
using System.Text.RegularExpressions;

namespace QAItest.Playwright.DotNet.Utils;

public static partial class Xray
{
    [GeneratedRegex(@"\b[A-Z][A-Z0-9_-]*-\d+\b")]
    private static partial Regex KeyRegex();

    [GeneratedRegex(@"[^A-Za-z0-9._\-\[\] ]+")]
    private static partial Regex SafeCharsRegex();

    public static string SafeName(string value)
    {
        var normalized = value.Replace(Path.DirectorySeparatorChar, '-').Replace(Path.AltDirectorySeparatorChar, '-');
        normalized = SafeCharsRegex().Replace(normalized, "-").Trim(' ', '.');
        return string.IsNullOrWhiteSpace(normalized) ? "test" : normalized;
    }

    public static string NormalizeLabel(string value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized) || normalized.StartsWith("test_", StringComparison.Ordinal))
        {
            return string.Empty;
        }

        return Regex.Replace(normalized, @"[^a-z0-9\-_.]", "-");
    }

    public static List<Dictionary<string, object>> LoadCucumber(string path)
    {
        if (!File.Exists(path))
        {
            return [];
        }

        return JsonSerializer.Deserialize<List<Dictionary<string, object>>>(File.ReadAllText(path)) ?? [];
    }

    public static Dictionary<string, List<string>> SummarizeFailedScenarios(string cucumberFile)
    {
        var output = new Dictionary<string, List<string>>();
        foreach (var feature in LoadCucumber(cucumberFile))
        {
            foreach (var element in AsObjectList(feature, "elements"))
            {
                var name = AsString(element, "name").Trim();
                if (string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }

                var failed = AsObjectList(element, "steps")
                    .Select(step => AsNestedString(step, "result", "status").ToLowerInvariant())
                    .Contains("failed");
                if (!failed)
                {
                    continue;
                }

                var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var tag in AsObjectList(element, "tags"))
                {
                    var raw = AsString(tag, "name").TrimStart('@');
                    if (KeyRegex().IsMatch(raw))
                    {
                        keys.Add(raw);
                    }
                    else if (raw.StartsWith("TEST_", StringComparison.Ordinal))
                    {
                        var candidate = raw["TEST_".Length..];
                        if (KeyRegex().IsMatch(candidate))
                        {
                            keys.Add(candidate);
                        }
                    }
                }

                if (keys.Count > 0)
                {
                    output[name] = keys.OrderBy(item => item).ToList();
                }
            }
        }

        return output;
    }

    public static Dictionary<string, object> CollectFeatureInfo(string featuresRoot)
    {
        var labels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var featureFiles = new List<string>();
        if (Directory.Exists(featuresRoot))
        {
            foreach (var path in Directory.EnumerateFiles(featuresRoot, "*.feature", SearchOption.AllDirectories).Order())
            {
                featureFiles.Add(path);
                foreach (var line in File.ReadLines(path))
                {
                    var trimmed = line.Trim();
                    if (!trimmed.StartsWith("@", StringComparison.Ordinal))
                    {
                        continue;
                    }

                    foreach (var token in trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
                    {
                        if (!token.StartsWith("@", StringComparison.Ordinal))
                        {
                            continue;
                        }

                        var normalized = NormalizeLabel(token[1..]);
                        if (!string.IsNullOrWhiteSpace(normalized))
                        {
                            labels.Add(normalized);
                        }
                    }
                }
            }
        }

        return new Dictionary<string, object>
        {
            ["labels"] = labels.OrderBy(item => item).ToList(),
            ["feature_files"] = featureFiles
        };
    }

    private static List<Dictionary<string, object>> AsObjectList(Dictionary<string, object> source, string key)
    {
        if (!source.TryGetValue(key, out var value))
        {
            return [];
        }

        return value switch
        {
            JsonElement element when element.ValueKind == JsonValueKind.Array => element
                .EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.Object)
                .Select(item => JsonSerializer.Deserialize<Dictionary<string, object>>(item.GetRawText()) ?? new Dictionary<string, object>())
                .ToList(),
            IEnumerable<Dictionary<string, object>> list => list.ToList(),
            _ => []
        };
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
        if (!source.TryGetValue(nestedKey, out var nested) || nested is null)
        {
            return string.Empty;
        }

        if (nested is JsonElement element && element.ValueKind == JsonValueKind.Object)
        {
            var map = JsonSerializer.Deserialize<Dictionary<string, object>>(element.GetRawText()) ?? new Dictionary<string, object>();
            return AsString(map, finalKey);
        }

        return nested is Dictionary<string, object> mapValue ? AsString(mapValue, finalKey) : string.Empty;
    }
}
