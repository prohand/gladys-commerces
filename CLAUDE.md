# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime
dependency: `@gladysassistant/integration-sdk`) for the **shops** a household goes to: the
opening hours of several shops (typed, found on OpenStreetMap around the Gladys houses for
a shop written without hours, or picked in the Discovery tab among the shops found around
each house). Requires Gladys 5.3+. Manifest tags: `transports: ["local"]`
(the states are computed in the container), `location: true` (house coordinates, for the
OpenStreetMap lookups), `countries: ["FR"]` (French public holidays). Started from the official
JavaScript template.

Repository: `prohand/gladys-horaires-commerces` (formerly `gladys-commerces`, and before
that `gladys-eleclerc`: it started as an E.Leclerc integration). The package name, the image and the links of the manifest name it
once each; `test/manifest.test.js` checks that they agree.

Out of scope: product recalls (an existing RappelConso integration covers them), loyalty
cards (removed before the first release) and anything behind a retailer login (drive
orders): no public API, and the integration never asks for a customer's password.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/stores.test.js             # one file
node --test --test-name-pattern "overpass"  # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
```

CI runs `format:check`, `lint`, `test` on Node 22 and 24; pull requests also run the store
admission checks and a Docker build. Releases: **Actions → Release** only (bumps
`package.json`, manifest `version` + `docker_image`, rolls the changelog, tags, builds).

## Architecture

```
index.js                SDK bootstrap only
src/app.js              every handler wired on the SDK (createApp, tested end to end)
src/config.js           DEFAULT_CONFIG (= manifest defaults), LIMITS, normalizeConfig
src/i18n.js             LANGUAGES (en, fr, de, es), localize, pick
src/devices/index.js    one device per shop
src/shops/hours.js      opening_hours parser, French holidays, storeStatus
src/shops/stores.js     parseStores, StoreWatcher (per-minute state, opening/closing soon)
src/shops/finder.js     HoursFinder: Overpass lookups (by name, nearby, created), /data/hours.json
src/capabilities/       actions, scenes, widgets
```

### Invariants worth knowing

- **Keys are forever**: external ids (`store:<slug of the name>`, `store:osm-<n|w|r><osm id>`
  for a shop created from the Discovery tab, plus the feature keys), `SHOP_KINDS`
  keys, config keys, action / trigger / scene action / widget keys and `mode` values are
  stored by users. Never rename them, never change `storeSlug`.
- **Config syntax**: shops `Name = hours | Name = hours` (`|` and `=` never appear in the
  supported opening_hours subset), a name alone (= `Name = auto`), or `Name = auto: words`, for a
  lookup on OpenStreetMap (the default). The examples of the
  manifest placeholders and of the docs are parsed by the tests.
- **Hours are on the Europe/Paris clock**, whatever the container clock (UTC).
- **Opening state is a read-only switch**: on an `opening-sensor`, Gladys reads 1 as closed.
- **Triggers fire once per change and never on a store's first tick**; the per-store
  memory survives a new configuration.
- **No event as a consequence of a scene action** (loop rule of the SDK).
- `poll_frequency` is not used: the integration runs its own one-minute timer.
- **The only network call is the OpenStreetMap lookup** (one Overpass query, once a
  day, to `api.overpass.ch` only, with the user's free key from the `overpass_ch_key`
  secret; never log the URL, it holds the key): shops without hours, kinds to
  discover, created shops by id. None of the three, or no key: no call, no
  `getHouses()` (no key: the stores show `no_key`). User words reach the query only as letters and digits
  (`searchPattern`). A created shop keeps its hours in its device params too
  (`OSM_OPENING_HOURS`), for a start without cache nor network.
- The rootfs is read-only: write only under `/data`. Tests never touch the disk outside a
  temp dir (inject `storage`, `hoursCache`) nor the network (inject `fetch`).

### Manifest

`test/manifest.test.js` ties `gladys-assistant-integration.json` to the code (defaults and
bounds, actions, triggers and their data, scene actions, widgets, placeholder and docs
examples, repository name) and checks that every text has `en`, `fr`, `de` and `es`.

## Conventions

- **Versions** belong to the Release workflow: never edit `version` / `docker_image` by hand.
- **Changelog**: every user-visible change adds a line under `## [Unreleased]`
  (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never write a version heading.
- **User-facing text** is `{ en, fr, de, es }`; user docs in `docs/en.md`, `docs/fr.md`,
  `docs/de.md`, `docs/es.md`, kept in sync.
- Prettier formats, ESLint catches mistakes. Comments explain why, in English.
