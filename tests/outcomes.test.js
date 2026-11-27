import test from "node:test";
import assert from "node:assert/strict";
import { outcomeStorageKey, availableDegrees, createOutcome, readOutcomes, writeOutcomes, correctOutcome, removeOutcome, outcomeNarrative } from "../public/src/domain/outcomes.js";

const snapshot = { moduleId: "adventure-1", revision: "2026-11-27T00:00:00.000Z" };
const table = Object.freeze({ id: "check-1", title: "Investigate the shrine", degrees: Object.freeze({ success: "Discover the symbol.", failure: "No useful clue.", criticalFailure: "  " }) });
const time = "2026-11-27T01:00:00.000Z";
const later = "2026-11-27T02:00:00.000Z";
const make = (extra = {}) => createOutcome({ pageId: "page-1", table, pcId: null, actor: "Party", degree: "success", key: "attempt-1", recordedAt: time, ...extra });
function memory() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("capture exact authored result and provenance, without altering source", () => {
  assert.deepEqual(availableDegrees(table), ["success", "failure"]);
  const row = make({ pcId: "pc-1", actor: "Kota" });
  assert.deepEqual(row, { key: "attempt-1", pageId: "page-1", tableId: "check-1", table: "Investigate the shrine", pcId: "pc-1", actor: "Kota", degree: "success", label: "Success", outcomeText: "Discover the symbol.", recordedAt: time });
  assert.throws(() => make({ degree: "criticalFailure" }));
  assert.throws(() => make({ degree: "criticalSuccess" }));
  assert.throws(() => make({ recordedAt: "bad-date" }));
  assert.equal(table.degrees.success, "Discover the symbol.");
});

test("separate attempts, correct only selected result and remove only that record", () => {
  const first = make();
  const second = make({ key: "attempt-2", degree: "failure", pcId: "pc-1", actor: "Kota" });
  const rows = [first, second];
  const corrected = correctOutcome(rows, first.key, { pageId: first.pageId, table, degree: "failure", correctedAt: later });
  assert.equal(corrected[0].degree, "failure");
  assert.equal(corrected[0].outcomeText, "No useful clue.");
  assert.equal(corrected[0].recordedAt, time);
  assert.equal(corrected[0].correctedAt, later);
  assert.equal(corrected[0].actor, "Party");
  assert.equal(corrected[1], second);
  assert.equal(first.degree, "success");
  assert.deepEqual(removeOutcome(corrected, first.key), [second]);
});

test("reject corrections to another page, another check, absent degree or same degree", () => {
  const rows = [make()];
  const changes = { pageId: "page-1", table, degree: "failure", correctedAt: later };
  for (const patch of [{ pageId: "elsewhere" }, { table: { ...table, id: "other" } }, { degree: "criticalSuccess" }, { degree: "success" }]) {
    assert.equal(correctOutcome(rows, "attempt-1", { ...changes, ...patch }), rows);
  }
  assert.equal(correctOutcome(rows, "unknown", changes), rows);
});

test("storage isolates accounts, modules, revisions; no missing-identity persistence", () => {
  const storage = memory();
  const key = outcomeStorageKey("gm-1", snapshot);
  assert.equal(key, JSON.stringify(["gm-session", "gm-1", snapshot.moduleId, snapshot.revision]));
  assert.equal(writeOutcomes(storage, key, [make()]), true);
  assert.deepEqual(readOutcomes(storage, key).records, [make()]);
  for (const alternate of [outcomeStorageKey("gm-2", snapshot), outcomeStorageKey("gm-1", { ...snapshot, moduleId: "adventure-2" }), outcomeStorageKey("gm-1", { ...snapshot, revision: later })]) {
    assert.deepEqual(readOutcomes(storage, alternate).records, []);
  }
  assert.equal(outcomeStorageKey(null, snapshot), null);
  assert.equal(outcomeStorageKey("gm-1", { moduleId: snapshot.moduleId }), null);
  assert.equal(writeOutcomes(storage, null, [make()]), false);
});

test("legacy tab records preserve unknown time and recover text only from matching check", () => {
  const storage = memory();
  const key = outcomeStorageKey("gm-1", snapshot);
  const { outcomeText, recordedAt, ...legacy } = make();
  storage.setItem(key, JSON.stringify([legacy]));
  const loaded = readOutcomes(storage, key);
  assert.equal(loaded.writable, true);
  assert.equal(loaded.records[0].recordedAt, undefined);
  assert.equal(outcomeNarrative(loaded.records[0], table), outcomeText);
  assert.equal(outcomeNarrative(loaded.records[0], { ...table, id: "different" }), null);
  assert.equal(outcomeNarrative(make(), { ...table, degrees: { success: "Changed." } }), outcomeText);
});

test("invalid, duplicate or unreadable history is not silently overwritten", () => {
  const storage = memory();
  const key = outcomeStorageKey("gm-1", snapshot);
  for (const raw of ["broken json", "{}", JSON.stringify([make(), make()]), JSON.stringify([make(), null])]) {
    storage.setItem(key, raw);
    const loaded = readOutcomes(storage, key);
    assert.equal(loaded.writable, false);
    assert.ok(loaded.warning);
    assert.equal(storage.getItem(key), raw);
  }
  const unavailable = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(readOutcomes(unavailable, key).writable, false);
  assert.equal(writeOutcomes(unavailable, key, [make()]), false);
});
