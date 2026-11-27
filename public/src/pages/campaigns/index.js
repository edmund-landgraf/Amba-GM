import { element, button } from "../../components/dom.js";
import { activeSession } from "../../domain/campaigns.js";
import { outcomeStorageKey, readOutcomes } from "../../domain/outcomes.js";
import { openWorkspace } from "../play/index.js";

function downloadJson(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = element("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function openCampaigns({ snapshot, moduleTitle, ownerId, store, localStore, readerUrl, exit, isCurrent }) {
  const root = element("section");
  root.className = "panel";
  const status = element("p");
  status.setAttribute("role", "status");
  const list = element("div");
  const name = element("input");
  name.type = "text";
  name.maxLength = 120;
  name.placeholder = "Optional campaign name";
  name.setAttribute("aria-label", "New campaign name");
  let busy = false;
  let closed = false;
  const back = button("Back to overview", () => {
    if (busy) return;
    closed = true;
    root.remove();
    exit();
  });
  const create = button("Create campaign", () => void run(async () => {
    await store.create({ id: crypto.randomUUID(), name: name.value, revision: snapshot.revision });
    name.value = "";
    await refresh();
    status.textContent = "Campaign created. Select it to begin.";
  }));
  function setBusy(value) {
    busy = value;
    back.disabled = value;
    create.disabled = value;
    name.disabled = value;
    for (const control of list.querySelectorAll("button")) control.disabled = value || control.dataset.unavailable === "true";
  }
  async function run(work) {
    if (busy || closed) return;
    setBusy(true);
    status.textContent = "";
    try { await work(); }
    catch (error) { status.textContent = error.message || "Campaign operation failed."; }
    finally { setBusy(false); }
  }
  async function refresh() {
    const campaigns = await store.list();
    list.replaceChildren();
    if (!campaigns.length) list.append(element("p", "No campaigns yet. Create one for this publication."));
    for (const campaign of [...campaigns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
      const active = activeSession(campaign);
      const matching = campaign.revision === snapshot.revision;
      const row = element("section");
      row.append(element("h3", campaign.name));
      row.append(element("p", campaign.sessions.length + " sessions · " + campaign.outcomes.length + " accepted outcomes"));
      if (active) row.append(element("p", "Session " + active.number + " is active."));
      if (!matching) row.append(element("p", "This campaign uses a different publication revision. Its history is preserved; opening it requires that revision or an explicit migration."));
      const open = button(active ? "Resume session " + active.number : "Open campaign", () => void run(async () => {
        const latest = (await store.list()).find(c => c.id === campaign.id);
        if (!latest || latest.revision !== snapshot.revision) throw new Error("This campaign is unavailable for this publication.");
        openWorkspace(snapshot, moduleTitle, latest, store, () => {
          root.hidden = false;
          void run(refresh);
        }, readerUrl, root);
        root.hidden = true;
      }));
      open.dataset.unavailable = String(!matching);
      open.disabled = !matching;
      const exportHistory = button("Export campaign history", () => downloadJson({
        schemaVersion: 1, moduleId: snapshot.moduleId, campaign,
      }, "amba-gm-" + campaign.id + ".json"));
      row.append(open, exportHistory);
      list.append(row);
    }
  }
  root.append(back, element("h2", moduleTitle + " — Campaigns"),
    element("p", "Campaigns are saved on the AMBA server for this signed-in account and adventure. Exports contain GM-private history."),
    status, name, create, list);
  // Do not silently assign the predecessor's revision-scoped tab history to any new game.
  try {
    const legacy = readOutcomes(window.sessionStorage, outcomeStorageKey(ownerId, snapshot));
    if (legacy.records.length) {
      root.append(element("p", "Earlier tab-only outcomes are not assigned to a campaign. Export them separately if needed."),
        button("Export previous tab outcomes", () => downloadJson({ moduleId: snapshot.moduleId, revision: snapshot.revision, outcomes: legacy.records }, "amba-gm-previous-tab-outcomes.json")));
    }
  } catch { /* no legacy storage access */ }
  // Browser campaigns remain intact and can be exported explicitly; never upload or
  // delete legacy records automatically, and never fall back to local writes.
  if (localStore) {
    try {
      const local = await localStore.list();
      if (local.length) {
        const legacy = element("section");
        legacy.append(element("h3", "Previous browser-only campaigns"),
          element("p", "These records are still saved in this browser, but are not synchronized. Export them for safekeeping. Server migration of these records is not yet supported."));
        for (const campaign of local) {
          legacy.append(element("p", campaign.name + " · " + campaign.sessions.length + " sessions"),
            button("Export local campaign " + campaign.name, () => downloadJson({
              schemaVersion: 1, moduleId: snapshot.moduleId, campaign,
            }, "amba-gm-local-" + campaign.id + ".json")));
        }
        root.append(legacy);
      }
    } catch {
      root.append(element("p", "Previous browser-only campaigns could not be read; no local records were changed."));
    }
  }
  // Mount even when the server is unavailable, so legacy exports remain reachable.
  const retry = button("Refresh server campaigns", () => void run(refresh));
  root.append(retry);
  try { await refresh(); }
  catch (error) { status.textContent = error.message || "Campaign server unavailable."; }
  if (isCurrent()) document.getElementById("overview-panel").after(root);
}
