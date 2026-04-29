const fs = require("fs");

function summarizeFailedScenarios(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return {};
  }
  const data = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const output = {};
  for (const suite of Array.isArray(data) ? data : []) {
    for (const element of suite.elements || []) {
      const failed = (element.steps || []).some((step) => ((step.result || {}).status || "").toLowerCase() === "failed");
      if (!failed) {
        continue;
      }
      output[element.name || "unknown"] = (element.tags || []).map((tag) => String(tag.name || "").replace(/^@/, ""));
    }
  }
  return output;
}

module.exports = { summarizeFailedScenarios };
