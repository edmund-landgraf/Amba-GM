import { element, button } from "../../components/dom.js";
import { renderPublishedContent } from "./published-content.js";
import { availableDegrees, degreeLabels, outcomeNarrative } from "../../domain/outcomes.js";
import { activeSession } from "../../domain/campaigns.js";
import { collectPlayerCharacters, containsPage, filterStoryTree, groupPagesByPlace, projectStoryActs } from "../../domain/story-tree.js";
import { renderSessionControls } from "./session-controls.js";

export function openWorkspace(snapshot, moduleTitle, initialCampaign, store, exit, readerUrl, mountAfter) {
  let campaign = initialCampaign;
  let busy = false;
  let currentId = null;
  let activeTab = "run";
  let closed = false;
  const root = element("section");
  root.className = "gm-workspace";
  const pageShell = document.getElementById("app");
  pageShell?.classList.add("gm-wide");
  const back = button("Back to campaigns", () => {
    if (busy) return;
    closed = true;
    pageShell?.classList.remove("gm-wide");
    root.remove();
    exit();
  });
  const heading = element("h2", moduleTitle);
  const layout = element("div");
  layout.className = "gm-layout";
  const nav = element("nav");
  nav.setAttribute("aria-label", "Published adventure");
  const page = element("article");
  const tabBar = element("p");
  tabBar.className = "gm-tabs";
  tabBar.setAttribute("role", "tablist");
  const pcs = new Map();
  let selectedPc = "";
  let currentButton;
  const sessionControls = element("section");
  const feedback = element("p");
  feedback.setAttribute("role", "status");
  const tabButtons = {};

  function setTab(tab) {
    activeTab = tab;
    for (const [name, control] of Object.entries(tabButtons)) {
      const selected = name === tab;
      control.setAttribute("aria-selected", String(selected));
      control.classList.toggle("active", selected);
    }
    if (tab === "run" && currentId) show(currentId);
    else if (tab === "history") showHistory();
    else if (tab === "campaign") showCampaign();
  }

  for (const [id, label] of [["run", "Run"], ["campaign", "Campaign"], ["history", "History"]]) {
    const tab = button(label, () => { if (!busy) setTab(id); });
    tab.setAttribute("role", "tab");
    tabButtons[id] = tab;
    tabBar.append(tab);
  }

  function refreshControls() {
    renderSessionControls(sessionControls, campaign, {
      busy,
      revision: snapshot.revision,
      start: () => void mutate({ type: "start", sessionId: crypto.randomUUID(), pageId: currentId }, "Session started."),
      end: () => {
        const active = activeSession(campaign);
        if (!busy && active && window.confirm("End session " + active.number + "? Recorded outcomes will remain available."))
          void mutate({ type: "end", sessionId: active.id }, "Session ended.");
      },
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
      feedback.textContent = (error.message || "Campaign update failed.") + " Reopen the campaign to confirm its saved state.";
    } finally {
      busy = false;
      root.removeAttribute("aria-busy");
      refreshControls();
    }
    if (!succeeded || closed) return false;
    if (after) after();
    else if (activeTab === "history") showHistory();
    else if (activeTab === "campaign") showCampaign();
    else if (currentId) show(currentId);
    if (message) feedback.textContent = message;
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
      row.append(element("h4", entry.actor + " · " + entry.table + " · " + entry.label));
      const session = campaign.sessions.find(s => s.id === entry.sessionId);
      row.append(element("p", "Session " + (session?.number ?? "?") + (pageId ? "" : " · " + (source?.title || "Source page unavailable"))));
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

  function openPageFromCampaign(pageId) {
    activeTab = "run";
    setTab("run");
    const choice = nav.querySelector('button[data-page-id="' + pageId + '"]');
    if (choice) choice.click();
  }

  function fillPage(title, ...nodes) {
    page.replaceChildren(tabBar, element("h2", title), ...nodes);
  }

  function showCampaign() {
    currentButton?.removeAttribute("aria-current");
    const places = element("section");
    places.append(element("h3", "Locations"));
    const pageIds = [...new Set([...campaign.outcomes.map(o => o.pageId), campaign.lastPageId].filter(Boolean))];
    const groups = groupPagesByPlace(story, pageIds);
    if (!pageIds.length) places.append(element("p", "No campaign position or outcomes yet."));
    else if (!groups.length) {
      for (const pageId of pageIds) {
        const data = snapshot.pages[pageId];
        const count = campaign.outcomes.filter(o => o.pageId === pageId).length;
        const card = element("section");
        card.className = "place-card";
        card.append(element("strong", data?.title || pageId));
        card.append(element("p", count + " recorded outcome" + (count === 1 ? "" : "s")));
        if (data) card.append(button("Open in Run tab", () => openPageFromCampaign(pageId)));
        places.append(card);
      }
    } else {
      for (const group of groups) {
        places.append(element("h4", group.placeTitle));
        for (const page of group.pages) {
          const count = campaign.outcomes.filter(o => o.pageId === page.pageId).length;
          const card = element("section");
          card.className = "place-card";
          card.append(element("strong", [page.areaCode, page.title].filter(Boolean).join(" ")));
          card.append(element("p", count + " recorded outcome" + (count === 1 ? "" : "s")));
          card.append(button("Open in Run tab", () => openPageFromCampaign(page.pageId)));
          places.append(card);
        }
      }
    }
    const timeline = element("section");
    timeline.append(element("h3", "Recent campaign history"));
    const ordered = [...campaign.outcomes].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    if (!ordered.length) timeline.append(element("p", "No campaign records yet."));
    for (const entry of ordered.slice(0, 12)) {
      const source = snapshot.pages[entry.pageId];
      const event = element("p");
      event.append(element("strong", (source?.title || entry.pageId) + " · " + entry.label));
      event.append(document.createTextNode(" — " + entry.actor + " · " + new Date(entry.recordedAt).toLocaleString()));
      timeline.append(event);
    }
    fillPage("Locations and campaign history", places, timeline);
    feedback.textContent = "";
  }

  function showHistory() {
    currentButton?.removeAttribute("aria-current");
    currentButton = undefined;
    const sessions = element("section");
    sessions.append(element("h3", "Sessions"));
    if (!campaign.sessions.length) sessions.append(element("p", "No sessions yet."));
    for (const session of campaign.sessions) {
      const count = campaign.outcomes.filter(o => o.sessionId === session.id).length;
      sessions.append(element("h4", "Session " + session.number + (session.endedAt ? " · Completed" : " · Active")));
      sessions.append(element("p", new Date(session.startedAt).toLocaleString() +
        (session.endedAt ? " - " + new Date(session.endedAt).toLocaleString() : "") + " · " + count + " accepted outcomes"));
    }
    const log = element("section");
    renderHistory(log);
    fillPage("Session and outcome history", sessions, log);
    feedback.textContent = "";
  }

  function show(id) {
    if (!Object.hasOwn(snapshot.pages, id)) return;
    currentId = id;
    const data = snapshot.pages[id];
    const heading = [];
    if (data.subtitle) heading.push(element("p", data.subtitle));
    const columns = element("div");
    columns.className = "gm-node-panels";
    const read = element("section");
    read.append(element("h3", "At a glance"));
    const chips = element("p");
    chips.className = "gm-chips";
    const challengeCount = data.challenges?.length || 0;
    chips.append(
      Object.assign(element("span", "Narrative"), { className: "chip" }),
      Object.assign(element("span", challengeCount + " challenge" + (challengeCount === 1 ? "" : "s")), { className: "chip" }),
    );
    read.append(chips);
    renderPublishedContent(read, data);
    read.append(element("p", "Published material only — no authoring controls."));
    const actions = element("section");
    actions.append(element("h3", "Record what happened"));
    for (const table of data.challenges || []) {
      const block = element("section");
      block.className = "challenge-block";
      block.append(element("h4", table.title), element("p", [...(table.check.skills || []), "DC " + (table.check.dcLabel || table.check.dc)].join(" · ")));
      const recorded = campaign.outcomes.filter(item => item.pageId === id && item.tableId === table.id);
      if (recorded.length) {
        const latest = recorded[recorded.length - 1];
        const accepted = element("p");
        accepted.className = "accepted-result";
        accepted.append(element("strong", "Recorded · " + latest.actor + " · " + latest.label));
        accepted.append(document.createTextNode(" — " + (latest.outcomeText || "")));
        block.append(accepted);
      }
      for (const degree of availableDegrees(table)) {
        const row = element("div");
        row.className = "degree-row";
        const accept = button(degreeLabels[degree], () => {
          const session = activeSession(campaign);
          if (!session || busy) return;
          const actor = pcs.get(selectedPc) || "Party";
          void mutate({ type: "accept", sessionId: session.id, key: crypto.randomUUID(), pageId: id, table,
            pcId: selectedPc || null, actor, degree }, actor + " · " + degreeLabels[degree] + ". " + table.degrees[degree], () => {
            selectPc("");
            show(id);
          });
        });
        accept.disabled = !activeSession(campaign);
        accept.classList.add("degree-btn");
        row.append(accept, element("p", table.degrees[degree]));
        block.append(row);
      }
      const dispositions = element("div");
      dispositions.className = "degree-row";
      for (const type of ["skip", "notApplicable"]) {
        const label = type === "skip" ? "Skip" : "Not applicable";
        const control = button(label, () => {
          const session = activeSession(campaign);
          if (!session || busy) return;
          const actor = pcs.get(selectedPc) || "Party";
          void mutate({ type, sessionId: session.id, key: crypto.randomUUID(), pageId: id, table,
            pcId: selectedPc || null, actor }, actor + " · " + label, () => {
            selectPc("");
            show(id);
          });
        });
        control.disabled = !activeSession(campaign);
        control.classList.add("degree-btn", "secondary");
        dispositions.append(control);
      }
      block.append(dispositions);
      actions.append(block);
    }
    if (!data.challenges?.length) actions.append(element("p", "This node has no authored challenge buttons."));
    const log = element("section");
    renderHistory(log, id);
    actions.append(log);
    columns.append(read, actions);
    fillPage(data.title, ...heading, columns);
    feedback.textContent = "";
  }

  const party = Array.isArray(initialCampaign.partyPcIds) ? initialCampaign.partyPcIds : null;
  for (const [id, title] of collectPlayerCharacters(snapshot.tree)) {
    if (!party || party.includes(id)) pcs.set(id, title);
  }

  let treeQuery = "";
  function tree(nodes, depth, forceOpen) {
    const list = element("ul");
    for (const node of nodes) {
      const item = element("li");
      const title = [node.areaCode, node.title].filter(Boolean).join(" ");
      let row = item;
      if (node.children?.length) {
        const branch = element("details");
        branch.open = forceOpen || depth <= 1 || containsPage(node, campaign.lastPageId);
        const summary = element("summary");
        branch.append(summary);
        const populate = () => {
          if (branch.open && branch.children.length === 1) branch.append(tree(node.children, depth + 1, forceOpen));
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
            activeTab = "run";
            setTab("run");
          };
          const active = activeSession(campaign);
          if (active && campaign.lastPageId !== node.pageId) {
            void mutate({ type: "position", sessionId: active.id, pageId: node.pageId }, "", () => {
              currentId = node.pageId;
              open();
              show(node.pageId);
            });
          } else {
            currentId = node.pageId;
            open();
            show(node.pageId);
          }
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
  const treeTop = element("div");
  treeTop.className = "treetop";
  treeTop.append(element("strong", "Adventure"));
  const search = element("input");
  search.type = "search";
  search.placeholder = "Search scenes";
  search.setAttribute("aria-label", "Search published scenes");
  const treeHost = element("div");
  function renderTree() {
    const filtered = filterStoryTree(story, treeQuery);
    treeHost.replaceChildren(tree(filtered, 0, Boolean(treeQuery.trim())));
  }
  search.addEventListener("input", () => {
    treeQuery = search.value;
    renderTree();
  });
  treeTop.append(search);
  nav.append(treeTop, treeHost);
  renderTree();
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
  setTab("run");
  const choices = [...nav.querySelectorAll("button[data-page-id]")];
  const first = choices.find(choice => choice.dataset.pageId === campaign.lastPageId) || choices[0];
  if (first) {
    currentButton = first;
    first.setAttribute("aria-current", "page");
    show(first.dataset.pageId);
  } else fillPage(moduleTitle, element("p", story.length ? "Expand an act to choose a story node." : "This publication has no story acts."));
}