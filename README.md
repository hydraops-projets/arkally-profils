# Profils de jeu d'Arkally

Les profils de jeu de l'application mobile Arkally : compteurs,
seuils de victoire et de défaite, nombre de joueurs. Chacun peut en proposer
un ; il entre dans l'application une fois relu et accepté.

*English below.*

## Proposer un profil

1. Copier le dépôt sur son compte GitHub (bouton « Fork »).
2. Ajouter `profils/<id>.json` — prendre `profils/mtg.json` pour modèle. Le
   format est décrit par [`schema.json`](schema.json).
3. Si besoin, ajouter les icônes des compteurs dans `icones/` et l'image du
   jeu dans `images/`.
4. Ouvrir une proposition (« Pull request ») vers ce dépôt.

Un contrôle se lance tout seul et dit ce qui ne va pas ; son résumé montre le
profil et les icônes tels qu'il les a lus. Les traductions manquantes sont
complétées à la validation : un profil dans une seule langue est accepté.

## Le format en bref

- **Un fichier par profil**, nommé d'après son `id` (minuscules, chiffres,
  tirets) : `profils/mtg.json`.
- **`schema`** : version du format, `1`.
- **Textes traduits** : `name`, `description` et le `name` de chaque compteur
  sont des objets `{ "fr": "…", "en": "…" }` (codes ISO 639-1). Un nom propre
  peut n'avoir qu'une langue.
- **Un seul compteur principal** (`"primary": true`), affiché en grand, avec
  `bigStep` (le bouton « ±n ») ; `bigStep` est refusé sur les autres.
- `loseAt` propose l'élimination quand le compteur atteint ou franchit la
  valeur ; `winAt` propose la victoire.
- `players` : `min`, `max` et `default` (l'application affiche six joueurs au
  plus).
- `ranking` : `true` affiche, à gauche du nom de chaque joueur, sa position
  d'après le compteur principal (valeur la plus haute en tête, égalité =
  même position). Absent : pas de pastille.

## Icônes et images

- **Icône d'un compteur** : un SVG dans `icones/`, désigné par son nom
  (`"icon": "heart-outline.svg"`). Une seule couleur, écrite `currentColor` :
  l'application la peint à la couleur du compteur. 8 Ko au plus, `viewBox`
  obligatoire ; ni script, ni attribut `on…`, ni lien ou `url()` externe.
- **Image du jeu** : un PNG de **96 × 96 pixels**, 32 Ko au plus, fond
  transparent, dans `images/` (`"icon": "MTG.png"`) ; `""` pour une pastille à
  l'initiale.

## Catalogue

`catalogue.json` liste tous les profils (id, version, nom, description,
langues complètes, image, fichier). Il est généré, jamais écrit à la main :

```bash
npm ci
npm run catalogue   # réécrit catalogue.json
npm run verifier    # le contrôle de GitHub, en local
npm test
```

## Provenance des icônes

- `heart-outline`, `flash-outline`, `skull-outline`, `stats-chart-outline` :
  [Ionicons](https://ionic.io/ionicons) 7.4.0, © Ionic, licence MIT.
- `MTG-commander`, `MTG-planeswalker` : symboles de Magic: The Gathering.

---

## English

Game profiles for the Arkally app. To propose one: fork this repository, add
`profils/<id>.json` (see `profils/mtg.json` and [`schema.json`](schema.json)),
optionally SVG counter icons in `icones/` and a 96 × 96 PNG in `images/`, then
open a pull request. An automatic check reports any problem and previews your
profile. A single language is fine: missing translations are added when the
profile is accepted.
