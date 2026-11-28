import test from "node:test";
import assert from "node:assert/strict";
import { campaignScope, newCampaign, changeCampaign, activeSession, validateCampaigns } from "../public/src/domain/campaigns.js";

const revision = "rev-a";
const time = (minute) => "2026-11-27T01:" + String(minute).padStart(2, "0") + ":00.000Z";
const table = { id: "check", title: "Shrine", degrees: { success: "The symbol is visible.", failure: "No useful clue." } };
const create = (campaigns = [], overrides = {}) => newCampaign(campaigns, { id: "c1", name: "First table", revision, now: time(0), ...overrides });
const change = (state, command, minute = 1, overrides = {}) => changeCampaign(state.campaigns, { id: state.campaign.id, revision, expectedVersion: state.campaign.version, command, now: time(minute), ...overrides });
const start = (state = create()) => change(state, { type: "start", sessionId: "s1", pageId: "act1" });
const accept = (state, overrides = {}) => change(state, { type: "accept", sessionId: "s1", key: "result1", pageId: "enc1", table, actor: "Party", pcId: null, degree: "success", ...overrides }, 2);

test("multiple independent campaigns for a single published module", () => {
  const first = create();
  const second = create(first.campaigns, { id: "c2", name: "", now: time(1) });
  assert.equal(second.campaign.name, "Campaign 2");
  const updated = change(second, { type: "start", sessionId: "s2" }, 2);
  assert.equal(updated.campaigns[0], first.campaign);
  assert.equal(updated.campaigns[0].sessions.length, 0);
  assert.equal(activeSession(updated.campaign).id, "s2");
  assert.throws(() => create(second.campaigns), /identity/);
});

test("create, start, resume and end sessions; stable sequential numbering", () => {
  const started = start();
  assert.equal(started.campaign.lastPageId, "act1");
  assert.equal(activeSession(started.campaign).number, 1);
  const restored = JSON.parse(JSON.stringify(started.campaigns));
  assert.equal(activeSession(validateCampaigns(restored)[0]).id, "s1");
  const ended = change(started, { type: "end", sessionId: "s1" }, 3);
  assert.equal(activeSession(ended.campaign), null);
  assert.equal(ended.campaign.sessions[0].endedAt, time(3));
  const next = change(ended, { type: "start", sessionId: "s2" }, 4);
  assert.equal(activeSession(next.campaign).number, 2);
  assert.equal(next.campaign.lastPageId, "act1");
  assert.equal(next.campaign.sessions[0].id, "s1");
});

test("no overlapping sessions, duplicate session IDs or stale session operations", () => {
  const started = start();
  assert.throws(() => change(started, { type: "start", sessionId: "s2" }, 2), /already active/);
  assert.throws(() => change(started, { type: "end", sessionId: "s2" }, 2), /not active/);
  const ended = change(started, { type: "end", sessionId: "s1" }, 2);
  assert.throws(() => change(ended, { type: "start", sessionId: "s1" }, 3), /identity/);
  assert.throws(() => change(ended, { type: "end", sessionId: "s1" }, 3), /not active/);
});

test("party roster is stored on the campaign and skipped on identical save", () => {
  const created = create();
  assert.equal(created.campaign.partyPcIds, undefined);
  const saved = change(created, { type: "setParty", partyPcIds: ["pc-fighter", "pc-cleric"] });
  assert.deepEqual(saved.campaign.partyPcIds, ["pc-fighter", "pc-cleric"]);
  const again = change(saved, { type: "setParty", partyPcIds: ["pc-fighter", "pc-cleric"] }, 2);
  assert.equal(again.campaign, saved.campaign);
  assert.throws(() => change(saved, { type: "setParty", partyPcIds: ["pc-fighter", "pc-fighter"] }, 2), /roster/);
});

test("saved navigation is not inferred outcome; no session means no saved position", () => {
  const initial = create();
  assert.throws(() => change(initial, { type: "position", sessionId: "s1", pageId: "x" }), /active session/);
  const started = start(initial);
  const moved = change(started, { type: "position", sessionId: "s1", pageId: "enc2" }, 2);
  assert.equal(moved.campaign.lastPageId, "enc2");
  assert.equal(moved.campaign.outcomes.length, 0);
  const again = change(moved, { type: "position", sessionId: "s1", pageId: "enc2" }, 3);
  assert.equal(again.campaign, moved.campaign);
});

test("skip and not-applicable are distinct from authored degrees", () => {
  const started = start();
  const skipped = change(started, { type: "skip", sessionId: "s1", key: "skip1", pageId: "enc1", table, actor: "Party", pcId: null }, 2);
  assert.equal(skipped.campaign.outcomes[0].degree, "skipped");
  assert.equal(skipped.campaign.outcomes[0].label, "Skipped");
  const na = change(skipped, { type: "notApplicable", sessionId: "s1", key: "na1", pageId: "enc1", table, actor: "Party", pcId: null }, 3);
  assert.equal(na.campaign.outcomes[1].degree, "notApplicable");
  assert.equal(na.campaign.outcomes[1].outcomeText, "Not applicable");
});

test("accepted result belongs to active session and cannot be recorded twice", () => {
  assert.throws(() => accept(create()), /Start a session/);
  const started = start();
  const recorded = accept(started);
  assert.equal(recorded.campaign.lastPageId, "enc1");
  assert.equal(recorded.campaign.outcomes[0].sessionId, "s1");
  assert.equal(recorded.campaign.outcomes[0].outcomeText, table.degrees.success);
  assert.equal(recorded.campaign.outcomes[0].recordedAt, time(2));
  assert.equal(started.campaign.outcomes.length, 0);
  assert.throws(() => accept(recorded), /already recorded/);
  assert.throws(() => accept(started, { sessionId: "other" }), /Start a session/);
});

test("completed history can be corrected or removed without reopening its session", () => {
  const recorded = accept(start());
  const ended = change(recorded, { type: "end", sessionId: "s1" }, 3);
  const corrected = change(ended, { type: "correct", key: "result1", pageId: "enc1", table, degree: "failure" }, 4);
  assert.equal(corrected.campaign.outcomes[0].sessionId, "s1");
  assert.equal(corrected.campaign.outcomes[0].recordedAt, time(2));
  assert.equal(corrected.campaign.outcomes[0].correctedAt, time(4));
  assert.equal(corrected.campaign.outcomes[0].outcomeText, table.degrees.failure);
  assert.equal(activeSession(corrected.campaign), null);
  const removed = change(corrected, { type: "remove", key: "result1" }, 5);
  assert.equal(removed.campaign.outcomes.length, 0);
  assert.equal(removed.campaign.sessions.length, 1);
  assert.throws(() => change(removed, { type: "remove", key: "result1" }, 6), /no longer exists/);
});

test("optimistic version and publication revision reject stale updates", () => {
  const started = start();
  const command = { type: "position", sessionId: "s1", pageId: "enc1" };
  assert.throws(() => change(started, command, 2, { expectedVersion: 1 }), /another view/);
  assert.throws(() => change(started, command, 2, { revision: "rev-b" }), /publication/);
  assert.throws(() => change(started, command, 2, { id: "missing" }), /publication/);
  assert.equal(started.campaign.lastPageId, "act1");
});

test("account, AMBA server and source module keys are distinct; missing identity rejected", () => {
  const key = campaignScope("https://example.test/api/v1", "gm-1", "module-1");
  for (const other of [
    campaignScope("https://example.test/api/v1", "gm-2", "module-1"),
    campaignScope("https://example.test/api/v1", "gm-1", "module-2"),
    campaignScope("https://other.test/api/v1", "gm-1", "module-1"),
  ]) assert.notEqual(key, other);
  assert.throws(() => campaignScope("https://example.test/api/v1", "", "module-1"), /authenticated/);
});

test("corrupt stored data is rejected instead of silently rewritten", () => {
  const state = accept(start());
  const clone = () => JSON.parse(JSON.stringify(state.campaigns));
  const orphan = clone();
  orphan[0].outcomes[0].sessionId = "missing";
  assert.throws(() => validateCampaigns(orphan), /outside its session/);
  const duplicate = clone();
  duplicate[0].outcomes.push(duplicate[0].outcomes[0]);
  assert.throws(() => validateCampaigns(duplicate), /Duplicate/);
  const malformed = clone();
  malformed[0].sessions[0].startedAt = "invalid";
  assert.throws(() => validateCampaigns(malformed), /Invalid session/);
  assert.throws(() => validateCampaigns({}), /Invalid campaign storage/);
});
