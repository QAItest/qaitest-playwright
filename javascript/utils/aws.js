const fs = require("fs");
const path = require("path");

function normalizeMapping(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object / dictionary payload.");
  }
  return value;
}

function loadJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function getSecretDict(secretId) {
  if (secretId.startsWith("env:")) {
    const envName = secretId.split(":", 2)[1];
    const raw = (process.env[envName] || "").trim();
    if (!raw) {
      throw new Error(`Environment variable '${envName}' is empty or undefined.`);
    }
    return normalizeMapping(JSON.parse(raw));
  }

  if (secretId.startsWith("file:")) {
    const filePath = path.resolve(secretId.split(":", 2)[1]);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Secret file not found: ${filePath}`);
    }
    return normalizeMapping(loadJsonFile(filePath));
  }

  const envValue = (process.env[secretId] || "").trim();
  if (envValue) {
    return normalizeMapping(JSON.parse(envValue));
  }

  const candidate = path.resolve(secretId);
  if (fs.existsSync(candidate)) {
    return normalizeMapping(loadJsonFile(candidate));
  }

  throw new Error(`Secret could not be resolved from env or file: ${secretId}`);
}

module.exports = { getSecretDict };
