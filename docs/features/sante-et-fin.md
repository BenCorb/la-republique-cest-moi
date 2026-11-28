# Santé, stress et fin de carrière

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Usure du personnage, repos, vieillissement et causes de fin : mort naturelle, épuisement, prison ferme ou retraite choisie.

## Références

- GDD : §4.5 (santé, stress, confort), §12 (fin de partie)
- DESIGN : §6 (bilan)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.2, §8.2 bis
  - ARCHITECTURE §8.4 quintrigesies (fin de carrière choisie)

## Code

- Moteur (`src/lib/game/engine/`) : `health.ts`, `career.ts` (retraite)
- Contenu (`src/lib/game/content/data/`) : `balance.json`
- Projection (`src/lib/game/app/view-model.ts`) : `StatBar` dans l’en-tête, alertes de santé
- Interface (`src/lib/components/`) : `common/StatBar.svelte`, `shell/HeaderStat.svelte`
- Tests (`tests/`) : `unit/health.test.ts`, `unit/retirement.test.ts`

## État V1

- Jauges 0–100, contributions identifiables (charge, mandats, événements, repos, confort, âge).
- « Se retirer de la vie politique » met fin à la carrière et ouvre le bilan.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- De rares carrières s’arrêtent dès 25–30 ans (mortalité de la première tranche d’âge non nulle).

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-08 (bouton de retraite) → B-04, B-05.
- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
