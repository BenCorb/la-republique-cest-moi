# Médias et presse

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Cinq médias fictifs et la presse régionale : fil d’actualité fondé sur les faits révélés, relations, interviews, rachat d’un média local, exposition médiatique.

## Références

- GDD : §9.1 (presse et communication)
- DESIGN : §4.6
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.4 sexies (médias et relations)
  - ARCHITECTURE §8.4 vicies (presse régionale)
  - ARCHITECTURE §8.4 quaterdecies (mémoire de presse, anti-répétition des titres)

## Code

- Moteur (`src/lib/game/engine/`) : `press.ts`
- Contenu (`src/lib/game/content/data/`) : `media.json`, `data/events/press.json`, `data/events/media.json`
- Projection (`src/lib/game/app/view-model.ts`) : `MediaView`, `MediaOutletView`, `MediaActionView`, `PressItemView`
- Interface (`src/lib/components/`) : `career/MediaCard.svelte`, `news/NewsPanel.svelte`, `shell/PressTicker.svelte`, `shell/press-rotation.ts`
- Tests (`tests/`) : `unit/press.test.ts`, `unit/regional-press.test.ts`, `unit/press-rotation.test.ts`

## État V1

- Titres tirés sans remise, délai thématique, plafond par scène ordinaire ; titre de presse dans l’en-tête.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- Un seul média par région (plusieurs : après la V1).

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
