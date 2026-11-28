# Groupes de soutien et base militante

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Popularité auprès des groupes électoraux, appuis d’influence (militants, appareil, affaires) et base militante qui grandit, s’active ou s’use.

## Références

- GDD : §4.4 (groupes de soutien), §5.2
- DESIGN : §4.6
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.3 quinquies (groupes et popularité)
  - ARCHITECTURE §8.4 unvicies (militants organiques)
  - ARCHITECTURE §8.4 septvicies (leviers de la base militante)

## Code

- Moteur (`src/lib/game/engine/`) : `supports.ts`, `activists.ts`
- Contenu (`src/lib/game/content/data/`) : `supports.json`
- Projection (`src/lib/game/app/view-model.ts`) : `SupportsView`, `SupportGroupView`, `ActivistsView`, `ActivistLeverView`
- Interface (`src/lib/components/`) : `career/SupportsCard.svelte`, `organisation/Organisation.svelte`
- Tests (`tests/`) : `unit/supports.test.ts`, `unit/activists.test.ts`

## État V1

- Six groupes : trois électoraux pondérés dans la popularité, trois d’influence sans voix.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

- Forme d’interface des leviers militants (P3-32) à juger en jeu.

## Limites connues

- Recrues militantes d’un scrutin tranché au second tour non comptées.

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
