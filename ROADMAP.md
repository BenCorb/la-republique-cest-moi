# La République, c’est moi ! — Feuille de route

**Version 0.1 — 24 novembre 2026**  
**Statut :** phases 0 et 1 terminées et intégrées à `main` (PR #4, CI verte, 24 novembre 2026) ; P0-01 à P0-06 et P1-01 à P1-10 réalisées et vérifiées (✅ = tâche terminée dans les tableaux). Phase 2 (alpha) terminée et intégrée à `main` (PR #5, `5a5b0e5`, CI verte, 25 novembre 2026) ; P2-01 à P2-10 réalisées et vérifiées. L’alpha est publiée sur GitHub Pages (déploiement manuel du 25 novembre 2026). Reprise : voir §9.

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
| P3-06 | Âges de départ et passé | P2-08 | Trois familles de profils et passé cohérent ; bagage contre horizon de vie ; pas d’avantage interparties |
| P3-07 ✅ | Époques, chaînes et contenu | P3-01 à 06 | Événements et technologies disponibles selon dates ; références fictives ; répétitions contrôlées ; catalogue enrichi et validé |
| P3-08 ✅ | Interface et bilan définitifs V1 | P3-07 | Interface allégée et plus graphique ; plan cohérent entre avance manuelle et accélération ; écrans intégrés, nécrologies diversifiées, distinctions fondées sur historique, pas de sous-système de prestige |
| P3-09 | Équilibrage et tests | P3-08 | Lots de simulations par stratégie, playtests, corrections documentées ; cible de durée évaluée ; aucune anomalie critique connue |
| P3-10 | Livraison statique | P3-09 | Build, vérification locale et sous-chemin GitHub Pages ; procédure de déploiement/rollback (workflow manuel) éprouvée ; publication seulement sur demande |

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
| F — Profils | P3-06 | Âges de départ et passé cohérent | Indépendant : peut s’intercaler tôt si le playtest le demande |
| G — Contenu et finition | P3-07 à P3-10 | Époques, chaînes, interface définitive, équilibrage, livraison | P3-08 reprend les retouches d’interface reportées (épinglage du plan, densité de texte) |

**Contenu par lot** (validé le 25 novembre 2026, chiffres provisoires) :

- *Lot A* — Cinq types d’affaires fictives : emplois fictifs, financement occulte de campagne, favoritisme dans un marché public, prise illégale d’intérêts, abus de biens sociaux ; plusieurs dossiers simultanés, dont ceux de l’entourage. Délais de 2 à 8 trimestres par étape. Sanctions : amende, inéligibilité de 1 à 10 ans, prison avec sursis, prison ferme ; seule une condamnation ferme grave met fin à la carrière. Défense : temps, argent, conseil juridique, choix de communication. Culpabilité et enquête restent des états distincts.
- *Lot B* — Six actifs : appartement en ville, résidence secondaire, portefeuille boursier, parts de PME, vignoble, et un média local (activé par P3-03). Trois niveaux de train de vie (modeste, confortable, fastueux) qui coûtent chaque trimestre et agissent sur le stress et la santé.
- *Lot C* — Huit promesses types liées aux élections (fiscalité, sécurité, écologie, services publics, institutions…), avec les états annoncée, en cours, tenue, partiellement tenue et abandonnée, et des effets sur les soutiens des groupes concernés.
- *Lot D* — Cinq médias fictifs (quotidien de référence, quotidien populaire, chaîne d’information continue, hebdomadaire satirique, presse régionale existante : Courrier du Bocage, Radio Bocage FM), avec ligne éditoriale, audience et relation au joueur ; une acquisition possible, sans contrôle de toute la presse.
- *Lot E* — Cinq paramètres réformables : plafond du cumul, indépendance de la justice, transparence financière, mode de scrutin, liberté de la presse.
- *Lot F* — Trois familles d’âge de départ (18–25, 30–45, 50–65 ans) avec bagage et horizon de vie contrastés.

**Décisions du créateur (25 novembre 2026) :**

1. **Ordre et contenu** : ordre des lots A → B → C → D → E → G retenu, le lot F n’étant avancé que si le playtest le demande ; propositions de contenu validées telles quelles, à amender lot par lot si besoin.
2. **Organisation Git** : une branche courte et une pull request par tâche depuis `main` (par exemple `feat/p3-01-justice`), CI verte obligatoire, fusion « squash » ; pas de branche de phase (AGENTS.md).
3. **Satire judiciaire** : ton mordant et grinçant, entièrement fictif (affaires, noms, médias), sans personne réelle identifiable (GDD §8.1). La justice reste crédible : relaxe comme condamnation sont possibles, et l’impunité n’est jamais garantie.
4. **Coût de la vie** : traité dans P3-02, avec le patrimoine.
5. **Budget politique** : les deux défauts restants (débordement des carrières élues, surtout par l’Assemblée ; recrutements rendus impayables par des pics de budget, ARCHITECTURE §8.3 duodecies) sont traités à l’équilibrage de P3-09. *Traités au premier volet de P3-09 (ARCHITECTURE §8.4 undecies).*
6. **Playtest** : P3-01 commence sans attendre la fin de la reprise du playtest de l’alpha.

### Hors périmètre

Version mobile dédiée, multijoueur, comptes, stockage serveur, IA générative en cours de partie, méta-progression, prestige, gestion exhaustive d’un pays ou d’entreprises, graphismes complexes. Les archives de carrières enrichies et récompenses narratives sont des pistes ultérieures ; le bilan de fin reste en V1. Ne pas créer ces systèmes « pour plus tard » avant preuve de leur intérêt.

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

- **Branche :** travail sur `main` par branches courtes et pull requests (CI obligatoire avant fusion), une PR par tâche en phase 3. Dernières intégrations : phase 2 (PR #5), feuille de route (PR #6), organisation regroupée et départ d’un exemplaire (PR #7), préparation de la phase 3 (PR #8), corrections du playtest — mairie (PR #9), budget politique (PR #10), agenda thématique (PR #11). Les branches de phase ont été supprimées. Le site publié (https://bencorb.github.io/la-republique-cest-moi/) montre l’alpha, redéployée à la demande du créateur le 25 novembre 2026.
- **État :** phases 0, 1 et 2 terminées, intégrées et publiées. Plan et décisions de la phase 2 au §4.1.
- **Où lire :** décisions de la phase 1 dans `ARCHITECTURE.md` (§5.2 bis, §6.1, §7.1 bis, §7.3, §7.4, §8.1 bis, §8.2 bis, §9.1, §10.1, §11.1 bis, §12.1–12.3) ; de la phase 2 au §5.2 ter et aux §8.1 ter, §8.3 bis à decies ; plan de la phase 3 au §5.1 de ce document ; protocoles et résultats humains dans `PLAYTEST.md` ; limites, dette et règles provisoires au §15.
- **Prochaine étape :** P3-01 (lot A) terminé sur la branche `feat/p3-01-justice`, à intégrer par pull request : mesure de performance, registre des faits, exposition et risque judiciaire, dossiers à étapes, défense, peines, inéligibilité, prison ferme, affaires de l’entourage, bilan (ARCHITECTURE §8.4 bis et ter, §15.3). Chiffres provisoires, à éprouver au playtest et en P3-09. Journal économique compacté ensuite (≈ − 30 % sur les carrières à grande organisation, ARCHITECTURE §15.3). P3-02 (lot B) terminé : actifs, revenus, valeur nette, train de vie et confort (ARCHITECTURE §8.4 quater), train de vie modeste gratuit (décision du créateur, 25 novembre 2026). P3-04 (lot C) terminé : registre des promesses, engagements de campagne, dilemmes une fois élu, réalisation à échéance, rappels en campagne (ARCHITECTURE §8.4 quinquies). P3-03 (lot D) terminé : cinq médias, relations, interviews et déjeuners, fil de presse fondé sur les dossiers révélés, promesses, scrutins et train de vie, rachat du Courrier du Bocage (ARCHITECTURE §8.4 sexies). P3-05 (lot E) terminé : cinq paramètres institutionnels réformables, vote, entrée en vigueur au 1er janvier, réformes du gouvernement, règles communes à tous les acteurs (ARCHITECTURE §8.4 septies). P3-07 (lot G) terminé : quatre époques, événements et technologies selon les dates, chaînes sur plusieurs années, répétitions pondérées et plafonnées, références fictives vérifiées, catalogue de 122 événements (ARCHITECTURE §8.4 octies). P3-08, premier volet terminé : bilan de fin de carrière, nécrologies et distinctions fondées sur l’historique (ARCHITECTURE §8.4 nonies). Second volet de P3-08 terminé : épinglage des étapes du plan, tendances du tableau de bord, écran d’actualités (ARCHITECTURE §8.4 decies). P3-09, premier volet terminé (branche `feat/p3-09-equilibrage`) : lots de 500 carrières par stratégie, anomalies corrigées (départage alphabétique des politiques, stratégie intègre, garde-fou d’épuisement, réserve de recrutement, moyens parlementaires réduits, dilemmes de promesse plafonnés), mesures de justice et durée active estimée par un modèle provisoire (ARCHITECTURE §8.4 undecies). P3-09 reste ouvert : chronométrage humain de la durée (protocole P3-09 de `PLAYTEST.md`), puis décision du créateur sur les arrêts d’accélération si la cible de 45–60 minutes est dépassée. Ensuite : P3-10 (livraison statique), le lot F (P3-06) n’étant avancé que si le playtest le demande.
- **Décisions attendues du créateur :** relecture des hypothèses provisoires de la phase 2 (§4.1, GDD) ; relecture éditoriale des 86 événements. Réglé le 25 novembre 2026 : l’alpha est jetable (sauvegardes refusées après un changement de format, sans migration, jusqu’à la première version à conserver) ; le dépôt reste dans `~/Documents` jusqu’au nettoyage de fin de projet ; plan, contenu, organisation Git, ton satirique, coût de la vie, budget restant et calendrier de la phase 3 (§5.1).
- **Avant de commencer :** `git fetch --prune`, `git status`, rechercher les copies de synchronisation (`find . -path ./node_modules -prune -o -name '* [0-9].*' -print`), `npm ci`, puis `npm run check`, `npm run lint`, `npm run content:validate`, `npm run test` et `npm run build`.
