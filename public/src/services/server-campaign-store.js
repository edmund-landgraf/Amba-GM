import { apiBaseUrl } from "./amba.js";
import { validateCampaigns } from "../domain/campaigns.js";

export function serverCampaignStore(moduleId, ownerId, fetcher = fetch) {
  if (!moduleId || !ownerId) throw new Error("An authenticated AMBA account and adventure are required.");
  const path = apiBaseUrl + "/modules/" + encodeURIComponent(moduleId) + "/gm-campaigns";
  async function request(suffix = "", body) {
    let response;
    try {
      response = await fetcher(path + suffix, {
        method: body === undefined ? "GET" : "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "X-AMBA-GM-Owner": ownerId,
          ...(body === undefined ? {} : { "Content-Type": "application/json", "X-AMBA-GM-Request": "1" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error("Campaign server unavailable. No local fallback was used. Reopen the campaign to check whether a request committed.");
    }
    const value = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(
      typeof value?.error === "string" ? value.error : "Campaign server returned error " + response.status + ". Reconnect and try again."
    ), { status: response.status });
    return value;
  }
  return {
    list: async () => validateCampaigns(await request()),
    create: async ({ id, name, revision }) => validateCampaigns([await request("", { id, name: name || "", revision })])[0],
    change: async ({ id, revision, expectedVersion, command }) => {
      const { table, actor, ...identities } = command;
      // The server, not the client, resolves the exact published check and actor.
      const safeCommand = table ? { ...identities, tableId: table.id } : identities;
      return validateCampaigns([await request("/" + encodeURIComponent(id) + "/commands", {
        revision, expectedVersion, command: safeCommand,
      })])[0];
    },
  };
}
