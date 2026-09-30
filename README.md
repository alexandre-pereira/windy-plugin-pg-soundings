# PG Soundings 🪂

Plugin Windy.com qui affiche, pour un site de vol, un graphique **altitude × heure** pour le vol libre :

- **Vent en altitude** : une flèche par tranche d'altitude et par heure (elle pointe dans le sens où va le vent), colorée selon la vitesse, avec la vitesse en km/h
- **Thermiques** : zone colorée du sol au sommet des thermiques, selon l'ascendance estimée (m/s)
- **Plafond exploitable** (ligne blanche) et **base des cumulus** (barres blanches)
- **Nuages du modèle** par niveau (voile blanc), **isotherme 0 °C** (tirets bleus), relief du modèle
- Infobulle au survol : vent, température, ascendance et nuages à l'altitude pointée, puis plafond, cumulus, ascendance max, vent et rafales au sol, T° au sol, isotherme 0 °C, pluie
- Onglets par jour, choix du modèle (ECMWF, ICON, GFS, ICON-EU, ICON-D2, AROME FR, UKV), altitude max, vue 24 h
- Pluviométrie de chaque heure en bas du graphique principal (barres bleues, en mm)
- Survolez une colonne pour voir le détail de l'heure, cliquez dessus pour afficher son **émagramme**
- **Émagramme redressé** : altitude en mètres, adiabatiques sèches verticales
  et isothermes obliques, courbe d'état colorée selon la stabilité (rouge : instabilité absolue,
  vert : conditionnelle, clair : stable), point de rosée, chemin de la particule, adiabatiques
  saturées et rapport de mélange en fond, base et sommet des cumulus, et à droite le vent
  (flèches dimensionnées par la force) avec la couche convective en jaune
- Légendes accessibles par le bouton **ⓘ Légende** de chaque graphique
- **Ascendances moyennes (Vz)** : montée nette estimée au vario, moyennée de 11 h à 17 h, pour le
  site choisi, et **carte des Vz** : calcul sur une grille de 150 à 250 points de la zone visible,
  affiché en couche colorée sur la carte Windy et recalculé automatiquement quand on zoome

## Lancer le plugin en local

1. Installez [Node.js LTS](https://nodejs.org/) (par exemple `winget install OpenJS.NodeJS.LTS`)
2. Dans ce dossier : `npm install` puis `npm start` (compile et sert le plugin sur `https://localhost:9999`)
3. Ouvrez <https://localhost:9999/plugin.js> une première fois et acceptez le certificat auto-signé
4. Allez sur <https://www.windy.com/developer-mode> et chargez le plugin depuis `https://localhost:9999/plugin.js`
5. Ouvrez le plugin depuis le menu (ou par clic droit sur la carte), puis cliquez sur la carte pour changer de site

`npm run build` produit la version finale dans `dist/`.

## Comment sont calculées les estimations

Windy fournit le vent, la température, l'humidité, les nuages et l'altitude géopotentielle des niveaux
de pression (1000 à 150 hPa). Le plugin :

- interpole le vent (composantes u/v) entre le vent à 10 m et les niveaux de pression
- estime le **sommet des thermiques** par la méthode de la particule : T° à 2 m + 1 °C, élevée
  selon l'adiabatique sèche (9,8 °C/km) jusqu'à ce qu'elle devienne plus froide que l'air ambiant
- estime la **base des cumulus** par le niveau de condensation (125 m par °C d'écart T − Td au sol) ;
  s'il est sous le sommet des thermiques, il y a des cumulus et il devient le plafond exploitable
- estime **w\*** (vitesse convective de Deardorff) à partir de l'épaisseur de la couche convective et
  d'un flux de chaleur calculé avec la hauteur du soleil et la couverture nuageuse

Ce sont des **ordres de grandeur**, pas des mesures. Ils ne remplacent ni un vrai modèle
aérologique (RASP…) ni l'observation sur le terrain.

Le code est dans `src/` : `plugin.svelte` (interface, chargement), `Chart.svelte` (graphique SVG),
`physics.ts` (calculs et couleurs).
