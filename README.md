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

> **État actuel : prototype terminé (phase 1).** Une carrière se joue de bout en bout et le premier
> playtest humain est validé sur la branche `feat/p1-prototype` ; la PR de phase reste à intégrer et
> le site publié montre encore la phase 0. L’avancement fait foi dans [ROADMAP.md](ROADMAP.md).

## Jouer (prototype)

Une carrière commence à 25 ans, au premier trimestre 2000. À chaque trimestre : composer le plan
dans l’**Agenda** (actions), l’**Organisation** (achats) et le **Monde politique** (adhésion à un parti) ; l’onglet **Relations** retrace les personnages rencontrés et ce dont ils se souviennent, l’onglet **Carrière** vos mandats et le calendrier électoral, vérifier la prévision, puis valider avec
« Trimestre suivant ». Les décisions bloquantes s’affichent dans une fenêtre et doivent être
tranchées. « Année suivante » répète le plan pendant au plus quatre trimestres ; « Jusqu’à une
alerte » accélère jusqu’à une décision, une alerte, une fin ou un plan devenu invalide, et peut être
interrompu entre deux trimestres. La partie est sauvegardée automatiquement dans le navigateur ;
« Exporter » produit un fichier JSON réimportable depuis l’accueil. Paramètre d’essai :
`?seed=texte` dans l’adresse impose la seed d’une nouvelle carrière.

## Documents de référence

| Document                           | Rôle                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| [AGENTS.md](AGENTS.md)             | Règles communes de développement (Codex, Claude Code) |
| [GAME_DESIGN.md](GAME_DESIGN.md)   | Référence fonctionnelle                               |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Contrats techniques, ordre du tour, tests, sauvegarde |
| [DESIGN.md](DESIGN.md)             | Direction artistique et interface                     |
| [ROADMAP.md](ROADMAP.md)           | Phases, tâches et critères d’acceptation              |
| [PLAYTEST.md](PLAYTEST.md)         | Protocoles et résultats des essais humains            |

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
| `npm run check`            | Diagnostics TypeScript et Svelte (avertissements bloquants)        |
| `npm run lint`             | Formatage Prettier vérifié puis ESLint                             |
| `npm run format`           | Reformate les fichiers (hors documents de conception)              |
| `npm run content:validate` | Valide les catalogues JSON de `src/lib/game/content/data/`         |
| `npm run simulate`         | Simule des lots seedés et produit un rapport JSON ou CSV           |
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

Les stratégies disponibles sont `prudent`, `ambitious`, `patrimonial`, `mixed`, `random-valid` et
`all`. Une carrière arrêtée par le plafond technique, une erreur ou une violation d’invariant est
signalée dans `problemSeeds` et fait échouer la commande.

Vérification complète avant de rendre une tâche :

```bash
npm run check && npm run lint && npm run content:validate && npm run test && npm run build && npm run test:e2e
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

- une branche par tâche de la feuille de route : `feat/p1-01-etat-calendrier` ;
- des commits [Conventional Commits](https://www.conventionalcommits.org/fr/) :
  `feat(engine): ajouter le calendrier trimestriel` ;
- une pull request vers `main`, fusionnée après CI verte ;
- `ROADMAP.md` mis à jour uniquement lorsque le critère d’une tâche est vérifié.

## Structure

```text
src/
  routes/                 # +layout.svelte, +page.svelte (coque d’accueil), layout.css (tokens)
  lib/
    game/engine/          # moteur TypeScript pur (sans Svelte, DOM, stockage, réseau, hasard réel)
    game/content/         # types, schémas Zod, validation et catalogues JSON (data/, data/events/)
    game/persistence/     # enveloppe de sauvegarde, migrations, stockage local, export/import
    game/app/             # projection PlayerView, contrôleur, session Svelte, frontière navigateur
    components/           # écrans : shell, dashboard, agenda, organisation, journal, events, common
static/                   # fichiers copiés tels quels (favicon.svg, .nojekyll)
scripts/
  base-path.ts            # normalisation de BASE_PATH (Vite, Playwright, serveur statique)
  validate-content.ts     # npm run content:validate
  serve-static.ts         # npm run serve:static
.github/workflows/        # CI et déploiement GitHub Pages
tests/
  unit/                   # Vitest (Node)
  scenarios/              # scénarios moteur sur plusieurs trimestres (Vitest)
  fixtures/               # contenu de test figé, indépendant du tuning
  e2e/                    # Playwright (*.e2e.ts), contre le build statique
```

Les autres dossiers prévus par [ARCHITECTURE.md §3](ARCHITECTURE.md) (contenu, persistance,
contrôleur, scénarios…) sont créés lorsqu’ils deviennent utiles. L’alias `#lib/…` pointe vers
`src/lib/…` (champ `imports` de `package.json`, convention de SvelteKit 3).

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
