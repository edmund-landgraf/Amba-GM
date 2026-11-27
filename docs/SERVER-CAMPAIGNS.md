# Server-backed campaigns

The GM application remains a separate runtime, while AMBA hosts its private, dedicated runtime API and PostgreSQL table. This avoids forwarding session cookies or introducing another identity system. No source authoring data is modified by play.

## API

All calls use the AMBA session cookie, credentials included, and the X-AMBA-GM-Owner header (account-switch guard, not authentication). The server checks current module access and derives the owner from the signed-in session. Writes require JSON, X-AMBA-GM-Request: 1 and a permitted GM origin.

- GET /api/v1/modules/:moduleId/gm-campaigns — list the signed-in GM's campaigns for this module.
- POST /api/v1/modules/:moduleId/gm-campaigns — create with id, name, publication revision.
- POST /api/v1/modules/:moduleId/gm-campaigns/:campaignId/commands — revision, expectedVersion, command. Start/end, position, accept, correct, remove. The client sends published page/check/PC identities and degree; the server resolves result text and actor from the matching published snapshot and supplies timestamps. Version conflicts return 409 and require reopen. Do not automatically replay a request with an uncertain commit result.

Published content remains read-only. Visiting a page does not record any encounter outcome. Multiple campaigns for one module remain independent. This is not a combat store, raw dice transcript, player journal, or provider integration.

## Rollout

1. Deploy the AMBA server-side additive GM campaign migration and API, regenerate Prisma client, and restart the API using the normal deployment process.
2. Ensure credentialed CORS allows the exact AMBA GM origin. The API permits https://amba-play.unwhelm.online by default; explicit extra GM origins can be configured via AMBA_GM_ALLOWED_ORIGINS and must also be in AMBA's CORS configuration. Non-production localhost:3010/127.0.0.1:3010 are allowed by the mutation guard.
3. Deploy the GM client. Reconnect using an existing AMBA account and create a test campaign from a full publication. Verify start/record/end, reload in a fresh browser and resume, separate campaigns and account isolation.

No automatic migration or deletion of legacy IndexedDB/sessionStorage data. The campaign selector offers explicit exports of old local campaigns. Server unavailable: show an error; never create or mutate a local replacement. Superseded publication revisions remain listed and exportable, but play against an old snapshot and explicit revision migration are not yet implemented. No claim of live production verification.

## Verification

npm test covers the existing outcome/campaign domain. The browser smoke test uses mocked AMBA API responses to verify cross-browser resumption, commands, account isolation and unavailable-server behavior; the paired AMBA backend PR uses disposable PostgreSQL to verify database persistence and concurrent updates. Neither test requires or writes production adventure content.
