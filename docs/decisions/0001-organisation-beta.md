# 0001 — Organisation du dépôt et du travail pour la beta

- **Date :** 2026-11-28
- **Statut :** acceptée ; la conservation des sauvegardes (« Conséquences ») est remplacée par [0002](0002-sauvegardes-beta.md)
- **Décidée par :** créateur (passage en beta, nettoyage du dépôt) ; détails d’organisation délégués, provisoires

## Contexte

Après la V1 (tag `v1.0.0`), les documents de référence étaient devenus des journaux de bord : `ARCHITECTURE.md` (≈ 275 Ko) empilait les décisions tâche par tâche, `PLAYTEST.md` (≈ 143 Ko) et `ROADMAP.md` (≈ 62 Ko) gardaient tout l’historique des phases 0 à 3. Chaque session payait ce contexte, alors qu’un chantier n’en a besoin que d’une petite partie. La beta vise à consolider les fonctionnalités une par une et à retravailler l’UX/UI.

## Décision

- Documents dans `docs/` : `GAME_DESIGN.md` et `DESIGN.md` déplacés sans réécriture ; `ARCHITECTURE.md` réduit aux contrats en vigueur ; nouvelle `ROADMAP.md` de la beta.
- Historique figé dans `docs/archive/v1/` (ARCHITECTURE, ROADMAP, PLAYTEST, AUDIT_V1 dans leur état au tag `v1.0.0`) : lecture seule, consultée seulement pour le pourquoi d’une règle.
- Une fiche par fonctionnalité dans `docs/features/`, point d’entrée de toute session sur ce système ; un chantier commence par l’audit de sa fiche.
- Décisions transversales dans `docs/decisions/`, playtests dans `docs/playtests/` (un fichier par session).
- Git : retour à la règle générale, une branche et une pull request par chantier (`feat/b-<fiche>-<sujet>`, pied `Refs: B-xx`).
- `npm run verify` enchaîne les vérifications communes à tous les assistants.

## Conséquences

- Les renvois du type « ARCHITECTURE §8.4 sexies » présents dans le GDD, `DESIGN.md` et les commentaires visent l’archive ; ils disparaîtront au fil des audits.
- Les sauvegardes restent conservées depuis la V1 (`SAVE_VERSION = 2`) : toute évolution de l’état passe par une migration testée.
- Le dépôt doit quitter `~/Documents` (synchronisé par iCloud), qui produit des copies « nom 2.ext ».
