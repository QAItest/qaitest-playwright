import fs from "node:fs";
import path from "node:path";
import { getSecretDict } from "./aws";
import { sanitizeFeatureText } from "./gherkin_sanitizer";

type AnyRecord = Record<string, any>;
type LabelsByKey = Record<string, string[]>;

const SECRET_ID = process.env.TEST_MANAGEMENT_SECRET_ID || "";
export const XRAY_PROJECT_KEY = process.env.XRAY_PROJECT_KEY || process.env.TEST_PROJECT_KEY || "";
const AUTH_URL = (process.env.TEST_MGMT_AUTH_URL || "").trim();
const GRAPHQL_URL = (process.env.TEST_MGMT_GRAPHQL_URL || "").trim();
const EXPORT_URL = (process.env.TEST_MGMT_EXPORT_URL || "").trim();
const OUTPUT_DIR = path.resolve(process.env.FEATURE_OUTPUT_DIR || "tests/features");
const ISSUE_KEY_RE = /[A-Z][A-Z0-9_]+-\d+/;
const IGNORED_FOR_FOLDER = new Set(["cucumber", "env:appium", "env_appium"]);

async function loadCredentials(): Promise<Record<string, string>> {
  if (SECRET_ID) {
    const resolved = await getSecretDict(SECRET_ID);
    return Object.fromEntries(Object.entries(resolved).map(([key, value]) => [String(key), String(value)]));
  }

  const creds: Record<string, string> = {};
  for (const key of ["TEST_MGMT_CLIENT_ID", "TEST_MGMT_CLIENT_SECRET", "XRAY_CLIENT_ID", "XRAY_CLIENT_SECRET"]) {
    const value = (process.env[key] || "").trim();
    if (value) {
      creds[key] = value;
    }
  }
  return creds;
}

export async function getToken(): Promise<string> {
  if (!AUTH_URL) {
    return "";
  }

  const creds = await loadCredentials();
  const clientId = creds.TEST_MGMT_CLIENT_ID || creds.XRAY_CLIENT_ID || "";
  const clientSecret = creds.TEST_MGMT_CLIENT_SECRET || creds.XRAY_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing client credentials for remote export authentication.");
  }

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
  });
  if (!response.ok) {
    throw new Error(`Authentication failed with HTTP ${response.status}`);
  }
  return (await response.text()).trim().replace(/^"|"$/g, "");
}

export async function graphql(token: string, query: string, variables: AnyRecord): Promise<AnyRecord> {
  if (!GRAPHQL_URL) {
    throw new Error("TEST_MGMT_GRAPHQL_URL is not configured.");
  }

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) {
    throw new Error(`GraphQL request failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.errors) {
    throw new Error(JSON.stringify(payload.errors));
  }
  return payload.data || {};
}

export async function getProjectId(token: string, projectKey: string): Promise<string> {
  const query = "query($key:String!){ getProjectSettings(projectIdOrKey:$key){ projectId }}";
  const data = await graphql(token, query, { key: projectKey });
  return data.getProjectSettings.projectId;
}

export async function listGherkinKeys(token: string, projectId: string): Promise<LabelsByKey> {
  const query =
    "query($projectId:String,$limit:Int!, $start:Int, $tt: TestTypeInput){ getTests(projectId:$projectId, testType:$tt, limit:$limit, start:$start){ total start limit results { jira(fields:[\"key\",\"labels\"]) }}}";
  const mapping: LabelsByKey = {};
  let start = 0;
  const limit = 100;

  while (true) {
    const data = await graphql(token, query, {
      projectId,
      limit,
      start,
      tt: { kind: "Gherkin" }
    });
    const block = data.getTests || {};

    for (const testItem of block.results || []) {
      const jira = testItem.jira || {};
      const key = jira.key || ((jira.fields || {}).key || "");
      const rawLabels = jira.labels || ((jira.fields || {}).labels || []);
      if (key) {
        mapping[String(key)] = Array.from(new Set(rawLabels.map((item: unknown) => String(item))));
      }
    }

    start = (block.start || 0) + (block.results || []).length;
    if (start >= (block.total || start)) {
      break;
    }
  }

  return mapping;
}

function extractIssueKeyFromName(name: string): string {
  const match = path.basename(name).match(ISSUE_KEY_RE);
  return match ? match[0] : "";
}

function sanitizeSegment(value: string): string {
  return String(value || "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._-]+|[._-]+$/g, "") || "unlabeled";
}

export function hasEnvAppium(labels: string[]): boolean {
  return (labels || []).some((label) => ["env:appium", "env_appium"].includes(String(label || "").toLowerCase()));
}

export function hasEnvAppiumAndDomain(labels: string[], domains: string[]): boolean {
  if (!labels || !labels.length) {
    return false;
  }
  const lowerLabels = labels.map((label) => String(label).toLowerCase());
  const hasAppium = lowerLabels.some((label) => ["env:appium", "env_appium"].includes(label));
  const hasDomain = (domains || []).some((domain) =>
    lowerLabels.some((label) => [String(domain).toLowerCase(), `domain:${String(domain).toLowerCase()}`, `domain_${String(domain).toLowerCase()}`].includes(label))
  );
  return hasAppium && hasDomain;
}

export function pickFunctionalLabel(labels: string[]): string {
  for (const label of labels || []) {
    if (!label) {
      continue;
    }
    if (IGNORED_FOR_FOLDER.has(String(label).toLowerCase())) {
      continue;
    }
    return sanitizeSegment(label);
  }
  return "unlabeled";
}

export function loadLocalFeaturesFromSource(sourcePath: string): Array<[string, string]> {
  const source = path.resolve(sourcePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Feature source not found: ${source}`);
  }

  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    const items: Array<[string, string]> = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.endsWith(".feature")) {
          items.push([path.relative(source, fullPath).replace(/\\/g, "/"), fs.readFileSync(fullPath, "utf8")]);
        }
      }
    };
    walk(source);
    return items;
  }

  if (source.toLowerCase().endsWith(".json")) {
    return JSON.parse(fs.readFileSync(source, "utf8"))
      .filter((item: unknown) => item && typeof item === "object")
      .map((item: AnyRecord) => [String(item.path || item.name || "unknown.feature"), String(item.content || "")] as [string, string])
      .filter(([name]) => name.endsWith(".feature"));
  }

  throw new Error("Unsupported local source. Use a directory or JSON manifest.");
}

export async function exportFeatures(token: string, keys: string[], labelsByKey: LabelsByKey): Promise<string[]> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const writtenPaths: string[] = [];
  const localSource = (process.env.FEATURE_SOURCE_PATH || "").trim();

  async function fetchOneFeature(key: string): Promise<string> {
    if (localSource) {
      for (const [name, content] of loadLocalFeaturesFromSource(localSource)) {
        const candidateKey = extractIssueKeyFromName(name) || path.parse(name).name;
        if (candidateKey.toUpperCase() === key.toUpperCase()) {
          return content;
        }
      }
      return "";
    }

    if (!EXPORT_URL) {
      throw new Error("No feature source configured. Set FEATURE_SOURCE_PATH or TEST_MGMT_EXPORT_URL.");
    }

    const url = new URL(EXPORT_URL);
    url.searchParams.set("keys", key);
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      throw new Error(`Feature export failed with HTTP ${response.status}`);
    }
    return await response.text();
  }

  const keysByFolder: Record<string, string[]> = {};
  for (const key of keys) {
    const folder = pickFunctionalLabel(labelsByKey[key] || []);
    keysByFolder[folder] = keysByFolder[folder] || [];
    keysByFolder[folder].push(key);
  }

  for (const [folder, folderKeys] of Object.entries(keysByFolder)) {
    const outDir = path.join(OUTPUT_DIR, folder);
    fs.mkdirSync(outDir, { recursive: true });

    for (const key of folderKeys) {
      const raw = await fetchOneFeature(key);
      if (!raw) {
        console.log(`[export][warn] No feature content found for key ${key}`);
        continue;
      }
      const sanitized = sanitizeFeatureText(raw, key, false, true);
      const outPath = path.join(outDir, `${key}.feature`);
      fs.writeFileSync(outPath, sanitizeFeatureText(sanitized), "utf8");
      writtenPaths.push(outPath);
      console.log(`[export] wrote -> ${outPath.replace(/\\/g, "/")}`);
    }
  }

  return writtenPaths;
}

export function parseKeysArg(value: string): string[] {
  return String(value || "")
    .trim()
    .split(/[,\s;]+/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z][A-Z0-9_]+-\d+$/.test(item));
}

export function readKeysFile(filePath: string): string[] {
  const keys: string[] = [];
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) {
      continue;
    }
    keys.push(...parseKeysArg(stripped));
  }
  return Array.from(new Set(keys));
}
