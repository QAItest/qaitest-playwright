const TAG_TOKEN_RE = /(^|\s)@([A-Za-z0-9_:.\-]+)(?=\s|$)/gim;
const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_-]*-\d+$/i;

export function normalizeText(text: string): string {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\uFEFF/, "");
  const lines = normalized.split("\n").map((line) => line.replace(/\s+$/g, ""));

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length && !lines[lines.length - 1].trim()) {
    lines.pop();
  }

  const compact: string[] = [];
  let previousBlank = false;
  for (const line of lines) {
    const isBlank = !line.trim();
    if (isBlank && previousBlank) {
      continue;
    }
    compact.push(line);
    previousBlank = isBlank;
  }

  return `${compact.join("\n").trim()}\n`;
}

export function normalizeTagNames(text: string): string {
  return String(text || "").replace(TAG_TOKEN_RE, (_match, prefix: string, tag: string) => `${prefix}@${tag.replace(/:/g, "_")}`);
}

export function keepOnlySelectedTestTag(text: string, key = ""): string {
  if (!key) {
    return text;
  }

  const selected = key.toUpperCase();
  const filteredLines: string[] = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped.startsWith("@")) {
      filteredLines.push(line);
      continue;
    }

    const keptTokens: string[] = [];
    for (const token of stripped.split(/\s+/)) {
      if (!token.startsWith("@")) {
        keptTokens.push(token);
        continue;
      }

      const tagValue = token.slice(1);
      if (ISSUE_KEY_RE.test(tagValue)) {
        if (tagValue.toUpperCase() === selected) {
          keptTokens.push(`@${selected}`);
        }
      } else {
        keptTokens.push(token);
      }
    }

    if (keptTokens.length) {
      filteredLines.push(keptTokens.join(" "));
    }
  }

  return filteredLines.join("\n");
}

export function sanitizeFeatureText(
  text: string,
  key = "",
  convertOutline = false,
  dropFirstScenarioAfterTag = false
): string {
  void convertOutline;
  void dropFirstScenarioAfterTag;

  let sanitized = normalizeText(text);
  sanitized = normalizeTagNames(sanitized);
  sanitized = keepOnlySelectedTestTag(sanitized, key);
  return normalizeText(sanitized);
}
