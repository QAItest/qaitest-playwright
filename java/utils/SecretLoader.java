package utils;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.Map;

public final class SecretLoader {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private SecretLoader() {}

  public static Map<String, Object> getSecretMap(String secretId) throws IOException {
    if (secretId.startsWith("env:")) {
      String env = System.getenv(secretId.substring(4));
      return env == null || env.isBlank() ? Collections.emptyMap() : MAPPER.readValue(env, Map.class);
    }
    if (secretId.startsWith("file:")) {
      Path path = Path.of(secretId.substring(5)).toAbsolutePath();
      return Files.exists(path) ? MAPPER.readValue(Files.readString(path), Map.class) : Collections.emptyMap();
    }
    String env = System.getenv(secretId);
    if (env != null && !env.isBlank()) {
      return MAPPER.readValue(env, Map.class);
    }
    Path path = Path.of(secretId).toAbsolutePath();
    return Files.exists(path) ? MAPPER.readValue(Files.readString(path), Map.class) : Collections.emptyMap();
  }
}
