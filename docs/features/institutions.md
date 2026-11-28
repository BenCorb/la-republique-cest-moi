# Institutions modifiables

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Cinq paramètres réformables (cumul, indépendance de la justice, transparence, mode de scrutin, liberté de la presse), votés puis appliqués au 1er janvier à tous les acteurs.

## Références

- GDD : §10.2 (institutions modifiables)
- DESIGN : §4.6
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.4 septies (institutions modifiables)

## Code

- Moteur (`src/lib/game/engine/`) : `reforms.ts`
- Contenu (`src/lib/game/content/data/`) : `institutions.json`, `data/events/institutions.json`
- Projection (`src/lib/game/app/view-model.ts`) : `InstitutionsView`, `InstitutionParameterView`, `ReformOptionView`
- Interface (`src/lib/components/`) : `world/InstitutionsCard.svelte`
- Tests (`tests/`) : `unit/reforms.test.ts`

## État V1

- Réformes non rétroactives, aussi proposées par le gouvernement.

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
