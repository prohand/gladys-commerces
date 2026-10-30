# E.Leclerc — user guide

This integration brings two things about your E.Leclerc store into Gladys:

- **product recalls**: the recalls of RappelConso, the official French register,
  that concern a product sold at E.Leclerc;
- **opening hours**: whether your store is open, and when it opens or closes.

No account and no API key are needed. This is a community integration: it is not
made, checked or supported by E.Leclerc.

## Set up

Open **Integrations**, find **E.Leclerc**, install it, then fill in the
**Configuration** screen.

| Field                   | What to put                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| Store name              | The name of the store device in Gladys, e.g. `E.Leclerc Carcassonne`.      |
| Opening hours           | The hours of your store (see below). Default: `Mo-Sa 08:30-20:00; PH off`. |
| Notice before ... (min) | When the "opens soon" / "closes soon" triggers fire. Default: 30 minutes.  |
| Recalls to follow       | _E.Leclerc and all retailers_ (default), or _only those naming E.Leclerc_. |
| Categories              | Leave empty to follow every category, or pick some (food, pets, baby…).    |
| Recalls of the last     | How many days the counter and the list look back. Default: 30.             |
| Refresh interval (min)  | How often RappelConso is read. Default: 60 minutes.                        |

Then click **Test the configuration**: the answer says whether the store is open
and how many recalls concern it.

Finally, open the **Discovery** tab of the integration and create the two devices.

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

Days: `Mo Tu We Th Fr Sa Su`. `PH` = French public holidays (Easter, Ascension
and Whit Monday included). Hours are read on the French clock.

### Which recalls

Each recall notice lists who sold the product. The integration keeps:

- the notices that **name E.Leclerc**;
- with _E.Leclerc and all retailers_, also the ones sold "by all retailers",
  "in supermarkets" (GMS)…: E.Leclerc sold them too, even unnamed.

## Devices

| Device                    | Feature                          | Notes                            |
| ------------------------- | -------------------------------- | -------------------------------- |
| Store                     | Open (1 = open, 0 = closed)      | Usable in any scene condition    |
| Store                     | Minutes until it opens or closes | Updated every minute             |
| E.Leclerc product recalls | Recalls                          | Count over the configured window |
| E.Leclerc product recalls | Latest recall                    | "Brand – product"                |

The recalls device shows a **cloud** badge when RappelConso answered, and
**unreachable** when it did not.

## Scenes

### Triggers

- **A product sold at E.Leclerc is recalled** (`product_recalled`): a new notice
  concerns your store. Filters: category, and _sold at_ (E.Leclerc named / all
  retailers). Variables: product, brand, reason, risks, notice link, notice
  number. Example: send yourself a message "Recall: {{product}} — {{reason}}".
- **The store opens soon** (`store_opening_soon`) and **The store closes soon**
  (`store_closing_soon`): fired once, the configured number of minutes before.
  Variables: store name, time, minutes left.

A recall is announced once. Recalls already published when the integration is
installed are not announced; the ones published while Gladys was off are, at the
next start.

### Actions

- **Check a barcode** (`check_barcode`): looks a product up in the whole
  RappelConso register. Outputs: _recalled_ (yes/no), product, reason, notice link.
- **Is the store open?** (`is_store_open`): outputs _open_ (yes/no), the time of
  the next change (HH:MM) and the minutes until then.

## Dashboard

- **Store hours**: open or closed, until when, today's hours.
- **Product recalls**: the counter, the latest recalls (tap one for the reason,
  the risks, what to do and the notice), a **Check a barcode** button and a
  **Refresh** button. The setting _Recalls shown_ sets the list length (0 to 8).

## Troubleshooting

- **"The opening hours are not understood"**: the message names the wrong part.
  Use the English day names (`Mo`, not `Lu`) and `HH:MM` times (`08:30`, not `8h30`).
- **RappelConso cannot be reached**: the integration needs internet access. It
  tries again at the next interval; the last list stays shown.
- **A barcode is not found**: only barcodes printed in the notice are found. Check
  the notice on [rappel.conso.gouv.fr](https://rappel.conso.gouv.fr/) too.

## Data

- Recalls: [RappelConso](https://rappel.conso.gouv.fr/), open data of the French
  Ministry of the Economy (data.economie.gouv.fr), Licence Ouverte.
- Nothing about you is sent anywhere: the barcode you check is the only thing
  searched online. The integration stores the list of recalls already seen in its
  own `/data` volume.
