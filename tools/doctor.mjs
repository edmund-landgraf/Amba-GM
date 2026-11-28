import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { postgresRuntimeEndpoint } from "../server/routes/postgres-campaign-api.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const backend = process.env.AMBA_GM_RUNTIME_BACKEND || "sqlite";
const origin = process.env.AMBA_GM_RUNTIME_ORIGIN || "";
const secret = process.env.AMBA_GM_RUNTIME_SECRET || "";
const dataDir = process.env.AMBA_GM_DATA_DIR || "";
const apiBase = process.env.AMBA_GM_API_BASE || "";
const problems = [];

function originOk(value) {
  try { return new URL(value).origin === value; } catch { return false; }
}

console.log("AMBA GM doctor");
console.log("backend:", backend);
console.log("origin:", origin || "(unset)");

if (!["sqlite", "postgres"].includes(backend)) problems.push("AMBA_GM_RUNTIME_BACKEND must be sqlite or postgres.");
if (!originOk(origin)) problems.push("AMBA_GM_RUNTIME_ORIGIN must be an exact origin (no path).");

if (backend === "postgres") {
  try {
    const endpoint = postgresRuntimeEndpoint(apiBase);
    console.log("AMBA execute:", endpoint);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : "Invalid AMBA_GM_API_BASE.");
  }
  console.log("GM server is a proxy; SQLite is not used.");
} else {
  const secretOk = /^[a-f0-9]{64}$/i.test(secret);
  console.log("secret:", secretOk ? "set (64 hex)" : secret ? "invalid" : "missing — Browse adventure still works");
  console.log("data dir:", dataDir || "(unset)");
  if (secret || dataDir) {
    if (!secretOk) problems.push("SQLite campaign writes need AMBA_GM_RUNTIME_SECRET as 64 hex characters.");
    if (!dataDir) problems.push("Set AMBA_GM_DATA_DIR outside public/.");
  }
}

if (problems.length) {
  console.error("\nNot ready:");
  for (const problem of problems) console.error("-", problem);
  process.exit(1);
}
console.log("\nOK for this backend. Phase B prod still needs AMBA_GM_RUNTIME_BACKEND=postgres on both AMBA and GM.");
