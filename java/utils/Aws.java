package utils;

import java.io.IOException;
import java.util.Map;

public final class Aws {
  private Aws() {}

  public static Map<String, Object> getSecretDict(String secretId) throws IOException {
    return SecretLoader.getSecretDict(secretId);
  }
}
