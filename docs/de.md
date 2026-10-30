# E.Leclerc — Benutzerhandbuch

Diese Integration bringt zwei Informationen über Ihren E.Leclerc-Markt in Gladys:

- **Produktrückrufe**: die Rückrufe von RappelConso, dem offiziellen französischen
  Register, die ein bei E.Leclerc verkauftes Produkt betreffen;
- **Öffnungszeiten**: ist Ihr Markt geöffnet, und wann öffnet oder schließt er.

Kein Konto, kein API-Schlüssel. Dies ist eine Community-Integration: Sie wird von
E.Leclerc weder erstellt noch geprüft noch unterstützt.

## Einrichtung

Öffnen Sie **Integrationen**, suchen Sie **E.Leclerc**, installieren Sie sie und
füllen Sie dann den Bildschirm **Konfiguration** aus.

| Feld                            | Was eintragen                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Name des Markts                 | Der Name des Markt-Geräts in Gladys, z. B. `E.Leclerc Carcassonne`.           |
| Öffnungszeiten                  | Die Zeiten Ihres Markts (siehe unten). Standard: `Mo-Sa 08:30-20:00; PH off`. |
| Vorlauf vor ... (Min.)          | Wann „öffnet bald“ / „schließt bald“ auslösen. Standard: 30 Minuten.          |
| Zu verfolgende Rückrufe         | _E.Leclerc und alle Händler_ (Standard) oder _nur die, die E.Leclerc nennen_. |
| Kategorien                      | Leer für alle, oder einige auswählen (Lebensmittel, Haustiere, Baby…).        |
| Rückrufe der letzten (Tage)     | Wie viele Tage Zähler und Liste zurückblicken. Standard: 30.                  |
| Aktualisierungsintervall (Min.) | Wie oft RappelConso gelesen wird. Standard: 60 Minuten.                       |

Klicken Sie dann auf **Konfiguration testen**: Die Antwort sagt, ob der Markt
geöffnet ist und wie viele Rückrufe ihn betreffen.

Öffnen Sie zuletzt den Reiter **Erkennung** der Integration und legen Sie die beiden
Geräte an.

### Öffnungszeiten

E.Leclerc veröffentlicht keine API für die Öffnungszeiten seiner Märkte: Sie geben
sie ein, in der OpenStreetMap-Syntax — oft schon auf der Kartenseite des Markts zu sehen:

| Sie schreiben                       | Bedeutung                                            |
| ----------------------------------- | ---------------------------------------------------- |
| `Mo-Sa 08:30-20:00`                 | Montag bis Samstag, 8:30 bis 20:00                   |
| `Mo-Fr 08:30-12:00,14:00-19:00`     | Mit Mittagspause                                     |
| `Mo-Sa 08:30-20:00; Su 09:00-12:30` | Regeln durch `;` getrennt                            |
| `Mo-Sa 08:30-20:00; We 08:30-21:00` | Eine spätere Regel ersetzt die frühere an diesem Tag |
| `...; PH off`                       | An französischen Feiertagen geschlossen              |
| `...; PH 09:00-12:30`               | Kürzere Zeiten an Feiertagen                         |
| `24/7`                              | Immer geöffnet                                       |

Tage: `Mo Tu We Th Fr Sa Su`. `PH` = französische Feiertage (Ostermontag, Christi
Himmelfahrt und Pfingstmontag inbegriffen). Die Zeiten gelten nach Pariser Uhrzeit.

### Welche Rückrufe

Jede Rückrufmeldung nennt, wer das Produkt verkauft hat. Die Integration behält:

- die Meldungen, die **E.Leclerc nennen**;
- mit _E.Leclerc und alle Händler_ auch die „bei allen Händlern“, „in
  Supermärkten“ (GMS)… verkauften: E.Leclerc hat sie auch verkauft, ohne genannt zu sein.

## Geräte

| Gerät                     | Funktion                                 | Hinweise                         |
| ------------------------- | ---------------------------------------- | -------------------------------- |
| Markt                     | Geöffnet (1 = geöffnet, 0 = geschlossen) | In jeder Szenenbedingung nutzbar |
| Markt                     | Minuten bis zur Öffnung oder Schließung  | Jede Minute aktualisiert         |
| E.Leclerc product recalls | Rückrufe                                 | Anzahl im eingestellten Zeitraum |
| E.Leclerc product recalls | Neuester Rückruf                         | „Marke – Produkt“                |

Das Rückruf-Gerät zeigt ein **Cloud**-Abzeichen, wenn RappelConso geantwortet hat,
sonst **nicht erreichbar**.

## Szenen

### Auslöser

- **Ein bei E.Leclerc verkauftes Produkt wird zurückgerufen** (`product_recalled`):
  eine neue Meldung betrifft Ihren Markt. Filter: Kategorie und _verkauft bei_
  (E.Leclerc genannt / alle Händler). Variablen: Produkt, Marke, Grund, Risiken,
  Link zur Meldung, Meldungsnummer. Beispiel: Senden Sie sich die Nachricht
  „Rückruf: {{product}} — {{reason}}“.
- **Der Markt öffnet bald** (`store_opening_soon`) und **Der Markt schließt bald**
  (`store_closing_soon`): einmal, die eingestellte Anzahl Minuten vorher.
  Variablen: Name des Markts, Uhrzeit, verbleibende Minuten.

Ein Rückruf wird einmal gemeldet. Bei der Installation bereits veröffentlichte
Rückrufe werden nicht gemeldet; die während Gladys aus war veröffentlichten schon,
beim nächsten Start.

### Aktionen

- **Barcode prüfen** (`check_barcode`): sucht ein Produkt im gesamten
  RappelConso-Register. Ausgaben: _zurückgerufen_ (ja/nein), Produkt, Grund, Link.
- **Ist der Markt geöffnet?** (`is_store_open`): Ausgaben _geöffnet_ (ja/nein), die
  Uhrzeit der nächsten Änderung (HH:MM) und die Minuten bis dahin.

## Dashboard

- **Öffnungszeiten**: geöffnet oder geschlossen, bis wann, heutige Zeiten.
- **Produktrückrufe**: der Zähler, die neuesten Rückrufe (antippen für Grund,
  Risiken, Verhalten und Meldung), eine Schaltfläche **Barcode prüfen** und eine
  Schaltfläche **Aktualisieren**. Die Einstellung _Angezeigte Rückrufe_ legt die
  Länge der Liste fest (0 bis 8).

## Fehlerbehebung

- **„Die Öffnungszeiten werden nicht verstanden“**: Die Meldung nennt den falschen
  Teil. Verwenden Sie die englischen Tagesnamen (`Mo`, `Tu`…) und `HH:MM`-Zeiten
  (`08:30`, nicht `8.30`).
- **RappelConso ist nicht erreichbar**: Die Integration braucht Internet. Sie
  versucht es beim nächsten Intervall erneut; die letzte Liste bleibt sichtbar.
- **Ein Barcode wird nicht gefunden**: Nur in der Meldung aufgeführte Barcodes
  werden gefunden. Prüfen Sie auch [rappel.conso.gouv.fr](https://rappel.conso.gouv.fr/).

## Daten

- Rückrufe: [RappelConso](https://rappel.conso.gouv.fr/), offene Daten des
  französischen Wirtschaftsministeriums (data.economie.gouv.fr), Licence Ouverte.
- Nichts über Sie wird gesendet: Nur der geprüfte Barcode wird online gesucht. Die
  Integration speichert die Liste der bereits gesehenen Rückrufe in ihrem Volume `/data`.
