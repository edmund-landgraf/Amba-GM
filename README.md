# AMBA GM

A separate GM-facing runtime for running adventures authored and published in AMBA.

AMBA remains the authoring and publishing system. AMBA GM reads its module list and published content, then keeps campaign-specific notes and outcomes in this app.

## Current starter

The first screen connects with the browser's existing AMBA sign-in, loads the same draft-and-published module list used by AMBA's module picker, and opens a lightweight GM module overview.

The starter uses a small dependency-free Node static server:

```sh
npm run dev
```

Configure the AMBA API origin in `public/config.js`. Cross-origin session access requires credentialed CORS from AMBA for the GM app's exact origin.

## Boundaries

- The selected AMBA module remains read-only.
- Campaign notes and outcomes will be scoped to a GM's campaign.
- Foundry, WGUI, Owlbear, and manual play remain optional providers.
- The initial runtime does not track combat, automate rules, infer events, or run branching logic.
- Credentials are not collected or stored by this starter.

## Status

The module list and lightweight overview are wired to AMBA's current read endpoints. Full adventure loading and campaign creation need a read-only published-snapshot API from AMBA.

See [docs/PRODUCT.md](docs/PRODUCT.md), [docs/ROADMAP.md](docs/ROADMAP.md), and [docs/AMBA-CONNECTION.md](docs/AMBA-CONNECTION.md).
