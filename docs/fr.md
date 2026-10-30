# E.Leclerc — guide d'utilisation

Cette intégration apporte dans Gladys deux informations sur votre magasin E.Leclerc :

- les **rappels de produits** : les rappels de RappelConso, le registre officiel
  français, qui concernent un produit vendu chez E.Leclerc ;
- les **horaires** : votre magasin est-il ouvert, et quand ouvre-t-il ou ferme-t-il.

Aucun compte, aucune clé d'API. C'est une intégration communautaire : elle n'est ni
faite, ni vérifiée, ni assistée par E.Leclerc.

## Installation

Ouvrez **Intégrations**, cherchez **E.Leclerc**, installez-la, puis remplissez
l'écran **Configuration**.

| Champ                                | Que mettre                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Nom du magasin                       | Le nom de l'appareil magasin dans Gladys, ex. `E.Leclerc Carcassonne`.                    |
| Horaires d'ouverture                 | Les horaires du magasin (voir plus bas). Par défaut : `Mo-Sa 08:30-20:00; PH off`.        |
| Préavis avant ... (min)              | Quand se déclenchent « ouvre bientôt » / « ferme bientôt ». Par défaut : 30 min.          |
| Rappels à suivre                     | _E.Leclerc et tous distributeurs_ (par défaut), ou _seulement ceux qui citent E.Leclerc_. |
| Catégories                           | Vide pour tout suivre, ou quelques-unes (alimentation, animaux, bébés…).                  |
| Rappels des derniers                 | Sur combien de jours portent le compteur et la liste. Par défaut : 30.                    |
| Intervalle de rafraîchissement (min) | Fréquence de lecture de RappelConso. Par défaut : 60 minutes.                             |

Cliquez ensuite sur **Tester la configuration** : la réponse dit si le magasin est
ouvert et combien de rappels le concernent.

Enfin, ouvrez l'onglet **Découverte** de l'intégration et créez les deux appareils.

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

### Quels rappels

Chaque fiche de rappel indique qui a vendu le produit. L'intégration garde :

- les fiches qui **citent E.Leclerc** ;
- avec _E.Leclerc et tous distributeurs_, aussi celles vendues « tous
  distributeurs », « grandes et moyennes surfaces » (GMS)… : E.Leclerc les a
  vendues aussi, même sans être cité.

## Appareils

| Appareil                  | Fonctionnalité                       | Remarques                                |
| ------------------------- | ------------------------------------ | ---------------------------------------- |
| Magasin                   | Ouvert (1 = ouvert, 0 = fermé)       | Utilisable dans toute condition de scène |
| Magasin                   | Minutes avant ouverture ou fermeture | Mis à jour chaque minute                 |
| E.Leclerc product recalls | Rappels                              | Nombre sur la période configurée         |
| E.Leclerc product recalls | Dernier rappel                       | « Marque – produit »                     |

L'appareil des rappels affiche un badge **cloud** quand RappelConso a répondu, et
**injoignable** sinon.

## Scènes

### Déclencheurs

- **Un produit vendu chez E.Leclerc est rappelé** (`product_recalled`) : une
  nouvelle fiche concerne votre magasin. Filtres : catégorie, et _vendu chez_
  (E.Leclerc cité / tous distributeurs). Variables : produit, marque, motif,
  risques, lien de la fiche, numéro de fiche. Exemple : envoyez-vous un message
  « Rappel : {{product}} — {{reason}} ».
- **Le magasin ouvre bientôt** (`store_opening_soon`) et **Le magasin ferme
  bientôt** (`store_closing_soon`) : une seule fois, le nombre de minutes
  configuré avant. Variables : nom du magasin, heure, minutes restantes.

Un rappel n'est annoncé qu'une fois. Les rappels déjà publiés à l'installation ne
sont pas annoncés ; ceux publiés pendant que Gladys était éteint le sont, au
démarrage suivant.

### Actions

- **Vérifier un code-barres** (`check_barcode`) : cherche un produit dans tout le
  registre RappelConso. Sorties : _rappelé_ (oui/non), produit, motif, lien de la fiche.
- **Le magasin est-il ouvert ?** (`is_store_open`) : sorties _ouvert_ (oui/non),
  l'heure du prochain changement (HH:MM) et les minutes d'ici là.

## Tableau de bord

- **Horaires du magasin** : ouvert ou fermé, jusqu'à quand, horaires du jour.
- **Rappels de produits** : le compteur, les derniers rappels (touchez-en un pour
  le motif, les risques, la conduite à tenir et la fiche), un bouton **Vérifier un
  code-barres** et un bouton **Actualiser**. Le réglage _Rappels affichés_ fixe la
  longueur de la liste (0 à 8).

## Dépannage

- **« Les horaires ne sont pas compris »** : le message cite la partie fautive.
  Utilisez les jours en anglais (`Mo`, pas `Lu`) et des heures `HH:MM` (`08:30`,
  pas `8h30`).
- **RappelConso est injoignable** : l'intégration a besoin d'internet. Elle réessaie
  à l'intervalle suivant ; la dernière liste reste affichée.
- **Un code-barres n'est pas trouvé** : seuls les codes imprimés dans la fiche sont
  trouvés. Vérifiez aussi la fiche sur [rappel.conso.gouv.fr](https://rappel.conso.gouv.fr/).

## Données

- Rappels : [RappelConso](https://rappel.conso.gouv.fr/), données ouvertes du
  ministère de l'Économie (data.economie.gouv.fr), Licence Ouverte.
- Rien sur vous n'est envoyé : seul le code-barres vérifié est cherché en ligne.
  L'intégration garde la liste des rappels déjà vus dans son volume `/data`.
