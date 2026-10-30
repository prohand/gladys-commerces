# Commerces — guide d'utilisation

Cette intégration apporte dans Gladys deux choses sur les commerces où vous allez :

- leurs **horaires** : quels commerces sont ouverts, quand ils ouvrent ou ferment ;
- vos **cartes de fidélité**, de toutes enseignes : leur code-barres sur le tableau de
  bord, à scanner en caisse depuis votre téléphone, et leur cagnotte.

Tout est calculé dans Gladys : aucun compte, aucun mot de passe. Le seul appel
externe va à OpenStreetMap, pour trouver les horaires des commerces autour de vos
maisons (voir plus bas).

## Installation

Ouvrez **Intégrations**, cherchez l'intégration, installez-la, puis remplissez
l'écran **Configuration**.

| Champ                              | Que mettre                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Commerces et horaires              | Vos commerces et leurs horaires (voir plus bas). Vide si vous voulez seulement les cartes.           |
| Maisons autour desquelles chercher | Les maisons Gladys autour desquelles chercher. Aucune cochée : toutes celles qui ont un emplacement. |
| Rayon de recherche ... (km)        | À quelle distance d'une maison les commerces sont cherchés. Par défaut : 10.                         |
| Types de commerces ...             | Les types de commerces proposés dans l'onglet Découverte. Aucun coché : aucun.                       |
| Préavis avant ... (min)            | Quand se déclenchent « ouvre bientôt » / « ferme bientôt ». Par défaut : 30 min.                     |
| Numéros de carte                   | Vos cartes de fidélité (voir plus bas). Vide si vous n'en avez pas.                                  |

Cliquez ensuite sur **Tester la configuration** : la réponse dit, commerce par
commerce, s'il est ouvert, et quelles cartes ont été comprises.

Enfin, ouvrez l'onglet **Découverte** de l'intégration et créez les appareils.

### Commerces et horaires

Un commerce par entrée : un nom, puis `=` et ses horaires si vous voulez les écrire. Séparez les commerces par `|` :

```
Leclerc = Mo-Sa 08:30-20:00; PH off | Pharmacie = Mo-Fr 09:00-19:00 | Boulangerie = Tu-Su 07:00-13:00,15:30-19:30
```

Les horaires suivent la syntaxe OpenStreetMap — souvent déjà affichée sur la fiche du
commerce sur une carte :

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
10 commerces au plus.

Le nom identifie le commerce : le renommer crée un nouvel appareil dans Gladys.

#### Horaires trouvés automatiquement

Écrivez seulement le nom : `Leclerc` (ou `Leclerc = auto`). L'intégration cherche
alors sur OpenStreetMap le commerce de ce nom le plus proche de vos maisons Gladys
(toutes les maisons dont l'emplacement est renseigné dans **Paramètres → Maisons**),
et prend ses horaires. Pour chercher d'autres mots que le nom, écrivez-les après
`auto:`, par exemple `Boulangerie = auto: Boulangerie Dupont`. Les accents et les
majuscules ne comptent pas.

- Avec plusieurs maisons, le commerce le plus proche de toutes les maisons gagne :
  donnez un nom précis (`auto: Carrefour Market Vierzon`) pour en choisir un près
  d'une maison donnée.
- **Tester la configuration** cite le commerce trouvé, sa ville, sa distance et ses
  horaires : vérifiez que c'est le bon.
- Les horaires sont recherchés de nouveau une fois par jour, et gardés : un
  redémarrage sans réseau les conserve.
- Si OpenStreetMap n'a pas d'horaires pour votre commerce, ou des horaires que
  l'intégration ne sait pas lire, écrivez-les à la main (et pourquoi pas ajoutez-les
  sur openstreetmap.org).

### Commerces autour de vos maisons (onglet Découverte)

L'intégration cherche sur OpenStreetMap, autour de chaque maison Gladys qui a un
emplacement (renseigné dans **Paramètres → Maisons**), les commerces les plus proches
des types cochés dans la configuration — supermarchés, boulangeries, pharmacies,
bureaux de poste, déchetteries… — qui publient leurs horaires. Les 3 plus proches de
chaque type, par maison.

Ouvrez l'onglet **Découverte** de l'intégration : chaque commerce y est listé avec sa
maison et sa distance, par exemple `E.Leclerc (Maison, 1.3 km)`. Créez ceux où vous
allez, dans une pièce de la bonne maison, et renommez-les comme vous voulez : ils
marchent comme les commerces que vous écrivez, et leurs horaires sont mis à jour
une fois par jour.

### Cartes de fidélité

Une carte par entrée : un nom (enseigne, titulaire), `=`, puis le numéro imprimé sous
le code-barres de la carte. Séparez les cartes par `;` :

```
Leclerc Marie=2900123456785; Carrefour=2900987654327
```

Les espaces et tirets du numéro sont ignorés ; le nom est facultatif. 20 cartes au
plus.

**À propos de la cagnotte.** Les enseignes ne proposent pas d'API publique pour leurs
cartes : une cagnotte ne peut pas être lue automatiquement sans votre mot de passe,
par une interface non officielle qui peut cesser de marcher à tout moment.
L'intégration ne le fait pas. Vous saisissez la cagnotte vous-même — depuis le widget
ou une scène — et Gladys la garde, avec son historique.

## Appareils

| Appareil        | Fonctionnalité                       | Remarques                                        |
| --------------- | ------------------------------------ | ------------------------------------------------ |
| Chaque commerce | Ouvert (1 = ouvert, 0 = fermé)       | Utilisable dans toute condition de scène         |
| Chaque commerce | Minutes avant ouverture ou fermeture | Mis à jour chaque minute                         |
| Chaque carte    | Cagnotte (€)                         | Saisie par vous ; utilisable dans les conditions |

## Scènes

### Déclencheurs

- **Un commerce ouvre bientôt** (`store_opening_soon`) et **Un commerce ferme
  bientôt** (`store_closing_soon`) : une seule fois, le nombre de minutes configuré
  avant. Filtre : le commerce (vide = n'importe lequel). Variables : nom du commerce,
  heure, minutes restantes. Exemple : « {{store_name}} ferme à {{time}}, plus que
  {{minutes_left}} minutes. »

« Le commerce est ouvert » et « la cagnotte dépasse 10 € » sont des états : utilisez
les conditions sur appareil de Gladys.

### Actions

- **Un commerce est-il ouvert ?** (`is_store_open`) : choisissez un commerce. Sorties :
  _ouvert_ (oui/non), l'heure du prochain changement (HH:MM) et les minutes d'ici là.
- **Mettre à jour une cagnotte** (`set_loyalty_balance`) : choisissez une carte, puis
  _fixer la cagnotte à_ un montant, ou _ajouter à la cagnotte_ (un montant négatif
  pour dépenser). Sortie : la nouvelle cagnotte. Elle ne descend jamais sous 0.

## Tableau de bord

- **Horaires des commerces** : tous les commerces d'un coup d'œil (ouvert ou fermé,
  jusqu'à quand), ou — avec le réglage _Commerce_ — un commerce en détail, avec un
  compte à rebours et les horaires du jour.
- **Carte de fidélité** : le code-barres d'une carte (réglage _Carte_ ; vide = la
  première), sa cagnotte et son numéro, et un bouton **Modifier la cagnotte**.
  Présentez-le en caisse : montez la luminosité du téléphone pour le scanner.

Le code-barres est un EAN-13 quand le numéro de carte en est un (13 chiffres, clé de
contrôle valide), un Code 128 sinon. Les scanners de caisse lisent les deux.

## Dépannage

- **L'onglet Découverte est vide** : cliquez sur **Tester la configuration** : il
  cherche de nouveau sur OpenStreetMap et dit pourquoi (maison sans emplacement, aucun
  type coché, OpenStreetMap injoignable, aucun commerce de ces types dans le rayon).
- **« Aucun commerce de ce nom ... sur OpenStreetMap »** : essayez moins de mots, un
  **Rayon de recherche** plus grand, ou écrivez les horaires à la main.
- **« Aucune maison de Gladys n'a d'emplacement »** : renseignez l'emplacement de la
  maison dans **Paramètres → Maisons**.
- **« Les horaires ne sont pas compris »** : le message cite la partie fautive.
  Utilisez les jours en anglais (`Mo`, pas `Lu`) et des heures `HH:MM` (`08:30`,
  pas `8h30`).
- **Un commerce est « non compris »** : chaque entrée doit être `Nom = horaires`,
  entrées séparées par `|`.
- **Une carte est « non comprise »** : le numéro doit faire 6 à 20 chiffres.
- **La caisse ne lit pas le code-barres** : vérifiez le numéro, montez la luminosité
  et zoomez sur le widget. Si votre carte porte un autre type de code-barres,
  signalez-le dans une issue.

## Données

Les cagnottes sont gardées dans le volume `/data` de l'intégration (`cards.json`) et
comme états Gladys ; elles ne sortent jamais de votre Gladys.

Pour trouver les horaires (commerces écrits sans horaires, et onglet Découverte), les
mots cherchés, les types de commerces et l'emplacement de vos maisons (une zone du
rayon de recherche autour de chacune) sont envoyés à l'API Overpass d'OpenStreetMap
(`overpass-api.de`), une fois par jour. Les horaires trouvés sont gardés dans
`/data/hours.json`. Pour ne rien envoyer : écrivez les horaires de tous les commerces
et décochez tous les types de commerces.
