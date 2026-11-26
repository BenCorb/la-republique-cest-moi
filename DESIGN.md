# La République, c’est moi ! — Direction artistique et interface

**Version 0.1 — 24 novembre 2026**  
**Statut :** cadrage avant prototype ; wireframes et valeurs visuelles indicatifs.  
**Références :** [GAME_DESIGN.md](GAME_DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md).

## 1. Intention

Un outil de gestion politique à l’apparence institutionnelle, dont le sérieux contraste avec l’absurdité des événements. Le joueur doit avoir l’impression de consulter les dossiers de son propre cabinet, pas de jouer à un clicker coloré. L’interface sert d’abord à prendre des décisions, à comprendre les conséquences du trimestre et à lire des histoires.

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
| Création | Profil fixe de 25 ans ; puis origine, profession, famille, âge et aperçu du bagage | Prototype puis alpha/V1 |
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

**Depuis P3-08 (26 novembre 2026) :** chaque action du plan porte une épingle. Épinglée (par défaut), elle est reconduite au trimestre suivant ; désépinglée, elle est ponctuelle et retirée après le trimestre. La règle est la même pour un trimestre manuel et pour l’accélération ; un achat n’est jamais reconduit.

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
