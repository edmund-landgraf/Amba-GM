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

function openOverview() {
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
  $("overview-note").textContent = module.publicationStatus === "published"
    ? "This overview comes from AMBA's module list. Opening a campaign will use a frozen published snapshot after the GM snapshot API is connected."
    : "This module is still a draft. Publish it in AMBA before loading it as a campaign.";
  $("start-button").disabled = module.publicationStatus !== "published";
  setMessage("");
}

connectButton.addEventListener("click", () => void loadModules());
$("refresh-button").addEventListener("click", () => void loadModules());
$("module-select").addEventListener("change", (event) => {
  renderSelectedModule(state.modules.find((module) => module.id === event.target.value) || null);
});
$("open-overview-button").addEventListener("click", openOverview);
$("back-button").addEventListener("click", () => {
  overviewPanel.classList.add("hidden");
  modulePanel.classList.remove("hidden");
});
