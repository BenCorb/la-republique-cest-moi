# Tour, accélération et note de cabinet

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

La boucle trimestrielle : préparer un plan, avancer d’un trimestre ou accélérer jusqu’à une alerte, puis lire ce qui s’est passé (note de cabinet, résumé de période).

## Références

- GDD : §2 (boucle et calendrier)
- DESIGN : §5 (rythme et passage du temps)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §5.1, §5.2 bis, §5.2 ter
  - ARCHITECTURE §8.4 octodecies (résultat des décisions, note de cabinet)
  - ARCHITECTURE §8.4 sexvicies (issue du recrutement dans la note)
  - ARCHITECTURE §8.4 octovicies (charges de la frontière dans la prévision)

## Code

- Moteur (`src/lib/game/engine/`) : `turn.ts`, `acceleration.ts`, `commands.ts`, `calendar.ts`
- Contenu (`src/lib/game/content/data/`) : `balance.json` (paramètres d’alerte)
- Projection (`src/lib/game/app/`, module `view/note.ts`, `view/journal.ts`) : `summarizeSpan`, `SpanSummaryView`, `QuarterNoteView`, `OutcomeView`, `JournalTurnView`
- Interface (`src/lib/components/`) : `shell/TurnControls.svelte`, `events/NoteDialog.svelte`, `dashboard/SpanSummary.svelte`
- Tests (`tests/`) : `scenarios/acceleration.test.ts`, `scenarios/determinism.test.ts`, `unit/acceleration-alerts.test.ts`, `unit/outcome-note.test.ts`, `unit/calendar.test.ts`

## État V1

- Trois avances : trimestre suivant, année suivante (quatre trimestres au plus), jusqu’à une alerte ; interruption entre deux trimestres.
- Arrêts motivés : décision, alerte de plan, santé, échéance électorale, carrière, entourage, finances, fin, plan devenu invalide ou vide.
- Note de cabinet après chaque trimestre manuel, note de période après accélération, réouvrable depuis l’en-tête.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- Fréquence des arrêts électoraux à juger en jeu réel (piste : ne s’arrêter que pour les scrutins déjà visés).

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-07 (tour par tour) → B-04 ; D-08 (retraite) → B-04, B-05.
- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
