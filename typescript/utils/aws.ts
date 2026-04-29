import fs from "node:fs";
import path from "node:path";

export async function getSecretDict(secretId: string): Promise<Record<string, unknown>> {
  if (secretId.startsWith("env:")) {
    return JSON.parse(process.env[secretId.split(":", 2)[1]] || "{}");
  }
  if (secretId.startsWith("file:")) {
    return JSON.parse(fs.readFileSync(path.resolve(secretId.split(":", 2)[1]), "utf8"));
  }
  if ((process.env[secretId] || "").trim()) {
    return JSON.parse(process.env[secretId] as string);
  }
  const candidate = path.resolve(secretId);
  return fs.existsSync(candidate) ? JSON.parse(fs.readFileSync(candidate, "utf8")) : {};
}
