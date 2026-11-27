import { apiBaseUrl } from "./amba.js";

// Authorize each operation against the current AMBA browser session. The
// short-lived signed request is never written to browser storage.
export function serverCampaignStore(ownerId, moduleId) {
  const authorizeUrl = apiBaseUrl + "/modules/" + encodeURIComponent(moduleId) + "/syndication/gm-runtime-authorize";
  async function request(url, body, credentials) {
    const response = await fetch(url, {
      method: "POST", credentials, cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    let value;
    try { value = await response.json(); } catch { throw new Error("Campaign service returned an unexpected response. Reopen the campaign to check its saved state."); }
    if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "Campaign request failed.");
    return value;
  }
  async function execute(operation) {
    const grant = await request(authorizeUrl, { ...operation, ownerId }, "include");
    if (typeof grant.token !== "string") throw new Error("AMBA did not authorize the campaign request.");
    const value = await request("/api/gm/campaigns/execute", { token: grant.token }, "same-origin");
    if (!Object.hasOwn(value, "result")) throw new Error("Campaign service did not confirm the operation.");
    return value.result;
  }
  return {
    list: () => execute({ action: "list" }),
    create: ({ id, name, revision }) => execute({ action: "create", id, name, revision }),
    change: ({ id, revision, expectedVersion, command }) => {
      const { type, key, pageId, sessionId, degree, pcId, table } = command;
      const c = { type };
      switch (type) {
        case "start": Object.assign(c, { sessionId, pageId: pageId ?? null }); break;
        case "end": Object.assign(c, { sessionId }); break;
        case "position": Object.assign(c, { sessionId, pageId }); break;
        case "accept": Object.assign(c, { key, pageId, sessionId, degree, pcId: pcId ?? null, tableId: table.id }); break;
        case "correct": Object.assign(c, { key, pageId, degree, tableId: table.id }); break;
        case "remove": Object.assign(c, { key }); break;
        default: throw new Error("Unknown campaign operation.");
      }
      return execute({ action: "change", id, revision, expectedVersion, command: c });
    },
  };
}
