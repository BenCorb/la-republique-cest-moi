# Coque d’interface et système visuel

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Ce qui est commun à tous les écrans : en-tête, onglets, alertes, carnet du plan, bandeau de sauvegarde, composants partagés et identité visuelle. Point d’entrée de tout chantier UX/UI transversal.

## Références

- GDD : §13 (interface et direction artistique)
- DESIGN : tout le document, en particulier §3, §7 et §10.10 (identité retenue)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §9.1 (interface jouable)
  - ARCHITECTURE §8.4 sexdecies (direction visuelle et composants)
  - ARCHITECTURE §8.4 septdecies (plan permanent)
  - ARCHITECTURE §8.4 terquadragesies (cohérence visuelle finale)
  - PLAYTEST (archive) : playtest B1 et B2
  - AUDIT_V1 (archive)

## Code

- Moteur (`src/lib/game/engine/`) : —
- Contenu (`src/lib/game/content/data/`) : —
- Projection (`src/lib/game/app/view-model.ts`) : `PlayerView`, `Alert`, `ChipView`, `TrendView` ; `app/format.ts`
- Interface (`src/lib/components/`) : `shell/*` (GameLayout, GameShell, HeaderStat, AlertBar, SaveBanner, tabs.ts), `common/*` (identity.ts, EffectChip, StatBar, ScoreBars, Sparkline…), `dashboard/*`, `routes/+page.svelte`, `routes/layout.css`
- Tests (`tests/`) : `unit/interface.test.ts`, `unit/visual-identity.test.ts`, `unit/controller.test.ts`, `e2e/game.e2e.ts`

## État V1

- Dix onglets, aucune page factice ; vérifiés à 1 100, 1 280 et 1 440 px.
- Pastilles de coûts et d’effets, barres à paliers, tuiles de ressources, alertes à trois niveaux.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- `app/view-model.ts` monolithique (≈ 5 600 lignes) : à découper par système.
- Pas d’audit automatisé d’accessibilité ; zoom à 125 % non testé.

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
