import { createOutcome, correctOutcome, removeOutcome, degreeLabels } from "./outcomes.js";

const text = value => typeof value === "string" && value.trim().length > 0;
const date = value => text(value) && Number.isFinite(Date.parse(value));
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const unique = values => new Set(values).size === values.length;

export function campaignScope(apiOrigin, ownerId, moduleId) {
  requireThat([apiOrigin, ownerId, moduleId].every(text), "An authenticated AMBA account and adventure are required.");
  return JSON.stringify(["gm-campaigns-v1", apiOrigin, ownerId, moduleId]);
}

export function activeSession(campaign) {
  return campaign.sessions.find(session => session.endedAt === null) || null;
}

export function validateCampaigns(value) {
  requireThat(Array.isArray(value), "Invalid campaign storage.");
  requireThat(unique(value.map(c => c?.id)), "Duplicate campaign identity.");
  for (const c of value) {
    requireThat(c && [c.id, c.name, c.revision].every(text) && date(c.createdAt) &&
      date(c.updatedAt) && Number.isSafeInteger(c.version) && c.version >= 1 &&
      (c.lastPageId === null || text(c.lastPageId)) &&
      Array.isArray(c.sessions) && Array.isArray(c.outcomes), "Invalid campaign record.");
    requireThat(unique(c.sessions.map(s => s?.id)) && unique(c.outcomes.map(o => o?.key)), "Duplicate session or outcome.");
    let open = 0;
    for (const [index, s] of c.sessions.entries()) {
      requireThat(s && text(s.id) && s.number === index + 1 && date(s.startedAt) &&
        (s.endedAt === null || (date(s.endedAt) && Date.parse(s.endedAt) >= Date.parse(s.startedAt))), "Invalid session.");
      if (s.endedAt === null) { open++; requireThat(index === c.sessions.length - 1, "Invalid active session order."); }
      if (index > 0) requireThat(c.sessions[index - 1].endedAt !== null &&
        Date.parse(s.startedAt) >= Date.parse(c.sessions[index - 1].endedAt), "Overlapping sessions.");
    }
    requireThat(open <= 1, "More than one active session.");
    for (const o of c.outcomes) {
      requireThat(o && [o.key, o.pageId, o.tableId, o.table, o.actor, o.outcomeText].every(text) &&
        (o.pcId === null || text(o.pcId)) && Object.hasOwn(degreeLabels, o.degree) &&
        o.label === degreeLabels[o.degree] && date(o.recordedAt) &&
        (o.correctedAt === undefined || (date(o.correctedAt) && Date.parse(o.correctedAt) >= Date.parse(o.recordedAt))),
        "Invalid campaign outcome.");
      const s = c.sessions.find(s => s.id === o.sessionId);
      requireThat(s && Date.parse(o.recordedAt) >= Date.parse(s.startedAt) &&
        (s.endedAt === null || Date.parse(o.recordedAt) <= Date.parse(s.endedAt)), "Outcome outside its session.");
    }
  }
  return value;
}

export function newCampaign(campaigns, { id, name, revision, now }) {
  validateCampaigns(campaigns);
  requireThat([id, revision].every(text) && date(now) && !campaigns.some(c => c.id === id), "Invalid new campaign identity.");
  const title = String(name || "").trim();
  requireThat(title.length <= 120, "Campaign name must be at most 120 characters.");
  let n = campaigns.length + 1;
  while (campaigns.some(c => c.name === "Campaign " + n)) n++;
  const campaign = { id, name: title || "Campaign " + n, revision, version: 1,
    createdAt: now, updatedAt: now, lastPageId: null, sessions: [], outcomes: [] };
  return { campaigns: [...campaigns, campaign], campaign };
}

export function changeCampaign(campaigns, { id, expectedVersion, revision, command, now }) {
  validateCampaigns(campaigns);
  const before = campaigns.find(c => c.id === id);
  requireThat(before && before.revision === revision, "Campaign publication does not match.");
  requireThat(before.version === expectedVersion, "Campaign changed in another view. Reopen it before making changes.");
  requireThat(date(now) && Date.parse(now) >= Date.parse(before.updatedAt), "Invalid campaign update time.");
  const active = activeSession(before);
  let next = before;
  switch (command.type) {
    case "start":
      requireThat(!active, "A session is already active.");
      requireThat(text(command.sessionId) && !before.sessions.some(s => s.id === command.sessionId), "Invalid session identity.");
      next = { ...before, sessions: [...before.sessions, { id: command.sessionId, number: before.sessions.length + 1, startedAt: now, endedAt: null }] };
      break;
    case "end":
      requireThat(active && active.id === command.sessionId, "This session is not active.");
      next = { ...before, sessions: before.sessions.map(s => s.id === active.id ? { ...s, endedAt: now } : s) };
      break;
    case "position":
      requireThat(active && active.id === command.sessionId && text(command.pageId), "An active session is required to save position.");
      if (before.lastPageId !== command.pageId) next = { ...before, lastPageId: command.pageId };
      break;
    case "accept": {
      requireThat(active && active.id === command.sessionId, "Start a session before recording an outcome.");
      requireThat(!before.outcomes.some(o => o.key === command.key), "Outcome already recorded.");
      const record = createOutcome({ ...command, recordedAt: now });
      next = { ...before, lastPageId: record.pageId, outcomes: [...before.outcomes, { ...record, sessionId: active.id }] };
      break;
    }
    case "correct": {
      const records = correctOutcome(before.outcomes, command.key, { ...command, correctedAt: now });
      requireThat(records !== before.outcomes, "The selected correction is unavailable.");
      next = { ...before, outcomes: records };
      break;
    }
    case "remove":
      requireThat(before.outcomes.some(o => o.key === command.key), "The selected outcome no longer exists.");
      next = { ...before, outcomes: removeOutcome(before.outcomes, command.key) };
      break;
    default: throw new Error("Unknown campaign operation.");
  }
  if (next === before) return { campaigns, campaign: before };
  next = { ...next, updatedAt: now, version: before.version + 1 };
  const result = campaigns.map(c => c.id === next.id ? next : c);
  validateCampaigns(result);
  return { campaigns: result, campaign: next };
}
