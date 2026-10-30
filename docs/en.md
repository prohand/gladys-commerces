# E.Leclerc — user guide

This integration brings two things about E.Leclerc into Gladys:

- the **opening hours** of your store: is it open, and when does it open or close;
- your **loyalty cards** (Carte E.Leclerc): their barcode on the dashboard, to scan
  at the till from your phone, and their balance.

Everything is computed in Gladys: no account, no password, nothing sent on the
internet. This is a community integration: it is not made, checked or supported by
E.Leclerc.

## Set up

Open **Integrations**, find **E.Leclerc**, install it, then fill in the
**Configuration** screen.

| Field                   | What to put                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| Store name              | The name of the store device in Gladys, e.g. `E.Leclerc Carcassonne`.      |
| Opening hours           | The hours of your store (see below). Default: `Mo-Sa 08:30-20:00; PH off`. |
| Notice before ... (min) | When the "opens soon" / "closes soon" triggers fire. Default: 30 minutes.  |
| Card numbers            | Your loyalty cards (see below). Leave empty if you have none.              |

Then click **Test the configuration**: the answer says whether the store is open and
which cards were understood.

Finally, open the **Discovery** tab of the integration and create the devices.

### Opening hours

E.Leclerc publishes no API for its stores' hours, so you type them, in the
OpenStreetMap syntax — often already shown on the store's map page:

| You write                           | It means                                       |
| ----------------------------------- | ---------------------------------------------- |
| `Mo-Sa 08:30-20:00`                 | Monday to Saturday, 8:30 to 20:00              |
| `Mo-Fr 08:30-12:00,14:00-19:00`     | With a lunch break                             |
| `Mo-Sa 08:30-20:00; Su 09:00-12:30` | Rules separated by `;`                         |
| `Mo-Sa 08:30-20:00; We 08:30-21:00` | A later rule replaces the earlier one that day |
| `...; PH off`                       | Closed on French public holidays               |
| `...; PH 09:00-12:30`               | Shorter hours on public holidays               |
| `24/7`                              | Always open                                    |

Days: `Mo Tu We Th Fr Sa Su`. `PH` = French public holidays (Easter Monday,
Ascension and Whit Monday included). Hours are read on the French clock.

### Loyalty cards

One card per person: a name, `=`, then the number printed under the barcode of the
card. Separate the cards with `;`:

```
Marie=2900123456785; Paul=2900987654327
```

Spaces and dashes in the number are ignored; the name is optional. Up to 10 cards.

**About the balance.** E.Leclerc offers no public API for its cards: the balance of
your "Ticket E.Leclerc" cannot be read automatically without your password, through
an unofficial interface that can stop working at any time. The integration does not
do that. You enter the balance yourself — from the widget, or from a scene — and
Gladys keeps it, with its history.

## Devices

| Device                  | Feature                          | Notes                                     |
| ----------------------- | -------------------------------- | ----------------------------------------- |
| Store                   | Open (1 = open, 0 = closed)      | Usable in any scene condition             |
| Store                   | Minutes until it opens or closes | Updated every minute                      |
| E.Leclerc card _<name>_ | Balance (€)                      | Set by you; usable in any scene condition |

## Scenes

### Triggers

- **The store opens soon** (`store_opening_soon`) and **The store closes soon**
  (`store_closing_soon`): fired once, the configured number of minutes before.
  Variables: store name, time, minutes left. Example: "The store closes at
  {{time}}, {{minutes_left}} minutes left."

"The store is open" and "the balance is above 10 €" are states: use the device
conditions of Gladys.

### Actions

- **Is the store open?** (`is_store_open`): outputs _open_ (yes/no), the time of the
  next change (HH:MM) and the minutes until then.
- **Update a loyalty card balance** (`set_loyalty_balance`): choose a card, then
  _set the balance to_ an amount, or _add to the balance_ (a negative amount to
  spend). Output: the new balance. The balance never goes below 0.

## Dashboard

- **Store hours**: open or closed, until when, today's hours.
- **Loyalty card**: the barcode of a card (setting _Card_; empty = the first one),
  its balance and its number, and an **Update the balance** button. Show it at the
  till: turn the brightness of your phone up for the scanner.

The barcode is an EAN-13 when the card number is one (13 digits, valid check digit),
a Code 128 otherwise. Both are read by till scanners.

## Troubleshooting

- **"The opening hours are not understood"**: the message names the wrong part. Use
  the English day names (`Mo`, not `Lu`) and `HH:MM` times (`08:30`, not `8h30`).
- **A card is "not understood"**: the number must be 6 to 20 digits. **Test the
  configuration** lists what was not understood.
- **The till does not read the barcode**: check the number, turn the brightness up,
  and zoom on the widget. If your card has another kind of barcode, tell us in an
  issue.

## Data

Nothing leaves your Gladys. The balances are kept in the integration's own `/data`
volume (`cards.json`) and as Gladys states.
