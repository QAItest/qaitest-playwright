package utils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class GherkinSanitizer {
  private static final Pattern TAG_TOKEN_RE = Pattern.compile("(^|\\s)@([A-Za-z0-9_:.\\-]+)(?=\\s|$)", Pattern.CASE_INSENSITIVE);
  private static final Pattern ISSUE_KEY_RE = Pattern.compile("[A-Z][A-Z0-9_-]*-\\d+", Pattern.CASE_INSENSITIVE);

  private GherkinSanitizer() {}

  public static String normalizeText(String text) {
    String normalized = text.replace("\r\n", "\n").replace("\r", "\n");
    if (normalized.startsWith("\ufeff")) {
      normalized = normalized.substring(1);
    }

    String[] rawLines = normalized.split("\n", -1);
    List<String> trimmed = new ArrayList<>();
    for (String line : rawLines) {
      trimmed.add(rstrip(line));
    }

    while (!trimmed.isEmpty() && trimmed.get(0).isBlank()) {
      trimmed.remove(0);
    }
    while (!trimmed.isEmpty() && trimmed.get(trimmed.size() - 1).isBlank()) {
      trimmed.remove(trimmed.size() - 1);
    }

    List<String> compact = new ArrayList<>();
    boolean previousBlank = false;
    for (String line : trimmed) {
      boolean isBlank = line.isBlank();
      if (isBlank && previousBlank) {
        continue;
      }
      compact.add(line);
      previousBlank = isBlank;
    }

    return String.join("\n", compact).strip() + "\n";
  }

  public static String normalizeTagNames(String text) {
    Matcher matcher = TAG_TOKEN_RE.matcher(text);
    StringBuffer output = new StringBuffer();
    while (matcher.find()) {
      String prefix = matcher.group(1);
      String tag = matcher.group(2).replace(':', '_');
      matcher.appendReplacement(output, Matcher.quoteReplacement(prefix + "@" + tag));
    }
    matcher.appendTail(output);
    return output.toString();
  }

  public static String keepOnlySelectedTestTag(String text, String key) {
    if (key == null || key.isBlank()) {
      return text;
    }

    String selected = key.toUpperCase();
    List<String> filtered = new ArrayList<>();
    for (String line : text.split("\n", -1)) {
      String stripped = line.trim();
      if (!stripped.startsWith("@")) {
        filtered.add(line);
        continue;
      }

      List<String> kept = new ArrayList<>();
      for (String token : stripped.split("\\s+")) {
        if (!token.startsWith("@")) {
          kept.add(token);
          continue;
        }
        String tagValue = token.substring(1);
        if (ISSUE_KEY_RE.matcher(tagValue).matches()) {
          if (tagValue.equalsIgnoreCase(selected)) {
            kept.add("@" + selected);
          }
        } else {
          kept.add(token);
        }
      }

      if (!kept.isEmpty()) {
        filtered.add(String.join(" ", kept));
      }
    }
    return String.join("\n", filtered);
  }

  public static String sanitizeFeatureText(String text) {
    return sanitizeFeatureText(text, null, false, false);
  }

  public static String sanitizeFeatureText(String text, String key, boolean convertOutline, boolean dropFirstScenarioAfterTag) {
    String sanitized = normalizeText(text);
    sanitized = normalizeTagNames(sanitized);
    sanitized = keepOnlySelectedTestTag(sanitized, key);
    return normalizeText(sanitized);
  }

  public static void main(String[] args) throws IOException {
    if (args.length == 0) {
      throw new IllegalArgumentException("Usage: GherkinSanitizer <input.feature> [output.feature] [key]");
    }
    Path inputPath = Path.of(args[0]).toAbsolutePath();
    Path outputPath = args.length > 1 ? Path.of(args[1]).toAbsolutePath() : inputPath;
    String key = args.length > 2 ? args[2] : null;
    String content = Files.readString(inputPath, StandardCharsets.UTF_8);
    Files.writeString(outputPath, sanitizeFeatureText(content, key, false, false), StandardCharsets.UTF_8);
  }

  private static String rstrip(String value) {
    return value.replaceFirst("\\s+$", "");
  }
}
