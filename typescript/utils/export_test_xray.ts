import fs from "node:fs";
import path from "node:path";
import { sanitizeFeatureText } from "./gherkin_sanitizer";

export function exportFeatures(sourceDir: string, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".feature")) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(outputDir, entry.name);
      fs.writeFileSync(targetPath, sanitizeFeatureText(fs.readFileSync(sourcePath, "utf8")), "utf8");
    }
  }
}
