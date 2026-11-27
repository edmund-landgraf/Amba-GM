import { verifyRuntimeGrant } from "../auth/runtime-grant.mjs";
import { CampaignConflict } from "../storage/campaign-repository.mjs";

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(value));
}
export function campaignApi({ repository, secret, audience }) {
  return async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { error: "POST required." });
    if (!repository) return json(res, 503, { error: "Server campaign storage is not configured." });
    if (req.headers.origin !== audience) return json(res, 403, { error: "Unexpected GM origin." });
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) return json(res, 415, { error: "JSON required." });
    let body;
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 128 * 1024) { json(res, 413, { error: "Request too large." }); return; }
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch { return json(res, 400, { error: "Invalid request." }); }
    const grant = verifyRuntimeGrant(body?.token, secret, audience);
    if (!grant) return json(res, 401, { error: "Invalid or expired AMBA authorization. Retry the operation." });
    try {
      const result = repository.execute(grant);
      return json(res, 200, { result });
    } catch (error) {
      if (error instanceof CampaignConflict) return json(res, 409, { error: error.message });
      // Do not log or return private history, tokens or database paths.
      return json(res, 500, { error: "Campaign storage failed. Reopen the campaign to check its saved state." });
    }
  };
}
