package utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

public final class SecretLoader {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  private SecretLoader() {}

  public static Map<String, Object> getSecretMap(String secretId) throws IOException {
    if (secretId.startsWith("env:")) {
      String env = System.getenv(secretId.substring(4));
      if (env == null || env.isBlank()) {
        throw new IOException("Environment variable is empty or undefined: " + secretId.substring(4));
      }
      return parse(env);
    }
    if (secretId.startsWith("file:")) {
      Path path = Path.of(secretId.substring(5)).toAbsolutePath();
      if (!Files.exists(path)) {
        throw new IOException("Secret file not found: " + path);
      }
      return parse(Files.readString(path));
    }
    String env = System.getenv(secretId);
    if (env != null && !env.isBlank()) {
      return parse(env);
    }
    Path path = Path.of(secretId).toAbsolutePath();
    if (Files.exists(path)) {
      return parse(Files.readString(path));
    }
    throw new IOException("Secret could not be resolved from env or file: " + secretId);
  }

  public static Map<String, Object> getSecretDict(String secretId) throws IOException {
    return getSecretMap(secretId);
  }

  private static Map<String, Object> parse(String raw) throws IOException {
    return MAPPER.readValue(raw, MAP_TYPE);
  }
}
