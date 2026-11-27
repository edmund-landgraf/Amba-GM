# Session chronicles and campaign dashboard

The campaign selector now serves as a campaign-specific dashboard. It shows completed sessions, accepted outcomes, active or next session, saved resume position, and previous completed session. Expand Session chronicles to read individual sessions and export private plain-text records. The workspace's Session and outcome history groups existing editable outcome records by session, newest session first and original outcome order within each session. Ending a session opens that history immediately.

## Authority and scope

- Server-stored campaigns, sessions and accepted outcomes remain the sole runtime record. Chronicles are derived read-only projections; no extra database records, migrations or authoring writes.
- Keep original authored outcome text, PC/Party attribution, degree, source identifiers and timestamps. A correction changes the current record and its correction timestamp, but not its original chronological position. Removing a record removes it from derived history. Repeated attempts remain distinct.
- Source breadcrumbs are resolved through the existing Acts-only tree for the exact pinned publication revision. If the revision or page is unavailable, show the stored page ID rather than guessing a historical title.
- Navigation is a saved resume bookmark, not proof of an encounter being visited in-world, played, completed or discovered. An empty chronicle means no accepted outcomes were recorded, not that nothing happened.
- Session elapsed time is wall-clock time from start to end, not measured playing time; active sessions have no completed elapsed time.
- The read-only dashboard reflects the latest successfully fetched campaign collection; returning from the workspace refreshes it. The chronicle text export is an explicitly initiated GM-private snapshot, not a player-safe publication or immutable audit log.
- No combat transcript, inferred narrative, AI, provider polling, or new event types. No server-side rollup or schema changes.

## Acceptance and verification

Unit tests cover empty/active/completed sessions, stable ordering, exact authored text, corrections/removals, separation between campaigns, position-only navigation and revision mismatch. The Chromium smoke test uses the real GM SQLite server and a mocked AMBA authorization/publication: end a session, correct an outcome, return to dashboard, expand its chronicle and verify text export, then start the next session. Existing restart, concurrent-write and account-isolation scenarios remain enabled. Paired production testing is still required before deployment.

Next: author-defined event checkpoints and explicit storyline/clue discovery state, then derived objective and consequence review. Do not manufacture a complete recap from sparse challenge results.
