# Changelog

Toutes les versions publiées de PG Soundings, de la plus récente à la plus ancienne.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros de version
[SemVer](https://semver.org/lang/fr/).

Le dépôt git ne commence qu'après la 1.2.7 : les entrées plus anciennes ont été reconstituées après
coup à partir des notes de publication. Chaque version reste installable depuis Windy à l'adresse
`https://windy-plugins.com/2727410/<nom-du-plugin>/<version>/plugin.min.js`.

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
