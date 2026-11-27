# Initial roadmap

This is a starting sequence, not a complete specification. Confirm each contract against current AMBA publishing behavior before implementation.

## M0 — Repository foundation

- [x] Establish this separate repository and document the product boundary.
- [ ] Select the web stack and deployment model based on AMBA's current published-data API.
- [ ] Define local development and configuration conventions.
- [ ] Add a minimal app shell and quality checks.

## M1 — Read-only GM run surface

- [ ] Authenticate the GM and list snapshots they can access.
- [ ] Open a selected snapshot without writing to AMBA authoring data.
- [ ] Provide stable navigation, readable narrative, and contextual artifacts/references.
- [ ] Support physical play with button-only roller and degree selection when no provider is connected.

## M2 — Campaign-specific button records and outcomes

- [ ] Define campaign/game identity and isolated runtime storage.
- [ ] Add author-defined, button-only event controls linked to stable source nodes; no freeform notes in the live runtime.
- [ ] Accept a provider-sourced check result with a click on its authored degree pill; use provider roller identity when available, otherwise button-select a PC or default to Party.
- [ ] Support edit, clear, skip, defer, and correction without treating missing data as “no.”
- [ ] Show saved state immediately and derive summaries from canonical records.

## M3 — Publishing contract and safety

- [ ] Specify snapshot identity, revision, stable source IDs, and asset URL behavior with AMBA.
- [ ] Validate access control and private GM content handling.
- [ ] Define behavior when a published revision changes or removes an event/option with existing play history.
- [ ] Preserve campaign history across revisions without silently rewriting records.

## M4 — Optional integrations

- [ ] Define a minimal provider result contract for roller, active check, degree, and deduplication metadata.
- [ ] Start with Wanderer's Guide dice-log attribution, then inspect Foundry/PF2e roll events and actor identity.
- [ ] Keep the current AMBA encounter as roll context; do not require manual UUIDs in VTT journals.
- [ ] Use provider logs to prefill/attribute a result, but store only the GM-accepted narrative fact, not raw dice transcripts.
- [ ] Handle duplicate results, secret rolls, wrong campaign/world, retries, and corrections.
- [ ] Keep combat transcript support explicitly separate unless scope is revisited.

## M5 — Player sharing (later decision)

- [ ] Decide whether a player experience is needed after GM workflow validation.
- [ ] Define a safe player projection and explicit reveal controls.
- [ ] Keep player access optional and separate from GM outcome records and private campaign records.
