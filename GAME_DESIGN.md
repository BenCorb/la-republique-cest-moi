# La République, c’est moi !

**Game Design Document — version 0.1**  
**Date :** 24 novembre 2026  
**Statut :** cadrage initial, avant prototype  
**Titre de travail :** La République, c’est moi ! (sans sous-titre)

> Ce document constitue la référence de conception du jeu. Il rassemble les décisions du brainstorming et les traduit en règles de gameplay exploitables par Codex. Les valeurs numériques proposées sont des hypothèses de prototypage, et non des engagements d’équilibrage. Les décisions encore ouvertes sont signalées en fin de document. En cas de doute, privilégier la simplicité, la qualité des histoires et la rejouabilité plutôt que la multiplication des systèmes.

## 1. Vision du jeu

### 1.1 Concept

La République, c’est moi ! est un jeu web solo de gestion narrative de carrière politique au tour par tour, comportant une dimension incrémentale. Le joueur incarne un personnage qui tente de se faire une place dans une France alternative, à partir de l’année 2000. Il peut briguer des mandats, servir ses convictions, s’enrichir, constituer un réseau, déléguer à son entourage, gouverner ou renoncer à la politique. Le monde politique continue à évoluer indépendamment de lui.

La partie raconte une vie entière plutôt qu’une course vers une victoire prédéfinie. Un personnage peut devenir président, tomber dans l’oubli, finir riche sans jamais être élu, connaître la prison ou mourir avant d’avoir atteint ses ambitions. L’intérêt est de découvrir les conséquences de ses choix et de recommencer une carrière différente.

### 1.2 Fiche d’identité

| Élément | Orientation retenue |
|---|---|
| Genre | Gestion de carrière, simulation narrative, progression incrémentale |
| Structure | Solo, tour par tour, un trimestre par tour |
| Durée cible | Environ 45 à 60 minutes par carrière typique, à confirmer en test ; certaines seront plus courtes ou plus longues |
| Plateforme | Navigateur web sur ordinateur, interface desktop-first |
| Univers | France alternative, reconnaissable mais fictive, à partir de 2000 |
| Ton | Satire politique, humour absurde, critique des mécanismes de pouvoir |
| Public initial | Créateur et cercle d’amis, jeu accessible sans installation |
| Sauvegarde | Locale dans le navigateur, aucune progression de puissance entre les parties |
| Déploiement | Site web statique, sans serveur applicatif nécessaire |

### 1.3 Piliers de conception

1. **Ambition libre.** Aucun objectif n’est imposé ; la fonction politique et la fortune ne sont pas les seules formes de réussite.
2. **Tentation.** Les raccourcis opportunistes peuvent accélérer une carrière, mais entraînent des risques et des dépendances. Une carrière honnête doit rester possible, difficile et intéressante.
3. **Perte de contrôle.** Plus le personnage développe son pouvoir et délègue, plus il dépend de collaborateurs, d’alliés et d’institutions qui ont leurs propres intérêts.
4. **Héritage.** Les décisions laissent des traces durables. La fin de partie expose les contradictions et les accomplissements du personnage.
5. **Rejouabilité narrative.** Les histoires émergent du croisement des systèmes, de l’aléatoire et des choix, non d’un système de récompenses permanentes.

### 1.4 Ce que le jeu n’est pas

- Un clicker en temps réel ou un jeu idle qui progresse lorsque le navigateur est fermé.
- Une course à des multiplicateurs exponentiels incontrôlables : la croissance peut être spectaculaire, mais reste liée à des arbitrages, des limites et des coûts.
- Un simulateur exhaustif de l’économie, du droit constitutionnel, des relations internationales ou de chaque électeur.
- Une reconstitution historique, un simulateur de véritables partis ou un outil de prévision électorale.
- Un roguelite avec méta-progression en V1, un jeu multijoueur ou une application mobile dédiée.

## 2. Boucle de gameplay et calendrier

### 2.1 Un tour = un trimestre

Le temps n’avance que lorsque le joueur valide un tour ou lance une simulation accélérée. Le calendrier débute en 2000 (T1 recommandé pour le prototype). Quatre tours font une année ; les personnages vieillissent avec le calendrier. Les échéances, mandats, affaires, actions et événements sont exprimés en trimestres.

Le joueur dispose d’un budget de temps à chaque tour. Proposition initiale : 100 points, représentant 100 % de sa disponibilité trimestrielle. Chaque action consomme une partie de ce budget. Les actions particulièrement lourdes sont donc incompatibles avec d’autres activités importantes au même trimestre. L’achat d’un actif peut aussi coûter du temps si sa nature le justifie.

### 2.2 Déroulement d’un trimestre

| Phase | Fonctionnement |
|---|---|
| 1. Information | Le joueur consulte sa situation, le journal, les alertes, les échéances et les productions attendues. |
| 2. Planification | Il sélectionne ses actions, répartit son temps, ajuste les missions de son entourage, décide de ses dépenses et investissements. |
| 3. Validation | Le moteur vérifie les coûts, les prérequis et les incompatibilités ; le joueur confirme le passage au trimestre suivant. |
| 4. Résolution | Les actions sont appliquées, les ressources produites, les charges prélevées, les personnages et le monde évoluent ; les élections et autres échéances sont résolues si elles arrivent à terme. |
| 5. Événements et bilan | Les nouvelles importantes sont présentées ; les événements nécessitant une réponse interrompent la progression. Le calendrier avance et le joueur retrouve son tableau de bord. |

**Convention de prototypage :** un recrutement ou un investissement réalisé pendant le trimestre T commence à produire ses effets récurrents au trimestre T+1. Les effets immédiats explicitement définis sont appliqués à la résolution de T. Les événements bloquants et leurs réponses doivent être résolus une seule fois avant la prochaine avance. L’ordre exact des sous-phases sera figé dans ARCHITECTURE.md, notamment pour les élections et les événements déclenchant une fin de partie.

### 2.3 Accélération du calendrier

Le joueur peut passer un trimestre ou plusieurs, avec un arrêt automatique lorsqu’une intervention pertinente est nécessaire : candidature à préparer, échéance électorale imminente, recrutement devenu vacant, crise de santé, affaire judiciaire, manque de financement, ou choix narratif important. Les tâches déléguées et les charges continuent de fonctionner. L’accélération simule réellement les tours intermédiaires ; elle n’applique pas un multiplicateur simplifié.

Proposition : boutons « Trimestre suivant », « Année suivante » et « Jusqu’au prochain événement important », avec possibilité d’interrompre ce dernier mode. Ne pas forcer une décision à chaque trimestre. Les nouvelles non critiques peuvent être regroupées dans un résumé.

**Hypothèses provisoires de l’alpha (P2-09, 25 novembre 2026, choix délégués) :** l’accélération s’arrête quand les candidatures sont ouvertes à une élection accessible (au plus quatre trimestres avant la clôture), au dernier trimestre d’une campagne, au résultat, à une nomination ou une fin de mandat, à l’annonce d’élections anticipées, au départ d’un collaborateur, à l’arrivée de candidatures et quand le budget ne couvre plus les salaires, en plus des décisions, de la santé et des charges menacées. Le plan du trimestre est reconduit d’un tour à l’autre ; achats et démarches ponctuelles n’ont lieu qu’une fois. Les trimestres simulés sont résumés au tableau de bord, avec le détail consultable. Fréquence des arrêts à juger en playtest.

### 2.4 Progression incrémentale

La croissance vient de l’accumulation de collaborateurs, de militants, de mandats, d’actifs et de relations. En début de carrière, le joueur fait lui-même la majorité des tâches ; plus tard, l’organisation produit des ressources et exécute des activités de manière autonome.

Les revenus et l’influence peuvent se renforcer mutuellement, mais les coûts récurrents, le stress, les plafonds, les changements de contexte et la responsabilité liée aux délégations limitent la croissance. Pas de prestige ni de reset de carrière avec bonus.

## 3. Personnage et création de partie

### 3.1 Identité et situation initiale

Le personnage commence toujours à 25 ans. L’alpha ajoute les choix d’origine sociale, de profession et de famille ; la V1 remplace la profession par un terrain d’engagement et ajoute un territoire d’origine (`ROADMAP.md` §5.2, P3-16 et P3-17).

**Décision du créateur (26 novembre 2026) :** le choix de l’âge de départ prévu à l’origine (trois familles de profils de 18–25, 30–45 et 50–65 ans, tâche P3-06) est abandonné. L’âge de départ reste fixe à 25 ans ; la création repose sur l’origine sociale, le terrain d’engagement et le territoire. Le passé du personnage n’est donc pas une carrière achevée, mais un début de parcours.

**Terrain d’engagement (V1, P3-17) :** syndical, associatif, étudiant, service public, entreprise ou presse. Il décrit ce qui a conduit le personnage vers la politique, lui donne une activité et des revenus modestes, des effets de départ et des actions propres. Il remplace la profession de l’alpha.

Exemples d’origines : milieu populaire, classe moyenne, grande bourgeoisie, dynastie politique. Les bonus sont liés aux expériences fictives du personnage plutôt qu’à des jugements automatiques sur les catégories sociales.

**Hypothèses provisoires de l’alpha (P2-08, 24 novembre 2026, choix délégués) :** quatre origines (milieu populaire, classe moyenne, grande bourgeoisie, dynastie politique) et six professions (ouvrier, enseignant, avocat, journaliste, entrepreneur, haut fonctionnaire), chacune avec des effets de départ chiffrés (argent, influence, soutiens, stress) et une action propre ; l’origine fixe la famille de départ et l’héritage. Âge de départ toujours 25 ans. Valeurs modifiables à l’équilibrage.

### 3.2 Orientation politique

Le joueur peut partir avec des convictions initiales, rejoindre un parti fictif, le quitter, changer de camp, rester indépendant ou fonder un mouvement. Les décisions modifient progressivement le profil idéologique et la cohérence perçue par les autres acteurs.

Axes proposés, à retenir en nombre limité pour la V1 : économie (interventionnisme/libéralisme), société (progressisme/conservatisme), environnement (productivisme/écologie), institutions (concentration du pouvoir/démocratie participative), international (souverainisme/internationalisme). Ces axes décrivent la compatibilité politique, pas la moralité. Il n’est pas nécessaire d’exposer des scores numériques pour chacun.

**Décision du 24 novembre 2026 (alpha, déléguée par le créateur) :** trois axes retenus — économie (interventionnisme/libéralisme), société (progressisme/conservatisme), souveraineté (construction européenne et ouverture/souverainisme). L’environnement et les institutions passent par les sujets d’actualité et les événements plutôt que par des axes. Les positions sont internes et affichées seulement en termes qualitatifs.

### 3.3 Famille et vie privée

La famille fait partie de la simulation, mais sans système de vie domestique exhaustif. Parents, conjoint, enfants et autres proches peuvent apporter un réseau, des revenus, des dépenses, du soutien ou du stress. Des événements permettent notamment de gérer des tensions familiales, un divorce, une demande de poste, un héritage ou une révélation embarrassante. Les liens familiaux alimentent le moteur de personnages et d’événements existant.

**Hypothèses provisoires de l’alpha (P2-08) :** famille légère — parents et fratrie générés à la création, rencontre, naissance et séparation par événements ; enfants à charge coûteux jusqu’à 20 ans ; héritage au décès d’un parent ; une famille délaissée quand le joueur surcharge son agenda ; un partenaire bien disposé apaise le stress, un partenaire hostile l’aggrave.

## 4. Ressources, jauges et données de simulation

### 4.1 Ressources accumulables

| Ressource | Rôle | Sources et usages types |
|---|---|---|
| Influence | Capital politique mobilisable | Activités politiques, mandats, entourage ; alliances, opportunités et organisation |
| Budget politique | Finances de l’organisation, séparées du patrimoine | Cotisations, financements et ressources institutionnelles modélisées ; campagnes, personnel, communication |
| Fortune personnelle | Patrimoine du personnage | Revenus personnels, investissements, héritages, opérations douteuses fictives ; dépenses privées et placements |
| Temps trimestriel | Capacité d’action non stockable | Renouvelé à chaque trimestre ; actions, défense, repos, campagnes |

Le réseau est une dimension essentielle, représentée principalement par les relations et soutiens. Ne pas créer un deuxième compteur d’influence redondant sans preuve de son utilité. Les fonds détournés cumulés, les dépenses de campagne et autres données historiques sont des compteurs de bilan, pas nécessairement des monnaies dépensables. Une même somme ne doit pas être comptée deux fois dans le patrimoine et le budget.

### 4.2 Jauges évolutives

| Jauge | Rôle |
|---|---|
| Popularité | Synthèse du soutien électoral ; calculée à partir de groupes et du contexte |
| Exposition médiatique | Visibilité, invitations, amplification des succès et controverses |
| Risque judiciaire | Indicateur d’exposition à des enquêtes et événements ; distinct de la culpabilité et des affaires en cours |
| Stress | Charge liée aux responsabilités, conflits, campagnes et crises |
| Santé | État général influençant les événements et la longévité |

Une échelle de 0 à 100 est une hypothèse de prototype pour ces jauges. Les soutiens peuvent utiliser une échelle comparable, sans signifier qu’ils sont tous des pourcentages de vote. Les jauges ne doivent pas évoluer sans bornes. Chaque effet doit être interprétable par le joueur.

**Intégrité cachée :** aucune jauge morale ne doit être affichée. Le moteur conserve l’historique des actes et peut en dériver des indicateurs internes, des traits ou des conditions d’événements. Un choix idéologique n’est pas, en soi, une mesure d’intégrité. La fin de vie juge surtout la cohérence, les actes, les promesses et leurs conséquences.

### 4.3 Données permanentes et historiques

Âge, date, fonction principale, mandats secondaires, affiliation, relations, collaborateurs, actifs, affaires en cours, promesses, décisions importantes, fonds détournés cumulés, fonctions les plus élevées occupées, événements marquants et causes de départ des fonctions. Les données utiles au bilan et aux futurs événements sont conservées même après un changement de parti ou de mandat.

### 4.4 Groupes de soutien

Deux catégories sont distinguées : les groupes électoraux et les groupes d’influence. Exemples de groupes à tester : classes populaires, classes moyennes, électeurs aisés ; militants, cadres de parti, acteurs économiques et réseaux fortunés. La popularité générale est une synthèse électorale ; les soutiens internes, médiatiques ou économiques ne sont pas directement des voix.

**Hypothèses provisoires de l’alpha (P2-07, 24 novembre 2026, choix délégués) :** trois groupes électoraux pondérés (classes populaires 40 %, classes moyennes 40 %, électeurs aisés 20 %) forment la popularité ; trois appuis d’influence (militants, appareil du parti, milieux d’affaires) ne comptent pas dans les voix. Chaque soutien tend vers une référence qui dépend de l’affinité entre le parti du joueur et les attentes du groupe, de l’adhésion, des mandats et de la notoriété ; actions et décisions l’en écartent temporairement.

Une décision peut renforcer certains groupes et fragiliser d’autres, selon leurs attentes dans la partie. Une personnalité peu populaire peut conserver des appuis institutionnels ; une personnalité populaire peut rester isolée dans son parti. Le détail est consultable à la demande, sans encombrer le tableau de bord principal. Les groupes ne doivent pas être traités comme des blocs parfaitement homogènes.

### 4.5 Santé, stress et confort

Les responsabilités, le cumul de mandats, les campagnes, les crises et les affaires judiciaires peuvent augmenter le stress. Un stress durablement élevé peut dégrader la santé et accroître les risques de fin prématurée. Les vacances, le repos, les soins et certains éléments du confort personnel contribuent à la récupération, en consommant du temps ou de l’argent. L’âge influence la vulnérabilité mais ne fixe pas à lui seul une date de décès.

L’arbitrage recherché : travailler plus peut accélérer la carrière, mais raccourcir l’horizon disponible ; s’enrichir peut améliorer le confort, mais certaines méthodes créent de nouveaux risques. Aucun investissement ne doit rendre immortel.

## 5. Actions, améliorations et délégation

### 5.1 Actions manuelles

| Action illustrative | Coût de temps proposé | Effets possibles |
|---|---:|---|
| Distribuer des tracts | 15 | Popularité locale, influence limitée |
| Rencontrer des élus | 20 | Relations et influence |
| Organiser un meeting | 50 | Soutiens, exposition, coût financier et stress |
| Recruter un collaborateur | 20 | Nouvelle capacité à partir du tour suivant |
| Préparer une réforme | 40 | Avancement d’une promesse ou d’une décision politique |
| Prendre du repos | 25 | Récupération, au prix d’opportunités perdues |

Les chiffres ci-dessus sont purement indicatifs. Les actions sont disponibles selon l’âge, la fonction, l’époque, les ressources et le contexte. Elles peuvent être limitées en fréquence si nécessaire ; la répétition ne doit pas créer une stratégie dominante triviale.

### 5.2 Améliorations et organisation

Les améliorations appartiennent principalement à quatre familles : organisation politique (militants, permanence, assistants), communication (attachés de presse, équipements), réseau (rencontres, clubs et relations), vie personnelle (confort, soins, patrimoine). Elles se débloquent par le contexte, la fonction ou l’époque, et non par un arbre de progression politique linéaire.

Une amélioration comporte un coût initial, des prérequis, des effets récurrents ou ponctuels, et éventuellement des charges d’entretien, des limites et des événements associés. Les dépenses récurrentes doivent rester visibles. Les actifs et les personnels ne sont pas nécessairement conservés après la perte d’une fonction si leur financement ou leur accès dépend de celle-ci.

**Décision du créateur (25 novembre 2026) :** le joueur peut se séparer d’un élément de son organisation (militant, permanence, abonnement…) par une action du plan, sans coût financier ; le départ est immédiat (plus de charge ni de production dès ce trimestre). Renvoyer un militant bénévole coûte un peu de soutien militant (provisoirement −2). Les exemplaires possédés s’affichent regroupés par type.

### 5.3 Délégation

Les employés ordinaires sont gérés comme des effectifs agrégés ; les collaborateurs clés sont des personnages. L’organisation peut produire passivement des ressources et prendre en charge des actions récurrentes. Le joueur définit les missions et les priorités, qui persistent entre les tours jusqu’à modification.

Certaines actions déléguées peuvent générer des conséquences inattendues en fonction des personnalités, des consignes et des décisions passées. Un collaborateur efficace mais opportuniste peut engager l’organisation dans une initiative que le joueur n’aurait pas approuvée. La délégation libère du temps sans supprimer le risque ni la responsabilité narrative.

## 6. Personnages, entourage et relations

### 6.1 Un moteur commun

Collaborateurs, dirigeants de parti, adversaires, personnalités médiatiques, acteurs économiques et proches importants partagent un modèle de personnage. Seul un nombre limité d’acteurs nommés est activement simulé ; le reste est abstrait. Les personnages vieillissent et peuvent évoluer, quitter leur poste, prendre leur retraite, mourir ou changer de rôle.

Caractéristiques principales : identité, âge, parcours, compétences par domaine, réseau, loyauté relationnelle, ambition, traits de personnalité, affiliation, rôle actuel et souvenirs relationnels. Les relations peuvent contenir des événements marquants (promesses, soutiens, trahisons, promotions refusées), plutôt qu’une simulation psychologique exhaustive.

### 6.2 Postes clés

| Poste | Utilité |
|---|---|
| Directeur de cabinet | Capacité d’organisation et de délégation |
| Responsable communication | Popularité, visibilité, préparation des interviews |
| Trésorier | Finances de l’organisation et gestion des charges |
| Conseiller politique | Influence, alliances et anticipation des réactions |
| Responsable juridique | Analyse des risques et gestion des dossiers |

Cinq postes constituent la base proposée ; un sixième peut être ajouté si réellement utile. *(Alpha, P2-05 : les cinq postes ci-dessus, chacun avec un salaire, une condition de déblocage et deux missions ; trois profils de candidats contrastés ; conseils précis, indicatifs ou parfois faux selon la compétence. Hypothèses provisoires.)* Ils deviennent accessibles progressivement. Le recrutement propose plusieurs profils : une personne compétente mais indépendante, un candidat disposant d’un réseau familial important mais peu qualifié, ou un collaborateur ambitieux et brillant. Les caractéristiques doivent créer des arbitrages, pas un classement univoque.

### 6.3 Informations partielles et conseils

Au recrutement, le joueur voit les informations plausiblement accessibles : CV, compétences connues, réseau apparent et certains traits. La loyauté réelle, l’ambition et des traits cachés se révèlent progressivement. La loyauté varie avec les interactions. Un ancien collaborateur peut devenir un allié, un rival ou un adversaire électoral.

Les choix narratifs affichent par défaut des tendances prévisibles, pas les conséquences numériques exactes. Un conseiller compétent ou doté d’un trait approprié fournit une estimation plus précise dans son domaine (par exemple des fourchettes, un risque mieux identifié, ou un effet déterministe exact quand il est réellement connu). Un conseiller médiocre peut ne fournir qu’un aperçu vague ou se tromper. Les conséquences réellement inconnues et les tirages futurs ne doivent pas être dévoilés artificiellement. Distinguer conseil estimatif et résultat garanti.

## 7. Carrière politique, mandats et élections

### 7.1 Progression non linéaire

Exemples de fonctions : citoyen, militant, cadre ou dirigeant de parti, conseiller municipal, maire, député, sénateur, ministre, Premier ministre, président. Les postes électifs, nominations et responsabilités partisanes ont des modes d’accès distincts. Des activités parallèles sont possibles : consultant, administrateur, auteur, chroniqueur ou entrepreneur.

La progression n’est pas un arbre d’améliorations imposé. Un personnage peut rester durablement élu local, obtenir une nomination, perdre son siège, changer de camp, sortir de la politique ou revenir après une absence. Les mandats donnent accès à des actions, des revenus, du réseau, des responsabilités et des événements propres.

### 7.2 Cumul des mandats

Le personnage possède une fonction principale et potentiellement plusieurs fonctions secondaires. Les combinaisons autorisées dépendent des règles institutionnelles en vigueur dans l’univers du jeu. Chaque mandat porte ses propres avantages et contraintes (revenus, influence, visibilité, stress, charges et échéances). Le cumul est une source de croissance incrémentale, mais aussi un arbitrage de disponibilité et de risque.

**Hypothèses provisoires de l’alpha (P2-02, 24 novembre 2026, choix délégués par le créateur) :** six fonctions — siège au conseil municipal, mairie (réservée aux membres du conseil), siège au conseil régional, siège à l’Assemblée nationale, siège au Sénat, portefeuille ministériel (nomination, fin avec le gouvernement). Assemblée et Sénat sont incompatibles, le ministère est incompatible avec les deux (le siège passe au suppléant), trois mandats au plus (la mairie, exercée au sein du conseil municipal, ne compte pas à part : décision du créateur du 26 novembre 2026). Chaque mandat réserve du temps chaque trimestre, rapporte des indemnités et de l’influence et ajoute du stress. Calendrier fictif régulier : municipales et régionales tous les six ans, législatives tous les cinq ans (elles désignent le gouvernement), sénatoriales tous les six ans ; une dissolution peut provoquer des législatives anticipées. Chiffres modifiables à l’équilibrage.

### 7.3 Calendrier et liberté de candidature

Les élections régulières sont annoncées longtemps à l’avance dans un calendrier consultable. Le joueur peut décider librement de préparer sa candidature, dès lors que les conditions d’éligibilité fictives sont remplies. Les élections anticipées et les nominations peuvent aussi ouvrir des opportunités inattendues.

Le moment de l’annonce est stratégique : une candidature précoce laisse le temps de préparer la campagne, mais augmente la durée d’exposition médiatique ; une candidature tardive réduit la période de préparation. Il n’existe pas de niveau d’influence universel qui attribue automatiquement un mandat. Les conditions d’éligibilité et de clôture des candidatures doivent être visibles.

### 7.4 Campagne et scrutin

La campagne utilise les ressources et le budget de temps existants : recherche d’investiture, candidature indépendante, financement, organisation, meetings, promesses, débats et événements. Les adversaires ont un nom, des caractéristiques et un parcours, et peuvent réapparaître au fil des décennies.

Le scrutin fictif combine le soutien électoral, la position du parti, la préparation de campagne, le contexte national, les adversaires, les événements récents et une part d’incertitude bornée. Les estimations doivent informer sans garantir le résultat. La modélisation des tours de scrutin sera simplifiée pour rester jouable ; aucune simulation de chaque électeur n’est prévue.

Une défaite peut entraîner une perte de ressources, mais aussi apporter de la notoriété, de l’expérience, des relations ou de nouvelles opportunités.

**Hypothèses provisoires de l’alpha (P2-03, 24 novembre 2026, choix délégués) :** âge minimal par élection (18, 23 ou 30 ans), un siège local exigé pour les sénatoriales, investiture accordée selon le soutien de l’appareil du parti (sinon candidature dissidente sans l’apport du parti), sondage publié en fourchette, scrutin simplifié à un seul tour face à un adversaire principal : popularité, poids du parti si investi, préparation de campagne plafonnée, prime du sortant et part de hasard bornée. La tête de liste municipale bien élue devient maire. Le personnage poursuit sa carrière sauf condition de fin explicite.

### 7.5 Gouverner et tenir ses promesses

Les décisions politiques sont des dilemmes narratifs, pas des simulations détaillées de politiques publiques. Une réforme peut être portée, amendée, reportée ou abandonnée ; ses effets sont exprimés par des changements de soutiens, de ressources, de stress et par des événements ultérieurs. Les conséquences dépendent du contexte de la partie.

Exemple fictif : un candidat promet une réforme fiscale ; une fois élu, ses soutiens économiques s’y opposent. Maintenir, négocier ou renoncer produit des effets distincts selon les groupes concernés. Aucun choix ne doit être universellement favorable. Le registre des promesses conserve leur contenu, leur état (annoncée, tenue, partiellement tenue, abandonnée ou encore en cours) et les circonstances pertinentes. La presse ou les adversaires peuvent les rappeler des années après.

**Hypothèses provisoires de P3-04 (25 novembre 2026, contenu du lot C validé par le créateur) :** huit promesses types prises pendant une campagne (trois au plus), chacune avec des effets sur les groupes concernés à l’annonce et selon son issue. Élu, le joueur a deux ans pour la réaliser (action « Préparer une réforme ») ; un dilemme survient entre-temps : tenir, transiger (au mieux partiellement tenue) ou renoncer. À l’échéance, l’avancement décide : tenue, partiellement tenue ou abandonnée. Battu, la promesse reste annoncée, sans lendemain. Pendant une campagne suivante, l’adversaire ou la presse peut rappeler une promesse abandonnée ou tenue. Chiffres modifiables à l’équilibrage (ARCHITECTURE §8.4 quinquies).

## 8. Monde politique autonome et époques

### 8.1 France alternative

Les noms de partis, médias, institutions et organisations sont fictifs et peuvent faire clairement référence à des réalités françaises. Les personnages sont inventés ; éviter d’attribuer des comportements criminels fictifs à des personnes réelles identifiables. La satire porte notamment sur les mécanismes et contradictions du pouvoir. **Satire judiciaire (décision du créateur, 25 novembre 2026) :** ton mordant et grinçant ; affaires, noms et médias entièrement fictifs, sans personne réelle identifiable ; la justice reste crédible (relaxe comme condamnation possibles, impunité jamais garantie).

Le paysage politique initial est globalement le même à chaque partie : mêmes partis, médias, institutions, règles et rapports de force de référence. Les dirigeants, leurs noms, leurs personnalités et leurs relations sont générés ou sélectionnés aléatoirement. Les événements ultérieurs divergent. Les noms parodiques exacts et la composition du catalogue initial restent à écrire et à valider.

**Catalogue initial de l’alpha (24 novembre 2026, consigne du créateur : noms proches du paysage français réel mais distincts et humoristiques ; poids de départ provisoires) :**

| Parti fictif | Sigle | Famille | Clin d’œil |
|---|---|---|---|
| Lutte Toujours Intransigeante | LTI | Extrême gauche | Prépare le grand soir depuis 1968 |
| Parti Camarade Français | PCF | Gauche communiste | Mairies de banlieue et nostalgie militante |
| Parti des Synthèses | PS | Gauche de gouvernement | Fusionne dix-sept motions en une phrase |
| Les Verts Divisés | LVD | Écologistes | Plus de courants que de rivières propres |
| Union des Démocrates Flottants | UDF | Centre | Centre de gravité, tant qu’il ne faut pas choisir |
| Rassemblement pour la Réélection | RPR | Droite de gouvernement | Gaulliste de tradition, réélectionniste de conviction |
| Chasse, Pêche, Nature et Apéro | CPNA | Ruralistes | Défend les traditions, surtout celle de 18 h |
| Front du Non | FN | Extrême droite | Contre, par principe, et contre le principe aussi |

En 2000, le Parti des Synthèses conduit le gouvernement. Les dirigeants sont générés à chaque partie ; aucun personnage réel n’est représenté. Les fusions, scissions et créations de partis passeront par des événements.

### 8.2 Évolution du monde

Le moteur national est volontairement réduit : rapports de force des partis, situation économique, climat social, stabilité gouvernementale, sujets de préoccupation et paramètres institutionnels. Les partis peuvent évoluer, former des alliances, se scinder, émerger ou disparaître selon des règles et événements. Le joueur n’est pas la cause de tous les changements ; des événements nationaux se produisent même s’il se retire.

### 8.3 Temporalité historique

| Période | Contenu indicatif |
|---|---|
| Années 2000 | Presse écrite, télévision, réseaux politiques traditionnels |
| Années 2010 | Réseaux sociaux, nouvelles formes de militantisme et polémiques numériques |
| Années 2020 | IA, communication numérique avancée, controverses et crises environnementales |
| À partir de 2030 | Anticipation satirique et évolutions fictives |

Les dates d’apparition sont des paramètres de contenu, pas une obligation de reproduire l’Histoire réelle. Les crises inspirées de faits réels peuvent survenir autrement ou jamais. Les médias et outils d’une époque ultérieure ne doivent pas apparaître prématurément, sauf événement explicitement fictionnel prévu.

**Hypothèses provisoires de P3-07 (25 novembre 2026) :** quatre époques (2000, 2010, 2020, 2030). Les événements peuvent être réservés à certaines époques ; les technologies (vidéo sur le réseau fictif Piaf, community manager, assistant de rédaction automatique, meeting holographique…) restent invisibles avant la leur. Un même événement devient moins probable à chaque occurrence et ne revient pas plus de six fois par carrière. Volume du catalogue : 122 événements, à compléter selon les playtests (ARCHITECTURE §8.4 octies).

## 9. Médias et patrimoine

### 9.1 Presse et communication

Les médias fictifs ont une identité éditoriale, une audience, des relations avec les acteurs et des types d’événements privilégiés. Ils publient des actualités, invitent le joueur à des interviews, enquêtent, amplifient ou relativisent des controverses et font émerger des sujets publics. Les réactions varient selon les groupes et la situation.

Le fil d’actualité actualisé à chaque trimestre est à la fois un outil d’information et un support humoristique. Il distingue les informations critiques des nouvelles d’ambiance. Exemple de titre fictif : « Le ministre de la Sobriété énergétique inaugure sa troisième piscine chauffée. »

Le joueur peut entretenir des relations privilégiées avec certains médias et, s’il dispose de suffisamment de fortune, acquérir un média fictif. Un actif médiatique peut donner des revenus et un accès privilégié à certaines opportunités, sans garantir le contrôle de toute la presse ni annuler les autres contre-pouvoirs.

**Hypothèses provisoires de P3-03 (25 novembre 2026, contenu du lot D validé par le créateur) :** cinq médias fictifs (L’Horizon, Le Petit Populaire, Info Non-Stop, La Gazette fouineuse, Le Courrier du Bocage avec Radio Bocage FM), chacun avec sa ligne, son audience, ses lecteurs et une relation au joueur affichée sans chiffre. La presse régionale suit le joueur dès le début, la presse nationale à partir d’une certaine exposition. Chaque trimestre, le fil de presse couvre les affaires révélées, les promesses tenues ou trahies, les scrutins, les interviews, un train de vie fastueux et un éventuel rachat, plus une nouvelle d’ambiance ; un média bien disposé relativise, un média hostile durcit le ton, la satire n’est jamais favorable. Interviews et déjeuners améliorent les relations. Le Courrier du Bocage peut être racheté (actif patrimonial) : il devient bienveillant mais moins crédible, et les autres médias continuent d’écrire. Le joueur n’étant pas nommé, les titres restent impersonnels. Chiffres modifiables à l’équilibrage (ARCHITECTURE §8.4 sexies).

### 9.2 Patrimoine personnel

Le joueur peut acquérir des biens immobiliers, investir dans des entreprises, acheter des actifs médiatiques et améliorer son train de vie. Chaque actif est une amélioration avec coût, revenus passifs, charges, effets et événements éventuels. Pas de gestion détaillée des entreprises. L’enrichissement personnel constitue une trajectoire de jeu à part entière, y compris sans mandat.

Les conflits d’intérêts et actes douteux sont représentés par des choix abstraits et satiriques ; ils peuvent produire des avantages immédiats et alimenter les dossiers judiciaires, l’exposition, les tensions internes et les statistiques de bilan.

## 10. Justice et institutions

### 10.1 Affaires judiciaires

Le risque judiciaire ne déclenche pas directement une condamnation automatique. Les affaires sont des dossiers persistants qui peuvent progresser par étapes : révélation, enquête, mise en cause, procès, décision et éventuel appel. Plusieurs dossiers peuvent coexister. Certains concernent l’entourage et affectent le joueur sans impliquer nécessairement sa culpabilité.

Le joueur peut consacrer du temps et des ressources à sa défense, solliciter son conseiller juridique et prendre des décisions de communication. Les affaires peuvent affecter sa popularité, ses soutiens, sa santé et son éligibilité. Une peine d’inéligibilité ou une démission forcée ne met pas nécessairement fin à la partie ; une condamnation suffisamment grave peut le faire. Les règles de procédure sont fictives et volontairement simplifiées.

### 10.2 Institutions modifiables

Lorsqu’il détient les fonctions et soutiens nécessaires, le joueur peut tenter de modifier les règles du monde par des décisions narratives. Paramètres proposés : cumul des mandats, indépendance de la justice, transparence financière, règles électorales, liberté de la presse et pouvoirs des organismes de contrôle.

Les réformes ne sont pas nécessairement acceptées : elles dépendent du contexte et des contre-pouvoirs. Elles peuvent aussi survenir indépendamment du joueur. Leurs effets persistent au-delà des mandats et s’appliquent aux autres acteurs. Une décision institutionnelle autrefois avantageuse peut ainsi profiter à un rival devenu dirigeant.

**Hypothèses provisoires de P3-05 (25 novembre 2026, contenu du lot E validé par le créateur) :** cinq paramètres à trois niveaux (cumul des mandats, indépendance de la justice, transparence financière, mode de scrutin, liberté de la presse). Député, sénateur ou ministre, le joueur propose de déplacer un paramètre d’un cran ; le vote dépend du gouvernement, de l’appareil et de la stabilité. Adoptée, la réforme entre en vigueur au 1er janvier suivant, pour tous, et survit aux alternances ; rejetée, elle coûte de l’influence. Le gouvernement réforme parfois de lui-même. Les règles en vigueur pèsent sur les scrutins, les dossiers judiciaires, la presse et le cumul de tous les acteurs, et des événements en font profiter les rivaux. Chiffres modifiables à l’équilibrage (ARCHITECTURE §8.4 septies).

## 11. Événements narratifs

### 11.1 Principes

Le moteur doit combiner trois origines : événements personnels liés au joueur, événements relationnels liés aux personnages, événements nationaux indépendants ou indirectement influencés par lui. Le hasard est conditionné par la situation ; une chaîne peut se poursuivre sur plusieurs années.

Le contenu est écrit et édité à l’avance, paramétrable et réutilisable. Aucune IA générative n’est appelée pendant une partie. Les textes, protagonistes, effets, conditions, répétitions et suites s’adaptent au contexte. Les références à l’actualité restent des clins d’œil fictifs. Le catalogue est extensible indépendamment du moteur.

Répartition indicative de production : 70 % de situations paramétrables, 20 % de situations uniques travaillées et 10 % de chaînes narratives. Ces catégories peuvent se chevaucher techniquement ; le ratio n’est pas un quota de déclenchement. Prototype : 20 à 30 événements suffisent pour tester le moteur ; le volume V1 sera défini après les premiers essais.

### 11.2 Données d’un événement

Un événement doit pouvoir définir : identifiant stable, catégorie, titre, texte avec variables, protagonistes éligibles, conditions de déclenchement (date, fonctions, ressources, traits, relations, historique, état du monde), poids/probabilité, priorité, caractère bloquant, fenêtre temporelle, délai de réapparition, caractère unique éventuel, choix, aperçu des effets, conséquences immédiates ou différées, et événements de suivi. Les effets et conditions utilisent un vocabulaire déclaratif contrôlé par le moteur.

Le système doit garantir la cohérence : pas de personnage décédé dans un dialogue présent, pas d’action réservée à un mandat perdu, pas de choix qui suppose un actif absent, pas de texte avec variable non résolue. Les événements non éligibles sont écartés. Les événements bloquants ne sont jamais avalés par l’accélération. L’ajout de contenu ne doit pas casser une ancienne sauvegarde ; prévoir versions et identifiants durables.

### 11.3 Exemple de carte narrative

**Un poste pour la famille** — Un proche du personnage demande à rejoindre son organisation. Il possède un réseau intéressant, mais son expérience correspond mal au poste disponible.

- Accepter : avantages relationnels possibles ; conséquences financières et risque de controverse selon le contexte.
- Refuser : préserver le fonctionnement de l’organisation ; tensions familiales possibles.
- Proposer un recrutement ouvert : coût de temps et résultat incertain ; éventuelle amélioration de la confiance.

Un futur événement médiatique peut rappeler la décision si les conditions sont réunies. Ce modèle sert à plusieurs personnages et mandats sans réécrire le moteur.

## 12. Fin de partie et rejouabilité

La partie se termine lorsque le personnage meurt ou lorsqu’un événement terminal explicite survient. Exemples : décès naturel lié au vieillissement, décès prématuré lié à la santé ou au hasard, assassinat exceptionnel traité hors champ, condamnation grave entraînant une fin de carrière définitive. Les autres échecs ne sont pas automatiquement des fins : perte d’élection, inéligibilité temporaire, faillite, perte de poste ou scandale peuvent ouvrir une nouvelle trajectoire.

La fin présente une nécrologie satirique pour un décès, ou un article de bilan adapté à une autre cause. Elle résume l’âge, les mandats, la plus haute fonction, la fortune, les fonds détournés cumulés, les affaires judiciaires, les promesses, les relations et moments marquants. Des distinctions narratives non exclusives peuvent refléter le parcours (L’Intègre, Le Rentier, L’Indéboulonnable, Le Déchu, etc.). Il n’y a pas de score moral unique ni de victoire conventionnelle.

Chaque carrière est indépendante. Pas de déblocages entre les parties, de bonus, de monnaies permanentes ou de continuité dynastique en V1. Un archivage consultable des anciennes carrières est optionnel et reportable ; le bilan de fin de carrière, lui, est prévu. La rejouabilité doit être intéressante dès la première version sans aucun mécanisme de récompense externe.

## 13. Interface et direction artistique

Interface de gestion desktop-first, inspirée du contraste entre des documents administratifs solennels et un contenu absurde. Style institutionnel sobre : crème, bleu, accents rouges, typographies lisibles, icônes simples et éventuellement quelques portraits caricaturaux. Pas de carte complexe, animations de personnages ou mise en scène 3D. La version mobile n’est pas une priorité.

| Zone permanente | Contenu |
|---|---|
| En-tête | Date, âge, fonction principale, ressources et jauges essentielles |
| Navigation gauche | Tableau de bord, agenda, entourage, patrimoine, actualités ; accès contextuels à élections, justice et institutions |
| Zone centrale | Actions, décisions, dossiers et détails de gestion |
| Colonne droite | Fil de presse, alertes, prochaines échéances |

Le budget de temps restant et le bouton de passage de tour doivent rester accessibles. Les détails de soutien, coûts récurrents, relations et historiques apparaissent à la demande. Les choix narratifs utilisent des cartes avec texte, réponses et tendances prévisibles, sans exiger d’illustration. Ne pas faire dépendre l’humour d’assets graphiques coûteux ; les textes et titres de presse sont prioritaires. Les indicateurs ne reposent pas exclusivement sur la couleur.

## 14. Architecture : contraintes de conception

Les détails seront développés dans ARCHITECTURE.md ; les contraintes ci-dessous doivent être conservées.

- SvelteKit, TypeScript, Tailwind CSS et icônes Lucide ; build statique, sans backend applicatif ni base distante pour la V1.
- Moteur de simulation TypeScript séparé de l’interface ; état sérialisable et logique de tour testable sans navigateur.
- Catalogues JSON pour événements, actions, améliorations et données de l’univers. Valider les données au chargement ou au build ; ne pas exécuter de code arbitraire provenant des fiches de contenu.
- Générateur pseudo-aléatoire avec seed et état sauvegardé. À version de moteur/contenu identique, une même seed et les mêmes décisions doivent reproduire la même partie. Pas d’aléatoire dépendant du rendu UI.
- Sauvegarde locale versionnée, en particulier après validation et événements bloquants ; préserver les choix et l’état exact de la résolution pour éviter les doubles applications. Pas de calcul de progression hors ligne. Export/import de sauvegarde à envisager.
- Simulation accélérée et simulation automatique de test réutilisent le même moteur que le joueur.
- Outil de simulation de nombreuses carrières avec stratégies automatisées simples, pour mesurer les dérives et les problèmes de contenu. Les statistiques de test ne remplacent pas les essais humains.

## 15. Périmètre et ordre de développement

| Étape | Contenu | Critère de passage |
|---|---|---|
| Prototype | Profil fixe de 25 ans ; calendrier ; temps trimestriel ; ressources ; actions ; production récurrente élémentaire ; stress/santé ; événements (20–30) ; vieillissement ; fin et bilan minimal | Une carrière complète peut être jouée et comprise ; le rythme et les arbitrages sont testables |
| Alpha | Élections et mandats ; cumul ; partis et monde autonome simplifiés ; entourage nommé et délégation ; relations ; adversaires ; origine, profession et famille ; accélération fiable | Plusieurs parcours divergent réellement ; les systèmes partagent le même moteur de tour |
| V1 | Justice à dossiers ; patrimoine et médias ; promesses et décisions de gouvernement ; évolution des institutions ; terrain d’engagement et territoire d’origine ; catalogue enrichi ; UI et bilan final aboutis | Jeu stable, compréhensible, rejouable, cohérent avec la cible de durée et déployable statiquement |
| V2 éventuelle | Méta-progression narrative, archives enrichies, mobile ou autres extensions après tests | Hors périmètre actuel ; aucune dépendance de la V1 à ces fonctionnalités |

Le prototype peut utiliser une seule trajectoire politique simplifiée ou un mandat minimal pour tester l’accumulation sans développer tout le système électoral. La priorité est une boucle verticale jouable de bout en bout, pas un ensemble de modules incomplets.

## 16. Équilibrage et validation

Le jeu vise la tension entre la tentation et les conséquences, non une punition morale automatique. Les trajectoires honnêtes doivent être plus exigeantes mais réellement viables et produire leurs propres histoires. Les trajectoires opportunistes doivent procurer des avantages tangibles sans garantir le succès. Une défaite ou une période calme ne doit pas signifier une fin d’intérêt.

À mesurer pendant les tests : durée réelle des carrières, nombre de tours nécessitant une intervention, fréquence et répétition des événements, progression des ressources, diversité des plus hauts mandats, fortunes extrêmes, causes de fin, trajectoires honnêtes/opportunistes, fréquence des blocages financiers, délai de résolution des affaires et lisibilité des effets. Comparer des stratégies automatisées (prudente, ambitieuse, patrimoniale, mixte) et compléter par des playtests humains.

Exemple de contrainte de rythme : une carrière de 25 à 80 ans représente 220 trimestres. Pour tenir environ une heure, il est indispensable que de nombreux tours soient traités rapidement ou automatiquement, avec des pauses réservées aux décisions significatives. Ce calcul n’impose pas une espérance de vie fixe.

Critères de qualité pour le prototype : aucune ressource incohérente, aucun mandat incompatible, aucune résolution dupliquée, aucun événement concernant un acteur inéligible, sauvegarde/reprise fidèle, fin de partie atteignable, et diversité visible entre plusieurs seeds. Un scénario honnête doit être testé explicitement, même si son équilibrage définitif intervient plus tard.

## 17. Décisions encore ouvertes

Les orientations de jeu précédentes sont retenues comme base de travail. Les éléments ci-dessous doivent être tranchés lors du prototypage, de l’équilibrage ou de la rédaction des documents suivants ; Codex ne doit pas les présenter comme des règles déjà validées.

| Sujet | Question à résoudre |
|---|---|
| Économie | Valeurs initiales, production, prix, plafonds, coûts récurrents et gestion des déficits/dettes |
| Temps | Coût des actions, récupération, répartition des tâches déléguées, fréquence optimale des interruptions |
| Élections | Liste exacte des mandats, conditions d’éligibilité, durées, incompatibilités et modèle de scrutin simplifié |
| Soutiens | Nombre final de groupes, calcul de popularité et visibilité des détails |
| Entourage | Génération des profils, nombre maximal d’acteurs, évolution des relations et qualité des conseils |
| Justice | Délais, progression des dossiers, définition des sanctions terminales, équilibre des contre-pouvoirs |
| Santé | Courbes d’âge, stress, récupération et risque de décès ; empêcher les fins arbitraires trop fréquentes |
| Monde | Catalogue des partis, médias et institutions fictifs ; valeurs de départ et règles de transformation |
| Narration | Fréquence, nombre d’événements par tour, taille du catalogue V1, politique de répétition et chaînes |
| Création | Nombre de profils, options familiales, convictions initiales et génération des passés |
| Interface | Densité, graphismes, portraits éventuels, résolution desktop minimale et navigation finale |
| Fin | Texte, distinctions, règles de sélection du bilan ; éventuel archivage local sans méta-progression |

## 18. Documents suivants

- **ARCHITECTURE.md** : modèle d’état, moteur de tour, schémas JSON, aléatoire déterministe, sauvegardes et tests.
- **DESIGN.md** : identité visuelle, wireframes desktop, composants et principes d’accessibilité.
- **ROADMAP.md** : tâches et critères d’acceptation du prototype, de l’alpha et de la V1.

Le GDD reste la référence fonctionnelle. Les documents suivants peuvent préciser l’implémentation mais ne doivent pas modifier silencieusement les décisions de conception. Toute nouvelle fonctionnalité doit être évaluée selon son apport à la satire, aux arbitrages ou à la rejouabilité et selon son coût de développement.
