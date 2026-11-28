# Patrimoine et train de vie

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Ce que devient l’argent personnel : actifs, revenus passifs, valeur nette, train de vie et ses effets sur le confort et la santé.

## Références

- GDD : §9.2 (patrimoine personnel)
- DESIGN : §4.6
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.4 quater (patrimoine et train de vie)
  - ARCHITECTURE §8.4 septtrigesies (débouchés de l’argent)

## Code

- Moteur (`src/lib/game/engine/`) : `wealth.ts`
- Contenu (`src/lib/game/content/data/`) : `wealth.json`, `upgrades.json`
- Projection (`src/lib/game/app/view-model.ts`) : `WealthView`, `AssetView`
- Interface (`src/lib/components/`) : `wealth/Wealth.svelte`
- Tests (`tests/`) : `unit/wealth.test.ts`

## État V1

- Six actifs dont un média local ; trois trains de vie, le modeste gratuit.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- Pas d’activités parallèles (consultant, auteur, chroniqueur) : après la V1.

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
