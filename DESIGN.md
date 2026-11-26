# La République, c’est moi ! — Direction artistique et interface

**Version 0.1 — 24 novembre 2026**  
**Statut :** cadrage avant prototype ; wireframes et valeurs visuelles indicatifs.  
**Références :** [GAME_DESIGN.md](GAME_DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md).

## 1. Intention

Un outil de gestion politique à l’apparence institutionnelle, dont le sérieux contraste avec l’absurdité des événements. Le joueur doit avoir l’impression de consulter les dossiers de son propre cabinet, pas de jouer à un clicker coloré. **Révisé le 26 novembre 2026 (demande du créateur) :** le jeu devient un dossier de cabinet *mis en scène*, plus ludique et moins textuel, par les icônes, les jauges et les pastilles, sans illustrations dessinées (§10). L’interface sert d’abord à prendre des décisions, à comprendre les conséquences du trimestre et à lire des histoires.

- Desktop-first, navigateur, clavier et souris ; aucun objectif mobile pour la V1.
- Priorité à la lisibilité et au rythme : les actions courantes doivent être rapides, les décisions importantes mises en scène.
- Pas de carte géographique, de 3D, de personnages animés ni de dépendance à des illustrations sur mesure pour le prototype.
- Univers fictif : ne pas utiliser les logos réels des partis, médias ou administrations. Créer une identité propre, évocatrice sans être une reproduction officielle.
- Interface et contenu en français ; le titre reste « La République, c’est moi ! », sans sous-titre.

## 2. Identité visuelle

Palette proposée, modifiable après essais de contraste. Définir les couleurs sous forme de tokens CSS, réutilisés dans Tailwind et les composants.

| Token | Couleur | Usage |
|---|---|---|
| `canvas` | `#F3F0E9` | Fond général, papier crème |
| `surface` | `#FFFDFA` | Cartes et panneaux |
| `sidebar` | `#EAE6DE` | Navigation et zones secondaires |
| `primary` | `#203957` | Bleu institutionnel, actions principales |
| `ink` | `#202A35` | Texte principal |
| `muted` | `#565E68` | Informations secondaires |
| `line` | `#D5D0C5` | Séparateurs et contours non interactifs |
| `danger` | `#A32938` | Alertes, pertes, dossiers critiques |
| `positive` | `#286044` | Gains et effets favorables |
| `warning` | `#80520D` | Risque et attention |

Typographie : titres en Georgia ou serif système, corps en system-ui sans serif. Pas de téléchargement de police nécessaire. Chiffres tabulaires pour les ressources. Corps de 14–16 px ; légendes 12–13 px ; titres de section 18–24 px ; éviter la microtypographie. Espacement sur grille de 4/8 px ; rayons modérés de 4–8 px ; bordures plutôt qu’ombres lourdes. Icônes Lucide simples et cohérentes, accompagnées de libellés pour les actions importantes.

Les portraits éventuels pourront être de petites caricatures stylisées, produites ultérieurement à partir d’un ensemble cohérent. Au prototype, initiales, silhouettes et couleurs neutres suffisent ; aucun portrait ne doit être indispensable à la compréhension. Pas de portraits de personnalités réelles. Les animations se limitent à de légères transitions facultatives ; respecter `prefers-reduced-motion`.

## 3. Coque de jeu desktop

Cible de travail indicative : 1440 × 900, test à 1280 × 720 et à un zoom de 125 %. Préserver l’accès aux commandes si la hauteur diminue. En dessous d’environ 1100 px, réduire ou replier le panneau de droite plutôt que créer une seconde interface mobile. Éviter le défilement horizontal pour les écrans cibles.

```text
┌───────────────────────────────────────────────────────────────────────┐
│ LA RÉPUBLIQUE, C’EST MOI !    T2 2004 · 29 ans · Conseiller municipal   │
│ Influence 82   Budget 4 200 €   Fortune 9 800 €   Santé / Stress       │
├──────────────┬──────────────────────────────────┬─────────────────────┤
│ NAVIGATION   │ AGENDA                           │ LA PRESSE           │
│ Tableau bord │ Temps disponible 45/100          │ Titres du trimestre │
│ Agenda       │ ┌──────────────────────────────┐ │                     │
│ Organisation │ │ Distribuer des tracts   15  │ │ ALERTES             │
│ Carrière     │ │ Rencontrer des élus      20  │ │ Campagne imminente  │
│ Entourage    │ │ Prendre du repos        25  │ │                     │
│ Patrimoine   │ └──────────────────────────────┘ │ ÉCHÉANCES           │
│ Actualités   │ Plan du trimestre / prévisions   │ Municipales : 3 T   │
├──────────────┴──────────────────────────────────┴─────────────────────┤
│ Temps utilisé : 55/100  ·  Sauvegarde locale    [Trimestre suivant]  │
│                                     [Année suivante] [Accélérer…]    │
└───────────────────────────────────────────────────────────────────────┘
```

Dimensions indicatives : navigation 190–220 px, panneau d’informations 280–320 px, centre flexible. En-tête et barre de commandes visibles pendant le défilement du contenu. La navigation ne remet pas le plan en cours à zéro. Les modules non implémentés sont absents du prototype (pas d’onglets morts). Le contenu central défile sans masquer le bouton d’avance.

### Hiérarchie de l’information

1. Date, âge, fonction principale, temps et ressources dépensables.
2. Décisions obligatoires, alertes critiques et échéances proches.
3. Actions et planification du trimestre ; conséquences certaines et production attendue.
4. Statistiques détaillées, relations, historique et articles de presse.

Les informations cachées restent cachées dans les données de vue : aucune jauge de moralité, aucun trait secret, aucune probabilité de mort précise ni issue future certaine. Le design ne doit pas contourner `PlayerView`.

## 4. Écrans et interactions

| Écran | Contenu principal | Phase |
|---|---|---|
| Accueil | Nouvelle carrière, reprendre, importer/exporter si disponible, réglages simples | Prototype |
| Création | Profil fixe de 25 ans ; puis origine, terrain d’engagement (remplace la profession en V1), territoire, famille et aperçu du bagage ; âge toujours fixe | Prototype puis alpha/V1 |
| Tableau de bord | Situation, flux par trimestre, santé/stress, popularité, bilan du dernier tour | Prototype |
| Agenda | Catalogue d’actions, coûts, plan modifiable, prévisions et validation | Prototype |
| Organisation | Producteurs, achats, charges, date d’activation, missions | Prototype puis alpha |
| Carrière | Mandats, affiliations, échéances, candidatures, campagne et promesses | Alpha puis V1 |
| Entourage | Postes, candidats, profils connus, relations, conseils, famille | Alpha |
| Patrimoine | Argent personnel, actifs, confort, revenus et charges | V1 |
| Actualités | Fil de presse, contexte national, historique des événements | Prototype puis alpha/V1 |
| Justice / institutions | Dossiers, échéances, réformes possibles selon le mandat | V1 |
| Bilan final | Nécrologie, motif de fin, parcours, fortune, promesses, distinction | Prototype puis V1 |

### 4.1 Accueil et création

Affichage minimal, titre et commandes principales. Si une sauvegarde existe, mettre « Reprendre » en évidence, avec date du jeu et date de sauvegarde. Demander confirmation avant d’écraser une carrière. Le prototype n’affiche pas de création fictivement personnalisable ; à terme, présenter chaque profil avec ses compromis sans attribuer de note morale. Afficher la seed dans les détails ou les réglages de test, pas comme donnée principale obligatoire.

### 4.2 Tableau de bord

Une valeur courante et un flux estimé par trimestre par ressource. Séparer clairement budget politique et patrimoine personnel ; ne pas mélanger stock de liquidités et valeur d’actifs. Présenter la fortune avec son détail quand le système existe. Les groupes électoraux et d’influence sont consultables dans une vue détaillée ; ne pas les assimiler tous à des intentions de vote.

Les jauges (santé, stress, exposition, risque judiciaire, popularité) utilisent texte et repères en plus de la couleur. Si une jauge n’est pas encore implémentée, l’omettre. Un historique court des derniers trimestres est préférable aux graphiques décoratifs ; un graphique simple pourra être ajouté lorsque les données sont réellement utiles.

**Depuis P3-08 :** une carte « Tendances » trace une courbe simple par ressource et par jauge (influence, budget politique, argent personnel, popularité, santé, stress) sur les douze derniers trimestres, avec la valeur actuelle et la variation en texte ; un écran « Actualités » présente le fil de presse des vingt derniers trimestres par trimestre, filtrable sur les articles vous concernant, et reste accessible sous 1 100 px où la colonne de presse est masquée. Une fois la carrière terminée, les alertes laissent place au bilan.

### 4.3 Agenda et planification

Chaque action affiche un nom, une description courte, le coût en temps, les coûts financiers éventuels, les prérequis et les effets certains. Les actions indisponibles indiquent la raison. Le joueur ajoute ou retire une action du plan avant engagement ; la liste présente l’ordre d’exécution et le budget restant. Respecter les coûts et répétitions du catalogue, sans créer de règles de gameplay dans le composant.

**Depuis le playtest de l’alpha (26 novembre 2026) :** les actions sont regroupées par thème (militantisme, parti, campagne, réseau, finances politiques, métier, vie personnelle…), en lignes compactes (nom, temps, coûts et effets principaux ; description et détail dépliables) avec un compteur « − n + ». Une action hors de portée (condition non remplie) est masquée et s’affiche à la demande avec son motif ; une action bloquée ce trimestre seulement (temps, argent, limite) reste visible, grisée, avec ce qui manque.

**Depuis P3-11 (26 novembre 2026, remplace la règle de P3-08) :** toute activité ajoutée au plan est ponctuelle : elle vaut pour le trimestre en cours puis disparaît, d’où qu’elle soit ajoutée (agenda, carrière, entourage, monde politique…). Chaque action du plan porte une épingle discrète ; l’activer (« Épingler : répéter chaque trimestre ») la reconduit d’un trimestre à l’autre, à sa place parmi les autres épinglées ; la désactiver la rend ponctuelle après le trimestre en cours. Un achat ne s’épingle jamais. La règle est la même pour un trimestre manuel et pour l’accélération ; la barre d’avance l’annonce avant de partir (« 2 activités ce trimestre, dont 1 répétée ensuite »).

**Plan toujours valide (P3-11) :** une activité déjà impossible n’est pas ajoutée ; le jeu indique pourquoi. Une activité devenue impossible (condition, temps, limite, ressources, cible disparue), épinglée ou non, est retirée d’elle-même : la première fautive dans l’ordre d’exécution, puis le plan est recalculé, de sorte que seules les occurrences en trop partent. Les retraits sont signalés par une notice groupée et non bloquante (« Plan ajusté : Meeting retiré — budget politique insuffisant ») dans le plan et en bandeau, et par une ligne « Agenda » du journal de la session. Une activité retirée perd son épingle et ne revient pas d’elle-même. L’accélération ne s’arrête plus pour un plan à corriger ; elle s’arrête si le plan, non vide au départ, devient entièrement vide.

Les erreurs sont localisées et expliquées. Le bouton de validation est désactivé si le plan est invalide ou une décision bloquante attend. Un plan vide est possible si les règles le permettent. Aucun passage du temps lors de la simple sélection. Les prévisions ne révèlent que les données autorisées et ne tirent pas de hasard. Préciser « actif à partir du trimestre prochain » pour un nouvel investissement ou recrutement.

### 4.4 Événements et conseils

Les événements bloquants interrompent la progression. Carte centrale ou panneau de décision modal accessible, avec titre, contexte, acteurs, choix, coûts certains et tendances prévues. Les événements informatifs alimentent le journal sans fenêtre obligatoire. Un choix indisponible explique son prérequis ; toujours prévoir une issue valide côté moteur.

Exemple indicatif :

> **Un poste pour la famille**  
> Un proche vient de découvrir une vocation pour le service public, précisément au moment où ton cabinet recrute.
>
> **Le recruter** — Soutien relationnel en hausse ; vigilance médiatique possible.  
> **Refuser** — Tensions familiales possibles.  
> **Organiser une sélection ouverte** — Coût en temps ; réaction incertaine.

Avec un conseiller qualifié, une note signale des tendances plus fiables, éventuellement une fourchette si le moteur l’autorise. Avec un mauvais conseiller, la note peut être vague ou imparfaite, sans falsifier les coûts certains. L’interface ne révèle jamais directement les variables cachées. Après le choix, présenter ses conséquences observables et les nouvelles informations découvertes, sans révéler les suites secrètes.

### 4.5 Organisation et entourage

Distinguer effectifs génériques et personnages clés. Pour les premiers : nombre, coût, flux, disponibilité. Pour les seconds : portrait facultatif, nom, rôle, compétences et réseau connus, traits révélés, relation observable, mission, coût et disponibilité. Les traits inconnus restent explicitement inconnus ; aucune estimation cachée par simple infobulle.

Le recrutement montre les profils côte à côte, sans score global de « meilleur candidat ». Les missions persistantes peuvent être changées ou arrêtées. Les alertes importantes signalent les postes vacants, départs et conséquences de délégation. Les relations avec adversaires et proches sont accessibles depuis la fiche d’un personnage.

### 4.6 Carrière, médias, justice et patrimoine

Calendrier électoral : date, type d’élection, temps restant, éligibilité, état de candidature, préparation et sondages disponibles. Déclaration anticipée ou tardive : afficher les compromis connus sans imposer un parcours. Mandats : fonction, durée, revenus, charges et incompatibilités. Les promesses et réformes sont des cartes de décision, pas une interface de gestion macroéconomique.

Le fil d’actualité mêle brèves nationales et événements personnels, avec média fictif, date et titre. Distinguer une allégation de presse d’un fait confirmé ou d’une condamnation. Une affaire judiciaire possède une fiche, un statut, une échéance et des actions disponibles. Les institutions modifiables n’apparaissent que lorsque le joueur dispose d’un pouvoir pertinent.

Patrimoine : actifs possédés et opportunités d’achat, coût, revenu et entretien, avantages et risques visibles. Afficher clairement la trésorerie utilisée. Les actifs ne nécessitent pas un sous-jeu de gestion d’entreprise.

## 5. Rythme et passage du temps

La barre d’avance contient « Trimestre suivant », puis les commandes d’accélération lorsqu’elles sont implémentées. Elles indiquent le mode choisi et permettent d’interrompre la simulation. Si le temps s’arrête, expliquer pourquoi : choix narratif, échéance, alerte, plan invalide ou fin. Les trimestres simulés produisent un résumé groupé, avec détails consultables. Aucun gain hors ligne ; quitter l’onglet ne fait pas vieillir le personnage.

Après un tour, un bilan court indique les variations principales et les actions effectuées. Pas de pop-up pour chaque revenu. Mettre en évidence les alertes prioritaires sans multiplier les notifications. Si aucun choix significatif n’est requis, permettre au joueur de continuer rapidement.

## 6. Bilan de fin de carrière

Une une de journal ou nécrologie satirique synthétise la trajectoire. Afficher le motif réel de fin (décès, condamnation terminale, etc.) et l’âge, les fonctions principales, la fortune, les fonds détournés cumulés, les promesses et les événements marquants lorsque disponibles. La distinction finale reflète les actes et non une jauge morale. Prévoir « Nouvelle carrière » ; aucune récompense ne modifie les statistiques initiales des parties suivantes.

**Depuis P3-08 (26 novembre 2026) :** une de journal du Courrier du Bocage (« Nécrologie », ou « Chronique judiciaire » pour une prison ferme) : titre et chapeau choisis selon la cause et le parcours, dates, distinctions en pastilles (survol : leur motif), frise d’au plus dix moments marquants, parcours en quatre rubriques. Le joueur n’est jamais nommé ni genré.

## 7. Composants et accessibilité

Composants réutilisables : `GameShell`, `ResourceStrip`, `StatGauge`, `AlertList`, `NewsFeed`, `ActionCard`, `TurnPlan`, `TurnControls`, `EventCard`, `ChoiceButton`, `CharacterCard`, `CareerSummary`. Noms indicatifs, pas une exigence de tous les créer dès le bootstrap.

- Focus clavier visible, ordre de tabulation logique, labels accessibles pour les icônes, boutons natifs ; gestion du focus lors d’une décision modale.
- Viser WCAG AA pour contrastes : 4,5:1 pour texte courant et 3:1 pour grands textes et éléments graphiques interactifs pertinents. Vérifier les états hover/focus/disabled.
- Formatage `fr-FR` des euros et nombres ; dates comme « T2 2004 » ; signes +/− et mots pour les variations.
- Les informations nécessaires ne dépendent pas d’une couleur, d’un survol, d’une animation ou d’un portrait.
- Afficher les erreurs de sauvegarde avec possibilité de réessayer ou exporter ; ne pas masquer un état non sauvegardé.
- Aucun écran ne modifie directement le moteur ; les commandes passent par le contrôleur, les données par les projections publiques.

## 8. Ton rédactionnel et contenu évolutif

L’humour repose sur le contraste entre langage administratif et situations absurdes. Préférer les formulations courtes, les clins d’œil indirects, les doubles sens et les contradictions. Éviter les insultes gratuites et les références qui nécessitent de connaître une personnalité réelle. Les textes de choix exposent des décisions, pas une réponse morale correcte. Les médias possèdent des styles distincts, définis par leur identité fictive. L’ancrage à partir de 2000 permet l’évolution des technologies et du vocabulaire. Pas de génération de texte en temps réel.

## 9. Validation de l’interface

Prototype : une carrière de bout en bout sans onglet factice, plan compréhensible, budgets distincts, passage de tour toujours accessible, décision bloquante traitable, reprise fidèle et bilan. Tester les écrans à 1440 × 900 et 1280 × 720, les longues chaînes de texte, valeurs élevées, listes vides, erreurs et navigation clavier.

Alpha : candidature et échéances lisibles, comparaison de candidats sans fuite d’informations cachées, délégation et accélération compréhensibles. V1 : dossier judiciaire, patrimoine, promesses et institutions intégrés sans surcharge. Vérifier le rythme avec de vrais joueurs ; simplifier tout écran dont l’usage nécessite trop de clics récurrents.

## 10. Direction visuelle V1 — étude (26 novembre 2026)

**Statut :** étude préparatoire de la tâche P3-26 (`ROADMAP.md` §5.2). Elle oriente la maquette à valider par le créateur ; palette, police et composants restent provisoires jusqu’à cette validation.

**Demande du créateur (26 novembre 2026) :** rendre le jeu plus ludique et moins « tableur », avec davantage d’indications visuelles, en restant dans les icônes, les barres, les pastilles et la mise en page. Pas d’illustrations dessinées ni d’éléments très interactifs en V1.

### 10.1 Diagnostic de l’interface actuelle

Observé sur une carrière neuve à 1440 × 900 (agenda et tableau de bord) :

- **Tout a le même poids.** Chaque bloc est une carte à bordure fine, titre serif et texte gris : l’œil ne trouve ni point d’entrée ni hiérarchie entre l’urgent, l’utile et l’ambiance.
- **Les ressources sont du texte.** L’en-tête aligne « Influence 2 · Budget politique 100 € · Argent personnel 3 000 € » sans icône ni couleur propre ; seules trois barres très fines (popularité, santé, stress) donnent une forme.
- **Les coûts et effets sont des phrases.** Une ligne d’agenda comme « 15 pts · Budget politique − 20 € · Influence + 1 à 3 · Soutien : Classes populaires + 1 » se lit mot à mot : rien ne distingue d’un coup d’œil un coût d’un gain.
- **Les tableaux dominent.** « Ressource / Actuel / Prévu ce trimestre » et les prévisions du plan ressemblent à une feuille de calcul ; les paragraphes d’explication restent affichés en permanence.
- **Le temps ne se voit pas.** La date est un petit texte de l’en-tête ; rien ne marque le passage d’un trimestre (traité aussi par P3-14).
- **Les personnes n’ont pas de visage.** Personnages, collaborateurs et adversaires sont des noms en texte, sans repère visuel stable.
- **Les alertes se ressemblent toutes.** Même encadré bleu « Information » pour une échéance lointaine et une urgence.

La base est saine : tokens de couleur, Lucide, contraste correct, structure en trois colonnes. Le problème tient à l’absence d’un **langage visuel du jeu**, pas à la technique.

### 10.2 Références étudiées

Jeux de gestion, de politique ou de bureaucratie dont l’interface reste surtout typographique et iconographique, sans dépendre d’illustrations. Il s’agit de leçons de conception, pas d’éléments à reproduire.

| Référence | Ce qui fonctionne | Leçon pour le jeu |
|---|---|---|
| *Reigns* | Quatre ressources réduites à quatre icônes à jauge ; avant de choisir, un point plus ou moins gros signale quelles jauges vont bouger, sans dire dans quel sens | Montrer **quelles** ressources un choix touche (pastilles d’icônes) plutôt qu’une phrase ; compatible avec les tendances sans révéler l’issue |
| *Papers, Please* | Bureaucratie mise en scène par des objets : documents, tampons, guichet ; l’absurde naît du sérieux administratif | Les décisions et rapports deviennent des **pièces de dossier** (note, tampon, en-tête de service) plutôt que des cartes génériques |
| *Suzerain* | Jeu politique très textuel rendu lisible par une forte typographie, des dossiers par personnage et des pastilles de relation | Le texte peut rester central s’il est **mis en page** : titres forts, citations, fiches de personnage avec repère visuel |
| *Democracy* (série) | Chaque politique et chaque groupe a une icône ronde colorée ; les liens d’effet sont visibles par couleur | Une **icône et une couleur par ressource et par groupe**, réutilisées partout (en-tête, agenda, choix, résultats) |
| *Frostpunk* | Deux grandes jauges émotionnelles toujours visibles ; les changements se lisent par flèches et couleurs | Mettre en avant 3 ou 4 jauges vitales avec flèches de tendance, plutôt qu’une dizaine de chiffres égaux |
| *Football Manager* | Interface dense, mais attributs colorés par seuil, pastilles d’état et comparaison côte à côte | Les **valeurs qualitatives par paliers colorés** (compétence, relation, implantation) se comparent mieux qu’un nombre |
| *Game Dev Tycoon* | Les gains apparaissent en petites bulles qui montent ; le jeu est simple mais le progrès se sent | Un **retour bref sur les variations** (+3 qui apparaît puis se fixe) donne la sensation de jeu à peu de frais |
| *Crusader Kings III* | Icônes partout, infobulles imbriquées pour le détail | Le détail vit dans des **infobulles et dépliants**, la surface reste iconique (déjà amorcé par l’agenda) |

### 10.3 Intention révisée

L’intention du §1 évolue : le jeu garde l’**allure institutionnelle** qui fait contraste avec l’absurde, mais devient un **dossier de cabinet mis en scène** plutôt qu’un outil de gestion. Le sérieux vient des matières (papier, tampons, en-têtes administratifs, une de journal, affiche électorale) ; le côté jeu vient des icônes, des jauges, des couleurs de ressource, des pastilles et des retours de variation. Ni clicker bariolé, ni tableur.

### 10.4 Principes

1. **Une ressource = une icône + une couleur**, partout. Influence, budget politique, argent personnel, temps, popularité, santé, stress, exposition, risque judiciaire, préparation, et chaque groupe de soutien. Le texte accompagne l’icône aux endroits clés (accessibilité), l’icône seule suffit dans les listes denses avec libellé accessible.
2. **Des pastilles plutôt que des phrases.** Coûts et effets s’affichent en pastilles : icône, signe et valeur, couleur selon le sens (coût, gain, incertain). Une fourchette devient « +1–3 » ; un effet aléatoire porte un symbole dédié.
3. **Des barres plutôt que des nombres seuls.** Toute valeur bornée (0–100) a sa barre avec repères de seuil et mot de palier ; les ressources non bornées ont un chiffre fort et une flèche de tendance.
4. **Hiérarchie en trois niveaux.** (a) Ce qui exige une action (décision, plan, alerte critique) : couleur pleine, gros corps. (b) L’état du personnage : jauges et chiffres forts. (c) L’ambiance et le détail : petit corps, repliable ou en infobulle. Aucun paragraphe d’aide permanent : aide derrière une icône « ? ».
5. **Le temps a du poids.** La date devient un élément de calendrier (trimestre et année en grand) ; chaque passage de trimestre la met en scène brièvement (P3-14).
6. **Les personnes ont un repère.** Médaillon généré : initiales, couleur stable dérivée de l’identifiant, forme ou liseré selon le rôle (famille, parti, rival, collaborateur, média), petite icône d’humeur ou de relation. Pas de visage dessiné.
7. **Objets de dossier pour les moments forts.** Décision = note de service avec en-tête et tampon de catégorie ; résultat = même note tamponnée ; note de trimestre = feuille datée ; scrutin = résultats en barres façon soirée électorale ; presse = coupures de journal ; bilan = une (déjà en place).
8. **Retours brefs et sobres.** Variations qui apparaissent un instant à côté de la valeur, barre qui glisse, tampon qui se pose. Pas de son, pas de particules, aucune animation nécessaire à la compréhension ; tout est désactivé sous `prefers-reduced-motion`.
9. **Couleurs de sens stables.** Gain, perte, risque, neutre, et une couleur d’accent par famille d’écran au plus. Les couleurs de partis fictifs servent seulement à les reconnaître (pastille, liseré), jamais à juger.

### 10.5 Système de composants à créer

| Composant | Rôle | Remplace |
|---|---|---|
| `ResourceIcon` + table d’identité | Icône, couleur, libellé et format de chaque ressource, groupe et jauge, en un seul catalogue | Libellés textuels dispersés |
| `EffectChip` / `CostChip` | Pastille d’effet ou de coût avec signe, fourchette, aléa | Phrases d’effets de l’agenda, des choix et des actifs |
| `StatBar` | Barre bornée avec seuils, palier nommé, variation prévue en fantôme | `Gauge` actuel, enrichi |
| `ResourceTile` | Chiffre fort, icône, flèche de tendance, flux prévu | Tableau « Situation » |
| `Avatar` | Médaillon d’initiales coloré par identifiant, liseré de rôle | Noms seuls |
| `Stamp` / `FileHeader` | Tampon de catégorie (URGENT, CONFIDENTIEL, CAMPAGNE…) et en-tête de note | Titres de modale |
| `TierBadge` | Palier qualitatif coloré (compétence, implantation, attractivité, militants) | Nombres bruts ou mots isolés |
| `CalendarDate` | Date mise en forme de calendrier, transition de trimestre | Texte « T1 2000 » |
| `DeltaFlash` | Variation affichée brièvement près d’une valeur | Rien |
| `ScoreBars` | Barres de sondage et de résultat de scrutin | Texte de fourchette |

Ces composants lisent uniquement `PlayerView` : aucune information cachée ne devient visible parce qu’elle est dessinée (pas de jauge morale, pas de trait caché, pas de probabilité).

### 10.6 Application par écran (première passe)

- **En-tête :** date-calendrier, ressources en tuiles icône + chiffre + flèche, jauges vitales en barres épaisses avec palier ; fonction principale en badge.
- **Agenda :** lignes avec icône de catégorie, pastilles de temps, coût et effets ; groupes avec icône et couleur de thème ; plan du trimestre en barre de temps segmentée par activité (couleur de catégorie), au lieu d’un compteur « 0/100 ».
- **Tableau de bord :** tuiles de ressources, jauges, courbes de tendance conservées ; explications en « ? ».
- **Décisions :** note de service tamponnée, acteurs en médaillons, choix avec pastilles des ressources touchées (à la *Reigns*), résultat sur la même note (P3-14).
- **Carrière et scrutins :** échéances en frise, sondage et résultat en barres comparées, mandats en badges.
- **Entourage et relations :** fiches à médaillon, paliers colorés, traits connus en pastilles, traits inconnus en pastilles grisées « ? ».
- **Alertes :** trois niveaux visuels (critique, à traiter, information) avec icône propre.
- **Presse :** coupures avec nom du média typographié, ton en pastille.

### 10.7 Typographie et palette

- Conserver la base crème et bleu institutionnel, mais **élargir la palette** : une couleur par ressource (au moins 8 teintes distinctes, AA sur fond crème), un accent tricolore discret (bleu, blanc, rouge) pour la marque et les grands moments, pas pour les sens gain/perte.
- **Une police de titrage affirmée**, de type affiche ou presse (serif condensée ou slab), auto-hébergée sous licence libre (OFL) et en un seul fichier, pour titres, date et une de journal ; corps en system-ui inchangé, chiffres tabulaires. Dépendance justifiée par la demande : à confirmer dans la maquette.
- Rayons, ombres légères pour les objets « posés » (notes, coupures), bordures pour le reste.
- Aucun logo réel, pas de bloc Marianne ni d’emblème officiel ; un monogramme ou une cocarde propre au jeu.

### 10.8 Hors périmètre V1

Illustrations dessinées, portraits caricaturaux, carte de France interactive, glisser-déposer, animations longues ou décoratives, son, thème sombre. Les portraits restent une piste après la V1 (§2).

### 10.9 Critères de validation

- Sur l’agenda et le tableau de bord, un joueur identifie en moins de cinq secondes son temps restant, ses ressources et ce qui lui coûtera le plus ce trimestre.
- Une ligne d’action se lit sans lire de phrase : catégorie, temps, coût et effet principal sont repérables aux icônes et aux couleurs.
- Aucune information nécessaire ne dépend de la seule couleur ou d’une animation ; contrastes AA ; navigation clavier inchangée.
- Le texte permanent visible sur l’agenda et le tableau de bord diminue nettement (objectif indicatif : moitié moins de mots).
- Les playtests B1 et B2 jugent l’interface « plus jeu » sans perte de lisibilité.
