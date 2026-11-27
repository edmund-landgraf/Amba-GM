# AMBA GM

A separate GM-facing runtime for running published AMBA adventures.

This repository is the home of the GM Play Now application. AMBA remains the authoring and publishing system; this app consumes published adventure data and adds campaign-specific play state.

## Initial direction

- Separate application and repository from AdventureMakerByAct.
- Read from a published AMBA snapshot; do not mutate the author's source content.
- Keep GM runtime state campaign-scoped and private by default.
- Work without Foundry or WGUI; integrations are optional gameplay providers.
- Focus first on the GM run surface, contextual references, and compact recording of meaningful outcomes.
- Do not build combat tracking, a branching engine, or embedded AI into the initial runtime.

## Status

Starter scaffold only. No application behavior or data persistence is implemented yet.

See [docs/PRODUCT.md](docs/PRODUCT.md) for boundaries and [docs/ROADMAP.md](docs/ROADMAP.md) for the initial sequence.
