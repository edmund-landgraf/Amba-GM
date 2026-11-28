import { element, button } from "../../components/dom.js";
import { collectPlayerCharacters } from "../../domain/story-tree.js";

/** Screen 2: AMBA pregens are the only live source; WGUI and Foundry stay visible and disabled. */
export function openPartySetup({ snapshot, moduleTitle, onContinue, onBack }) {
  const roster = collectPlayerCharacters(snapshot.tree);
  const selected = new Set(roster.map(([id]) => id));
  const root = element("section");
  root.className = "panel party-setup";
  root.append(element("h2", "Choose where the party's PCs come from"));
  root.append(element("p", moduleTitle + " · New campaign setup"));
  const layout = element("div");
  layout.className = "party-layout";
  const sources = element("div");
  sources.className = "party-sources";
  sources.append(Object.assign(element("p", "Character source"), { className: "label" }));
  for (const source of [
    { key: "wgui", mark: "W", title: "Wanderer's Guide", detail: "Not in this MVP — dice-log attribution comes later." },
    { key: "foundry", mark: "F", title: "Foundry", detail: "Not in this MVP — actor mapping comes later." },
    { key: "amba", mark: "A", title: "AMBA pregens", detail: "Use characters published with this adventure.", active: true },
  ]) {
    const card = element("div");
    card.className = "party-source" + (source.active ? " active" : " disabled");
    const mark = element("span", source.mark);
    mark.className = "sourceicon";
    const copy = element("div");
    copy.append(element("strong", source.title), Object.assign(element("p", source.detail), { className: "muted" }));
    card.append(mark, copy);
    sources.append(card);
  }
  sources.append(Object.assign(element("p", "The published adventure is not copied or edited. Only this campaign's roster is selected."), { className: "notice" }));
  const picker = element("div");
  picker.append(element("h3", "Select the party"));
  picker.append(Object.assign(element("p", "These are pregens from the published adventure. You can change the roster later."), { className: "muted" }));
  const list = element("div");
  list.className = "party-roster";
  const summary = element("p");
  summary.className = "muted";
  function refreshSummary() {
    summary.textContent = selected.size + " PC" + (selected.size === 1 ? "" : "s") + " selected";
  }
  for (const [id, name] of roster) {
    const row = element("label");
    row.className = "party-row";
    const box = element("input");
    box.type = "checkbox";
    box.checked = true;
    box.addEventListener("change", () => {
      if (box.checked) selected.add(id);
      else selected.delete(id);
      refreshSummary();
    });
    row.append(box, element("span", name));
    list.append(row);
  }
  if (!roster.length) list.append(element("p", "This publication has no dedicated PC pages. Outcomes will default to Party."));
  refreshSummary();
  picker.append(list, summary);
  layout.append(sources, picker);
  root.append(layout);
  const bar = element("div");
  bar.className = "row-actions";
  const importParty = button("Import PCs to campaign", () => onContinue([...selected]));
  importParty.className = "button primary";
  bar.append(button("Back", onBack), importParty);
  root.append(bar);
  return root;
}
