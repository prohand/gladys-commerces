# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime
dependency: `@gladysassistant/integration-sdk`) for an **E.Leclerc** store: the product
recalls of RappelConso (French official open data) that concern E.Leclerc, and the store's
opening hours. Requires Gladys 5.3+. Manifest tags: `transports: ["cloud"]`,
`countries: ["FR"]`. Started from the official JavaScript template.

E.Leclerc Drive is out of scope: no public API.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/hours.test.js              # one file
node --test --test-name-pattern "barcode"   # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
```

CI runs `format:check`, `lint`, `test` on Node 22 and 24; pull requests also run the store
admission checks and a Docker build. Releases: **Actions → Release** only (bumps
`package.json`, manifest `version` + `docker_image`, rolls the changelog, tags, builds).

## Architecture

```
index.js                     SDK bootstrap only
src/app.js                   every handler wired on the SDK (createApp, tested end to end)
src/config.js                DEFAULT_CONFIG (= manifest defaults), LIMITS, normalizeConfig
src/i18n.js                  LANGUAGES (en, fr, de, es), localize, pick
src/devices/index.js         the two devices: store, recalls
src/leclerc/recalls.js       RappelConso client (v2 dataset, v1 fallback), parser, filters
src/leclerc/recallFeed.js    periodic read, states, product_recalled, memory in /data
src/leclerc/hours.js         opening_hours parser, French holidays, storeStatus
src/leclerc/store.js         per-minute state, store_opening_soon / store_closing_soon
src/capabilities/            actions, barcode check, scenes, widgets
```

### Invariants worth knowing

- **Keys are forever**: external ids (`store:main`, `recalls:rappelconso` + feature keys),
  config keys, action / trigger / scene action / widget keys, category keys and `sold_at`
  values are stored by users. Never rename them.
- **Two RappelConso namings**: `parseRecall` reads both datasets; add a field by giving
  both names to `first()`.
- **Retailer filtering is client-side** (`retailerScope`): a server query on "leclerc"
  would miss "Tous distributeurs".
- **A recall is announced once**: every reference read (in scope or not) is stored in
  `/data/recalls-seen.json`; no memory = first run = no event. Max 20 events per read.
- **Hours are on the Europe/Paris clock**, whatever the container clock (UTC).
- **Opening state is a read-only switch**: on an `opening-sensor`, Gladys reads 1 as closed.
- **No event as a consequence of a scene action** (loop rule of the SDK).
- `poll_frequency` is not used: the integration runs its own timers.
- The rootfs is read-only: write only under `/data`. Tests never touch the network
  (inject `fetchRecalls` / `findRecalls` / `fetchImpl`).

### Manifest

`test/manifest.test.js` ties `gladys-assistant-integration.json` to the code (defaults and
bounds, actions, triggers and their data, scene actions, widgets, categories) and checks
that every text has `en`, `fr`, `de` and `es`.

## Conventions

- **Versions** belong to the Release workflow: never edit `version` / `docker_image` by hand.
- **Changelog**: every user-visible change adds a line under `## [Unreleased]`
  (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never write a version heading.
- **User-facing text** is `{ en, fr, de, es }`; user docs in `docs/en.md`, `docs/fr.md`,
  `docs/de.md`, `docs/es.md`, kept in sync.
- Prettier formats, ESLint catches mistakes. Comments explain why, in English.
