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

- Ton satirique de tout le contenu écrit pendant le rush : à relire par le créateur (B-16a).
- Guide commun ([docs/content/README.md](../content/README.md), B-06) : normes de longueur fixées sur les valeurs mesurées du catalogue, vouvoiement, typographie sans espace insécable, méthode de tirage de l’échantillon (décisions déléguées, provisoires). Décision du créateur (28 novembre 2026) : une figure culturelle historique peut être citée comme référence, jamais comme actrice ni avec un comportement répréhensible.

## Limites connues

_Aucune relevée à la V1._

## Production de contenu (audit B-06, 28 novembre 2026)

Ce qui existe avant le guide commun :

- **Règles de ton dispersées.** DESIGN §8 (contraste administratif / absurde, pas d’insulte gratuite, pas de personnalité réelle à connaître, pas de réponse morale correcte, pas de texte généré), §4.4 (récit de résultat : trois phrases au plus, deuxième personne), §10.3 (allure institutionnelle), §10.4 (pastilles plutôt que phrases) ; GDD §1.3 (tentation sans punition morale), §8.1 (noms fictifs, satire judiciaire du 25 novembre 2026), §8.3 (anachronismes interdits), §11 (contenu écrit à l’avance, variables, cohérence). Aucune norme de longueur écrite, aucune convention d’identifiant documentée hors du code.
- **Catalogues.** `src/lib/game/content/data/` : 16 catalogues et 19 fichiers d’événements (165 événements, 269 choix), 117 actions, 150 titres de presse, 22 promesses, 16 améliorations, 17 nécrologies, 18 personnages fixes (`cast.json`). Textes en français, vouvoiement du joueur partout.
- **Validation.** `npm run content:validate` : schémas Zod (`schemas.ts`), identifiants `famille.nom` (`CONTENT_ID_PATTERN`), doublons, références croisées, variables de texte `{role}` seules autorisées, réserve minimale de titres de presse par angle (`MIN_HEADLINE_POOL` = 3). Les sauvegardes référencent les identifiants du catalogue : renommer ou retirer un identifiant casse les parties en cours.
- **Commande provisoire.** `docs/content/BRIEF.md`, rédigé au dépouillement B-02, qui répète les règles faute de guide.
- **D-12 (créateur).** Guide commun et modèle de commande d’abord ; une fiche par type livrée avec le chantier de son système ; `content:report` avec le chantier économie (B-08) ; relecture par échantillon (délégué : contenus sensibles toujours relus — justice, origines, noms —, une entrée sur cinq ailleurs, lot entier corrigé en cas de problème) ; générateur de squelettes reporté après la beta v2.

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-12 (guides de contenu, relecture par échantillon) → B-06, B-16a, B-16b, B-16c.
- B-06 : guide commun et modèle de commande livrés ([README](../content/README.md), [BRIEF](../content/BRIEF.md)) ; règles de production ci-dessus.
- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
