# Promesses de campagne

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Engagements pris en campagne, suivis une fois élu : tenus, partiellement tenus ou abandonnés, rappelés par la presse et jugés par les groupes concernés.

## Références

- GDD : §7.5 (gouverner et tenir ses promesses)
- DESIGN : §4.6
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.4 quinquies (promesses et gouvernement)
  - ARCHITECTURE §8.4 quatervicies (promesses contextualisées)

## Code

- Moteur (`src/lib/game/engine/`) : `promises.ts`
- Contenu (`src/lib/game/content/data/`) : `promises.json`, `data/events/promises.json`
- Projection (`src/lib/game/app/`, module `view/promises.ts`) : `PromisesView`, `PledgeView`, `PromiseOfferView`, `PromiseCampaignView`
- Interface (`src/lib/components/`) : `career/PromisesCard.svelte`
- Tests (`tests/`) : `unit/promises.test.ts`

## État V1

- Registre des promesses, dilemmes une fois élu (plafonnés), réalisation à échéance, rappels en campagne.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

_Aucune relevée à la V1._

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-06 (promesses tirées, annonce en démarche) → B-14.
- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
