# Tour, accélération et note de cabinet

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : en chantier (B-04, en revue).** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

La boucle trimestrielle, au tour par tour : préparer un plan, avancer d’un trimestre, lire ce qui s’est passé (note de cabinet). Le moteur d’accélération ne sert plus qu’à la simulation et aux tests.

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
- Projection (`src/lib/game/app/`, module `view/note.ts`, `view/journal.ts`) : `QuarterNoteView`, `OutcomeView`, `JournalTurnView` ; retraite : `PlanView.retirement`
- Interface (`src/lib/components/`) : `shell/TurnControls.svelte`, `events/NoteDialog.svelte`
- Tests (`tests/`) : `unit/shell-view.test.ts` (retraite), `scenarios/acceleration.test.ts`, `scenarios/determinism.test.ts`, `unit/acceleration-alerts.test.ts`, `unit/outcome-note.test.ts`, `unit/calendar.test.ts`

## État V1

- Trois avances : trimestre suivant, année suivante (quatre trimestres au plus), jusqu’à une alerte ; interruption entre deux trimestres.
- Arrêts motivés : décision, alerte de plan, santé, échéance électorale, carrière, entourage, finances, fin, plan devenu invalide ou vide.
- Note de cabinet après chaque trimestre manuel, note de période après accélération, réouvrable depuis l’en-tête.

## Règles en vigueur

- **Tour par tour** (D-07) : un seul bouton d’avance, « Trimestre suivant » (`commitTurn`), désactivé si une décision attend, si le plan est invalide, si la dernière étape n’est pas sauvegardée ou si la carrière est finie. Après un tour, l’onglet Trimestre s’ouvre.
- **Moteur d’accélération** (`engine/acceleration.ts`) : répète `transition(commitTurn)` ; arrêts sur décision, alertes (plan, santé, échéance, carrière, entourage, finances), fin, plan invalide ou vide. Réservé au simulateur et aux tests : le contrôleur ne l’expose plus.
- **Plan** : activités ponctuelles par défaut ; seules les épinglées sont reconduites ; une activité devenue impossible est retirée avec son motif.
- **Note de cabinet** après chaque trimestre ; réouvrable depuis l’en-tête.
- **Retraite** (D-08) : bouton « Se retirer de la vie politique » à gauche de la barre du bas ; confirmation (« Annoncer ma retraite »), puis « Retraite annoncée : effet à la fin du trimestre » avec « Renoncer » jusqu’au passage du tour. Mécanisme : l’action `personal.retire` (5 points de temps) entre au plan ; elle n’apparaît plus dans l’agenda ni dans la recherche. B-05 en fera une démarche sans temps.

## Décisions provisoires à confirmer

- D-07, délégué : note de cabinet plus courte et au moins une nouveauté par trimestre, hors B-04 (chantier à planifier).
- D-08, délégué : bouton à gauche, confirmation au clic, effet à la fin du trimestre, annulable jusqu’au passage du tour. Coût de 5 points maintenu jusqu’à B-05.

## Limites connues

- La retraite coûte encore 5 points de temps (action du plan) : un plan plein empêche de l’annoncer.

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-07 (tour par tour) → B-04 ; D-08 (retraite) → B-04, B-05.
- [x] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées (B-04)
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [x] Plan de consolidation validé par le créateur (28 novembre 2026, B-04) : « Année suivante », « Jusqu’à une alerte », état d’accélération et résumé de période retirés de l’interface et du contrôleur ; moteur d’accélération conservé (simulation, tests) ; bouton « Se retirer de la vie politique » à gauche de la barre du bas, confirmé au clic, annulable depuis le carnet ; `personal.retire` reste le mécanisme (5 points jusqu’à B-05) mais quitte l’agenda ; note de cabinet raccourcie hors B-04.
- [x] Mise en œuvre, tests et fiche à jour (B-04)
