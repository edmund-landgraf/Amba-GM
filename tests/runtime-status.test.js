import test from "node:test";
import assert from "node:assert/strict";
import { campaignPersistenceMode } from "../server/runtime-status.mjs";

test("GM persistence mode is postgres, sqlite file, or none", () => {
  assert.equal(campaignPersistenceMode("postgres", false), "postgres");
  assert.equal(campaignPersistenceMode("sqlite", true), "sqlite");
  assert.equal(campaignPersistenceMode("sqlite", false), "none");
});
