# Équilibrage et simulation

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Mesurer avant d’ajuster : lots de carrières seedées par stratégie, durée active estimée, répétitions, causes de fin, seeds problématiques.

## Références

- GDD : §16 (équilibrage et validation)
- DESIGN : —
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §11.1 bis (simulateur, première mesure)
  - ARCHITECTURE §8.4 undecies (P3-09, premier volet)
  - ARCHITECTURE §8.4 quaterquadragesies (P3-09, second volet)
  - PLAYTEST (archive) : protocole P3-09

## Code

- Moteur (`src/lib/game/engine/`) : tout le moteur via `simulation/index.ts`
- Contenu (`src/lib/game/content/data/`) : `balance.json` et chiffres des catalogues
- Projection (`src/lib/game/app/view-model.ts`) : —
- Interface (`src/lib/components/`) : —
- Tests (`tests/`) : `unit/simulation.test.ts` ; `npm run simulate`, `npm run benchmark`

## État V1

- Lots de 2 500 carrières (500 par stratégie) au second volet de P3-09 ; aucun plafond ni violation.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

- Tous les réglages du rush sont des décisions déléguées, à confirmer par le grand playtest chronométré (cible 60–90 minutes).

## Limites connues

- La durée humaine n’a pas encore été chronométrée.

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-10, D-11 (écart entre origines, nouveaux barèmes), accès à Matignon → B-17.
- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
