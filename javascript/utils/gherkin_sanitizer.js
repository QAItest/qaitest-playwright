function normalizeText(text) {
  return `${text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()}\n`;
}

function sanitizeFeatureText(text, key = "") {
  const normalized = normalizeText(text).replace(/@env:/g, "@env_");
  if (!key) {
    return normalized;
  }
  return normalized
    .split("\n")
    .map((line) => {
      if (!line.trim().startsWith("@")) {
        return line;
      }
      return line
        .split(/\s+/)
        .filter((token) => !/^@[A-Z][A-Z0-9_-]*-\d+$/i.test(token) || token.toUpperCase() === `@${key.toUpperCase()}`)
        .join(" ");
    })
    .join("\n");
}

module.exports = { normalizeText, sanitizeFeatureText };
