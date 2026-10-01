# PG Soundings 🪂

Plugin Windy.com qui affiche, pour un site de vol, un graphique **altitude × heure** pour le vol libre :

- **Vent en altitude** : une flèche par tranche d'altitude et par heure (elle pointe dans le sens où va le vent), colorée selon la vitesse, avec la vitesse en km/h
- **Thermiques** : zone colorée selon la **montée lue au vario** (ascendance au cœur des thermiques moins le taux de chute en spirale, m/s)
- **Facilité d'exploitation des thermiques** : bandeau « Therm. » sous le graphique, une case par heure,
  du vert (faciles) au rouge, hachurée quand le vent les hache
- **Plafond exploitable** (ligne blanche) et **cumulus des thermiques** (tours blanches, de la base au sommet)
- **Nuages d'averses** (tours grises avec des traits de pluie) aux heures de pluie convective, même
  sans thermiques (nuit, ciel couvert)
- **Nuages en couches du modèle** par niveau (voile gris strié), **isotherme 0 °C** (tirets bleus), relief du modèle
- Infobulle au survol : vent, température, vario et nuages à l'altitude pointée, puis plafond,
  facilité d'exploitation des thermiques, cumulus, vario max, vent de la couche thermique,
  vent et rafales au sol, T° au sol, isotherme 0 °C, CAPE / LI, pluie
- Onglets par jour, choix du modèle (ECMWF, ICON, GFS, ICON-EU, ICON-D2, AROME FR, UKV), altitude max, vue 24 h
- Pluviométrie en bas du graphique principal (barres bleues, en mm) : sous chaque heure, la pluie de
  l'heure qui suit
- Survolez une colonne pour voir le détail de l'heure, cliquez dessus pour afficher son **émagramme**
- **Émagramme redressé** : altitude en mètres, adiabatiques sèches verticales
  et isothermes obliques, courbe d'état colorée selon la stabilité (rouge : instabilité absolue,
  vert : conditionnelle, clair : stable), point de rosée, chemin de la particule, adiabatiques
  saturées et rapport de mélange en fond, base et sommet des cumulus, et à droite le vent
  (flèches dimensionnées par la force) avec la couche convective en jaune
- **Carte des meilleurs départs de cross** (distance libre ou aller-retour), simulée sur une grille
  de la zone visible
- Légendes accessibles par le bouton **ⓘ Légende** de chaque graphique

L'interface est en français ou en anglais, selon la langue de Windy.

## Installer le plugin

Sur <https://www.windy.com/plugins>, choisissez « Load plugin directly from URL » et collez :

```
https://windy-plugins.com/2727410/windy-plugin-pg-soundings/1.3.0/plugin.min.js
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
- affiche une **CAPE et un LI standard** (air mélangé des 100 hPa les plus bas, sans surchauffe)
- estime le **risque d'orage** par deux voies : les cumulus des thermiques (épaisseur, sommet plus froid
  que −20 °C, CAPE standard ≥ 300 J/kg, confirmés par les nuages du modèle), et les orages du modèle
  lui-même à toute heure (CAPE standard, sommet froid, nuages épais et pluie)
- dessine un **nuage d'averses** quand la pluie de l'heure est convective : précipitations convectives
  du modèle, ou CAPE standard ≥ 50 J/kg sur un nuage d'au moins 2 000 m d'épaisseur (seuils calés sur
  les précipitations convectives de GFS et d'ICON-EU) ; sinon la pluie vient des nuages en couches
- simule les **cross** avec la théorie de MacCready (35 km/h et 1,4 m/s en transition), la dérive du
  vent de la couche, et une dernière transition depuis la hauteur exploitable

Ce sont des **ordres de grandeur**, pas des mesures. Ils ne remplacent ni un vrai modèle
aérologique ni l'observation sur le terrain.

Le code est dans `src/` : `plugin.svelte` (interface, chargement), `Chart.svelte` (graphique),
`Emagram.svelte`, `physics.ts` (calculs et couleurs), `interpolate.ts` (pas horaire), `time.ts`
(heure locale), `cross.ts` et `XcLayer.svelte` (carte des cross), `xc.ts` (grille de la carte).
