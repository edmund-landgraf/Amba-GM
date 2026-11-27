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
connectButton.addEventListener("click", () => void loadModules());
$("refresh-button").addEventListener("click", () => void loadModules());
$("module-select").addEventListener("change", (event) => {
  renderSelectedModule(state.modules.find((module) => module.id === event.target.value) || null);
});
