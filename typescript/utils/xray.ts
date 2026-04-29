import fs from "node:fs";

export function summarizeFailedScenarios(reportPath: string): Record<string, string[]> {
  if (!fs.existsSync(reportPath)) {
    return {};
  }
  const data = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const output: Record<string, string[]> = {};
  for (const suite of Array.isArray(data) ? data : []) {
    for (const element of suite.elements || []) {
      const failed = (element.steps || []).some((step: any) => String((step.result || {}).status || "").toLowerCase() === "failed");
      if (failed) {
        output[String(element.name || "unknown")] = (element.tags || []).map((tag: any) => String(tag.name || "").replace(/^@/, ""));
      }
    }
  }
  return output;
}
