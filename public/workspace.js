function element(tag, text) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  return el;
}

function button(label, click) {
  const el = element("button", label);
  el.type = "button";
  el.addEventListener("click", click);
  return el;
}

export function openWorkspace(snapshot, moduleTitle, ownerId, exit) {
  const root = element("section");
  root.className = "gm-workspace";
  const back = button("Back to overview", () => { root.remove(); exit(); });
  const heading = element("h2", moduleTitle);
  const layout = element("div");
  layout.className = "gm-layout";
  const nav = element("nav");
  nav.setAttribute("aria-label", "Published adventure");
  const page = element("article");
  const pcs = new Map();
  let selectedPc = "";
  let currentButton;
  const storageKey = ownerId && JSON.stringify(["gm-session", ownerId, snapshot.moduleId, snapshot.revision]);
  let history = [];
  if (storageKey) {
    try { history = JSON.parse(sessionStorage.getItem(storageKey) || "[]"); } catch {}
  }
  if (!Array.isArray(history)) history = [];
  const feedback = element("p");
  feedback.setAttribute("role", "status");

  function save() {
    if (!storageKey) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(history)); }
    catch { feedback.textContent += " Browser storage is unavailable. Keep this view open."; }
  }

  function show(id) {
    const data = snapshot.pages[id];
    if (!data) return;
    page.replaceChildren(element("h2", data.title));
    if (data.subtitle) page.append(element("p", data.subtitle));
    if (data.bodyHtml) {
      const frame = element("iframe");
      frame.title = data.title + " published content";
      frame.setAttribute("sandbox", "");
      frame.referrerPolicy = "no-referrer";
      frame.srcdoc = '<meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; img-src https: data:; style-src &apos;unsafe-inline&apos;; base-uri &apos;none&apos;; form-action &apos;none&apos;"><style>body{font:1rem/1.55 system-ui;color:#21372d}img,table{max-width:100%}</style>' + data.bodyHtml;
      page.append(frame);
    }
    const log = element("section");
    function renderLog() {
      log.replaceChildren();
      for (const entry of history.filter(item => item.pageId === id)) {
        const row = element("p", entry.actor + " · " + entry.table + " · " + entry.label + " ");
        row.append(button("Undo", () => {
          history = history.filter(item => item.key !== entry.key);
          feedback.textContent = "Outcome removed.";
          save();
          renderLog();
        }));
        log.append(row);
      }
    }
    for (const table of data.challenges) {
      const block = element("section");
      block.append(element("h3", table.title), element("p", [...(table.check.skills || []), "DC " + (table.check.dcLabel || table.check.dc)].join(" · ")));
      for (const [degree, label] of Object.entries({ criticalSuccess:"Critical success", success:"Success", failure:"Failure", criticalFailure:"Critical failure" })) {
        if (!table.degrees[degree]) continue;
        block.append(button(label, () => {
          const actor = pcs.get(selectedPc) || "Party";
          history.push({ key:crypto.randomUUID(), pageId:id, tableId:table.id, table:table.title, pcId:selectedPc || null, actor, degree, label });
          feedback.textContent = actor + " · " + label + ". " + table.degrees[degree];
          selectPc("");
          save();
          renderLog();
        }));
      }
      page.append(block);
    }
    feedback.textContent = "";
    renderLog();
    page.append(feedback, log);
  }

  function collectPcs(nodes) {
    for (const node of nodes) {
      if (node.kind === "pc" && node.pageId) pcs.set(node.pageId, node.title);
      if (node.children) collectPcs(node.children);
    }
  }
  collectPcs(snapshot.tree);

  function tree(nodes, depth) {
    const list = element("ul");
    for (const node of nodes) {
      const item = element("li");
      const title = [node.areaCode, node.title].filter(Boolean).join(" ");
      let row = item;
      if (node.children?.length) {
        const branch = element("details");
        branch.open = depth === 0;
        const summary = element("summary");
        branch.append(summary);
        const populate = () => {
          if (branch.open && branch.children.length === 1) branch.append(tree(node.children, depth + 1));
        };
        branch.addEventListener("toggle", populate);
        populate();
        item.append(branch);
        row = summary;
      }
      if (node.pageId && Object.hasOwn(snapshot.pages, node.pageId)) {
        const choice = button(title, () => {
          currentButton?.removeAttribute("aria-current");
          currentButton = choice;
          choice.setAttribute("aria-current", "page");
          show(node.pageId);
        });
        row.append(choice);
      } else row.append(document.createTextNode(title));
      list.append(item);
    }
    return list;
  }

  nav.append(tree(snapshot.tree, 0));
  const roster = element("fieldset");
  roster.append(element("legend", "Record for"));
  function selectPc(id) {
    selectedPc = id;
    for (const control of roster.querySelectorAll("button")) control.setAttribute("aria-pressed", String(control.dataset.pc === id));
  }
  for (const [id, name] of [["", "Party"], ...pcs]) {
    const control = button(name, () => selectPc(selectedPc === id ? "" : id));
    control.dataset.pc = id;
    roster.append(control);
  }
  selectPc("");
  const sidebar = element("aside");
  sidebar.append(roster, nav);
  layout.append(sidebar, page);
  root.append(back, heading, layout);
  document.getElementById("overview-panel").after(root);
  show(snapshot.pages[snapshot.moduleId] ? snapshot.moduleId : Object.keys(snapshot.pages)[0]);
}
