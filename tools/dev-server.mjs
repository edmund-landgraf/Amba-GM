import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync, mkdirSync, realpathSync } from "node:fs";
import { campaignApi } from "../server/routes/campaign-api.mjs";
import { postgresCampaignApi, postgresRuntimeEndpoint } from "../server/routes/postgres-campaign-api.mjs";
import { openCampaignRepository } from "../server/storage/campaign-repository.mjs";
import { campaignPersistenceMode } from "../server/runtime-status.mjs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = resolve(appRoot, "public");
const envPath = resolve(appRoot, ".env");
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
const port = Number(process.env.PORT || 3010);
const secret = process.env.AMBA_GM_RUNTIME_SECRET || "";
const audience = process.env.AMBA_GM_RUNTIME_ORIGIN || "";
const backend = process.env.AMBA_GM_RUNTIME_BACKEND || "sqlite";
if (!["sqlite", "postgres"].includes(backend)) throw new Error("Unknown GM runtime backend.");
let repository;
if (backend === "postgres") {
  if (!audience || new URL(audience).origin !== audience || !process.env.AMBA_GM_API_BASE) throw new Error("Set exact GM origin and trusted AMBA API base.");
} else if (/^[a-f0-9]{64}$/i.test(secret) && audience && process.env.AMBA_GM_DATA_DIR &&
    new URL(audience).origin === audience) {
  const directory = resolve(process.env.AMBA_GM_DATA_DIR);
  if (directory === root || directory.startsWith(root + sep)) throw new Error("Campaign data must be outside public files.");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const actual = realpathSync(directory);
  if (actual === realpathSync(root) || actual.startsWith(realpathSync(root) + sep)) throw new Error("Campaign data must be outside public files.");
  process.umask(0o077);
  repository = openCampaignRepository(resolve(actual, "campaigns.sqlite"));
} else if (backend === "sqlite") {
  console.warn("AMBA GM: campaign persistence disabled — set AMBA_GM_RUNTIME_SECRET (64 hex), origin and data dir, or use Browse adventure (in-memory preview).");
}
async function campaignPersistenceUnavailable(req, res) {
  res.writeHead(503, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify({
    error: "Campaign server storage is not configured. Use Browse adventure for visual review, or set AMBA_GM_RUNTIME_SECRET in .env.",
  }));
}
const executeCampaign = backend === "postgres"
  ? postgresCampaignApi({ endpoint: postgresRuntimeEndpoint(process.env.AMBA_GM_API_BASE), audience })
  : repository
    ? campaignApi({ repository, secret, audience })
    : campaignPersistenceUnavailable;
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const persistence = campaignPersistenceMode(backend, Boolean(repository));
const server = createServer((req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (pathname === "/api/gm/campaigns/execute") { void executeCampaign(req, res); return; }
  if (pathname === "/api/gm/status" && (req.method === "GET" || req.method === "HEAD")) {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method !== "HEAD") res.write(JSON.stringify({ persistence }));
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end("Method not allowed"); return; }
  let relative;
  try { relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1)); } catch { res.writeHead(400).end("Invalid path"); return; }
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(root + sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": types[extname(target)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(target).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`AMBA GM: http://127.0.0.1:${port}`);
});

server.on("close", () => repository?.close());
