import { openWorkspace } from "./workspace.js";
const config = window.AMBA_GM_CONFIG || {};
const apiBaseUrl = String(config.apiBaseUrl || "/api/v1").replace(/\/$/, "");
const appUrl = String(config.appUrl || apiBaseUrl.replace(/\/api\/v1$/, "")).replace(/\/$/, "");

const state = { modules: [], selectedModule: null, user: null };
const $ = (id) => document.getElementById(id);
const connectButton = $("connect-button");
const modulePanel = $("module-panel");
const overviewPanel = $("overview-panel");
const message = $("message");

$("open-amba").href = appUrl;

function setMessage(text = "", kind = "") {
  message.textContent = text;
  message.dataset.kind = kind;
}

function setConnected(connected) {
  $("connection-state").textContent = connected ? "Connected to AMBA" : "Not connected";
  $("connection-state").classList.toggle("connected", connected);
  $("connect-panel").classList.toggle("hidden", connected);
  modulePanel.classList.toggle("hidden", !connected);
}

function errorMessage(status) {
  if (status === 401) return "AMBA sign-in is required. Sign in to AMBA, then return here and connect again.";
  if (status === 403) return "AMBA denied access to this module list.";
  return `AMBA returned an error (${status}). Check the connection settings and try again.`;
}

async function apiGet(path) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw Object.assign(new Error(errorMessage(response.status)), { status: response.status });
  return response.json();
}

function displayModuleTitle(module) {
  const status = module.publicationStatus === "published" ? "Published" : "Draft";
  return `${module.title} · ${status}`;
}

function loadModuleOptions() {
  const select = $("module-select");
  select.replaceChildren(new Option("Choose a module…", ""));
  for (const module of state.modules) {
    select.add(new Option(displayModuleTitle(module), module.id));
  }
}

function renderSelectedModule(module) {
  const card = $("module-card");
  state.selectedModule = module || null;
  $("open-overview-button").disabled = !module;
  card.classList.toggle("hidden", !module);
  card.replaceChildren();
  if (!module) return;

  const title = document.createElement("h3");
  title.textContent = module.title;
  const details = document.createElement("p");
  details.className = "muted";
  details.textContent = [module.setting, module.levelRange, module.ruleset].filter(Boolean).join(" · ") || "Adventure module";
  const status = document.createElement("span");
  status.className = `status ${module.publicationStatus === "published" ? "published" : "draft"}`;
  status.textContent = module.publicationStatus === "published" ? "Published" : "Draft";
  card.append(title, details, status);
}

async function loadModules() {
  setMessage("Loading your AMBA module list…");
  connectButton.disabled = true;
  try {
    const [user, modules] = await Promise.all([apiGet("/auth/me"), apiGet("/modules?status=both")]);
    if (!Array.isArray(modules)) throw new Error("AMBA returned an unexpected module list.");
    state.user = user;
    state.modules = modules.filter((item) => item && typeof item.id === "string" && typeof item.title === "string");
    loadModuleOptions();
    setConnected(true);
    renderSelectedModule(null);
    setMessage(state.modules.length ? `${state.modules.length} modules available from AMBA.` : "Your AMBA account has no modules yet.");
  } catch (error) {
    setConnected(false);
    setMessage(error instanceof Error ? error.message : "Could not connect to AMBA.", "error");
  } finally {
    connectButton.disabled = false;
  }
}

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
  open.textContent = "Open GM workspace";
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
        const snapshot = await apiGet(`/modules/${encodeURIComponent(module.id)}/syndication/gm`);
        if (request !== overviewRequest) return;
        openWorkspace(snapshot, module.title, state.user?.user?.id || state.user?.id, () => {
          overviewPanel.classList.remove("hidden");
          document.querySelector(".intro").hidden = false;
        });
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

connectButton.addEventListener("click", () => void loadModules());
$("refresh-button").addEventListener("click", () => void loadModules());
$("module-select").addEventListener("change", (event) => {
  renderSelectedModule(state.modules.find((module) => module.id === event.target.value) || null);
});
$("open-overview-button").addEventListener("click", openOverview);
$("back-button").addEventListener("click", () => {
  ++overviewRequest;
  overviewPanel.classList.add("hidden");
  modulePanel.classList.remove("hidden");
});
