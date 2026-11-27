# GM Play Now data model

Proposed first PostgreSQL migration for Amba-GM. The unit of play is a campaign. Two groups can run the same publication and build independent histories. One GM click on an authored result creates one campaign fact.

## Prisma objects

The fields below use Prisma scalar types. Each model has an id of type String backed by a PostgreSQL UUID and generated on insert. Fields ending in Id that point to a local model are UUID foreign keys. External AMBA and provider identifiers are opaque strings. Use timestamptz for DateTime fields and database defaults for creation times.

| Model | Fields besides id | Relationships and constraints |
| --- | --- | --- |
| Publication | moduleKey String, revision String, snapshot Json, importedAt DateTime | Unique (moduleKey, revision). Immutable GM projection of a successful full publication. |
| Campaign | ownerKey String, publicationId String, createdAt DateTime, lastNodeKey String? | Many campaigns per publication. Index ownerKey for resume. ownerKey is the authenticated AMBA subject. |
| Session | campaignId String, startedAt DateTime, endedAt DateTime? | Many sessions per campaign. Add a PostgreSQL partial unique index on campaignId where endedAt is null. |
| CampaignPc | campaignId String, displayName String, retiredAt DateTime? | One roster per campaign. Retire a PC to preserve history. Names need not be unique. |
| PcIdentity | campaignId String, pcId String, provider Provider, scopeKey String, actorKey String | Unique (campaignId, provider, scopeKey, actorKey). Scope is the provider campaign, Foundry world, or AMBA module. Multiple identities can map to one roster PC. |
| Outcome | campaignId String, sessionId String, pcId String?, nodeKey String, tableKey String, resultKey String, degree Degree?, actorLabel String, recordedAt DateTime, actionKey String, provider Provider?, providerRollKey String?, version Int, removedAt DateTime? | Unique (campaignId, actionKey). Index (sessionId, recordedAt, id) for history and (campaignId, nodeKey) for encounter context. |

Provider values are WGUI, FOUNDRY and AMBA. AMBA identifies pregen roster entries. Degree values are CRITICAL_SUCCESS, SUCCESS, FAILURE and CRITICAL_FAILURE. A null pcId means Party. actorLabel preserves the displayed attribution at the time of recording. A null degree supports authored result rows such as a discovery or choice.

In Prisma, declare inverse lists for each one-to-many relation. Give Session and CampaignPc a composite unique key on (campaignId, id). Use composite foreign keys for Outcome → Session, Outcome → CampaignPc and PcIdentity → CampaignPc so references cannot cross campaigns. Restrict deletion of referenced rows. Put the partial index in migration SQL.

## Published tables

Read the available modules through the [existing AMBA connection](AMBA-CONNECTION.md). Starting a campaign requires the planned authenticated snapshot endpoint. Pin the returned publication when creating the campaign. Resuming reads that same revision. Reusing a cached publication still requires permission to start the selected module.

The proposed snapshot contract exposes ordered nodes with stable keys and parent keys. A node contains ordered authored tables. Each table has a stable key, title, optional check and DC, and ordered result rows with stable keys, labels, optional degrees and authored text. Keep map, clue and storyline references as published keys. Resolve each recorded (nodeKey, tableKey, resultKey) against the campaign’s pinned snapshot. This lets two checks with identical DCs and labels remain distinct and preserves the wording the GM saw. Reject invalid references when importing a publication. Render narrative-only nodes directly and create buttons only for published choices.

## Recording a result

1. Open the current node and display the authored table. A WGUI dice event can identify the PC through PcIdentity. Treat a received event as a suggestion. Foundry actor and roll identifiers still need verification against actual PF2e messages.
2. If attribution is unavailable, the GM can click a roster PC. With no selection, show Party before the GM clicks the result. Capture that attribution for this action and clear the manual selection afterwards.
3. The result button submits the session, published keys, attribution and a client-generated action key. Authenticate the GM, check campaign ownership, and validate the selected result and roster membership on the server. Derive degree and actor label there.
4. In a transaction, lock the session row, check it is open, and insert the outcome. Closing a session uses the same lock. Retrying an accepted action returns its original record, including after session close. Reject reuse of the key with a different payload. Each intentional repeat gets a fresh key.
5. Show the authored consequence immediately. For a DC 18 save, Joreg’s critical failure can display the published 1d6 poison damage instruction. The stored fact is Joreg’s critical failure on that table. The game system handles damage and continuing saves.

History offers buttons to change the PC, select another authored result, or remove an accidental record. Validate corrections against the same campaign and table. Update only when the submitted version matches, increment version, and use removedAt to hide withdrawn outcomes. Derive discovery and storyline views from active facts so correcting a result also corrects those views.

## Implementation order

1. Add Prisma and the first migration in Amba-GM. Keep the database connection on the GM server. Scope every campaign read and write by the authenticated owner, including reads of cached publication content.
2. Agree the snapshot shape and authorization with AMBA authoring. Import the full snapshot atomically and create a campaign only once its publication is available.
3. Implement roster selection, session start and resume, one published table, and the outcome/history operations. Exercise the loop with Party and a roster PC before connecting dice feeds.
4. Connect WGUI attribution. Add Foundry once its event identity and actor mapping are confirmed. Neither integration requires a GM to type or copy a journal UUID.
