# Partis, gouvernement et monde politique

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

La France alternative qui vit sans le joueur : huit partis fictifs, contexte national, gouvernement et portefeuilles, carrière dans l’appareil, Matignon.

## Références

- GDD : §8.1, §8.2 (France alternative, évolution du monde)
- DESIGN : §4.6
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.3 bis (partis et contexte national)
  - ARCHITECTURE §8.4 duotrigesies (carrière partisane)
  - ARCHITECTURE §8.4 tertrigesies (gouvernement et portefeuilles)
  - ARCHITECTURE §8.4 quatertrigesies (Matignon)

## Code

- Moteur (`src/lib/game/engine/`) : `world.ts`, `party.ts`, `government.ts`
- Contenu (`src/lib/game/content/data/`) : `world.json`
- Projection (`src/lib/game/app/`, module `view/world.ts`) : `WorldView`, `PartyView`, `PartyCareerView`, `AdvanceOfferView`, `IndicatorView`
- Interface (`src/lib/components/`) : `world/WorldPanel.svelte`
- Tests (`tests/`) : `unit/world.test.ts`, `unit/party.test.ts`, `unit/government.test.ts`

## État V1

- Huit ministères jouables plus le secrétariat d’État ; Premier ministre au plus en V1 ; président, gouvernement et cohabitation existent.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

- Matignon peut-être trop accessible : à juger en playtest.

## Limites connues

- Carrière partisane sans scission ni création de parti (après la V1).

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
