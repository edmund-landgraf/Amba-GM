// In PostgreSQL mode the GM server is a stateless operation proxy. AMBA alone
// verifies the purpose-bound grant and commits the authoritative ledger.
export function postgresRuntimeEndpoint(base) {
  const url = new URL(base);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!(url.protocol === "https:" || (local && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash ||
      !/^\/api\/v1\/?$/.test(url.pathname)) throw new Error("Set AMBA_GM_API_BASE to the trusted AMBA /api/v1 URL (HTTPS or loopback HTTP).");
  return new URL(url.pathname.replace(/\/$/, "") + "/gm-runtime/execute", url.origin).href;
}
function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(value));
}
export function postgresCampaignApi({ endpoint, audience, fetchImpl = fetch }) {
  return async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { error: "POST required." });
    if (req.headers.origin !== audience || req.headers.authorization) return json(res, 403, { error: "Unexpected GM origin or credential." });
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) return json(res, 415, { error: "JSON required." });
    let body;
    try {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 128 * 1024) return json(res, 413, { error: "Request too large." });
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch { return json(res, 400, { error: "Invalid request." }); }
    if (!body || typeof body !== "object" || Object.keys(body).length !== 1 || typeof body.token !== "string" || body.token.length > 120000)
      return json(res, 400, { error: "Invalid runtime grant request." });
    try {
      const upstream = await fetchImpl(endpoint, {
        method: "POST", redirect: "error", cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json", Origin: audience },
        body: JSON.stringify({ token: body.token }), signal: AbortSignal.timeout(20000),
      });
      // Never forward cookies, authorization credentials, user-selected URLs,
      // redirect targets, or private diagnostic bodies from a failed upstream.
      if (!upstream.ok) {
        if ([400,401,403,404,409,413,415,429,503].includes(upstream.status)) {
          const value = await upstream.json().catch(() => null);
          return json(res, upstream.status, { error: typeof value?.error === "string" ? value.error : "AMBA runtime rejected the operation." });
        }
        return json(res, 502, { error: "AMBA runtime unavailable. Reopen the campaign to confirm saved state." });
      }
      const value = await upstream.json();
      if (!value || !Object.hasOwn(value, "result")) throw new Error("Unexpected response");
      return json(res, 200, { result: value.result });
    } catch {
      return json(res, 502, { error: "AMBA runtime unavailable. Reopen the campaign to confirm saved state." });
    }
  };
}
