# Server-backed campaign persistence

AMBA remains the authoring authority; the GM application owns a separate SQLite database. No authoring rows are written by this runtime. This changes the server requirement to Node 22.13+.

## Deployment

Deploy the companion AMBA authorization PR first. Configure the same randomly generated 32-byte hex secret in the AMBA API and GM server as AMBA_GM_RUNTIME_SECRET, and the exact GM app origin (e.g. https://amba-play.unwhelm.online, no trailing slash) as AMBA_GM_RUNTIME_ORIGIN. Never place the secret in public/config.js, source control, or browser storage. Configure AMBA_GM_DATA_DIR on the GM server only, outside the public web root, on a persistent private local disk writable only by the service account. Use a single logical database, not ephemeral container storage or per-replica disks. Run npm start behind HTTPS reverse proxy, forwarding /api/gm/ to the GM process on localhost. Keep the existing credentialed AMBA CORS origin configuration. Rotate the dedicated secret on both services together. Configure proxy request limits and rate limiting. Back up SQLite consistently (online backup or stopped server; don't copy just the main file while WAL writes are active).

The server uses Node's built-in SQLite, WAL, synchronous FULL, BEGIN IMMEDIATE and an optimistic campaign version. Collection rows are isolated by AMBA user and module; each campaign remains pinned to its original publication revision. Multiple browser profiles signed into the same authorized AMBA account can resume the same campaign. Storage errors fail closed; there is no hidden local fallback. No clustering, external database adapter or automatic revision migration in this slice.

## Authorization contract

For each list/create/change, the browser requests POST /api/v1/modules/:moduleId/syndication/gm-runtime-authorize from AMBA with its existing session cookie and expected account ID. Existing module-edit authorization is reused; bearer/MCP credentials and unexpected origins are refused. AMBA validates the request against its full publication, validates its revision for mutations, and derives check result and PC identity from the published source. AMBA returns a dedicated signed operation grant (HMAC SHA-256, 60-second expiry, bound to owner, module, audience and command). It is sent only in the JSON body of POST /api/gm/campaigns/execute, over HTTPS in deployment. It is not an AMBA API credential. The runtime verifies signature and expiry and accepts only the signed operation. Client-supplied identity, narrative, timestamp and full campaign replacement are not accepted. Each operation obtains a fresh grant; a previously issued grant can remain valid until its short expiry even after sign-out. A replayed mutation is rejected by campaign identity or version, except harmless no-op position writes. The GM server has its own private storage; no database or session cookie sharing. A deployment uses one trusted AMBA issuer/key; do not reuse the key across environments.

## Existing local data

Browser-only campaigns are not automatically uploaded or discarded. The selector offers a private JSON export of existing IndexedDB campaigns. The earlier tab-only records are separately exportable. Explicit server import, backup restore UI, revision migration and offline synchronization remain future work. Existing campaigns from a replaced publication remain exportable but cannot be opened with a different revision. Do not clear browser data until exported. No silent migration or inferred outcomes.

## Verification

Node unit/integration tests exercise grant tampering/expiry, HTTP authorization, SQLite reopen and replay/version/account/module isolation. Chromium smoke uses a mock AMBA authorization endpoint but the real GM HTTP server and SQLite database; it restarts the server, opens a fresh browser profile, resumes history, checks another account and concurrent commands. The companion AMBA CI verifies canonicalization from the real published challenge extractor and API typecheck. A paired live deployment smoke test, review of auth origin/config, backup restore and private data access is still required before production rollout.
