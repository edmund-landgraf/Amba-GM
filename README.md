# AMBA GM

A separate GM-facing runtime for running adventures authored and published in AMBA.

AMBA remains the authoring and publishing system. AMBA GM reads its module list and published content, then keeps button-confirmed campaign outcomes in this app.

## Current starter

The first screen connects with the browser's existing AMBA sign-in, loads the same draft-and-published module list used by AMBA's module picker, and opens a lightweight GM module overview.

The app uses a small Node 22.13+ HTTP server with a private SQLite campaign database:

```sh
npm run dev
```

Configure the AMBA API origin in `public/config.js`. Cross-origin session access requires credentialed CORS from AMBA for the GM app's exact origin.

## Boundaries

- The selected AMBA module remains read-only.
- Button-confirmed outcome records will be scoped to a GM's campaign.
- Foundry, WGUI, Owlbear, and manual play remain optional providers.
- The initial runtime does not track combat, automate rules, infer events, or run branching logic.
- Credentials are not collected or stored by this starter.

## Status

The module list and lightweight overview are wired to AMBA's current read endpoints. Open GM workspace requests the selected module’s full publication from the authenticated AMBA endpoint `GET /api/v1/modules/:moduleId/syndication/gm`. Deploy the corresponding AMBA route before using this build. The GM view follows the published navigation tree, opens branches on demand, and displays the selected page and authored PF2e challenge results. Click a roster PC or use Party, then click a result to record it. Campaign and session records are stored on the GM server, scoped to the AMBA account and adventure. See [server persistence and deployment](docs/SERVER-PERSISTENCE.md) for the companion AMBA authorization endpoint, required environment and existing browser history exports. External roller attribution remains pending.

See [docs/PRODUCT.md](docs/PRODUCT.md), [docs/ROADMAP.md](docs/ROADMAP.md), and [docs/AMBA-CONNECTION.md](docs/AMBA-CONNECTION.md). The current five-screen UI mockups are in [docs/play-now-mockups.html](docs/play-now-mockups.html), with roll attribution details in [docs/GM-ROLL-RECORDING.md](docs/GM-ROLL-RECORDING.md).
