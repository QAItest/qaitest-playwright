import fs from "node:fs";
import path from "node:path";
import { summarizeFailedScenarios } from "./xray";

export function buildSummary(reportPath: string): string {
  const failedScenarios = summarizeFailedScenarios(reportPath);
  const outputPath = path.resolve(path.dirname(reportPath), `${path.parse(reportPath).name}.summary.json`);
  fs.writeFileSync(outputPath, JSON.stringify({ report: reportPath, failedScenarios }, null, 2), "utf8");
  return outputPath;
}
