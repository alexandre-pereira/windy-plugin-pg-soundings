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
- `npm run publish:windy` : compile et publie sur Windy (voir « Publier une version »)

## Code

- `src/plugin.svelte` : panneau (onglets, réglages, chargement), variables CSS des thèmes
- `src/physics.ts` : des données de Windy aux colonnes altitude/heure, tous les calculs
  aérologiques (thermiques, cumulus, CAPE / LI, orages) et les couleurs
- `src/forecast.ts`, `src/interpolate.ts`, `src/time.ts` : chargement d'un point et de ses quatre
  points voisins (pour les fronts), passage au pas horaire, heure locale
- `src/Chart.svelte`, `src/Emagram.svelte`, `src/Legend.svelte`, `src/StormBanner.svelte`,
  `src/StormNearby.svelte`, `src/StormIcon.svelte`, `src/FrontIcon.svelte`, `src/ModelPicker.svelte`,
  `src/svg.ts` : affichage
- `src/fronts.ts` : passages de front, lus sur la carte autour du lieu (points voisins) sur toute la
  prévision et dessinés par le graphique
- `src/nearby.ts` : orage d'un point voisin qui se dirige vers le lieu
- `src/relief.ts` : altitude des crêtes voisines, lue auprès de Windy autour du lieu choisi
- `src/level.ts` : altitude de la carte de Windy (niveau le plus proche d'une altitude du graphique,
  et altitude d'un niveau), synchronisée avec le graphique
- `src/scrub.ts` : lecture au doigt du graphique et de l'émagramme (appui maintenu, puis glissé)
- `src/update.ts` : recherche d'une version plus récente sur windy-plugins.com
- `src/pluginConfig.ts` : nom, version et description envoyés à Windy
- `scripts/publish.mjs` : envoi à Windy
- `.tmp/` (ignoré par git) : bancs d'essai et brouillons, jamais publiés. `.tmp/cross-supprime/`
  garde la carte des cross (onglet « Cross »), retirée le 2026-10-03 pour le moment, et la marche
  à suivre pour la remettre

## Conventions

- Tout est écrit en français : commentaires, messages de commit, changelog, README. Seule la
  description de `pluginConfig.ts` est en anglais.
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
   compléter sinon.
4. Mettre le nouveau lien d'installation
   (`https://windy-plugins.com/2727410/windy-plugin-pg-soundings/X.Y.Z/plugin.min.js`) dans
   `README.md`, `instagram/legende.txt` et `instagram/slides.html` (constante `LINK`), puis
   refaire `instagram/carrousel/5.png` et `instagram/story/5.png`, qui affichent ce lien.
5. Commit `PG Soundings vX.Y.Z` (résumé de la version dans le corps), tag `vX.Y.Z`, puis
   `git push origin main` et `git push origin vX.Y.Z`.
6. `npm run publish:windy`, seulement après le push : le script envoie à Windy le dépôt GitHub et
   le commit `HEAD`, qui doit donc déjà exister sur GitHub.
7. Créer la release GitHub `PG Soundings vX.Y.Z` sur le tag : les instructions d'installation
   avec le lien, puis la section de la version copiée du changelog (reprendre la forme de la
   release précédente, `gh release view`).
8. Donner le lien d'installation de la nouvelle version.

Si Windy refuse l'envoi (version déjà publiée), augmenter le numéro et reprendre à l'étape 2 : une
version publiée ne se remplace pas.

Changer `name` dans `pluginConfig.ts` crée un autre plugin pour Windy : les utilisateurs devraient
le réinstaller, et la recherche de mise à jour ne le trouverait pas.
