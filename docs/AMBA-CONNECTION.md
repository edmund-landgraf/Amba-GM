# AMBA connection and module selection

## Existing AMBA contract

The current AMBA API already provides the module list used by its authoring module picker:

- `GET /api/v1/auth/me` checks the authenticated session.
- `GET /api/v1/modules?status=both` returns the signed-in user's module list, including draft and published modules.
- Each list row includes module metadata, a subtitle when present, and the counts needed for a lightweight overview. The route is user-scoped and excludes the user-content workspace.

AMBA GM calls these endpoints with the browser's existing AMBA session cookie (`credentials: include`). It does not collect or persist an AMBA password or API token. The app displays this list in a native dropdown, then opens an overview based on the selected module row.

## Environment

Set `public/config.js` to the AMBA API prefix and app URL for the target environment. AMBA currently allows the production satellite origin `https://amba-play.unwhelm.online` and, outside production, `http://localhost:3010` and `http://127.0.0.1:3010` with credentialed CORS. The AMBA session cookie must be available for requests to the AMBA origin. Use the local AMBA API address in `public/config.js` during local development.

Run the static shell with Node 20 or later:

```sh
npm run dev
```

The server listens on `http://127.0.0.1:4173` by default. Set `PORT` to change the port.

## Current limitation

The module overview is built from stable module-list metadata and the module subtitle when present. The current detailed module endpoint is editor-authorized and can perform editor maintenance on read, so this app does not call it. AMBA still needs a read-only, owner-authorized published-snapshot endpoint before a GM can load the full adventure or start a campaign.

## Next AMBA-side contract

1. Provide an explicit GM-app authorization flow or otherwise authorize the existing AMBA session for the configured app origin.
2. Provide a read-only module list scoped to the authenticated AMBA user, with the same rows and status behavior as the authoring picker.
3. Provide a read-only full published snapshot endpoint for a selected module. Include stable node IDs, publication revision, asset references, and the GM-safe projection. This endpoint must not call editor repair or mutate authoring records.
4. Keep campaign notes, event outcomes, and session history in AMBA GM's own storage, isolated by GM and campaign.

No credentials are stored by this starter. The list and overview are read-only.
