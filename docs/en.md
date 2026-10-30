# Horaires Commerces — user guide

This integration brings two things about the shops you go to into Gladys:

- their **opening hours**: which shops are open, and when they open or close;
- your **loyalty cards**, of any brand: their barcode on the dashboard, to scan at
  the till from your phone, and their balance.

Everything is computed in Gladys: no account, no password. The only call out is to
OpenStreetMap, to find the hours of shops around your houses (see below).

## Set up

Open **Integrations**, find the integration, install it, then fill in the
**Configuration** screen.

| Field                   | What to put                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| Shops and opening hours | Your shops and their hours (see below). Leave empty if you only want cards.    |
| Houses to search around | The Gladys houses to search around. None checked: every house with a location. |
| Search radius ... (km)  | How far from a house the shops are looked for. Default: 10.                    |
| Kinds of shops ...      | The kinds of shops offered in the Discovery tab. None checked: none.           |
| overpass.ch key         | Optional: a steadier OpenStreetMap server (see below how to get the key).      |
| Notice before ... (min) | When the "opens soon" / "closes soon" triggers fire. Default: 30 minutes.      |
| Card numbers            | Your loyalty cards (see below). Leave empty if you have none.                  |

Then click **Test the configuration**: the answer says, shop by shop, whether it is
open, and which cards were understood.

Finally, open the **Discovery** tab of the integration and create the devices.

### Shops and opening hours

One shop per entry: a name, then `=` and its hours if you want to type them. Separate the shops with `|`:

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

#### Hours found automatically

Write only the name: `Leclerc` (or `Leclerc = auto`). The integration then looks on
OpenStreetMap for the shop of that name nearest to your Gladys houses (all the
houses with a location, set in **Settings → Houses**), and takes its hours. To look
for other words than the name, write them after `auto:`, for example
`Bakery = auto: Boulangerie Dupont`. Accents and case do not matter.

- With several houses, the nearest shop of all houses wins: give a precise name
  (`auto: Carrefour Market Vierzon`) to pick one near a given house.
- **Test the configuration** names the shop found, its town, its distance and its
  hours: check it is the right one.
- The hours are looked up again once a day, and kept: a restart without network
  keeps them.
- If OpenStreetMap has no hours for your shop, or hours the integration cannot
  read, type them by hand (and why not add them on openstreetmap.org).

### Shops around your houses (Discovery tab)

The integration looks on OpenStreetMap, around each Gladys house with a location
(set in **Settings → Houses**), for the nearest shops of the kinds checked in the
configuration — supermarkets, bakeries, pharmacies, post offices, recycling
centres… — that publish their opening hours. The 3 nearest of each kind, per house.

Open the **Discovery** tab of the integration: each shop is listed with its house
and its distance, for example `E.Leclerc (Home, 1.3 km)`. Create the ones you go to,
in a room of the right house, and rename them as you like: they work like the shops
you type, and their hours are kept up to date once a day.

### overpass.ch key (optional)

The hours are looked up on free public OpenStreetMap servers, often busy: the
lookup then fails ("OpenStreetMap could not be reached") and tries again within the
hour. For a steadier lookup, get a free key from [overpass.ch](https://overpass.ch):
its server is asked first, the public ones if it fails. The free plan (no credit
card, for personal use) gives 10,000 requests a month; the integration makes one a
day.

1. Open [overpass.ch/signup](https://overpass.ch/signup) (**Get a free key** button on
   the home page).
2. Fill in **E-mail**, **Password** (at least 10 characters) and **Website** (for
   example `https://github.com/prohand/gladys-horaires-commerces`), tick the terms,
   then click **Create account** (or **Continue with Google**).
3. Open the e-mail you receive and click the confirmation link.
4. **Log in** and open the keys page:
   [overpass.ch/dashboard/keys](https://overpass.ch/dashboard/keys). Create a key.
   **Leave "Allowed referers" empty and do not tick "Reject requests without a
   referer"**: the integration sends no referer, the server would refuse its requests
   (error 403 `forbidden_referer`).
5. Copy the key. Its whole URL, `https://api.overpass.ch/v1/…/interpreter`, works too.
6. In Gladys: **Integrations** → **Horaires Commerces** → **Configuration**, paste it
   in **overpass.ch key** and save.
7. Click **Test the configuration**. The integration logs say
   `OpenStreetMap answered by api.overpass.ch` when the key works.

The key is personal: do not publish it (forum, code repository, screenshot). A key
refused (403, monthly quota used up) stops nothing: the public servers take over,
and the logs say `api.overpass.ch failed (…)`.

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

- **The Discovery tab is empty**: click **Test the configuration**: it looks again
  on OpenStreetMap and says why (house without a location, no kind checked,
  OpenStreetMap unreachable, no shop of these kinds within the radius).
- **"OpenStreetMap could not be reached"**: the free public servers are often busy.
  Set a free overpass.ch key (see **overpass.ch key** above).
- **"No shop of this name ... on OpenStreetMap"**: try fewer words, a wider
  **Search radius**, or type the hours by hand.
- **"No house of Gladys has a location"**: set the house location in **Settings →
  Houses**.
- **"The opening hours are not understood"**: the message names the wrong part. Use
  the English day names (`Mo`, not `Lu`) and `HH:MM` times (`08:30`, not `8h30`).
- **A shop is "not understood"**: each entry must be `Name = hours`, entries separated
  by `|`.
- **A card is "not understood"**: the number must be 6 to 20 digits.
- **The till does not read the barcode**: check the number, turn the brightness up,
  and zoom on the widget. If your card has another kind of barcode, tell us in an
  issue.

## Data

The balances are kept in the integration's own `/data` volume (`cards.json`) and
as Gladys states; they never leave your Gladys.

To find the hours (shops written without hours, and the Discovery tab), the words
looked for, the kinds of shops and the location of your houses (an area of the
search radius around each) are sent to the OpenStreetMap Overpass API (first to
`api.overpass.ch` if you gave a key, in Germany; then `overpass-api.de`; when it does not answer, `overpass.private.coffee`, then
`maps.mail.ru` run by VK), once a day. The hours found are kept in `/data/hours.json`. To
send nothing: type the hours of every shop and uncheck every kind of shop.
