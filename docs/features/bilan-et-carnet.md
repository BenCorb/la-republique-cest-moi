# Bilan, carnet des carrières et partage

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

La fin d’une vie politique : nécrologie, distinctions fondées sur l’historique, moments marquants, carnet des carrières passées, seed rejouable et export d’un retour.

## Références

- GDD : §12 (fin de partie et rejouabilité)
- DESIGN : §6 (bilan de fin de carrière)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.4 nonies (bilan)
  - ARCHITECTURE §8.4 unquadragesies (carnet des carrières)
  - ARCHITECTURE §8.4 duoquadragesies (partage entre amis)

## Code

- Moteur (`src/lib/game/engine/`) : `legacy.ts`
- Contenu (`src/lib/game/content/data/`) : `epitaphs.json`
- Projection (`src/lib/game/app/view-model.ts`) : `LogbookEntry`, bilan dans `PlayerView`
- Interface (`src/lib/components/`) : `events/CareerEnd.svelte`, `shell/LogbookCard.svelte`, `app/logbook.ts`
- Tests (`tests/`) : `unit/legacy.test.ts`, `unit/logbook.test.ts`

## État V1

- Carnet affiché sans bonus ni méta-progression, dans ce navigateur.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

_Aucune relevée à la V1._

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
