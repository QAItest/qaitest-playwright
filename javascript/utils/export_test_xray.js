const fs = require("fs");
const path = require("path");
const { sanitizeFeatureText } = require("./gherkin_sanitizer");

function exportFeatures(sourceDir, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".feature")) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(outputDir, entry.name);
      fs.writeFileSync(targetPath, sanitizeFeatureText(fs.readFileSync(sourcePath, "utf8")), "utf8");
    }
  }
}

module.exports = { exportFeatures };
