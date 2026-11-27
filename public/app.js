import { markup as modulesView } from "./src/pages/modules/view.js";
import { markup as overviewView } from "./src/pages/overview/view.js";
import { appUrl } from "./src/services/amba.js";

const message = document.getElementById("message");
if (!document.getElementById("module-panel")) {
  message.insertAdjacentHTML("beforebegin", modulesView + overviewView);
}
document.getElementById("open-amba").href = appUrl;
await import("./src/pages/modules/index.js");
await import("./src/pages/overview/index.js");
