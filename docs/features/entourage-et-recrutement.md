# Entourage, recrutement et délégation

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Les postes clés (cabinet, communication, trésorerie, conseil politique, affaires juridiques) : recherche, vérification, salaire, missions et qualité des conseils.

## Références

- GDD : §5.3 (délégation), §6.2 (postes clés), §6.3 (informations partielles)
- DESIGN : §4.5
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.3 octies (entourage et délégation)
  - ARCHITECTURE §8.4 duovicies, §8.4 tervicies (recrutement I et II)
  - ARCHITECTURE §8.4 sexvicies (issue du recrutement dans la note)
  - ARCHITECTURE §8.4 terdecies (embauche familiale)

## Code

- Moteur (`src/lib/game/engine/`) : `staff.ts`, `recruitment.ts`
- Contenu (`src/lib/game/content/data/`) : `entourage.json`
- Projection (`src/lib/game/app/`, module `view/entourage.ts`) : `EntourageView`, `PostView`, `StaffPersonView`, `CandidateView`, `PostSearchView`, `HireOfferView`
- Interface (`src/lib/components/`) : `entourage/EntouragePanel.svelte`
- Tests (`tests/`) : `unit/staff.test.ts`, `unit/recruitment.test.ts`, `unit/recruitment-search.test.ts`

## État V1

- Recherche, vérification, acceptation selon salaire et attractivité ; issue annoncée dans la note de cabinet.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- Pas de délégation complète des tâches de l’organisation, de débauchage par un rival ni de réputation d’employeur (après la V1).

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
