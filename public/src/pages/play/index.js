import { element, button } from "../../components/dom.js";
import { renderPublishedContent } from "./published-content.js";
import { availableDegrees, degreeLabels, outcomeNarrative } from "../../domain/outcomes.js";
import { activeSession } from "../../domain/campaigns.js";
import { collectPlayerCharacters, containsPage, projectStoryActs } from "../../domain/story-tree.js";
import { renderSessionControls } from "./session-controls.js";

export function openWorkspace(snapshot, moduleTitle, initialCampaign, store, exit, readerUrl, mountAfter) {
  let campaign = initialCampaign;
  let busy = false;
  let currentId = null;
  let historyView = false;
  let closed = false;
  const root = element("section");
  root.className = "gm-workspace";
  const back = button("Back to campaigns", () => { if (busy) return; closed = true; root.remove(); exit(); });
  const heading = element("h2", moduleTitle);
  const layout = element("div");
  layout.className = "gm-layout";
  const nav = element("nav");
  nav.setAttribute("aria-label", "Published adventure");
  const page = element("article");
  const pcs = new Map();
  let selectedPc = "";
  let currentButton;
  const sessionControls = element("section");
  const feedback = element("p");
  feedback.setAttribute("role", "status");

  function refreshControls() {
    renderSessionControls(sessionControls, campaign, {
      busy,
      start: () => void mutate({ type: "start", sessionId: crypto.randomUUID(), pageId: currentId }, "Session started."),
      end: () => {
        const active = activeSession(campaign);
        if (!busy && active && window.confirm("End session " + active.number + "? Recorded outcomes will remain available."))
          void mutate({ type: "end", sessionId: active.id }, "Session ended.");
      },
      history: () => { if (!busy) showHistory(); },
    });
  }

  async function mutate(command, message, after) {
    if (busy || closed) return false;
    busy = true;
    root.setAttribute("aria-busy", "true");
    refreshControls();
    feedback.textContent = "";
    let succeeded = false;
    try {
      campaign = await store.change({ id: campaign.id, revision: snapshot.revision, expectedVersion: campaign.version, command });
      succeeded = true;
    } catch (error) {
      feedback.textContent = error.message || "Campaign update failed. Nothing was recorded.";
    } finally {
      busy = false;
      root.removeAttribute("aria-busy");
      refreshControls();
    }
    if (!succeeded || closed) return false;
    if (after) after();
    else if (historyView) showHistory();
    else if (currentId) show(currentId);
    feedback.textContent = message;
    return true;
  }

  function renderHistory(log, pageId = null) {
    log.replaceChildren(element("h3", pageId ? "Recorded outcomes" : "Outcome history"));
    const entries = campaign.outcomes.filter(item => pageId === null || item.pageId === pageId);
    if (!entries.length) log.append(element("p", "No accepted outcomes yet."));
    for (const entry of entries) {
      const source = Object.hasOwn(snapshot.pages, entry.pageId) ? snapshot.pages[entry.pageId] : null;
      const table = source?.challenges?.find(check => check.id === entry.tableId);
      const row = element("section");
      row.append(element("h4", entry.actor + " � " + entry.table + " � " + entry.label));
      const session = campaign.sessions.find(s => s.id === entry.sessionId);
      row.append(element("p", "Session " + (session?.number ?? "?") + (pageId ? "" : " � " + (source?.title || "Source page unavailable"))));
      row.append(element("p", outcomeNarrative(entry, table) || "Authored result text unavailable."));
      row.append(element("small", entry.recordedAt ? "Recorded " + new Date(entry.recordedAt).toLocaleString() : "Original recording time unavailable"));
      if (entry.correctedAt) row.append(element("p", "Corrected " + new Date(entry.correctedAt).toLocaleString()));
      const choices = availableDegrees(table).filter(degree => degree !== entry.degree);
      if (choices.length) {
        const details = element("details");
        details.append(element("summary", "Correct result"));
        for (const degree of choices) {
          const control = button(degreeLabels[degree], () => {
            void mutate({ type: "correct", key: entry.key, pageId: entry.pageId, table, degree }, "Outcome corrected.");
          });
          control.setAttribute("aria-label", "Correct " + entry.table + " to " + degreeLabels[degree]);
          details.append(control, element("p", table.degrees[degree]));
        }
        row.append(details);
      }
      row.append(button("Remove outcome", () => {
        void mutate({ type: "remove", key: entry.key }, "Outcome removed.");
      }));
      log.append(row);
    }
  }

  function showHistory() {
    currentButton?.removeAttribute("aria-current");
    currentButton = undefined;
    historyView = true;
    page.replaceChildren(element("h2", "Session and outcome history"));
    const sessions = element("section");
    sessions.append(element("h3", "Sessions"));
    if (!campaign.sessions.length) sessions.append(element("p", "No sessions yet."));
    for (const session of campaign.sessions) {
      const count = campaign.outcomes.filter(o => o.sessionId === session.id).length;
      sessions.append(element("h4", "Session " + session.number + (session.endedAt ? " � Completed" : " � Active")));
      sessions.append(element("p", new Date(session.startedAt).toLocaleString() +
        (session.endedAt ? " - " + new Date(session.endedAt).toLocaleString() : "") + " � " + count + " accepted outcomes"));
    }
    const log = element("section");
    feedback.textContent = "";
    page.append(sessions, log);
    renderHistory(log);
  }

  function show(id) {
    if (!Object.hasOwn(snapshot.pages, id)) return;
    historyView = false;
    currentId = id;
    const data = snapshot.pages[id];
    page.replaceChildren(element("h2", data.title));
    if (data.subtitle) page.append(element("p", data.subtitle));
    renderPublishedContent(page, data);
    const log = element("section");
    for (const table of data.challenges || []) {
      const block = element("section");
      block.append(element("h3", table.title), element("p", [...(table.check.skills || []), "DC " + (table.check.dcLabel || table.check.dc)].join(" � ")));
      for (const degree of availableDegrees(table)) {
        const accept = button(degreeLabels[degree], () => {
          const session = activeSession(campaign);
          if (!session || busy) return;
          const actor = pcs.get(selectedPc) || "Party";
          void mutate({ type: "accept", sessionId: session.id, key: crypto.randomUUID(), pageId: id, table,
            pcId: selectedPc || null, actor, degree }, actor + " � " + degreeLabels[degree] + ". " + table.degrees[degree], () => {
            selectPc("");
            show(id);
          });
        });
        accept.disabled = !activeSession(campaign);
        block.append(accept);
      }
      page.append(block);
    }
    feedback.textContent = "";
    page.append(log);
    renderHistory(log, id);
  }

  for (const [id, title] of collectPlayerCharacters(snapshot.tree)) pcs.set(id, title);

  function tree(nodes, depth) {
    const list = element("ul");
    for (const node of nodes) {
      const item = element("li");
      const title = [node.areaCode, node.title].filter(Boolean).join(" ");
      let row = item;
      if (node.children?.length) {
        const branch = element("details");
        branch.open = depth === 0 || containsPage(node, campaign.lastPageId);
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
          if (busy) return;
          const open = () => {
            currentButton?.removeAttribute("aria-current");
            currentButton = choice;
            choice.setAttribute("aria-current", "page");
            show(node.pageId);
          };
          const active = activeSession(campaign);
          if (active && campaign.lastPageId !== node.pageId) {
            void mutate({ type: "position", sessionId: active.id, pageId: node.pageId }, "", open);
          } else open();
        });
        choice.dataset.pageId = node.pageId;
        row.append(choice);
      } else row.append(document.createTextNode(title));
      list.append(item);
    }
    return list;
  }

  const story = projectStoryActs(snapshot.tree);
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
  sidebar.append(sessionControls, roster, nav);
  layout.append(sidebar, page);
  const reader = element("a", "Read full syndication");
  reader.href = readerUrl;
  reader.target = "_blank";
  reader.rel = "noopener noreferrer";
  root.append(back, reader, heading, feedback, layout);
  mountAfter.after(root);
  refreshControls();
  const choices = [...nav.querySelectorAll("button[data-page-id]")];
  const first = choices.find(choice => choice.dataset.pageId === campaign.lastPageId) || choices[0];
  if (first) {
    currentButton = first;
    first.setAttribute("aria-current", "page");
    show(first.dataset.pageId);
  }
  else page.append(element("p", story.length ? "Expand an act to choose a story node." : "This publication has no story acts."));
}


