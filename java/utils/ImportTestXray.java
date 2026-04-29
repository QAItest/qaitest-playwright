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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public final class ImportTestXray {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
  private static final Pattern JIRA_KEY_RE = Pattern.compile("[A-Z]{2,}-\\d+");

  public static final String SECRET_ID_XRAY = env("TEST_MGMT_SECRET_ID");
  public static final String SECRET_ID_JIRA = env("ISSUE_TRACKER_SECRET_ID");
  public static final String XRAY_BASE_URL = env("TEST_MGMT_BASE_URL");
  public static final String XRAY_GQL_URL = env("TEST_MGMT_GRAPHQL_URL");
  public static final String JIRA_BASE_URL = env("ISSUE_TRACKER_BASE_URL");
  public static final String FEATURES_DIR = firstNonBlank(env("FEATURES_DIR"), "tests/features");
  public static final String LOGS_ROOT = firstNonBlank(env("LOGS_ROOT"), "logs");

  private ImportTestXray() {}

  public static void log(String message) {
    System.out.println(message);
  }

  public static Map<String, String> jiraAuthHeader() throws IOException {
    Map<String, Object> jiraCreds = SECRET_ID_JIRA.isBlank() ? Map.of() : Aws.getSecretDict(SECRET_ID_JIRA);
    String email = firstNonBlank(env("ISSUE_TRACKER_EMAIL"), firstNonBlank(env("JIRA_EMAIL"),
        firstNonBlank(asString(jiraCreds.get("email")), asString(jiraCreds.get("JIRA_EMAIL")))));
    String token = firstNonBlank(env("ISSUE_TRACKER_TOKEN"), firstNonBlank(env("JIRA_TOKEN"),
        firstNonBlank(asString(jiraCreds.get("token")), asString(jiraCreds.get("JIRA_TOKEN")))));
    if (email.isBlank() || token.isBlank()) {
      throw new IOException("Missing issue tracker credentials (email/token).");
    }
    String encoded = Base64.getEncoder().encodeToString((email + ":" + token).getBytes(StandardCharsets.UTF_8));
    return Map.of("Authorization", "Basic " + encoded);
  }

  public static String getXrayToken() throws IOException, InterruptedException {
    if (XRAY_BASE_URL.isBlank()) {
      return "";
    }
    Map<String, Object> xrayCreds = SECRET_ID_XRAY.isBlank() ? Map.of() : Aws.getSecretDict(SECRET_ID_XRAY);
    String clientId = firstNonBlank(env("TEST_MGMT_CLIENT_ID"),
        firstNonBlank(asString(xrayCreds.get("client_id")), asString(xrayCreds.get("XRAY_CLIENT_ID"))));
    String clientSecret = firstNonBlank(env("TEST_MGMT_CLIENT_SECRET"),
        firstNonBlank(asString(xrayCreds.get("client_secret")), asString(xrayCreds.get("XRAY_CLIENT_SECRET"))));
    if (clientId.isBlank() || clientSecret.isBlank()) {
      throw new IOException("Missing test management credentials.");
    }

    String body = MAPPER.writeValueAsString(Map.of("client_id", clientId, "client_secret", clientSecret));
    HttpRequest request = HttpRequest.newBuilder(URI.create(XRAY_BASE_URL.replaceAll("/+$", "") + "/authenticate"))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    ensureSuccess(response, "xray-auth");
    return response.body().trim().replace("\"", "");
  }

  public static Map<String, Object> postXrayGraphql(String token, String query, Map<String, Object> variables, String operationName)
      throws IOException, InterruptedException {
    if (XRAY_GQL_URL.isBlank()) {
      throw new IOException("TEST_MGMT_GRAPHQL_URL is not configured.");
    }
    String body = MAPPER.writeValueAsString(Map.of("query", query, "variables", variables == null ? Map.of() : variables));
    HttpRequest request = HttpRequest.newBuilder(URI.create(XRAY_GQL_URL))
        .header("Authorization", "Bearer " + token)
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    ensureSuccess(response, operationName);
    Map<String, Object> payload = MAPPER.readValue(response.body(), MAP_TYPE);
    Object errors = payload.get("errors");
    if (errors instanceof List<?> list && !list.isEmpty()) {
      throw new IOException("[" + operationName + "] GraphQL errors: " + list);
    }
    return payload;
  }

  public static List<Map<String, Object>> jiraSearchIssues(String jql, List<String> fields, int pageSize)
      throws IOException, InterruptedException {
    if (JIRA_BASE_URL.isBlank()) {
      return List.of();
    }
    String fieldString = String.join(",", fields == null || fields.isEmpty() ? List.of("key") : fields);
    String url = JIRA_BASE_URL.replaceAll("/+$", "") + "/rest/api/3/search?jql=" + uriEncode(jql)
        + "&maxResults=" + pageSize + "&fields=" + uriEncode(fieldString);
    HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .GET();
    for (Map.Entry<String, String> header : jiraAuthHeader().entrySet()) {
      builder.header(header.getKey(), header.getValue());
    }
    HttpResponse<String> response = HTTP.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    ensureSuccess(response, "jira-search");
    Map<String, Object> payload = MAPPER.readValue(response.body(), MAP_TYPE);
    return asList(payload.get("issues"));
  }

  public static String normalizeLabel(String value) {
    return value == null ? "" : value.replaceAll("[^a-zA-Z0-9._-]+", "_").replaceAll("^_+|_+$", "").toLowerCase();
  }

  public static List<Map<String, Object>> loadCucumber(Path path) throws IOException {
    return Xray.loadCucumber(path);
  }

  public static Map<String, Object> extractLabelsAndTestKeys(Path cucumberFile) throws IOException {
    List<String> labels = new ArrayList<>();
    LinkedHashSet<String> jiraKeys = new LinkedHashSet<>();
    LinkedHashSet<String> testKeys = new LinkedHashSet<>();
    Map<String, Integer> statusCount = new LinkedHashMap<>();
    statusCount.put("passed", 0);
    statusCount.put("failed", 0);
    statusCount.put("skipped", 0);

    if (!Files.exists(cucumberFile)) {
      return Map.of("labels", labels, "test_count", 0, "jira_keys", List.of(), "status_count", statusCount);
    }

    for (Map<String, Object> feature : loadCucumber(cucumberFile)) {
      for (Map<String, Object> element : asList(feature.get("elements"))) {
        boolean scenarioFailed = false;
        boolean scenarioPassed = true;
        for (Map<String, Object> step : asList(element.get("steps"))) {
          String status = asString(asMap(step.get("result")).get("status")).toLowerCase();
          if ("failed".equals(status)) {
            scenarioFailed = true;
            scenarioPassed = false;
          } else if ("skipped".equals(status)) {
            scenarioPassed = false;
          }
        }
        if (scenarioFailed) {
          statusCount.put("failed", statusCount.get("failed") + 1);
        } else if (scenarioPassed) {
          statusCount.put("passed", statusCount.get("passed") + 1);
        } else {
          statusCount.put("skipped", statusCount.get("skipped") + 1);
        }

        for (Map<String, Object> tag : asList(element.get("tags"))) {
          String name = asString(tag.get("name")).replaceFirst("^@", "").trim();
          if (name.isBlank()) {
            continue;
          }
          if (name.startsWith("TEST_")) {
            testKeys.add(name.substring("TEST_".length()));
          } else if (JIRA_KEY_RE.matcher(name).matches()) {
            jiraKeys.add(name);
          } else {
            labels.add(name);
          }
        }
      }
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("labels", new ArrayList<>(new LinkedHashSet<>(labels)));
    payload.put("test_count", testKeys.size());
    payload.put("jira_keys", new ArrayList<>(jiraKeys));
    payload.put("status_count", statusCount);
    return payload;
  }

  public static List<String> extractLabelsFromReport(Path cucumberPath) throws IOException {
    Object labels = extractLabelsAndTestKeys(cucumberPath).get("labels");
    return labels instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of();
  }

  public static Map<String, Object> buildDescriptionAdf(
      List<String> labels, int testCount, String envName, String dateStr, String apkVersion, String apkBuildRuntime) {
    List<String> lines = new ArrayList<>();
    lines.add("Automated test execution summary.");
    lines.add("");
    lines.add("Date: " + dateStr);
    lines.add("Environment: " + envName);
    lines.add("Tests executed: " + testCount);
    lines.add("Version: " + (apkVersion == null || apkVersion.isBlank() ? "unknown" : apkVersion));
    if (apkBuildRuntime != null && !apkBuildRuntime.isBlank()) {
      lines.add("Build: " + apkBuildRuntime);
    }
    lines.add("");
    lines.add("Labels: " + (labels == null || labels.isEmpty() ? "none" : String.join(", ", labels)));
    String text = String.join("\n", lines);

    return Map.of(
        "type", "doc",
        "version", 1,
        "content", List.of(Map.of(
            "type", "paragraph",
            "content", List.of(Map.of("type", "text", "text", text))
        ))
    );
  }

  public static void main(String[] args) throws IOException {
    Path report = Path.of(args.length > 0 ? args[0] : "reports/cucumber.json").toAbsolutePath();
    if (!Files.exists(report)) {
      log("Report not found: " + report);
      return;
    }

    Map<String, Object> summary = extractLabelsAndTestKeys(report);
    Map<String, List<String>> failed = Xray.summarizeFailedScenarios(report);
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("report", report.toString());
    payload.put("features_dir", FEATURES_DIR);
    payload.put("logs_root", LOGS_ROOT);
    payload.put("date", LocalDate.now().toString());
    payload.putAll(summary);
    payload.put("failed_scenarios", failed);

    Path output = report.resolveSibling(report.getFileName().toString().replaceFirst("\\.json$", ".summary.json"));
    Files.writeString(output, MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload), StandardCharsets.UTF_8);
    log("Summary written to " + output);
  }

  private static void ensureSuccess(HttpResponse<String> response, String operation) throws IOException {
    if (response.statusCode() >= 400) {
      throw new IOException("[" + operation + "] HTTP " + response.statusCode() + ": " + response.body());
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

  private static String asString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private static String env(String key) {
    return System.getenv().getOrDefault(key, "").trim();
  }

  private static String firstNonBlank(String first, String second) {
    return first != null && !first.isBlank() ? first : (second == null ? "" : second);
  }

  private static String uriEncode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
