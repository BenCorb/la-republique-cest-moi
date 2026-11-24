# La République, c’est moi ! — Feuille de route

**Version 0.1 — 24 novembre 2026**  
**Statut :** phase 0 terminée (P0-01 à P0-06). Phase 1 en cours : P1-01 réalisée et vérifiée le 24 novembre 2026 (✅ = tâche terminée dans les tableaux).  
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
| P1-02 | Catalogue d’actions, conditions et effets | P1-01 | Schéma validé ; temps trimestriel et coûts vérifiés ; preview pure ; plan rejeté sans modification |
| P1-03 | Économie, producteurs et améliorations | P1-02 | Budget politique séparé des finances personnelles ; charges explicites ; achat T produit en T+1 ; invariants testés |
| P1-04 | Santé, stress, vieillissement et fin | P1-03 | Effets du repos et de la charge testés ; décès et bilan atteignables ; aucune commande de tour après fin |
| P1-05 | Moteur d’événements | P1-04 | Tirage conditionnel, acteurs pertinents, choix, répétition et au moins une suite différée ; choix bloquant appliqué une seule fois |
| P1-06 | Premier catalogue narratif | P1-05 | 20–30 événements écrits et paramétrables ; aucun texte non résolu ; aucun choix sans issue ; validation automatisée |
| P1-07 | Sauvegarde locale | P1-05 | Enveloppe versionnée, reprise à l’identique y compris décision en attente, export/import et erreurs traitées ; pas de progression hors ligne |
| P1-08 | Interface jouable | P1-03 à 07 | Agenda, tableau de bord, producteurs simples, événements, journal et bilan accessibles ; coûts et erreurs lisibles |
| P1-09 | Accélération minimale et tests de scénarios | P1-08 | Tours multiples identiques aux tours unitaires ; arrêt sur choix/alerte/fin, annulation possible ; E2E complet |
| P1-10 | Simulateur et réglages initiaux | P1-09 | Exécution de lots seedés ; rapport JSON/CSV ; invariants et fins analysés ; playtest humain effectué et documenté |

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
| P2-01 | Partis et contexte national | P1 | Paysage initial fixe, dirigeants variables, évolution autonome et événements nationaux conditionnels |
| P2-02 | Calendrier électoral et mandats | P2-01 | Échéances visibles, durée et incompatibilités vérifiées ; élections anticipées possibles via événement |
| P2-03 | Candidatures et campagne | P2-02 | Candidature libre sous conditions d’éligibilité ; arbitrage tôt/tard ; sondages, scrutin et échec non nécessairement terminal |
| P2-04 | Personnages nommés et relations | P2-01 | Acteurs persistants, traits partiellement cachés, vieillissement, départs et mémoire d’actes importants |
| P2-05 | Entourage et délégation | P2-04 | Recrutement sur postes clés ; missions persistantes, production et événements autonomes ; qualité des conseils variable |
| P2-06 | Adversaires récurrents | P2-03/04 | Un rival peut réapparaître, évoluer et changer de relation ; pas de personnage décédé candidat |
| P2-07 | Groupes de soutien | P2-03/04 | Soutiens électoraux distincts des appuis internes et économiques ; détail public sans fuite de traits cachés |
| P2-08 | Origines, professions, famille | P2-04 | Profils initiaux cohérents ; famille légère par statistiques, relations et événements ; âge fixe encore possible |
| P2-09 | Accélération complète et interface | P2-02 à 08 | Arrêt motivé sur événements ou échéances ; résumé des tours, onglets carrière/entourage et alertes utiles |
| P2-10 | Contenu et tests alpha | P2-09 | Plusieurs seeds et stratégies donnent des trajectoires distinctes ; cumul légal selon les règles du jeu ; sauvegardes migrées ou explicitement refusées |

Éviter un système de simulation individuelle de tous les électeurs ou un moteur d’IA autonome. Les personnages et le monde évoluent via règles, traits et événements. Les valeurs de départ, poids électoraux et fréquences restent calibrables dans le contenu.

## 5. Phase 3 — V1 : profondeur et finition

| ID | Tâche | Dépendances | Critère d’acceptation |
|---|---|---|---|
| P3-01 | Justice et dossiers | P2 | Plusieurs affaires possibles, étapes et délais cohérents, conséquences sur carrière, finances et santé ; condamnation terminale selon règles |
| P3-02 | Patrimoine et confort | P2 | Achat d’actifs, coûts, revenus passifs, valeur nette distincte des liquidités ; choix de confort et risques |
| P3-03 | Médias et relations | P2, P3-02 | Médias fictifs différenciés, fil de presse dynamique, acquisition d’actifs médiatiques et conséquences narratives |
| P3-04 | Promesses et gouvernement | P2 | Promesses suivies, dilemmes simples, décisions tenues/trahies ayant des effets différés ; aucun simulateur macroéconomique |
| P3-05 | Institutions modifiables | P3-01/04 | Réformes limitées aux fonctions autorisées, règles persistantes, activation à date fixe, conséquences aussi pour adversaires |
| P3-06 | Âges de départ et passé | P2-08 | Trois familles de profils et passé cohérent ; bagage contre horizon de vie ; pas d’avantage interparties |
| P3-07 | Époques, chaînes et contenu | P3-01 à 06 | Événements et technologies disponibles selon dates ; références fictives ; répétitions contrôlées ; catalogue enrichi et validé |
| P3-08 | Interface et bilan définitifs V1 | P3-07 | Écrans intégrés, nécrologies diversifiées, distinctions fondées sur historique, pas de sous-système de prestige |
| P3-09 | Équilibrage et tests | P3-08 | Lots de simulations par stratégie, playtests, corrections documentées ; cible de durée évaluée ; aucune anomalie critique connue |
| P3-10 | Livraison statique | P3-09 | Build, vérification locale et sous-chemin GitHub Pages ; procédure de déploiement/rollback (workflow manuel) éprouvée ; publication seulement sur demande |

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
