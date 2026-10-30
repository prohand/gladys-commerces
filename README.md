# E.Leclerc — Gladys Assistant integration

External integration bringing two things about **E.Leclerc** into
[Gladys Assistant](https://gladysassistant.com):

- the **opening hours** of your store: open or closed, and when that changes;
- your **loyalty cards** (Carte E.Leclerc): the barcode on the dashboard, to scan at
  the till from a phone, and the balance.

No account, no API key, nothing sent on the internet. Community integration, not
affiliated with E.Leclerc. For product recalls, see the RappelConso integration.

Built on the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
and the SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).
Requires **Gladys 5.3.0 or later**. Tags: **local** (everything is computed in the
container), country **FR**.

User documentation: [English](./docs/en.md) · [Français](./docs/fr.md) ·
[Deutsch](./docs/de.md) · [Español](./docs/es.md).

## What it does

| Device               | Features                                                  | Source                  |
| -------------------- | --------------------------------------------------------- | ----------------------- |
| Store                | Open (read-only switch), minutes until it opens or closes | Hours typed by the user |
| One per loyalty card | Balance (€), with history                                 | Entered by the user     |

Scenes (Gladys 5.1+, `src/capabilities/scenes.js`):

| Kind    | Key                   | What                                                 |
| ------- | --------------------- | ---------------------------------------------------- |
| Trigger | `store_opening_soon`  | The store opens within the configured notice         |
| Trigger | `store_closing_soon`  | The store closes within the configured notice        |
| Action  | `is_store_open`       | Open now? (outputs: open, next_change, minutes)      |
| Action  | `set_loyalty_balance` | Set or add to a card's balance (output: the new one) |

Dashboard widgets (`src/capabilities/widgets.js`): **Store hours** and **Loyalty
card** (barcode image, balance, form to update it).

Configuration-screen action: **Test the configuration**.

## How it works

**Hours.** E.Leclerc publishes no API for store hours. The user types them in the
OpenStreetMap `opening_hours` syntax (common subset: days, ranges, `PH` for French
public holidays, `off`, `24/7`), parsed and evaluated on the Europe/Paris clock by
`src/leclerc/hours.js`. `src/leclerc/store.js` publishes the state every minute and
fires the "soon" triggers once per change.

**Loyalty cards.** There is no public API for the cards either: reading the "Ticket
E.Leclerc" balance would take the customer's password and an unofficial interface,
which this integration refuses to depend on. The user types the card numbers
(`Name=number; ...`); `src/leclerc/barcode.js` draws each card's barcode — EAN-13 when
the number is one, Code 128 otherwise — as a PNG (`src/leclerc/png.js`, no
dependency) served through `onWidgetGetImage`. The balance is entered from the widget
form or a scene action, kept in `/data/cards.json` and published as a Gladys currency
feature.

## Project structure

```
.
├─ index.js                      # SDK bootstrap, graceful shutdown
├─ src/
│  ├─ app.js                     # every handler wired on the SDK (tested end to end)
│  ├─ config.js                  # defaults (= manifest) + normalization
│  ├─ i18n.js                    # languages of user-facing text (en, fr, de, es)
│  ├─ devices/index.js           # the store and loyalty card devices
│  ├─ leclerc/
│  │  ├─ hours.js                #   opening_hours parser, French holidays, status
│  │  ├─ store.js                #   per-minute store state and triggers
│  │  ├─ cards.js                #   card list, balances in /data
│  │  ├─ barcode.js              #   EAN-13 and Code 128 modules, PNG
│  │  └─ png.js                  #   minimal grayscale PNG writer
│  └─ capabilities/
│     ├─ actions.js              #   Configuration-screen button
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
24, and on pull requests the store admission checks and a Docker build. The barcode
tests compare the modules with reference ones drawn by the python-barcode library.

## Release

**Actions → Release → Run workflow** (patch / minor / major): bumps `package.json`,
the manifest `version` and `docker_image`, rolls the changelog, tags, builds the
multi-arch image (`ghcr.io/prohand/gladys-eleclerc`), publishes the GitHub Release
and runs the full store checks. Never edit the versions by hand.

The very first image can also be published by pushing the tag of the current version
(`v1.0.0`): `build.yml` builds it.

## Licence

Apache-2.0. E.Leclerc is a trademark of its owner; this project is not affiliated
with it.
