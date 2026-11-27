import { $ } from "../../components/dom.js";
import { setMessage } from "../../components/status.js";
import { state } from "../../application/session.js";
import { apiGet, apiBaseUrl } from "../../services/amba.js";
import { openCampaigns } from "../campaigns/index.js";
import { campaignScope } from "../../domain/campaigns.js";
import { campaignStore } from "../../services/campaign-store.js";
import { serverCampaignStore } from "../../services/server-campaign-store.js";

const modulePanel = $("module-panel");
const overviewPanel = $("overview-panel");

function appendFact(list, label, value) {
  if (value === undefined || value === null || value === "") return;
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = String(value);
  list.append(dt, dd);
}

let overviewRequest = 0;

async function openOverview() {
  const request = ++overviewRequest;
  const module = state.selectedModule;
  if (!module) return;
  modulePanel.classList.add("hidden");
  overviewPanel.classList.remove("hidden");
  $("overview-title").textContent = module.title;
  $("overview-subtitle").textContent = module.subtitle || "";
  $("publication-status").className = `status ${module.publicationStatus === "published" ? "published" : "draft"}`;
  $("publication-status").textContent = module.publicationStatus === "published" ? "Published" : "Draft";
  $("overview-description").textContent = module.subtitle || "Module details are loaded from AMBA. Full adventure content will appear when the read-only published snapshot is connected.";
  const facts = $("overview-facts");
  facts.replaceChildren();
  appendFact(facts, "Setting", module.setting);
  appendFact(facts, "Level", module.levelRange);
  appendFact(facts, "Ruleset", module.ruleset);
  appendFact(facts, "Version", module.versionLabel || null);
  appendFact(facts, "Last updated", module.updatedAt ? new Date(module.updatedAt).toLocaleDateString() : null);
  const count = module._count;
  if (count) {
    appendFact(facts, "Adventure areas", count.containers);
    appendFact(facts, "Player characters", count.pcs);
    appendFact(facts, "NPCs", count.npcs);
  }
  const note = $("overview-note");
  const open = $("start-button");
  open.disabled = true;
  open.onclick = null;
  open.textContent = "Manage campaigns";
  open.removeAttribute("title");
  note.textContent = "Checking the published adventure…";
  setMessage("");
  try {
    const status = await apiGet(`/modules/${encodeURIComponent(module.id)}/syndication`);
    if (request !== overviewRequest) return;
    const full = status.syndications?.full;
    if (!full?.url) {
      note.textContent = "Publish a full syndication in AMBA to open this adventure.";
      return;
    }
    const url = new URL(full.url, apiBaseUrl);
    if (url.origin !== new URL(apiBaseUrl, location.href).origin || !url.pathname.startsWith("/syndicate/")) {
      throw new Error("AMBA returned an unexpected publication address.");
    }
    if (Array.isArray(full.publishedPageIds)) appendFact(facts, "Published pages", full.publishedPageIds.length);
    note.textContent = status.unreleasedChanges ? "The full publication is ready. AMBA has newer unpublished edits." : "The full publication is ready.";
    open.onclick = async () => {
      open.disabled = true;
      note.textContent = "Loading the published tree…";
      try {
        const identity = user => user?.user?.id || user?.id;
        const ownerId = identity(state.user);
        if (!ownerId || identity(await apiGet("/auth/me")) !== ownerId) throw new Error("AMBA account changed. Reconnect before opening campaigns.");
        const snapshot = await apiGet(`/modules/${encodeURIComponent(module.id)}/syndication/gm`);
        if (identity(await apiGet("/auth/me")) !== ownerId) throw new Error("AMBA account changed. Reconnect before opening campaigns.");
        if (request !== overviewRequest) return;
        if (snapshot.moduleId !== module.id || !snapshot.revision || !Array.isArray(snapshot.tree) || !snapshot.pages) throw new Error("Invalid published adventure.");
        const scope = campaignScope(new URL(apiBaseUrl, location.href).href, ownerId, module.id);
        const store = serverCampaignStore(ownerId, module.id);
        let legacyStore;
        try { legacyStore = campaignStore(window.indexedDB, scope); } catch {}
        await openCampaigns({ snapshot, moduleTitle: module.title, ownerId, store, legacyStore, readerUrl: url.href, exit: () => {
          overviewPanel.classList.remove("hidden");
          document.querySelector(".intro").hidden = false;
        }, isCurrent: () => request === overviewRequest });
        if (request !== overviewRequest) return;
        overviewPanel.classList.add("hidden");
        document.querySelector(".intro").hidden = true;
        note.textContent = "Full publication ready.";
      } catch (error) {
        if (request === overviewRequest) note.textContent = "Could not open the published tree. " + error.message;
      } finally {
        if (request === overviewRequest) open.disabled = false;
      }
    };
    open.disabled = false;
  } catch (error) {
    if (request === overviewRequest) note.textContent = error.message || "Could not load the full syndication.";
  }
}
$("open-overview-button").addEventListener("click", openOverview);
$("back-button").addEventListener("click", () => {
  ++overviewRequest;
  overviewPanel.classList.add("hidden");
  modulePanel.classList.remove("hidden");
});
