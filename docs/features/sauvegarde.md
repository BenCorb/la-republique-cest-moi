# Sauvegarde, import et export

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

La fiabilité de la partie : sauvegarde automatique après chaque transition, copie précédente, onglets concurrents, export et import JSON, migrations.

## Références

- GDD : —
- DESIGN : §4.1 (reprise, import)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §10.1 (sauvegarde locale)
  - ARCHITECTURE §8.4 quinquadragesies (premier format conservé)

## Code

- Moteur (`src/lib/game/engine/`) : —
- Contenu (`src/lib/game/content/data/`) : —
- Projection (`src/lib/game/app/view-model.ts`) : `app/controller.ts`, `app/browser.ts`
- Interface (`src/lib/components/`) : `shell/SaveBanner.svelte`, `shell/HomeScreen.svelte`
- Tests (`tests/`) : `unit/persistence.test.ts`, `unit/controller.test.ts`, `scenarios/save-resume.test.ts`, `fixtures/save-v1.json`
- Persistance : `persistence/` (envelope, migrations, state-schema, local-storage, import-export). Contrat : ARCHITECTURE §10.

## État V1

- `SAVE_VERSION = 2`, premier format conservé ; toute évolution de l’état passe par une migration testée.

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
