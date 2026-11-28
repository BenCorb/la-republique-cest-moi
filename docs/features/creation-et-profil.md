# Création de partie, profil et premiers pas

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Le point de départ : origine sociale, profession, terrain d’engagement, territoire, ambition de départ, famille ; puis des objectifs guidés dans une vraie carrière.

## Références

- GDD : §3 (personnage et création), §3.3 (famille)
- DESIGN : §4.1 (accueil et création)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.3 nonies (origines, professions, famille)
  - ARCHITECTURE §8.4 novodecies (terrain d’engagement)
  - ARCHITECTURE §8.4 quindecies (territoire)
  - ARCHITECTURE §8.4 sextrigesies (ambition de départ)
  - ARCHITECTURE §8.4 quadragesies (premiers pas guidés)

## Code

- Moteur (`src/lib/game/engine/`) : `state.ts` (`createGame`), `family.ts`, `territory.ts`, `ambition.ts`
- Contenu (`src/lib/game/content/data/`) : `profiles.json`
- Projection (`src/lib/game/app/`, module `view/creation.ts`) : `ProfileOptionView`, `RegionOptionView`, `TerritoryView`, `FirstStepsView`, `creationOptions`
- Interface (`src/lib/components/`) : `shell/HomeScreen.svelte`, `shell/CreationScreen.svelte`, `shell/FirstSteps.svelte`
- Tests (`tests/`) : `unit/family.test.ts`, `unit/territory.test.ts`, `unit/ambition.test.ts`, `unit/engagement.test.ts`, `unit/state.test.ts`, `e2e/home.e2e.ts`

## État V1

- Âge de départ fixe à 25 ans (P3-06 abandonnée).
- Région choisie, département et commune fictive tirés ; ambition rappelée au dossier et jugée au bilan, sans bonus.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- Pas de déménagement ni de parachutage (après la V1).

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-05 (emploi) → B-10 ; D-09 (nom, accord) → B-07 ; D-10 (origines) → B-13.
- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
