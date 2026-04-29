const fs = require("fs");
const path = require("path");

const TAG_TOKEN_RE = /(^|\s)@([A-Za-z0-9_:.\-]+)(?=\s|$)/gim;

function normalizeText(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\uFEFF/, "");
  const lines = normalized.split("\n").map((line) => line.replace(/\s+$/g, ""));

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length && !lines[lines.length - 1].trim()) {
    lines.pop();
  }

  const compact = [];
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

function normalizeTagNames(text) {
  return String(text || "").replace(TAG_TOKEN_RE, (_match, prefix, tag) => `${prefix}@${tag.replace(/:/g, "_")}`);
}

function keepOnlySelectedTestTag(text, key = "") {
  if (!key) {
    return text;
  }

  const selected = key.toUpperCase();
  const filteredLines = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped.startsWith("@")) {
      filteredLines.push(line);
      continue;
    }

    const keptTokens = [];
    for (const token of stripped.split(/\s+/)) {
      if (!token.startsWith("@")) {
        keptTokens.push(token);
        continue;
      }
      const tagValue = token.slice(1);
      if (/^[A-Z][A-Z0-9_-]*-\d+$/i.test(tagValue)) {
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

function sanitizeFeatureText(text, key = "", convertOutline = false, dropFirstScenarioAfterTag = false) {
  void convertOutline;
  void dropFirstScenarioAfterTag;

  let sanitized = normalizeText(text);
  sanitized = normalizeTagNames(sanitized);
  sanitized = keepOnlySelectedTestTag(sanitized, key);
  return normalizeText(sanitized);
}

function main() {
  const inputFile = process.argv[2];
  const outputIndex = process.argv.indexOf("--output-file");
  const keyIndex = process.argv.indexOf("--key");
  if (!inputFile) {
    throw new Error("Usage: node gherkin_sanitizer.js <input_file> [--output-file path] [--key TEST-1]");
  }
  const outputFile = outputIndex >= 0 ? process.argv[outputIndex + 1] : inputFile;
  const key = keyIndex >= 0 ? process.argv[keyIndex + 1] : "";
  const content = fs.readFileSync(path.resolve(inputFile), "utf8");
  fs.writeFileSync(path.resolve(outputFile), sanitizeFeatureText(content, key), "utf8");
}

if (require.main === module) {
  main();
}

module.exports = {
  normalizeText,
  normalizeTagNames,
  keepOnlySelectedTestTag,
  sanitizeFeatureText
};
