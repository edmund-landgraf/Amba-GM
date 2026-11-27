import { element, button } from "../../components/dom.js";
import { renderPublishedContent } from "./published-content.js";
import { availableDegrees, degreeLabels, outcomeStorageKey, readOutcomes, writeOutcomes, createOutcome, correctOutcome, removeOutcome, outcomeNarrative } from "../../domain/outcomes.js";

export function openWorkspace(snapshot, moduleTitle, ownerId, exit, readerUrl) {
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
  const storageKey = outcomeStorageKey(ownerId, snapshot);
  let storage;
  try { storage = window.sessionStorage; } catch {}
  const loaded = readOutcomes(storage, storageKey);
  let history = loaded.records;
  let writable = loaded.writable;
  const storageStatus = element("p", loaded.warning);
  storageStatus.setAttribute("role", "status");
  storageStatus.hidden = !loaded.warning;
  const feedback = element("p");
  feedback.setAttribute("role", "status");

  function save() {
    if (!writable) return;
    if (!writeOutcomes(storage, storageKey, history)) {
      writable = false;
      storageStatus.hidden = false;
      storageStatus.textContent = "Browser storage is unavailable. New changes are temporary; keep this view open.";
    }
  }

  function renderHistory(log, pageId = null) {
    log.replaceChildren(element("h3", pageId ? "Recorded outcomes" : "Outcome history"));
    const entries = history.filter(item => pageId === null || item.pageId === pageId);
    if (!entries.length) log.append(element("p", "No accepted outcomes yet."));
    for (const entry of entries) {
      const source = Object.hasOwn(snapshot.pages, entry.pageId) ? snapshot.pages[entry.pageId] : null;
      const table = source?.challenges?.find(check => check.id === entry.tableId);
      const row = element("section");
      row.append(element("h4", entry.actor + " · " + entry.table + " · " + entry.label));
      if (!pageId) row.append(element("p", source?.title || "Source page unavailable"));
      row.append(element("p", outcomeNarrative(entry, table) || "Authored result text unavailable."));
      row.append(element("small", entry.recordedAt ? "Recorded " + new Date(entry.recordedAt).toLocaleString() : "Original recording time unavailable"));
      if (entry.correctedAt) row.append(element("p", "Corrected " + new Date(entry.correctedAt).toLocaleString()));
      const choices = availableDegrees(table).filter(degree => degree !== entry.degree);
      if (choices.length) {
        const details = element("details");
        details.append(element("summary", "Correct result"));
        for (const degree of choices) {
          const control = button(degreeLabels[degree], () => {
            history = correctOutcome(history, entry.key, { pageId: entry.pageId, table, degree, correctedAt: new Date().toISOString() });
            feedback.textContent = "Outcome corrected.";
            save();
            renderHistory(log, pageId);
          });
          control.setAttribute("aria-label", "Correct " + entry.table + " to " + degreeLabels[degree]);
          details.append(control, element("p", table.degrees[degree]));
        }
        row.append(details);
      }
      row.append(button("Remove outcome", () => {
        history = removeOutcome(history, entry.key);
        feedback.textContent = "Outcome removed.";
        save();
        renderHistory(log, pageId);
      }));
      log.append(row);
    }
  }

  function showHistory() {
    currentButton?.removeAttribute("aria-current");
    currentButton = undefined;
    page.replaceChildren(element("h2", "Outcome history"));
    const log = element("section");
    feedback.textContent = "";
    page.append(feedback, log);
    renderHistory(log);
  }

  function show(id) {
    if (!Object.hasOwn(snapshot.pages, id)) return;
    const data = snapshot.pages[id];
    page.replaceChildren(element("h2", data.title));
    if (data.subtitle) page.append(element("p", data.subtitle));
    renderPublishedContent(page, data);
    const log = element("section");
    for (const table of data.challenges || []) {
      const block = element("section");
      block.append(element("h3", table.title), element("p", [...(table.check.skills || []), "DC " + (table.check.dcLabel || table.check.dc)].join(" · ")));
      for (const degree of availableDegrees(table)) {
        block.append(button(degreeLabels[degree], () => {
          const actor = pcs.get(selectedPc) || "Party";
          const record = createOutcome({
            key: crypto.randomUUID(), pageId: id, table, pcId: selectedPc || null,
            actor, degree, recordedAt: new Date().toISOString(),
          });
          history.push(record);
          feedback.textContent = actor + " · " + record.label + ". " + record.outcomeText;
          selectPc("");
          save();
          renderHistory(log, id);
        }));
      }
      page.append(block);
    }
    feedback.textContent = "";
    page.append(feedback, log);
    renderHistory(log, id);
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

  const moduleRoot = snapshot.tree.find(node => node.kind === "module");
  const acts = moduleRoot?.children?.find(node => node.typeKey === "acts");
  const storyTypes = new Set(["act", "scene", "subscene", "encounter", "folder"]);
  function storyNodes(nodes) {
    return nodes.flatMap(node => {
      if (node.kind !== "narrative" && !(node.kind === "container" && storyTypes.has(node.typeKey))) return [];
      const children = storyNodes(node.children || []);
      return node.typeKey === "folder" && !children.length ? [] : [{ ...node, children }];
    });
  }
  const story = storyNodes(acts?.children || []);
  nav.setAttribute("aria-label", "Story acts");
  nav.append(tree(story, 0));
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
  sidebar.append(roster, button("Outcome history", showHistory), nav);
  layout.append(sidebar, page);
  const reader = element("a", "Read full syndication");
  reader.href = readerUrl;
  reader.target = "_blank";
  reader.rel = "noopener noreferrer";
  root.append(back, reader, heading, storageStatus, layout);
  document.getElementById("overview-panel").after(root);
  const first = nav.querySelector("button");
  if (first) first.click();
  else page.append(element("p", story.length ? "Expand an act to choose a story node." : "This publication has no story acts."));
}
