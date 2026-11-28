# Personnages nommés et relations

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Les figures persistantes : alliés, rivaux, dirigeants ; traits en partie cachés, liens orientés, vieillissement et mémoire des actes.

## Références

- GDD : §6.1 (un moteur commun), §6.3
- DESIGN : §4.5
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.3 ter (personnages et relations)
  - ARCHITECTURE §8.3 septies (adversaires récurrents)

## Code

- Moteur (`src/lib/game/engine/`) : `characters.ts`
- Contenu (`src/lib/game/content/data/`) : `cast.json`, `traits.json`
- Projection (`src/lib/game/app/`, module `view/people.ts`) : `PersonView`
- Interface (`src/lib/components/`) : `people/RelationsPanel.svelte`, `common/Avatar.svelte`
- Tests (`tests/`) : `unit/characters.test.ts`, `unit/rivals.test.ts`

## État V1

- Un rival peut réapparaître d’un scrutin à l’autre ; aucun personnage décédé candidat.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- Têtes de liste anonymes hors adversaire du joueur.

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-09 (diversité des noms) → B-07.
- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
