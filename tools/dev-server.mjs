import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdirSync, realpathSync } from "node:fs";
import { campaignApi } from "../server/routes/campaign-api.mjs";
import { openCampaignRepository } from "../server/storage/campaign-repository.mjs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const port = Number(process.env.PORT || 3010);
const secret = process.env.AMBA_GM_RUNTIME_SECRET || "";
const audience = process.env.AMBA_GM_RUNTIME_ORIGIN || "";
let repository;
if (secret || audience || process.env.AMBA_GM_DATA_DIR) {
  if (!/^[a-f0-9]{64}$/i.test(secret) || !audience || !process.env.AMBA_GM_DATA_DIR ||
      new URL(audience).origin !== audience) throw new Error("Set GM runtime secret, exact origin and private data directory.");
  const directory = resolve(process.env.AMBA_GM_DATA_DIR);
  if (directory === root || directory.startsWith(root + sep)) throw new Error("Campaign data must be outside public files.");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const actual = realpathSync(directory);
  if (actual === realpathSync(root) || actual.startsWith(realpathSync(root) + sep)) throw new Error("Campaign data must be outside public files.");
  process.umask(0o077);
  repository = openCampaignRepository(resolve(actual, "campaigns.sqlite"));
}
const executeCampaign = campaignApi({ repository, secret, audience });
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (pathname === "/api/gm/campaigns/execute") { void executeCampaign(req, res); return; }
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
