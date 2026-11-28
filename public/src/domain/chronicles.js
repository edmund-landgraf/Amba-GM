// A chronicle is a read-only projection of GM-accepted outcomes, not another
// source of truth. No inferred discoveries, completions, or narrative events.
import { activeSession } from "./campaigns.js";
import { projectStoryActs } from "./story-tree.js";

export function storyPageIndex(snapshot, revision) {
  const pages = new Map();
  if (!snapshot || snapshot.revision !== revision) return pages;
  function visit(nodes, ancestors) {
    for (const node of nodes) {
      const title = [node.areaCode, node.title].filter(Boolean).join(" ");
      const path = [...ancestors, title].filter(Boolean);
      if (node.pageId && Object.hasOwn(snapshot.pages || {}, node.pageId) && !pages.has(node.pageId)) {
        pages.set(node.pageId, { id: node.pageId, title: title || snapshot.pages[node.pageId].title, path });
      }
      visit(node.children || [], path);
    }
  }
  visit(projectStoryActs(snapshot.tree), []);
  return pages;
}

export function deriveChronicles(campaign, snapshot) {
  const index = storyPageIndex(snapshot, campaign.revision);
  const bySession = new Map(campaign.sessions.map(session => [session.id, []]));
  for (const outcome of campaign.outcomes) {
    // Persisted canonical fields only: never reconstruct the degree's text from
    // a newer publication. Corrections retain original chronology.
    bySession.get(outcome.sessionId)?.push({
      key: outcome.key, pageId: outcome.pageId,
      source: index.get(outcome.pageId) || null,
      table: outcome.table, tableId: outcome.tableId, actor: outcome.actor,
      pcId: outcome.pcId, degree: outcome.degree, label: outcome.label,
      text: outcome.outcomeText, recordedAt: outcome.recordedAt,
      correctedAt: outcome.correctedAt || null,
    });
  }
  return campaign.sessions.map(session => {
    const entries = bySession.get(session.id);
    // Stable insertion order for attempts recorded in the same millisecond.
    entries.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
    return {
      id: session.id, number: session.number, startedAt: session.startedAt,
      endedAt: session.endedAt, active: session.endedAt === null,
      elapsedMs: session.endedAt === null ? null : Date.parse(session.endedAt) - Date.parse(session.startedAt),
      entries, outcomeCount: entries.length,
    };
  });
}

export function deriveCampaignDashboard(campaign, snapshot) {
  const chronicles = deriveChronicles(campaign, snapshot);
  const active = activeSession(campaign);
  const previous = [...chronicles].reverse().find(session => !session.active) || null;
  const index = storyPageIndex(snapshot, campaign.revision);
  return {
    name: campaign.name, id: campaign.id,
    revisionMatches: snapshot?.revision === campaign.revision,
    activeSession: active ? chronicles.find(session => session.id === active.id) : null,
    lastCompleted: previous,
    nextSessionNumber: campaign.sessions.length + 1,
    completedCount: chronicles.filter(session => !session.active).length,
    outcomeCount: campaign.outcomes.length,
    lastPageId: campaign.lastPageId,
    lastPosition: index.get(campaign.lastPageId) || null,
    chronicles,
  };
}

export function chronicleText(campaignName, chronicle) {
  const lines = [
    campaignName + " - Session " + chronicle.number,
    "GM-private record of accepted outcomes only",
    "Started: " + chronicle.startedAt,
    chronicle.active ? "Status: active" : "Ended: " + chronicle.endedAt,
    "",
  ];
  if (!chronicle.entries.length) lines.push("No accepted outcomes recorded. Other events may have occurred.");
  for (const entry of chronicle.entries) {
    lines.push(entry.recordedAt + " | " + entry.actor + " | " + entry.table + " | " + entry.label);
    lines.push("Source: " + (entry.source?.path.join(" / ") || "Published page " + entry.pageId));
    lines.push(entry.text);
    if (entry.correctedAt) lines.push("Corrected: " + entry.correctedAt);
    lines.push("");
  }
  return lines.join("\n");
}
