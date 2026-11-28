# La République, c’est moi !

[![CI et GitHub Pages](https://github.com/BenCorb/la-republique-cest-moi/actions/workflows/ci-pages.yml/badge.svg)](https://github.com/BenCorb/la-republique-cest-moi/actions/workflows/ci-pages.yml)

Jeu web solo de gestion narrative de carrière politique, satirique et au tour par tour. Le joueur
incarne un personnage qui tente de se faire une place dans une France alternative fictive à partir
de 2000 : briguer des mandats, servir ses convictions, s’enrichir, déléguer… jusqu’au bilan d’une vie
entière. Un tour représente un trimestre ; le temps n’avance que sur commande.

Le jeu se joue dans un navigateur desktop. C’est un site entièrement statique : aucun backend, aucun
compte, aucune IA au runtime ; les sauvegardes restent dans le navigateur.

- **Jouer :** <https://bencorb.github.io/la-republique-cest-moi/>
- **Code source :** <https://github.com/BenCorb/la-republique-cest-moi>

> **État actuel : beta.** La V1 est livrée (tag `v1.0.0`) ; la beta consolide les
> fonctionnalités une par une et retravaille l’interface. Les sauvegardes sont conservées d’une
> version à l’autre depuis la V1. Le site publié n’est redéployé que sur demande. L’avancement fait
> foi dans [docs/ROADMAP.md](docs/ROADMAP.md).

## Jouer

Une carrière commence à 25 ans, au premier trimestre 2000, et dure jusqu’au bilan : mort naturelle,
mort d’épuisement, condamnation à la prison ferme ou retraite choisie (« Se retirer de la vie
politique »). À chaque trimestre, on compose un plan avec le temps
disponible, on vérifie la prévision, puis on avance.

- **Tableau de bord** : ressources, santé, stress, exposition médiatique et risque judiciaire,
  tendances des douze derniers trimestres.
- **Agenda** : actions du trimestre, regroupées par thème ; une action reste épinglée d’un
  trimestre à l’autre, sauf si on la marque ponctuelle.
- **Carrière** : mandats, calendrier électoral, candidatures, promesses de campagne et dossiers
  judiciaires.
- **Monde politique** : partis, gouvernement, indicateurs nationaux et réformes institutionnelles.
- **Actualités** : fil de presse des médias fictifs.
- **Entourage**, **Relations**, **Organisation** et **Patrimoine** : collaborateurs et missions,
  personnages rencontrés, moyens de l’organisation, actifs personnels et train de vie.
- **Journal** : historique détaillé de chaque trimestre et de chaque décision.

Trois façons d’avancer : « Trimestre suivant », « Année suivante » (quatre trimestres au plus) et
« Jusqu’à une alerte », qui s’arrête à la première décision, alerte (échéance électorale, santé,
entourage, budget, justice), fin de carrière ou plan devenu invalide. Les décisions bloquantes
s’affichent dans une fenêtre et doivent être tranchées. La partie est sauvegardée automatiquement
dans le navigateur ; « Exporter » produit un fichier JSON réimportable depuis l’accueil. En fin de
carrière, le bilan présente la nécrologie, les distinctions et les moments marquants ; il s’inscrit
au carnet des carrières de l’accueil (affichage seul, dans ce navigateur).

**Seed et partage.** Chaque carrière est entièrement déterminée par sa seed (une chaîne de
caractères) et par les choix du joueur : même seed, même profil et mêmes décisions donnent la même
partie. La seed s’affiche au bilan ; « Rejouer cette partie » relance la même seed avec le même
profil, et « Exporter un retour » télécharge la sauvegarde avec une note libre, à envoyer à qui
l’on veut. Pour imposer une seed dès la création, ajouter `?seed=texte` à l’adresse (par exemple
`https://bencorb.github.io/la-republique-cest-moi/?seed=entre-amis`). Aucun serveur n’intervient :
tout reste dans le navigateur.

## Documents de référence

| Document                                      | Rôle                                                         |
| --------------------------------------------- | ------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                        | Règles communes de développement (Codex, Claude Code)        |
| [docs/ROADMAP.md](docs/ROADMAP.md)            | Feuille de route beta et état d’avancement                   |
| [docs/features/](docs/features/README.md)     | Une fiche par fonctionnalité : règles, code, tests, chantier |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)    | Référence fonctionnelle                                      |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  | Contrats techniques en vigueur                               |
| [docs/DESIGN.md](docs/DESIGN.md)              | Direction artistique et interface                            |
| [docs/decisions/](docs/decisions/README.md)   | Décisions transversales                                      |
| [docs/playtests/](docs/playtests/README.md)   | Playtests de la beta                                         |
| [docs/archive/v1/](docs/archive/v1/README.md) | Historique des phases 0 à 3 (lecture seule)                  |

## Prérequis

- **Node.js 26.13.1** (LTS), version fixée dans [`.nvmrc`](.nvmrc). Avec nvm : `nvm use`. Le champ
  `engines` de `package.json` et `engine-strict=true` refusent une version majeure différente.
- **npm 11** (fourni avec Node 26). Les dépendances sont épinglées à des versions exactes et
  verrouillées par `package-lock.json`.

## Installation

```bash
npm ci
```

Pour les tests navigateur, installer une fois le navigateur Chromium de Playwright :

```bash
npm run test:e2e:install
```

## Commandes

| Commande                   | Fonction                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| `npm run dev`              | Serveur de développement (http://localhost:5173)                   |
| `npm run verify`           | Enchaîne check, lint, content:validate, test et build              |
| `npm run check`            | Diagnostics TypeScript et Svelte (avertissements bloquants)        |
| `npm run lint`             | Formatage Prettier vérifié puis ESLint                             |
| `npm run format`           | Reformate les fichiers (hors documents de conception)              |
| `npm run content:validate` | Valide les catalogues JSON de `src/lib/game/content/data/`         |
| `npm run simulate`         | Simule des lots seedés et produit un rapport JSON ou CSV           |
| `npm run benchmark`        | Mesure projection et sauvegarde sur une carrière longue            |
| `npm run test`             | Tests unitaires et de scénarios (Vitest, environnement Node)       |
| `npm run test:e2e`         | Construit le site puis lance Playwright sur le build statique      |
| `npm run build`            | Build statique prérendu dans `build/`                              |
| `npm run preview`          | Aperçu du build via Vite                                           |
| `npm run serve:static`     | Sert `build/` comme un hébergement statique (port 4174 par défaut) |

Toutes les commandes de build, d’aperçu et de test respectent la variable `BASE_PATH` (voir
« Hébergement GitHub Pages »).

Exemple de simulation reproductible :

```bash
npm run simulate -- --runs 100 --seed 42 --strategy all --max-turns 400 --format json --output rapport.json
npm run simulate -- --runs 100 --seed 42 --strategy all --max-turns 400 --format csv --output rapport.csv
```

Les stratégies disponibles sont `prudent` (intègre : elle écarte les choix signalés comme
risqués), `ambitious`, `patrimonial`, `mixed`, `random-valid` et `all`. Le rapport mesure notamment
les causes de fin, les mandats, les promesses, les affaires judiciaires, l’entourage, les
répétitions d’événements et une durée active estimée (modèle provisoire, à calibrer par les
playtests). Une carrière arrêtée par le plafond technique, une erreur ou une violation d’invariant est
signalée dans `problemSeeds` et fait échouer la commande.

Vérification complète avant de rendre une tâche :

```bash
npm run verify
```

```bash
npm run test:e2e
```

## Build et déploiement

`npm run build` produit dans `build/` un site entièrement prérendu (HTML, CSS, JS, assets). Aucun
serveur Node n’est nécessaire en production. Pour vérifier localement le résultat tel qu’il sera
servi :

```bash
npm run build && npm run serve:static
```

### Hébergement GitHub Pages

Le jeu est destiné à GitHub Pages, soit dans un sous-répertoire (`https://<compte>.github.io/<dépôt>/`),
soit sur un domaine personnalisé (racine). Le chemin de base est fourni par la variable
d’environnement `BASE_PATH` :

| Hébergement                                  | `BASE_PATH`   |
| -------------------------------------------- | ------------- |
| Domaine personnalisé, `<compte>.github.io`   | vide (défaut) |
| Site de projet `<compte>.github.io/<dépôt>/` | `/<dépôt>`    |

Tester localement un hébergement en sous-répertoire (macOS/Linux) :

```bash
BASE_PATH=/la-republique-cest-moi npm run build && BASE_PATH=/la-republique-cest-moi npm run serve:static
```

```bash
BASE_PATH=/la-republique-cest-moi npm run test:e2e
```

Les ressources sont référencées en chemins relatifs. Dans le code, utiliser `asset('fichier')` de
`$app/paths` pour les fichiers de `static/` et `resolve()` pour les liens internes, jamais un chemin
absolu codé en dur.

### Intégration continue et déploiement

Le workflow [`.github/workflows/ci-pages.yml`](.github/workflows/ci-pages.yml) :

- à chaque push sur `main` et pull request : installation verrouillée, check, lint, validation de
  contenu, tests unitaires, build et tests navigateur sous `/<nom du dépôt>` ;
- déploiement **manuel uniquement** : onglet Actions → « CI et GitHub Pages » → « Run workflow » sur
  `main`, cocher « deploy ». Le base path est alors lu dans la configuration Pages du dépôt
  (`actions/configure-pages`), ce qui gère automatiquement un domaine personnalisé.

Mise en place, une seule fois : Settings → Pages → Source « GitHub Actions ». Pour un domaine
personnalisé, le déclarer dans Settings → Pages (aucun fichier `CNAME` à ajouter). Retour arrière :
relancer le déploiement d’un run antérieur réussi. La publication se fait uniquement sur demande
explicite.

## Contribuer (Codex, Claude Code ou humain)

Les règles communes sont dans [AGENTS.md](AGENTS.md) (importé par `CLAUDE.md`) : lecture des
documents, tâches courtes et testées, conventions Git et procédure de reprise entre assistants. En
résumé :

- une branche et une pull request par chantier de la feuille de route : `feat/b-04-agenda` ;
- des commits [Conventional Commits](https://www.conventionalcommits.org/fr/) :
  `feat(engine): ajouter le calendrier trimestriel` ;
- une pull request vers `main`, fusionnée après CI verte ;
- la fiche du système (`docs/features/`) mise à jour dans la même pull request ;
- `docs/ROADMAP.md` mis à jour uniquement lorsque le critère d’un chantier est vérifié ;
- le dépôt ne doit pas vivre dans un dossier synchronisé (iCloud Drive, Dropbox…) : les copies
  « nom 2.ext » qu’il crée cassent les vérifications (`docs/ARCHITECTURE.md` §13).

## Structure

```text
src/
  routes/                 # +layout.svelte, +page.svelte (accueil et partie), layout.css (tokens)
  lib/
    game/engine/          # moteur TypeScript pur (sans Svelte, DOM, stockage, réseau, hasard réel)
    game/content/         # types, schémas Zod, validation et catalogues JSON (data/, data/events/)
    game/persistence/     # enveloppe de sauvegarde, migrations, stockage local, export/import
    game/app/             # projection PlayerView, contrôleur, session Svelte, frontière navigateur
    game/simulation/      # simulateur de carrières par lots (stratégies, rapports JSON/CSV)
    components/           # un dossier par écran (dashboard, agenda, career, world, news,
                          # entourage, people, organisation, wealth, journal) ; shell, events, common
static/                   # fichiers copiés tels quels (favicon.svg, .nojekyll)
scripts/
  base-path.ts            # normalisation de BASE_PATH (Vite, Playwright, serveur statique)
  validate-content.ts     # npm run content:validate
  simulate.ts             # npm run simulate
  benchmark.ts            # npm run benchmark
  serve-static.ts         # npm run serve:static
.github/workflows/        # CI et déploiement GitHub Pages
docs/                     # GDD, architecture, design, feuille de route, fiches, décisions, playtests, archive
tests/
  unit/                   # Vitest (Node)
  scenarios/              # scénarios moteur sur plusieurs trimestres (Vitest)
  fixtures/               # contenu de test figé, indépendant du tuning
  e2e/                    # Playwright (*.e2e.ts), contre le build statique
```

L’alias `#lib/…` pointe vers `src/lib/…` (champ `imports` de `package.json`, convention de
SvelteKit 3).

## Conventions

- TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Code et identifiants en anglais, textes du jeu en français.
- Le moteur (`src/lib/game/engine/`) ne doit importer ni Svelte, ni `$app`, ni les composants, et ne
  pas utiliser `Math.random()`, `Date.now()`, `new Date()`, le stockage navigateur ou le réseau. Un
  test (`tests/unit/engine-boundaries.test.ts`) le vérifie automatiquement.
- Les scripts de `scripts/` sont exécutés directement par Node (suppression native des types) : y
  utiliser uniquement une syntaxe TypeScript effaçable (pas d’`enum`, ni de `namespace`).
- Aucune configuration propre à un assistant n’est nécessaire : Codex et Claude Code utilisent les
  mêmes commandes npm.
