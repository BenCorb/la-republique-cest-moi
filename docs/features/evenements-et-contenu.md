# Événements et contenu narratif

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Les situations écrites qui interrompent ou colorent la carrière : brèves, dilemmes bloquants, chaînes différées, époques et références fictives.

## Références

- GDD : §8.3 (temporalité historique), §11 (événements narratifs)
- DESIGN : §4.4 (événements et conseils), §8 (ton rédactionnel)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §7.3, §7.4 (moteur et premier catalogue)
  - ARCHITECTURE §8.3 decies (contenu de l’alpha)
  - ARCHITECTURE §8.4 octies (époques, chaînes)
  - ARCHITECTURE §8.4 terdecies (capacités exigées par les affaires)
  - ARCHITECTURE §8.4 quaterdecies (anti-répétition, instrumentation)
  - ARCHITECTURE §8.4 octotrigesies, §8.4 novotrigesies (contenu du quotidien, vague 2)

## Code

- Moteur (`src/lib/game/engine/`) : `events.ts`, `effects.ts`, `conditions.ts`, `eras.ts`
- Contenu (`src/lib/game/content/data/`) : `data/events/*.json` (19 fichiers), `cast.json` ; validation dans `content/validate.ts`
- Projection (`src/lib/game/app/`, module `view/events.ts`) : `DecisionView`, `ChoiceView`, `AdviceView`
- Interface (`src/lib/components/`) : `events/DecisionDialog.svelte`
- Tests (`tests/`) : `unit/events.test.ts`, `unit/narrative-catalog.test.ts`, `unit/repetition.test.ts`, `unit/eras.test.ts`, `unit/content-catalog.test.ts`, `unit/capabilities.test.ts`, `scenarios/real-catalog.test.ts`

## État V1

- Quatre époques, événements et technologies selon les dates, chaînes sur plusieurs années.
- Répétitions pondérées et plafonnées ; rapport de répétition et de couverture dans le simulateur.
- Chaque dilemme garde un choix de repli ; les choix opportunistes créent des faits exploités par la justice et la presse.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

- Ton satirique de tout le contenu écrit pendant le rush : à relire par le créateur.

## Limites connues

_Aucune relevée à la V1._

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-12 (guides de contenu, relecture par échantillon) → B-06, B-16a, B-16b, B-16c.
- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
