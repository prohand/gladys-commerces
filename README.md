# E.Leclerc — Gladys Assistant integration

External integration bringing two things about an **E.Leclerc** store into
[Gladys Assistant](https://gladysassistant.com):

- the **product recalls** of [RappelConso](https://rappel.conso.gouv.fr/), the
  official French recall register, that concern a product sold at E.Leclerc;
- the **opening hours** of the store: open or closed, and when that changes.

No account, no API key. Community integration, not affiliated with E.Leclerc.

Built on the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
and the SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).
Requires **Gladys 5.3.0 or later**. Tags: **cloud** (RappelConso is read on the
internet), country **FR**.

User documentation: [English](./docs/en.md) · [Français](./docs/fr.md) ·
[Deutsch](./docs/de.md) · [Español](./docs/es.md).

## What it does

| Device          | Features                                                  | Source                  |
| --------------- | --------------------------------------------------------- | ----------------------- |
| Store           | Open (read-only switch), minutes until it opens or closes | Hours typed by the user |
| Product recalls | Number of recalls over the window, latest recall (text)   | RappelConso open data   |

Scenes (Gladys 5.1+, `src/capabilities/scenes.js`):

| Kind    | Key                  | What                                             |
| ------- | -------------------- | ------------------------------------------------ |
| Trigger | `product_recalled`   | A new recall concerns the store                  |
| Trigger | `store_opening_soon` | The store opens within the configured notice     |
| Trigger | `store_closing_soon` | The store closes within the configured notice    |
| Action  | `check_barcode`      | Is this product recalled? (outputs: recalled, …) |
| Action  | `is_store_open`      | Open now? (outputs: open, next_change, minutes)  |

Dashboard widgets (`src/capabilities/widgets.js`): **Store hours** and **Product
recalls** (list, barcode form, refresh).

Configuration-screen actions: **Test the configuration** and **Check a barcode**.

## How it works

**Recalls.** `src/leclerc/recalls.js` reads the RappelConso datasets of
data.economie.gouv.fr (Opendatasoft explore API v2.1): the current
`rappelconso-v2-gtin-espaces`, or the historical `rappelconso0` when the first
answers 404 — the parser accepts both field namings. Who sold a product is a
free-text field (`distributeurs`): the recalls naming Leclerc are kept, and,
under the default scope, the ones sold "by all retailers" / "in supermarkets"
too. `src/leclerc/recallFeed.js` reads the window at the configured interval,
fires `product_recalled` once per new notice, and remembers the notices seen
in `/data/recalls-seen.json`, so a restart neither replays nor misses any.

**Hours.** E.Leclerc publishes no API for store hours. The user types them in the
OpenStreetMap `opening_hours` syntax (common subset: days, ranges, `PH` for French
public holidays, `off`, `24/7`), parsed and evaluated on the Europe/Paris clock by
`src/leclerc/hours.js`. `src/leclerc/store.js` publishes the state every minute
and fires the "soon" triggers once per change.

**Drive.** E.Leclerc Drive has no public API; it is not supported.

## Project structure

```
.
├─ index.js                      # SDK bootstrap, graceful shutdown
├─ src/
│  ├─ app.js                     # every handler wired on the SDK (tested end to end)
│  ├─ config.js                  # defaults (= manifest) + normalization
│  ├─ i18n.js                    # languages of user-facing text (en, fr, de, es)
│  ├─ devices/index.js           # the store and recalls devices
│  ├─ leclerc/
│  │  ├─ http.js                 #   JSON GET with timeout
│  │  ├─ recalls.js              #   RappelConso client, parser and filters
│  │  ├─ recallFeed.js           #   periodic read, states, trigger, memory in /data
│  │  ├─ hours.js                #   opening_hours parser, French holidays, status
│  │  └─ store.js                #   per-minute store state and triggers
│  └─ capabilities/
│     ├─ actions.js              #   Configuration-screen buttons
│     ├─ barcode.js              #   barcode check, shared by the three surfaces
│     ├─ scenes.js               #   scene triggers and actions
│     └─ widgets.js              #   dashboard widgets
├─ test/                         # node --test, SDK fake Gladys, no network
├─ docs/{en,fr,de,es}.md         # user documentation
├─ gladys-assistant-integration.json
├─ Dockerfile
└─ .github/                      # CI, build, release, GitHub releases, Dependabot
```

## Development

```bash
npm install
npm test
npm run lint
npm run format:check
```

CI (`.github/workflows/ci.yml`) runs Prettier, ESLint and the tests on Node 22 and
24, and on pull requests the store admission checks and a Docker build.

## Release

**Actions → Release → Run workflow** (patch / minor / major): bumps
`package.json`, the manifest `version` and `docker_image`, rolls the changelog,
tags, builds the multi-arch image (`ghcr.io/prohand/gladys-eleclerc`), publishes
the GitHub Release and runs the full store checks. Never edit the versions by hand.

The very first image can also be published by pushing the tag of the current
version (`v1.0.0`): `build.yml` builds it.

## Licence

Apache-2.0. Recall data: RappelConso, Licence Ouverte (Etalab).
E.Leclerc is a trademark of its owner; this project is not affiliated with it.
