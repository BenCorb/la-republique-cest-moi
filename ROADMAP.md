# La République, c’est moi ! — Feuille de route

**Version 0.1 — 24 novembre 2026**  
**Statut :** phases 0 et 1 terminées et intégrées à `main` (PR #4, CI verte, 24 novembre 2026) ; P0-01 à P0-06 et P1-01 à P1-10 réalisées et vérifiées (✅ = tâche terminée dans les tableaux). Phase 2 (alpha) terminée et intégrée à `main` (PR #5, `5a5b0e5`, CI verte, 25 novembre 2026) ; P2-01 à P2-10 réalisées et vérifiées. L’alpha a été publiée sur GitHub Pages le 25 novembre 2026 ; depuis le 26 novembre 2026, le site montre la phase 3 intégrée (avant P3-10). Reprise : voir §9.

**Références :** [GAME_DESIGN.md](GAME_DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN.md](DESIGN.md), [AGENTS.md](AGENTS.md).

## 1. Stratégie de livraison

Développer des tranches verticales jouables, pas tous les systèmes simultanément. Le prototype doit permettre de tester la boucle trimestrielle avant d’investir dans les élections complexes, la justice et les médias. La V1 vise des carrières indépendantes et rejouables d’environ 45 à 60 minutes actives, à confirmer en playtests. Les chiffres de tuning ne sont pas des règles figées.

Chaque tâche a un identifiant stable, des dépendances et un critère observable. Une case ne passe à terminée qu’après implémentation et vérification réelle. En cas de changement de priorité, noter pourquoi ; ne pas supprimer les contraintes validées. Les phases sont des jalons, pas des estimations de dates.

| Phase | Livraison | Critère de sortie |
|---|---|---|
| 0 | Fondations techniques | Build statique et tests reproductibles |
| 1 | Prototype | Une carrière complète, choix, sauvegarde et bilan |
| 2 | Alpha | Carrières politiques divergentes, personnages et monde autonome |
| 3 | V1 | Systèmes satiriques complets, équilibre et publication possible |

## 2. Phase 0 — Initialisation technique

- [x] **P0-01 — Bootstrap.** Initialiser SvelteKit avec TypeScript strict, npm, Tailwind, Lucide, adapter-static ; choisir une version Node LTS, fixer `.nvmrc` et lockfile. Préserver les documents existants. Critère : installation propre et `npm run dev` affiche une page d’accueil.
- [x] **P0-02 — Qualité.** Configurer Vitest, lint, vérification Svelte/TS, Playwright et scripts de validation de contenu selon l’architecture. Créer un test de démarrage moteur et un smoke test navigateur. Critère : les scripts réellement configurés passent sur le squelette.
- [x] **P0-03 — Coque.** Mettre en place tokens CSS et layout desktop minimal, sans onglets factices ni données simulées présentées comme jouables. Critère : affichage lisible à 1280 × 720 et 1440 × 900, navigation clavier.
- [x] **P0-04 — Build et documentation.** Build prérendu dans `build/`, vérification par serveur statique, README des commandes, CI simple si dépôt adapté. Critère : le site ne nécessite aucun serveur Node en production et les commandes sont reproductibles.

- [x] **P0-05 — Hébergement GitHub Pages** (extension de phase 0 demandée le 24 novembre 2026). Base path configurable (sous-répertoire ou domaine personnalisé), chemins des ressources relatifs, workflow GitHub Actions de tests, build et déploiement manuel. Critère : build et E2E réussis à la racine et sous un sous-répertoire ; workflow valide ; aucun déploiement effectué sans validation.
- [x] **P0-06 — Dépôt GitHub et collaboration.** Dépôt public `BenCorb/la-republique-cest-moi` sur `main`, ignore et attributs Git, absence de secrets, conventions de branches et Conventional Commits, procédure de reprise Codex/Claude Code dans `AGENTS.md`, Pages configuré en source GitHub Actions et premier déploiement manuel. Critère : CI verte sur `main`, site accessible sur `https://bencorb.github.io/la-republique-cest-moi/` avec toutes ses ressources, dépôts local et distant synchronisés.

Dépendances : P0-01 précède les autres ; P0-02 et P0-03 peuvent être traitées séparément ; P0-05 dépend de P0-04 ; P0-06 dépend de P0-05. Ne pas ajouter de modèle de carrière complet, de contenu politique ou de backend à cette phase.

## 3. Phase 1 — Prototype jouable

| ID | Tâche | Dépendances | Critère d’acceptation |
|---|---|---|---|
| P1-01 ✅ | État, calendrier, seed, PRNG et commandes | P0 | Profil fixe de 25 ans, T1 2000 ; 4 tours = 1 an ; état sérialisable ; même seed et commandes reproduisent le même résultat |
| P1-02 ✅ | Catalogue d’actions, conditions et effets | P1-01 | Schéma validé ; temps trimestriel et coûts vérifiés ; preview pure ; plan rejeté sans modification |
| P1-03 ✅ | Économie, producteurs et améliorations | P1-02 | Budget politique séparé des finances personnelles ; charges explicites ; achat T produit en T+1 ; invariants testés |
| P1-04 ✅ | Santé, stress, vieillissement et fin | P1-03 | Effets du repos et de la charge testés ; décès et bilan atteignables ; aucune commande de tour après fin |
| P1-05 ✅ | Moteur d’événements | P1-04 | Tirage conditionnel, acteurs pertinents, choix, répétition et au moins une suite différée ; choix bloquant appliqué une seule fois |
| P1-06 ✅ | Premier catalogue narratif | P1-05 | 20–30 événements écrits et paramétrables ; aucun texte non résolu ; aucun choix sans issue ; validation automatisée |
| P1-07 ✅ | Sauvegarde locale | P1-05 | Enveloppe versionnée, reprise à l’identique y compris décision en attente, export/import et erreurs traitées ; pas de progression hors ligne |
| P1-08 ✅ | Interface jouable | P1-03 à 07 | Agenda, tableau de bord, producteurs simples, événements, journal et bilan accessibles ; coûts et erreurs lisibles |
| P1-09 ✅ | Accélération minimale et tests de scénarios | P1-08 | Tours multiples identiques aux tours unitaires ; arrêt sur choix/alerte/fin, annulation possible ; E2E complet |
| P1-10 ✅ | Simulateur et réglages initiaux | P1-09 | Exécution de lots seedés ; rapport JSON/CSV ; invariants et fins analysés ; playtest humain effectué et documenté |

### Contenu minimal

Actions de militantisme, rencontres, recrutement générique, organisation, repos et dépenses personnelles ; mandat simplifié si nécessaire. Les événements couvrent opportunités, revers, santé, dilemmes financiers et presse élémentaire sans dépendre des modules alpha/V1. La carrière honnête doit rester jouable. Aucun besoin de simuler la France entière pour ce jalon.

### Porte de sortie

- Le joueur crée une partie, prépare un trimestre, le valide, prend une décision, recharge la page, poursuit puis termine sa carrière.
- Le passage de tour respecte l’ordre de résolution de l’architecture ; le moteur ignore le temps réel et les previews.
- Aucun état incohérent ni choix bloquant perdu sur les scénarios testés. Une erreur de sauvegarde est visible.
- Les premiers essais identifient le rythme et les actions répétitives ; ajuster avant de passer à l’alpha. Ne pas conclure à la qualité d’une carrière uniquement d’après une simulation CPU.

## 4. Phase 2 — Alpha : le monde et la carrière

| ID | Tâche | Dépendances | Critère d’acceptation |
|---|---|---|---|
| P2-01 ✅ | Partis et contexte national | P1 | Paysage initial fixe, dirigeants variables, évolution autonome et événements nationaux conditionnels |
| P2-02 ✅ | Calendrier électoral et mandats | P2-01 | Échéances visibles, durée et incompatibilités vérifiées ; élections anticipées possibles via événement |
| P2-03 ✅ | Candidatures et campagne | P2-02 | Candidature libre sous conditions d’éligibilité ; arbitrage tôt/tard ; sondages, scrutin et échec non nécessairement terminal |
| P2-04 ✅ | Personnages nommés et relations | P2-01 | Acteurs persistants, traits partiellement cachés, vieillissement, départs et mémoire d’actes importants |
| P2-05 ✅ | Entourage et délégation | P2-04 | Recrutement sur postes clés ; missions persistantes, production et événements autonomes ; qualité des conseils variable |
| P2-06 ✅ | Adversaires récurrents | P2-03/04 | Un rival peut réapparaître, évoluer et changer de relation ; pas de personnage décédé candidat |
| P2-07 ✅ | Groupes de soutien | P2-03/04 | Soutiens électoraux distincts des appuis internes et économiques ; détail public sans fuite de traits cachés |
| P2-08 ✅ | Origines, professions, famille | P2-04 | Profils initiaux cohérents ; famille légère par statistiques, relations et événements ; âge fixe encore possible |
| P2-09 ✅ | Accélération complète et interface | P2-02 à 08 | Arrêt motivé sur événements ou échéances ; résumé des tours, onglets carrière/entourage et alertes utiles |
| P2-10 ✅ | Contenu et tests alpha | P2-09 | Plusieurs seeds et stratégies donnent des trajectoires distinctes ; cumul légal selon les règles du jeu ; sauvegardes migrées ou explicitement refusées |

Éviter un système de simulation individuelle de tous les électeurs ou un moteur d’IA autonome. Les personnages et le monde évoluent via règles, traits et événements. Les valeurs de départ, poids électoraux et fréquences restent calibrables dans le contenu.

### 4.1 Préparation de la mise en œuvre (24 novembre 2026)

Cette section est un plan de travail. **Décisions du créateur (24 novembre 2026) :** branche de phase unique `feat/p2-alpha` (`AGENTS.md`) ; partis et axes satiriques proches du paysage français (catalogue et axes reportés dans le GDD §3.2 et §8.1) ; pour le reste, le créateur délègue les choix : les propositions ci-dessous sont **retenues comme hypothèses provisoires**, chiffres modifiables à l’équilibrage. En particulier : sauvegardes conservées en version 1 pendant l’alpha avec refus explicite des sauvegardes de développement incompatibles ; noyau de P2-07 (groupes et popularité) avancé avant P2-03 ; mandats, groupes, taille de l’entourage et profils selon les propositions de lots C, E et F.

**Constats de départ.** Le moteur du prototype ne connaît qu’un joueur (santé, stress, ressources), des améliorations, des événements et une distribution d’acteurs figée (`cast.json`, sans âge ni relation). `GameState` n’a ni monde, ni personnages, ni mandats, ni élections ; les conditions lisent un registre fermé de statistiques (`STAT_IDS`) et les effets ne touchent que ressources et jauges. La phase 2 étend donc d’abord le modèle d’état, puis branche chaque système sur l’ordre de tour existant (ARCHITECTURE §5.1, étapes 3 à 6), sans résolution parallèle.

**Préalables techniques (avant ou au début de P2-01), sans nouvel identifiant de tâche :**

1. **Politique de version de sauvegarde** (§15.1 de l’architecture, décision attendue). Proposition : aucune version jouable n’étant publiée, garder `STATE_SCHEMA_VERSION = SAVE_VERSION = 1` pendant l’alpha et refuser explicitement les sauvegardes de développement incompatibles ; incrémenter avec migration testée dès le premier déploiement public. P2-10 vérifie l’une ou l’autre voie.
2. **Extensibilité du contenu** : registres typés de statistiques et d’effets étendus par module (monde, personnages, carrière) avec `switch` exhaustif, sans chemin arbitraire vers l’état ; conditions portant sur un acteur (`actor.<rôle>.<stat>`) pour les événements à personnages.
3. **Dette à solder avant P2-04** : attribution des acteurs gloutonne (§15.3) — soldée en P2-04 ; reste à structurer les codes d’invariants plutôt que des fragments de texte.
4. **Simulateur** : ajouter au rapport mandats, élections, partis et entourage au fur et à mesure (aujourd’hui déclarés « indisponibles ») ; chaque tâche alimente ses propres métriques.
5. **Environnement** : déplacer le dépôt hors d’iCloud (§15.4) ; des copies « 2 » existent encore dans `build/`, `test-results/`, `.svelte-kit/` et `.git/index 2`.

**Ordre recommandé** (respecte les dépendances du tableau, avec un ajustement retenu) :

| Lot | Tâches | Contenu livré | Remarque |
|---|---|---|---|
| A — Monde | P2-01 | `world` dans l’état : partis (catalogue fixe, dirigeants tirés), indicateurs nationaux bornés, affiliation du joueur, événements nationaux conditionnels | Rend effective l’action « rejoindre le parti » (limite §15.2) |
| B — Personnages | P2-04 | Modèle `Character` commun, traits réels/connus, vieillissement et départs, mémoire d’actes ; migration de `cast.json` vers ce modèle | Peut démarrer dès P2-01 commencé, mais pas sur les mêmes fichiers en parallèle |
| C — Carrière | P2-02, **P2-07 minimal**, P2-03 | Calendrier électoral, mandats, cumul ; groupes de soutien et popularité dérivée ; candidatures, campagne, sondages, scrutin | Retenu : le scrutin de P2-03 a besoin du soutien électoral, le noyau de P2-07 (groupes et popularité) passe avant P2-03 ; son détail UI reste après |
| D — Rivaux | P2-06 | Adversaires récurrents issus du modèle commun, revalidés à chaque scrutin | |
| E — Entourage | P2-05 | Postes clés, recrutement à information partielle, missions persistantes, conseil de qualité variable | Plus coûteux en UI ; nouveaux producteurs actifs en T+1 |
| F — Création | P2-08 | Origine, profession, famille légère ; âge toujours fixé à 25 ans | Écran de création alpha |
| G — Intégration | P2-09, P2-10 | Accélération complète, onglets Carrière/Entourage, alertes d’échéance ; contenu alpha, lots par stratégie, sauvegardes | P2-09 peut reprendre la dette UX du playtest (plan conservé après « Trimestre suivant ») si le créateur l’avance de P3-08 |

**Décisions de contenu par lot** (hypothèses retenues par délégation, chiffres provisoires) :

- *Lot A* — Huit partis fictifs (GDD §8.1) ; trois axes : économie, société, souveraineté (GDD §3.2), non affichés en chiffres ; indicateurs nationaux : situation économique, climat social, stabilité gouvernementale.
- *Lot C* — Liste des mandats alpha (proposition : conseiller municipal, maire, conseiller régional, député, sénateur ; responsabilités de parti à part ; ministre seulement par nomination événementielle) ; durées et cycles fictifs fixes ; règles de cumul ; éligibilité (âge, affiliation ou investiture, ressources) ; modèle de scrutin (proposition : un tour simplifié, score = soutien des groupes pondéré + poids du parti + préparation + contexte + bruit borné, testé en sensibilité) ; groupes (proposition GDD §4.4 : 3 électoraux, 3 d’influence).
- *Lot E* — Taille maximale de l’entourage et nombre d’acteurs simulés activement (proposition : 5 postes, une trentaine de personnages nommés au plus).
- *Lot F* — Nombre de profils d’origine et de professions (proposition : 4 origines × 6 professions, combinaisons limitées et sans avantage net).

**Organisation Git.** Branche de phase `feat/p2-alpha`, un commit par tâche (`Refs: P2-0x`), une PR unique vers `main` en fin de phase (`AGENTS.md`).

## 5. Phase 3 — V1 : profondeur et finition

| ID | Tâche | Dépendances | Critère d’acceptation |
|---|---|---|---|
| P3-01 ✅ | Justice et dossiers | P2 | Plusieurs affaires possibles, étapes et délais cohérents, conséquences sur carrière, finances et santé ; condamnation terminale selon règles |
| P3-02 ✅ | Patrimoine et confort | P2 | Achat d’actifs, coûts, revenus passifs, valeur nette distincte des liquidités ; choix de confort et risques |
| P3-03 ✅ | Médias et relations | P2, P3-02 | Médias fictifs différenciés, fil de presse dynamique, acquisition d’actifs médiatiques et conséquences narratives |
| P3-04 ✅ | Promesses et gouvernement | P2 | Promesses suivies, dilemmes simples, décisions tenues/trahies ayant des effets différés ; aucun simulateur macroéconomique |
| P3-05 ✅ | Institutions modifiables | P3-01/04 | Réformes limitées aux fonctions autorisées, règles persistantes, activation à date fixe, conséquences aussi pour adversaires |
| P3-06 ✖ | Âges de départ et passé | P2-08 | **Abandonnée** (décision du créateur, 26 novembre 2026) : âge de départ fixe à 25 ans ; la création repose sur l’origine sociale, le terrain d’engagement (P3-17) et le territoire (P3-16) |
| P3-07 ✅ | Époques, chaînes et contenu | P3-01 à 06 | Événements et technologies disponibles selon dates ; références fictives ; répétitions contrôlées ; catalogue enrichi et validé |
| P3-08 ✅ | Interface et bilan définitifs V1 | P3-07 | Interface allégée et plus graphique ; plan cohérent entre avance manuelle et accélération ; écrans intégrés, nécrologies diversifiées, distinctions fondées sur historique, pas de sous-système de prestige |
| P3-09 | Équilibrage et tests | P3-08, puis P3-11 à P3-25 (§5.2) | Lots de simulations par stratégie, playtests, corrections documentées ; cible de durée évaluée ; aucune anomalie critique connue |
| P3-10 | Livraison statique | P3-09 (second volet, §5.2) | Build, vérification locale et sous-chemin GitHub Pages ; procédure de déploiement/rollback (workflow manuel) éprouvée ; publication seulement sur demande |

### 5.1 Préparation de la mise en œuvre (25 novembre 2026)

Plan de travail **validé par le créateur le 25 novembre 2026** (voir « Décisions du créateur » ci-dessous). Les chiffres restent des hypothèses de départ, modifiables à l’équilibrage. Les corrections de l’alpha (mairie, budget, agenda) sont intégrées ; P3-01 peut commencer pendant la reprise du playtest (`PLAYTEST.md`), dont les retours sont intégrés au fil de l’eau.

**Constats de départ.** L’alpha simule déjà la carrière, le monde, les personnages, l’entourage et la famille ; les choix opportunistes existent dans les événements mais ne laissent aucune trace exploitable. Il manque les jauges d’exposition médiatique et de risque judiciaire (GDD §4.2), un compteur de fonds détournés pour le bilan (GDD §12), les actifs personnels et un coût de la vie (GDD §17). L’état grossit à chaque tâche : la projection recalculée en entier et la sauvegarde relue à chaque écriture (ARCHITECTURE §15.3) sont à surveiller.

**Préalables techniques (au début de P3-01, sans nouvel identifiant de tâche) :**

1. **Registre des faits** : un acte douteux (emploi fictif, financement occulte, favoritisme…) crée un fait daté, avec ses protagonistes et sa gravité. La justice (P3-01), la presse (P3-03) et le bilan s’appuient sur ce même registre, au lieu de tirages indépendants. Les choix opportunistes existants sont rattachés à des faits.
2. **Jauges** : exposition médiatique et risque judiciaire, bornées et expliquées, sans jauge morale (AGENTS.md).
3. **Sauvegardes** : l’alpha est jetable ; le format reste en version 1 et toute sauvegarde devenue illisible est refusée (`outdated_rules`). Les migrations commencent avec la première version à conserver (au plus tard P3-10).
4. **Performance** : mesurer la projection et l’écriture de sauvegarde sur une carrière longue avant d’ajouter les modules ; mémoriser le journal si nécessaire.

**Ordre recommandé** (respecte les dépendances du tableau) :

| Lot | Tâches | Contenu livré | Remarque |
| --- | --- | --- | --- |
| A — Faits et justice | P3-01 | Registre des faits, risque judiciaire, dossiers à étapes (révélation, enquête, mise en examen, procès, jugement, appel), défense, sanctions | Cœur satirique de la V1 ; réutilise le poste « Affaires juridiques » |
| B — Patrimoine | P3-02 | Actifs personnels, revenus passifs, valeur nette, train de vie et coût de la vie | Tranche la question ouverte du coût de la vie |
| C — Promesses | P3-04 | Promesses de campagne, registre et états, dilemmes une fois élu, rappels différés | S’appuie sur les campagnes de P2-03 |
| D — Médias | P3-03 | Médias fictifs différenciés, fil de presse fondé sur les faits et promesses, exposition, rachat d’un média | Après B (actifs) et C (promesses à rappeler) |
| E — Institutions | P3-05 | Réformes paramétrées, activation à date fixe, effets pour tous les acteurs | Après A et C |
| F — Profils | P3-06 | Âges de départ et passé cohérent | Abandonné le 26 novembre 2026 (§5.2) |
| G — Contenu et finition | P3-07 à P3-10 | Époques, chaînes, interface définitive, équilibrage, livraison | P3-08 reprend les retouches d’interface reportées (épinglage du plan, densité de texte) |

**Contenu par lot** (validé le 25 novembre 2026, chiffres provisoires) :

- *Lot A* — Cinq types d’affaires fictives : emplois fictifs, financement occulte de campagne, favoritisme dans un marché public, prise illégale d’intérêts, abus de biens sociaux ; plusieurs dossiers simultanés, dont ceux de l’entourage. Délais de 2 à 8 trimestres par étape. Sanctions : amende, inéligibilité de 1 à 10 ans, prison avec sursis, prison ferme ; seule une condamnation ferme grave met fin à la carrière. Défense : temps, argent, conseil juridique, choix de communication. Culpabilité et enquête restent des états distincts.
- *Lot B* — Six actifs : appartement en ville, résidence secondaire, portefeuille boursier, parts de PME, vignoble, et un média local (activé par P3-03). Trois niveaux de train de vie (modeste, confortable, fastueux) qui coûtent chaque trimestre et agissent sur le stress et la santé.
- *Lot C* — Huit promesses types liées aux élections (fiscalité, sécurité, écologie, services publics, institutions…), avec les états annoncée, en cours, tenue, partiellement tenue et abandonnée, et des effets sur les soutiens des groupes concernés.
- *Lot D* — Cinq médias fictifs (quotidien de référence, quotidien populaire, chaîne d’information continue, hebdomadaire satirique, presse régionale existante : Courrier du Bocage, Radio Bocage FM), avec ligne éditoriale, audience et relation au joueur ; une acquisition possible, sans contrôle de toute la presse.
- *Lot E* — Cinq paramètres réformables : plafond du cumul, indépendance de la justice, transparence financière, mode de scrutin, liberté de la presse.
- *Lot F* — Trois familles d’âge de départ (18–25, 30–45, 50–65 ans) avec bagage et horizon de vie contrastés. *Abandonné le 26 novembre 2026 (§5.2).*

**Décisions du créateur (25 novembre 2026) :**

1. **Ordre et contenu** : ordre des lots A → B → C → D → E → G retenu, le lot F n’étant avancé que si le playtest le demande ; propositions de contenu validées telles quelles, à amender lot par lot si besoin.
2. **Organisation Git** : une branche courte et une pull request par tâche depuis `main` (par exemple `feat/p3-01-justice`), CI verte obligatoire, fusion « squash » ; pas de branche de phase (AGENTS.md).
3. **Satire judiciaire** : ton mordant et grinçant, entièrement fictif (affaires, noms, médias), sans personne réelle identifiable (GDD §8.1). La justice reste crédible : relaxe comme condamnation sont possibles, et l’impunité n’est jamais garantie.
4. **Coût de la vie** : traité dans P3-02, avec le patrimoine.
5. **Budget politique** : les deux défauts restants (débordement des carrières élues, surtout par l’Assemblée ; recrutements rendus impayables par des pics de budget, ARCHITECTURE §8.3 duodecies) sont traités à l’équilibrage de P3-09. *Traités au premier volet de P3-09 (ARCHITECTURE §8.4 undecies).*
6. **Playtest** : P3-01 commence sans attendre la fin de la reprise du playtest de l’alpha.

### 5.2 Corrections et compléments du playtest P3-09 (26 novembre 2026)

Plan établi à partir des seize retours PT-P3-09-001 à 016 de `PLAYTEST.md`, complété par la refonte visuelle demandée par le créateur (P3-26, P3-27). Il s’insère entre le premier volet de P3-09 (fait) et la livraison P3-10. Chiffres provisoires, à éprouver par simulation puis au playtest. Une branche et une pull request par tâche (`feat/p3-11-agenda-ponctuel`…, pied `Refs: P3-11`), conformément à la règle de la phase 3.

**Décisions du créateur (26 novembre 2026) :**

1. **Périmètre V1** : les cinq nouveaux systèmes (territoire et presse régionale, recrutement, militants, montée en échelle des actions, contenu) entrent en V1, chacun dans sa première tranche verticale. Les extensions listées plus bas passent après la V1. Exception : le recrutement est livré en entier (point 3).
2. **Création (PT-001)** : refonte. La « Profession avant la politique » est remplacée par un **terrain d’engagement** (syndical, associatif, étudiant, service public, entreprise, presse), centré sur ce qui mène à la politique. Les actions de métier et effets de départ sont revus en conséquence ; `GAME_DESIGN.md` §3.1 porte déjà la décision, les valeurs y seront consignées dans la tâche.
3. **Recrutement (PT-004 à 006)** : version complète en V1 : salaire contractuel, attractivité, acceptation et négociation, recherche à trois niveaux, vérification de dossier, progression des juniors et renégociations.
4. **Géographie (PT-002/003)** : les 13 régions métropolitaines actuelles (millésime figé du COG Insee), un quotidien régional fictif par région. Anachronisme assumé pour une France alternative qui débute en 2000 ; outre-mer exclu de la V1.
5. **Âge de départ** : le choix de l’âge (P3-06) est abandonné ; l’âge reste fixe à 25 ans, avec origine sociale, terrain d’engagement et territoire.
6. **Direction visuelle** : refonte pour un aspect plus ludique et moins « tableur » avant la V1, limitée aux icônes, barres, pastilles, couleurs et mise en page ; pas d’illustrations dessinées ni d’éléments très interactifs (étude : `DESIGN.md` §10).

**Décisions déléguées (prises pour ce plan, révisables) :**

- *Agenda (PT-007, 011)* : marqueur explicite `pinned: true`, absent par défaut (brouillon non sauvegardé, sans migration). Retraits automatiques signalés par une notice groupée non bloquante dans le plan et une ligne du journal. L’accélération ne s’arrête plus pour `invalid_plan` ; elle s’arrête si le plan, non vide au départ, devient entièrement vide.
- *Infractions (PT-009)* : table moteur des capacités exigées par infraction (financement occulte → activité politique ; favoritisme → pouvoir local sur permis, marché ou subvention ; prise illégale d’intérêts → fonction décisionnelle ; emploi fictif → embauche réelle ; abus de biens sociaux → organisation dotée de fonds). Le moteur refuse un `recordFact` sans capacité ; validation statique et tests de scénario pour chaque choix concerné. « Un petit service » : variante mairie (favoritisme) ou, sans levier, variante « mise en relation » sans infraction qui solde la dette. Pas de trafic d’influence en V1.
- *Poste pour la famille (PT-008)* : poste vacant prioritaire, dans l’ordre du catalogue des postes ; si tout est occupé, option explicite de remplacement du titulaire ; « sélection ouverte » ajoute le proche comme candidat réel.
- *Plan permanent (PT-012)* : colonne droite = carnet du trimestre, puis alertes, puis un seul titre de presse avec lien vers Actualités. « Modifier le plan » ouvre un panneau latéral superposé (ordre, épingles, prévisions, ajout générique par recherche dans le catalogue groupé). Sous 1 100 px, bouton persistant « Plan · n activités · x/40 » au-dessus de la barre d’avance.
- *Retour immédiat (PT-015)* : le résultat d’un choix s’affiche dans la même modale (au plus trois phrases de récit, puis cinq variations au plus avant « Détail ») ; la note de cabinet est une modale centrale (date en grand, une phrase d’ouverture, trois paragraphes courts au plus). Texte de repli généré depuis le journal pour les choix mineurs.
- *Territoire (PT-002)* : région choisie, département attribué par la seed, commune fictive générée à partir de fragments toponymiques validés par région ; tailles bourg, petite ville ou ville moyenne au départ ; deux ou trois traits. Pas de départementales, de déménagement ni de parachutage en V1.
- *Presse (PT-003)* : rôle stable `regional_anchor` résolu vers le titre de la région ; le Courrier du Bocage devient le titre d’une région (Normandie). Le rachat porte sur son propre titre régional. Presse nationale : suit à partir d’une candidature législative, d’un mandat national ou du seuil d’exposition existant.
- *Recrutement (PT-004 à 006)* : salaire = référence du poste × facteur de compétence (≈ 0,5 à 20, ≈ 1,3 à 60, ≈ 2,5 à 90 ; formule provisoire). Trois offres : réduite (− 20 %), standard, généreuse (+ 25 %). Attractivité = influence, popularité, rang du mandat principal, appui de l’appareil, trimestres de masse salariale couverts ; experts rares mais pas interdits en début de carrière. Refus : candidat retiré de la présélection, prime non débitée, temps d’entretien perdu. Recherche payée sur le budget politique, délai en trimestres (1 à 3) plus un temps d’agenda, résultats ajoutés à la présélection (5 candidats au plus), échec possible avec perte de la moitié du coût. Juniors : progression par ancienneté et missions ; renégociation à chaque palier de 15 points, au plus une fois par an et par collaborateur.
- *Promesses (PT-010)* : chaque thème a une variante par scrutin où un levier existe ; au moins quatre promesses par type de scrutin. Le joueur choisit explicitement la campagne destinataire. Mandats non exécutifs : engagement « porter / voter », réalisation partielle possible.
- *Échelle des actions (PT-013)* : trois formats discrets (modeste, soutenu, majeur) sous une seule ligne d’agenda, rendements décroissants. Première famille : don personnel (500 / 3 000 / 15 000 € avec plafond annuel) et avance de campagne remboursable ; puis collecte et meeting. Les formats supérieurs exigent un palier militant ou un collaborateur.
- *Militants (PT-014)* : effectif entier stocké, paliers affichés (noyau, comité, section, réseau régional, organisation nationale). Suppression de `organization.volunteer` ; la permanence devient capacité d’accueil et de rétention. Bonus de palier au tractage, au porte-à-porte et à la collecte ; besoin de mobilisation par scrutin intégré au score, jamais à l’éligibilité ; l’investiture prête une part de la machine du parti. Cotisations et charges logistiques légères incluses ; délégation et événements de grande organisation dans la vague de contenu.
- *Contenu (PT-016)* : priorité au contenu quotidien, puis aux textes de conséquence, puis aux chaînes et événements uniques. Cibles : au moins huit événements éligibles dans chaque état courant de la matrice ; au moins trois titres par combinaison sujet × tonalité × famille de média accessible ; pioche sans remise ; une scène très reconnaissable au plus deux fois par carrière. Rédaction par lots par l’assistant, relecture du ton par le créateur.

**Tâches, par priorité :**

| Prio | ID | Tâche | Retours | Dépend de | Taille | Critère d’acceptation |
|---|---|---|---|---|---|---|
| 1 | P3-11 ✅ | Agenda ponctuel par défaut et retrait automatique | 007, 011 | — | M | Ajout jamais épinglé ; reconduction des seules épingles ; retraits en cascade et occurrences partielles ; notice et journal ; même règle en manuel et accéléré ; arrêt sur plan devenu vide ; `DESIGN`/`ARCHITECTURE` alignés |
| 1 | P3-12 ✅ | Cohérence des affaires et embauche familiale | 008, 009 | — | M | Table de capacités et garde moteur ; audit de tous les `recordFact` (dont `gala_table`) ; suites réévaluées à échéance ; le proche recruté est un vrai collaborateur, productif à T+1, jamais embauché deux fois après reprise |
| 2 | P3-26 ✅ | Direction visuelle et composants | — | — | M | Maquette de l’agenda et du tableau de bord validée par le créateur ; table d’identité des ressources (icône, couleur, libellé) ; composants de `DESIGN.md` §10.5 ; en-tête, agenda, tableau de bord et alertes passés au nouveau style ; contrastes AA, `prefers-reduced-motion`, aucune fuite d’information cachée |
| 2 | P3-13 ✅ | Plan permanent dans la coque | 012 | P3-11, P3-26 | M | Carnet présent dans tous les onglets ; panneau sans perte d’onglet ni de défilement ; état étroit ; verrouillage pendant l’accélération ; e2e |
| 2 | P3-14 ✅ | Résultat des décisions et note de trimestre | 015 | P3-11, P3-26 | M | Effets réels (aléas compris) sans fuite d’informations cachées ; décisions enchaînées ; note après trimestre manuel, note de période après accélération ; réouverture ; pas de rejeu après reprise ; champ `outcome` déclaratif au catalogue |
| 2 | P3-15 ✅ | Anti-répétition et instrumentation du contenu | 016 | — | S | Mémoire sérialisée des titres, pioche sans remise, délai thématique, plafonds par événement ; rapport de couverture et de répétitions en simulation ; validation des pools trop petits |
| — | Playtest B1 | Court playtest de contrôle | — | P3-11 à 15, P3-26 | — | Agenda, carnet, retours et nouveau style jugés satisfaisants ; corrections mineures avant le lot suivant |
| 2 | P3-28 ✅ | Effets des événements dans la note | B1-003 | P3-14 | S | Pastilles des effets propres à chaque événement cité (ressources, jauges, soutiens), détail repliable, identiques après reprise ; aucune variation d’une autre source |
| 2 | P3-31 ✅ | Issue du recrutement dans la note | B1-005 | P3-14, P3-20 | S | La note de cabinet du trimestre suivant annonce l’embauche (poste, salaire) ou le refus du candidat, sans remplacer le journal ; rien de répété au trimestre d’après |
| 2 | P3-32 ✅ | Leviers de la base militante | B1-006 | P3-19 | S | Chaque local annonce sa capacité d’accueil et sa rétention, actives au trimestre suivant ; le panneau « Base militante » explique en langage de jeu ce qui fait venir ou partir les militants, sans formule ; aucune information cachée révélée |
| 3 | P3-29 ✅ | Scrutins réalistes et procès-verbal commun | B1-001 | P3-16 | L | Plusieurs candidatures ou listes par scrutin, toutes dans le calcul ; deux tours, seuils, fusions et désistements, prime majoritaire et plus forte moyenne selon le scrutin (décisions ci-dessous) ; décision du joueur entre les tours ; colistier ou tête de liste ; sièges d’opposition ; procès-verbal sérialisé (tours, parts à 100 %, sièges, élus) lu par la note, le journal, la presse et le bilan ; même présentation avec ou sans le joueur ; rien de révélé avant le scrutin ; taille de sauvegarde mesurée |
| 3 | P3-30 | Investiture nationale | B1-002 | P3-29 | M | Décisions du créateur prises (27 novembre 2026, ci-dessous) ; demande d’investiture aux législatives et sénatoriales, appréciation sans seuil caché, résolution unique et seedée, refus motivé ouvrant retrait ou dissidence ; aucune campagne sous étiquette sans accord |
| 3 | P3-33 | Contre-proposition d’un candidat | B1-004 | P3-21 | S | Un candidat qui refuse annonce le salaire qu’il accepterait et reste présélectionné un trimestre ; l’offre à ce montant est acceptée à coup sûr ; sans réponse ou après un second refus, il part ; résolution unique après reprise |
| 3 | P3-34 | Carrière partisane | B1-007 | P3-30 | L | Statuts Militant, Cadre du parti, Chef du parti sérialisés ; promotion de cadre par opportunité selon appareil et militants ; candidature à la direction au congrès, résolution seedée avec trois postures et appréciation préalable sans seuil ; un chef remplace les renouvellements autonomes et accède mieux aux investitures ; défaite avec délai avant nouvelle tentative ; pas de scission en V1 |
| 3 | P3-35 | Gouvernement : portefeuilles ministériels | audit B1 | P3-29 | L | Président fictif généré par le monde, qui nomme le Premier ministre de la majorité issue des législatives ; secrétaire d’État puis 6 à 8 portefeuilles typés, chacun avec 2 ou 3 actions, des événements et crises propres et des effets sur des groupes ; nomination selon la stature ; remaniements ; cohabitation possible ; fin avec le gouvernement |
| 3 | P3-36 | Matignon : Premier ministre | audit B1 | P3-35 | L | Nomination du joueur comme Premier ministre, sommet de carrière de la V1 ; composition et remaniement du gouvernement, arbitrages, recours au 49.3, motion de censure, crises nationales, démission ou renvoi ; effets sur la stabilité, l’appareil et les soutiens ; bilan qui le distingue |
| 3 | P3-37 | Fin de carrière choisie | audit A2 | — | S | Action « Se retirer de la vie politique » confirmée, qui démissionne de tout et mène au bilan avec une nécrologie ou un article adaptés ; impossible pendant un choix bloquant ; résolution unique après reprise |
| 3 | P3-38 | Ambition de départ | audit B6 | — | S | Ambition facultative choisie à la création (par exemple maire à vie, ministre, Matignon, fortune, mains propres) ; affichée au dossier, saluée par la note quand elle est atteinte, jugée au bilan (atteinte, manquée, trahie) ; aucun bonus |
| 3 | P3-39 | Débouchés de l’argent | audit B5 | P3-23 | M | Collecte et meeting en trois formats (P3-23) ; mécénat ou fondation ; rachat d’un média élargi ; simulation : part de fortune dépensée en fin de carrière en hausse, sans stratégie dominante |
| 3 | P3-16 ✅ | Territoire d’origine | 002 | — | L | `region`, `department`, `homeTown` sérialisés ; 13 régions ; générateur de communes seedé et validé ; noms visibles en campagne, mandat, presse et bilan ; effets légers de taille et de traits validés par simulation |
| 3 | P3-17 ✅ | Terrain d’engagement | 001 | P3-16 | M | Six terrains, effets et actions propres ; création réécrite ; GDD mis à jour ; tests de création |
| 3 | P3-18 ✅ | Presse régionale | 003 | P3-16 | M | 13 titres ; rôle `regional_anchor` ; accès des médias selon territoire, exposition et mandat ; événements et rachat migrés ; couverture croisée simple |
| 3 | P3-19 ✅ | Militants organiques | 014 | — | L | Effectif, croissance et attrition ; paliers ; permanence en capacité ; bonus terrain annoncé en prévision ; mobilisation dans le score, régionales d’abord ; candidature perdue utile ; pas d’emballement en simulation |
| 3 | P3-20 ✅ | Recrutement I : salaire, attractivité, acceptation | 005, 006 | P3-12 | L | Salaire contractuel dans réserve, paie, alertes et projections ; vivier gradué ; intérêt estimé ; trois offres et leviers ; refus déterministe sans prime débitée |
| 3 | P3-21 ✅ | Recrutement II : recherche, vérification, progression | 004, 005, 006 | P3-20 | L | Recherche à trois niveaux avec échéance sauvegardée et résolution unique ; vérification sans révéler de trait caché certain ; progression des juniors et renégociations |
| 3 | P3-22 ✅ | Promesses contextualisées | 010 | P3-16 | M | Variantes par scrutin, campagne choisie explicitement, territoire cité, levier institutionnel vérifié ; rappels selon contexte |
| 3 | P3-23 ✅ | Montée en échelle des actions | 013 | P3-19, P3-20 | M | Trois formats pour la première famille ; prérequis de capacité ; rendements décroissants ; simulation : part de fortune dépensée, coût marginal de l’influence, actions de début encore choisies |
| — | Playtest B2 ✅ | Playtest des systèmes | — | P3-16 à 23 | — | Clos de façon partielle par le créateur (27 novembre 2026) : systèmes jugés fonctionnels sur une carrière ; points à observer reportés au playtest de P3-09 |
| 4 | P3-24 | Contenu, vague 1 : quotidien et conséquences | 015, 016, B2-002, audit A3, A4, A6 | P3-14 à 23, P3-35 | L | Matrice de couverture remplie pour les états courants ; 15 à 20 actions contextuelles (mandat, territoire, actualité, campagne, entourage), dont au moins deux par fonction, et variété des choix par trimestre contrôlée en simulation ; choix opportunistes liés aux fonctions, affaires présentes dans une carrière sur deux environ en simulation ; interviews et demandes d’augmentation moins répétitives, titres jamais utilisés atteints ; textes de résultat pour les choix importants ; presse diversifiée par média et par région |
| 4 | P3-25 | Contenu, vague 2 : chaînes et uniques | 016 | P3-24 | L | Chaînes à personnages récurrents, événements uniques par fonction ; événements de croissance militante et d’équipe |
| 4 | P3-40 | Premiers pas guidés | audit A1 | P3-24 | M | Carte « Premiers pas » de 4 à 6 objectifs successifs dans une vraie carrière (adhérer ou rester indépendant, réunir un noyau militant, préparer les municipales…), bulles d’aide sur les écrans concernés ; masquable, réactivable depuis l’accueil ; sans effet de jeu ; e2e |
| 4 | P3-41 | Carnet des carrières | audit B2 | — | S | Archive locale des carrières terminées (nécrologie, plus haute fonction, ambition, distinctions, seed) et liste des distinctions déjà obtenues ; affichage seul, sans bonus ni déblocage ; supprimable ; jamais mêlée à la sauvegarde en cours |
| 4 | P3-42 | Partage entre amis | audit B3, B4 | P3-41 | S | Seed affichée au bilan et bouton « Rejouer cette partie » ; bouton « Exporter un retour » qui télécharge la sauvegarde et une note libre ; aucun serveur |
| 4 | P3-27 | Cohérence visuelle finale | — | P3-25 | S | Écrans restants (journal, monde politique, relations, patrimoine, justice, bilan) au style de P3-26 ; critères de `DESIGN.md` §10.9 vérifiés |
| 5 | P3-09 | Équilibrage, second volet et chronométrage | audit A5 | P3-25, P3-27 | M | Lots de 500 carrières rejoués ; épuisement de la stratégie ambitieuse revu ; durée typique de 60 à 90 minutes ; arrêts d’accélération inutiles réduits ; promesses abandonnées revues ; aucune stratégie dominante ; playtest chronométré final (protocole `PLAYTEST.md`) ; aucune anomalie critique |
| 5 | P3-10 | Livraison statique | audit A7 | P3-09 | S | Premier format de sauvegarde conservé et migrations ; message `<noscript>` ; seed documentée ; mise en page vérifiée à 1 100 px ; taille d’une longue sauvegarde sous la moitié du quota ; limites connues d’`ARCHITECTURE.md` §15 à jour |

Les écrans créés par P3-13 à P3-23 utilisent d’emblée les composants de P3-26. Les tâches de même priorité sans dépendance entre elles et sans fichiers communs peuvent avancer en parallèle sur des branches distinctes (par exemple P3-11 et P3-12, puis P3-16 et P3-19). Chaque tâche qui change l’état incrémente la version des règles ; les sauvegardes de l’alpha restent refusées comme obsolètes jusqu’à P3-10.

**Rush V1 (27 novembre 2026) :** le créateur fait aboutir les tâches restantes (P3-29, P3-30, P3-33 à P3-42, P3-24, P3-25, P3-27, puis P3-09 et P3-10) sur une branche unique, sans playtest intermédiaire (`AGENTS.md`). Le playtest B2 a donné PT-B2-001 (corrigé) et PT-B2-002 (actions contextuelles, à rattacher à P3-24).

**Décisions du créateur en début de rush (27 novembre 2026) :**

- *Investiture nationale (PT-B1-002, P3-30)* : aux législatives et sénatoriales, un joueur affilié demande l’investiture (action de 5 points de temps). Appréciation affichée « candidature soutenue », « investiture disputée » ou « peu probable », avec ses facteurs observables (appareil, influence, mandats, ancrage, popularité, candidat mieux placé), sans seuil chiffré. Décision seedée, résolue une seule fois ; refus motivé, puis choix entre renoncer et une candidature dissidente sans étiquette ni moyens du parti, avec baisse de l’appui de l’appareil. Municipales et régionales inchangées pour la V1.
- *Contre-proposition (PT-B1-004, P3-33)* : un candidat qui refuse annonce le salaire qu’il accepterait et reste dans la présélection un trimestre ; une offre à ce montant est acceptée à coup sûr ; sans réponse ou après un second refus, il part définitivement.
- *Carrière partisane (PT-B1-007, P3-34)* : noyau sans scission. Trois statuts (Militant, Cadre du parti, Chef du parti), promotion par opportunité, candidature à la direction lors d’un congrès avec trois postures (rassemblement, appareil, rupture), résolution seedée ; le chef accède mieux aux investitures et arbitre par quelques événements. Scission et création de parti après la V1.
- *Actions contextuelles (PT-B2-002)* : intégrées à P3-24, quinze à vingt actions liées au mandat, au territoire, à l’actualité, à une campagne ou à l’entourage.

- *Audit (27 novembre 2026, `AUDIT_V1.md`)* : toutes les recommandations jugées indispensables ou souhaitables entrent dans le rush (P3-35 à P3-42, critères ajoutés à P3-24, P3-09 et P3-10).
- *Sommet de carrière* : Premier ministre au plus en V1, avec des ministères typés. Un président fictif, généré et réélu par le monde sans élection jouable, nomme le Premier ministre dans la majorité issue des législatives ; cohabitation possible. La présidentielle fera l’objet d’une mise à jour après la V1, avec ses mécaniques propres.
- *Scrutins réalistes (P3-29)* : toutes les candidatures comptent dans le calcul, inspiré des règles françaises (vérifiées le 27 novembre 2026, sources dans `AUDIT_V1.md`), simplifiées sans les trahir :
  - municipales, scrutin de liste dans toutes les communes : au premier tour, une liste majoritaire l’emporte ; sinon second tour entre les listes d’au moins 10 %, fusion possible pour celles d’au moins 5 %. La liste en tête reçoit la moitié des sièges, l’autre moitié est répartie à la plus forte moyenne entre les listes d’au moins 5 %, prime comprise. Le conseil élit le maire, normalement la tête de la liste majoritaire ;
  - régionales : même principe, prime de 25 % des sièges, seuils de 10 % (maintien) et 5 % (fusion et répartition), une seule circonscription régionale (sans sections départementales en V1) ;
  - législatives : scrutin uninominal à deux tours ; élu au premier tour avec la majorité absolue et au moins 25 % des inscrits ; second tour ouvert aux candidats d’au moins 12,5 % des inscrits (participation simulée) ou aux deux premiers ;
  - sénatoriales : grands électeurs, surtout des élus locaux ; proportionnelle si le département élit au moins trois sénateurs, sinon majoritaire à deux tours ;
  - entre les deux tours, le joueur qualifié ou fusionnable décide : se maintenir, fusionner (places et soutiens négociés) ou se désister ; les autres listes suivent leurs affinités ; les deux tours se jouent dans le même trimestre ;
  - scrutins de liste : le joueur conduit sa liste ou demande une place sur celle d’un parti ou d’un sortant ; son rang dépend de l’appareil et de l’influence et décide de son élection ; une liste battue au-dessus du seuil obtient des sièges d’opposition.
- *Durée* : la cible d’une carrière typique passe de 45–60 à 60–90 minutes ; la fin choisie permet des parties plus courtes.
- *Portefeuilles (P3-35)* : huit ministères jouables — Intérieur, Justice, Économie et Finances, Travail, Éducation, Santé, Écologie, Agriculture — plus le secrétariat d’État en entrée ; les autres ministères existent dans le monde sans être jouables.
- *Conduite du rush* : un détail non tranché (chiffre, libellé, nombre de sièges, choix secondaire) est décidé par l’assistant et consigné comme « décision déléguée, provisoire » ; seule une contradiction avec une décision validée arrête le rush. Le créateur relit le ton de tout le contenu écrit au grand playtest de P3-09. Une fois la pull request du rush fusionnée, l’assistant est autorisé à lancer le déploiement GitHub Pages (autorisation explicite du créateur, valable pour cette fusion).
- *Premiers pas* : objectifs guidés dans une vraie carrière, pas de scénario séparé.
- *Ambition de départ* : rappel au dossier et jugement au bilan, sans fin de partie ni bonus.

**Ordre du rush :** P3-29, P3-30, P3-33, P3-34, P3-35, P3-36, P3-37, P3-38, P3-39, P3-24, P3-25, P3-40, P3-41, P3-42, P3-27, puis P3-09 et P3-10.

**Avancement du rush (branche `feat/v1-rush`) :** P3-29 terminé (scrutins réalistes, procès-verbal commun, ARCHITECTURE §8.4 novovicies). Prochaine tâche : P3-30 (investiture nationale).

**Après la V1 :** présidentielle et ses mécaniques ; scission et création de parti ; activités parallèles (consultant, auteur, chroniqueur) ; déménagement, parachutage, grandes villes réelles et départementales ; outre-mer ; plusieurs médias par région ; trafic d’influence ; délégation complète des tâches de l’organisation ; débauchage par un rival et réputation d’employeur.


### Hors périmètre

Version mobile dédiée, multijoueur, comptes, stockage serveur, IA générative en cours de partie, méta-progression, prestige, gestion exhaustive d’un pays ou d’entreprises, graphismes complexes. Les archives de carrières enrichies et récompenses narratives sont des pistes ultérieures ; le bilan de fin et un carnet simple des carrières passées (P3-41, affichage sans bonus) sont en V1. Ne pas créer ces systèmes « pour plus tard » avant preuve de leur intérêt.

## 6. Stratégie de contenu et équilibrage

Conserver les événements dans les catalogues JSON, validés automatiquement. Toute nouvelle situation doit avoir un identifiant durable, une fenêtre historique pertinente, des conditions, des choix et des effets autorisés ; ajouter des tests pour les cas nouveaux. Le moteur ne doit être modifié que si une nouvelle règle métier justifiée l’exige. Textes écrits à l’avance, variables de contexte et références fictives ; aucune génération IA à l’exécution.

Avant chaque jalon, mesurer : nombre de tours et décisions, répétitions, répartition des causes de fin, fortunes, mandats, insolvabilité, stress, diversité des trajectoires et viabilité d’une stratégie honnête. Tester des stratégies prudente, ambitieuse, patrimoniale, mixte et aléatoire valide. Consigner les seeds problématiques et rejouer les mêmes scénarios après corrections. Une fin par plafond technique est un défaut de simulation, pas une fin normale.

Pour la durée, viser environ 45–60 minutes de jeu actif sur une carrière typique, sans imposer une durée à toutes les trajectoires. Mesurer avec des joueurs : distinguer temps de lecture, planification et résolution ; diminuer les interruptions sans intérêt plutôt que raccourcir arbitrairement la vie du personnage.

## 7. Collaboration Codex / Claude Code

Les deux assistants doivent lire `AGENTS.md`, puis les documents concernés et cette feuille de route. `CLAUDE.md` importe les consignes communes. Le dépôt Git est la source de vérité ; ne pas dépendre d’un historique privé d’assistant. Avant une tâche, vérifier `git status`, identifier la tâche et ses dépendances ; préserver les modifications existantes. Éviter de faire travailler les deux assistants sur les mêmes fichiers simultanément. Si nécessaire, branches/worktrees distincts, intégration après revue.

À la fin d’une tâche : indiquer l’identifiant, les fichiers changés, les décisions prises, les commandes et résultats réellement observés, les limites et la prochaine tâche. Mettre à jour la case uniquement si le critère est satisfait. Aucun commit, push ou déploiement sans consigne explicite. Si une règle de gameplay change, obtenir l’accord et mettre à jour le GDD ; ne pas faire passer une hypothèse de tuning pour une décision validée.

## 8. Première consigne à transmettre à Codex ou Claude Code

> Lis `AGENTS.md`, `GAME_DESIGN.md`, `ARCHITECTURE.md`, `DESIGN.md` et `ROADMAP.md`. Vérifie l’état actuel du dépôt et conserve les documents existants. Implémente uniquement la phase 0 de la feuille de route (P0-01 à P0-04), en commençant par P0-01. Initialise SvelteKit statique avec TypeScript strict, Tailwind CSS, Lucide et npm ; verrouille la version Node et les dépendances. Configure les outils de vérification et les tests de démarrage, une coque desktop minimale et un README de démarrage. Ne développe pas encore le moteur de carrière, les élections, la justice ou les événements. Pas de backend, de service externe ni de dépendance IA au runtime. Vérifie les scripts effectivement disponibles et le build statique. Mets à jour les cases des tâches uniquement lorsqu’elles sont vérifiées. Termine avec un récapitulatif des fichiers modifiés, des tests réellement exécutés, des éventuelles limites et de la prochaine tâche P1-01. Ne publie pas et ne pousse pas le dépôt sans demande.

Les tâches de phase 0 peuvent également être confiées une par une pour faciliter la revue. Après le bootstrap, commencer P1-01, pas une implémentation globale de la V1.

## 9. Reprise du travail — passage de relais (25 novembre 2026)

- **Branche :** travail sur `main` par branches courtes et pull requests (CI obligatoire avant fusion), une PR par tâche en phase 3. Dernières intégrations : phase 2 (PR #5), feuille de route (PR #6), organisation regroupée et départ d’un exemplaire (PR #7), préparation de la phase 3 (PR #8), corrections du playtest — mairie (PR #9), budget politique (PR #10), agenda thématique (PR #11). Les branches de phase et les branches de tâche fusionnées ont été supprimées. Le site publié (https://bencorb.github.io/la-republique-cest-moi/) montre `main` après P3-09, premier volet (PR #22 et #23), redéployé à la demande du créateur le 26 novembre 2026 ; les sauvegardes de l’alpha y sont refusées comme règles obsolètes, sans être effacées.
- **État :** phases 0, 1 et 2 terminées, intégrées et publiées ; phase 3 intégrée et publiée jusqu’à P3-09 (premier volet). Plan et décisions de la phase 2 au §4.1.
- **Où lire :** décisions de la phase 1 dans `ARCHITECTURE.md` (§5.2 bis, §6.1, §7.1 bis, §7.3, §7.4, §8.1 bis, §8.2 bis, §9.1, §10.1, §11.1 bis, §12.1–12.3) ; de la phase 2 au §5.2 ter et aux §8.1 ter, §8.3 bis à decies ; plan de la phase 3 au §5.1 de ce document ; protocoles et résultats humains dans `PLAYTEST.md` ; limites, dette et règles provisoires au §15.
- **Prochaine étape :** P3-01 (lot A) terminé sur la branche `feat/p3-01-justice`, à intégrer par pull request : mesure de performance, registre des faits, exposition et risque judiciaire, dossiers à étapes, défense, peines, inéligibilité, prison ferme, affaires de l’entourage, bilan (ARCHITECTURE §8.4 bis et ter, §15.3). Chiffres provisoires, à éprouver au playtest et en P3-09. Journal économique compacté ensuite (≈ − 30 % sur les carrières à grande organisation, ARCHITECTURE §15.3). P3-02 (lot B) terminé : actifs, revenus, valeur nette, train de vie et confort (ARCHITECTURE §8.4 quater), train de vie modeste gratuit (décision du créateur, 25 novembre 2026). P3-04 (lot C) terminé : registre des promesses, engagements de campagne, dilemmes une fois élu, réalisation à échéance, rappels en campagne (ARCHITECTURE §8.4 quinquies). P3-03 (lot D) terminé : cinq médias, relations, interviews et déjeuners, fil de presse fondé sur les dossiers révélés, promesses, scrutins et train de vie, rachat du Courrier du Bocage (ARCHITECTURE §8.4 sexies). P3-05 (lot E) terminé : cinq paramètres institutionnels réformables, vote, entrée en vigueur au 1er janvier, réformes du gouvernement, règles communes à tous les acteurs (ARCHITECTURE §8.4 septies). P3-07 (lot G) terminé : quatre époques, événements et technologies selon les dates, chaînes sur plusieurs années, répétitions pondérées et plafonnées, références fictives vérifiées, catalogue de 122 événements (ARCHITECTURE §8.4 octies). P3-08, premier volet terminé : bilan de fin de carrière, nécrologies et distinctions fondées sur l’historique (ARCHITECTURE §8.4 nonies). Second volet de P3-08 terminé : épinglage des étapes du plan, tendances du tableau de bord, écran d’actualités (ARCHITECTURE §8.4 decies). P3-09, premier volet terminé (branche `feat/p3-09-equilibrage`) : lots de 500 carrières par stratégie, anomalies corrigées (départage alphabétique des politiques, stratégie intègre, garde-fou d’épuisement, réserve de recrutement, moyens parlementaires réduits, dilemmes de promesse plafonnés), mesures de justice et durée active estimée par un modèle provisoire (ARCHITECTURE §8.4 undecies). Le playtest P3-09 du 26 novembre 2026 a produit seize retours (`PLAYTEST.md`) : plan de corrections P3-11 à P3-25 et décisions du créateur au §5.2, à commencer par P3-11 (agenda) et P3-12 (affaires et embauche familiale). P3-11 terminé (branche `feat/p3-11-agenda-ponctuel`) : activités ponctuelles par défaut, épinglage explicite, retrait automatique des étapes impossibles avec notice et journal de session, arrêt d’accélération sur plan devenu vide (ARCHITECTURE §8.4 duodecies). P3-12 terminé (branche `feat/p3-12-affaires-embauche-familiale`) : capacités exigées par les infractions, garde moteur et validation statique, audit du catalogue, poste lié à l’événement familial et embauche réelle du proche (ARCHITECTURE §8.4 terdecies). P3-15 terminé (branche `feat/p3-15-anti-repetition`) : mémoire de presse sauvegardée, pioche sans remise des titres, délai thématique, plafond de deux occurrences par scène ordinaire, rapport de répétitions et de couverture, signalement des pools de titres trop petits (ARCHITECTURE §8.4 quaterdecies). P3-16 terminé (branche `feat/p3-16-territoire`) : région choisie, département et commune fictive tirés, taille et traits aux effets légers, territoire cité dans les scrutins, mandats, presse et bilan (ARCHITECTURE §8.4 quindecies). P3-26 terminé (branche `feat/p3-26-direction-visuelle`) : maquette et table d’identité validées par le créateur, police de titrage, pastilles de coûts et d’effets, barres à paliers, tuiles de ressources, alertes à trois niveaux ; en-tête, agenda, tableau de bord et alertes au nouveau style (ARCHITECTURE §8.4 sexdecies, DESIGN §10.10). P3-13 terminé (branche `feat/p3-13-plan-permanent`) : carnet du trimestre dans la colonne droite de tous les onglets, alertes en bandeau sous l’en-tête et titre de presse dans l’en-tête, feuille « Modifier le plan » avec recherche d’activités, bouton persistant sous 1 100 px, verrouillage pendant l’accélération (ARCHITECTURE §8.4 septdecies). P3-14 terminé (branche `feat/p3-14-resultats-note`) : résultat du choix dans la fenêtre de décision (récit `outcome` au catalogue ou repli, variations réelles, décisions enchaînées), note de cabinet après chaque trimestre manuel, note de période après accélération, réouverture depuis l’en-tête, sans rejeu après reprise (ARCHITECTURE §8.4 octodecies). Prochaine étape : le playtest B1 (bloc 2 terminé), puis le lot 3 à partir de P3-17. P3-09 reste ouvert : chronométrage humain de la durée (protocole P3-09 de `PLAYTEST.md`), puis décision du créateur sur les arrêts d’accélération si la cible de 45–60 minutes est dépassée. Ensuite : P3-10 (livraison statique). Le lot F (P3-06, âges de départ) est abandonné (décision du créateur, 26 novembre 2026).
- **Décisions attendues du créateur :** relecture des hypothèses provisoires de la phase 2 (§4.1, GDD) ; relecture éditoriale des 86 événements. Réglé le 25 novembre 2026 : l’alpha est jetable (sauvegardes refusées après un changement de format, sans migration, jusqu’à la première version à conserver) ; le dépôt reste dans `~/Documents` jusqu’au nettoyage de fin de projet ; plan, contenu, organisation Git, ton satirique, coût de la vie, budget restant et calendrier de la phase 3 (§5.1).
- **Avant de commencer :** `git fetch --prune`, `git status`, rechercher les copies de synchronisation (`find . -path ./node_modules -prune -o -name '* [0-9].*' -print`), `npm ci`, puis `npm run check`, `npm run lint`, `npm run content:validate`, `npm run test` et `npm run build`.
