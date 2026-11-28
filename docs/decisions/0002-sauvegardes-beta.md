# 0002 — Sauvegardes non conservées pendant la beta

- **Date :** 2026-11-28
- **Statut :** acceptée (remplace, pour la durée de la beta, la règle de conservation de 0001 et d’`AGENTS.md`)
- **Décidée par :** créateur ; modalités d’affichage déléguées, provisoires

## Contexte

Depuis la V1, toute évolution de `GameState` devait incrémenter `SAVE_VERSION` et ajouter une migration testée, et la sauvegarde témoin `tests/fixtures/save-v1.json` devait rester lisible. Le dépouillement du playtest B-02 prévoit une refonte de nombreux systèmes (démarches, emploi, économie, promesses, nom du personnage…) : presque chaque chantier aurait exigé une migration, pour des parties de test que personne n’a besoin de garder.

## Décision

- **Pendant toute la beta, les sauvegardes ne sont plus conservées d’une version à l’autre.** Toute évolution de `GameState` incrémente toujours `SAVE_VERSION`, sans migration.
- **Une sauvegarde d’une version précédente n’est jamais effacée ni modifiée en silence.** Le jeu indique qu’elle vient d’une version précédente de la beta et ne peut plus être chargée, et propose de l’exporter ou de commencer une nouvelle partie.
- La sauvegarde témoin `tests/fixtures/save-v1.json` n’a plus à rester lisible ; un test vérifie à la place qu’une sauvegarde d’ancienne version est refusée avec ce message, sans écriture.
- **La conservation redevient obligatoire au passage en version 1.0 publique**, annoncé explicitement par le créateur ; la première sauvegarde conservée sera celle de cette version.

## Conséquences

- `AGENTS.md` (contraintes) et `ARCHITECTURE.md` §10 sont mis à jour en conséquence.
- Le chantier B-03 adapte le chargement (message, export, nouvelle partie) et les tests de persistance.
- Les autres règles de sauvegarde restent : enveloppe versionnée, validation stricte, aucune réparation silencieuse, jamais de double résolution d’un tour ou d’un choix bloquant.
