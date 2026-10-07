# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PG Soundings

Plugin Windy.com pour le vol libre (`windy-plugin-pg-soundings`) : graphique altitude × heure du
vent et des thermiques, émagramme redressé, risque d'orage, passages de front. Svelte + TypeScript,
compilé par Rollup. Ce que le plugin affiche et la façon dont chaque
estimation est calculée sont décrits dans [README.md](README.md).

## Commandes

- `npm start` : compile et sert le plugin sur `https://localhost:9999` (à charger depuis
  <https://www.windy.com/developer-mode>)
- `npm run build` : version finale dans `dist/`
- `npm test` : tests des calculs (vitest), sur deux prévisions ECMWF réelles de `tests/fixtures/`
- Un seul fichier ou un seul test : `npx vitest run tests/fronts.test.ts`, ou
  `npx vitest run tests/physics.test.ts -t "isotherme 0 °C"` (nom d'un `describe` ou d'un `it`)
- Il n'y a pas de commande de lint ni de vérification des types : la compilation (swc) ne vérifie
  pas les types, seuls les tests et l'essai dans Windy disent si un changement tient
- `npm run publish:windy` : compile et publie sur Windy (voir « Publier une version »)
- `npm run site` : fabrique la page de présentation dans `site/`, pour la voir avant de l'envoyer

## Architecture

Le plugin est un seul composant Svelte (`src/plugin.svelte`, l'entrée de Rollup) que Windy monte
dans son panneau. Les modules `@windy/*` sont fournis par Windy à l'exécution (`W.store`,
`W.map`…) : Rollup les laisse externes.

Trajet des données, du lieu choisi à l'écran :

1. `forecast.ts` charge la prévision du lieu auprès de Windy (`loadForecast`), puis celle de quatre
   points voisins (`loadSurroundings`), qui ne sert qu'aux fronts.
2. `interpolate.ts` la ramène au pas horaire (`toHourly`) ; `payloadAt` en tire un instant isolé
   pour le curseur de l'émagramme (pas de 5 minutes).
3. `physics.ts` en fait des colonnes (`buildColumns` → `Column[]`, une par heure) : profil
   vertical, thermiques, cumulus, nuages, CAPE / LI, risque d'orage. Tout l'affichage part de ces
   colonnes ; aucun composant ne relit les données de Windy.
4. `plugin.svelte` découpe les colonnes par jour local (`time.ts`) et les passe à `Chart.svelte`
   (une journée) ou à `Emagram.svelte` (une heure), avec les fronts (`fronts.ts`), l'orage voisin
   (`nearby.ts`) et les crêtes (`relief.ts`).

`Chart.svelte` dessine en deux couches superposées : un canvas pour le fond continu (ciel,
thermiques, voile et nappes de nuages, interpolés d'une heure à l'autre) et un SVG par-dessus pour
ce qui doit rester net (flèches du vent, tours de cumulus, fronts, bandeaux, infobulle).

Le plugin et la carte de Windy restent synchronisés dans les deux sens par le `store` de Windy
(modèle, heure, niveau) et par le sélecteur de la carte (lieu, sur ordinateur seulement). Windy
impose la mise en page du panneau : la taille choisie (`size.ts`) et les marges passent par des
règles CSS qui remplacent les siennes, d'où les `!important` et les sélecteurs `:global`.

Les réglages de l'utilisateur sont gardés dans le `localStorage` de Windy, sous des clés `wpp-*`.

## Code

- `src/plugin.svelte` : panneau (onglets, réglages, chargement), variables CSS des thèmes
- `src/physics.ts` : des données de Windy aux colonnes altitude/heure, tous les calculs
  aérologiques (thermiques, cumulus, CAPE / LI, orages) et les couleurs
- `src/forecast.ts`, `src/interpolate.ts`, `src/time.ts` : chargement d'un point et de ses quatre
  points voisins (pour les fronts), passage au pas horaire, heure locale
- `src/Chart.svelte`, `src/Emagram.svelte`, `src/Legend.svelte`, `src/StormBanner.svelte`,
  `src/StormNearby.svelte`, `src/StormIcon.svelte`, `src/FrontIcon.svelte`, `src/ModelPicker.svelte`,
  `src/PlacePicker.svelte`, `src/svg.ts` : affichage
- `src/fronts.ts` : passages de front, lus sur la carte autour du lieu (points voisins) sur toute la
  prévision et dessinés par le graphique
- `src/nearby.ts` : orage d'un point voisin qui se dirige vers le lieu
- `src/relief.ts` : altitude des crêtes voisines, lue auprès de Windy autour du lieu choisi
- `src/level.ts` : altitude de la carte de Windy (niveau le plus proche d'une altitude du graphique,
  et altitude d'un niveau), synchronisée avec le graphique
- `src/scrub.ts` : lecture au doigt du graphique et de l'émagramme (appui maintenu, puis glissé)
- `src/update.ts` : recherche d'une version plus récente : dernière release GitHub, vérifiée sur
  windy-plugins.com (sinon de version en version sur windy-plugins.com)
- `src/size.ts` : taille du panneau choisie par l'utilisateur (part de l'écran, en largeur ou en
  hauteur sur téléphone), posée par-dessus les règles CSS de Windy
- `src/favorites.ts` : lieux favoris, ceux du compte Windy (`@windy/userFavs`), listés et modifiés
  depuis l'en-tête du panneau (`src/PlacePicker.svelte`)
- `src/pluginConfig.ts` : nom, version et description envoyés à Windy
- `scripts/publish.mjs` : envoi à Windy
- `scripts/site-page.mjs` : page de présentation du plugin (dossier `site/`, ignoré par git : le
  lien d'installation et le changelog), en anglais à la racine du site (`site/index.html`, la
  langue par défaut) et en français dans `site/fr/`, fabriquée depuis `src/pluginConfig.ts`,
  `CHANGELOG.en.md` et `CHANGELOG.md`. Ses textes sont dans `TEXTS`, une entrée par langue.
  `.github/workflows/pages.yml` la refait et la publie sur GitHub Pages à chaque envoi sur `main` ;
  `npm run site` la fabrique en local pour la voir. `.tmp/site-wordpress/` garde sa première
  forme, un bloc HTML à coller dans WordPress
- `scripts/site-capture.png` : capture du plugin affichée par cette page
- `scripts/weflare.css`, `scripts/weflare.svg`, `scripts/weflare-mark.svg` : habillage commun des
  pages des outils WeFlare (feuille de style, logo, icône de l'onglet). Les mêmes fichiers sont
  dans le dépôt de chaque outil (`outils/` de `trimming-tools`) : une modification s'y reporte
  telle quelle. Ce qui est propre à cette page reste dans `site-page.mjs`
- `instagram/` (ignoré par git, retiré du dépôt le 2026-10-07) : visuels et légendes des
  publications Instagram, gardés sur l'ordinateur seulement
- `.tmp/` (ignoré par git) : bancs d'essai et brouillons, jamais publiés. `.tmp/cross-supprime/`
  garde la carte des cross (onglet « Cross »), retirée le 2026-10-03 pour le moment, et la marche
  à suivre pour la remettre

## Conventions

- Tout est écrit en français : commentaires, messages de commit, changelog, README. Sont en
  anglais la description de `pluginConfig.ts` et `CHANGELOG.en.md`, et la page de présentation
  existe dans les deux langues.
- Chaque texte de l'interface existe dans les deux langues : `tr('français', 'English')`
  (`src/i18n.ts`).
- Les modules `@windy/*` n'existent que dans Windy. Les calculs testés n'en dépendent pas, ou
  passent par un bouchon de `tests/stubs/` déclaré dans `vitest.config.ts`.
- Un changement de calcul dans `physics.ts`, `interpolate.ts`, `time.ts`, `fronts.ts`,
  `nearby.ts` ou `level.ts` va avec son test dans `tests/`, et avec la mise à jour de « Comment sont calculées les estimations » dans le
  README si une méthode ou un seuil change.
- Classes CSS préfixées `wpp-`. Prettier : 4 espaces, guillemets simples, 100 colonnes.
- Les textes publiés (interface, README, changelog, Instagram) décrivent le plugin dans ses propres
  termes, sans le comparer à d'autres sites ou outils de prévision.
- Les textes publiés ne disent ni niveau de pilote ni aptitude à voler (« débutant », « pilote
  confirmé », « volable »), ni qu'une journée ou un créneau convient pour voler. En cas d'accident,
  le plugin ne doit pas avoir dit qu'un moment convenait pour voler.
- `.windy-api-key` contient la clé de publication : ne jamais l'afficher ni la versionner.

## Changelog

[CHANGELOG.md](CHANGELOG.md) suit Keep a Changelog, en français, version la plus récente en haut.

- Chaque changement visible par l'utilisateur est noté dans `## [Non publié]` dans le même
  travail que le code, sous `### Ajouté`, `### Modifié`, `### Corrigé` ou `### Supprimé`.
- Une entrée dit ce qui change pour le pilote, pas ce qui change dans le code. Un changement
  purement interne (refactorisation, tests) n'a pas d'entrée, sauf s'il fait toute la version.
- Quand une version modifie les valeurs affichées (plafonds, ascendances, seuils), un paragraphe
  sous le titre de la version le dit avant les listes.
- [CHANGELOG.en.md](CHANGELOG.en.md) est le même changelog en anglais, lu par la page de
  présentation en anglais : chaque entrée y est traduite dans le même travail, au même endroit
  (`## [Unreleased]`, `### Added`, `### Changed`, `### Fixed`, `### Removed`). Les noms de
  l'interface y sont ceux de l'interface en anglais (le second texte de `tr(...)`).

## Publier une version

Aucune version n'est publiée sur Windy sans son changelog ni sans être envoyée sur GitHub : les
trois vont ensemble, dans cet ordre. Le dépôt est
<https://github.com/alexandre-pereira/windy-plugin-pg-soundings> (branche `main`), avec un tag et
une release GitHub par version.

1. `npm test` doit passer.
2. Choisir le numéro (SemVer : correctif, mineure pour une fonction nouvelle, majeure pour une
   rupture) et le mettre dans `src/pluginConfig.ts` et `package.json`.
3. Dans `CHANGELOG.md`, renommer `## [Non publié]` en `## [X.Y.Z] - AAAA-MM-JJ`, vérifier que la
   section couvre tout ce qui a changé depuis le tag précédent (`git diff vA.B.C`), et la
   compléter sinon. Faire de même dans `CHANGELOG.en.md` (`## [Unreleased]`) : `npm run site`
   avertit si une version y manque.
4. Mettre le nouveau lien d'installation
   (`https://windy-plugins.com/2727410/windy-plugin-pg-soundings/X.Y.Z/plugin.min.js`) dans
   `README.md`, `instagram/legende.txt` et `instagram/slides.html` (constante `LINK`), puis
   refaire `instagram/carrousel/5.png` et `instagram/story/5.png`, qui affichent ce lien.
5. Commit `PG Soundings vX.Y.Z` (résumé de la version dans le corps), tag `vX.Y.Z`, puis
   `git push origin main` et `git push origin vX.Y.Z`. L'envoi sur `main` met aussi à jour la page
   de présentation (GitHub Pages), avec le nouveau lien et le changelog.
6. `npm run publish:windy`, seulement après le push : le script envoie à Windy le dépôt GitHub et
   le commit `HEAD`, qui doit donc déjà exister sur GitHub.
7. Créer la release GitHub `PG Soundings vX.Y.Z` sur le tag : les instructions d'installation
   avec le lien, puis la section de la version copiée du changelog (reprendre la forme de la
   release précédente, `gh release view`).
8. Donner le lien d'installation de la nouvelle version.

Si Windy refuse l'envoi (version déjà publiée), augmenter le numéro et reprendre à l'étape 2 : une
version publiée ne se remplace pas.

Changer `name` dans `pluginConfig.ts` crée un autre plugin pour Windy : les utilisateurs devraient
le réinstaller, et la recherche de mise à jour ne le trouverait pas. Elle lit la dernière release
GitHub : sans release, une version publiée sur Windy n'est annoncée qu'à ceux qui ont la version
juste avant.
