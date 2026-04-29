using System.Text;
using System.Text.RegularExpressions;

namespace QAItest.Playwright.DotNet.Utils;

public static partial class GherkinSanitizer
{
    [GeneratedRegex(@"(^|\s)@([A-Za-z0-9_:.\-]+)(?=\s|$)", RegexOptions.IgnoreCase)]
    private static partial Regex TagTokenRegex();

    [GeneratedRegex(@"[A-Z][A-Z0-9_-]*-\d+", RegexOptions.IgnoreCase)]
    private static partial Regex IssueKeyRegex();

    public static string NormalizeText(string text)
    {
        var normalized = text.Replace("\r\n", "\n").Replace("\r", "\n");
        if (normalized.StartsWith('\ufeff'))
        {
            normalized = normalized[1..];
        }

        var trimmed = normalized
            .Split('\n')
            .Select(line => line.TrimEnd())
            .ToList();

        while (trimmed.Count > 0 && string.IsNullOrWhiteSpace(trimmed[0]))
        {
            trimmed.RemoveAt(0);
        }

        while (trimmed.Count > 0 && string.IsNullOrWhiteSpace(trimmed[^1]))
        {
            trimmed.RemoveAt(trimmed.Count - 1);
        }

        var compact = new List<string>();
        var previousBlank = false;
        foreach (var line in trimmed)
        {
            var isBlank = string.IsNullOrWhiteSpace(line);
            if (isBlank && previousBlank)
            {
                continue;
            }

            compact.Add(line);
            previousBlank = isBlank;
        }

        return string.Join('\n', compact).Trim() + "\n";
    }

    public static string NormalizeTagNames(string text)
    {
        return TagTokenRegex().Replace(text, match =>
        {
            var prefix = match.Groups[1].Value;
            var tag = match.Groups[2].Value.Replace(':', '_');
            return $"{prefix}@{tag}";
        });
    }

    public static string KeepOnlySelectedTestTag(string text, string? key = null)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return text;
        }

        var selected = key.ToUpperInvariant();
        var output = new List<string>();
        foreach (var line in text.Split('\n'))
        {
            var stripped = line.Trim();
            if (!stripped.StartsWith("@", StringComparison.Ordinal))
            {
                output.Add(line);
                continue;
            }

            var kept = new List<string>();
            foreach (var token in stripped.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
            {
                if (!token.StartsWith("@", StringComparison.Ordinal))
                {
                    kept.Add(token);
                    continue;
                }

                var tagValue = token[1..];
                if (IssueKeyRegex().IsMatch(tagValue))
                {
                    if (string.Equals(tagValue, selected, StringComparison.OrdinalIgnoreCase))
                    {
                        kept.Add($"@{selected}");
                    }
                }
                else
                {
                    kept.Add(token);
                }
            }

            if (kept.Count > 0)
            {
                output.Add(string.Join(" ", kept));
            }
        }

        return string.Join('\n', output);
    }

    public static string SanitizeFeatureText(string text)
    {
        return SanitizeFeatureText(text, null, false, false);
    }

    public static string SanitizeFeatureText(
        string text,
        string? key,
        bool convertOutline = false,
        bool dropFirstScenarioAfterTag = false)
    {
        _ = convertOutline;
        _ = dropFirstScenarioAfterTag;

        var sanitized = NormalizeText(text);
        sanitized = NormalizeTagNames(sanitized);
        sanitized = KeepOnlySelectedTestTag(sanitized, key);
        return NormalizeText(sanitized);
    }
}
