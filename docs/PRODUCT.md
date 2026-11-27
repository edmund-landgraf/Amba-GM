# Product boundary

## Purpose

AMBA GM is the separate Play Now runtime for GMs running adventures authored and published with AMBA. It provides a usable live reference surface and stores button-confirmed campaign outcomes without changing the published source.

## System responsibilities

- **AMBA authoring:** creates adventure content, structured challenges, artifacts, references, and explicitly authored event/checkpoint definitions.
- **AMBA GM:** reads a published snapshot, presents a GM run view, and stores the GM's campaign-specific play record.
- **Gameplay providers:** Foundry, WGUI, Owlbear, or manual/physical play may resolve game mechanics. No provider is mandatory.

## Initial scope

- Owner-authenticated GM runtime.
- Select and open an available published adventure snapshot.
- Navigate the adventure and access relevant narrative, artifacts, maps, NPCs, PCs, and references.
- Record author-defined event and check outcomes through buttons. Provider logs can supply roller/result; button-only PC or Party and degree selection remains the fallback.
- Keep the live runtime free of text-entry fields; AMBA authoring defines the available capture buttons.
- Correct or remove records and retrieve them later in context.
- Keep GM outcome records private unless the GM explicitly chooses otherwise.

## Out of scope initially

- In-app dice rolling, typed results, freeform note fields, or raw dice-log transcript storage.
- Combat transcript ingestion, storage, or archival.
- Initiative, HP, conditions, targeting, damage, ongoing poison tracking, or rules automation.
- Automatic story progression, inferred events, branching conditions, or automatic rewards.
- Required player accounts or a player-facing app.
- Embedded AI or automatic interpretation of prose.
- Replacing AMBA authoring or any VTT/character manager.

## Core principles

1. A published adventure snapshot is read-only from the runtime.
2. Campaign state is separate from authored definitions and isolated per game.
3. The game system resolves mechanics; AMBA GM stores accepted narrative outcomes and roller attribution.
4. The author defines what can be recorded; the GM accepts a provider result with a button.
5. The live GM runtime uses buttons, not text-entry fields.
6. Unrecorded, unknown, negative, skipped, and not applicable are distinct states where relevant.
7. Ordinary encounters should remain runnable without extra event prompts.
8. Player delivery must be a separately reviewed projection; GM-only material is never exposed by default.
