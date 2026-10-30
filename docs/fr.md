# E.Leclerc — guide d'utilisation

Cette intégration apporte deux choses dans Gladys :

- les **horaires** de votre magasin : est-il ouvert, quand ouvre-t-il ou ferme-t-il ;
- vos **cartes de fidélité** (Carte E.Leclerc) : leur code-barres sur le tableau de
  bord, à scanner en caisse depuis votre téléphone, et leur cagnotte.

Tout est calculé dans Gladys : aucun compte, aucun mot de passe, rien n'est envoyé
sur internet. C'est une intégration communautaire : elle n'est ni faite, ni vérifiée,
ni assistée par E.Leclerc.

## Installation

Ouvrez **Intégrations**, cherchez **E.Leclerc**, installez-la, puis remplissez
l'écran **Configuration**.

| Champ                   | Que mettre                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Nom du magasin          | Le nom de l'appareil magasin dans Gladys, ex. `E.Leclerc Carcassonne`.             |
| Horaires d'ouverture    | Les horaires du magasin (voir plus bas). Par défaut : `Mo-Sa 08:30-20:00; PH off`. |
| Préavis avant ... (min) | Quand se déclenchent « ouvre bientôt » / « ferme bientôt ». Par défaut : 30 min.   |
| Numéros de carte        | Vos cartes de fidélité (voir plus bas). Vide si vous n'en avez pas.                |

Cliquez ensuite sur **Tester la configuration** : la réponse dit si le magasin est
ouvert et quelles cartes ont été comprises.

Enfin, ouvrez l'onglet **Découverte** de l'intégration et créez les appareils.

### Horaires d'ouverture

E.Leclerc ne publie pas d'API pour les horaires de ses magasins : vous les saisissez,
dans la syntaxe OpenStreetMap — souvent déjà affichée sur la fiche du magasin sur une
carte :

| Vous écrivez                        | Cela veut dire                                        |
| ----------------------------------- | ----------------------------------------------------- |
| `Mo-Sa 08:30-20:00`                 | Du lundi au samedi, de 8 h 30 à 20 h                  |
| `Mo-Fr 08:30-12:00,14:00-19:00`     | Avec une pause de midi                                |
| `Mo-Sa 08:30-20:00; Su 09:00-12:30` | Règles séparées par `;`                               |
| `Mo-Sa 08:30-20:00; We 08:30-21:00` | Une règle plus loin remplace la précédente ce jour-là |
| `...; PH off`                       | Fermé les jours fériés                                |
| `...; PH 09:00-12:30`               | Horaires réduits les jours fériés                     |
| `24/7`                              | Toujours ouvert                                       |

Jours en anglais : `Mo Tu We Th Fr Sa Su`. `PH` = jours fériés français (lundi de
Pâques, Ascension et Pentecôte compris). Les heures sont lues à l'heure de Paris.

### Cartes de fidélité

Une carte par personne : un nom, `=`, puis le numéro imprimé sous le code-barres de
la carte. Séparez les cartes par `;` :

```
Marie=2900123456785; Paul=2900987654327
```

Les espaces et tirets du numéro sont ignorés ; le nom est facultatif. 10 cartes au
plus.

**À propos de la cagnotte.** E.Leclerc ne propose pas d'API publique pour ses cartes :
la cagnotte « Ticket E.Leclerc » ne peut pas être lue automatiquement sans votre mot
de passe, par une interface non officielle qui peut cesser de marcher à tout moment.
L'intégration ne le fait pas. Vous saisissez la cagnotte vous-même — depuis le widget
ou une scène — et Gladys la garde, avec son historique.

## Appareils

| Appareil               | Fonctionnalité                       | Remarques                                        |
| ---------------------- | ------------------------------------ | ------------------------------------------------ |
| Magasin                | Ouvert (1 = ouvert, 0 = fermé)       | Utilisable dans toute condition de scène         |
| Magasin                | Minutes avant ouverture ou fermeture | Mis à jour chaque minute                         |
| E.Leclerc card _<nom>_ | Cagnotte (€)                         | Saisie par vous ; utilisable dans les conditions |

## Scènes

### Déclencheurs

- **Le magasin ouvre bientôt** (`store_opening_soon`) et **Le magasin ferme
  bientôt** (`store_closing_soon`) : une seule fois, le nombre de minutes configuré
  avant. Variables : nom du magasin, heure, minutes restantes. Exemple : « Le
  magasin ferme à {{time}}, plus que {{minutes_left}} minutes. »

« Le magasin est ouvert » et « la cagnotte dépasse 10 € » sont des états : utilisez
les conditions sur appareil de Gladys.

### Actions

- **Le magasin est-il ouvert ?** (`is_store_open`) : sorties _ouvert_ (oui/non),
  l'heure du prochain changement (HH:MM) et les minutes d'ici là.
- **Mettre à jour une cagnotte** (`set_loyalty_balance`) : choisissez une carte, puis
  _fixer la cagnotte à_ un montant, ou _ajouter à la cagnotte_ (un montant négatif
  pour dépenser). Sortie : la nouvelle cagnotte. Elle ne descend jamais sous 0.

## Tableau de bord

- **Horaires du magasin** : ouvert ou fermé, jusqu'à quand, horaires du jour.
- **Carte de fidélité** : le code-barres d'une carte (réglage _Carte_ ; vide = la
  première), sa cagnotte et son numéro, et un bouton **Modifier la cagnotte**.
  Présentez-le en caisse : montez la luminosité du téléphone pour le scanner.

Le code-barres est un EAN-13 quand le numéro de carte en est un (13 chiffres, clé de
contrôle valide), un Code 128 sinon. Les scanners de caisse lisent les deux.

## Dépannage

- **« Les horaires ne sont pas compris »** : le message cite la partie fautive.
  Utilisez les jours en anglais (`Mo`, pas `Lu`) et des heures `HH:MM` (`08:30`,
  pas `8h30`).
- **Une carte est « non comprise »** : le numéro doit faire 6 à 20 chiffres.
  **Tester la configuration** liste ce qui n'a pas été compris.
- **La caisse ne lit pas le code-barres** : vérifiez le numéro, montez la luminosité
  et zoomez sur le widget. Si votre carte porte un autre type de code-barres,
  signalez-le dans une issue.

## Données

Rien ne sort de votre Gladys. Les cagnottes sont gardées dans le volume `/data` de
l'intégration (`cards.json`) et comme états Gladys.
