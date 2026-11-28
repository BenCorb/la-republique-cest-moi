# Justice et affaires

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Le cœur satirique : les actes douteux laissent des faits, qui peuvent devenir des dossiers à étapes (révélation, enquête, mise en examen, procès, appel) jusqu’à la relaxe ou la condamnation.

## Références

- GDD : §10.1 (affaires judiciaires), §4.2 (jauges d’exposition et de risque)
- DESIGN : §4.6
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.4 (principes V1)
  - ARCHITECTURE §8.4 bis (registre des faits et jauges)
  - ARCHITECTURE §8.4 ter (dossiers judiciaires)
  - ARCHITECTURE §8.4 terdecies (capacités exigées par les infractions)

## Code

- Moteur (`src/lib/game/engine/`) : `justice.ts`
- Contenu (`src/lib/game/content/data/`) : `justice.json`, `data/events/justice.json`
- Projection (`src/lib/game/app/`, module `view/justice.ts`) : `JusticeView`, `CaseView`, `FactView`
- Interface (`src/lib/components/`) : `dashboard/Dashboard.svelte` (jauges, dossiers), `journal/Journal.svelte`
- Tests (`tests/`) : `unit/justice.test.ts`, `unit/capabilities.test.ts`

## État V1

- Cinq types d’affaires, dossiers simultanés y compris pour l’entourage ; défense, peines, inéligibilité, prison ferme terminale.
- Culpabilité et enquête restent des états distincts ; l’impunité n’est jamais garantie.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- Pas de trafic d’influence (après la V1).

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
