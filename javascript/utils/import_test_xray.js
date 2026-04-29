const fs = require("fs");
const path = require("path");
const { summarizeFailedScenarios } = require("./xray");

function buildSummary(reportPath) {
  const failedScenarios = summarizeFailedScenarios(reportPath);
  const outputPath = path.resolve(path.dirname(reportPath), `${path.parse(reportPath).name}.summary.json`);
  fs.writeFileSync(outputPath, JSON.stringify({ report: reportPath, failedScenarios }, null, 2), "utf8");
  return outputPath;
}

module.exports = { buildSummary };
