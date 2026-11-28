// Accepted narrative outcomes only. No dice mechanics or provider transcript.
export const degreeLabels = Object.freeze({
  criticalSuccess: "Critical success", success: "Success",
  failure: "Failure", criticalFailure: "Critical failure",
  skipped: "Skipped", notApplicable: "Not applicable",
});

const pf2eDegrees = ["criticalSuccess", "success", "failure", "criticalFailure"];

function nonempty(value) { return typeof value === "string" && value.trim().length > 0; }

export function outcomeStorageKey(ownerId, snapshot) {
  if (!nonempty(ownerId) || !nonempty(snapshot?.moduleId) || !nonempty(snapshot?.revision)) return null;
  // Keep the original starter namespace so existing tab records remain readable.
  return JSON.stringify(["gm-session", ownerId, snapshot.moduleId, snapshot.revision]);
}

export function availableDegrees(table) {
  return pf2eDegrees.filter(degree =>
    Object.hasOwn(table?.degrees || {}, degree) && nonempty(table.degrees[degree]));
}

export function dispositionTable(table, degree) {
  if (!table?.id || !table?.title || (degree !== "skipped" && degree !== "notApplicable")) return null;
  return { id: table.id, title: table.title, degrees: { [degree]: degreeLabels[degree] } };
}

export function createOutcome({ pageId, table, pcId, actor, degree, key, recordedAt }) {
  const allowed = degree === "skipped" || degree === "notApplicable"
    ? nonempty(table?.degrees?.[degree])
    : availableDegrees(table).includes(degree);
  if (![pageId, table?.id, table?.title, actor, key, recordedAt].every(nonempty) ||
      !allowed || !Number.isFinite(Date.parse(recordedAt))) {
    throw new Error("An accepted outcome requires a published check, authored degree, identity and timestamp.");
  }
  return {
    key, pageId, tableId: table.id, table: table.title, pcId: pcId || null,
    actor, degree, label: degreeLabels[degree], outcomeText: table.degrees[degree], recordedAt,
  };
}

function isRecord(row) {
  return row && [row.key, row.pageId, row.tableId, row.table, row.actor].every(nonempty) &&
    Object.hasOwn(degreeLabels, row.degree) && (row.pcId === null || nonempty(row.pcId)) &&
    (row.outcomeText === undefined || nonempty(row.outcomeText)) &&
    (row.recordedAt === undefined || (nonempty(row.recordedAt) && Number.isFinite(Date.parse(row.recordedAt)))) &&
    (row.correctedAt === undefined || (nonempty(row.correctedAt) && Number.isFinite(Date.parse(row.correctedAt))));
}

export function readOutcomes(storage, key) {
  if (!storage || !key) return { records: [], writable: false, warning: "Outcomes are temporary: no authenticated publication storage." };
  try {
    const raw = storage.getItem(key);
    const rows = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(rows)) throw new Error("Invalid history");
    const seen = new Set();
    const records = [];
    for (const row of rows) {
      if (!isRecord(row) || seen.has(row.key)) continue;
      seen.add(row.key);
      // Retain only the narrow, known narrative record fields. Legacy records
      // may have neither outcomeText nor recordedAt; do not invent timestamps.
      const { key, pageId, tableId, table, pcId, actor, degree, outcomeText, recordedAt, correctedAt } = row;
      records.push({ key, pageId, tableId, table, pcId, actor, degree, label: degreeLabels[degree],
        ...(outcomeText !== undefined ? { outcomeText } : {}),
        ...(recordedAt !== undefined ? { recordedAt } : {}),
        ...(correctedAt !== undefined ? { correctedAt } : {}) });
    }
    if (records.length !== rows.length) {
      return { records, writable: false, warning: "Some stored outcomes are invalid. Original history was preserved; changes in this view are temporary." };
    }
    return { records, writable: true, warning: "" };
  } catch {
    return { records: [], writable: false, warning: "Stored outcomes could not be read. Original history was not overwritten; changes are temporary." };
  }
}

export function writeOutcomes(storage, key, records) {
  if (!storage || !key) return false;
  try { storage.setItem(key, JSON.stringify(records)); return true; }
  catch { return false; }
}

export function correctOutcome(records, key, { pageId, table, degree, correctedAt }) {
  const old = records.find(row => row.key === key);
  if (!old || old.pageId !== pageId || old.tableId !== table?.id ||
      !availableDegrees(table).includes(degree) || !Number.isFinite(Date.parse(correctedAt))) return records;
  if (old.degree === degree) return records;
  return records.map(row => row.key === key ? {
    ...row, degree, label: degreeLabels[degree], outcomeText: table.degrees[degree], correctedAt,
  } : row);
}

export function removeOutcome(records, key) {
  return records.filter(row => row.key !== key);
}

export function outcomeNarrative(record, table) {
  if (nonempty(record.outcomeText)) return record.outcomeText;
  // Only recover older tab records from their matching published check.
  if (record.tableId === table?.id && availableDegrees(table).includes(record.degree)) {
    return table.degrees[record.degree];
  }
  return null;
}
