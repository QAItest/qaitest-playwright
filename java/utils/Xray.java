package utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

public final class Xray {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final TypeReference<List<Map<String, Object>>> FEATURE_LIST = new TypeReference<>() {};
  private static final Pattern KEY_RE = Pattern.compile("\\b[A-Z][A-Z0-9_-]*-\\d+\\b");
  private static final Pattern SAFE_CHARS_RE = Pattern.compile("[^A-Za-z0-9._\\-\\[\\] ]+");

  private Xray() {}

  public static String safeName(String value) {
    String normalized = value.replace("\\", "-").replace("/", "-");
    normalized = SAFE_CHARS_RE.matcher(normalized).replaceAll("-").trim();
    normalized = normalized.replaceAll("^[ .]+|[ .]+$", "");
    return normalized.isBlank() ? "test" : normalized;
  }

  public static String normalizeLabel(String value) {
    String normalized = value == null ? "" : value.trim().toLowerCase();
    if (normalized.isBlank() || normalized.startsWith("test_")) {
      return "";
    }
    return normalized.replaceAll("[^a-z0-9\\-_.]", "-");
  }

  public static List<Map<String, Object>> loadCucumber(Path path) throws IOException {
    if (!Files.exists(path)) {
      return List.of();
    }
    return MAPPER.readValue(Files.readString(path), FEATURE_LIST);
  }

  public static Map<String, List<String>> summarizeFailedScenarios(Path cucumberFile) throws IOException {
    Map<String, List<String>> output = new LinkedHashMap<>();
    for (Map<String, Object> feature : loadCucumber(cucumberFile)) {
      for (Map<String, Object> element : asList(feature.get("elements"))) {
        String name = asString(element.get("name")).trim();
        if (name.isBlank()) {
          continue;
        }

        boolean failed = false;
        for (Map<String, Object> step : asList(element.get("steps"))) {
          String status = asString(asMap(step.get("result")).get("status")).toLowerCase();
          if ("failed".equals(status)) {
            failed = true;
            break;
          }
        }
        if (!failed) {
          continue;
        }

        Set<String> keys = new LinkedHashSet<>();
        for (Map<String, Object> tag : asList(element.get("tags"))) {
          String raw = asString(tag.get("name")).replaceFirst("^@", "");
          if (KEY_RE.matcher(raw).matches()) {
            keys.add(raw);
          } else if (raw.startsWith("TEST_")) {
            String candidate = raw.substring("TEST_".length());
            if (KEY_RE.matcher(candidate).matches()) {
              keys.add(candidate);
            }
          }
        }
        if (!keys.isEmpty()) {
          output.put(name, new ArrayList<>(keys));
        }
      }
    }
    return output;
  }

  public static Map<String, Object> collectFeatureInfo(Path featuresRoot) throws IOException {
    List<String> labels = new ArrayList<>();
    List<String> featureFiles = new ArrayList<>();
    if (Files.exists(featuresRoot)) {
      try (var stream = Files.walk(featuresRoot)) {
        stream.filter(path -> path.toString().endsWith(".feature")).sorted().forEach(path -> {
          featureFiles.add(path.toString());
          try {
            String text = Files.readString(path);
            for (String line : text.split("\n")) {
              String trimmed = line.trim();
              if (!trimmed.startsWith("@")) {
                continue;
              }
              for (String token : trimmed.split("\\s+")) {
                if (!token.startsWith("@")) {
                  continue;
                }
                String normalized = normalizeLabel(token.substring(1));
                if (!normalized.isBlank()) {
                  labels.add(normalized);
                }
              }
            }
          } catch (IOException ignored) {
          }
        });
      }
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("labels", new ArrayList<>(new LinkedHashSet<>(labels)));
    payload.put("feature_files", featureFiles);
    return payload;
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> asList(Object value) {
    return value instanceof List<?> list ? (List<Map<String, Object>>) (List<?>) list : List.of();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
  }

  private static String asString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}
