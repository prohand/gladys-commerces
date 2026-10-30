# Shops — user guide

This integration brings two things about the shops you go to into Gladys:

- their **opening hours**: which shops are open, and when they open or close;
- your **loyalty cards**, of any brand: their barcode on the dashboard, to scan at
  the till from your phone, and their balance.

Everything is computed in Gladys: no account, no password, nothing sent on the
internet.

## Set up

Open **Integrations**, find the integration, install it, then fill in the
**Configuration** screen.

| Field                   | What to put                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| Shops and opening hours | Your shops and their hours (see below). Leave empty if you only want cards. |
| Notice before ... (min) | When the "opens soon" / "closes soon" triggers fire. Default: 30 minutes.   |
| Card numbers            | Your loyalty cards (see below). Leave empty if you have none.               |

Then click **Test the configuration**: the answer says, shop by shop, whether it is
open, and which cards were understood.

Finally, open the **Discovery** tab of the integration and create the devices.

### Shops and opening hours

One shop per entry: a name, `=`, its hours. Separate the shops with `|`:

```
Leclerc = Mo-Sa 08:30-20:00; PH off | Pharmacy = Mo-Fr 09:00-19:00 | Bakery = Tu-Su 07:00-13:00,15:30-19:30
```

The hours use the OpenStreetMap syntax — often already shown on the shop's map page:

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
Ascension and Whit Monday included). Hours are read on the French clock. Up to 10
shops.

The name identifies the shop: renaming it creates a new device in Gladys.

### Loyalty cards

One card per entry: a name (brand, holder), `=`, then the number printed under the
barcode of the card. Separate the cards with `;`:

```
Leclerc Marie=2900123456785; Carrefour=2900987654327
```

Spaces and dashes in the number are ignored; the name is optional. Up to 20 cards.

**About the balance.** Shops offer no public API for their cards: a balance cannot be
read automatically without your password, through an unofficial interface that can
stop working at any time. The integration does not do that. You enter the balance
yourself — from the widget, or from a scene — and Gladys keeps it, with its history.

## Devices

| Device    | Feature                          | Notes                                     |
| --------- | -------------------------------- | ----------------------------------------- |
| Each shop | Open (1 = open, 0 = closed)      | Usable in any scene condition             |
| Each shop | Minutes until it opens or closes | Updated every minute                      |
| Each card | Balance (€)                      | Set by you; usable in any scene condition |

## Scenes

### Triggers

- **A shop opens soon** (`store_opening_soon`) and **A shop closes soon**
  (`store_closing_soon`): fired once, the configured number of minutes before. Filter:
  the shop (empty = any). Variables: shop name, time, minutes left. Example: "The
  {{store_name}} closes at {{time}}, {{minutes_left}} minutes left."

"The shop is open" and "the balance is above 10 €" are states: use the device
conditions of Gladys.

### Actions

- **Is a shop open?** (`is_store_open`): choose a shop. Outputs: _open_ (yes/no), the
  time of the next change (HH:MM) and the minutes until then.
- **Update a loyalty card balance** (`set_loyalty_balance`): choose a card, then _set
  the balance to_ an amount, or _add to the balance_ (a negative amount to spend).
  Output: the new balance. The balance never goes below 0.

## Dashboard

- **Shop hours**: every shop at a glance (open or closed, until when), or — with the
  setting _Shop_ — one shop in detail, with a countdown and today's hours.
- **Loyalty card**: the barcode of a card (setting _Card_; empty = the first one), its
  balance and its number, and an **Update the balance** button. Show it at the till:
  turn the brightness of your phone up for the scanner.

The barcode is an EAN-13 when the card number is one (13 digits, valid check digit),
a Code 128 otherwise. Both are read by till scanners.

## Troubleshooting

- **"The opening hours are not understood"**: the message names the wrong part. Use
  the English day names (`Mo`, not `Lu`) and `HH:MM` times (`08:30`, not `8h30`).
- **A shop is "not understood"**: each entry must be `Name = hours`, entries separated
  by `|`.
- **A card is "not understood"**: the number must be 6 to 20 digits.
- **The till does not read the barcode**: check the number, turn the brightness up,
  and zoom on the widget. If your card has another kind of barcode, tell us in an
  issue.

## Data

Nothing leaves your Gladys. The balances are kept in the integration's own `/data`
volume (`cards.json`) and as Gladys states.
