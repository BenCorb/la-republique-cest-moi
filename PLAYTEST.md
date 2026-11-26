# Playtests — La République, c’est moi !

Ce document consigne les essais humains. Les simulations CPU mesurent la cohérence et les dérives
des règles ; elles ne permettent pas de conclure qu’une carrière est agréable ou dure 45–60 minutes.

## P1-10 — Validation humaine du prototype

**Statut : session terminée et validée le 24 novembre 2026.** Le créateur a joué une carrière
complète avec la seed prévue jusqu’au bilan de fin.

### Protocole

1. Ouvrir une nouvelle carrière avec `?seed=playtest-p1-10` afin de rendre la session rejouable.
2. Jouer jusqu’au bilan, sans consulter les données internes ni les effets cachés.
3. Utiliser librement « Trimestre suivant », « Année suivante » et « Jusqu’à une alerte » ; noter
   les moments où l’accélération s’arrête trop souvent, trop tard ou sans raison comprise.
4. Mesurer le temps actif approximatif, hors installation et pauses longues.
5. Exporter la sauvegarde finale si une anomalie doit être reproduite.

### Résultats

- **Testeur et parcours :** créateur du jeu, carrière complète jusqu’au bilan avec
  `playtest-p1-10` dans le navigateur intégré. La durée active, l’âge et la cause de fin n’ont pas
  été chronométrés ou relevés ; la cible de 45–60 minutes reste donc à mesurer lors de P3-09.
- **Fonctionnement :** aucun bug rencontré. Les boutons sont réactifs, les fenêtres de décision
  s’affichent correctement et les actions essayées produisent le résultat attendu.
- **Base produit :** impression générale positive ; le prototype constitue une base solide et la
  boucle peut être menée de bout en bout.
- **Rythme et cohérence du plan :** après « Trimestre suivant », le plan est vidé, tandis que
  « Année suivante » et « Jusqu’à une alerte » conservent le plan récurrent. Cette différence est
  comprise techniquement mais ressentie comme incohérente et oblige à répéter les mêmes clics.
- **Lisibilité :** l’interface est jugée lourde et trop textuelle. Pour la V1, réduire les textes
  permanents, déplacer les explications secondaires vers des infobulles ou une aide contextuelle et
  rendre la composition du trimestre plus graphique.
- **Navigation :** étudier un espace de planification plus direct, éventuellement un onglet dédié,
  afin d’éviter de faire défiler la page pour retrouver l’agenda.
- **Réglage :** aucun signal du playtest ne justifie d’annuler le passage provisoire de
  `ordinaryEventChance` à `0,30`.

### Décision P1-10

P1-10 est validée : lots seedés, rapports JSON/CSV, invariants et fins analysés, puis carrière
humaine complète documentée. Le réglage `ordinaryEventChance = 0,30` est conservé provisoirement.
La dette UX n’empêche pas la validation du prototype : elle est reportée explicitement à P3-08 et
sera réévaluée par les playtests de P3-09.

## Alpha — Validation humaine avant la phase 3

**Statut : à jouer (prévu le 26 novembre 2026).** Version publiée :
https://bencorb.github.io/la-republique-cest-moi/ (`main`, règles `0.17.0`).

### Objectif

Vérifier, avant d’ajouter les systèmes de la phase 3, que le cœur de l’alpha tient en partie
réelle : rythme, lisibilité des nouveaux écrans et intérêt des choix de carrière. L’alpha est
jetable (décision du 25 novembre 2026) : une mise à jour peut rendre ces parties illisibles ;
exporter la sauvegarde pour garder une trace.

### Protocole

1. Jouer **deux carrières** aux profils contrastés, chacune avec une seed rejouable :
   - `?seed=playtest-alpha-1` : origine et profession au choix, en visant une carrière élective
     (candidatures, mandats, cumul) ;
   - `?seed=playtest-alpha-2` : un profil opposé, en jouant plutôt l’organisation, l’entourage
     ou la famille.
2. Jouer jusqu’au bilan si possible, sinon au moins 40 ans de carrière ; ne pas consulter les
   données internes.
3. Utiliser librement les trois commandes d’avance ; noter chaque arrêt d’accélération ressenti
   comme inutile, trop tardif ou incompris.
4. Chronométrer le temps actif (hors pauses) ; relever l’âge, la cause de fin et le sommet de
   carrière au bilan.
5. Exporter la sauvegarde finale ou celle d’une anomalie, avec la date de jeu concernée.

### Points à observer

| Sujet        | Question                                                                                                 | Mesure CPU de référence                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Rythme       | « Jusqu’à une alerte » s’arrête-t-il trop souvent pour les élections ?                                   | ≈ 25 arrêts d’élection par carrière avec un plan vide (P2-09)                                                 |
| Durée        | Une carrière entre-t-elle dans 45–60 minutes actives ?                                                   | 174 trimestres, 34 décisions par carrière (P2-10)                                                             |
| Création     | Les origines et professions donnent-elles des débuts différents et lisibles ?                            | —                                                                                                             |
| Carrière     | Candidature, campagne, sondages et résultat sont-ils compréhensibles ? La défaite est-elle surmontable ? | —                                                                                                             |
| Entourage    | Recrutement, missions et conseils sont-ils utiles et lisibles ?                                          | —                                                                                                             |
| Famille      | La vie de famille apparaît-elle assez ?                                                                  | ≈ 0,1 enfant par carrière en simulation (P2-08)                                                               |
| Organisation | Le regroupement et le départ d’un militant suffisent-ils ?                                               | —                                                                                                             |
| Plan         | Le plan reconduit convient-il, ou faut-il épingler les tâches une par une ?                              | Décision remplacée le 26 novembre 2026 : activités ponctuelles par défaut, épinglage explicite (PT-P3-09-011) |
| Répétition   | Des événements reviennent-ils trop souvent ?                                                             | 8 occurrences au plus par carrière (P2-10)                                                                    |
| Satire       | Le ton des partis et des événements fonctionne-t-il ? Des textes à revoir ?                              | —                                                                                                             |

### Résultats

_À compléter après la session : testeur, seeds, durée, âge et cause de fin, sommet de carrière,
bugs, irritants classés (bloquant, gênant, mineur) et décisions._

#### Retours en cours de session

- **Mairie et conseil municipal (26 novembre 2026, gênant).** Être à la fois maire et membre du
  conseil municipal est voulu (le maire est élu par le conseil parmi ses membres), mais le jeu
  compte deux mandats dans le cumul (2 places sur 3) et les affiche séparément. Correction
  retenue pour la série de corrections du playtest : compter « conseil municipal + mairie » pour
  un seul mandat dans le cumul et les afficher ensemble (« Mairie (et siège au conseil
  municipal) »). Temps réservé et indemnités restent cumulés. **Corrigé** (ARCHITECTURE §8.3
  undecies) : la mairie s’affiche sous le conseil municipal, hors du décompte du cumul.
- **Composer le plan est trop laborieux (26 novembre 2026, gênant).** L’agenda affiche une
  longue liste de cartes (≈ 18 actions), chacune avec description, coûts et effets, dans un ordre
  sans logique visible. Les actions inaccessibles y figurent aussi : actions des autres
  professions, actions de parti sans adhésion, actions de campagne sans candidature. Trouver
  l’action voulue demande de parcourir toute la liste. Pistes proposées :
  1. **Masquer ce qui est hors de portée.** Une action dont la condition n’est pas remplie
     (`condition_not_met` : autre profession, pas d’adhésion, pas de campagne, pas de mandat)
     disparaît de la liste ; un lien « Afficher les actions indisponibles » la montre à la
     demande, avec son motif. Une action seulement bloquée ce trimestre (temps, argent, limite
     atteinte) reste visible mais grisée, avec ce qui manque.
  2. **Regrouper par thème**, groupes déclarés dans le catalogue (`category` de chaque action) et
     repliables : militantisme, parti, campagne, réseau, finances politiques, revenus et métier,
     vie personnelle. Un groupe sans action disponible est masqué.
  3. **Lignes compactes** au lieu de cartes : nom, temps, coût et effet principal sur une ligne,
     bouton « + » ; description et détail des effets au survol ou en dépliant. Compteur
     « − 2 + » pour les actions répétables.
  4. Plus tard (P3-08) : épinglage des étapes du plan, aide contextuelle, composition plus
     graphique du trimestre.

  Recommandation : faire 1 à 3 dans la série de corrections du playtest (interface et catalogue,
  sans changement de règle) ; 4 reste en P3-08. **Corrigé** (pistes 1 à 3, ARCHITECTURE §8.3
  terdecies) : au début de carrière, l’agenda passe d’environ 18 cartes à une dizaine de lignes
  en cinq groupes, les autres actions étant consultables à la demande.

- **Budget politique trop difficile à faire grossir (26 novembre 2026, gênant).** Constat
  chiffré :
  - recettes avant un mandat national : collecte de 100 à 400 € pour 25 points de temps
    (influence 5 requise), fichier de donateurs à 120 € par trimestre (un seul), don depuis
    l’argent personnel (1 € pour 1 €), mission de collecte du trésorier (1 500 € à compétence 60,
    pour 1 000 € de salaire) ;
  - les mandats locaux (conseil municipal, mairie, conseil régional) et le ministère ne
    rapportent aucun budget politique ; seuls l’Assemblée (5 000 € par trimestre) et le Sénat
    (3 000 €) en rapportent ;
  - dépenses courantes de 300 à 1 500 € : réunion publique, meeting, salaires de l’entourage,
    attaché de presse ;
  - en simulation (P2-10), le budget est le goulot d’étranglement jusqu’au premier mandat
    national, puis déborde : budget final médian ≈ 45 000 € pour les stratégies élues, 430 €
    pour la stratégie patrimoniale, en charges impayées les trois quarts du temps.

  Pistes (réglages provisoires, à choisir) :
  1. **Moyens des mandats locaux** : mairie 600 €, conseil régional 300 €, conseil municipal 50 €
     par trimestre.
  2. **Remboursement des frais de campagne** : à partir de 5 % des voix, une partie des dépenses
     de campagne est remboursée après le scrutin (règle française, matière à satire).
  3. **Dotation du parti** : un adhérent investi reçoit une aide de campagne de son parti,
     selon la force de celui-ci.
  4. **Gala de levée de fonds** : action de milieu de carrière (influence 20) rapportant 1 000 à
     3 000 €, avec un risque d’événement sur les donateurs.
  5. **Collecte proportionnée** : son rendement croît avec l’influence ou le soutien des
     militants.
  6. **Trésorier plus rentable** : mission de collecte portée à 2 500 €.

  Recommandation : 1, 2 et 4 corrigent la marche d’escalier entre le début de carrière et le
  premier mandat national, sans rendre le budget gratuit ; vérifier ensuite par simulation que
  les charges impayées baissent sans que le budget déborde davantage.

  **Décision du créateur (26 novembre 2026) :** retenir les pistes 1 (moyens des mandats
  locaux), 2 (remboursement des frais de campagne) et 4 (gala de levée de fonds) pour la série
  de corrections du playtest, avec les chiffres ci-dessus comme point de départ ; les pistes 3, 5
  et 6 restent en réserve si la simulation montre que cela ne suffit pas.

  **Corrigé** (ARCHITECTURE §8.3 duodecies) : charges impayées fortement réduites en
  simulation. Deux points restent à régler : le budget des carrières élues déborde davantage
  (surtout par l’Assemblée), et des pics de budget font recruter des collaborateurs qu’on ne
  peut ensuite plus payer.

- **Presse impossible à consulter (26 novembre 2026, mineur).** La colonne « La presse », à
  droite, n’apparaît qu’à partir de 1 100 px de large et ne montre que les titres des six
  derniers événements, sans article ni archive ; il n’y a pas d’écran de presse. Comportement
  attendu de l’alpha : les médias fictifs, le fil de presse et les articles fondés sur les faits
  sont prévus en P3-03. Pistes d’ici là, si utile : un onglet « Actualités » qui reprend le fil
  complet avec le texte des événements (DESIGN §3), visible quelle que soit la largeur.

#### Tri des premiers retours (26 novembre 2026)

| Retour                                           | Avant la phase 3 ?  | Raison                                                                                                                                                                                                                                                                  | Taille                                            |
| ------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Composer le plan (masquer, regrouper, compacter) | **Oui, en premier** | La phase 3 ajoute des dizaines d’actions (défense, patrimoine, médias, promesses) : sans groupes ni filtre, l’agenda deviendra inutilisable. Mieux vaut poser la structure (`category` des actions) avant d’y verser du contenu.                                        | Moyenne (catalogue, projection, écran)            |
| Budget politique (pistes 1, 2, 4)                | **Oui**             | L’équilibre économique sert de base à tout le réglage de la phase 3 ; P3-02 traite la fortune personnelle, pas le budget politique. Remboursement forfaitaire par élection (sans suivi des dépenses, donc sans changement d’état), à valider par un lot de simulations. | Moyenne (catalogue, règle de scrutin, simulation) |
| Mairie et conseil municipal                      | **Oui**             | P3-05 rendra le plafond du cumul réformable : le modèle doit d’abord compter juste. Correction localisée (mairie hors du décompte du cumul, affichage commun).                                                                                                          | Petite                                            |
| Presse                                           | Non                 | P3-03 crée la vraie presse ; un écran intermédiaire serait refait. Au plus, afficher la colonne aussi sous 1 100 px.                                                                                                                                                    | Très petite si fait                               |

Ordre proposé : une pull request par correction (mairie, budget, agenda), chacune vérifiée et
publiée, puis reprise du playtest sur ces points avant P3-01. Restent à mesurer pendant la fin
du playtest : durée active, rythme des arrêts d’accélération, vie de famille, besoin
d’épinglage.

## P3-09 — Équilibrage : chronométrage de la V1

**Statut : à réaliser.** Le premier volet de P3-09 (ARCHITECTURE §8.4 undecies) a corrigé par
simulation les anomalies connues (budget des élus, recrutements impayables, dilemmes répétés,
stratégie intègre défaillante). Il reste à confronter ces réglages et le modèle de durée à des
parties réelles.

### Protocole

1. Jouer au moins deux carrières complètes jusqu’au bilan, avec deux styles différents : l’une
   intègre et prudente, l’autre ambitieuse ou opportuniste. Seeds suggérées : `?seed=p3-09-a` et
   `?seed=p3-09-b`.
2. Chronométrer le temps actif (hors pauses) et compter, même approximativement, les décisions
   et les arrêts d’accélération. Noter les arrêts jugés sans intérêt (candidatures reçues sans
   intention de recruter, échéances de scrutins jamais visés…).
3. Relever au bilan : âge, cause de fin, sommet de carrière, promesses tenues, affaires.
4. Noter si le budget politique manque ou s’accumule sans usage, et si la réserve de
   recrutement (deux trimestres de salaires) est comprise depuis son motif de refus.
5. Exporter la sauvegarde d’une anomalie, avec la date de jeu concernée.

### Points à observer

| Sujet         | Question                                                     | Mesure CPU de référence (P3-09, 500 carrières)                         |
| ------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Durée         | La carrière tient-elle en 45–60 minutes actives ?            | Modèle provisoire : 43 à 93 min en médiane selon la stratégie          |
| Interruptions | Quels arrêts d’accélération sont inutiles ?                  | 29 à 92 arrêts d’alerte et 35 à 60 décisions par carrière (médianes)   |
| Intégrité     | Une carrière honnête est-elle viable et intéressante ?       | Stratégie intègre : 0 fait, ministère dans 33 % des carrières          |
| Budget        | Le budget politique manque-t-il ou déborde-t-il ?            | Médiane finale : 1 100 à 19 500 €, sauf la prudente (137 000 €)        |
| Santé         | Les alertes de santé suffisent-elles à éviter l’épuisement ? | Stratégie ambitieuse : 92 % de morts d’épuisement vers 46 ans          |
| Répétition    | Un dilemme ou un événement revient-il trop souvent ?         | 6 occurrences au plus par dilemme ; 11 révélations judiciaires au plus |

### Retours en cours de session

- **PT-P3-09-001 — « Profession avant la politique » peu cohérente à 25 ans (26 novembre 2026,
  gênant, création et cohérence narrative).** Le personnage commence toujours à 25 ans : le choix
  d’une origine sociale fonctionne, mais « Profession avant la politique » suggère déjà une carrière
  professionnelle achevée avant l’engagement. Plusieurs descriptions renforcent cette impression
  (avocat aux honoraires confortables, entrepreneur avec société et salariés, haute administration et
  réseaux de cabinets). Le décalage fragilise la crédibilité du personnage dès l’écran de création.

  **Analyse :** dans les règles actuelles, ce choix n’est pas seulement un passé : il reste la
  profession du personnage et débloque des actions de métier pendant toute la partie. Le libellé de
  l’interface décrit donc mal le modèle. Trois réponses sont à distinguer :

  1. **Correction légère :** renommer le choix « Parcours à l’entrée en politique », « Situation
     professionnelle au début de la carrière » ou « Métier à 25 ans », et réécrire les profils comme
     des débuts de parcours (jeune avocat, première affectation, petite activité entrepreneuriale).
     Les règles et actions restent intactes.
  2. **Refonte du choix :** remplacer la profession par un « premier parcours » ou un « terrain
     d’engagement » (syndical, associatif, étudiant, service public, entreprise, presse…), davantage
     centré sur ce qui conduit vers la politique. Cela demanderait de revoir les actions conditionnées
     par la profession et les effets de départ.
  3. **Âges de départ variables :** réaliser P3-06 pour rendre crédibles les carrières déjà établies,
     avec un passé adapté à chaque âge. Cette option élargit fortement le périmètre et l’équilibrage ;
     elle ne résout pas à elle seule le statut du métier pendant la partie.

  **Recommandation provisoire :** privilégier d’abord la correction légère, qui aligne le texte sur
  les règles existantes. Utiliser la suite du playtest pour décider si le choix lui-même manque
  d’intérêt ou de personnalité ; dans ce cas seulement, étudier la refonte ou avancer P3-06.
  **Décision attendue du créateur.**

- **PT-P3-09-002 — Donner un territoire d’origine au personnage (26 novembre 2026, proposition
  produit, création, carrière et rejouabilité).** Ajouter à la création le choix d’une région réelle.
  La partie attribuerait au personnage un département réel de cette région et une commune fictive au
  nom français volontairement typé. Les candidatures et mandats citeraient ensuite ces territoires : commune aux
  municipales, département aux scrutins départementaux éventuels et région aux régionales. Le
  territoire pourrait aussi modifier la difficulté et créer des trajectoires différentes. Une
  mobilité ultérieure vers une grande ville, ou un parachutage électoral, est à explorer.

  **Écart avec le jeu actuel :** aucun territoire n’est stocké dans l’état. Les municipales et les
  régionales sont génériques ; les législatives et sénatoriales ont une portée nationale abstraite.
  Il n’existe ni élection départementale ni mandat de conseiller départemental. Ajouter ce dernier
  constituerait donc une nouvelle règle de carrière, pas un simple changement de texte.

  **Modèle proposé :**

  1. **Identité persistante :** `region`, `department` et `homeTown` sont déterminés à la création,
     sérialisés et réutilisés dans les campagnes, mandats, événements, presse et bilan. Régions et
     départements portent leurs vrais noms ; la commune et tous ses élus restent fictifs.
  2. **Commune caractérisée :** chaque commune possède une taille (bourg, petite ville, ville
     moyenne, banlieue, métropole) et deux ou trois traits (ouvrière, bourgeoise, rurale, touristique,
     industrielle, universitaire…). Son nom provient d’un catalogue toponymique ou d’un générateur
     seedé à fragments validés, jamais d’une génération IA au runtime. Le ton recherché n’est pas le
     calembour politique, mais une commune française fictive, plausible et légèrement caricaturale,
     avec des formes adaptées à la région. Exemples de direction : « Montfleur-sur-Aubette »,
     « Saint-Lysandre-des-Bois », « Villeneuve-les-Ormes », « La Roche-Basse ».
  3. **Difficulté sans choix dominant :** une grande zone apporte davantage de concurrence, des
     campagnes plus coûteuses et des rivaux plus solides, mais aussi plus de presse, de réseau et
     d’opportunités. Un petit territoire facilite l’implantation locale mais offre moins de relais
     nationaux. L’origine sociale interagit avec les traits de la commune, pas avec une région entière :
     un milieu populaire peut aider dans un bassin ouvrier et gêner dans une commune très bourgeoise.
  4. **Poids politique régional :** les partis peuvent avoir des forces territoriales qualitatives ou
     de petits modificateurs déclaratifs. Ceux-ci agissent sur l’investiture et le scrutin sans créer
     de simulation exhaustive de chaque électeur.
  5. **Mobilité ultérieure :** un déménagement coûte du temps et de l’argent, affaiblit l’ancrage
     local et peut rendre un ancien mandat incompatible. Un « parachutage » proposé par le parti
     donnerait une opportunité de grande ville avec un malus local et un bénéfice d’appareil.

  **Découpage recommandé :**

  - _Premier niveau, narratif_ : région choisie, département attribué, commune fictive, noms visibles
    partout ; aucun effet d’équilibrage.
  - _Deuxième niveau, systémique léger_ : taille et traits de commune modifient légèrement coûts de
    campagne, force du rival, soutiens et événements ; à valider par simulation.
  - _Extension_ : déménagement, parachutage, grandes villes réelles et élection départementale. Cette
    couche ajoute des mandats, calendriers, conditions, événements et règles de cumul.

  **Recommandation provisoire :** retenir les deux premiers niveaux ensemble comme une tâche de
  création enrichie, en commençant dans une commune fictive petite ou moyenne. Écarter les grandes
  villes réelles au départ évite qu’une mairie générique représente indifféremment Paris et un bourg ;
  leur accès ultérieur devient alors une progression intéressante. Utiliser un millésime figé du Code
  officiel géographique de l’Insee pour les régions et départements. Ne pas ajouter immédiatement les
  départementales ni les déménagements avant d’avoir validé l’intérêt du territoire de départ.

  **Traité par P3-16 (26 novembre 2026, ARCHITECTURE §8.4 quindecies)** : 13 régions actuelles,
  département attribué, commune fictive petite ou moyenne, effets légers ; pas de départementales,
  de déménagement ni de parachutage en V1.

  **Décisions attendues du créateur :** géographie actuelle simplifiée ou géographie de l’an 2000 ;
  métropole seulement ou outre-mer inclus ; département choisi ou attribué ; grandes villes réelles
  exclues au départ ou disponibles en mode difficile ; ajout futur ou non des départementales.

- **PT-P3-09-003 — Territorialiser la presse selon la carrière (26 novembre 2026, proposition
  produit, médias, cohérence et progression).** La presse doit refléter l’ancrage territorial du
  personnage : au moins un journal fictif propre à chaque région réelle, aux côtés de plusieurs
  médias nationaux. Les interlocuteurs, articles et possibilités d’interview évoluent avec la portée
  de la carrière. Le nom des titres régionaux doit être plaisant et crédible, sans calembour politique,
  dans la même direction que les communes fictives.

  **Écart avec le jeu actuel :** quatre médias sont nationaux et un seul média local, Le Courrier du
  Bocage, représente toute la presse régionale. Il suit le joueur dès le début ; les nationaux ne le
  suivent qu’à partir d’un seuil d’exposition. Les relations, interviews, articles, événements et le
  rachat d’un média référencent aujourd’hui des identifiants fixes.

  **Modèle proposé :**

  1. **Catalogue national stable :** conserver plusieurs titres nationaux aux lignes distinctes
     (référence, populaire, chaîne d’information, hebdomadaire satirique). Ils couvrent surtout les
     mandats nationaux, les fortes expositions et les affaires importantes.
  2. **Un quotidien par région au minimum :** chaque région réelle possède un titre fictif écrit à la
     main, avec sa ligne, son audience, ses groupes lecteurs et quelques gabarits de titres. Direction
     de ton à affiner : « La Vigie armoricaine », « Le Courrier des Falaises », « L’Écho des Marches »,
     « Le Réveil des Monts », « Le Midi des Vallées ». Ces noms évoquent un territoire sans être des
     plaisanteries politiques.
  3. **Pertinence territoriale :** le média de la région d’ancrage suit le joueur dès le début. Une
     municipale, un mandat local ou un événement de commune est d’abord couvert régionalement. Une
     régionale intéresse fortement le titre de la région ; une législative, un mandat parlementaire,
     un ministère ou une affaire très exposée attirent progressivement la presse nationale.
  4. **Relations différenciées :** les actions d’interview et de relation ne proposent que les médias
     plausiblement accessibles. La relation avec le journal régional persiste lors de l’ascension : il
     peut rester favorable à « l’enfant du pays », devenir critique ou raconter son parachutage. Les
     nationaux apparaissent à mesure que l’exposition ou le rang de mandat augmente.
  5. **Couverture croisée :** un fait local peut devenir national s’il est grave ou très exposé ; un
     événement national peut être repris sous un angle régional. La presse régionale ne disparaît donc
     pas lorsque la carrière devient nationale, mais son poids relatif diminue.
  6. **Déménagement et parachutage :** un changement de région ouvre le nouveau titre régional sans
     effacer les anciennes relations. Le nouveau média peut accueillir le personnage avec méfiance ;
     celui de la région quittée peut continuer à suivre sa carrière.

  **Conséquence technique importante :** Le Courrier du Bocage est actuellement référencé directement
  par des événements et par l’actif achetable de presse locale. Il faudrait introduire un rôle stable
  de type « média régional d’ancrage » résolu vers le titre de la partie, ou créer des variantes
  régionales validées. Le rachat doit concerner un titre précis, pas abstraitement toute la presse de
  la région.

  **Recommandation provisoire :** intégrer cette évolution à la même tâche que le territoire. Garder
  les médias nationaux existants, créer un titre régional par région retenue et faire dépendre leur
  accessibilité du territoire, de l’exposition et du mandat. Reporter les radios, télévisions locales
  supplémentaires et les réseaux complets de groupes de presse : un quotidien régional distinct
  suffit d’abord à donner une identité forte sans saturer l’interface.

  **Décisions attendues du créateur :** nombre de régions prises en charge au premier lot ; un seul
  média régional représentatif ou plusieurs par région ; possibilité de racheter son journal régional ;
  seuils auxquels la presse nationale commence puis domine la couverture.

- **PT-P3-09-004 — Lancer une recherche ciblée de collaborateurs (26 novembre 2026, proposition
  produit, entourage, stratégie et dépense du budget).** Pour un poste vacant, permettre au joueur de
  commander une recherche de profils en précisant les caractéristiques recherchées. Plus la demande
  est précise et documentée, plus elle coûte du temps et du budget politique et plus son résultat est
  tardif. Les candidats trouvés complètent les profils proposés automatiquement.

  **Écart avec le jeu actuel :** chaque poste débloqué et vacant reçoit automatiquement trois
  candidats contrastés au trimestre suivant : profil expérimenté et franc, profil peu expérimenté
  mais connecté, profil brillant et ambitieux. Le joueur ne choisit ni la composition de cette liste
  ni le niveau de vérification des informations. L’embauche coûte dix points de temps et exige une
  réserve de deux trimestres de salaires, mais la recherche elle-même est gratuite.

  **Boucle proposée :**

  1. Depuis un poste vacant, « Lancer une recherche » ouvre un formulaire court. Le poste est déjà
     connu ; le joueur choisit zéro à trois priorités parmi un niveau de compétence, un trait visible
     recherché (charisme, réseau, ambition, franc-parler), une expérience ou un ancrage territorial,
     et un niveau de vérification du dossier.
  2. L’interface annonce avant validation le coût en temps, le coût politique, le délai estimé, le
     nombre probable de candidats et le risque que la recherche n’aboutisse pas. Chaque critère
     supplémentaire augmente le coût et peut réduire le vivier ; une recherche très étroite n’est donc
     pas automatiquement meilleure.
  3. La commande est inscrite dans l’état avec son échéance. À la date prévue, le moteur génère de
     manière seedée un ou plusieurs candidats conformes autant que possible. L’accélération s’arrête
     pour signaler les résultats. Les candidats ciblés s’ajoutent à la présélection existante dans une
     limite lisible ; ils ne remplacent pas silencieusement les personnes déjà proposées.
  4. Une recherche infructueuse reste possible lorsque les critères sont trop rares. Une partie du
     coût est alors perdue ; le joueur peut élargir la demande ou attendre avant de recommencer.

  **Niveaux possibles, chiffres à équilibrer :**

  - _Recherche simple_ : poste seulement, peu coûteuse, résultat rapide et informations ordinaires.
  - _Recherche ciblée_ : un ou deux critères publics, coût et délai intermédiaires.
  - _Chasse de tête_ : critères exigeants et dossier mieux vérifié, coût élevé, délai plus long et
    éventuellement prime de recrutement, sans garantie de résultat.

  **Informations cachées :** loyauté, opportunisme, indiscrétion, rancune et vénalité ne doivent pas
  devenir des filtres certains. Le joueur peut demander des références ou une enquête de réputation :
  cela révèle davantage d’indices ou réduit le nombre de traits inconnus, avec une fiabilité liée au
  niveau de vérification. Un cabinet coûteux peut mieux enquêter, jamais garantir la personnalité
  réelle d’un candidat.

  **Interactions possibles :** une direction de cabinet compétente réduit le temps de recherche ; un
  bon réseau augmente le vivier ; une implantation régionale permet de chercher un profil local ; une
  relation ou un parti peut recommander quelqu’un, au prix d’une possible dette politique.

  **Recommandation provisoire :** conserver les trois candidatures automatiques pour que l’entourage
  reste accessible, puis ajouter une recherche ciblée optionnelle qui complète la liste. Commencer
  avec compétence, un trait public et vérification du dossier ; reporter les critères territoriaux et
  politiques jusqu’à l’intégration du système de régions. Cette fonctionnalité crée aussi un usage
  intéressant du budget politique excédentaire des carrières installées.

  **Conséquences techniques :** nouvel état de recherche en cours et sauvegardé, nouvelle commande ou
  action paramétrée, résolution différée déterministe, arrêt d’accélération, projection de coût et
  écran de critères. Des tests doivent couvrir sauvegarde/reprise, résultat sans candidat, limites de
  liste, absence de fuite des traits cachés et résolution unique de la recherche.

  **Décisions attendues du créateur :** critères disponibles au premier lot ; recherche payée sur le
  budget politique ou personnel ; durée exprimée seulement en temps d’agenda ou aussi en trimestres ;
  ajout ou remplacement des candidats existants ; possibilité d’échec complet.

- **PT-P3-09-005 — Faire dépendre les candidatures et l’acceptation de l’attractivité politique
  (26 novembre 2026, incohérence gênante et proposition produit, entourage).** Un personnage encore
  peu influent et peu populaire ne devrait pas recevoir spontanément la candidature de profils
  exceptionnels. Une recherche ambitieuse peut néanmoins identifier un candidat de premier plan,
  mais celui-ci doit pouvoir refuser l’offre si la carrière, le poste ou les moyens proposés ne lui
  paraissent pas assez intéressants.

  **Écart avec le jeu actuel :** dès qu’un poste est débloqué, la présélection contient toujours un
  profil expert à 65–90 de compétence, un profil connecté à 15–40 et un profil brillant à 60–85. Le
  rang du mandat, la popularité et le niveau d’influence ne changent pas cette qualité. Une embauche
  valide réussit automatiquement dès que le poste est libre et que la réserve salariale est couverte ;
  le candidat ne prend jamais de décision.

  **Attractivité de la carrière :** calculer une valeur interne et explicable à partir de l’influence,
  de la popularité, du mandat principal, de l’appui de l’appareil, de la solidité du budget et, plus
  tard, de l’implantation territoriale. Elle ne constitue pas une nouvelle jauge morale. L’interface
  peut la résumer qualitativement (« structure émergente », « équipe reconnue », « cabinet très
  recherché ») et expliquer les principaux facteurs.

  **Effet sur le vivier spontané :**

  - une carrière émergente attire surtout des profils juniors, locaux ou en recherche d’une première
    occasion ;
  - une carrière installée attire des professionnels confirmés et davantage de profils spécialisés ;
  - un mandat national, une forte influence ou une perspective de pouvoir rend les profils les plus
    compétents accessibles ;
  - les candidats exceptionnels restent possibles au début seulement par une raison narrative claire
    (relation personnelle, conviction, ancrage local, recommandation ou événement), pas dans chaque
    présélection automatique.

  **Recherche ambitieuse et acceptation :** la recherche ciblée de PT-P3-09-004 peut dépasser le
  vivier spontané. Elle affiche alors séparément la chance de trouver le profil et son intérêt estimé
  pour le poste. À l’embauche, l’acceptation dépend de l’attractivité de la carrière, du prestige du
  poste, de la relation éventuelle, de la compétence et de l’ambition du candidat, puis d’un aléa
  seedé et borné. Un écart important peut produire un refus du type « votre projet est intéressant,
  mais pas encore à ce stade de ma carrière ».

  **Leviers donnés au joueur :** éviter un refus purement arbitraire en proposant une estimation
  qualitative et quelques moyens de convaincre : consacrer davantage de temps à l’entretien, verser
  une prime ponctuelle, proposer le salaire variable décrit dans PT-P3-09-006, mobiliser une relation
  ou promettre une mission valorisante. En cas de refus, le temps d’entretien est perdu, mais la prime
  n’est payée qu’en cas d’acceptation.

  **Progression des collaborateurs :** permettre aux profils juniors de gagner progressivement en
  compétence ou de révéler un potentiel donne une vraie alternative au recrutement d’une vedette. Un
  collaborateur formé depuis les débuts peut être moins performant immédiatement, mais plus loyal et
  mieux intégré qu’une recrue prestigieuse et ambitieuse.

  **Extensions possibles :** candidats sollicités par plusieurs équipes, débauchage par un rival,
  réputation d’employeur après des salaires impayés ou des renvois répétés, recommandations du parti,
  fidélité à un territoire et ambitions de promotion. Ces éléments doivent rester des événements ou
  modificateurs légers, pas devenir un simulateur de ressources humaines complet.

  **Recommandation provisoire :** mettre en œuvre ensemble (1) un vivier automatique gradué par
  attractivité, (2) une estimation d’intérêt visible et (3) un test d’acceptation lors des recrutements
  trop ambitieux, avec temps supplémentaire et prime comme premiers leviers. Ajouter ensuite la
  progression des juniors. Cette combinaison crée du défi tout en donnant au joueur des moyens de
  construire son équipe plutôt que de subir des refus opaques.

  **Conséquences techniques :** règles de génération dépendantes de l’état, attente minimale des
  candidats, issue d’embauche pouvant être un refus, prévision qualitative sans dévoiler les traits
  cachés, journal et arrêt d’accélération, évolution éventuelle de la compétence. Les tests doivent
  vérifier qu’une faible attractivité ne génère pas systématiquement d’experts, qu’un refus ne débite
  pas la prime, que la même seed reproduit l’issue et qu’une embauche refusée n’est jamais appliquée
  deux fois après sauvegarde/reprise.

  **Décisions attendues du créateur :** facteurs exacts de l’attractivité ; plafond strict ou rareté
  seulement pour les experts en début de carrière ; leviers de négociation retenus ; départ immédiat
  ou maintien temporaire dans la liste après un refus ; progression ou non de la compétence en poste.

- **PT-P3-09-006 — Lier le salaire à la compétence et faire évoluer la masse salariale (26 novembre
  2026, direction souhaitée par le créateur, entourage, économie et progression).** Les candidats peu
  compétents doivent pouvoir former une équipe de départ imparfaite mais abordable. À mesure que le
  personnage gagne en influence, il peut attirer des pointures nettement plus efficaces, dont le
  salaire récurrent devient un véritable coût politique. L’évolution de la qualité de l’équipe et de
  sa masse salariale doit rendre la montée en puissance perceptible.

  **Écart avec le jeu actuel :** le salaire dépend uniquement du poste : 1 000 à 1 500 € par trimestre
  selon la fonction. Un candidat à 20 de compétence et un candidat à 90 coûtent donc exactement la
  même somme. Les effets de mission sont déjà proportionnels à la compétence et les mauvais conseils
  plus probables chez un collaborateur faible, mais le recrutement du meilleur profil disponible est
  presque toujours optimal à coût égal.

  **Modèle salarial proposé :**

  1. Chaque poste conserve un salaire de référence. Chaque candidat possède une prétention salariale
     visible, calculée à partir de sa compétence, de son expérience, de certains traits publics et de
     la tension du recrutement. Des bornes par poste évitent les valeurs absurdes.
  2. Le salaire convenu est enregistré sur le collaborateur, et non relu depuis le poste. La réserve
     exigée à l’embauche, les prélèvements trimestriels, les alertes d’impayé et la projection de
     budget utilisent tous ce montant réel.
  3. Un junior coûte nettement moins que le tarif de référence, un profil confirmé s’en approche et
     une pointure peut coûter plusieurs fois plus. Les chiffres exacts restent à équilibrer par
     simulation ; les écarts doivent être assez forts pour rendre une équipe d’experts difficile à
     maintenir, même pour une carrière avancée.
  4. L’offre salariale devient un levier d’acceptation : proposer moins que les prétentions augmente
     le risque de refus et dégrade l’attitude ; proposer davantage aide à convaincre et fidéliser,
     sans rendre accessible n’importe quel expert à un personnage insignifiant. L’attractivité de
     PT-P3-09-005 reste un filtre distinct que l’argent ne peut compenser entièrement.

  **Progression et augmentations :** un collaborateur junior peut progresser grâce à l’ancienneté, à
  ses missions ou à une action de formation. Son salaire ne monte pas silencieusement chaque
  trimestre : lorsqu’il franchit un palier ou reçoit une offre extérieure, un événement de
  renégociation demande une augmentation. Accepter alourdit durablement la masse salariale ; refuser
  dégrade la relation et augmente le risque de départ ou de débauchage. Cela empêche de conserver
  indéfiniment une future pointure à son tarif de débutant.

  **Arbitrages recherchés :**

  - plusieurs juniors bon marché, avec une production faible et des conseils moins fiables ;
  - une ou deux personnes très compétentes qui absorbent une grande part du budget ;
  - une équipe mixte, avec des titulaires solides et des profils à former ;
  - une pointure recrutée trop tôt, efficace mais susceptible de provoquer des impayés et des départs
    dans le reste de l’équipe.

  **Interface :** chaque candidature affiche la compétence connue, les traits connus, le salaire
  demandé, le coût de la réserve et l’intérêt estimé pour le poste. L’écran de l’entourage montre la
  masse salariale totale, son évolution prévue et le nombre de trimestres couverts par le budget.
  Une négociation doit rester courte : offre standard, offre réduite ou offre généreuse, plutôt qu’un
  réglage au centime.

  **Conséquences techniques :** ajouter le salaire contractuel à `StaffMember` et au schéma de
  sauvegarde ; remplacer le salaire fixe du poste dans la réserve, la paie, les alertes et la
  projection ; faire porter l’offre par l’action d’embauche ; ajouter les renégociations différées et
  la progression éventuelle de compétence. Les simulations doivent suivre masse salariale, niveau
  moyen de l’équipe, impayés, refus, augmentations et départs par stratégie.

  **Décision acquise :** le salaire varie selon le candidat et les pointures représentent un coût
  politique récurrent sensiblement supérieur. **Décisions restant à prendre :** formule et amplitudes ;
  négociation libre ou trois offres prédéfinies ; rythme de progression des juniors ; conditions et
  fréquence des demandes d’augmentation.

- **PT-P3-09-007 — Retirer automatiquement du plan les activités devenues impossibles (26 novembre
  2026, décision souhaitée par le créateur, agenda et accélération).** Lorsqu’une activité déjà
  planifiée n’est plus faisable, elle ne doit plus rester dans l’agenda sous forme de ligne rouge avec
  une erreur. Le jeu la retire immédiatement du plan et indique brièvement pourquoi.

  **Écart avec le jeu actuel :** à la reconduction, les achats, les étapes ponctuelles et les actions
  dont la cible n’existe plus sont déjà retirés. En revanche, une action devenue impossible par une
  condition non remplie, un manque de temps, une limite de répétition ou des ressources insuffisantes
  reste épinglée. Le plan devient rouge et bloque le trimestre ou arrête l’accélération jusqu’à une
  correction manuelle.

  **Comportement proposé :**

  1. Après chaque passage de trimestre et chaque changement qui affecte le plan, revalider les étapes
     dans leur ordre d’exécution.
  2. Retirer la première étape invalide, recalculer le plan restant, puis recommencer jusqu’à obtenir
     un plan valide. Cette boucle évite de supprimer plusieurs étapes uniquement parce qu’une étape
     antérieure consommait trop de temps ou de ressources.
  3. Une étape retirée perd aussi son épinglage : elle ne revient pas automatiquement au trimestre
     suivant. Le joueur pourra la replanifier lorsque la situation le permettra.
  4. Si une action répétée n’est faisable que deux fois sur trois, conserver les deux occurrences
     valides et retirer seulement la troisième.
  5. Remplacer l’erreur rouge par une notice groupée et non bloquante, par exemple « Plan ajusté :
     Meeting retiré — budget politique insuffisant ». Le motif reste consultable sans exiger d’action.

  **Composition manuelle :** une nouvelle activité déjà impossible ne doit pas être ajoutée puis
  affichée en rouge ; la commande est refusée avec son motif. Si l’ajout d’une étape rend une étape
  suivante invalide, seule l’étape devenue excédentaire est automatiquement retirée après recalcul.

  **Accélération :** le nettoyage automatique ne doit plus provoquer un arrêt `invalid_plan` tant
  qu’il reste au moins une activité valide. Les retraits sont mentionnés dans le résumé. Si le plan
  devient entièrement vide, arrêter l’accélération et prévenir le joueur afin d’éviter de faire
  défiler plusieurs années sans activité par inadvertance.

  **Décision acquise :** toute activité infaisable est retirée automatiquement du plan actif, y
  compris lorsqu’elle était épinglée ; aucun nettoyage manuel d’une ligne rouge n’est demandé.
  **Décisions restant à prendre :** niveau visuel de la notice et conservation éventuelle d’un
  historique des retraits dans le journal.

  **Traité par P3-11 (26 novembre 2026, ARCHITECTURE §8.4 duodecies)** : notice groupée dans le
  plan et en bandeau ; lignes « Plan ajusté » au journal, conservées pour la session seulement
  (choix provisoire).

  **Conséquences techniques :** élargir le nettoyage de `carryOverPlan` aux conditions, limites,
  temps et ressources ; recalculer après chaque retrait ; appliquer la même règle dans le contrôleur
  et l’accélération ; remplacer le test d’arrêt sur plan récurrent invalide. Les tests doivent couvrir
  retraits en cascade, occurrences répétées, plan devenu vide, notice explicative et comportement
  identique après sauvegarde/reprise.

- **PT-P3-09-008 — « Un poste pour la famille » n’embauche pas réellement le proche (26 novembre
  2026, anomalie gênante, événement, famille et entourage).** Le choix « Le recruter » affirme qu’un
  membre de la famille obtient un poste, mais ce personnage n’apparaît ensuite jamais dans
  l’entourage. L’événement doit être lié à un poste précis et créer un véritable collaborateur
  persistant. Si le poste est déjà occupé, le joueur peut éventuellement choisir de remplacer son
  titulaire, avec toutes les conséquences correspondantes.

  **Cause racine confirmée :** l’événement `personal.family_job_request` est éligible dès que le
  joueur possède une amélioration (`upgrades.owned >= 1`), sans vérifier les postes d’entourage. Son
  choix `hire` ne contient aucun effet d’embauche : il modifie l’influence, le budget, la relation et
  les soutiens, inscrit un fait d’emploi fictif et programme la rumeur médiatique. Le moteur rejette
  explicitement `hireStaff` dans un événement, car cet effet exige aujourd’hui une cible de
  présélection dans le plan. Le texte, le GDD et l’état métier ne sont donc pas reliés.

  **Comportement proposé :**

  1. L’événement ne peut apparaître que s’il existe au moins un poste d’entourage débloqué. Lors de sa
     création, il se lie de manière déterministe à un poste précis, cité dans le texte et les choix.
  2. Priorité à un poste vacant. « Le recruter à la communication » transforme le proche déjà présent
     dans la distribution en véritable `StaffMember`, avec sa compétence, ses traits, son salaire et
     une mission initiale. Il apparaît immédiatement dans l’entourage et produit à partir du trimestre
     suivant, comme toute recrue.
  3. Si tous les postes accessibles sont occupés, l’événement peut proposer explicitement « Remplacer
     [titulaire] par [proche] ». Le titulaire est alors réellement renvoyé, conservé dans l’historique
     des anciens collaborateurs et affecté dans sa relation au joueur. Aucun remplacement silencieux.
  4. Le proche recruté perd son statut de simple demandeur d’emploi, reçoit les étiquettes du poste et
     participe ensuite aux missions, salaires, impayés, départs, affaires judiciaires et événements de
     l’entourage. Le fait d’emploi fictif et la rumeur de népotisme ne sont enregistrés que si
     l’embauche a réellement eu lieu.
  5. « Organiser une sélection ouverte » peut ajouter le proche comme candidat réel à la liste du
     poste ou lancer la recherche de PT-P3-09-004, sans garantir qu’il soit finalement choisi.
     « Refuser » conserve les seules conséquences familiales.

  **Lien avec les nouvelles règles d’entourage :** le népotisme peut contourner l’attractivité de
  PT-P3-09-005 puisque le proche demande lui-même le poste, mais il ne contourne ni le salaire variable
  de PT-P3-09-006 ni les charges récurrentes. Un proche peu compétent peut ainsi être bon marché mais
  médiocre ; un proche compétent peut coûter cher. S’il remplace une pointure, la perte de production
  doit être réelle et visible.

  **Recommandation :** corriger l’événement au niveau métier plutôt que changer son texte. Introduire
  un effet déclaratif contrôlé permettant d’affecter l’acteur d’un événement à un poste lié à
  l’instance, avec une branche de remplacement explicite. Ne pas simuler l’embauche par un simple bonus
  ou en ajoutant seulement le proche à la liste des relations.

  **Conséquences techniques :** condition de poste débloqué et vacant ou occupé, poste lié à
  l’instance d’événement, variable de texte pour le poste et le titulaire, effet d’affectation d’un
  acteur, transition de l’ancien titulaire, mise à jour des étiquettes du personnage, salaire
  contractuel, invariants et sauvegarde. Un test de scénario doit prouver qu’après le choix le même
  identifiant de personnage figure dans la famille, les relations et l’entourage, produit seulement à
  T+1, et n’est jamais embauché deux fois après reprise d’une sauvegarde.

  **Décision acquise :** accepter le recrutement doit créer un vrai membre de l’entourage sur un poste
  déterminé ; un poste occupé peut être remplacé seulement après un choix explicite. **Décisions
  restant à prendre :** priorité de sélection du poste lorsqu’il y en a plusieurs et maintien ou non
  de l’option de remplacement lorsque tous les postes sont occupés.

- **PT-P3-09-009 — Le service du donateur crée du favoritisme sans pouvoir public (26 novembre
  2026, anomalie gênante, événements, justice et cohérence de carrière).** Après avoir accepté le
  chèque douteux d’un donateur, le personnage reçoit « Un petit service » et peut commettre un fait de
  favoritisme en passant un appel au sujet d’un permis de construire, même s’il n’exerce aucune
  fonction et ne détient aucun mandat. Accepter un financement occulte peut être illégal sans mandat ;
  attribuer ou faire attribuer un permis par favoritisme suppose en revanche un pouvoir public que
  l’état du personnage ne garantit pas.

  **Cause racine confirmée :** `finance.generous_donor` est accessible à partir de 15 points
  d’influence. « Accepter le chèque » inscrit correctement un fait de financement occulte et programme
  `finance.donor_favour` trois trimestres plus tard. Cette suite n’a aucune condition de mandat et son
  choix « Passer le coup de fil » inscrit directement `offense.favoritism`. Le moteur réévalue bien la
  condition d’une suite lorsqu’elle arrive, mais il ne peut rien annuler ici puisque le contenu n’en
  déclare aucune. Il applique ensuite l’infraction demandée sans vérifier que le personnage possède
  l’autorité nécessaire.

  **Comportement proposé pour cette chaîne :** conserver le chèque et la dette envers le donateur,
  mais adapter sa demande au pouvoir réellement détenu au moment de la suite. Avec un pouvoir local
  pertinent, le permis, le marché ou la subvention peuvent constituer du favoritisme. Sans fonction,
  le donateur peut demander une mise en relation ou un soutien public, mais ce geste ne doit pas être
  qualifié automatiquement de favoritisme. Si aucune variante cohérente n’est prévue, la demande est
  différée jusqu’à l’obtention d’un pouvoir approprié ou remplacée par un événement qui solde la dette
  autrement. La branche de refus doit rester disponible dans tous les cas.

  Ne pas corriger uniquement avec `player.mandates >= 1` : le type de pouvoir compte. Un conseiller ou
  un député ne signe pas nécessairement un permis municipal. Pour la V1, l’option la plus simple est
  une variante liée à la mairie, disponible lorsque le personnage est maire, et une variante sans
  infraction publique lorsqu’il ne dispose d’aucun levier institutionnel. Ajouter une infraction
  distincte de trafic d’influence pourrait couvrir certaines intercessions, mais ce serait une
  extension du système judiciaire à valider séparément.

  **Consolidation générale des événements judiciaires :** associer chaque infraction à une capacité
  métier explicite, puis vérifier cette capacité dans la condition de l’événement ou du choix :

  - le financement occulte requiert seulement une activité ou une organisation politique capable de
    recevoir des fonds ;
  - le favoritisme requiert un pouvoir réel sur le marché, le permis ou la subvention concernés ;
  - la prise illégale d’intérêts requiert une décision publique ou une fonction précise ;
  - l’emploi fictif requiert un poste et une embauche effectivement créés, conformément à
    PT-P3-09-008 ;
  - l’abus de biens sociaux requiert l’existence d’une organisation et de fonds dont l’usage peut être
    détourné.

  L’audit ciblé montre un second cas certain : `finance.gala_table` permet de « glisser un mot en
  commission » et inscrit du favoritisme avec seulement de l’influence et du soutien patronal. Les
  événements de conflit d’intérêts et d’usage des fonds doivent aussi être revus selon la même grille,
  même lorsqu’ils paraissent narrativement plausibles. Chaque choix qui appelle `recordFact` doit être
  testé dans un état minimal où l’infraction est impossible, puis dans l’état institutionnel précis où
  elle devient possible. Les suites différées doivent refaire ce contrôle à leur échéance, car le
  personnage peut avoir obtenu ou perdu un mandat entre les deux événements.

  **Recommandation technique :** documenter les capacités exigées par les infractions dans le contenu
  judiciaire ou dans une table de règles du moteur, puis faire valider les événements concernés. Une
  validation statique peut repérer les choix sans prérequis ; des tests de scénario doivent compléter
  ce contrôle lorsque la condition dépend du contexte. Le moteur devrait au minimum refuser de créer
  un fait dont la capacité obligatoire est absente, afin qu’une future erreur de catalogue ne produise
  pas silencieusement une affaire incohérente.

  **Décision acquise :** une infraction liée à l’exercice d’un pouvoir public ne peut être créée que si
  le personnage détient effectivement le pouvoir correspondant ; l’influence informelle ne suffit
  pas. **Décisions restant à prendre :** variante sans mandat ou report de la demande du donateur ;
  ajout éventuel du trafic d’influence ; niveau de précision des capacités institutionnelles dans le
  catalogue et le moteur.

- **PT-P3-09-010 — Contextualiser les promesses selon la candidature visée (26 novembre 2026,
  suggestion importante, élections, promesses et immersion).** Les promesses électorales paraissent
  trop génériques et doivent être réellement liées à la candidature pour laquelle le personnage se
  présente. Une campagne municipale, régionale, législative ou sénatoriale ne doit pas proposer les
  mêmes engagements sous le même intitulé, ni laisser entendre que le futur élu disposera des mêmes
  compétences institutionnelles.

  **Écart avec le jeu actuel :** la structure relie déjà chaque engagement à une campagne précise par
  `campaignId`, et chaque définition contient une liste de types d’élections compatibles. Une promesse
  remportée ne passe en cours de réalisation qu’après la victoire dans cette campagne. En revanche,
  sept des huit promesses sont ouvertes à trois ou quatre scrutins, avec exactement le même intitulé,
  la même description, les mêmes effets d’annonce et les mêmes conséquences. Par exemple, « Engager
  la transition écologique » ou « Remettre des policiers dans la rue » sont présentées de manière
  identique aux différents échelons. L’interface affiche une liste globale d’engagements et ne nomme
  pas la candidature destinataire avant leur inscription dans le registre. Si plusieurs campagnes
  sont simultanément actives, le moteur affecte automatiquement la promesse à l’échéance compatible
  la plus proche sans rendre cet arbitrage explicite au joueur.

  **Comportement proposé :** chaque proposition de campagne doit annoncer clairement le scrutin, le
  territoire et la fonction recherchée, puis offrir des engagements relevant du pouvoir associé. Une
  même grande orientation peut avoir plusieurs déclinaisons concrètes :

  - au municipal, agir sur l’urbanisme, les équipements communaux, la police municipale, les écoles
    et les services de proximité ;
  - au régional, agir sur les transports régionaux, les lycées, la formation, l’aménagement et le
    développement économique ;
  - aux législatives, proposer une loi, un financement national, une réforme fiscale ou le contrôle
    de l’action gouvernementale ;
  - aux sénatoriales, privilégier la loi, les institutions et les collectivités plutôt que promettre
    directement une réalisation exécutive locale.

  Ainsi, l’écologie peut devenir « Rénover les bâtiments municipaux », « Doubler l’offre de trains
  régionaux » ou « Faire voter une loi de rénovation thermique » selon la candidature. Le thème reste
  reconnaissable, mais l’engagement, son coût, son dilemme et sa méthode de réalisation sont propres à
  l’élection.

  **Interface et campagnes simultanées :** présenter les promesses dans la fiche de la candidature ou
  sous un en-tête explicite, par exemple « Municipales de [commune] — choisir jusqu’à trois
  engagements ». Si plusieurs candidatures sont actives, le joueur choisit d’abord la campagne
  concernée ; aucune affectation automatique et invisible à l’élection la plus proche. La carte
  indique le pouvoir permettant de tenir la promesse et, lorsque c’est utile, le territoire concerné.
  Le registre conserve ensuite cette origine, comme il le fait déjà, afin que la presse et les
  adversaires puissent la rappeler avec son contexte.

  **Modèle de contenu recommandé :** conserver un thème commun pour les réactions politiques, mais
  lui associer des variantes par type d’élection plutôt que dupliquer toute la mécanique. Chaque
  variante porte au minimum son intitulé, sa description, le mandat nécessaire, ses effets d’annonce,
  son mode de réalisation et ses dilemmes éventuels. Les coûts, le gain de préparation et les groupes
  sensibles peuvent aussi varier selon l’échelle du scrutin. Une promesse ne doit jamais devenir
  réalisable grâce à un mandat qui ne donne pas le levier institutionnel annoncé.

  **Interactions à préserver :** après une défaite, l’engagement reste dans l’historique de la
  campagne perdue. Après une victoire, seul le mandat issu de cette campagne ouvre sa réalisation. Un
  rappel ultérieur doit citer son contexte et peut être plus ou moins pertinent selon la nouvelle
  candidature : une promesse municipale abandonnée reste embarrassante, mais ne doit pas être traitée
  exactement comme une promesse législative trahie lors d’une campagne nationale.

  **Décision acquise :** les promesses proposées, affichées et réalisables doivent être rattachées
  explicitement à la candidature et aux pouvoirs du mandat brigué. **Décisions restant à prendre :**
  nombre de variantes par thème et par scrutin ; effets propres à chaque échelle ; traitement des
  promesses lorsqu’une campagne vise un mandat collectif ou non exécutif.

- **PT-P3-09-011 — Les activités de l’agenda sont ponctuelles par défaut (26 novembre 2026,
  décision du créateur, agenda, épinglage et accélération).** Lorsqu’une activité est ajoutée à
  l’agenda, elle ne doit pas être épinglée automatiquement. Elle est exécutée pour le trimestre
  planifié puis disparaît. Le joueur l’épingle explicitement lorsqu’il souhaite la conserver d’un
  trimestre à l’autre.

  **Décision remplacée :** P3-08 avait retenu la règle inverse : toute nouvelle action était épinglée
  par défaut et devait être désépinglée pour devenir ponctuelle. Cette règle est actuellement inscrite
  dans `DESIGN.md`, `ARCHITECTURE.md`, les commentaires du moteur et les tests. Le présent retour la
  remplace ; ces contrats devront être mis à jour ensemble lors de l’implémentation afin de ne pas
  conserver deux comportements contradictoires.

  **Comportement attendu :**

  1. Toute nouvelle activité apparaît avec une épingle inactive et porte sur le trimestre courant
     seulement, qu’elle soit ajoutée depuis le catalogue, une candidature, une promesse, l’entourage
     ou un autre écran.
  2. Activer l’épingle signifie sans ambiguïté « répéter chaque trimestre ». Après la résolution, cette
     activité seule est reportée dans l’agenda suivant, à la même position relative aux autres
     activités épinglées.
  3. Désépingler une activité déjà récurrente la rend ponctuelle : elle s’exécute encore pendant le
     trimestre actuellement composé, puis disparaît.
  4. Les achats et autres démarches intrinsèquement ponctuelles restent impossibles à épingler.
  5. Une activité épinglée devenue infaisable est retirée automatiquement selon PT-P3-09-007 ; son
     ancien épinglage ne la fait pas réapparaître lorsqu’elle redevient disponible.

  **Accélération :** avec « Année suivante » ou « Jusqu’à une alerte », les activités non épinglées ne
  sont exécutées qu’au premier trimestre simulé. Les trimestres suivants utilisent uniquement les
  activités épinglées et peuvent donc avoir un agenda vide. L’interface doit le rendre lisible avant
  le départ, par exemple « 2 activités ce trimestre, dont 1 répétée ensuite », sans ajouter une
  confirmation systématique. Si toutes les activités sont ponctuelles, le joueur doit comprendre que
  l’accélération continuera sans activité après le premier trimestre, sous réserve de la règle de
  sécurité sur le plan vide prévue dans PT-P3-09-007.

  **Interface :** l’épingle inactive doit être visible sans attirer autant l’attention qu’une action
  principale ; son libellé accessible indique « Épingler : répéter chaque trimestre ». Une épingle
  active est clairement distinguée et annonce « Épinglée : répétée chaque trimestre ». L’aide de
  l’agenda doit être reformulée pour ne plus demander au joueur de désépingler la majorité de ses
  actions ponctuelles.

  **Conséquences techniques :** la représentation actuelle utilise `once: true` pour l’exception
  ponctuelle et interprète l’absence du marqueur comme épinglée. Puisque le brouillon du plan n’est pas
  sauvegardé, il est possible d’aligner le modèle sur la nouvelle règle avec un marqueur explicite
  `pinned: true`, absent par défaut, sans migration de sauvegarde. À défaut, toutes les entrées de
  planification devront ajouter systématiquement `once: true`, solution plus petite mais plus fragile
  pour les futurs appels. `carryOverPlan`, le contrôleur, l’accélération, le modèle de vue et leurs
  commentaires doivent partager la même sémantique.

  **Tests attendus :** ajout ponctuel puis disparition après un tour ; épinglage puis reconduction ;
  désépinglage puis dernier passage ; comportement identique en tour manuel et accéléré ; actions
  ciblées ajoutées depuis les autres écrans ; plusieurs occurrences épinglées ou non ; achat toujours
  ponctuel ; retrait automatique d’une activité épinglée devenue impossible.

  **Décision acquise :** une activité n’est jamais reconduite sans action explicite du joueur sur son
  épingle. L’épinglage est une demande de persistance, pas l’état initial de l’agenda.

  **Traité par P3-11 (26 novembre 2026, ARCHITECTURE §8.4 duodecies)** : marqueur `pinned: true`.

- **PT-P3-09-012 — Garder le plan trimestriel visible et modifiable depuis tous les onglets (26
  novembre 2026, irritant gênant, navigation, agenda et structure de l’interface).** Consulter ou
  modifier le plan demande aujourd’hui de rejoindre le bon onglet et parfois de faire défiler une
  longue page. Le joueur doit conserver en permanence une vision synthétique de son trimestre et
  pouvoir corriger son plan sans perdre le contexte de l’écran qu’il consulte.

  **Écart avec l’interface actuelle :** le plan complet figure dans Agenda, Organisation et
  Patrimoine seulement. Il est placé à côté du catalogue sur les écrans très larges, mais peut se
  retrouver sous tout le contenu d’Organisation ou de Patrimoine. Il disparaît entièrement du tableau
  de bord, de la carrière, du monde politique, des actualités, de l’entourage et des relations. La
  barre inférieure indique uniquement le temps utilisé et renvoie vers Agenda en cas d’erreur. La
  coque possède pourtant déjà une colonne droite permanente à partir de 1 100 px ; elle est occupée
  par les alertes et une version résumée de la presse, alors qu’un onglet Actualités existe aussi.

  **Disposition recommandée sur desktop :** installer un résumé interactif du plan en tête de la
  colonne droite globale, indépendamment de l’onglet central. Ce « carnet du trimestre » reste fixe
  pendant le défilement du contenu et présente seulement les informations utiles à l’orientation :

  ```text
  Navigation | contenu de l’onglet courant | Trimestre — 22/40 pts
             |                            | 1. Réunion publique   ○ ×
             |                            | 2. Lever des fonds    ● ×
             |                            | 3. Préparer la réforme ○ ×
             |                            | [Modifier le plan]
             |                            | alertes prioritaires
  ```

  Chaque ligne compacte affiche l’ordre, le nom, le coût en temps et l’état de l’épingle. Elle permet
  directement d’épingler ou désépingler et de retirer l’activité. Les erreurs sont indiquées sur la
  ligne concernée. Le temps restant et un avertissement éventuel restent visibles sans répéter les
  prévisions détaillées, les coûts et tous les effets de la grande carte actuelle.

  **Modification sans rupture de navigation :** « Modifier le plan » ouvre un panneau latéral élargi
  ou une feuille superposée, sans changer l’onglet actif ni sa position de défilement. Ce panneau
  reprend l’ordre complet, le déplacement des activités, leur suppression, l’épinglage et les
  prévisions. Il peut proposer une recherche ou un sélecteur compact pour ajouter une activité
  générique ; les actions propres à une candidature, une promesse, une recrue ou un bien continuent
  aussi à s’ajouter depuis leur écran d’origine. Refermer le panneau rend exactement le contexte
  précédent.

  **Hiérarchie à alléger :** ne pas recopier le `PlanPanel` complet dans chaque page : cela alourdirait
  encore l’interface et multiplierait les zones de défilement. Le plan permanent est un sommaire
  opérationnel ; Agenda reste le catalogue complet des activités. Dans la colonne droite, les alertes
  critiques peuvent rester sous le plan, tandis que le fil de presse peut être réduit à un seul titre
  récent ou renvoyer à l’onglet Actualités. Le plan, qui commande l’action immédiate du joueur, passe
  avant l’information d’ambiance.

  **Largeurs plus faibles :** lorsque la troisième colonne disparaît, conserver au-dessus de la barre
  d’avance un bouton persistant du type « Plan · 3 activités · 22/40 », accompagné d’un signal
  d’erreur. Il ouvre le même panneau de modification. Le jeu reste desktop-first, mais le besoin de
  consulter le plan ne doit pas disparaître arbitrairement sous 1 100 px.

  **États et accessibilité :** prévoir un état vide avec « Ajouter une activité », désactiver les
  modifications pendant l’accélération ou une décision bloquante, conserver un ordre de tabulation
  simple et annoncer les changements du temps restant. Les boutons d’épingle suivent la nouvelle
  règle de PT-P3-09-011 : activité ponctuelle par défaut, répétition seulement après épinglage
  explicite.

  **Conséquences techniques :** déplacer la responsabilité de l’affichage synthétique dans
  `GameLayout`, qui reçoit déjà la session et entoure tous les onglets ; créer une vue compacte
  distincte du `PlanPanel` détaillé afin de partager les mêmes données sans dupliquer les règles ;
  conserver un seul contrôleur pour toutes les modifications. Les tests doivent couvrir la présence
  du résumé dans chaque onglet, la conservation de l’onglet et du défilement après ouverture, les
  modifications depuis la colonne, l’état étroit, les erreurs et le verrouillage pendant
  l’accélération.

  **Décision acquise :** le plan du trimestre devient un élément permanent de la coque de jeu,
  consultable et modifiable sans naviguer jusqu’à Agenda. **Décisions restant à prendre :** contenu
  exact de la colonne droite après réduction de la presse ; ajout d’activités génériques directement
  dans le panneau ou simple lien vers leur catalogue ; seuil de largeur et comportement précis du
  panneau superposé.

- **PT-P3-09-013 — Faire changer l’échelle des actions au fil de la carrière (26 novembre 2026,
  problème de progression, économie, organisation et variété des actions).** Le début et le milieu de
  partie proposent globalement les mêmes actions, avec les mêmes coûts et les mêmes rendements. Cette
  stabilité efface la sensation de montée en puissance : un personnage devenu riche et influent peut
  encore transférer seulement 500 € par trimestre à son organisation politique, comme au début de sa
  carrière.

  **Diagnostic confirmé :** `personal.donate` coûte et verse toujours 500 €, une fois par trimestre.
  La majorité des actions ont de la même manière un temps, un coût et un effet fixes. Quelques actions
  supérieures existent séparément — collecte puis gala, réunion publique, meeting holographique,
  patrimoine et média — mais elles ne forment pas encore une progression générale. Le diagnostic
  économique de P3-02 relevait déjà que l’argent personnel manque de débouchés : les stratégies qui
  n’investissent pas finissent avec des médianes d’environ 1 à 2,6 millions d’euros, ce qui rend les
  dépenses courantes et le don de 500 € négligeables.

  **Principe de conception proposé :** ne pas appliquer un multiplicateur universel fondé sur l’âge
  ou un « niveau du joueur ». L’échelle pertinente dépend du contexte : fortune pour une dépense
  personnelle, taille de l’organisation pour une opération militante, scrutin visé pour une campagne,
  mandat détenu pour une action publique, audience du média pour une opération de communication. Le
  jeu conserve ainsi les trajectoires non linéaires prévues par le GDD.

  **Piste privilégiée — un système hybride en quatre couches :**

  1. **Intensité choisie.** Les actions qui s’y prêtent proposent trois formats lisibles plutôt qu’un
     curseur au centime : modeste, soutenu et majeur. Chaque format déclare son coût, son temps, son
     effet et ses conditions. Les rendements sont décroissants : dépenser dix fois plus donne plus de
     portée et économise éventuellement du temps, mais ne produit pas dix fois plus d’influence.
  2. **Portée institutionnelle.** Les campagnes et communications ont des variantes locales,
     régionales ou nationales liées à la candidature et au mandat. Un meeting municipal et une tournée
     législative ne sont pas la même opération renommée avec un plus gros chiffre.
  3. **Capacité d’absorption.** L’argent seul ne suffit pas. Les formats supérieurs exigent une
     permanence, des militants, un collaborateur, une relation médiatique ou une campagne adaptée.
     Cela empêche un riche débutant d’acheter immédiatement une puissance nationale et donne une
     utilité systémique à l’entourage et à l’organisation.
  4. **Nouveaux débouchés.** Le milieu et la fin de carrière ouvrent des usages qualitativement
     différents : tournée de campagne, enquête d’opinion, grande convention, réseau de donateurs,
     fondation ou cercle d’idées, avances de campagne, équipe nationale, mécénat local, média ou autre
     actif influent. L’argent achète de la capacité, du temps ou des occasions, jamais une victoire
     automatique.

  **Exemple à prototyper pour l’argent personnel :**

  | Stade               | Opération                                                       | Logique de jeu                                                                                 |
  | ------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
  | Début               | Don déclaré de 500 €                                            | Petit soutien immédiat, accessible sans structure                                              |
  | Milieu              | Don renforcé de quelques milliers d’euros                       | Fortune minimale et organisation capable de l’employer                                         |
  | Campagne importante | Avance ou prêt personnel de campagne                            | Montant supérieur, argent personnel réellement exposé, remboursement éventuel après le scrutin |
  | Fin de carrière     | Financer une structure durable ou acquérir un actif d’influence | Coût et charges élevés, effets politiques indirects, exposition et contreparties               |

  Les montants sont provisoires. Une limite annuelle ou propre à chaque campagne doit préserver la
  séparation entre fortune personnelle et budget politique. Au-delà d’un financement ordinaire, le
  jeu peut proposer une avance récupérable, une opération très visible ou une voie occulte avec des
  risques distincts, plutôt qu’un transfert illimité et sans conséquence.

  **Évolution des actions existantes :** distribuer des tracts, rencontrer des élus locaux ou assister
  à une réunion de section ne doivent pas forcément disparaître. Elles restent efficaces pour un
  objectif local, une relation précise ou une campagne municipale, mais leur rendement général
  plafonne avec la notoriété. Les formats supérieurs deviennent plus efficaces en temps et couvrent
  une audience plus large, au prix d’argent, de personnel, d’exposition, de stress ou de risques. Un
  ministre peut encore aller tracter, mais ce n’est plus la meilleure manière de convertir ses
  ressources en influence nationale.

  **Actions qui ne doivent pas être artificiellement mises à l’échelle :** démissionner, quitter un
  parti, se reposer, répondre à un proche ou prendre une décision narrative gardent naturellement une
  taille fixe. Le scaling doit correspondre à une portée ou à un investissement réel, pas ajouter
  trois versions à chaque bouton.

  **Interface :** lors de l’ajout d’une action modulable, afficher deux ou trois formats prédéfinis
  avec leur coût, leur portée, leur temps et leur rendement attendu. Le format conseillé dépend du
  contexte mais n’est jamais choisi automatiquement. Les formats inaccessibles peuvent être résumés
  discrètement avec leur prérequis afin de rendre la progression visible sans rallonger encore le
  catalogue.

  **Garde-fous d’équilibrage :** rendements décroissants, plafonds par campagne, coûts récurrents,
  prérequis organisationnels et effets secondaires doivent empêcher la boucle « argent → influence →
  mandat → encore plus d’argent » de devenir exponentielle. Les simulations doivent comparer
  l’utilisation des actions par tiers de carrière, la part de fortune réellement dépensée, le coût
  marginal de l’influence et le nombre d’actions de début de partie encore choisies à haut niveau.

  **Orientation proposée pour le brainstorming :** combiner les trois intensités avec des variantes
  de portée et quelques nouveaux usages de fin de carrière. Un simple curseur monétaire réglerait le
  cas du don, mais pas l’impression générale de refaire les mêmes gestes pendant cinquante ans.
  **Décisions restant à prendre :** paliers discrets ou formule continue ; actions regroupées sous un
  même choix ou variantes séparées ; règles des dons et avances personnelles ; première famille
  d’actions à prototyper pour tester la sensation de progression.

- **PT-P3-09-014 — Transformer les militants en base organique et en capacité politique (26 novembre
  2026, proposition structurante, organisation, progression et élections).** L’organisation manque de
  scaling : le joueur achète aujourd’hui des « militants bénévoles » comme des améliorations, alors
  qu’ils devraient plutôt s’agréger ou partir selon la trajectoire politique. Il est également possible
  d’accéder très vite à une candidature régionale sans militants ni véritable implantation.

  **Écart avec le jeu actuel :** deux systèmes représentent les militants sans être réellement reliés.
  `support.activists` mesure leur soutien sur une jauge de 0 à 100 et réagit déjà aux adhésions,
  promesses, choix et événements. En parallèle, `organization.volunteer` est une amélioration achetée
  manuellement, plafonnée à dix exemplaires, avec une petite charge et une production fixe d’un point
  d’influence par trimestre. Les candidatures régionales n’exigent ni mandat antérieur, ni militant,
  ni permanence. Le score électoral utilise la popularité, le poids du parti en cas d’investiture, la
  préparation et la prime du sortant, mais aucune capacité militante.

  **Modèle proposé — distinguer adhésion et effectifs :**

  - le **soutien militant** existant représente l’enthousiasme, la loyauté et l’envie de se mobiliser ;
  - la **base militante active** devient un effectif agrégé persistant, gagné ou perdu naturellement ;
  - la **capacité de mobilisation** est dérivée de cet effectif, de la permanence, de l’entourage et de
    l’appui éventuel du parti, plutôt qu’affichée comme une troisième jauge arbitraire.

  Chaque trimestre, l’exposition et l’influence déterminent combien de personnes entendent parler du
  personnage ; la popularité et surtout le soutien militant déterminent combien restent et s’engagent.
  Une forte visibilité avec une base hostile ne doit donc pas créer automatiquement des militants.
  Les victoires, les promesses cohérentes, la présence sur le terrain et certaines décisions en
  attirent ; les promesses trahies, les scandales, l’abandon de la base, un changement de parti ou une
  longue inactivité provoquent départs et démobilisation.

  **Rôle de l’organisation :** supprimer l’achat direct « Recruter un militant bénévole ». Les actions
  militantes servent à animer, former ou mobiliser la base et modifient sa croissance, mais ne créent
  pas mécaniquement une personne contre du temps. Une permanence augmente la capacité d’accueil, la
  rétention et l’efficacité des militants ; elle ne devrait plus produire directement quatre points
  d’influence sans relation avec la base. Un responsable de terrain ou des moyens de communication
  peuvent jouer le même rôle à des échelles supérieures.

  **Production sans emballement exponentiel :** les militants ne donnent pas chacun un point
  d’influence. Leur rendement doit être décroissant et surtout opérationnel : réduction du temps de
  tractage, préparation de campagne, porte-à-porte délégué, collecte, présence dans plusieurs communes
  et accès aux formats d’action supérieurs de PT-P3-09-013. Des paliers provisoires peuvent représenter
  un noyau, un comité local, une section implantée, un réseau régional puis une organisation nationale.
  Chaque palier exige aussi des locaux, de la coordination et des frais, afin qu’une grande base soit
  puissante sans être gratuite.

  **Amplification simple des actions de terrain :** « Distribuer des tracts » donne actuellement
  toujours 1 à 3 points d’influence et « Faire du porte-à-porte » toujours 3 points de préparation,
  quel que soit le nombre de militants. Ces actions conservent un effet de base lorsque le personnage
  agit seul, puis gagnent un bonus lisible selon le palier militant atteint. Le tractage, le
  porte-à-porte, la collecte et certains meetings sont concernés ; une interview, une tribune ou une
  décision personnelle ne le sont pas. Le bonus est plafonné ou progresse par paliers pour éviter une
  croissance linéaire sans limite.

  Ne pas ajouter de gestion de fatigue, de disponibilité ou d’affectation individuelle : une action ne
  « consomme » pas temporairement des militants et le joueur n’a pas à répartir ses effectifs entre
  plusieurs tâches. Le nombre total sert simplement de modificateur automatique, annoncé dans la
  prévision de l’action, par exemple « Base militante : +2 préparation ». Les limites par trimestre,
  le temps du personnage et les frais de l’action suffisent à encadrer sa répétition.

  **Lien avec les candidatures :** l’organisation militante ne devient pas un critère d’éligibilité.
  Dès lors que les conditions légales ou institutionnelles sont remplies, le joueur peut tenter
  presque n’importe quelle élection, même beaucoup trop tôt. En revanche, chaque scrutin possède un
  besoin de mobilisation différent : faible aux municipales, intermédiaire aux législatives et élevé
  pour constituer une présence régionale. Sans base personnelle ni appui organisationnel du parti, une
  candidature régionale reste possible mais doit normalement produire un très mauvais score.
  L’investiture permet d’emprunter une partie de la machine du parti, sans rendre la base personnelle
  inutile ; les sénatoriales reposent davantage sur les mandats locaux et l’appareil.

  La capacité militante intervient donc dans le score et dans l’efficacité de la préparation, pas
  dans `candidacyIssue`. La popularité mesure l’intention de soutenir le candidat ; l’organisation
  mesure sa capacité à faire campagne, couvrir le territoire et convertir cette sympathie en votes.
  Une forte popularité peut compenser partiellement une petite organisation, mais pas rendre triviale
  une campagne régionale sans relais. À l’inverse, une machine militante solide ne suffit pas à faire
  élire un candidat impopulaire.

  **Valeur d’une candidature perdue :** se présenter trop tôt ne doit pas être un choix sans intérêt.
  La campagne crée de l’exposition, fait rencontrer des sympathisants et peut faire croître un petit
  noyau militant en fonction du score et des actions menées. Le joueur échoue électoralement mais
  prépare la tentative suivante ; cela transforme la défaite en étape possible de la progression sans
  récompenser automatiquement toute candidature symbolique.

  **Boucle incrémentale recherchée :** actions et choix cohérents → soutien militant → arrivée et
  fidélisation de militants → capacité d’organiser des opérations plus ambitieuses → davantage de
  visibilité et d’influence → accès crédible aux scrutins supérieurs. La boucle inverse doit exister :
  contradictions, défaites ou négligence → démobilisation → opérations plus coûteuses et campagnes
  fragiles. Les militants deviennent ainsi une ressource stratégique vivante, pas seulement une jauge
  d’opinion ou une amélioration empilable.

  **Autres améliorations prioritaires de l’organisation, sans microgestion :**

  1. **Implantation territoriale dérivée.** Faire émerger des paliers simples — noyau local, réseau
     départemental ou régional, relais national — à partir des militants, permanences et mandats. Il
     ne s’agit pas de gérer chaque commune, mais de rendre visible la capacité à couvrir le territoire
     d’un scrutin. Une forte base concentrée dans la commune ne vaut pas encore un réseau régional.
  2. **Professionnalisation progressive.** Les premiers militants reposent sur le temps personnel du
     joueur ; une permanence puis des collaborateurs de terrain, de communication ou de trésorerie
     permettent de coordonner une base plus grande et d’améliorer les actions correspondantes. Les
     postes de l’entourage deviennent ainsi des multiplicateurs de l’organisation, pas seulement des
     producteurs isolés.
  3. **Financement organique.** Une base active apporte de petites cotisations et facilite les
     collectes, tandis que les locaux, impressions, déplacements et salariés créent des charges. Les
     militants ne doivent pas devenir une machine à argent : la taille ouvre surtout une capacité de
     collecte, que le joueur active par ses choix, avec des rendements décroissants.
  4. **Base personnelle et machine du parti.** Distinguer ce qui suit le personnage de ce que prête le
     parti. Une investiture donne accès à des relais et à de la logistique ; un changement de parti
     fait perdre une partie de ces moyens et peut démobiliser la base, mais les fidèles personnels ne
     disparaissent pas tous instantanément.
  5. **Autonomie par paliers.** Une organisation structurée prend en charge une partie des tâches de
     routine : les actions de terrain gagnent en efficacité et certains effets récurrents apparaissent
     sans demander de répartir manuellement chaque militant. Les choix sensibles, les grandes
     campagnes et les arbitrages restent au joueur.
  6. **Croissance accompagnée d’événements.** À mesure que la structure grandit, faire apparaître par
     événements les rivalités internes, problèmes de caisse, initiative locale réussie, section
     dissidente ou jeune cadre prometteur. Les contreparties de la croissance passent ainsi par des
     décisions narratives plutôt que par un écran de gestion supplémentaire.

  L’écran Organisation devrait donc montrer une trajectoire — effectif, implantation, moyens,
  charges et prochain palier — plutôt qu’une simple boutique de producteurs aux effets fixes.

  **Interface :** la carte Organisation affiche l’effectif actif, sa tendance trimestrielle et une
  explication courte des principaux facteurs, par exemple « +3 : forte mobilisation ; −1 : capacité
  d’accueil saturée ». Elle montre le palier atteint et ce qu’il permet de faire. Les personnages
  militants déjà présents peuvent rester des figures particulières issues de cette base, sans
  représenter chacun des effectifs.

  **Garde-fous et tests :** plafonnement par la capacité d’accueil, attrition naturelle, rendements
  décroissants, charges logistiques et différence entre organisation personnelle et moyens du parti.
  Les simulations doivent mesurer effectifs par âge de carrière, vitesse d’accès aux scrutins,
  candidatures sans implantation, croissance après victoire, pertes après promesse abandonnée et
  risque d’emballement influence–militants–mandats.

  **Priorité retenue et ordre de construction :**

  1. **Socle militant.** Ajouter l’effectif organique et sa croissance ou décroissance à partir du
     soutien, de la visibilité et des choix ; supprimer l’achat direct des bénévoles.
  2. **Capacité d’organisation.** Reconvertir la permanence et les collaborateurs en capacité
     d’accueil, de rétention et d’amplification. Brancher immédiatement cette capacité sur le tractage,
     le porte-à-porte et la collecte afin que le changement soit perceptible en jeu.
  3. **Implantation et élections.** Dériver les paliers territoriaux et intégrer la mobilisation au
     score des campagnes, en commençant par les régionales, sans bloquer le dépôt de candidature.
  4. **Boucle financière.** Ajouter cotisations, potentiel de collecte et charges logistiques une fois
     la taille et la capacité stabilisées ; équilibrer ensemble croissance militante et trésorerie.
  5. **Parti et autonomie.** Faire contribuer l’investiture à la capacité disponible, gérer les pertes
     lors d’un changement de parti et déléguer progressivement les tâches de routine.
  6. **Contenu narratif.** Adapter les événements internes aux nouveaux paliers et ajouter réussites,
     conflits et scissions lorsque les règles principales sont validées.

  La première tranche verticale doit donc rester petite : effectif militant organique, permanence,
  bonus simple au tractage et au porte-à-porte, puis pénalité de campagne régionale en cas de faible
  implantation. Elle suffit à tester la sensation incrémentale avant d’ajouter l’économie complète et
  les événements de grande organisation.

  **Orientation proposée pour le brainstorming :** conserver la jauge de soutien militant, ajouter un
  effectif organique et faire de la permanence un multiplicateur d’accueil et de rétention. Utiliser
  ensuite la capacité dérivée comme modificateur des campagnes, en commençant par les régionales.
  **Décision acquise :** aucune condition militante ne bloque le dépôt d’une candidature ; un déficit
  d’organisation dégrade fortement la campagne et le score, selon l’échelle du scrutin. Les actions de
  terrain sont automatiquement renforcées par l’effectif militant, sans fatigue ni allocation à gérer.
  **Décisions restant à prendre :** effectif exact ou paliers seulement ; bonus des paliers sur chaque
  famille d’actions ; formule de conversion entre popularité, préparation et mobilisation ; importance
  respective de la base personnelle et de la machine du parti ; frais logistiques des grands
  effectifs.

- **PT-P3-09-015 — Montrer immédiatement les conséquences et mettre en scène chaque nouveau
  trimestre (26 novembre 2026, irritant gênant, feedback, événements et rythme temporel).** Après un
  choix d’événement, la fenêtre se ferme sans présenter clairement ce qui vient de se produire. Après
  un trimestre manuel, les évolutions sont consultables dans le journal ou dans une carte située en
  bas du tableau de bord. Le joueur doit donc chercher le résultat et peut ne pas sentir que le temps
  vient de passer s’il ne surveille pas la date de l’en-tête.

  **Écart avec le jeu actuel :** la fenêtre de décision affiche les tendances et coûts connus avant le
  choix, mais aucun état de résultat. Le journal construit pourtant déjà une ligne détaillée pour le
  choix réellement résolu, y compris les effets aléatoires finalement obtenus. De même,
  `summarizeSpan` calcule les variations nettes, les événements et les faits marquants entre deux états,
  mais ce résumé visible en tête de page n’est utilisé qu’après une accélération. Un trimestre manuel
  renvoie au tableau de bord, où « Dernier trimestre » apparaît après plusieurs grandes cartes.

  **Premier temps — résultat immédiat d’une décision :** après le clic, conserver la même fenêtre et
  remplacer les choix par un écran de résultat, plutôt que fermer brutalement la modale. Il affiche :

  - le choix effectué et une courte conséquence narrative propre à cette réponse ;
  - les variations réellement appliquées et observables : ressources, soutiens, relations, stress,
    exposition, carrière ou fait judiciaire ;
  - les coûts payés et, si un effet était aléatoire, son résultat effectif ;
  - « Continuer » ou « Décision suivante » lorsqu’un autre événement bloquant attend.

  Les suites différées et informations cachées restent cachées. Le résultat ne révèle pas le futur et
  ne transforme pas les tendances préalables en certitudes ; il expose seulement ce que le personnage
  peut constater immédiatement. Un champ narratif de résultat par choix peut compléter les lignes
  générées par le journal afin d’éviter un bilan purement comptable.

  **Direction narrative retenue :** le texte de résultat est le premier niveau de lecture. Il raconte
  en quelques phrases la scène qui suit le choix et la réaction des personnes concernées, à la deuxième
  personne, avant d’afficher les variations sous forme secondaire et compacte. Par exemple, un refus
  ne se résume pas à « relation −10 » : le donateur range son carnet de chèques, écourte l’entretien et
  laisse comprendre qu’il appellera quelqu’un d’autre. Les personnages nommés, souvenirs et groupes de
  soutien doivent être cités lorsqu’ils sont observables.

  Chaque choix important reçoit idéalement un court texte de conséquence écrit dans le catalogue, avec
  des variables et quelques variantes déterministes si nécessaire. Une reformulation automatique à
  partir des effets sert seulement de repli pour les choix mineurs : elle ne doit pas produire des
  paragraphes génériques ni nécessiter d’IA au runtime. Le ton reste satirique et concret, comme les
  événements eux-mêmes.

  **Second temps — note de début de trimestre :** après chaque trimestre manuel, afficher avant le
  retour à la planification une courte « Note de cabinet » portant en grand la nouvelle date. Cette
  transition contient au plus quelques informations hiérarchisées :

  1. variations nettes des ressources, de la santé, du stress et de la popularité ;
  2. productions, charges ou activités qui ont réellement compté ;
  3. événements, mandats, campagnes, entourage et alertes apparus pendant le trimestre ;
  4. ajustements du plan reconduit, notamment les activités ponctuelles retirées ou devenues
     impossibles.

  Le bouton « Préparer ce trimestre » ferme la note et ouvre le nouvel agenda. Même lorsqu’il ne s’est
  presque rien passé, une version très courte — nouvelle date et principaux soldes — marque clairement
  le passage du temps. Le rapport reste ensuite rouvrable depuis la date ou un lien « Trimestre
  précédent », mais sa première présentation est automatique et ne demande aucune recherche.

  Cette note prend la forme d’un petit récit de carrière plutôt que d’un relevé comptable : une phrase
  d’ouverture sur l’évolution la plus marquante, puis deux ou trois paragraphes très courts tels que
  « Sur le terrain », « Au cabinet » ou « Dans les comptes ». Les chiffres viennent confirmer le récit,
  sans le remplacer. L’ensemble doit rester assez bref pour être lu à chaque tour et donner envie de
  préparer le suivant, pas devenir un second journal exhaustif.

  **Accélération :** ne pas ouvrir une fenêtre à chaque trimestre simulé. Lorsque l’accélération
  s’arrête, transformer son résumé existant en note de période présentée automatiquement : dates de
  début et de fin, variations cumulées, faits marquants et détail replié. Une décision qui arrête
  l’accélération apparaît après cette note, afin que le joueur comprenne d’abord combien de temps s’est
  écoulé et pourquoi la simulation s’est arrêtée.

  **Éviter la fatigue de modales :** la conséquence d’un choix et la transition trimestrielle ont
  chacune un rôle distinct et restent brèves. Les conséquences immédiates ne sont pas répétées ligne
  par ligne dans la note suivante ; celle-ci retient seulement leur impact important. Pas de toast qui
  disparaît avant d’être lu, ni d’animation longue : une transition visuelle unique sur la date suffit
  à donner du poids au nouveau trimestre.

  **Conséquences techniques :** conserver l’état précédant la transition dans le contrôleur, réutiliser
  `summarizeSpan` pour un seul trimestre comme pour plusieurs et exposer le dernier résultat de choix
  depuis l’entrée `event.resolved`. Ajouter si nécessaire un texte de résultat déclaratif aux choix,
  sans inclure leurs suites cachées. Les composants utilisent la même source de résumé que le journal,
  afin d’éviter des chiffres divergents.

  **Tests attendus :** effets déterministes et aléatoires affichés après un choix ; informations
  cachées absentes ; enchaînement de plusieurs décisions ; note après un trimestre calme ou chargé ;
  nouvelle date évidente ; résumé d’accélération unique ; réouverture du dernier rapport ; navigation
  clavier, focus et reprise après sauvegarde sans rejouer une conséquence.

  **Décision acquise :** chaque choix reçoit un feedback immédiat et narratif avant de poursuivre, et
  chaque début de trimestre présente automatiquement une courte note narrative sur le trimestre écoulé
  et la nouvelle date. Les effets chiffrés restent visibles mais secondaires. **Décisions restant à
  prendre :** modale centrale ou écran de transition léger ; longueur maximale des textes ; quantité de
  faits affichés avant le détail.

- **PT-P3-09-016 — Enrichir fortement le contenu et empêcher les répétitions visibles (26 novembre
  2026, problème majeur de rejouabilité, événements, presse et narration).** Les événements et les
  articles de presse reviennent trop souvent au cours d’une même carrière. Le jeu a besoin d’un chantier
  éditorial important, accompagné de règles de sélection qui valorisent réellement ce nouveau contenu.

  **Diagnostic du catalogue :** le total actuel de 122 événements donne une impression trompeuse de
  volume, car beaucoup sont réservés à une époque, un mandat rare ou une suite précise. Les catégories
  fréquemment rencontrées restent minces : trois événements de campagne, trois d’organisation, cinq
  d’entourage et six de famille. Un événement ordinaire peut apparaître jusqu’à six fois dans une
  carrière ; son poids diminue de moitié à chaque nouvelle occurrence et son délai de réapparition est
  respecté, mais ces garde-fous ne compensent pas un petit ensemble d’événements éligibles dans une
  situation donnée.

  La presse possède cinq médias et 51 titres, répartis entre justice, promesses, élections, train de
  vie, interviews, rachat et ambiance. Plusieurs combinaisons sujet–tonalité ne disposent que d’un seul
  titre, notamment certaines interviews, articles de train de vie ou de rachat. Le moteur tire à
  nouveau dans le même ensemble sans exclure un titre récemment utilisé. Les douze nouvelles
  d’ambiance sont tirées avec une probabilité de 60 % par trimestre : sur une carrière longue, leur
  répétition est donc structurelle.

  **Premier chantier — couverture des situations courantes :** construire une matrice par phase de
  carrière, fonction, échelle territoriale, organisation, relations, famille, époque et niveau de
  fortune. Prioriser les cases que le joueur traverse souvent avant d’ajouter des événements réservés
  à des situations exceptionnelles : début sans mandat, implantation locale, campagne, défaite,
  première équipe, croissance militante, exercice municipal ou régional, conflits d’entourage et
  enrichissement. Chaque phase doit disposer de suffisamment de situations réellement éligibles, pas
  seulement d’un catalogue global plus gros.

  **Deuxième chantier — trois formes de contenu complémentaires :**

  - des situations paramétrables avec plusieurs acteurs, territoires, enjeux et formulations, pour
    couvrir le quotidien sans écrire des doublons presque identiques ;
  - des événements uniques plus travaillés, mémorables et fortement liés à une fonction ou à une
    trajectoire ;
  - des chaînes narratives sur plusieurs trimestres, avec personnages récurrents, conséquences et
    bifurcations, afin que le contenu raconte une histoire plutôt qu’une succession de cartes isolées.

  Conserver comme guide la répartition du GDD — environ 70 % de situations paramétrables, 20 %
  d’uniques et 10 % de chaînes — sans en faire un quota rigide. Les nouveaux textes doivent aussi
  fournir les résultats narratifs demandés par PT-P3-09-015 ; ajouter seulement une nouvelle question
  sans conséquence racontée déplacerait le manque de contenu vers l’écran suivant.

  **Troisième chantier — véritable diversité de la presse :**

  1. Élargir les sujets couverts : croissance ou crise de l’organisation, nomination et départ d’un
     collaborateur, campagne avant le résultat, implantation territoriale, conflit avec le parti,
     patrimoine, famille exposée, réforme, évolution nationale et réactions locales.
  2. Donner à chaque média une voix plus reconnaissable, avec angles, vocabulaire et rubriques propres,
     plutôt que partager essentiellement les mêmes titres filtrés par type.
  3. Ajouter plusieurs titres pour toute combinaison de sujet, tonalité et famille de média réellement
     accessible, avec des variables de région, commune, rival, promesse, fonction et époque.
  4. Réduire les nouvelles d’ambiance génériques au profit d’articles liés à l’état du monde et du
     territoire ; les ambiances restantes varient selon l’époque et la région.

  **Règles anti-répétition :** mémoriser les identifiants de titres récemment publiés et utiliser une
  pioche sans remise par média ou famille de sujet avant de recycler le pool. Appliquer également un
  délai thématique afin d’éviter trois articles successifs sur le même angle. Pour les événements,
  renforcer les plafonds au cas par cas : les scènes très reconnaissables deviennent uniques ou ne
  reviennent qu’une fois, tandis que seuls les formats conçus pour varier peuvent se répéter. Toutes
  ces sélections restent seedées, sérialisées et déterministes.

  **Méthode de production recommandée :**

  1. instrumenter les simulations et playtests pour compter les événements et titres vus plusieurs
     fois, leur intervalle, les catégories pauvres et les contenus jamais atteints ;
  2. ajouter la mémoire anti-répétition et une validation signalant les combinaisons de presse dont le
     pool est trop petit ;
  3. produire une première vague centrée sur les catégories courantes et les articles liés à l’état de
     la partie ;
  4. écrire ensuite les chaînes et contenus rares, puis rejouer plusieurs carrières humaines pour
     mesurer la reconnaissance des textes, pas seulement leur nombre.

  Un critère plus utile qu’un volume brut serait : aucun titre identique avant épuisement de son pool,
  aucune scène très reconnaissable plus de deux fois dans une carrière ordinaire, et plusieurs
  événements éligibles concurrents dans chaque état courant. Le volume final devra probablement
  dépasser sensiblement les 122 événements actuels, mais la matrice de couverture et la fréquence
  observée doivent fixer la cible plutôt qu’un nombre arbitraire.

  **Décision acquise :** un chantier conséquent de création de contenu est nécessaire pour la V1, à la
  fois sur les événements, leurs conséquences narratives et la presse. Il doit être accompagné d’une
  mémoire anti-répétition et d’une meilleure couverture contextuelle. **Décisions restant à prendre :**
  cible éditoriale par catégorie, taille minimale des pools de titres, priorité relative entre contenu
  quotidien, événements uniques et chaînes narratives.

### Tri des retours P3-09 (26 novembre 2026)

Les seize retours ci-dessus sont repris dans le plan de corrections P3-11 à P3-25 de `ROADMAP.md`
§5.2, avec les décisions du créateur (périmètre V1 en tranches, refonte en terrain d’engagement,
recrutement complet, 13 régions métropolitaines) et les décisions déléguées. Deux playtests
intermédiaires (B1 après l’agenda et les retours, B2 après les systèmes) précèdent le chronométrage
final ci-dessous.

### Résultats

_À compléter après la session : testeur, seeds, durée chronométrée, nombre de décisions et
d’arrêts, âge et cause de fin, irritants classés (bloquant, gênant, mineur) et décisions. Les
chronométrages servent à recalibrer `ACTIVE_TIME_MODEL` (simulation)._
