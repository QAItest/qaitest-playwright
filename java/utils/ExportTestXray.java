package utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public final class ExportTestXray {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
  private static final Pattern ISSUE_KEY_RE = Pattern.compile("[A-Z][A-Z0-9_]+-\\d+");
  private static final List<String> IGNORED_FOR_FOLDER = List.of("cucumber", "env:appium", "env_appium");

  public static final String SECRET_ID = env("TEST_MANAGEMENT_SECRET_ID");
  public static final String XRAY_PROJECT_KEY = firstNonBlank(env("XRAY_PROJECT_KEY"), env("TEST_PROJECT_KEY"));
  public static final String AUTH_URL = env("TEST_MGMT_AUTH_URL");
  public static final String GRAPHQL_URL = env("TEST_MGMT_GRAPHQL_URL");
  public static final String EXPORT_URL = env("TEST_MGMT_EXPORT_URL");
  public static final Path OUTPUT_DIR = Path.of(firstNonBlank(env("FEATURE_OUTPUT_DIR"), "tests/features"));

  private ExportTestXray() {}

  public static Map<String, String> loadCredentials() throws IOException {
    if (!SECRET_ID.isBlank()) {
      Map<String, Object> raw = Aws.getSecretDict(SECRET_ID);
      Map<String, String> creds = new LinkedHashMap<>();
      for (Map.Entry<String, Object> entry : raw.entrySet()) {
        creds.put(entry.getKey(), String.valueOf(entry.getValue()));
      }
      return creds;
    }

    Map<String, String> creds = new LinkedHashMap<>();
    for (String key : List.of("TEST_MGMT_CLIENT_ID", "TEST_MGMT_CLIENT_SECRET", "XRAY_CLIENT_ID", "XRAY_CLIENT_SECRET")) {
      String value = env(key);
      if (!value.isBlank()) {
        creds.put(key, value);
      }
    }
    return creds;
  }

  public static String getToken() throws IOException, InterruptedException {
    if (AUTH_URL.isBlank()) {
      return "";
    }
    Map<String, String> creds = loadCredentials();
    String clientId = firstNonBlank(creds.get("TEST_MGMT_CLIENT_ID"), creds.get("XRAY_CLIENT_ID"));
    String clientSecret = firstNonBlank(creds.get("TEST_MGMT_CLIENT_SECRET"), creds.get("XRAY_CLIENT_SECRET"));
    if (clientId.isBlank() || clientSecret.isBlank()) {
      throw new IOException("Missing client credentials for remote export authentication.");
    }

    String body = MAPPER.writeValueAsString(Map.of("client_id", clientId, "client_secret", clientSecret));
    HttpRequest request = HttpRequest.newBuilder(URI.create(AUTH_URL))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    ensureSuccess(response, "authentication");
    return response.body().trim().replace("\"", "");
  }

  public static Map<String, Object> graphql(String token, String query, Map<String, Object> variables)
      throws IOException, InterruptedException {
    if (GRAPHQL_URL.isBlank()) {
      throw new IOException("TEST_MGMT_GRAPHQL_URL is not configured.");
    }
    String body = MAPPER.writeValueAsString(Map.of("query", query, "variables", variables));
    HttpRequest request = HttpRequest.newBuilder(URI.create(GRAPHQL_URL))
        .header("Authorization", "Bearer " + token)
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    ensureSuccess(response, "graphql");
    Map<String, Object> payload = MAPPER.readValue(response.body(), MAP_TYPE);
    Object errors = payload.get("errors");
    if (errors instanceof List<?> list && !list.isEmpty()) {
      throw new IOException("GraphQL errors: " + list);
    }
    return asMap(payload.get("data"));
  }

  public static String getProjectId(String token, String projectKey) throws IOException, InterruptedException {
    String query = "query($key:String!){ getProjectSettings(projectIdOrKey:$key){ projectId }}";
    Map<String, Object> data = graphql(token, query, Map.of("key", projectKey));
    return asString(asMap(data.get("getProjectSettings")).get("projectId"));
  }

  public static Map<String, List<String>> listGherkinKeys(String token, String projectId) throws IOException, InterruptedException {
    String query = "query($projectId:String,$limit:Int!, $start:Int, $tt: TestTypeInput){"
        + " getTests(projectId:$projectId, testType:$tt, limit:$limit, start:$start){"
        + " total start limit results { jira(fields:[\"key\",\"labels\"]) }}}";

    Map<String, List<String>> mapping = new LinkedHashMap<>();
    int start = 0;
    int limit = 100;

    while (true) {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("projectId", projectId);
      payload.put("limit", limit);
      payload.put("start", start);
      payload.put("tt", Map.of("kind", "Gherkin"));

      Map<String, Object> data = graphql(token, query, payload);
      Map<String, Object> tests = asMap(data.get("getTests"));
      for (Map<String, Object> testItem : asList(tests.get("results"))) {
        Map<String, Object> jira = asMap(testItem.get("jira"));
        Map<String, Object> fields = asMap(jira.get("fields"));
        String key = firstNonBlank(asString(jira.get("key")), asString(fields.get("key")));
        if (key.isBlank()) {
          continue;
        }

        LinkedHashSet<String> labels = new LinkedHashSet<>();
        for (Object label : asRawList(firstNonBlankObject(jira.get("labels"), fields.get("labels")))) {
          if (label != null) {
            labels.add(String.valueOf(label));
          }
        }
        mapping.put(key, new ArrayList<>(labels));
      }

      start = ((Number) tests.getOrDefault("start", 0)).intValue() + asList(tests.get("results")).size();
      int total = ((Number) tests.getOrDefault("total", start)).intValue();
      if (start >= total) {
        break;
      }
    }

    return mapping;
  }

  public static boolean hasEnvAppium(List<String> labels) {
    for (String label : labels) {
      if ("env:appium".equalsIgnoreCase(label) || "env_appium".equalsIgnoreCase(label)) {
        return true;
      }
    }
    return false;
  }

  public static boolean hasEnvAppiumAndDomain(List<String> labels, List<String> domains) {
    boolean hasAppium = hasEnvAppium(labels);
    boolean hasDomain = false;
    for (String label : labels) {
      for (String domain : domains) {
        String normalized = domain.toLowerCase();
        if (label.equalsIgnoreCase(normalized)
            || label.equalsIgnoreCase("domain:" + normalized)
            || label.equalsIgnoreCase("domain_" + normalized)) {
          hasDomain = true;
          break;
        }
      }
    }
    return hasAppium && hasDomain;
  }

  public static String pickFunctionalLabel(List<String> labels) {
    for (String label : labels) {
      if (label == null || label.isBlank()) {
        continue;
      }
      if (IGNORED_FOR_FOLDER.contains(label.toLowerCase())) {
        continue;
      }
      return sanitizeSegment(label);
    }
    return "unlabeled";
  }

  public static List<Path> exportFeatures(String token, List<String> keys, Map<String, List<String>> labelsByKey)
      throws IOException, InterruptedException {
    Files.createDirectories(OUTPUT_DIR);
    List<Path> writtenPaths = new ArrayList<>();
    String localSource = env("FEATURE_SOURCE_PATH");

    Map<String, List<String>> grouped = new LinkedHashMap<>();
    for (String key : keys) {
      String label = pickFunctionalLabel(labelsByKey.getOrDefault(key, List.of()));
      grouped.computeIfAbsent(label, unused -> new ArrayList<>()).add(key);
    }

    for (Map.Entry<String, List<String>> entry : grouped.entrySet()) {
      Path outDir = OUTPUT_DIR.resolve(entry.getKey());
      Files.createDirectories(outDir);

      for (String key : entry.getValue()) {
        String raw = fetchOneFeature(token, key, localSource);
        if (raw == null || raw.isBlank()) {
          continue;
        }
        String sanitized = GherkinSanitizer.sanitizeFeatureText(raw, key, false, true);
        Path outPath = outDir.resolve(key + ".feature");
        Files.writeString(outPath, sanitized, StandardCharsets.UTF_8);
        writtenPaths.add(outPath);
      }
    }
    return writtenPaths;
  }

  public static List<String> parseKeysArg(String value) {
    List<String> keys = new ArrayList<>();
    for (String part : value.trim().split("[,\\s;]+")) {
      String candidate = part.trim().toUpperCase();
      if (ISSUE_KEY_RE.matcher(candidate).matches()) {
        keys.add(candidate);
      }
    }
    return keys;
  }

  public static List<String> readKeysFile(Path path) throws IOException {
    List<String> keys = new ArrayList<>();
    for (String line : Files.readAllLines(path, StandardCharsets.UTF_8)) {
      String trimmed = line.trim();
      if (trimmed.isBlank() || trimmed.startsWith("#")) {
        continue;
      }
      keys.addAll(parseKeysArg(trimmed));
    }
    return new ArrayList<>(new LinkedHashSet<>(keys));
  }

  private static String fetchOneFeature(String token, String key, String localSource) throws IOException, InterruptedException {
    if (!localSource.isBlank()) {
      Path sourcePath = Path.of(localSource).toAbsolutePath();
      if (Files.isDirectory(sourcePath)) {
        try (var stream = Files.walk(sourcePath)) {
          for (Path path : stream.filter(item -> item.toString().endsWith(".feature")).sorted().toList()) {
            String stem = path.getFileName().toString().replaceFirst("\\.feature$", "");
            if (stem.equalsIgnoreCase(key)) {
              return Files.readString(path, StandardCharsets.UTF_8);
            }
          }
        }
      }
      return null;
    }

    if (EXPORT_URL.isBlank()) {
      throw new IOException("No feature source configured. Set FEATURE_SOURCE_PATH or TEST_MGMT_EXPORT_URL.");
    }

    String url = EXPORT_URL + "?keys=" + URLEncoder.encode(key, StandardCharsets.UTF_8);
    HttpRequest request = HttpRequest.newBuilder(URI.create(url))
        .header("Authorization", token.isBlank() ? "" : "Bearer " + token)
        .GET()
        .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    ensureSuccess(response, "feature export");
    return response.body();
  }

  private static String sanitizeSegment(String value) {
    String output = value == null ? "" : value.replaceAll("[^A-Za-z0-9._-]+", "_");
    output = output.replaceAll("^[._-]+|[._-]+$", "");
    return output.isBlank() ? "unlabeled" : output;
  }

  private static void ensureSuccess(HttpResponse<String> response, String operation) throws IOException {
    if (response.statusCode() >= 400) {
      throw new IOException("Failed " + operation + ": HTTP " + response.statusCode() + " -> " + response.body());
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> asList(Object value) {
    return value instanceof List<?> list ? (List<Map<String, Object>>) (List<?>) list : List.of();
  }

  @SuppressWarnings("unchecked")
  private static List<Object> asRawList(Object value) {
    return value instanceof List<?> list ? (List<Object>) list : List.of();
  }

  private static Object firstNonBlankObject(Object first, Object second) {
    if (first instanceof List<?> list && !list.isEmpty()) {
      return first;
    }
    return second;
  }

  private static String asString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private static String env(String key) {
    return System.getenv().getOrDefault(key, "").trim();
  }

  private static String firstNonBlank(String first, String second) {
    return first != null && !first.isBlank() ? first : (second == null ? "" : second);
  }
}
