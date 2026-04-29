const fs = require("fs");
const path = require("path");

function normalizeMapping(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object / dictionary payload.");
  }
  return value;
}

async function getSecretDict(secretId) {
  if (secretId.startsWith("env:")) {
    const envName = secretId.split(":", 2)[1];
    return normalizeMapping(JSON.parse(process.env[envName] || "{}"));
  }
  if (secretId.startsWith("file:")) {
    return normalizeMapping(JSON.parse(fs.readFileSync(path.resolve(secretId.split(":", 2)[1]), "utf8")));
  }
  if ((process.env[secretId] || "").trim()) {
    return normalizeMapping(JSON.parse(process.env[secretId]));
  }
  const candidate = path.resolve(secretId);
  if (fs.existsSync(candidate)) {
    return normalizeMapping(JSON.parse(fs.readFileSync(candidate, "utf8")));
  }
  return {};
}

module.exports = { getSecretDict };
