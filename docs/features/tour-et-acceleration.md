# Tour, accélération et note de cabinet

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : en chantier (B-04).** Modèle et mode d’emploi : [README](README.md).

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

_Audit de B-04, avant mise en œuvre ; tiré du code._

- **Avances dans l’interface** : « Trimestre suivant » (`commitTurn`), « Année suivante » (`accelerate(4)`) et « Jusqu’à une alerte » (`accelerate(40)`), interruptibles entre deux trimestres ; désactivées si une décision attend, si le plan est invalide, si la dernière étape n’est pas sauvegardée ou si la carrière est finie.
- **Moteur d’accélération** (`engine/acceleration.ts`) : répète `transition(commitTurn)` ; arrêts sur décision, alertes (plan, santé, échéance, carrière, entourage, finances), fin, plan invalide ou vide. Utilisé aussi par le simulateur et les tests.
- **Plan** : activités ponctuelles par défaut ; seules les épinglées sont reconduites ; une activité devenue impossible est retirée avec son motif.
- **Note de cabinet** après chaque trimestre manuel, note de période (avec `SpanSummary`) après une accélération ; réouvrable depuis l’en-tête.
- **Retraite** : action d’agenda `personal.retire` (catégorie vie perso, 5 points) ; quand elle est au plan, « Trimestre suivant » ouvre une confirmation (« Quitter la vie politique ? ») ; la carrière s’achève à la fin du trimestre.

## Décisions provisoires à confirmer

- D-07 (créateur) : « Accélérer » et « Année suivante » quittent l’interface ; seul reste « Trimestre suivant » ; GDD §2 et §2.3 à réécrire. Délégué : moteur d’accélération conservé pour les tests et la simulation ; note de cabinet plus courte ; au moins une nouveauté par trimestre.
- D-08 (créateur) : bouton « Se retirer de la vie politique » dans la barre du bas. Délégué : à gauche, loin du bouton d’avance ; confirmation ; effet à la fin du trimestre ; annulable jusqu’au passage du tour ; l’action d’agenda disparaît.

## Limites connues

- La retraite n’est accessible que par l’agenda (retour PT-B02-008).
- Fréquence des arrêts électoraux de l’accélération : sans objet après D-07.

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-07 (tour par tour) → B-04 ; D-08 (retraite) → B-04, B-05.
- [x] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées (B-04)
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [x] Plan de consolidation validé par le créateur (28 novembre 2026, B-04) : « Année suivante », « Jusqu’à une alerte », état d’accélération et résumé de période retirés de l’interface et du contrôleur ; moteur d’accélération conservé (simulation, tests) ; bouton « Se retirer de la vie politique » à gauche de la barre du bas, confirmé au clic, annulable depuis le carnet ; `personal.retire` reste le mécanisme (5 points jusqu’à B-05) mais quitte l’agenda ; note de cabinet raccourcie hors B-04.
- [ ] Mise en œuvre, tests et fiche à jour
