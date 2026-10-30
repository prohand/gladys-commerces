# E.Leclerc — Benutzerhandbuch

Diese Integration bringt zwei Dinge zu E.Leclerc in Gladys:

- die **Öffnungszeiten** Ihres Markts: ist er geöffnet, wann öffnet oder schließt er;
- Ihre **Kundenkarten** (Carte E.Leclerc): ihr Barcode auf dem Dashboard, zum
  Scannen an der Kasse mit dem Handy, und ihr Guthaben.

Alles wird in Gladys berechnet: kein Konto, kein Passwort, nichts wird ins Internet
gesendet. Dies ist eine Community-Integration: Sie wird von E.Leclerc weder erstellt
noch geprüft noch unterstützt.

## Einrichtung

Öffnen Sie **Integrationen**, suchen Sie **E.Leclerc**, installieren Sie sie und
füllen Sie dann den Bildschirm **Konfiguration** aus.

| Feld                   | Was eintragen                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- |
| Name des Markts        | Der Name des Markt-Geräts in Gladys, z. B. `E.Leclerc Carcassonne`.           |
| Öffnungszeiten         | Die Zeiten Ihres Markts (siehe unten). Standard: `Mo-Sa 08:30-20:00; PH off`. |
| Vorlauf vor ... (Min.) | Wann „öffnet bald“ / „schließt bald“ auslösen. Standard: 30 Minuten.          |
| Kartennummern          | Ihre Kundenkarten (siehe unten). Leer lassen, wenn Sie keine haben.           |

Klicken Sie dann auf **Konfiguration testen**: Die Antwort sagt, ob der Markt
geöffnet ist und welche Karten verstanden wurden.

Öffnen Sie zuletzt den Reiter **Erkennung** der Integration und legen Sie die Geräte an.

### Öffnungszeiten

E.Leclerc veröffentlicht keine API für die Öffnungszeiten seiner Märkte: Sie geben
sie ein, in der OpenStreetMap-Syntax — oft schon auf der Kartenseite des Markts zu
sehen:

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

### Kundenkarten

Eine Karte pro Person: ein Name, `=`, dann die unter dem Barcode der Karte gedruckte
Nummer. Trennen Sie die Karten mit `;`:

```
Marie=2900123456785; Paul=2900987654327
```

Leerzeichen und Bindestriche in der Nummer werden ignoriert; der Name ist optional.
Höchstens 10 Karten.

**Zum Guthaben.** E.Leclerc bietet keine öffentliche API für seine Karten: Das
Guthaben „Ticket E.Leclerc“ kann nicht automatisch gelesen werden, ohne Ihr Passwort
über eine inoffizielle Schnittstelle, die jederzeit ausfallen kann. Die Integration
tut das nicht. Sie geben das Guthaben selbst ein — im Widget oder in einer Szene —
und Gladys speichert es mit seinem Verlauf.

## Geräte

| Gerät                   | Funktion                                 | Hinweise                                     |
| ----------------------- | ---------------------------------------- | -------------------------------------------- |
| Markt                   | Geöffnet (1 = geöffnet, 0 = geschlossen) | In jeder Szenenbedingung nutzbar             |
| Markt                   | Minuten bis zur Öffnung oder Schließung  | Jede Minute aktualisiert                     |
| E.Leclerc card _<Name>_ | Guthaben (€)                             | Von Ihnen eingegeben; in Bedingungen nutzbar |

## Szenen

### Auslöser

- **Der Markt öffnet bald** (`store_opening_soon`) und **Der Markt schließt bald**
  (`store_closing_soon`): einmal, die eingestellte Anzahl Minuten vorher. Variablen:
  Name des Markts, Uhrzeit, verbleibende Minuten. Beispiel: „Der Markt schließt um
  {{time}}, noch {{minutes_left}} Minuten.“

„Der Markt ist geöffnet“ und „das Guthaben liegt über 10 €“ sind Zustände: Nutzen
Sie die Gerätebedingungen von Gladys.

### Aktionen

- **Ist der Markt geöffnet?** (`is_store_open`): Ausgaben _geöffnet_ (ja/nein), die
  Uhrzeit der nächsten Änderung (HH:MM) und die Minuten bis dahin.
- **Guthaben einer Kundenkarte ändern** (`set_loyalty_balance`): Wählen Sie eine
  Karte, dann _Guthaben setzen auf_ einen Betrag oder _zum Guthaben addieren_ (ein
  negativer Betrag zum Ausgeben). Ausgabe: das neue Guthaben. Es fällt nie unter 0.

## Dashboard

- **Öffnungszeiten**: geöffnet oder geschlossen, bis wann, heutige Zeiten.
- **Kundenkarte**: der Barcode einer Karte (Einstellung _Karte_; leer = die erste),
  ihr Guthaben und ihre Nummer, und eine Schaltfläche **Guthaben aktualisieren**.
  An der Kasse vorzeigen: Erhöhen Sie die Helligkeit des Handys für den Scanner.

Der Barcode ist ein EAN-13, wenn die Kartennummer einer ist (13 Ziffern, gültige
Prüfziffer), sonst ein Code 128. Kassenscanner lesen beide.

## Fehlerbehebung

- **„Die Öffnungszeiten werden nicht verstanden“**: Die Meldung nennt den falschen
  Teil. Verwenden Sie die englischen Tagesnamen (`Mo`, `Tu`…) und `HH:MM`-Zeiten
  (`08:30`, nicht `8.30`).
- **Eine Karte wird „nicht verstanden“**: Die Nummer muss 6 bis 20 Ziffern haben.
  **Konfiguration testen** listet, was nicht verstanden wurde.
- **Die Kasse liest den Barcode nicht**: Prüfen Sie die Nummer, erhöhen Sie die
  Helligkeit und zoomen Sie auf das Widget. Trägt Ihre Karte eine andere Barcode-Art,
  melden Sie es in einem Issue.

## Daten

Nichts verlässt Ihr Gladys. Die Guthaben werden im Volume `/data` der Integration
(`cards.json`) und als Gladys-Zustände gespeichert.
