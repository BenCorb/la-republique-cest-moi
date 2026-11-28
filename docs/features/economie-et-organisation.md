# Ressources, économie et organisation

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Influence, budget politique et argent personnel ; les améliorations de l’organisation qui produisent à partir du trimestre suivant et coûtent des charges.

## Références

- GDD : §4.1 (ressources), §5.2 (améliorations et organisation)
- DESIGN : §4.5 (organisation et entourage)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.1, §8.1 bis, §8.1 ter (économie, producteurs, départ d’un élément)
  - ARCHITECTURE §8.3 duodecies (budget politique)

## Code

- Moteur (`src/lib/game/engine/`) : `economy.ts`, `selectors.ts`
- Contenu (`src/lib/game/content/data/`) : `upgrades.json`, `balance.json`
- Projection (`src/lib/game/app/`, module `view/organisation.ts`) : `ResourceView`, `ProducerView`, `OrganisationGroupView`, `UpgradeView`
- Interface (`src/lib/components/`) : `organisation/Organisation.svelte`, `common/ResourceTile.svelte`, `common/ResourceIcon.svelte`, `shell/HeaderStat.svelte`
- Tests (`tests/`) : `unit/economy.test.ts`, `unit/organisation.test.ts`

## État V1

- Trois ressources jamais fusionnées ; achat en T, production en T+1 ; charges impayées : production suspendue.
- Affichage regroupé par définition, départ d’un exemplaire possible.

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
