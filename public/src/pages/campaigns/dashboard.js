import { element, button } from "../../components/dom.js";
import { deriveCampaignDashboard, chronicleText } from "../../domain/chronicles.js";

export function formatElapsed(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? hours + "h " + (minutes % 60) + "m" : minutes + "m";
}

export function sessionMetadata(session) {
  const started = new Date(session.startedAt).toLocaleString();
  return (session.active ? "Started " + started : started + " - " + new Date(session.endedAt).toLocaleString() +
    " (" + formatElapsed(session.elapsedMs) + " elapsed)") + " | " + session.outcomeCount + " accepted outcomes";
}

function exportChronicle(campaignName, session) {
  const url = URL.createObjectURL(new Blob([chronicleText(campaignName, session)], { type: "text/plain;charset=utf-8" }));
  const link = element("a");
  link.href = url;
  link.download = "amba-gm-session-" + session.number + ".txt";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderEntry(entry) {
  const row = element("li");
  row.className = "chronicle-entry";
  row.append(element("strong", entry.actor + " | " + entry.table + " | " + entry.label));
  const source = element("p", entry.source?.path.join(" / ") || "Published page " + entry.pageId);
  source.className = "muted";
  const body = element("p", entry.text);
  body.className = "chronicle-text";
  row.append(source, body, element("small", new Date(entry.recordedAt).toLocaleString() +
    (entry.correctedAt ? " | Corrected " + new Date(entry.correctedAt).toLocaleString() : "")));
  return row;
}

function chronicleDetails(campaignName, session) {
  const section = element("details");
  section.className = "chronicle-session";
  section.append(element("summary", "Session " + session.number + " | " + (session.active ? "Active" : "Completed") +
    " | " + session.outcomeCount + " outcomes"));
  // Render the record only when requested, to keep large campaigns responsive.
  let rendered = false;
  section.addEventListener("toggle", () => {
    if (!section.open || rendered) return;
    rendered = true;
    section.append(element("p", sessionMetadata(session)));
    if (!session.entries.length) {
      section.append(element("p", "No accepted outcomes recorded. Other events may have occurred."));
    } else {
      const entries = element("ol");
      entries.className = "chronicle-entries";
      for (const entry of session.entries) entries.append(renderEntry(entry));
      section.append(entries);
    }
    const download = button("Export session " + session.number + " chronicle", () => exportChronicle(campaignName, session));
    download.className = "button secondary";
    section.append(download);
  });
  return section;
}

export function renderCampaignDashboard(campaign, snapshot) {
  const dashboard = deriveCampaignDashboard(campaign, snapshot);
  const root = element("div");
  root.className = "campaign-dashboard";
  const stats = element("dl");
  stats.className = "campaign-stats";
  for (const [label, value] of [
    ["Completed sessions", dashboard.completedCount],
    ["Accepted outcomes", dashboard.outcomeCount],
    ["Session", dashboard.activeSession ? dashboard.activeSession.number + " active" : dashboard.nextSessionNumber + " next"],
  ]) {
    const group = element("div");
    group.append(element("dt", label), element("dd", String(value)));
    stats.append(group);
  }
  root.append(stats);
  const location = dashboard.lastPosition?.path.join(" / ") ||
    (dashboard.lastPageId ? "Published page " + dashboard.lastPageId + " (source unavailable)" : "Not yet recorded");
  root.append(element("h4", "Saved resume position"), element("p", location));
  root.append(element("p", "Navigation is a bookmark, not proof that an encounter was played or completed."));
  if (dashboard.lastCompleted) {
    root.append(element("h4", "Previous completed session"),
      element("p", "Session " + dashboard.lastCompleted.number + " | " + sessionMetadata(dashboard.lastCompleted)));
  } else {
    root.append(element("p", "No completed sessions yet."));
  }
  const history = element("details");
  history.className = "campaign-chronicles";
  history.append(element("summary", "Session chronicles (" + dashboard.chronicles.length + ")"));
  history.append(element("p", "GM-private history derived from accepted outcomes only. Corrections and removals update this record; missing outcomes do not imply nothing happened."));
  for (const session of [...dashboard.chronicles].reverse()) {
    history.append(chronicleDetails(campaign.name, session));
  }
  if (!dashboard.chronicles.length) history.append(element("p", "No sessions yet."));
  root.append(history);
  return root;
}
