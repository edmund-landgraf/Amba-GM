import { validateCampaigns, newCampaign, changeCampaign } from "../domain/campaigns.js";

// IndexedDB read/write transactions serialize updates from multiple tabs.
// No server credentials, published HTML or provider transcripts are stored here.
export function campaignStore(indexedDB, scope) {
  if (!indexedDB || !scope) throw new Error("Persistent browser campaign storage is unavailable.");
  async function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("amba-gm-campaigns", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("campaigns");
      };
      request.onerror = () => reject(request.error || new Error("Cannot open campaign storage."));
      request.onblocked = () => reject(new Error("Close other AMBA GM tabs and try again."));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }

  async function transact(transform) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("campaigns", transform ? "readwrite" : "readonly");
        const records = tx.objectStore("campaigns");
        const request = records.get(scope);
        let result;
        let failure;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure || tx.error || new Error("Campaign storage transaction failed."));
        tx.onerror = () => { /* onabort reports the transaction failure */ };
        request.onsuccess = () => {
          try {
            // An absent scope is a new collection; malformed data must not be overwritten.
            const raw = request.result;
            if (raw !== undefined && raw.schemaVersion !== 1) throw new Error("Unsupported campaign storage version.");
            const campaigns = validateCampaigns(raw === undefined ? [] : raw.campaigns);
            if (!transform) { result = campaigns; return; }
            const next = transform(campaigns);
            validateCampaigns(next.campaigns);
            records.put({ schemaVersion: 1, campaigns: next.campaigns }, scope);
            result = next.campaign;
          } catch (error) {
            failure = error;
            tx.abort();
          }
        };
      });
    } finally { db.close(); }
  }

  return {
    list: () => transact(null),
    create: input => transact(campaigns => newCampaign(campaigns, { ...input, now: new Date().toISOString() })),
    change: input => transact(campaigns => changeCampaign(campaigns, { ...input, now: new Date().toISOString() })),
  };
}
