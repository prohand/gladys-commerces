# Geschäfte — Benutzerhandbuch

Diese Integration bringt zwei Dinge zu den Geschäften, in die Sie gehen, in Gladys:

- ihre **Öffnungszeiten**: welche Geschäfte geöffnet sind, wann sie öffnen oder
  schließen;
- Ihre **Kundenkarten** aller Marken: ihr Barcode auf dem Dashboard, zum Scannen an
  der Kasse mit dem Handy, und ihr Guthaben.

Alles wird in Gladys berechnet: kein Konto, kein Passwort. Der einzige Aufruf nach
außen geht an OpenStreetMap, um die Zeiten der Geschäfte rund um Ihre Häuser zu
finden (siehe unten).

## Einrichtung

Öffnen Sie **Integrationen**, suchen Sie die Integration, installieren Sie sie und
füllen Sie dann den Bildschirm **Konfiguration** aus.

| Feld                         | Was eintragen                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Geschäfte und Öffnungszeiten | Ihre Geschäfte und ihre Zeiten (siehe unten). Leer, wenn Sie nur Karten wollen. |
| Häuser, um die gesucht wird  | Die Gladys-Häuser, um die gesucht wird. Keines angekreuzt: alle mit Standort.   |
| Suchradius ... (km)          | Wie weit von einem Haus die Geschäfte gesucht werden. Standard: 10.             |
| Arten von Geschäften ...     | Die im Reiter Erkennung angebotenen Arten. Keine angekreuzt: keine.             |
| Vorlauf vor ... (Min.)       | Wann „öffnet bald“ / „schließt bald“ auslösen. Standard: 30 Minuten.            |
| Kartennummern                | Ihre Kundenkarten (siehe unten). Leer lassen, wenn Sie keine haben.             |

Klicken Sie dann auf **Konfiguration testen**: Die Antwort sagt Geschäft für Geschäft,
ob es geöffnet ist, und welche Karten verstanden wurden.

Öffnen Sie zuletzt den Reiter **Erkennung** der Integration und legen Sie die Geräte an.

### Geschäfte und Öffnungszeiten

Ein Geschäft pro Eintrag: ein Name, dann `=` und seine Zeiten, wenn Sie sie eingeben wollen. Trennen Sie die Geschäfte mit
`|`:

```
Leclerc = Mo-Sa 08:30-20:00; PH off | Apotheke = Mo-Fr 09:00-19:00 | Bäckerei = Tu-Su 07:00-13:00,15:30-19:30
```

Die Zeiten folgen der OpenStreetMap-Syntax — oft schon auf der Kartenseite des
Geschäfts zu sehen:

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
Höchstens 10 Geschäfte.

Der Name kennzeichnet das Geschäft: Umbenennen legt ein neues Gerät in Gladys an.

#### Automatisch gefundene Zeiten

Schreiben Sie nur den Namen: `Leclerc` (oder `Leclerc = auto`). Die Integration sucht dann
auf OpenStreetMap das Geschäft dieses Namens, das Ihren Gladys-Häusern am nächsten
liegt (alle Häuser mit Standort, festgelegt unter **Einstellungen → Häuser**), und
übernimmt seine Zeiten. Um andere Wörter als den Namen zu suchen, schreiben Sie sie
nach `auto:`, zum Beispiel `Bäcker = auto: Boulangerie Dupont`. Akzente und
Groß-/Kleinschreibung spielen keine Rolle.

- Bei mehreren Häusern gewinnt das Geschäft, das einem der Häuser am nächsten ist:
  Geben Sie einen genauen Namen an (`auto: Carrefour Market Vierzon`), um eines
  nahe einem bestimmten Haus zu wählen.
- **Konfiguration testen** nennt das gefundene Geschäft, seinen Ort, seine Entfernung
  und seine Zeiten: Prüfen Sie, ob es das richtige ist.
- Die Zeiten werden einmal am Tag neu gesucht und gespeichert: Ein Neustart ohne Netz
  behält sie.
- Wenn OpenStreetMap keine Zeiten für Ihr Geschäft hat oder Zeiten, die die
  Integration nicht lesen kann, geben Sie sie von Hand ein (und tragen Sie sie gern
  auf openstreetmap.org nach).

### Geschäfte rund um Ihre Häuser (Reiter Erkennung)

Die Integration sucht auf OpenStreetMap rund um jedes Gladys-Haus mit Standort
(festgelegt unter **Einstellungen → Häuser**) die nächsten Geschäfte der in der
Konfiguration angekreuzten Arten — Supermärkte, Bäckereien, Apotheken, Postämter,
Wertstoffhöfe… —, die ihre Öffnungszeiten veröffentlichen. Die 3 nächsten jeder Art,
pro Haus.

Öffnen Sie den Reiter **Erkennung** der Integration: Jedes Geschäft steht dort mit
seinem Haus und seiner Entfernung, zum Beispiel `E.Leclerc (Zuhause, 1.3 km)`. Legen
Sie die an, in die Sie gehen, in einem Raum des richtigen Hauses, und benennen Sie sie
nach Belieben um: Sie funktionieren wie die eingegebenen Geschäfte, und ihre Zeiten
werden einmal am Tag aktualisiert.

### Kundenkarten

Eine Karte pro Eintrag: ein Name (Marke, Inhaber), `=`, dann die unter dem Barcode
der Karte gedruckte Nummer. Trennen Sie die Karten mit `;`:

```
Leclerc Marie=2900123456785; Carrefour=2900987654327
```

Leerzeichen und Bindestriche in der Nummer werden ignoriert; der Name ist optional.
Höchstens 20 Karten.

**Zum Guthaben.** Die Händler bieten keine öffentliche API für ihre Karten: Ein
Guthaben kann nicht automatisch gelesen werden, ohne Ihr Passwort über eine
inoffizielle Schnittstelle, die jederzeit ausfallen kann. Die Integration tut das
nicht. Sie geben das Guthaben selbst ein — im Widget oder in einer Szene — und Gladys
speichert es mit seinem Verlauf.

## Geräte

| Gerät          | Funktion                                 | Hinweise                                     |
| -------------- | ---------------------------------------- | -------------------------------------------- |
| Jedes Geschäft | Geöffnet (1 = geöffnet, 0 = geschlossen) | In jeder Szenenbedingung nutzbar             |
| Jedes Geschäft | Minuten bis zur Öffnung oder Schließung  | Jede Minute aktualisiert                     |
| Jede Karte     | Guthaben (€)                             | Von Ihnen eingegeben; in Bedingungen nutzbar |

## Szenen

### Auslöser

- **Ein Geschäft öffnet bald** (`store_opening_soon`) und **Ein Geschäft schließt
  bald** (`store_closing_soon`): einmal, die eingestellte Anzahl Minuten vorher.
  Filter: das Geschäft (leer = beliebig). Variablen: Name des Geschäfts, Uhrzeit,
  verbleibende Minuten. Beispiel: „{{store_name}} schließt um {{time}}, noch
  {{minutes_left}} Minuten.“

„Das Geschäft ist geöffnet“ und „das Guthaben liegt über 10 €“ sind Zustände: Nutzen
Sie die Gerätebedingungen von Gladys.

### Aktionen

- **Ist ein Geschäft geöffnet?** (`is_store_open`): Wählen Sie ein Geschäft. Ausgaben:
  _geöffnet_ (ja/nein), die Uhrzeit der nächsten Änderung (HH:MM) und die Minuten bis
  dahin.
- **Guthaben einer Kundenkarte ändern** (`set_loyalty_balance`): Wählen Sie eine
  Karte, dann _Guthaben setzen auf_ einen Betrag oder _zum Guthaben addieren_ (ein
  negativer Betrag zum Ausgeben). Ausgabe: das neue Guthaben. Es fällt nie unter 0.

## Dashboard

- **Öffnungszeiten**: alle Geschäfte auf einen Blick (geöffnet oder geschlossen, bis
  wann), oder — mit der Einstellung _Geschäft_ — ein Geschäft im Detail, mit
  Countdown und den heutigen Zeiten.
- **Kundenkarte**: der Barcode einer Karte (Einstellung _Karte_; leer = die erste),
  ihr Guthaben und ihre Nummer, und eine Schaltfläche **Guthaben aktualisieren**. An
  der Kasse vorzeigen: Erhöhen Sie die Helligkeit des Handys für den Scanner.

Der Barcode ist ein EAN-13, wenn die Kartennummer einer ist (13 Ziffern, gültige
Prüfziffer), sonst ein Code 128. Kassenscanner lesen beide.

## Fehlerbehebung

- **Der Reiter Erkennung ist leer**: Klicken Sie auf **Konfiguration testen**: Es
  sucht erneut auf OpenStreetMap und sagt warum (Haus ohne Standort, keine Art
  angekreuzt, OpenStreetMap nicht erreichbar, kein Geschäft dieser Arten im Radius).
- **„Kein Geschäft dieses Namens ... auf OpenStreetMap“**: Versuchen Sie weniger
  Wörter, einen größeren **Suchradius** oder geben Sie die Zeiten von Hand ein.
- **„Kein Haus von Gladys hat einen Standort“**: Legen Sie den Standort des Hauses
  unter **Einstellungen → Häuser** fest.
- **„Die Öffnungszeiten werden nicht verstanden“**: Die Meldung nennt den falschen
  Teil. Verwenden Sie die englischen Tagesnamen (`Mo`, `Tu`…) und `HH:MM`-Zeiten
  (`08:30`, nicht `8.30`).
- **Ein Geschäft wird „nicht verstanden“**: Jeder Eintrag muss `Name = Zeiten` sein,
  Einträge durch `|` getrennt.
- **Eine Karte wird „nicht verstanden“**: Die Nummer muss 6 bis 20 Ziffern haben.
- **Die Kasse liest den Barcode nicht**: Prüfen Sie die Nummer, erhöhen Sie die
  Helligkeit und zoomen Sie auf das Widget. Trägt Ihre Karte eine andere Barcode-Art,
  melden Sie es in einem Issue.

## Daten

Die Guthaben werden im Volume `/data` der Integration (`cards.json`) und als
Gladys-Zustände gespeichert; sie verlassen Ihr Gladys nie.

Um die Zeiten zu finden (ohne Zeiten eingetragene Geschäfte und Reiter Erkennung),
werden die gesuchten Wörter, die Arten von Geschäften und der Standort Ihrer Häuser
(ein Bereich im Suchradius um jedes) einmal am Tag an die Overpass-API von
OpenStreetMap (`overpass-api.de`) gesendet. Die gefundenen Zeiten werden in
`/data/hours.json` gespeichert. Um nichts zu senden: Geben Sie die Zeiten aller
Geschäfte ein und entfernen Sie alle Häkchen bei den Arten von Geschäften.
