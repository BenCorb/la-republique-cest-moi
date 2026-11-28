# La République, c’est moi ! — Instructions communes de développement

Ces consignes s’appliquent à Codex, Claude Code et à toute contribution au dépôt. **Phase actuelle : beta** — consolider les fonctionnalités une par une et retravailler l’UX/UI ([docs/ROADMAP.md](docs/ROADMAP.md)).

## Quoi lire selon la tâche

Ne pas lire tous les documents à chaque session : partir de la fiche du système concerné.

| Tâche | Lire |
| --- | --- |
| Toute tâche | ce fichier, `docs/ROADMAP.md` §2 (état), la section « Reprise » de la PR en cours |
| Chantier sur un système de jeu | sa fiche dans `docs/features/`, puis les sections du GDD, de `DESIGN.md` et les fichiers qu’elle cite |
| Interface, UX, composants | `docs/features/interface-coque.md`, `docs/DESIGN.md` (§10.10 : identité retenue) |
| Moteur, état, sauvegarde, tests | `docs/ARCHITECTURE.md` (contrats en vigueur) |
| Pourquoi une règle existe | `docs/archive/v1/` (lecture seule, ne plus y écrire) |

## Références et priorités

- `docs/GAME_DESIGN.md` : référence fonctionnelle. Respecter les décisions validées ; les chiffres provisoires restent modifiables pour l’équilibrage.
- `docs/ARCHITECTURE.md` : contrats techniques en vigueur, ordre du tour, données, tests et sauvegarde.
- `docs/DESIGN.md` : direction artistique et interface. `docs/features/` : une fiche par système. `docs/decisions/` : décisions transversales. `docs/playtests/` : un fichier par session.
- En cas de contradiction importante entre documents ou changement de gameplay, le signaler et obtenir une décision du créateur plutôt que modifier silencieusement la vision.

## Contraintes non négociables

- Jeu web solo desktop-first ; France alternative fictive à partir de 2000 ; un tour = un trimestre ; temps avancé uniquement sur commande ; pas de méta-progression.
- SvelteKit statique, TypeScript strict, Tailwind CSS, Lucide ; pas de backend, base distante, compte ou API IA dans le jeu.
- Moteur TypeScript pur, indépendant de Svelte et du navigateur. Les composants ne modifient pas directement l’état métier.
- Aléatoire seedé, état sérialisable, transitions déterministes, aucun `Math.random()` ou horloge réelle dans le moteur. Simulation accélérée et tests utilisent les mêmes transitions.
- Catalogues JSON validés (schémas et références), identifiants stables, effets déclaratifs autorisés, aucun `eval`. Textes français, code et identifiants anglais.
- Respecter les informations cachées dans les projections UI ; pas de jauge morale visible. Respecter l’ordre de tour et la production à partir de T+1 des nouveaux producteurs.
- Sauvegardes versionnées et **conservées depuis la V1** : toute évolution de `GameState` incrémente `SAVE_VERSION` et ajoute une migration testée ; la sauvegarde témoin `tests/fixtures/save-v1.json` reste lisible. Jamais de double résolution d’un tour ou d’un choix bloquant. Ne pas effacer une sauvegarde incompatible ou invalide sans décision explicite.

## Méthode de travail

1. Inspecter `git status` et les fichiers concernés ; lire la fiche et les sections pertinentes. Respecter les modifications déjà présentes.
2. Un chantier = une fiche (ou une partie). Commencer par l’audit de la fiche ; ne pas ajouter de fonctionnalité hors périmètre (« Après la V1 » de la feuille de route) sans décision du créateur.
3. Écrire les tests de règles et cas limites pertinents ; garder les données de tuning hors des composants. Pas de dépendance supplémentaire sans justification.
4. Vérifier avec `npm run verify` (check, lint, content:validate, test, build) et `npm run test:e2e` si l’interface ou la sauvegarde change. Ne pas prétendre qu’un script a réussi sans l’avoir exécuté.
5. Mettre à jour dans la même pull request la fiche du système, et `docs/ARCHITECTURE.md` si un contrat technique change. Consigner les choix provisoires comme tels (« décision déléguée, provisoire »). Ne pas modifier les décisions fonctionnelles validées sans accord.
6. En fin de tâche : résumer changements, tests réellement effectués et résultats, risques restants et prochaine tâche. Ne pas annoncer de test, commit ou déploiement non effectué.

Garder les documents courts : une fiche décrit ce qui est vrai aujourd’hui, pas l’historique (Git et la pull request le conservent).

## Collaboration entre assistants

Le dépôt Git et les documents constituent la mémoire commune. Ne pas dépendre des historiques de conversation ou de fichiers de mémoire privés. Ne pas lancer deux modifications concurrentes sur les mêmes fichiers ; utiliser des branches/worktrees distincts si nécessaire et intégrer après revue et tests. Ne pas faire de reset destructif, supprimer les changements existants, committer des secrets, publier ou déployer sans demande explicite. Ne pas créer de configurations spécifiques à un assistant sauf nécessité documentée.

## Conventions Git

- Dépôt : `github.com/BenCorb/la-republique-cest-moi`, branche principale `main`. `docs/ROADMAP.md` est la source de vérité de l’avancement : une case n’est cochée que lorsque son critère est vérifié.
- Beta : une branche et une pull request par chantier, créée depuis `main` à jour : `<type>/b-<nn>-<sujet-court>` en minuscules et tirets, par exemple `feat/b-04-agenda`, `refactor/b-01-view-model`. Hors chantier : `<type>/<sujet-court>` (`docs/…`, `fix/…`). Pas de préfixe propre à un assistant.
- Commits au format [Conventional Commits](https://www.conventionalcommits.org/fr/) : `<type>(<portée facultative>): <description>` ; types `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`, `style`. Description en français, à l’impératif, sans point final ; corps facultatif pour le « pourquoi » ; pied `Refs: B-04` pour relier un chantier.
- Intégration par pull request vers `main` après CI verte ; fusion « squash » avec un titre au format Conventional Commits. Pas de push forcé sur `main`, pas de réécriture d’un historique publié. Les conventions des phases 1 à 3 (branches de phase, rush) sont archivées.
- Le déploiement GitHub Pages est manuel (workflow « CI et GitHub Pages », option `deploy`) et n’est lancé que sur demande explicite du créateur.

## Reprise du travail entre assistants

1. **Avant de passer la main** : terminer une étape cohérente ou la documenter ; vérifier les scripts concernés ; committer sur la branche du chantier et la pousser. Dans la description de la pull request (ouverte en brouillon si nécessaire), tenir une section « Reprise » : chantier, état, commandes exécutées et résultats, décisions, points ouverts, prochaine étape. Ne laisser aucune modification non commitée dont l’autre assistant aurait besoin.
2. **En reprenant** : `git fetch --prune`, `git status`, puis lire ce fichier, `docs/ROADMAP.md` §2 et la section « Reprise » de la pull request en cours (`gh pr list`, `gh pr view`) ; vérifier l’état de la CI (`gh run list`). Poursuivre sur la même branche ; ne jamais travailler simultanément sur la même branche ou les mêmes fichiers.
3. Les décisions durables vont dans les documents du dépôt (fiche ou `docs/decisions/`), pas dans la mémoire privée d’un assistant.
4. Le dépôt ne doit pas se trouver dans un dossier synchronisé (iCloud Drive, Dropbox…) : la synchronisation crée des copies « nom 2.ext » qui cassent les vérifications et peuvent corrompre `.git`. Si c’est le cas, chercher ces copies avant chaque tâche (`find . -path ./node_modules -prune -o -name '* [0-9].*' -print`) et ne jamais les versionner.

`CLAUDE.md` se limite à importer ce fichier (`@AGENTS.md`) ; Codex lit `AGENTS.md` directement. Toute nouvelle consigne commune s’ajoute ici.

## Priorité produit

La carrière jouable de bout en bout existe (V1). La beta privilégie la lisibilité, la qualité des choix, la satire et la rejouabilité plutôt que de nouveaux systèmes. Durée cible : 60–90 minutes pour une carrière typique (décision du créateur du 27 novembre 2026), à vérifier par playtests.
