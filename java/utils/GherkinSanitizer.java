package utils;

public final class GherkinSanitizer {
  private GherkinSanitizer() {}

  public static String sanitizeFeatureText(String text) {
    return text.replace("\r\n", "\n").replace("\r", "\n").replace("@env:", "@env_").trim() + "\n";
  }
}
