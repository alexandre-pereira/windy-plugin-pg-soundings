# Changelog

Toutes les versions publiées de PG Soundings, de la plus récente à la plus ancienne.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros de version
[SemVer](https://semver.org/lang/fr/).

Le dépôt git ne commence qu'après la 1.2.7 : les entrées plus anciennes ont été reconstituées après
coup à partir des notes de publication. Chaque version reste installable depuis Windy à l'adresse
`https://windy-plugins.com/2727410/<nom-du-plugin>/<version>/plugin.min.js`.

## [1.13.0] - 2026-10-07

Le dessin des nuages change, pas leur calcul : bases, sommets, pluie et heures sont les mêmes
qu'avant, dans l'infobulle comme sur le graphique.

### Ajouté

- Infobulle du graphique, au doigt : une croix la ferme.

### Modifié

- Graphique « Vent & thermiques » : le bandeau « Pluie » n'est affiché que s'il pleut à l'une des
  heures affichées, et le bandeau « CAPE LI » n'est pas affiché quand la CAPE et le LI restent
  verts à toutes les heures. La pluie de l'heure reste dans l'infobulle.
- Infobulle du graphique plus courte. L'altitude pointée n'est plus écrite que dans le titre : dans
  chaque groupe, la valeur à cette altitude vient en premier, soulignée. Le vent est sur la ligne
  de son titre, le vario à l'altitude pointée et le vario max sur une ligne, les trois
  températures (altitude pointée, sol, isotherme 0 °C) sur une ligne, la nébulosité à l'altitude
  pointée et son total sur une ligne. La vitesse de montée de l'air, à côté du vario max, n'y est
  plus écrite. L'infobulle est un peu plus large.
- Infobulle du graphique : le plafond est nommé « Plafond exploitable ».
- Bandeau « Nouvelle version » : il dit de coller le lien à la place du texte déjà présent dans le
  champ de Windy (« https://windy-plugins.com/ »). Collé à la suite, le lien commençait deux fois
  et Windy le refusait.
- Infobulle du graphique : la CAPE et le LI n'y sont plus. Ils se lisent dans le bandeau
  « CAPE LI » et dans l'onglet « Émagramme ».
- Nuages d'averses d'heures qui se suivent, ou qu'une seule heure sans averse sépare : une seule
  masse, d'un seul contour, à la place d'une tour par heure collée aux voisines. Sa base et son
  sommet passent par ceux de chaque heure d'averses, sans marches d'escalier ni bourgeons entre
  deux heures.
- Plafond nuageux : il n'est plus dessiné en nappe, mais par le trait sombre de sa base, sous
  l'ombre du dessous du nuage, sur le voile des nuages du modèle qui montre déjà la couche. La
  nappe, plus claire que le voile et dessinée jusqu'à son sommet, s'y lisait comme un nuage dans
  un nuage ; là où la couche ne durait pas d'une heure à l'autre, ses bords faisaient des tours et
  des collines, et une couche épaisse d'un jour de pluie devenait une forme grise sans sens. Le
  dessus d'une mer de nuages reste souligné de blanc. Le dessus moutonné d'une couche en amas et
  la bande mince d'un altocumulus ne sont plus dessinés : le genre de la couche se lit dans
  l'infobulle. Le trait s'estompe quand la couche ne dure pas jusqu'à l'heure voisine, et n'est
  pas dessiné là où un nuage d'averses traverse la couche à la même heure : c'est le même nuage.
- Voile des nuages du modèle : plein dès 75 % de nébulosité, au lieu de 100 %, et plus léger
  sous 40 %. Entre des heures à 80 et 100 %, le voile faisait des bandes verticales ; à 75 %, le
  ciel est couvert. Et le bord d'un voile dont la nébulosité oscille autour de 30 % d'une heure à
  l'autre faisait des bosses, la nuit surtout.
- Plafond nuageux : le long d'une même couche, sa base et son sommet sont lissés avec les heures
  voisines (moyenne sur trois heures), sur le graphique, dans l'infobulle et sur l'émagramme. Ils
  sautaient d'un niveau du modèle à l'autre quand la nébulosité oscille autour du seuil : le
  plafond d'un jour de pluie zigzaguait de 500 m d'une heure à l'autre.
- Relief pris dans les nuages : les tirets ne sont plus dessinés sur un voile dense, qui montre déjà
  que le relief est dans les nuages. Ils restent là où le voile est léger ou absent.
- Cumulus des thermiques : même étalés, ceux de deux heures voisines ne se touchent plus.
- Halo des nuages plus hauts que le graphique : il naît peu à peu d'une heure à l'autre, sans
  bord net.

### Corrigé

- Bandeau « Nouvelle version » : il annonçait parfois une version intermédiaire au lieu de la
  dernière, et pouvait garder des heures une version trouvée pendant une panne du réseau. La
  dernière version est maintenant lue sur GitHub (dernière release) et vérifiée sur
  windy-plugins.com avant d'être annoncée ; sans réponse de GitHub, la recherche de version en
  version va jusqu'au bout et passe les numéros sautés.
- Thème clair, sur téléphone : la croix qui ferme le panneau restait blanche, et la bande en haut
  du panneau, entre la carte et le plugin, restait sombre.
- Thème sombre : les listes déroulantes des réglages (altitude max, taille du panneau) s'ouvraient
  en texte gris clair sur fond blanc.

## [1.12.0] - 2026-10-04

### Ajouté

- Taille du panneau : choix de 70 % de l'écran, en plus de 30, 50 et 60 %.

## [1.11.0] - 2026-10-04

### Ajouté

- Lieux favoris : le nom du lieu, en haut du panneau, ouvre la liste des favoris du compte Windy ;
  en choisir un y amène le plugin et la carte. Le cœur à côté du nom ajoute le lieu affiché aux
  favoris de Windy, ou l'en retire. Le lieu affiché prend le nom du favori sur lequel il est posé.
- Émagramme : un point bleu marque l'isotherme 0 °C sur la courbe d'état, là où elle croise
  l'isotherme bleue.

### Modifié

- Taille du panneau : le choix est 30, 50 ou 60 % de l'écran, et 60 % tant que rien n'est choisi.
  Le panneau ne prend plus tout l'écran sur téléphone, ni sa largeur fixe sur ordinateur : les
  choix « Plein écran » et « Par défaut » sont retirés.
- Sur téléphone et tablette, déplacer la carte ne change plus le lieu : il change quand on touche
  la carte ou qu'on choisit un favori.
- Sur téléphone, le titre « PG Soundings » est masqué et le contenu commence tout en haut du
  panneau.
- Les marges à gauche et à droite du panneau sont plus fines : le graphique et l'émagramme sont
  plus larges, d'une trentaine de pixels sur téléphone.
- Les réglages du bas du panneau (altitude max, 24 h, thème, taille du panneau, options de
  l'émagramme) et les informations sur les données (altitude du site et du sol dans le modèle,
  crêtes voisines, heure de calcul de la prévision) sont repliés sous un bouton « Réglages et
  infos », qui les ouvre à la demande.
- Émagramme : le plafond, les cumulus et la température et le point de rosée au sol ne sont plus
  répétés sous l'émagramme, où ils sont déjà écrits. Restent dessous le vario, l'isotherme 0 °C,
  la CAPE, le LI et le risque d'orage. Sur l'émagramme, le plafond est écrit aussi quand il est
  nettement sous la base des cumulus, et un niveau plus haut que le cadre est écrit en haut.

### Supprimé

- Graphique « Vent & thermiques » : le bandeau « Therm. » sous le graphique est retiré. La qualité
  des thermiques de chaque heure reste donnée par l'infobulle (ligne « Thermiques »).

## [1.10.0] - 2026-10-04

### Ajouté

- Taille du panneau au choix, dans les réglages en bas du panneau : 25, 50 ou 75 % de l'écran. Sur
  ordinateur et tablette, c'est la largeur du panneau, à droite de la carte ; sur téléphone, sa
  hauteur : le panneau reste en bas et la carte se voit au-dessus. La carte se décale pour que le
  lieu reste au milieu de sa partie visible. Le choix est mémorisé ; « Par défaut » (ordinateur)
  et « Plein écran » (téléphone) gardent la taille d'avant.

### Modifié

- Sur téléphone, la poignée en haut du panneau, qui le baissait à demi quand on la tirait, est
  retirée : la taille du panneau ne se change que par le réglage du bas du panneau.
- La mise en page étroite (onglets courts, jours sur une ligne, valeurs de l'émagramme deux par
  ligne) suit la largeur du panneau, et non plus celle de l'écran : un panneau réduit à 25 % de
  l'écran sur ordinateur l'utilise aussi.

### Corrigé

- Sur ordinateur, quand le graphique ou l'émagramme défile (panneau étroit), la barre de
  défilement se place sous le graphique au lieu de le recouvrir : le bandeau « CAPE LI » et l'axe
  des températures de l'émagramme restent lisibles.

## [1.9.0] - 2026-10-04

Les heures des fronts changent. Les fronts froids sont affichés de 1 à 6 heures plus tôt
(2 heures en médiane), à l'heure où l'air commence à changer ; les fronts chauds jusqu'à 6 heures
plus tard (2 heures en médiane), à l'heure où il finit de changer. Les uns et les autres étaient
placés à l'heure où l'air change le plus vite.

### Modifié

- Le lieu du plugin est toujours marqué sur la carte par son propre repère, un viseur orange,
  même quand le sélecteur de Windy est ouvert. Le repère est posé sur le lieu dont le panneau
  affiche la prévision : si le sélecteur ou un autre point de la carte est ailleurs, l'écart se
  voit.
- Sur téléphone, le haut du panneau prend moins de place : les onglets « Vent » et « Émagramme »
  tiennent sur une ligne, pictogramme et nom côte à côte, et chaque jour de la liste aussi (nom,
  plafond et vario à la suite, sans les mots « Plafond » et « m/s »).
- Le choix du modèle est plus petit.
- Émagramme : au survol, les valeurs s'écrivent sur les courbes, à côté de leur point, à la place
  de l'infobulle : température, point de rosée, particule et courbe du lever du jour. Le gradient
  de température est écrit sous la ligne, en °C par 100 m (et non plus par km), à la couleur de
  sa stabilité.
- Infobulle du graphique plus courte : nuages plus hauts que le graphique sur la ligne du total,
  nuage de la pluie ou des averses sur la ligne de la pluie, noms de couches raccourcis
  (« Couche », « Brouillard »), lignes plus serrées. La température au sol est donnée avec
  l'altitude du sol dans le modèle (« Sol (466 m) »), sans le point de rosée.
- Graphique « Vent & thermiques » : le bandeau « Ciel » s'appelle « Nuages ».
- Graphique « Vent & thermiques » : l'altitude du niveau de la carte, celle qu'un clic sur le
  graphique choisit, est écrite en orange sur l'axe des altitudes, au bout de ses tirets, à la
  place du triangle.
- Graphique « Vent & thermiques » : les heures sont écrites en haut, sur la barre de l'heure, et
  plus sous le graphique. Le trait orange de l'heure choisie descend jusqu'en bas, à travers les
  bandeaux « Therm. », « Pluie » et « CAPE LI ».
- Graphique « Vent & thermiques » : le halo qui signale des nuages plus hauts que le graphique est
  plus visible. Il est plus haut, plus clair, et plein au ras du bord supérieur, de jour comme de
  nuit.

### Supprimé

- Fronts : l'étiquette au pied du trait (« Front chaud 13h–16h », « Front froid rapide · raf. 55 »),
  la barre qui reliait les deux heures d'un modèle fourni toutes les 3 heures, et l'annonce, au
  bord du graphique, d'un front de la nuit ou de la veille (« ← Front froid 22h »). Le trait et ses
  symboles restent ; le nom du front, ses heures et ses rafales se lisent dans l'infobulle des
  heures qu'il traverse, et le symbole du front suit toujours le nom du jour où il passe.
- Infobulle du graphique : le vent et les rafales au sol, déjà écrits dans le relief du graphique,
  et le sommet thermique.
- Émagramme : le sommet thermique, dans les valeurs sous le graphique. Il reste marqué sur la
  courbe avec l'option « Ascension de la particule ».
- Émagramme : l'infobulle du survol, et avec elle la pression, le vario, le vent et les nuages à
  l'altitude pointée. Le vent et les nuages se lisent dans les colonnes de droite.

### Corrigé

- Fronts froids : le trait était dessiné 2 à 3 heures trop tard. Il était placé à l'heure où l'air
  change le plus vite, au milieu du refroidissement ; il l'est maintenant à l'heure où l'air
  commence à changer, celle où le vent tourne au sol. Le pied du trait, l'heure de l'infobulle et
  le symbole de la liste des jours avancent d'autant (de 1 à 6 heures selon le front), et le trait
  passe plus tôt jusque vers 1 500 m.
- Fronts chauds : le trait était dessiné 2 à 3 heures trop tôt au sol, au milieu du réchauffement.
  Il est maintenant placé à l'heure où l'air finit de changer, celle où le vent tourne au sol : le
  pied du trait, l'heure de l'infobulle et le symbole de la liste des jours reculent d'autant
  (jusqu'à 6 heures selon le front).
- Plafond nuageux : quand la couche faiblit, la nappe ne saute plus, le temps d'une heure ou deux,
  sur un lambeau de nuages d'une autre altitude qui n'a jamais couvert la moitié du ciel. Elle
  reste à l'altitude de la couche tant que celle-ci garde 40 % de nuages, puis s'arrête.
- Mer de nuages : elle est reconnue aussi quand le sommet de la couche tombe sur un niveau du
  modèle. L'air « juste au-dessus » était alors lu à ce niveau, dans la couche elle-même.

## [1.8.0] - 2026-10-03

Les valeurs affichées ne changent pas : plafonds, ascendances, seuils et heures des fronts restent
ceux de la 1.7.0. Cette version ajoute des signaux sur les phénomènes forts (fronts rapides, sauts
de vent, tourbillons de poussière, rafales descendantes, orages voisins) et relie le lieu et
l'altitude du plugin à la carte de Windy.

### Ajouté

- Fronts : leur vitesse et la direction d'où ils viennent, lues sur le retard de leur passage aux
  quatre points voisins. L'infobulle les donne (« ~45 km/h de O »), et un front d'au moins 50 km/h
  est nommé « rapide » sur le graphique, au bord et dans l'infobulle.
- Fronts : saut de vent au sol. Quand les rafales montent d'au moins 15 km/h au passage et
  atteignent 30 km/h, l'étiquette du front les ajoute (« raf. 55 ») et l'infobulle donne les
  rafales avant et après.
- Fronts : passage brutal. Quand l'essentiel du changement d'air se fait en 2 heures, l'infobulle
  donne la variation de température de ces 2 heures.
- Fronts : avec un modèle que Windy ne fournit que toutes les 3 heures, le passage au sol est
  donné entre deux heures (« 13h–16h ») au lieu d'une heure interpolée, et une barre relie ces
  deux heures au pied du trait.
- Tourbillons de poussière (« dusts ») : un entonnoir au ras du sol signale les heures qui en
  réunissent les ingrédients (thermiques puissants et profonds, vent faible au sol, air et sol secs,
  plein soleil). C'est un potentiel : aucune observation ne permet de vérifier ces seuils.
- Virga : trois chevrons rouges, au lieu de deux orange, quand l'air très sec sous le nuage peut
  donner de fortes rafales descendantes.
- Orage voisin : quand le modèle prévoit un orage à 55 km que le vent pousse vers le lieu, sans en
  prévoir sur le lieu à ces heures, un bandeau le dit au-dessus des onglets (distance, côté, heure,
  vitesse, heure d'arrivée possible), et son icône cerclée de tirets est posée sur le graphique à
  l'heure où il peut arriver.
- L'altitude du plugin et celle de la carte Windy sont synchronisées, comme l'heure et le modèle.
  Cliquer ou toucher le graphique « Vent & thermiques » à une altitude met la carte au niveau le
  plus proche (sol, 100 m, niveaux de pression). Le niveau de la carte est repéré sur le graphique
  par des tirets orange et un triangle sur l'axe des altitudes.
- Le lieu du plugin suit le sélecteur de la carte Windy (le point qu'on déplace pour lire le
  vent) : l'ouvrir ou le déplacer charge la prévision de sa position. Tant qu'il est ouvert, c'est
  lui qui montre le lieu, sans le repère du plugin en plus ; un clic ailleurs sur la carte l'y
  amène. Le lieu du plugin est ainsi toujours celui qui est mis en valeur sur la carte.
- Barre de l'heure en haut du graphique « Vent & thermiques », alignée sur ses colonnes : le
  bouton orange porte l'heure choisie, au sommet du trait orange. Il se déplace au doigt ou à la
  souris, d'heure en heure, et la journée se lit d'heure en heure avec le bouton ▶. L'heure
  choisie n'est plus répétée sur l'axe des heures, au pied du trait.

### Modifié

- Choix de l'heure de l'émagramme : le curseur tient sur une seule ligne, sur téléphone aussi.
  L'heure choisie est écrite au-dessus de son bouton, à la place des heures repères qu'elle
  recouvre ; les flèches et la lecture sont à ses bouts.
- Bandeau « Ciel » : une case par heure remplace le disque. La couverture nuageuse y est écrite en
  pourcentage, et la case va de transparente (ciel dégagé) à grise (ciel couvert), de jour comme
  de nuit. La part qui cache le soleil et celle qui ne fait que le voiler n'y sont plus
  distinguées.
- Graphique « Vent & thermiques » : un clic à la souris choisit l'heure et l'altitude et n'ouvre
  plus l'émagramme, qui reste à un onglet de là.
- Barres de défilement de la liste des jours, du graphique et de l'émagramme : fines et sans
  piste, les mêmes partout. Sous l'émagramme, la barre claire passait pour un second curseur de
  l'heure.
- Bandeau « Therm. » : les thermiques des cases vertes sont dits « francs », et non plus
  « faciles », dans l'infobulle comme dans la légende. La légende nomme le bandeau « qualité des
  thermiques », au lieu de « facilité d'exploitation des thermiques ». Les couleurs et les seuils
  ne changent pas.

## [1.7.0] - 2026-10-03

Cette version modifie le sommet affiché des cumulus des thermiques : il est plus bas qu'avant quand
l'air est sec ou à peine instable. Leur base, les plafonds, les ascendances et le risque
d'orage ne changent pas. Elle déplace aussi l'heure des fronts froids, donnée au sol
et non plus en altitude (souvent quelques heures plus tôt), et resserre le voile des nuages en
couches là où l'air est sec entre deux niveaux du modèle : la base et le sommet des couches de
nuages changent en conséquence. La couche d'où tombe une pluie de front est maintenant le plafond
nuageux de l'heure, mesuré là où la nébulosité dépasse 40 % : sa base, donnée par l'infobulle, est
souvent plus basse qu'avant, et plus régulière d'une heure à l'autre.

Le sommet des petits cumulus baisse encore : un cumulus dont la base est proche du sol se dilue plus
vite qu'une tour (200 m de moins en médiane sur les prévisions d'essai, rien de changé quand la
base est à 2 000 m du sol ou plus). Sur les sites à plus de 500 m d'altitude, les nuages situés à
moins de 2 500 m du sol cachent davantage le soleil qu'avant : sous un ciel couvert vers 3 000 m,
les ascendances et les plafonds y sont plus faibles. Le bandeau « Therm. »
passe à l'orange quand le vent change beaucoup entre le sol et le plafond (cisaillement) et, en
montagne, au jaune quand le plafond reste sous les crêtes. Les cases de la CAPE changent de couleur
à des valeurs plus basses ; les valeurs elles-mêmes, le LI et le risque d'orage ne changent pas.

La pluie est plus souvent dessinée en averses, surtout avec ECMWF, qui ne fournit pas de
précipitations convectives : des heures dessinées jusqu'ici en pluie de front portent maintenant un
nuage d'averses, avec sa base et son sommet, et une virga quand sa base est haute. Avec un modèle
qui fournit ses précipitations convectives, une pluie où elles comptent pour moins de la moitié
reste une pluie de front.

L'isotherme 0 °C change quand il gèle au sol sous un air plus doux (inversion) : elle est donnée au
sommet de la couche douce, et non plus à l'altitude du sol. Dans le bandeau « Therm. », une heure
de pluie ou de risque d'orage n'est plus verte.

### Ajouté

- L'heure du plugin et celle de la carte Windy restent synchronisées dans les deux sens. Déplacer
  l'heure de la carte affiche ce jour et cette heure dans le plugin ; choisir un jour ou une heure
  dans le plugin (onglets des jours, curseur et lecture de l'émagramme, clic sur le graphique)
  déplace la carte. À l'ouverture, le plugin se place sur l'heure de la carte.
- Graphique : l'heure choisie est repérée par un trait orange, avec son heure sur l'axe. Si elle
  est hors de la partie affichée, le graphique défile jusqu'à elle.
- Graphique « Vent & thermiques » : les passages de front y sont dessinés, comme sur une coupe
  météo. Un trait bleu à triangles marque un front froid, un trait rouge à demi-cercles un front
  chaud, avec son étiquette au pied. Le trait suit la surface du front : il part du sol à l'heure
  où le front y passe et penche vers l'heure où il passe en altitude, quelques heures plus tard
  pour un front froid, plus tôt pour un front chaud. L'infobulle des heures qu'il traverse donne le
  refroidissement ou le réchauffement de l'air en altitude, la rotation du vent, la pluie autour du
  passage et les heures du passage au sol et en altitude. Un front froid passé dans les 12 heures
  qui précèdent le graphique, ou un front attendu dans les 6 heures qui suivent, est annoncé au
  bord avec son heure. La légende les explique.
- Liste des jours : le symbole du front (triangles bleus, demi-cercles rouges, ou les deux en
  violet pour une occlusion) suit le nom de chaque jour où un front passe.
- Fronts : l'heure d'un front est celle où il passe au sol, celle où l'air change le plus vite près
  du sol. Un front froid y passe souvent quelques heures avant d'atteindre l'altitude, un front
  chaud après. Le trait passe par l'heure du sol, par l'heure que donne la carte à son altitude
  (vers 1 500 m) et par l'heure où l'air change plus haut : il ne penche jamais à l'envers, ni de
  plus de 6 heures. L'infobulle donne aussi la variation de la pression après le passage, quand le
  modèle la fournit.
- Fronts lents : un changement de masse d'air étalé sur 12 heures est reconnu lui aussi, front
  froid comme front chaud.
- Occlusions : un trait violet à triangles et demi-cercles marque une langue d'air chaud qui passe
  en altitude sous la pluie, sans que l'air change près du sol.
- Front froid sec : un front froid qui passe avec moins de 1 mm de pluie est nommé « front froid
  sec ».
- Graphique « Vent & thermiques » : le plafond nuageux de chaque heure y est dessiné en nappe.
  C'est la plus basse couche où le modèle prévoit au moins 50 % de nuages, à n'importe quelle
  altitude, soulignée d'un trait sombre à sa base. Une couche de nuages bas (stratus, base à moins
  de 2 000 m du sol, brouillard quand elle le touche) est dessinée jusqu'à son sommet, souligné de
  blanc quand l'air est clair et sec juste au-dessus : c'est une mer de nuages. Une couche
  épaisse, ou de l'étage haut, s'estompe en montant. L'infobulle donne la base et le sommet, à
  quelques centaines de mètres près, parce que le modèle n'a que quelques niveaux.
- Graphique « Vent & thermiques » : une couche faite d'amas séparés par des trouées a le dessus
  moutonné, une nappe continue le dessus lisse. Sont dessinées en amas la couche de nuages bas que
  les thermiques nourrissent (cumulus, stratocumulus), nommée « Couche de cumulus » dans
  l'infobulle, et la couche mince de l'étage moyen, à plus de 2 000 m du sol, nommée
  « Altocumulus » et dessinée en bande mince. Une couche épaisse de l'étage moyen est nommée
  « Altostratus, altocumulus ». Sous une couche de cumulus, les observateurs de 62 stations
  d'Europe notent des cumulus 8 fois sur 10 ; sous une couche de nuages bas sans thermique, 4 fois
  sur 10. La légende l'explique.
- Graphique « Vent & thermiques » : un bandeau « Ciel », au-dessus du graphique, montre le ciel de
  chaque heure. Un disque, jaune le jour et bleu sombre la nuit, se couvre de gris sur la part du
  ciel que prennent les nuages, tous étages confondus, y compris plus haut que le graphique. Le
  gris est plein pour la part qui cache le soleil, léger pour celle qui ne fait que le voiler,
  comme un voile d'altitude.
- Graphique « Vent & thermiques » : le vent au sol de chaque heure y est écrit dans le relief brun,
  sous la ligne du sol, aux couleurs du vent en altitude. Le vent moyen (flèche et km/h) est repéré
  par « Vent » sur l'axe, les rafales, en dessous, par « Raf. ». Quand le relief est trop mince pour
  eux (site proche du niveau de la mer, grande altitude max), le bas du graphique descend un peu
  sous l'altitude du sol pour leur faire la place. Vent moyen et rafales n'étaient jusqu'ici que
  dans l'infobulle.
- Graphique « Vent & thermiques » : en montagne, des tirets marquent le relief pris dans les
  nuages. Ils couvrent les altitudes où l'air est saturé, du sol au niveau des crêtes voisines,
  même là où le modèle n'annonce pas de couche. Ce niveau, le plus haut du terrain à 10 km à la
  ronde, est repéré par un pointillé brun et un triangle sur l'axe ; il figure aussi sous le
  graphique. En plaine, rien n'est dessiné, ni dans une nappe de nuages, qui dit déjà que le relief
  y est dans les nuages.
- Limite pluie-neige : un pointillé pâle la trace aux heures de précipitations, et l'infobulle la
  donne. Au-dessus, les flocons ne fondent pas. Dans un air sec, elle est nettement plus basse que
  l'isotherme 0 °C.
- Virga : des chevrons orange sous une averse dont la base est à plus de 1 500 m du sol. La pluie
  s'évapore en tombant dans l'air sec et le refroidit : il descend en rafales, même sans pluie au
  sol.
- Ondes de relief : en montagne, une vague en haut de la colonne signale les heures où le vent
  atteint 30 km/h au niveau des crêtes voisines dans un air stable, sans tourner avec l'altitude.
  Des ondes et leurs rotors sont alors possibles sous le vent du relief.
- Lecture au doigt : sur le graphique et sur l'émagramme, gardez le doigt appuyé un instant puis
  glissez. L'infobulle suit le doigt, d'heure en heure et d'altitude en altitude, sans que la page
  défile. Un glissé sans appui fait défiler comme avant, un simple toucher lit un point.
- Niveaux du modèle : des points sur l'axe des altitudes du graphique, et sur la courbe d'état et le
  point de rosée de l'émagramme, marquent les niveaux où le modèle fournit ses données. Entre deux
  points, vent, température et nuages sont interpolés : un plafond qui tombe entre deux points
  éloignés est moins sûr.
- Émagramme : une bande, à gauche de la colonne de vent, montre les nuages du modèle à chaque
  altitude, comme le voile gris du graphique, avec un trait à la base du plafond nuageux de l'heure.
  L'infobulle donne la nébulosité à l'altitude pointée.
- Émagramme : option « Courbe du lever du jour », en bas de page. La courbe d'état de l'heure du
  lever du soleil est tracée en trait pâle sous celle de l'heure affichée : l'écart entre les deux
  montre ce que la journée a changé. L'infobulle donne aussi la température de cette heure-là.
- Bandeau « Therm. » : en montagne, un plafond qui n'atteint pas le niveau des crêtes voisines est
  signalé en jaune, « sous les crêtes », même s'il dépasse de plus de 300 m le sol du modèle.
- Thermiques hachés : le cisaillement compte aussi. Plus de 20 km/h d'écart entre le vent au sol et
  le vent au plafond (très hachés au-delà de 35 km/h), en force comme en direction, signale des
  thermiques couchés et cassés même quand le vent moyen de la couche reste modéré.
- Infobulle : « Bruine » pour une faible pluie qui tombe d'une couche de nuages bas, « Cumulus
  étalés » quand le modèle met au moins 60 % de nuages dans la couche des cumulus, et la mention
  « cumul de 3 h réparti » quand la pluie de l'heure vient d'un pas de 3 heures du modèle.
- Panneau resté ouvert : le trait de l'heure actuelle et l'alerte d'orage suivent l'heure, relue
  chaque minute, et une prévision affichée depuis plus d'une heure est rechargée sur place.

### Modifié

- Averses : les averses de traîne, derrière un front froid, sont reconnues. Presque sans énergie
  (CAPE), elles passaient pour une pluie de front. Elles se lisent maintenant à l'air froid en
  altitude au-dessus d'un air humide. Comparé au temps noté par les observateurs de 62 stations
  d'Europe, le plugin dessine en averses 5 à 7 heures d'averses sur 10, contre 3 sur 10 avant avec
  ECMWF, et 7 heures dessinées en averses sur 10 en sont bien. Avec un modèle qui fournit ses
  précipitations convectives, une pluie de front où elles comptent pour moins de la moitié reste
  une pluie de front.
- Bandeau « Therm. » : une heure où il tombe au moins 0,5 mm de pluie, ou qui porte un risque
  d'orage (surdéveloppement compris), n'est plus verte. Quand ses thermiques seraient dits faciles,
  sa case est grise, « pluie ou orage ». La légende l'explique.
- Isotherme 0 °C : quand il gèle au sol sous un air plus doux (inversion d'hiver en vallée), elle
  est donnée là où l'air repasse sous 0 °C au-dessus de la couche douce, au lieu de l'altitude du
  sol.
- Émagramme : entre deux heures pleines, la pluie garde la nature de l'heure en cours (averses ou
  non), l'orage violent compte les rafales des heures voisines comme aux heures pleines, et le
  trait du plafond nuageux est celui du graphique, décidé avec les heures de la journée. Ils ne
  changent plus quand le curseur passe entre deux heures qui les partagent.
- Fronts : ils sont lus sur la carte autour du lieu. Le plugin charge, en plus de la prévision du
  lieu, celle de quatre points à 55 km au nord, au sud, à l'est et à l'ouest : un front est une
  zone où la masse d'air (température et humidité ensemble) change vite d'un endroit à l'autre, et
  que le vent pousse sur le lieu. Jusqu'ici, le front était cherché sur le lieu seul, là où l'air
  se refroidit ou se réchauffe d'au moins 3 °C en 6 heures entre 1 500 et 3 000 m sous la pluie, un
  ciel couvert ou un vent qui tourne : sur un mois de prévisions de 16 sites d'Europe, 3 fronts de
  la carte sur 10 seulement étaient reconnus, et presque aucun front chaud. Les fronts
  apparaissent un instant après le graphique, le temps de lire les points voisins. Si
  ces points ne répondent pas, le front est cherché sur le lieu seul, par le changement de sa
  masse d'air entre 750 et 2 000 m au-dessus du sol.
- Vent en altitude : les rangées de flèches sont plus serrées, pour lire le vent à davantage
  d'altitudes. Avec l'altitude max automatique, il y en a une tous les 200 m au lieu de 250 m ;
  quand le graphique monte plus haut, tous les 250 à 400 m au lieu de 500 m, et tous les 500 m au
  lieu de 1 000 m avec une altitude max de 8 000 m.
- Pluie de front : la couche de nuages d'où elle tombe est dessinée en nappe grise, continue d'une
  heure à l'autre, avec son rideau de pluie dessous, au lieu d'une tour grise par heure. Les tours
  sont réservées aux nuages qui bourgeonnent : cumulus des thermiques et nuages d'averses.
- Nuages d'averses : ceux d'heures qui se suivent ne font plus une rangée de tours mais une seule
  masse, de la base au sommet de chacun.
- Cumulus et nuages d'averses : nouvelle silhouette, à base plate, flancs bourgeonnants et sommet
  en chou-fleur.
- Nuages plus hauts que le graphique : un halo clair descend de son bord supérieur, à la place de
  la bande claire.
- Nuages en couches : entre deux niveaux du modèle, le voile s'arrête là où l'air s'assèche, au lieu
  de s'estomper jusqu'à mi-chemin. Sous une inversion, le sommet d'une mer de nuages est ainsi placé
  plus bas, plus près du niveau saturé. Les couches de pluie et de nuages bas suivent la même règle.
- Modèle qui ne fournit pas la nébulosité par niveau : elle est estimée d'après l'humidité, au lieu
  d'un ciel vide. L'infobulle le signale.
- Le jour sélectionné n'est plus mémorisé d'une ouverture de Windy à l'autre : c'est l'heure de la
  carte qui décide du jour affiché.
- Cumulus des thermiques : leur largeur dit leur quantité. Étroits quand le modèle prévoit peu de
  nuages dans leur couche, ils s'élargissent jusqu'à occuper la colonne quand ils s'étalent.
- Cumulus des thermiques : le sommet d'un petit cumulus, dont la base est proche du sol, est plus
  bas qu'avant. Un petit nuage se mélange plus vite à l'air sec qui l'entoure qu'une tour.
- Part du ciel qui cache le soleil : les étages de nuages se comptent depuis le sol, et non plus à
  altitude fixe. Sur un site d'altitude, un nuage à 1 000 ou 1 500 m au-dessus du sol compte comme
  un nuage bas, qui cache tout le soleil, au lieu d'un nuage moyen. Les thermiques y sont plus
  faibles sous ces nuages. Sous 500 m d'altitude, rien ne change.
- CAPE : les paliers de couleur passent à 200, 650 et 1 600 J/kg, au lieu de 300, 1 000 et 2 500.
  La CAPE affichée s'arrête au dernier niveau fourni par le modèle (souvent 400 hPa) et vaut environ
  les deux tiers d'une CAPE complète : les anciens paliers la laissaient au vert trop longtemps.
- Émagramme : près du sol, l'air surchauffé est dessiné dans les 100 premiers mètres, puis la courbe
  d'état suit l'adiabatique sèche jusqu'au premier niveau du modèle. Elle ne montre plus une
  instabilité absolue sur les 300 à 500 m qui séparent le sol de ce niveau. Les valeurs calculées
  (plafond, sommet des thermiques, CAPE) ne changent pas.
- Émagramme : l'infobulle ne déborde plus du cadre quand elle a beaucoup de lignes.

### Corrigé

- Cumulus des thermiques : de petits cumulus ne sont plus dessinés comme une tour qui monte jusqu'en
  haut du graphique, souvent jusqu'à un voile d'altitude, quand l'air est à peine instable. Leur
  sommet tient maintenant compte de l'air que le nuage brasse en montant : un air sec l'arrête vite,
  un air humide et instable le laisse monter. Graphique, infobulle et émagramme donnent ce
  sommet. Le risque d'orage se juge toujours sur la hauteur que le nuage peut atteindre sans se
  diluer.
- Graphique : le trait de l'heure actuelle n'est tracé que le jour même. Avec « 24 h », il
  apparaissait peu avant minuit au bord gauche du graphique du lendemain.
- Émagramme : la lecture automatique s'arrête quand on change de jour ou de lieu. Après le choix
  d'un jour antérieur, elle continuait et restait bloquée en fin de journée.
- Mise à jour : « Lien copié » ne s'affiche que si le lien a bien été copié.

### Supprimé

- Onglet « Bulletin » : le bulletin météo rédigé de la journée n'existe plus. Les passages de front
  restent dessinés sur le graphique « Vent & thermiques », et l'alerte d'orage du jour reste
  au-dessus des onglets.
- Onglet « Cross » : la carte des meilleurs départs de cross est retirée pour le moment. Les
  données qu'elle gardait dans le navigateur sont effacées à l'ouverture du plugin.

## [1.6.2] - 2026-10-01

### Modifié

- Émagramme : les valeurs de l'heure (plafond, sommet thermique, vario, 0 °C, cumulus,
  températures au sol, CAPE, LI, risque d'orage) sont maintenant sous le graphique, qui suit
  directement le curseur de l'heure. Sur téléphone, elles tiennent sur cinq lignes au lieu de
  huit, deux valeurs par ligne.

## [1.6.1] - 2026-10-01

### Corrigé

- Onglets sur téléphone : les noms (Vent, Émagramme, Cross, Bulletin) s'affichent en entier, sous
  leur pictogramme. Sur un écran étroit ils étaient coupés (« Émagra… », « Bul… »).

## [1.6.0] - 2026-10-01

Le bulletin ne classe plus les conditions : il décrit le temps prévu, dans un seul texte. Les
valeurs qu'il cite (nuages, pluie, fronts, vent, thermiques, températures) ne changent pas, ni
celles des autres onglets ; le secteur du vent y est maintenant donné en toutes lettres, sur huit
directions (« sud-ouest »).

### Modifié

- Bulletin : c'est maintenant un bulletin météo rédigé d'un seul tenant, tourné vers le vol libre.
  Le texte décrit le ciel et les précipitations de la journée, les fronts et l'orage éventuels, le
  vent au sol et à deux altitudes avec ses rafales, puis les thermiques (heures, montée au vario,
  plafond), les cumulus, les températures et l'isotherme 0 °C. L'onglet ne montre plus que ce
  texte.
- Légende du bulletin : elle explique comment le ciel, les précipitations, le vent, les thermiques
  et les fronts sont décrits, et rappelle les limites du modèle.

### Supprimé

- Bulletin : le niveau des conditions (calmes, modérées, fortes, défavorables), le bandeau de
  couleur heure par heure, les créneaux et l'appréciation de la journée. Le bulletin n'évalue plus
  les conditions de vol.
- Bulletin : le cadre de résumé, les rubriques et l'aperçu des jours suivants. Le bulletin d'un
  autre jour s'ouvre par son onglet, en haut du panneau.

## [1.5.0] - 2026-10-01

Les plafonds et les ascendances affichés ne changent pas. Les nuages dessinés, eux, peuvent
changer : une heure de pluie peut passer d'averse à pluie de front (ou l'inverse) selon les heures
qui l'entourent, et les cumulus ne sont plus montrés aux heures sans thermique exploitable.

### Ajouté

- Graphique « Vent & thermiques » : la pluie des nuages en couches (pluie de front) est dessinée.
  À chaque heure de pluie sans nuage d'averses, une tour grise montre la couche de nuages d'où elle
  tombe, de sa base à son sommet, avec son rideau de pluie ; l'infobulle donne ses altitudes
  (« Nuages de la pluie »). Avant, la barre de pluie n'avait aucun nuage au-dessus d'elle.

### Modifié

- Graphique « Vent & thermiques » : les nuages en couches sont un voile gris uni, sans stries. Avec
  les variations de nébulosité d'une heure à l'autre, les stries dessinaient un quadrillage sur le
  fond. Les tours de cumulus s'en détachent toujours par leur contour sombre.
- Sous un nuage d'averses, la pluie est un rideau de trois rangées de traits qui s'estompent vers le
  bas, plus lisible derrière les flèches de vent.
- La nature de la pluie (averses ou pluie de front) se décide sur cinq heures, l'heure et les deux
  de chaque côté, et plus heure par heure. Une énergie qui passe le seuil d'un rien pendant une
  heure ne dessine plus un nuage d'averses isolé au milieu d'une pluie continue, et une heure à
  peine sous le seuil parmi des averses garde son nuage. Le bulletin (nature des épisodes de pluie,
  fronts) suit la même règle.

### Corrigé

- Les cumulus des thermiques ne sont plus affichés aux heures sans thermique exploitable
  (graphique, infobulle, bulletin). Sous un ciel couvert et pluvieux, une grande tour blanche
  pouvait monter jusqu'en haut du graphique alors que l'onglet du jour annonçait « Pas de
  thermique ». L'émagramme montre toujours l'ascension de la particule.

## [1.4.1] - 2026-10-01

Les créneaux du bulletin sont plus stricts qu'en 1.4.0 : ils peuvent être plus courts, ou
disparaître, et l'appréciation de la journée peut changer avec eux. Les autres valeurs affichées
ne changent pas.

### Corrigé

- Bulletin : les créneaux correspondent maintenant aux cases de couleur du bandeau des heures. Un
  créneau « conditions calmes » ne couvre plus une heure affichée en conditions modérées (ni un
  créneau « calmes à modérées » une heure de conditions fortes) : une seule heure d'un niveau
  au-dessus le coupe. L'appréciation de la journée, qui compte ces créneaux, peut changer.
- Bulletin : les heures sous le bandeau sont placées au début de leur case, plus au milieu. Un
  créneau « de 8h à 13h » se lit tel quel sur le bandeau.
- Bulletin : « calmes à modérées » est précédé des deux couleurs que le créneau réunit, et « aucun
  créneau d'au moins 2 h » remplace « aucun créneau » quand des heures isolées ont ce niveau.

## [1.4.0] - 2026-10-01

Les plafonds et les ascendances affichés ne changent pas. Le risque d'orage, lui, peut être plus
élevé qu'en 1.3.0 le soir et la nuit : les orages du modèle sont maintenant jugés sur l'air le plus
instable, et un orage probable passe en « orage violent possible » quand l'air s'y prête.

### Ajouté

- Onglet « Bulletin » : le bulletin de vol de la journée, rédigé à partir de la prévision du modèle
  choisi. Il donne une appréciation de la journée, la force des conditions de chaque heure de jour
  (calmes, modérées, fortes, défavorables), les créneaux qui en découlent et celui des thermiques
  exploitables, le vent au sol et en altitude, les thermiques, puis un aperçu des jours suivants,
  cliquables. Il décrit des conditions, pas l'aptitude d'un pilote à voler ; la légende de l'onglet
  détaille les critères.
- Bulletin : ciel et précipitations. État du ciel le matin et l'après-midi avec les étages de nuages
  et l'altitude des plus bas, brume ou brouillard possible en début de matinée, cumulus des
  thermiques (heures, base, sommets, épaisseur), précipitations épisode par épisode (nature,
  intensité, cumul, heure la plus arrosée), limite pluie-neige, sol mouillé au lever du jour,
  températures au sol et isotherme 0 °C.
- Bulletin : passages de front. Un front froid ou chaud est signalé avec son heure, le
  refroidissement ou le réchauffement en altitude, la rotation du vent, la pluie et les rafales qui
  l'accompagnent ; un front passé la veille ou attendu la nuit suivante est mentionné aussi.

- Niveau « orage violent possible » (pictogramme violet à deux éclairs) : un orage probable dans
  un air très instable (LI ≤ −6), ou instable avec un vent fort en altitude qui organise l'orage
  (√(2 · CAPE) × cisaillement sol–6 km), ou avec des rafales d'au moins 70 km/h au modèle.
- Bandeau d'alerte au-dessus des onglets les jours d'orage : heure d'arrivée, cause, vitesse et
  direction de déplacement, rafales prévues, et s'il arrive sans signe avant-coureur ou sous un
  ciel déjà couvert. Il signale aussi un simple surdéveloppement quand l'air est propice aux orages
  violents.
- Graphique « Vent & thermiques » : bandeau « CAPE LI » sous la pluie. Chaque heure a sa case, la
  CAPE à gauche et le LI à droite, chacun sur la couleur de son palier (vert, jaune, orange,
  rouge) : la montée de l'instabilité dans la journée se lit d'un coup d'œil, sans survoler les
  colonnes.
- Émagramme : pastille de couleur du palier de la CAPE et du LI (aussi dans l'infobulle du
  graphique), CAPE de l'air le plus instable (« max ») quand elle dépasse nettement la CAPE
  standard, et orage attendu dans les 3 heures qui suivent l'heure affichée.
- Émagramme : l'infobulle donne la montée au vario estimée à l'altitude pointée, avec sa couleur,
  comme sur le graphique « Vent & thermiques ».
- Émagramme : option « Ascension de la particule », en bas de page. Elle trace le trajet du
  thermique du sol jusqu'où il s'arrête (sommet des thermiques, ou du cumulus) et son point de
  rosée en tirets bleus, qui le rejoint au niveau de condensation, marqué d'un point même quand le
  thermique s'arrête avant. Au-dessus de ce niveau, le trajet passe du jaune (adiabatique sèche)
  au jaune et bleu (adiabatique saturée). Les zones où le thermique est plus chaud que l'air sont
  teintées. Le choix est mémorisé.

### Modifié

- Émagramme : la zone de formation du nuage est dessinée. Entre la base et le sommet du cumulus
  des thermiques, une couche claire à base plate et à sommet bourgeonnant remplace le voile à peine
  visible ; elle est expliquée dans la légende.

- Les orages que le modèle développe lui-même sont jugés sur l'air le plus instable des 300 hPa les
  plus bas, et plus seulement sur l'air près du sol : un orage qui arrive le soir ou la nuit sur un
  air stabilisé au sol n'est plus manqué.
- Infobulle du graphique « Vent & thermiques » rangée par thème (vent, thermiques, température,
  nuages et précipitations, orage) : dans chaque groupe, la valeur à l'altitude pointée précède
  celles de la colonne, par exemple le vario à cette altitude puis le vario max.
- Altitude max : choix de 7 000 et 8 000 m en plus. Au-dessus du dernier niveau fourni par le
  modèle (vers 7 500 m), le graphique et l'émagramme sont hachurés : le modèle n'y donne ni vent,
  ni température, ni nuages.
- Thème clair : le graphique « Vent & thermiques » garde les couleurs du thème sombre (ciel, flèches
  et chiffres du vent à contour sombre, plafond en blanc), plus lisibles que leur version claire.
  Seuls les axes et les bandeaux « Therm. » et « Pluie » prennent les couleurs du thème clair.

### Supprimé

- Vent moyen de la couche thermique, dans l'infobulle du graphique et au-dessus de l'émagramme.
  Les thermiques hachés par le vent restent signalés dans le bandeau « Therm. », dans l'infobulle
  et, au-dessus de l'émagramme, à côté du vario.
- Graphique « Vent & thermiques » : l'heure affichée dans l'émagramme n'y est plus encadrée en
  jaune. Toucher ou cliquer une heure la choisit toujours pour l'émagramme.

## [1.3.0] - 2026-10-01

Les calculs des thermiques ont été revus : à conditions égales, les plafonds affichés sont
nettement plus bas qu'en 1.2.7 (de 300 à 450 m par beau temps sur les prévisions de test), et les
valeurs d'ascendance sont désormais des montées au vario.

### Ajouté

- Bandeau « Therm. » sous le graphique : la facilité d'exploitation des thermiques heure par heure
  (faciles, faibles ou plafond bas, hachés, très hachés), reprise dans l'infobulle.
- Risque d'orage : pictogrammes « surdéveloppement possible » et « orage probable » sur le
  graphique, les onglets des jours et l'émagramme, estimés à partir des cumulus des thermiques et
  des orages prévus par le modèle lui-même, à toute heure.
- CAPE et LI standard dans l'infobulle et l'émagramme, expliqués dans la légende.
- Nuages d'averses : une tour grise avec des traits de pluie aux heures de pluie convective, même
  sans thermiques (nuit, ciel couvert).
- Neige distinguée de la pluie dans les précipitations (barres et infobulle).
- Bande en haut du graphique pour les nuages situés au-dessus de l'altitude affichée ; les niveaux
  où le modèle ne donne que la nébulosité sont pris en compte.
- Émagramme : un curseur règle l'heure par pas de 5 minutes, et la prévision est recalculée pour
  la minute choisie.
- Le modèle du plugin et celui de la carte Windy restent synchronisés dans les deux sens.
- Jusqu'à 15 jours de prévision avec Windy Premium et 7 jours sans (5 auparavant).
- Tests automatiques des calculs (`npm test`) sur deux prévisions ECMWF réelles.

### Modifié

- Thermiques : la particule part de l'air mélangé des 500 premiers mètres, avec une surchauffe qui
  dépend du flux de chaleur au lieu de +1 °C fixe ; le flux tient compte du rayonnement par ciel
  clair (Haurwitz), des nuages, du sol mouillé et de la densité de l'air.
- Les ascendances affichées sont la montée lue au vario (ascendance moins le taux de chute en
  spirale), et le plafond exploitable est l'altitude où cette montée devient nulle, sans dépasser
  la base des cumulus.
- Les thermiques sont à pleine force dès le sol.
- La pluie de chaque heure est placée sous l'heure qui suit, celle où elle tombe.
- Fond du graphique bleu ciel le jour et bleu nuit la nuit ; les traits du lever et du coucher du
  soleil tombent au milieu du fondu.
- Les nuages en couches du modèle sont un voile gris strié, plus opaque quand le ciel est couvert ;
  les cumulus des thermiques sont blancs avec une base ombrée.
- Carte des meilleurs départs : grille plus fine, couleurs lisibles dès 15 km, voile gris là où
  aucun cross n'est possible, bulles de distance colorées.
- Thème clair : contour des chiffres adouci.
- Légendes raccourcies.

### Corrigé

- Au-delà de l'échéance d'un modèle (ICON-D2, AROME FR…), Windy complète avec un autre modèle :
  ces jours ne sont plus cliquables et s'affichent « Hors échéance ».
- Un plafond à moins de 100 m du sol n'est plus tracé : sa ligne recouvrait les valeurs au sol.

### Supprimé

- Liste des trois meilleurs départs et leurs trajectoires sur la carte : seul le vol du site choisi
  est tracé.

## [1.2.7] - 2026-09-30

### Corrigé

- Plus rien ne s'affichait pour les comptes sans Windy Premium depuis la 1.2.6 : les heures
  interpolées sont calées sur les heures pleines, et les séries sont rapprochées à 30 minutes près.
- La pluie de chaque tranche de 3 h est répartie sur les 3 heures qui suivent.
- Si l'interpolation échoue, les données brutes par tranches de 3 h sont affichées plutôt qu'un
  écran vide.

## [1.2.6] - 2026-09-30

### Ajouté

- Prévisions heure par heure pour les comptes sans Windy Premium : les données fournies par pas de
  3 h sont interpolées (vent par le chemin le plus court, pluie répartie), puis les thermiques sont
  recalculés pour chaque heure.

## [1.2.5] - 2026-09-30

### Ajouté

- Rafales au sol dans l'infobulle du graphique.

### Modifié

- Onglets plus compacts sur téléphone.

### Corrigé

- Quand le modèle ne donnait pas de rafale pour une heure, la vitesse du vent au sol était affichée
  à sa place.

## [1.2.4] - 2026-09-30

### Ajouté

- Le dernier modèle choisi est mémorisé, ainsi que le jour sélectionné tant qu'on est le même jour.

### Modifié

- Les graphiques gardent leur position de défilement quand on change de jour, d'heure, d'onglet ou
  de lieu.

## [1.2.3] - 2026-09-30

### Modifié

- Onglets redessinés : barre sur toute la largeur, une icône par onglet, bouton de légende à droite.

### Corrigé

- Les onglets ne bougent plus au clic.

## [1.2.2] - 2026-09-30

### Ajouté

- Trois onglets : Vent & thermiques, Émagramme, Cross.
- Durée de prévision de chaque modèle dans la liste des modèles.
- Bandeau « Nouvelle version » : le plugin vérifie à l'ouverture si une version plus récente est
  publiée et propose son lien d'installation.

## [1.2.1] - 2026-09-30

### Modifié

- Textes et commentaires reformulés ; aucun changement fonctionnel.

## [1.2.0] - 2026-09-29

Première version publique (les précédentes n'étaient installables que par lien).

### Ajouté

- Carte des meilleurs départs de cross, en distance libre ou en aller-retour, simulée sur une
  grille de la zone visible. Elle remplace la carte des ascendances moyennes.
- Version anglaise : la langue suit celle de Windy.
- Thème clair, mémorisé.
- Heures du lever et du coucher du soleil sur le graphique.

### Modifié

- Sélecteur de modèle plus sobre, à gauche du nom du lieu.
- Le graphique occupe toute la largeur du panneau.
- « Afficher 24 h » est coché par défaut.
- Pendant l'affichage de la carte des départs, Windy passe sur son fond de carte de base, sans
  couche météo ni animation du vent, puis retrouve ses réglages.
- L'émagramme utilise tous les niveaux présents dans les données.

## [1.1.6] - 2026-09-29

### Modifié

- Le plugin est renommé « PG Soundings » (`windy-plugin-pg-soundings`). Pour Windy, c'est un
  nouveau plugin : il faut le réinstaller.

## [1.1.5] - 2026-09-29

### Modifié

- Le plugin est renommé « ParaGraphs » (`windy-plugin-paragraphs`).

## [1.1.4] - 2026-09-29

### Ajouté

- Pluviométrie sous le graphique : une barre par heure, en mm.

### Modifié

- Zone des thermiques calculée à la résolution de l'écran, sans effet d'escalier.
- Gros cumulus dessinés en tours.
- Carte des ascendances moyennes plus nette, aux couleurs des ascendances du graphique.

### Supprimé

- AROME HD, pour lequel Windy ne fournit pas de données en altitude ; AROME FR le remplace.

## [1.1.3] - 2026-09-29

### Ajouté

- Carte des ascendances moyennes (montée nette au vario, de 11 h à 17 h), à la place de la carte du
  potentiel de cross.
- Modèle AROME FR.
- Les jours au-delà de l'échéance du modèle restent visibles, grisés, avec la mention
  « Hors échéance ».

### Modifié

- Échelle de couleurs des ascendances par paliers de 0,5 m/s.
- La grille de la carte est fixe et mise en cache 3 heures : un déplacement ne recharge que les
  bords.

## [1.1.2] - 2026-09-29

### Modifié

- La carte du potentiel suit le zoom et se recalcule seule ; elle accepte une zone deux fois plus
  grande.
- Calcul du potentiel revu sur de vraies prévisions : les voiles de cirrus pénalisent peu, la base
  des cumulus est calculée avec l'humidité moyenne de la couche brassée, aucun thermique sur la
  mer, seule la hauteur exploitable compte.
- Graphiques plus larges : titre de l'axe des altitudes retiré, marges de l'émagramme réduites.
- Sur téléphone, l'émagramme défile horizontalement.

### Corrigé

- Faux message « zone trop grande » sur les grands écrans.

## [1.1.1] - 2026-09-28

### Modifié

- Nouveau sélecteur de modèle, avec la résolution et la couverture de chaque modèle.
- Carte du potentiel plus lisible : paliers de couleur distincts et distances écrites sur la carte.
- Bas du panneau : altitude du site, altitude du sol dans le modèle, heure de calcul de la
  prévision.
- Transitions de couleur des ascendances lissées entre deux heures.

## [1.1.0] - 2026-09-28

### Ajouté

- Carte du potentiel de cross de la journée, calculée sur une grille de la zone visible.

### Modifié

- Sur téléphone, le graphique affiche une colonne par heure et défile horizontalement, avec l'axe
  des altitudes fixe ; l'émagramme est moins écrasé.
- Mise en page du panneau : choix du modèle sous le nom du lieu, réglages en bas de page.

## [1.0.0] - 2026-09-28

Première publication, sous le nom « Parapente » (`windy-plugin-parapente`).

### Ajouté

- Graphique altitude × heure : vent par tranche d'altitude, zone des thermiques, plafond, base des
  cumulus, nuages du modèle, isotherme 0 °C et relief.
- Émagramme redressé de l'heure choisie : courbe d'état colorée selon la stabilité, point de rosée,
  chemin de la particule, vent par altitude.
- Onglets par jour, choix du modèle (ECMWF, ICON, GFS, ICON-EU, ICON-D2, AROME, UKV), altitude
  maximale, heures de jour ou vue 24 h.
- Infobulles au survol et légendes à la demande.
- Affichage adapté aux téléphones.
