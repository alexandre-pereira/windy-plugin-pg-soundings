# PG Soundings 🪂

Plugin Windy.com qui affiche, pour un site de vol, un graphique **altitude × heure** pour le vol libre :

- **Vent en altitude** : une flèche par tranche d'altitude et par heure (elle pointe dans le sens où va le vent), colorée selon la vitesse, avec la vitesse en km/h
- **Thermiques** : zone colorée selon la **montée lue au vario** (ascendance au cœur des thermiques moins le taux de chute en spirale, m/s)
- **Facilité d'exploitation des thermiques** : bandeau « Therm. » sous le graphique, une case par heure,
  du vert (faciles) au rouge, hachurée quand le vent les hache
- **Plafond exploitable** (ligne blanche) et **cumulus des thermiques** (tours blanches, de la base au
  sommet, aux heures de thermiques exploitables)
- **Nuages de pluie** (tours grises, de la base au sommet, avec un rideau de pluie dessous) à chaque
  heure de pluie : nuage d'averses quand la pluie est faite d'averses, même sans thermiques (nuit,
  ciel couvert), sinon couche de nuages du modèle d'où elle tombe (pluie de front)
- **Risque d'orage** heure par heure (surdéveloppement possible, orage probable, orage violent
  possible) et **bandeau d'alerte** les jours d'orage : heure d'arrivée, vitesse de déplacement, rafales
- **Nuages en couches du modèle** par niveau (voile gris), **isotherme 0 °C** (tirets bleus), relief du modèle
- **CAPE et LI heure par heure** : bandeau « CAPE LI » sous la pluie, une case par heure, la CAPE à
  gauche et le LI à droite, chacun sur la couleur de son palier, du vert (stable) au rouge (très
  instable)
- Infobulle au survol : vent, température, vario et nuages à l'altitude pointée, puis plafond,
  facilité d'exploitation des thermiques, cumulus, vario max, vent et rafales au sol, T° au sol,
  isotherme 0 °C, CAPE / LI, pluie
- Onglets par jour, choix du modèle (ECMWF, ICON, GFS, ICON-EU, ICON-D2, AROME FR, UKV), altitude max, vue 24 h
- Pluviométrie en bas du graphique principal (barres bleues, en mm) : sous chaque heure, la pluie de
  l'heure qui suit
- Survolez une colonne pour voir le détail de l'heure, cliquez dessus pour afficher son **émagramme**
- **Émagramme redressé** : altitude en mètres, adiabatiques sèches verticales
  et isothermes obliques, courbe d'état colorée selon la stabilité (rouge : instabilité absolue,
  vert : conditionnelle, clair : stable), point de rosée, chemin de la particule, adiabatiques
  saturées et rapport de mélange en fond, zone de formation du nuage (couche claire à sommet
  bourgeonnant, de la base au sommet des cumulus), et à droite le vent
  (flèches dimensionnées par la force) avec la couche convective en jaune ; au survol, température,
  point de rosée, gradient, particule, vario et vent à l'altitude pointée
- En option, l'**ascension de la particule** sur l'émagramme : son trajet du sol jusqu'où le
  thermique s'arrête (sommet des thermiques, ou du cumulus), son point de rosée en tirets bleus,
  qui la rejoint au niveau de condensation (point étiqueté, atteint ou non), le passage de
  l'adiabatique sèche (jaune) à la saturée (jaune et bleu) à ce niveau, et les zones où elle est
  plus chaude que l'air
- **Carte des meilleurs départs de cross** (distance libre ou aller-retour), simulée sur une grille
  de la zone visible
- **Bulletin météo** de la journée : un seul texte, rédigé à partir de la prévision du modèle et
  tourné vers le vol libre. Ciel (étages de nuages, brume) et précipitations épisode par épisode,
  passages de front et orage, vent au sol et en altitude, thermiques (heures, montée au vario,
  plafond), cumulus, températures et isotherme 0 °C. Il décrit le temps prévu, sans évaluer les
  conditions de vol
- Légendes accessibles par le bouton **ⓘ Légende** de chaque onglet

L'interface est en français ou en anglais, selon la langue de Windy.

## Installer le plugin

Sur <https://www.windy.com/plugins>, choisissez « Load plugin directly from URL » et collez :

```
https://windy-plugins.com/2727410/windy-plugin-pg-soundings/1.6.0/plugin.min.js
```

Le plugin signale ensuite lui-même les nouvelles versions. L'historique est dans
[CHANGELOG.md](CHANGELOG.md).

## Lancer le plugin en local

1. Installez [Node.js LTS](https://nodejs.org/) (par exemple `winget install OpenJS.NodeJS.LTS`)
2. Dans ce dossier : `npm install` puis `npm start` (compile et sert le plugin sur `https://localhost:9999`)
3. Ouvrez <https://localhost:9999/plugin.js> une première fois et acceptez le certificat auto-signé
4. Allez sur <https://www.windy.com/developer-mode> et chargez le plugin depuis `https://localhost:9999/plugin.js`
5. Ouvrez le plugin depuis le menu (ou par clic droit sur la carte), puis cliquez sur la carte pour changer de site

`npm run build` produit la version finale dans `dist/`. `npm test` lance les tests des calculs
(`tests/`, avec deux prévisions ECMWF réelles enregistrées dans `tests/fixtures/`).

## Comment sont calculées les estimations

Windy fournit le vent, la température, l'humidité, les nuages et l'altitude géopotentielle des niveaux
de pression (souvent 7 niveaux seulement pour ECMWF : rien entre 850 et 700 hPa, soit ~1 600 m). Le plugin :

- passe les séries au pas horaire si Windy ne donne qu'un pas de 3 h, et suit l'heure locale
  (changement d'heure compris) ; les cumuls de pluie de Windy valent pour la période qui précède
  chaque pas : ils sont recalés sur l'heure qui suit, pour que la pluie tombe sous le nuage qui la donne
- interpole le profil (courbe monotone de Steffen) et le vent (composantes u/v) entre le vent à 10 m
  et les niveaux de pression
- estime le **sommet des thermiques** par la méthode de la particule : air mélangé des 500 premiers
  mètres, réchauffé d'une surchauffe qui dépend du flux de chaleur, élevé selon l'adiabatique sèche
  jusqu'à ne plus être plus léger (en température virtuelle) que l'air ambiant
- estime la **base des cumulus** par le niveau de condensation de cette particule (Bolton), puis leur
  sommet par la pseudo-adiabatique
- estime **w\*** (vitesse convective de Deardorff) à partir de l'épaisseur de la couche brassée
  (jusqu'à la base des cumulus s'il y en a) et du flux de chaleur au sol : rayonnement par ciel clair
  (Haurwitz), atténué par les nuages (Kasten & Czeplak), réduit sur sol mouillé, divisé par ρ·cp au sol
- donne la **montée au vario** = 1,25 · w\* · profil vertical − 1,1 m/s (taux de chute en spirale) ; le
  profil est à pleine force dès le sol (en relief, les pentes déclenchent à toutes les altitudes)
  puis s'annule au sommet ; le **plafond
  exploitable** est l'altitude où cette montée devient nulle (jamais au-dessus de la base des cumulus)
- signale les **thermiques hachés** : vent moyen de la couche thermique au-delà de 25 km/h, ou
  rapport w\* / u\* sous 2,3 (turbulence mécanique, u\* tiré du vent à 10 m) ; très hachés au-delà
  de 40 km/h ou sous 1,5
- classe la **facilité d'exploitation** de chaque heure : très hachés, hachés, sinon faibles (moins
  de +0,5 m/s au vario) ou plafond bas (moins de 300 m au-dessus du sol), sinon faciles
- affiche une **CAPE et un LI standard** (air mélangé des 100 hPa les plus bas, sans surchauffe), et
  calcule ceux de l'**air le plus instable** des 300 hPa les plus bas, qui nourrit un orage venu
  d'ailleurs même quand l'air près du sol est stable
- estime le **risque d'orage** par deux voies : les cumulus des thermiques (épaisseur, sommet plus froid
  que −20 °C, CAPE standard ≥ 300 J/kg, confirmés par les nuages du modèle), et les orages du modèle
  lui-même à toute heure (CAPE de l'air le plus instable, sommet froid, nuages épais et pluie)
- classe un orage probable en **orage violent possible** quand l'air s'y prête : LI ≤ −6, ou
  √(2 · CAPE) × cisaillement sol–6 km ≥ 500 m²/s² avec un LI ≤ −2 (la CAPE s'arrête au dernier niveau
  fourni, 400 hPa : ~620 m²/s² sur un profil complet), ou rafales du modèle ≥ 70 km/h ; seuils calés
  sur GFS et ICON-EU (30 sites d'Europe)
- résume l'**orage du jour** dans un bandeau (8 h – 22 h, heures à venir) : première heure, cause,
  déplacement (vent moyen du sol à 6 km), rafales du modèle, absence de signe l'heure d'avant
- dessine un **nuage d'averses** quand la pluie est faite d'averses. Une heure, prise seule, est
  convective si le modèle annonce des précipitations convectives, ou si la CAPE standard atteint
  50 J/kg sur un nuage d'au moins 2 000 m d'épaisseur (seuils calés sur les précipitations
  convectives de GFS et d'ICON-EU). La nature de la pluie se décide ensuite sur cinq heures, l'heure
  et les deux de chaque côté : averses si au moins la moitié de la pluie y tombe à des heures
  convectives. Une heure convective minoritaire autour d'elle est d'abord écartée, puis celles qui
  restent entraînent leurs voisines : une énergie qui passe le seuil d'un rien ne donne plus une
  averse isolée au milieu d'une pluie de front
- sinon la pluie vient des **nuages en couches**, dessinés eux aussi de la base au sommet : la plus
  basse couche continue où la nébulosité du modèle atteint 50 % (ou la moitié de sa plus forte
  valeur si elle reste en dessous)
- ne montre les **cumulus des thermiques** (graphique, infobulle, bulletin) qu'aux heures de
  thermiques exploitables : dans un air saturé, sous un ciel couvert, la particule condense encore
  et son « nuage » peut faire plusieurs kilomètres d'épaisseur sans qu'aucun thermique le nourrisse.
  L'émagramme, lui, montre toujours l'ascension de la particule
- simule les **cross** avec la théorie de MacCready (35 km/h et 1,4 m/s en transition), la dérive du
  vent de la couche, et une dernière transition depuis la hauteur exploitable
- repère un **passage de front** au changement de masse d'air qu'il apporte : la température moyenne
  entre 1 500 et 3 000 m au-dessus du sol (à l'écart du cycle jour / nuit) varie sur 6 heures. Front
  froid : −3 °C avec au moins 1 mm de pluie, ou avec un vent qui tourne d'au moins 40° sous un ciel
  couvert, ou −3,5 °C sous un ciel très nuageux (front sec) ; −2,5 °C suffisent avec la pluie et une
  rotation de 30°. Front chaud : +3 °C sous un ciel couvert, avec au moins 1 mm de pluie de nuages en
  couches. Seuils calés sur GFS et ICON (16 sites d'Europe, trois semaines) ; le bulletin ne voit que
  le point choisi, pas la carte : un front peu actif, ou qui passe à côté, peut lui échapper
- décrit le **ciel** du bulletin par demi-journée : couverture totale, étages où le modèle met au
  moins 40 % de nuages (bas sous 700 hPa, moyens jusqu'à 450 hPa, élevés au-dessus) et altitude du
  niveau couvert le plus bas ; brume ou brouillard possible quand l'air du début de matinée est
  saturé au sol (écart T − Td ≤ 0,5 °C), sans pluie, avec moins de 11 km/h de vent
- découpe les **précipitations** en épisodes (une heure sèche isolée ne les sépare pas), qualifiés
  par leur heure la plus arrosée (faible sous 1 mm/h, modérée sous 4 mm/h, forte au-delà) ; la limite
  pluie-neige est placée 300 m sous l'isotherme 0 °C des heures de pluie, et le sol est dit mouillé
  au lever du jour à partir de 2 mm tombés dans les 24 heures précédentes
- résume le **vent** du bulletin par demi-journée (heures de jour, avant puis à partir de 13 h) :
  direction du vecteur moyen et vitesse moyenne, à 10 m du sol et à deux altitudes rondes au-dessus
  du site (le premier multiple de 500 m à 700 m au moins du sol, puis 1 000 m plus haut), avec le
  secteur sur huit directions ; sous 10 km/h le vent est dit faible, et la plus forte rafale du
  modèle est citée à partir de 20 km/h
- résume les **thermiques** du bulletin sur les heures de jour où le modèle donne un plafond
  exploitable : première et dernière heure, meilleure montée au vario et son heure, plafond le plus
  haut

Ce sont des **ordres de grandeur**, pas des mesures. Ils ne remplacent ni un vrai modèle
aérologique ni l'observation sur le terrain.

Le code est dans `src/` : `plugin.svelte` (interface, chargement), `Chart.svelte` (graphique),
`Emagram.svelte`, `physics.ts` (calculs et couleurs), `interpolate.ts` (pas horaire), `time.ts`
(heure locale), `cross.ts` et `XcLayer.svelte` (carte des cross), `xc.ts` (grille de la carte),
`bulletin.ts` et `Bulletin.svelte` (bulletin : faits de la journée, puis phrases).
