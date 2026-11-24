# La République, c’est moi ! — Instructions communes de développement

Ces consignes s’appliquent à Codex, Claude Code et à toute contribution au dépôt.

## Références et priorités

- `GAME_DESIGN.md` : référence fonctionnelle. Respecter les décisions validées ; les chiffres provisoires restent modifiables pour l’équilibrage.
- `ARCHITECTURE.md` : contrats techniques, ordre du tour, données, tests et sauvegarde.
- `DESIGN.md` et `ROADMAP.md` : consulter lorsqu’ils existent ; ne pas inventer leur contenu s’ils n’ont pas encore été rédigés.
- En cas de contradiction importante entre documents ou changement de gameplay, le signaler et obtenir une décision du créateur plutôt que modifier silencieusement la vision.

## Contraintes non négociables V1

- Jeu web solo desktop-first ; France alternative fictive à partir de 2000 ; un tour = un trimestre ; temps avancé uniquement sur commande ; pas de méta-progression.
- SvelteKit statique, TypeScript strict, Tailwind CSS, Lucide ; pas de backend, base distante, compte ou API IA dans le jeu.
- Moteur TypeScript pur, indépendant de Svelte et du navigateur. Les composants ne modifient pas directement l’état métier.
- Aléatoire seedé, état sérialisable, transitions déterministes, aucun `Math.random()` ou horloge réelle dans le moteur. Simulation accélérée et tests utilisent les mêmes transitions.
- Catalogues JSON validés (schémas et références), identifiants stables, effets déclaratifs autorisés, aucun `eval`. Textes français, code et identifiants anglais.
- Respecter les informations cachées dans les projections UI ; pas de jauge morale visible. Respecter l’ordre de tour et la production à partir de T+1 des nouveaux producteurs.
- Sauvegardes versionnées, migrations explicites, jamais de double résolution d’un tour ou d’un choix bloquant. Ne pas effacer une sauvegarde incompatible ou invalide sans décision explicite.

## Méthode de travail

1. Inspecter `git status` et les fichiers concernés ; lire les sections pertinentes des documents. Respecter les modifications déjà présentes.
2. Travailler sur une tâche petite et testable ; ne pas ajouter des fonctionnalités hors périmètre. Si l’étape de développement n’est pas claire, privilégier la prochaine tâche non terminée du prototype.
3. Écrire les tests de règles et cas limites pertinents ; garder les données de tuning hors des composants. Pas de dépendance supplémentaire sans justification.
4. Exécuter les scripts réellement disponibles et pertinents : `npm run check`, `npm run lint`, `npm run content:validate`, `npm run test`, `npm run build` ; `npm run test:e2e` si interface ou sauvegarde modifiée. Lors du bootstrap, créer les scripts ; ne pas prétendre qu’un script absent a réussi.
5. Mettre à jour les documents concernés si un contrat technique change ; consigner les choix provisoires comme tels. Ne pas modifier les décisions fonctionnelles validées sans accord.
6. En fin de tâche : résumer changements, tests réellement effectués et résultats, risques restants et prochaine tâche. Ne pas annoncer de test, commit ou déploiement non effectué.

## Collaboration entre assistants

Le dépôt Git et les documents constituent la mémoire commune. Ne pas dépendre des historiques de conversation ou de fichiers de mémoire privés. Ne pas lancer deux modifications concurrentes sur les mêmes fichiers ; utiliser des branches/worktrees distincts si nécessaire et intégrer après revue et tests. Ne pas faire de reset destructif, supprimer les changements existants, committer des secrets, publier ou déployer sans demande explicite. Ne pas créer de configurations spécifiques à un assistant sauf nécessité documentée.

## Conventions Git

- Dépôt : `github.com/BenCorb/la-republique-cest-moi`, branche principale `main`. `ROADMAP.md` est la source de vérité de l’avancement : une case n’est cochée que lorsque son critère est vérifié.
- Une branche par tâche, créée depuis `main` à jour : `<type>/<id>-<sujet-court>` en minuscules et tirets, par exemple `feat/p1-01-etat-calendrier`, `fix/p1-07-import-sauvegarde`, `docs/conventions-git`. L’identifiant de tâche est omis s’il n’y en a pas. Pas de préfixe propre à un assistant.
- Commits au format [Conventional Commits](https://www.conventionalcommits.org/fr/) : `<type>(<portée facultative>): <description>` ; types `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`, `style`. Description en français, à l’impératif, sans point final ; corps facultatif pour le « pourquoi » ; pied `Refs: P1-01` pour relier une tâche. Exemple : `feat(engine): ajouter le calendrier trimestriel`.
- Exception décidée par le créateur pour la phase 1 : une branche de phase unique `feat/p1-prototype`, un commit par tâche (`Refs: P1-0x`) poussé sur cette branche, et une seule pull request vers `main` à la fin de la phase. La reprise se fait sur cette branche ; ROADMAP.md indique les tâches terminées.
- Intégration par pull request vers `main` après CI verte ; fusion « squash » avec un titre au format Conventional Commits. Pas de push forcé sur `main`, pas de réécriture d’un historique publié.
- Le déploiement GitHub Pages est manuel (workflow « CI et GitHub Pages », option `deploy`) et n’est lancé que sur demande explicite du créateur.

## Reprise du travail entre assistants

1. **Avant de passer la main** : terminer une étape cohérente ou la documenter ; vérifier les scripts concernés ; committer sur la branche de la tâche et la pousser. Dans la description de la pull request (ouverte en brouillon si nécessaire), tenir une section « Reprise » : tâche, état, commandes exécutées et résultats, décisions, points ouverts, prochaine étape. Ne laisser aucune modification non commitée dont l’autre assistant aurait besoin.
2. **En reprenant** : `git fetch --prune`, `git status`, puis lire `AGENTS.md`, `ROADMAP.md` et la section « Reprise » de la pull request en cours (`gh pr list`, `gh pr view`) ; vérifier l’état de la CI (`gh run list`). Poursuivre sur la même branche ; ne jamais travailler simultanément sur la même branche ou les mêmes fichiers.
3. Les décisions durables vont dans les documents du dépôt, pas dans la mémoire privée d’un assistant.
4. Le dépôt ne doit pas se trouver dans un dossier synchronisé (iCloud Drive, Dropbox…) : la synchronisation crée des copies « nom 2.ext » qui cassent les vérifications et peuvent corrompre `.git`. Si c’est le cas, chercher ces copies avant chaque tâche et ne jamais les versionner (ARCHITECTURE.md §15.4).

`CLAUDE.md` se limite à importer ce fichier (`@AGENTS.md`) ; Codex lit `AGENTS.md` directement. Toute nouvelle consigne commune s’ajoute ici.

## Priorité produit

Livrer d’abord une carrière jouable de bout en bout avec un personnage de 25 ans. Ne pas surconcevoir les élections, la justice, les médias et les institutions avant validation du moteur de base. Favoriser la satire, les choix intéressants, la lisibilité et la rejouabilité ; durée cible V1 : 45–60 minutes, à vérifier par playtests.
