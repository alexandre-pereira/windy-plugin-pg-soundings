// Fabrique la page de présentation du plugin, publiée par GitHub Pages : elle présente le plugin,
// donne le lien d'installation de la version en cours et reprend le changelog. Elle existe en
// anglais (à la racine du site, la langue par défaut) et en français (dans fr/).
//
//   node scripts/site-page.mjs   →  site/index.html, site/fr/index.html, site/capture.png et
//                                   site/favicon.svg (dossier ignoré par git)
//
// La version vient de src/pluginConfig.ts, les versions de CHANGELOG.en.md et de CHANGELOG.md.
// L'habillage (scripts/wesoar.css, scripts/wesoar.svg, les polices) est celui de tous les outils WeSoar.
// GitHub refait la page et la publie à chaque envoi sur main (.github/workflows/pages.yml) : rien
// à lancer à la main, sauf pour la voir avant de l'envoyer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

const config = read('src/pluginConfig.ts');
const name = config.match(/name: '([^']+)'/)[1];
const version = config.match(/version: '([^']+)'/)[1];
/** Identifiant Windy de l'auteur, dans l'adresse des versions publiées (voir src/update.ts) */
const AUTHOR_ID = '2727410';
const installUrl = `https://windy-plugins.com/${AUTHOR_ID}/${name}/${version}/plugin.min.js`;
const REPO = 'https://github.com/alexandre-pereira/ws-plugin-windy';
/** Capture du plugin en largeur de téléphone, copiée à côté de la page */
const SHOT_SOURCE = 'scripts/site-capture.png';
const SHOT = 'capture.png';
/**
 * Adresse publique de la page, donnée par GitHub à la publication (variable SITE_URL) : elle sert
 * aux aperçus des réseaux sociaux, qui demandent des adresses complètes. Vide en local.
 */
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/+$/, '');

/**
 * Éditeur de la page, pour les mentions légales (LCEN, art. 1-1) : la société WeSoar, qui diffuse
 * le plugin. Ce qui n'est pas encore connu porte la marque `TODO` (« […à compléter] ») : en local,
 * la fabrication de la page le signale ; sur GitHub, elle échoue, et la page n'est pas publiée tant
 * qu'un champ en porte la marque. Capital, siège et immatriculation sont à reporter depuis l'extrait
 * Kbis ; le téléphone est obligatoire pour une société.
 */
const TODO = 'à compléter';
const PUBLISHER = {
    name: 'WeSoar',
    form: 'SASU',
    /** Capital social, ex. « 1 000 € » */
    capital: `[capital ${TODO}]`,
    /** Adresse du siège social */
    address: `[adresse du siège ${TODO}]`,
    /** Immatriculation, ex. « RCS Annecy 123 456 789 » */
    registration: `RCS [ville ${TODO}] [SIREN ${TODO}]`,
    phone: `[téléphone ${TODO}]`,
    /** Numéro de TVA intracommunautaire, s'il existe ; vide, il n'est pas écrit */
    vat: '',
    email: 'alex@wesoar.fr',
    director: 'Alexandre Pereira',
};
/** Hébergeur de la page (GitHub Pages) */
const HOST = {
    name: 'GitHub, Inc.',
    address: '88 Colin P. Kelly Jr. Street, San Francisco, CA 94107',
    phone: '+1 877 448 4820',
};

/** Langues de la page ; la première est à la racine du site, les autres dans un dossier à leur nom */
const LANGS = ['en', 'fr'];
/** Clé du `localStorage` qui retient la langue choisie par le visiteur */
const LANG_KEY = 'wf-lang';
/** Les autres outils WeSoar, cités au pied de la page */
const OTHER_TOOLS = [
    {
        // L'application n'existe qu'en français : une seule adresse
        url: { en: 'https://trim.wesoar.fr/', fr: 'https://trim.wesoar.fr/' },
        name: {
            en: 'WS Trim, the app to measure and trim your lines',
            fr: 'WS Trim, l’application de mesure et de calage des suspentes',
        },
    },
    {
        url: {
            en: 'https://trimming-tools.wesoar.fr/',
            fr: 'https://trimming-tools.wesoar.fr/fr/',
        },
        name: { en: 'WS Trimmer, the paraglider trimming bench', fr: 'WS Trimmer, le banc de calage parapente' },
    },
    {
        // WS Viewer n'existe qu'en français : une seule adresse
        url: { en: 'https://viewer.wesoar.fr/', fr: 'https://viewer.wesoar.fr/' },
        name: {
            en: 'WS Viewer, to replay your flights over the terrain and share them',
            fr: 'WS Viewer, pour revoir vos vols sur le relief et les partager',
        },
    },
];

const TEXTS = {
    en: {
        changelog: 'CHANGELOG.en.md',
        locale: 'en_GB',
        title: 'WS Sounding: the free-flight forecast inside Windy',
        description:
            'Free plugin for Windy.com: wind and thermals, altitude by altitude and hour by hour, clouds, fronts, thunderstorm risk and the sounding of the place you pick.',
        eyebrow: 'Free plugin for Windy.com',
        lead: 'The free-flight forecast inside Windy: wind and thermals, altitude by altitude and hour by hour, with clouds, fronts, thunderstorm risk and the sounding of the place you pick.',
        install: v => `Install version ${v}`,
        news: 'What’s new',
        source: 'Source code',
        shotAlt:
            'Altitude × hour chart of WS Sounding: wind arrows, thermal zone, shower clouds and a cold front passing',
        shotCredit:
            'Source: <a href="https://www.windy.com/">Windy.com</a> — ECMWF IFS model data, © ECMWF, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, processed by WS Sounding',
        // Crédit de la capture dans l'aperçu des liens, qui montre l'image sans sa légende
        shotSource:
            'Screenshot: Windy.com, ECMWF IFS model data, © ECMWF, CC BY 4.0, processed by WS Sounding.',
        features: [
            [
                'Wind aloft',
                'One arrow per altitude band and per hour, coloured by speed, with the surface wind and gusts.',
            ],
            [
                'Thermals',
                'The climb read on the vario, the usable ceiling, the cumulus they build and thermals made choppy by the wind.',
            ],
            [
                'Clouds and rain',
                'Cumulus, shower clouds, cloud ceiling, sea of clouds, snow line, virga.',
            ],
            [
                'Thunderstorms',
                'Risk hour by hour, a warning banner on storm days, a neighbouring storm pushed towards the place, CAPE and LI.',
            ],
            [
                'Fronts',
                'Cold fronts, warm fronts and occluded fronts drawn on the chart at the hour they pass.',
            ],
            [
                'Sounding',
                'Skewed sounding of every hour: temperature curve, dew point, parcel ascent, freezing level.',
            ],
            [
                'Linked to the Windy map',
                'The hour, altitude, model and place of the plugin follow the map, and the map follows them.',
            ],
            [
                'Seven models',
                'ECMWF, ICON, GFS, ICON-EU, ICON-D2, AROME and UKV, in English or French depending on the language of Windy.',
            ],
        ],
        installTitle: 'Install the plugin',
        steps: link => [
            'Open <a href="https://www.windy.com/plugins">windy.com/plugins</a>, signed in to your Windy account.',
            `Choose “Load plugin directly from URL” and paste this link in place of the text already in the field:${link}`,
            'Click a flying site on the map: the plugin remembers your last place.',
        ],
        linkLabel: v => `Install link of WS Sounding ${v}`,
        copy: 'Copy the link',
        copied: 'Copied ✓',
        installNote:
            'The plugin then announces new versions itself. It works on a computer as well as on a phone.',
        versionTitle: v => `Version ${v}`,
        date: iso => {
            const [y, m, d] = iso.split('-').map(Number);
            const months =
                'January February March April May June July August September October November December';
            return `${d} ${months.split(' ')[m - 1]} ${y}`;
        },
        disclaimer: `Estimates drawn from forecast models: nothing replaces watching the sky. WS Sounding is an independent, free and <a href="${REPO}">open-source</a> plugin; how each estimate is computed is described in its <a href="${REPO}#readme">README</a> (in French).`,
        madeBy: 'Developed and offered free of charge by WeSoar.',
        legalTitle: 'Legal notice',
        legal: (p, h, base) => [
            `<b>Publisher</b>: ${[
                p.name + (p.form ? `, ${p.form}` : '') + (p.capital ? ` with a share capital of ${p.capital}` : ''),
                p.address && `registered office: ${p.address}`,
                p.registration,
                p.vat && `VAT ${p.vat}`,
                p.phone && `phone ${p.phone}`,
                `<a href="mailto:${p.email}">${p.email}</a>`,
            ]
                .filter(Boolean)
                .join(', ')}. Publication director: ${p.director}, president.`,
            `<b>Host</b>: ${h.name} (GitHub Pages), ${h.address}, United States, phone ${h.phone}.`,
            `<b>Personal data</b>: the controller is WeSoar (the publisher), contact <a href="mailto:${p.email}">${p.email}</a>. This page sets no cookie, does not measure its audience and loads nothing from other sites; it only keeps, in your browser, the language you chose. Its host, GitHub, Inc. (United States, certified under the EU-U.S. Data Privacy Framework), records visitors’ IP addresses in its logs for the security of the service, and keeps them for the periods set by its <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">privacy statement</a>. An e-mail sent to WeSoar is kept for the time of the exchange.`,
            `<b>The plugin</b> collects no data and sends nothing to WeSoar: what it reads or writes goes through Windy. It asks Windy for the forecasts, the terrain height and the name of the place. When it opens without a place (none given by the map, no last place kept), it asks for the device’s position through Windy’s geolocation: the browser asks for your permission, unless it was already given to windy.com, in which case no prompt appears; without it, Windy gives an approximate position drawn from the IP address. The heart in its header adds the place shown (name and coordinates) to Windy’s favourites, or removes it: Windy saves it, in your Windy account if you are signed in. Its settings and last place stay in the browser storage of the windy.com site, readable by Windy and its other plugins; the device’s position is only kept there, as in the page address, rounded to about 1 km, and “Forget the last place” erases it. It checks windy-plugins.com, Windy’s plugin site, for a new version at most every 6 hours (<a href="${REPO}#données-personnelles">details</a>, in French).`,
            `<b>Your rights</b>: you can ask for access to your data, its rectification or erasure, and object to its processing, by writing to <a href="mailto:${p.email}">${p.email}</a>. You can also lodge a complaint with the CNIL (<a href="https://www.cnil.fr/">cnil.fr</a>).`,
            `<b>Intellectual property</b>: the code of WS Sounding belongs to WeSoar SASU; written by Alexandre Pereira, it is published under the <a href="${REPO}/blob/main/LICENSE">ISC licence</a> and distributed by WeSoar. The WeSoar name and logo belong to the publisher and are not covered by this licence; third-party files keep their own authors and licences (<a href="${REPO}/blob/main/NOTICE">NOTICE</a>). The Mona Sans typeface is used under the <a href="${base}mona-sans-OFL.txt">SIL Open Font License</a>. Windy is a trademark of Windyty, SE; WS Sounding is not published by Windy.`,
            `<b>Liability</b>: the plugin shows estimates computed from forecast models, which can be wrong. It is an unofficial, uncertified tool, for flight preparation only: it is not official aeronautical weather information (check your national aviation weather service; in France, Météo-France and AEROWEB). No thunderstorm warning does not mean no risk, and airspace regulations must be followed. The estimates do not replace watching the sky or official forecasts, and the decision to fly is the pilot’s alone.`,
        ],
        otherTools: 'Other free tools:',
        langLabel: 'Language',
    },
    fr: {
        changelog: 'CHANGELOG.md',
        locale: 'fr_FR',
        title: 'WS Sounding : la prévision du vol libre dans Windy',
        description:
            'Plugin gratuit pour Windy.com : le vent et les thermiques, altitude par altitude et heure par heure, les nuages, les fronts, le risque d’orage et l’émagramme du lieu choisi.',
        eyebrow: 'Plugin gratuit pour Windy.com',
        lead: 'La prévision du vol libre dans Windy : le vent et les thermiques, altitude par altitude et heure par heure, les nuages, les fronts, le risque d’orage et l’émagramme du lieu choisi.',
        install: v => `Installer la version ${v}`,
        news: 'Nouveautés',
        source: 'Code source',
        shotAlt:
            'Graphique altitude × heure de WS Sounding : flèches du vent, zone des thermiques, nuages d’averses et passage d’un front froid',
        shotCredit:
            'Source : <a href="https://www.windy.com/">Windy.com</a> — données du modèle ECMWF IFS, © ECMWF, <a href="https://creativecommons.org/licenses/by/4.0/deed.fr">CC BY 4.0</a>, retraitées par WS Sounding',
        shotSource:
            'Capture : Windy.com, données du modèle ECMWF IFS, © ECMWF, CC BY 4.0, retraitées par WS Sounding.',
        features: [
            [
                'Vent en altitude',
                'Une flèche par tranche d’altitude et par heure, colorée selon la vitesse, avec le vent et les rafales au sol.',
            ],
            [
                'Thermiques',
                'La montée lue au vario, le plafond exploitable, les cumulus qu’ils forment et les thermiques hachés par le vent.',
            ],
            [
                'Nuages et pluie',
                'Cumulus, nuages d’averses, plafond nuageux, mer de nuages, limite pluie-neige, virga.',
            ],
            [
                'Orages',
                'Risque heure par heure, bandeau d’alerte les jours d’orage, orage voisin poussé vers le lieu, CAPE et LI.',
            ],
            [
                'Fronts',
                'Fronts froids, chauds et occlusions tracés sur le graphique à l’heure où ils passent.',
            ],
            [
                'Émagramme',
                'Sondage redressé de chaque heure : courbe d’état, point de rosée, ascension de la particule, isotherme 0 °C.',
            ],
            [
                'Lié à la carte Windy',
                'L’heure, l’altitude, le modèle et le lieu du plugin suivent la carte, et la carte les suit.',
            ],
            [
                'Sept modèles',
                'ECMWF, ICON, GFS, ICON-EU, ICON-D2, AROME et UKV, en français ou en anglais selon la langue de Windy.',
            ],
        ],
        installTitle: 'Installer le plugin',
        steps: link => [
            'Ouvre <a href="https://www.windy.com/plugins">windy.com/plugins</a>, connecté à ton compte Windy.',
            `Choisis « Load plugin directly from URL » et colle ce lien à la place du texte déjà dans le champ :${link}`,
            'Clique sur un site de vol sur la carte : le plugin retient ton dernier lieu.',
        ],
        linkLabel: v => `Lien d’installation de WS Sounding ${v}`,
        copy: 'Copier le lien',
        copied: 'Copié ✓',
        installNote:
            'Le plugin signale ensuite lui-même les nouvelles versions. Il s’utilise sur ordinateur comme sur téléphone.',
        versionTitle: v => `Version ${v}`,
        date: iso => {
            const [y, m, d] = iso.split('-').map(Number);
            const months =
                'janvier février mars avril mai juin juillet août septembre octobre novembre décembre';
            return `${d === 1 ? '1er' : d} ${months.split(' ')[m - 1]} ${y}`;
        },
        disclaimer: `Des estimations tirées des modèles de prévision : rien ne remplace l’observation du ciel. WS Sounding est un plugin indépendant, gratuit et <a href="${REPO}">à code ouvert</a> ; la façon dont chaque estimation est calculée est décrite dans son <a href="${REPO}#readme">README</a>.`,
        madeBy: 'Développé et offert gratuitement par WeSoar.',
        legalTitle: 'Mentions légales',
        legal: (p, h, base) => [
            `<b>Éditeur</b> : ${[
                p.name + (p.form ? `, ${p.form}` : '') + (p.capital ? ` au capital de ${p.capital}` : ''),
                p.address && `siège social : ${p.address}`,
                p.registration,
                p.vat && `TVA ${p.vat}`,
                p.phone && `téléphone ${p.phone}`,
                `<a href="mailto:${p.email}">${p.email}</a>`,
            ]
                .filter(Boolean)
                .join(', ')}. Directeur de la publication : ${p.director}, président.`,
            `<b>Hébergeur</b> : ${h.name} (GitHub Pages), ${h.address}, États-Unis, téléphone ${h.phone}.`,
            `<b>Données personnelles</b> : le responsable du traitement est WeSoar (l’éditeur), contact <a href="mailto:${p.email}">${p.email}</a>. Cette page ne pose aucun cookie, ne mesure pas l’audience et ne charge rien depuis d’autres sites ; elle retient seulement, dans votre navigateur, la langue choisie. Son hébergeur, GitHub, Inc. (États-Unis, certifié au Data Privacy Framework UE–États-Unis), enregistre l’adresse IP des visiteurs dans ses journaux, pour la sécurité du service, et la garde pendant les durées fixées par sa <a href="https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement">déclaration de confidentialité</a>. Un e-mail envoyé à WeSoar est gardé le temps de l’échange.`,
            `<b>Le plugin</b> ne collecte aucune donnée et n’envoie rien à WeSoar : ce qu’il lit ou écrit passe par Windy. Il demande à Windy les prévisions, l’altitude du terrain et le nom du lieu. Quand il s’ouvre sans lieu (ni lieu donné par la carte, ni dernier lieu gardé), il demande la position de l’appareil par la géolocalisation de Windy : le navigateur vous demande l’autorisation, sauf si elle a déjà été donnée à windy.com, auquel cas aucune demande n’apparaît ; sans elle, Windy donne une position approchée, tirée de l’adresse IP. Le cœur de son en-tête ajoute le lieu affiché (nom et coordonnées) aux favoris de Windy, ou l’en retire : Windy l’enregistre, dans votre compte Windy si vous êtes connecté. Ses réglages et le dernier lieu restent dans le stockage du navigateur pour le site windy.com, lisible par Windy et ses autres plugins ; la position de l’appareil n’y est gardée, comme dans l’adresse de la page, qu’arrondie à environ 1 km, et « Oublier le dernier lieu » l’efface. Il interroge au plus toutes les 6 heures windy-plugins.com, le site des plugins de Windy, pour savoir si une nouvelle version existe (<a href="${REPO}#données-personnelles">détail</a>).`,
            `<b>Vos droits</b> : vous pouvez demander l’accès à vos données, leur rectification ou leur effacement, et vous opposer à leur traitement, en écrivant à <a href="mailto:${p.email}">${p.email}</a>. Vous pouvez aussi adresser une réclamation à la CNIL (<a href="https://www.cnil.fr/">cnil.fr</a>).`,
            `<b>Propriété intellectuelle</b> : le code de WS Sounding appartient à WeSoar SASU ; écrit par Alexandre Pereira, il est publié sous <a href="${REPO}/blob/main/LICENSE">licence ISC</a> et diffusé par WeSoar. Le nom et le logo WeSoar appartiennent à l’éditeur et n’entrent pas dans cette licence ; les fichiers tiers gardent leurs auteurs et leurs licences (<a href="${REPO}/blob/main/NOTICE">NOTICE</a>). La police Mona Sans est utilisée sous <a href="${base}mona-sans-OFL.txt">licence SIL Open Font License</a>. Windy est une marque de Windyty, SE ; WS Sounding n’est pas édité par Windy.`,
            `<b>Responsabilité</b> : le plugin affiche des estimations calculées à partir de modèles de prévision, qui peuvent se tromper. C’est un outil non officiel et non certifié, pour la seule préparation du vol : ce n’est pas une information météorologique aéronautique officielle (consultez Météo-France et AEROWEB). L’absence d’alerte d’orage ne signifie pas l’absence de risque, et la réglementation de l’espace aérien reste à respecter. Ces estimations ne remplacent ni l’observation du ciel ni les prévisions officielles, et la décision de voler appartient au seul pilote.`,
        ],
        otherTools: 'Autres outils gratuits :',
        langLabel: 'Langue',
    },
};

const esc = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Mise en forme dans une ligne de Markdown : code, gras, liens */
const inline = text =>
    esc(text)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');

/** Corps d'une version du changelog (Markdown : paragraphes, titres ###, listes) en HTML */
const bodyHtml = markdown => {
    const out = [];
    let paragraph = [];
    let items = null;
    const flush = () => {
        if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
        if (items) out.push(`<ul>${items.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`);
        paragraph = [];
        items = null;
    };
    for (const line of markdown.split('\n')) {
        if (line.startsWith('### ')) {
            flush();
            out.push(`<h3>${inline(line.slice(4))}</h3>`);
        } else if (line.startsWith('- ')) {
            if (paragraph.length) flush();
            (items ??= []).push(line.slice(2));
        } else if (items && /^\s+\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
        else if (!line.trim()) flush();
        else {
            if (items) flush();
            paragraph.push(line.trim());
        }
    }
    flush();
    return out.join('\n');
};

/** Versions publiées d'un changelog, de la plus récente à la plus ancienne, sans « Non publié » */
const versionsOf = file =>
    read(file)
        .split(/^## /m)
        .slice(1)
        .map(section => {
            const [, id, date] = section.match(/^\[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?/) ?? [];
            return { id, date, body: section.slice(section.indexOf('\n') + 1).trim() };
        })
        .filter(v => v.date);

/** Un avertissement, que GitHub affiche aussi en tête de la publication */
const warn = text =>
    console.warn(process.env.GITHUB_ACTIONS ? `::warning::${text}` : `Attention : ${text}`);

const versions = Object.fromEntries(LANGS.map(lang => [lang, versionsOf(TEXTS[lang].changelog)]));
for (const lang of LANGS) {
    const { changelog } = TEXTS[lang];
    if (versions[lang][0]?.id !== version)
        warn(`${changelog} s'arrête à la ${versions[lang][0]?.id}, le plugin est en ${version}.`);
    const missing = versions.fr.filter(v => !versions[lang].some(w => w.id === v.id));
    if (missing.length)
        warn(`${changelog} n'a pas les versions ${missing.map(v => v.id).join(', ')}.`);
}

/** Feuille de style sur une ligne, sans ses commentaires */
const oneLine = css =>
    css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s*\n\s*/g, ' ')
        .trim();

// Ce qui est propre à cette page ; le reste vient de la feuille commune des outils WeSoar
const css =
    oneLine(read('scripts/wesoar.css')) +
    oneLine(`
.pgs-cols{display:grid;grid-template-columns:minmax(0,320px) minmax(0,1fr);gap:clamp(20px,4vw,40px);align-items:start}
.pgs-shot{border:6px solid var(--wf-ink);border-radius:26px;overflow:hidden;background:#2b2b2b;aspect-ratio:470/700}
.pgs-shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.pgs-figure{margin:0}
.pgs-legal summary{cursor:pointer;color:var(--wf-ink);font-weight:700}
.pgs-legal p{margin:8px 0 0}
.pgs-credit{margin-top:8px;font-size:.8rem;text-align:center;color:var(--wf-muted)}
.pgs-features{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.pgs-features li{padding:14px 16px}
.pgs-features b{display:block;font-size:1.03rem;letter-spacing:-.01em}
.pgs-features span{display:block;margin-top:3px;font-size:.92rem;line-height:1.45;color:var(--wf-muted)}
.pgs-install{margin-top:18px}
.pgs-steps{margin:0;padding-left:1.3em;font-size:1.03rem}
.pgs-steps li{margin:10px 0}
.pgs-steps li:first-child{margin-top:0}
.pgs-install .wf-note{margin:14px 0 0}
@media (max-width:720px){.pgs-cols{grid-template-columns:1fr}.pgs-shot{max-width:320px;margin:0 auto}}
`);

/** Le logo WeSoar, dessiné dans la page pour prendre la couleur du texte */
const logo = read('scripts/wesoar.svg').trim().replace('<svg ', '<svg class="wf-logo" ');

/** Adresse du dossier d'une langue, depuis la page d'une autre : « ./ », « fr/ » ou « ../ » */
const pathTo = (from, to) =>
    from === to ? './' : (from === LANGS[0] ? '' : '../') + (to === LANGS[0] ? '' : `${to}/`);
/** Adresse publique de la page d'une langue, si le site en a une */
const publicUrl = lang => `${SITE_URL}/${lang === LANGS[0] ? '' : `${lang}/`}`;

const pageOf = lang => {
    const t = TEXTS[lang];
    const base = pathTo(lang, LANGS[0]);
    /** Balises des aperçus de lien (réseaux sociaux, messageries) ; l'image demande l'adresse de la page */
    const social = [
        `<meta property="og:type" content="website">`,
        `<meta property="og:locale" content="${t.locale}">`,
        `<meta property="og:title" content="${t.title}">`,
        // La capture (og:image) n'est pas fabriquée ici : son crédit va dans la description
        `<meta property="og:description" content="${t.description} ${t.shotSource}">`,
        ...(SITE_URL
            ? [
                  `<link rel="canonical" href="${publicUrl(lang)}">`,
                  ...LANGS.map(
                      l => `<link rel="alternate" hreflang="${l}" href="${publicUrl(l)}">`,
                  ),
                  `<link rel="alternate" hreflang="x-default" href="${publicUrl(LANGS[0])}">`,
                  `<meta property="og:url" content="${publicUrl(lang)}">`,
                  `<meta property="og:image" content="${SITE_URL}/${SHOT}">`,
              ]
            : []),
    ].join('\n');
    // La page par défaut envoie vers sa langue le visiteur qui en a choisi une autre, ou dont le
    // navigateur est dans une autre langue du site tant qu'il n'a rien choisi
    const redirect =
        lang === LANGS[0]
            ? `<script>try{var l=localStorage.getItem('${LANG_KEY}')||(navigator.language||'').slice(0,2).toLowerCase();if(${JSON.stringify(LANGS.slice(1))}.indexOf(l)>=0)location.replace(l+'/'+(location.protocol=='file:'?'index.html':'')+location.hash)}catch(e){}</script>\n`
            : '';
    const langNav = `<nav class="wf-lang" aria-label="${t.langLabel}">${LANGS.map(
        l =>
            `<a href="${pathTo(lang, l)}" lang="${l}" hreflang="${l}"${l === lang ? ' aria-current="page"' : ''} onclick="try{localStorage.setItem('${LANG_KEY}','${l}')}catch(e){}">${l.toUpperCase()}</a>`,
    ).join('')}</nav>`;
    const link = `
<div class="wf-copy"><input type="text" readonly value="${installUrl}" onclick="this.select()" aria-label="${t.linkLabel(version)}"><button class="wf-btn" type="button" onclick="navigator.clipboard.writeText('${installUrl}').then(()=>{this.textContent='${t.copied}'})">${t.copy}</button></div>`;

    return `<!doctype html>
<!-- WS Sounding ${version} : page fabriquée par scripts/site-page.mjs, ne pas la modifier à la main -->
<html lang="${lang}">
<head>
<meta charset="utf-8">
${redirect}<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.title}</title>
<meta name="description" content="${t.description}">
<meta name="theme-color" content="#f7f4ee">
${social}
<link rel="icon" type="image/svg+xml" href="${base}favicon.svg">
<link rel="preload" href="${base}mona-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}literata.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Mona Sans';src:url('${base}mona-sans.woff2') format('woff2');font-weight:200 900;font-display:swap}@font-face{font-family:'Literata';src:url('${base}literata.woff2') format('woff2');font-weight:400 600;font-display:swap}@font-face{font-family:'Literata';font-style:italic;src:url('${base}literata-italic.woff2') format('woff2');font-weight:400 600;font-display:swap}${css}</style>
</head>
<body>
<header class="wf-top">
<span class="wf-brand">${logo}</span>
${langNav}
</header>
<main class="wf-page">
<div class="wf-hero">
<span class="wf-eyebrow">${t.eyebrow}</span>
<h1 class="wf-title">WS Sounding</h1>
<p class="wf-lead">${t.lead}</p>
<div class="wf-actions">
<a class="wf-btn" href="#install">${t.install(version)}</a>
<a class="wf-btn wf-btn--ghost" href="#news">${t.news}</a>
<a class="wf-btn wf-btn--ghost" href="${REPO}">${t.source}</a>
</div>
</div>
<div class="pgs-cols">
<figure class="pgs-figure">
<div class="pgs-shot"><img src="${base}${SHOT}" alt="${t.shotAlt}"></div>
<figcaption class="pgs-credit">${t.shotCredit}</figcaption>
</figure>
<ul class="pgs-features">
${t.features.map(([title, text]) => `<li class="wf-card"><b>${title}</b><span>${text}</span></li>`).join('\n')}
</ul>
</div>

<h2 class="wf-h" id="install">${t.installTitle}</h2>
<div class="wf-card pgs-install">
<ol class="pgs-steps">
${t
    .steps(link)
    .map(step => `<li>${step}</li>`)
    .join('\n')}
</ol>
<p class="wf-note">${t.installNote}</p>
</div>

<h2 class="wf-h" id="news">${t.news}</h2>
<div class="wf-card wf-fold">
${versions[lang]
    .map(
        (
            v,
            k,
        ) => `<details${k === 0 ? ' open' : ''}><summary>${t.versionTitle(v.id)}<small>${t.date(v.date)}</small></summary>
<div class="wf-fold-body wf-prose">
${bodyHtml(v.body)}
</div></details>`,
    )
    .join('\n')}
</div>
</main>
<footer class="wf-foot"><div class="wf-foot-in">
<div class="wf-made">${logo}<span>${t.madeBy}</span></div>
<ul class="wf-tools"><li>${t.otherTools}</li>${OTHER_TOOLS.map(tool => `<li><a href="${tool.url[lang]}">${tool.name[lang]}</a></li>`).join('')}</ul>
<p>${t.disclaimer}</p>
<details class="pgs-legal" id="legal"><summary>${t.legalTitle}</summary>
${t
    .legal(PUBLISHER, HOST, base)
    .map(line => `<p>${line}</p>`)
    .join('\n')}
</details>
<!-- Le lien #legal (depuis le plugin) ouvre les mentions, repliées sinon -->
<script>if(location.hash=='#legal')document.getElementById('legal').open=true</script>
</div></footer>
</body>
</html>
`;
};

const out = path.join(root, 'site');
for (const lang of LANGS) {
    const dir = path.join(out, lang === LANGS[0] ? '' : lang);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageOf(lang));
}
fs.copyFileSync(path.join(root, SHOT_SOURCE), path.join(out, SHOT));
fs.copyFileSync(path.join(root, 'scripts/wesoar-mark.svg'), path.join(out, 'favicon.svg'));
// Les polices sont servies avec la page, et leur licence (SIL OFL) les accompagne : Mona Sans pour le texte,
// Literata (romain et italique) pour les grands titres, comme le veut la charte WeSoar
for (const font of ['mona-sans.woff2', 'mona-sans-OFL.txt', 'literata.woff2', 'literata-italic.woff2', 'literata-OFL.txt'])
    fs.copyFileSync(path.join(root, 'scripts', font), path.join(out, font));
console.log(
    `site/ : WS Sounding ${version}, ` +
        LANGS.map(lang => `${lang} ${versions[lang].length} versions`).join(', ') +
        (SITE_URL ? `, pour ${SITE_URL}` : ''),
);
// Champs obligatoires vides, et tout champ encore marqué « à compléter »
const LABELS = {
    capital: 'capital',
    address: 'siège social',
    registration: 'immatriculation (RCS)',
    phone: 'téléphone',
};
const empty = Object.keys(LABELS).filter(key => !PUBLISHER[key]);
const todo = Object.keys(PUBLISHER).filter(key => String(PUBLISHER[key] ?? '').includes(TODO));
const names = keys => keys.map(key => LABELS[key] ?? key).join(', ');
// Un champ vidé par erreur arrête la publication sur GitHub (.github/workflows/pages.yml). Les champs encore
// marqués « à compléter » (en attente du Kbis) ne font qu'avertir : bloquer ne publierait que l'ancienne page,
// avec les mêmes trous et sans les textes corrigés depuis. Une fois PUBLISHER rempli, les traiter comme `empty`.
if (empty.length) {
    const text = `Mentions légales incomplètes, champs vides dans PUBLISHER : ${names(empty)}`;
    if (process.env.GITHUB_ACTIONS) {
        console.error(`::error::${text}`);
        process.exit(1);
    }
    console.warn(text);
}
if (todo.length) {
    const text = `Mentions légales à compléter dans PUBLISHER (Kbis) : ${names(todo)}`;
    console.warn(process.env.GITHUB_ACTIONS ? `::warning::${text}` : `Attention : ${text}`);
}
