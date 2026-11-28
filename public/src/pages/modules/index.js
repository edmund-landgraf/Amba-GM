import { $ } from "../../components/dom.js";
import { setMessage } from "../../components/status.js";
import { state } from "../../application/session.js";
import { apiGet } from "../../services/amba.js";

const connectButton = $("connect-button");
const modulePanel = $("module-panel");

function setConnected(connected) {
  $("connection-state").textContent = connected ? "Connected to AMBA" : "Not connected";
  $("connection-state").classList.toggle("connected", connected);
  $("connect-panel").classList.toggle("hidden", connected);
  modulePanel.classList.toggle("hidden", !connected);
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
  details.textContent = [module.setting, module.levelRange, module.ruleset].filter(Boolean).join(" · ") || "Owned published module";
  const status = document.createElement("span");
  status.className = `status ${module.publicationStatus === "published" ? "published" : "draft"}`;
  status.textContent = module.publicationStatus === "published" ? "Published" : "Draft";
  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "Play from the full published adventure. Draft edits stay in Authoring until the next publication.";
  card.append(title, details, status, hint);
}

function loadModuleOptions() {
  const list = $("module-list");
  list.replaceChildren();
  if (!state.modules.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No published modules yet.";
    list.append(empty);
    return;
  }
  for (const module of state.modules) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "module-row" + (state.selectedModule?.id === module.id ? " selected" : "");
    row.setAttribute("aria-pressed", String(state.selectedModule?.id === module.id));
    const name = document.createElement("strong");
    name.textContent = module.title;
    const meta = document.createElement("span");
    meta.className = "muted";
    meta.textContent = [module.ruleset, module.publicationStatus === "published" ? "Published" : "Draft"].filter(Boolean).join(" · ");
    row.append(name, meta);
    row.addEventListener("click", () => {
      renderSelectedModule(module);
      loadModuleOptions();
    });
    list.append(row);
  }
}

async function loadModules() {
  setMessage("Loading your AMBA module list…");
  connectButton.disabled = true;
  try {
    const [user, modules] = await Promise.all([apiGet("/auth/me"), apiGet("/modules?status=published")]);
    if (!Array.isArray(modules)) throw new Error("AMBA returned an unexpected module list.");
    state.user = user;
    state.modules = modules.filter((item) => item && typeof item.id === "string" && typeof item.title === "string");
    setConnected(true);
    renderSelectedModule(state.modules.length === 1 ? state.modules[0] : null);
    loadModuleOptions();
    setMessage(state.modules.length
      ? `${state.modules.length} published module${state.modules.length === 1 ? "" : "s"} ready for Play Now.`
      : "No published modules yet. Publish full syndication in AMBA authoring first.");
  } catch (error) {
    setConnected(false);
    setMessage(error instanceof Error ? error.message : "Could not connect to AMBA.", "error");
  } finally {
    connectButton.disabled = false;
  }
}
connectButton.addEventListener("click", () => void loadModules());
$("refresh-button").addEventListener("click", () => void loadModules());
void loadModules();
