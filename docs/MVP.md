# Play Now GM — MVP

**Goal:** A GM can sign in with AMBA, open a **full published** adventure, run a session from the syndication tree, and **persist button-recorded outcomes** to a durable campaign ledger — without touching authoring data.

**Architecture for MVP (your direction):**

| Layer | Responsibility |
| --- | --- |
| **AMBA** | Auth, module list, `GET …/syndication/gm` (read-only snapshot), signed authorize |
| **Campaign ledger** | Sessions, position, outcomes — **PostgreSQL on AMBA** in production (`AMBA_GM_RUNTIME_BACKEND=postgres`, GM server proxies) |
| **Amba-GM UI** | Static/Node host for GM SPA; no local adventure DB; syndication stays in browser memory |

Syndication is **not** materialized into SQLite tables. SQLite on the GM host is only a **dev/default** campaign blob store until Postgres mode is enabled everywhere.

Reference UX: [`play-now-mockups.html`](./play-now-mockups.html) screens **01–04**. Screen **05** (locations, storylines/clues) is **post-MVP**.

---

## MVP acceptance (demo script)

1. Connect with existing AMBA session (credentialed CORS to GM origin).
2. Pick an **owned, published** module with full syndication.
3. **Start a new game** → select AMBA pregens → **resume** same campaign later (another browser tab OK after refresh).
4. Navigate story tree; **Run** tab shows published content; **Campaign** / **History** show recorded state.
5. Start session → record at least one PF2e challenge degree → correct or remove → end session; reload and confirm history.
6. Campaign data survives GM server restart (Postgres in prod; SQLite acceptable for local dev only).

**Out of scope for MVP:** WGUI/Foundry roll feed, freeform notes, storylines/clues package, player mode, combat, offline play.

---

## Status (this repo)

| Area | State |
| --- | --- |
| AMBA connect + module list | Done (published modules for Play Now) |
| Full GM syndication + tree workspace | Done |
| Party pregen checkboxes (screen 02) | Done — `setParty` stores `partyPcIds` on the campaign; resume reuses it |
| Run / Campaign / History tabs | Done (Campaign view is MVP-simple, not full location model) |
| Outcome record / correct / remove | Done |
| Signed authorize + execute | Done (SQLite + postgres proxy) |
| Postgres ledger on AMBA | Requires paired deploy + `AMBA_GM_RUNTIME_BACKEND=postgres` |
| Storylines & clues | Blocked on AMBA authoring export |

---

## Work sequence

### Phase A — Freeze MVP (this repo)

- [x] Document MVP scope (this file).
- [x] Module picker: published modules only (Play Now boundary).
- [x] Persist `partyPcIds` via `setParty` (AMBA authorize + SQLite JSON + Postgres `partyPcIds`).
- [x] Match mock copy: primary **Resume campaign** / **Start a new game** actions.
- [x] Update [`ROADMAP.md`](./ROADMAP.md) checkboxes against reality.
- [x] Visual run surface: published-module cards, auto-connect, full-width workspace, tabs on every view.
- [x] Encounter run panel: authored degree text, recorded result, tree search.
- [x] Skip / not applicable as distinct recorded states (not the same as “never clicked”).
- [x] When GM server persistence is off, **Manage campaigns** uses IndexedDB so resume works after refresh.
- [x] Party setup shows WGUI/Foundry as future sources; Campaign tab groups nodes by scene.

### Phase B — Production ledger (AMBA + VPS)

- [ ] On AMBA: confirm `gm-runtime` + `gm-runtime-authorize` deployed for target module (`partyPcIds` migration applied).
- [x] GM env/docs: postgres is the production backend; `npm run doctor` and `tools/update-vps-env.sh` default to proxy mode.
- [ ] GM VPS: `AMBA_GM_RUNTIME_BACKEND=postgres`, `AMBA_GM_API_BASE`, exact `AMBA_GM_RUNTIME_ORIGIN`.
- [ ] Paired smoke: create campaign → session → outcome → reload → second account denied.
- [ ] No dual-write: disable SQLite campaign path on prod GM host once Postgres verified.

### Phase C — Post-MVP (do not block launch)

- [ ] Storyline/clue payloads in GM syndication (AMBA authoring).
- [ ] WGUI attribution ( [`GM-ROLL-RECORDING.md`](./GM-ROLL-RECORDING.md) ).
- [ ] Revision migration policy when publication updates under an in-flight campaign.

---

## Local development

```sh
# Node 22.13+. Copy .env.example → .env (secret optional for visual review).
npm run dev
```

Open **http://127.0.0.1:3010** (not `localhost`, so it matches `AMBA_GM_RUNTIME_ORIGIN` if you add a secret later).

1. In the same browser, sign in at the AMBA URL in `public/config.js` (e.g. unwhelm.online).
2. **Connect to AMBA** → pick a **published** module → **Open GM overview**.
3. **Browse adventure** — one-off tab; outcomes are not saved.
4. **Manage campaigns** — SQLite/Postgres when configured; otherwise **this browser** (IndexedDB, survives refresh).

Point `public/config.js` at your AMBA API. For Postgres proxy dev, set backend vars in `.env` per [`SERVER-PERSISTENCE.md`](./SERVER-PERSISTENCE.md).

```sh
npm test
```

---

## How to execute in Cursor

> Implement **Phase A** item N from `docs/MVP.md`  
> Run **Phase B** paired deploy checklist from `docs/MVP.md`