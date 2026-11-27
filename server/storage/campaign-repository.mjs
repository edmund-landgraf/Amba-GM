import { DatabaseSync } from "node:sqlite";
import { validateCampaigns, newCampaign, changeCampaign } from "../../public/src/domain/campaigns.js";

export class CampaignConflict extends Error {}

export function openCampaignRepository(filename, clock = () => new Date().toISOString()) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=FULL;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS campaign_collections (
      owner_id TEXT NOT NULL, module_id TEXT NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY (owner_id, module_id)
    ) STRICT;
  `);
  const get = db.prepare("SELECT data FROM campaign_collections WHERE owner_id=? AND module_id=?");
  const put = db.prepare("INSERT INTO campaign_collections(owner_id,module_id,data) VALUES(?,?,?) ON CONFLICT(owner_id,module_id) DO UPDATE SET data=excluded.data");
  function read(ownerId, moduleId) {
    const row = get.get(ownerId, moduleId);
    if (!row) return [];
    const stored = JSON.parse(row.data);
    if (stored.schemaVersion !== 1) throw new Error("Unsupported storage version");
    return validateCampaigns(stored.campaigns);
  }
  return {
    execute({ sub: ownerId, moduleId, operation }) {
      if (operation.action === "list") return read(ownerId, moduleId);
      db.exec("BEGIN IMMEDIATE");
      try {
        const campaigns = read(ownerId, moduleId);
        let result;
        try {
          const now = clock();
          if (operation.action === "create") result = newCampaign(campaigns, { ...operation, now });
          else if (operation.action === "change") result = changeCampaign(campaigns, { ...operation, now });
          else throw new Error("Unsupported operation.");
        } catch (error) { throw new CampaignConflict(error.message); }
        const data = JSON.stringify({ schemaVersion: 1, campaigns: result.campaigns });
        if (Buffer.byteLength(data) > 16 * 1024 * 1024) throw new CampaignConflict("Campaign storage limit reached. Export history and contact the administrator.");
        put.run(ownerId, moduleId, data);
        db.exec("COMMIT");
        return result.campaign;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close: () => db.close(),
  };
}
