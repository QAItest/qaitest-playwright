const fs = require("fs");
const path = require("path");
const { getSecretDict } = require("./aws");
const { summarizeFailedScenarios } = require("./xray");

const SECRET_ID_XRAY = process.env.TEST_MGMT_SECRET_ID || "";
const SECRET_ID_JIRA = process.env.ISSUE_TRACKER_SECRET_ID || "";
const XRAY_BASE_URL = (process.env.TEST_MGMT_BASE_URL || "").trim();
const XRAY_GQL_URL = (process.env.TEST_MGMT_GRAPHQL_URL || "").trim();
const JIRA_BASE_URL = (process.env.ISSUE_TRACKER_BASE_URL || "").trim();
const FEATURES_DIR = process.env.FEATURES_DIR || "tests/features";
const LOGS_ROOT = process.env.LOGS_ROOT || "logs";

async function loadSecret(secretId) {
  return secretId ? getSecretDict(secretId) : {};
}

function log(message) {
  console.log(message);
}

async function jiraAuthHeader() {
  const creds = await loadSecret(SECRET_ID_JIRA);
  const email = process.env.ISSUE_TRACKER_EMAIL || process.env.JIRA_EMAIL || creds.email || creds.JIRA_EMAIL || "";
  const token = process.env.ISSUE_TRACKER_TOKEN || process.env.JIRA_TOKEN || creds.token || creds.JIRA_TOKEN || "";
  if (!email || !token) {
    throw new Error("Missing issue tracker credentials (email/token).");
  }
  return {
    Authorization: `Basic ${Buffer.from(`${email}:${token}`, "utf8").toString("base64")}`
  };
}

async function getXrayToken() {
  if (!XRAY_BASE_URL) {
    return "";
  }
  const creds = await loadSecret(SECRET_ID_XRAY);
  const clientId = process.env.TEST_MGMT_CLIENT_ID || creds.client_id || creds.XRAY_CLIENT_ID || "";
  const clientSecret = process.env.TEST_MGMT_CLIENT_SECRET || creds.client_secret || creds.XRAY_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing test management credentials.");
  }
  const response = await fetch(`${XRAY_BASE_URL.replace(/\/$/, "")}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
  });
  if (!response.ok) {
    throw new Error(`Authentication failed with HTTP ${response.status}`);
  }
  return (await response.text()).replace(/^"|"$/g, "");
}

async function postXrayGraphql(token, query, variables = {}, operationName = "graphql") {
  if (!XRAY_GQL_URL) {
    throw new Error("TEST_MGMT_GRAPHQL_URL is not configured.");
  }
  const response = await fetch(XRAY_GQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`[${operationName}] HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  if (payload.errors) {
    throw new Error(`[${operationName}] GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }
  return payload;
}

async function jiraSearchIssues(jql, fields = ["key"], pageSize = 50) {
  if (!JIRA_BASE_URL) {
    return [];
  }
  const response = await fetch(`${JIRA_BASE_URL.replace(/\/$/, "")}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${pageSize}&fields=${encodeURIComponent(fields.join(","))}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(await jiraAuthHeader())
    }
  });
  if (!response.ok) {
    throw new Error(`Jira search failed with HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.issues || [];
}

function normalizeLabel(value) {
  return String(value || "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function loadCucumber(reportPath) {
  const data = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  return Array.isArray(data) ? data : [];
}

function extractLabelsAndTestKeys(cucumberFile) {
  if (!fs.existsSync(cucumberFile)) {
    return [[], 0, [], { passed: 0, failed: 0, skipped: 0 }];
  }

  const data = loadCucumber(cucumberFile);
  const tags = new Set();
  const testKeys = new Set();
  const jiraKeys = new Set();
  const statusCount = { passed: 0, failed: 0, skipped: 0 };

  for (const feature of data) {
    for (const element of feature.elements || []) {
      let scenarioFailed = false;
      let scenarioPassed = true;
      for (const step of element.steps || []) {
        const status = String((step.result || {}).status || "").toLowerCase();
        if (status === "failed") {
          scenarioFailed = true;
          scenarioPassed = false;
        } else if (status === "skipped") {
          scenarioPassed = false;
        }
      }

      if (scenarioFailed) {
        statusCount.failed += 1;
      } else if (scenarioPassed) {
        statusCount.passed += 1;
      } else {
        statusCount.skipped += 1;
      }

      for (const tag of element.tags || []) {
        const name = String(tag.name || "").replace(/^@/, "").trim();
        if (!name) {
          continue;
        }
        if (name.startsWith("TEST_")) {
          testKeys.add(name.slice(5));
        } else if (/^[A-Z]{2,}-\d+$/.test(name)) {
          jiraKeys.add(name);
        } else {
          tags.add(name);
        }
      }
    }
  }

  return [Array.from(tags).sort(), testKeys.size, Array.from(jiraKeys).sort(), statusCount];
}

function extractLabelsFromReport(cucumberPath) {
  const data = loadCucumber(cucumberPath);
  const labels = new Set();
  for (const feature of data) {
    for (const element of feature.elements || []) {
      for (const tag of element.tags || []) {
        const name = String(tag.name || "").replace(/^@/, "").trim();
        if (!name || name.startsWith("TEST_") || /^[A-Z]{2,}-\d+$/.test(name)) {
          continue;
        }
        labels.add(name);
      }
    }
  }
  return Array.from(labels).sort();
}

function buildDescriptionAdf(labels, testCount, env, dateStr, apkVersion = "unknown", apkBuildRuntime = "") {
  const lines = [
    "Automated test execution summary.",
    "",
    `Date: ${dateStr}`,
    `Environment: ${env}`,
    `Tests executed: ${testCount}`,
    `Version: ${apkVersion}`
  ];
  if (apkBuildRuntime) {
    lines.push(`Build: ${apkBuildRuntime}`);
  }
  lines.push("", `Labels: ${labels.length ? labels.join(", ") : "none"}`);
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: lines.join("\n") }]
      }
    ]
  };
}

function main() {
  const reportPath = process.argv.includes("--file")
    ? process.argv[process.argv.indexOf("--file") + 1]
    : "reports/cucumber.json";
  const outputPathArg = process.argv.includes("--output-file")
    ? process.argv[process.argv.indexOf("--output-file") + 1]
    : "";

  const report = path.resolve(reportPath);
  if (!fs.existsSync(report)) {
    console.log(`Report not found: ${report}`);
    return;
  }

  const [labels, testCount, jiraKeys, statusCount] = extractLabelsAndTestKeys(report);
  const failedScenarios = summarizeFailedScenarios(report);
  const payload = {
    report,
    features_dir: FEATURES_DIR,
    logs_root: LOGS_ROOT,
    date: new Date().toISOString().slice(0, 10),
    labels,
    test_count: testCount,
    jira_keys: jiraKeys,
    status_count: statusCount,
    failed_scenarios: failedScenarios
  };

  const outputPath = outputPathArg
    ? path.resolve(outputPathArg)
    : path.join(path.dirname(report), `${path.parse(report).name}.summary.json`);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Summary written to ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  log,
  jiraAuthHeader,
  getXrayToken,
  postXrayGraphql,
  jiraSearchIssues,
  normalizeLabel,
  loadCucumber,
  extractLabelsAndTestKeys,
  extractLabelsFromReport,
  buildDescriptionAdf,
  FEATURES_DIR,
  LOGS_ROOT
};
