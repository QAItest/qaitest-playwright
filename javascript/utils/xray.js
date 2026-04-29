const fs = require("fs");
const path = require("path");

const SAFE_CHARS_RE = /[^A-Za-z0-9._\-[\] ]+/g;
const KEY_RE = /\b[A-Z][A-Z0-9_-]*-\d+\b/g;
const TAG_LINE_RE = /^\s*@([^\n\r#]+)/gm;
const HEADER_KV_RE = /^\s*#\s*(ID|Title|Case ID|Section Hierarchy)\s*:\s*(.+?)\s*$/gm;

function safeName(value) {
  return String(value || "").replace(/[\\/]/g, "-").replace(SAFE_CHARS_RE, "-").replace(/^[ .]+|[ .]+$/g, "") || "test";
}

function normalizeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized.startsWith("test_")) {
    return "";
  }
  return normalized.replace(/[^a-z0-9\-_.]/g, "-").slice(0, 255);
}

function loadCucumber(cucumberFile) {
  if (!fs.existsSync(cucumberFile)) {
    return [];
  }
  const data = JSON.parse(fs.readFileSync(cucumberFile, "utf8"));
  return Array.isArray(data) ? data : [];
}

function summarizeFailedScenarios(cucumberFile) {
  const data = loadCucumber(cucumberFile);
  const output = {};

  for (const feature of data) {
    for (const element of feature.elements || []) {
      const name = String(element.name || "").trim();
      if (!name) {
        continue;
      }
      const statuses = (element.steps || []).map((step) => String((step.result || {}).status || "").toLowerCase());
      if (!statuses.includes("failed")) {
        continue;
      }
      const tags = (element.tags || []).map((tag) => String(tag.name || "").replace(/^@/, ""));
      const keys = [];
      for (const tag of tags) {
        const exact = tag.match(/^[A-Z][A-Z0-9_-]*-\d+$/) ? [tag] : [];
        const extracted = tag.startsWith("TEST_") && /^[A-Z][A-Z0-9_-]*-\d+$/.test(tag.slice(5)) ? [tag.slice(5)] : [];
        keys.push(...exact, ...extracted);
      }
      if (keys.length) {
        output[name] = Array.from(new Set(keys)).sort();
      }
    }
  }

  return output;
}

function collectFeatureInfo(featureRoot) {
  const labels = new Set();
  const meta = {};
  const chunks = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".feature")) {
        continue;
      }
      const text = fs.readFileSync(fullPath, "utf8");
      chunks.push(`# ${fullPath}\n${text}`);

      for (const match of text.matchAll(TAG_LINE_RE)) {
        const line = String(match[1] || "").trim();
        for (const token of line.split(/\s+@/)) {
          const cleaned = token.replace(/^@/, "").trim();
          if (!cleaned) {
            continue;
          }
          const label = normalizeLabel(cleaned);
          if (label) {
            labels.add(label);
          }
        }
      }

      for (const match of text.matchAll(HEADER_KV_RE)) {
        meta[match[1]] = String(match[2] || "").trim();
      }
    }
  }

  if (fs.existsSync(featureRoot)) {
    walk(featureRoot);
  }

  return {
    labels: Array.from(labels).sort(),
    meta,
    fullText: chunks.join("\n\n") || "(no feature content found)"
  };
}

function latestSubdir(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return rootPath;
  }
  const directories = fs
    .readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootPath, entry.name));
  if (!directories.length) {
    return rootPath;
  }
  return directories.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
}

function findArtifactsForScenario(logsRoot, scenarioName) {
  const root = latestSubdir(logsRoot);
  const matches = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.name.includes(scenarioName) && [".png", ".xml", ".txt", ".mp4"].includes(path.extname(entry.name).toLowerCase())) {
        matches.push(fullPath);
      }
    }
  }

  walk(root);
  return Array.from(new Set(matches)).sort();
}

module.exports = {
  safeName,
  normalizeLabel,
  loadCucumber,
  summarizeFailedScenarios,
  collectFeatureInfo,
  latestSubdir,
  findArtifactsForScenario,
  KEY_RE
};
