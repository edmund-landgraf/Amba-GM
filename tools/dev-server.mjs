import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer((req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
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
  console.log(`AMBA GM starter: http://127.0.0.1:${port}`);
});
