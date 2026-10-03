# CLAUDE.md

**Profils de jeu publics d'Arkally** — dépôt `hydraops-projets/arkally-profils`,
**public**, créé le 03/10/2026 par le lot 2 du plan `arkally-plan-01`
(`docs/conception/plans/arkally-plan-01-profils-publics.md` du dépôt
`mobile`). Aucune application ici : des données, leur schéma et leur contrôle.
L'application les récupère au moment de fabriquer et de déployer (lot 3),
jamais pendant l'usage.

## Contenu

- `profils/<id>.json` — un profil par fichier, nommé d'après son `id`.
- `icones/*.svg` — icônes des compteurs (`icon` d'un compteur).
- `images/*.png` — images des profils (`icon` du profil), 96 × 96, 32 Ko au plus.
- `schema.json` — format 1 (JSON Schema 2020-12), **même fichier que
  `assets/profils/schema.json` de `mobile`** tant que celui-ci existe.
- `catalogue.json` — **généré** (`npm run catalogue`), jamais écrit à la main.
- `scripts/controles.mjs` — tous les contrôles ; `verifier.mjs` (le contrôle de
  GitHub, résumé compris) et `generer-catalogue.mjs` l'appellent.

## Choix arrêtés

- **Contrôles miroirs de l'application** : règles hors schéma (min ≤ défaut ≤
  max, identifiants de compteur uniques) = `src/data/validerProfil.ts` de
  `mobile` ; refus des SVG = `scripts/generer-icones.mjs` de `mobile`. Une règle
  changée d'un côté se reporte de l'autre, dans le même travail.
- **Le contrôle ne regarde pas les langues** (choix d'OLG22) : à la validation,
  une session lancée depuis HydraOps relit **toutes** les traductions, y
  compris celles de l'auteur, et complète celles qui manquent. Aucune
  traduction automatique sur GitHub : un dépôt public ne donne pas ses secrets
  au contrôle d'une proposition venue d'un inconnu.
- **Workflow `controle.yml` : `pull_request` (jamais `pull_request_target`),
  jeton en lecture, aucun secret, `ubuntu-latest` (jamais `self-hosted`)** —
  il exécute le code de l'inconnu, et les ouvriers de l'organisation tournent
  sur le VPS de production. Minutes gratuites pour un dépôt public. GitHub
  demande d'approuver l'exécution pour un premier contributeur.
- **Icônes affichées dans le résumé de l'exécution** par leur adresse
  `raw.githubusercontent.com/<copie de l'auteur>/<commit>/…` : GitHub y sert
  un SVG en `image/svg+xml` sous une politique `sandbox`, et le relaie dans un
  résumé. Dessinées en noir (`currentColor`) : peu visibles en thème sombre.
- **Le contrôle exécute le code de la proposition** : une proposition qui
  modifie `scripts/`, `schema.json` ou `.github/` peut se déclarer acceptée.
  Le résumé la signale (« touche autre chose que des profils ») ; **une
  proposition extérieure qui touche autre chose que `profils/`, `icones/`,
  `images/` et `catalogue.json` se refuse.**
- **Catalogue à jour exigé par le contrôle** : une proposition extérieure
  échoue donc souvent sur ce seul point ; la validation le régénère de toute
  façon (les traductions ajoutées le changent).
- **Langues du catalogue** (`languesCompletes`) : celles que portent tous les
  textes du profil ; un texte d'une seule langue (nom propre, « Flip 7 ») n'y
  entre pas.
- **Images réduites à 96 × 96 à l'arrivée** (originaux de ~1 Mo dans
  `mobile`), fond transparent autour pour les images non carrées.
- **`main` protégée** : proposition obligatoire, contrôle « Contrôle » vert,
  ni envoi forcé ni suppression. Aucune relecture exigée : OLG22 est seul et
  GitHub refuse d'approuver sa propre proposition ; ce sont les droits
  d'écriture (OLG22 seul) qui font que rien n'entre sans lui.
- **Gestionnaire : npm** (comme `mobile`), `package-lock.json` fait foi.

## Valider une proposition (session lancée depuis HydraOps)

1. Lire le résumé du contrôle et le diff ; refuser ce qui sort du périmètre.
2. Relire **toutes** les traductions (`name`, `description`, noms des
   compteurs) : écarter tout terme inapproprié, même dans la langue de
   l'auteur.
3. Compléter les dix langues de l'application : `fr`, `en`, `es`, `pt`, `ru`,
   `zh`, `ja`, `ko`, `hi`, `ar` ; `en` obligatoire (langue de repli). Un nom
   propre garde une seule langue.
4. Regarder les icônes et l'image (contenu, droits).
5. `npm run catalogue`, `npm run verifier`, `npm test`, enregistrer sur la
   branche de la proposition (ou en reprendre le contenu dans une branche à
   soi), contrôle vert, fusion en « Rebase and merge ».

Skill `valider-profil` à proposer une fois ce geste rodé.

## Vérification

```bash
npm ci
npm run verifier   # contrôle complet, comme sur GitHub
npm test           # node --test : chaque refus éprouvé sur une copie du dépôt
```

## Git

- Messages en français, Conventional Commits (`feat(profils): …`).
- Fusion en « Rebase and merge » uniquement.
