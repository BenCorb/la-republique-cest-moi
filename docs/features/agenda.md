# Agenda et actions

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Composer le plan du trimestre avec le temps disponible : actions thématiques, formats (modeste, soutenu, majeur), activités ponctuelles ou épinglées, prévision des coûts et effets.

## Références

- GDD : §5.1 (actions manuelles)
- DESIGN : §4.3 (agenda et planification), §10.10
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §7.1 bis (actions, conditions, effets)
  - ARCHITECTURE §8.3 terdecies (agenda par thèmes)
  - ARCHITECTURE §8.4 decies, §8.4 duodecies (épinglage, activités ponctuelles, retrait automatique)
  - ARCHITECTURE §8.4 septdecies (plan permanent dans la coque)
  - ARCHITECTURE §8.4 quinvicies (montée en échelle des actions)

## Code

- Moteur (`src/lib/game/engine/`) : `plan.ts` (`previewPlan`, `carryOverPlan`), `scale.ts`, `conditions.ts`, `effects.ts`
- Contenu (`src/lib/game/content/data/`) : `actions.json`, `balance.json`
- Projection (`src/lib/game/app/`, module `view/agenda.ts`) : `PlanView`, `PlanStepView`, `CatalogItemView`, `ActionGroupView`, `ActionFormatView`
- Interface (`src/lib/components/`) : `agenda/Agenda.svelte`, `agenda/PlanPanel.svelte`, `agenda/TimeBar.svelte`, `shell/PlanNotebook.svelte`, `shell/PlanSheet.svelte`
- Tests (`tests/`) : `unit/plan.test.ts`, `unit/agenda.test.ts`, `unit/scale.test.ts`

## État V1

- Actions regroupées par thème ; activités ponctuelles par défaut, épinglage explicite ; étapes devenues impossibles retirées avec notice.
- Carnet du trimestre visible dans la colonne droite de tous les onglets ; feuille « Modifier le plan » avec recherche.
- Formats modeste, soutenu et majeur selon l’échelle de la carrière.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- Densité de texte et aide contextuelle à juger en playtest.

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
