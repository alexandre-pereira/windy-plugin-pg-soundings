// Fabrique la page de présentation du plugin, publiée par GitHub Pages : elle présente le plugin,
// donne le lien d'installation de la version en cours et reprend le changelog.
//
//   node scripts/site-page.mjs   →  site/index.html et site/capture.png (dossier ignoré par git)
//
// La version vient de src/pluginConfig.ts et les versions de CHANGELOG.md. GitHub refait la page et
// la publie à chaque envoi sur main (.github/workflows/pages.yml) : rien à lancer à la main, sauf
// pour la voir avant de l'envoyer.

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
const REPO = 'https://github.com/alexandre-pereira/windy-plugin-pg-soundings';
/** Capture du plugin en largeur de téléphone, copiée à côté de la page */
const SHOT_SOURCE = 'scripts/site-capture.png';
const SHOT = 'capture.png';
/**
 * Adresse publique de la page, donnée par GitHub à la publication (variable SITE_URL) : elle sert
 * aux aperçus des réseaux sociaux, qui demandent des adresses complètes. Vide en local.
 */
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/+$/, '');
const TITLE = 'PG Soundings : la prévision du vol libre dans Windy';
const DESCRIPTION =
    'Plugin gratuit pour Windy.com : le vent et les thermiques, altitude par altitude et heure par heure, les nuages, les fronts, le risque d’orage et l’émagramme du lieu choisi.';

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

const MONTHS =
    'janvier février mars avril mai juin juillet août septembre octobre novembre décembre'.split(' ');
const dateText = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`;
};

// Versions publiées, de la plus récente à la plus ancienne ; « Non publié » n'y figure pas
const versions = read('CHANGELOG.md')
    .split(/^## /m)
    .slice(1)
    .map(section => {
        const [, id, date] = section.match(/^\[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?/) ?? [];
        return { id, date, body: section.slice(section.indexOf('\n') + 1).trim() };
    })
    .filter(v => v.date);
if (versions[0]?.id !== version)
    console.warn(
        `Attention : le changelog s'arrête à la ${versions[0]?.id}, le plugin est en ${version}.`,
    );

const FEATURES = [
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
];

const css = `
html{scroll-behavior:smooth}
body{margin:0;padding:clamp(8px,3vw,32px);background:#0d141c}
.pgs{--pgs-fg:#eef2f7;--pgs-dim:#b5bfcc;--pgs-accent:#ffd24a;--pgs-line:rgba(255,255,255,.14);
  font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--pgs-fg);line-height:1.55;
  background:radial-gradient(circle at 15% 0%,#3b2a6b 0%,#16202c 46%,#0d141c 100%);
  border-radius:18px;padding:clamp(20px,5vw,48px);max-width:1040px;margin:0 auto;box-sizing:border-box}
.pgs *{box-sizing:border-box}
.pgs h1,.pgs h2,.pgs h3,.pgs p,.pgs ul,.pgs ol{margin:0;padding:0;color:inherit}
.pgs a{color:var(--pgs-accent)}
.pgs-tag{display:inline-block;padding:5px 14px;border-radius:30px;background:var(--pgs-accent);
  color:#111;font-weight:800;font-size:13px;letter-spacing:.5px;text-transform:uppercase}
.pgs-title{margin-top:14px!important;font-size:clamp(32px,6vw,52px);line-height:1.08;letter-spacing:-.5px;font-weight:800}
.pgs-title em{font-style:normal;color:var(--pgs-accent)}
.pgs-lead{margin-top:12px!important;font-size:clamp(17px,2.4vw,21px);color:var(--pgs-dim);max-width:46em}
.pgs-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
.pgs-btn{display:inline-block;padding:11px 20px;border-radius:10px;font-weight:700;text-decoration:none;
  background:var(--pgs-accent);color:#111!important;border:2px solid var(--pgs-accent)}
.pgs-btn--ghost{background:none;color:var(--pgs-fg)!important;border-color:var(--pgs-line)}
.pgs-cols{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:clamp(20px,4vw,40px);
  margin-top:clamp(28px,5vw,44px);align-items:start}
.pgs-shot{border-radius:16px;overflow:hidden;border:2px solid var(--pgs-line);background:#2b2b2b;
  box-shadow:0 24px 60px rgba(0,0,0,.55);aspect-ratio:470/700}
.pgs-shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.pgs-features{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px 26px}
.pgs-features b{display:block;font-size:18px;color:#fff}
.pgs-features span{display:block;margin-top:3px;font-size:15px;color:var(--pgs-dim)}
.pgs-h{margin-top:clamp(34px,6vw,56px)!important;font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.3px}
.pgs-steps{margin-top:16px!important;padding-left:1.3em!important;font-size:17px}
.pgs-steps li{margin:8px 0}
.pgs-link{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.pgs-link input{flex:1 1 260px;min-width:0;padding:11px 14px;border-radius:10px;border:2px dashed rgba(255,210,74,.55);
  background:rgba(255,255,255,.06);color:var(--pgs-fg);font:600 14px Consolas,Menlo,monospace}
.pgs-link button{padding:11px 18px;border-radius:10px;border:none;background:var(--pgs-accent);color:#111;
  font:inherit;font-weight:700;cursor:pointer}
.pgs-note{margin-top:14px!important;font-size:15px;color:var(--pgs-dim)}
.pgs-log{margin-top:18px}
.pgs-log details{border-top:1px solid var(--pgs-line)}
.pgs-log details:last-child{border-bottom:1px solid var(--pgs-line)}
.pgs-log summary{cursor:pointer;padding:12px 4px;font-size:18px;font-weight:700;list-style-position:inside}
.pgs-log summary small{margin-left:8px;font-size:14px;font-weight:400;color:var(--pgs-dim)}
.pgs-log-body{padding:0 4px 16px;font-size:15.5px;color:var(--pgs-dim)}
.pgs-log-body p{margin:8px 0!important}
.pgs-log-body h3{margin:14px 0 6px!important;font-size:13px;letter-spacing:.6px;text-transform:uppercase;color:var(--pgs-accent)}
.pgs-log-body ul{padding-left:1.25em!important}
.pgs-log-body li{margin:6px 0}
.pgs-log-body strong{color:var(--pgs-fg)}
.pgs-log-body code{font:13px Consolas,Menlo,monospace;background:rgba(255,255,255,.08);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
.pgs-foot{margin-top:clamp(28px,5vw,44px)!important;padding-top:16px!important;border-top:1px solid var(--pgs-line);
  font-size:14px;color:var(--pgs-dim)}
@media (max-width:720px){.pgs-cols{grid-template-columns:1fr}.pgs-shot{max-width:340px;margin:0 auto}}
`
    .replace(/\n\s*/g, '')
    .trim();

/** Balises des aperçus de lien (réseaux sociaux, messageries) ; l'image demande l'adresse de la page */
const social = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="fr_FR">`,
    `<meta property="og:title" content="${TITLE}">`,
    `<meta property="og:description" content="${DESCRIPTION}">`,
    ...(SITE_URL
        ? [
              `<link rel="canonical" href="${SITE_URL}/">`,
              `<meta property="og:url" content="${SITE_URL}/">`,
              `<meta property="og:image" content="${SITE_URL}/${SHOT}">`,
          ]
        : []),
].join('\n');

const page = `<!doctype html>
<!-- PG Soundings ${version} : page fabriquée par scripts/site-page.mjs, ne pas la modifier à la main -->
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta name="theme-color" content="#16202c">
${social}
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🪂</text></svg>">
<style>${css}</style>
</head>
<body>
<main class="pgs">
<span class="pgs-tag">Plugin gratuit pour Windy.com</span>
<h1 class="pgs-title">PG <em>Soundings</em> 🪂</h1>
<p class="pgs-lead">La prévision du vol libre dans Windy : le vent et les thermiques, altitude par altitude et heure par heure, les nuages, les fronts, le risque d’orage et l’émagramme du lieu choisi.</p>
<div class="pgs-actions">
<a class="pgs-btn" href="#pgs-installer">Installer la version ${version}</a>
<a class="pgs-btn pgs-btn--ghost" href="#pgs-nouveautes">Nouveautés</a>
<a class="pgs-btn pgs-btn--ghost" href="${REPO}">Code source</a>
</div>
<div class="pgs-cols">
<div class="pgs-shot"><img src="${SHOT}" alt="Graphique altitude × heure de PG Soundings : flèches du vent, zone des thermiques, nuages d’averses et passage d’un front froid" loading="lazy"></div>
<ul class="pgs-features">
${FEATURES.map(([title, text]) => `<li><b>${title}</b><span>${text}</span></li>`).join('\n')}
</ul>
</div>

<h2 class="pgs-h" id="pgs-installer">Installer le plugin</h2>
<ol class="pgs-steps">
<li>Ouvre <a href="https://www.windy.com/plugins">windy.com/plugins</a>, connecté à ton compte Windy.</li>
<li>Choisis « Load plugin directly from URL » et colle ce lien à la place du texte déjà dans le champ :
<div class="pgs-link"><input type="text" readonly value="${installUrl}" onclick="this.select()" aria-label="Lien d’installation de PG Soundings ${version}"><button type="button" onclick="navigator.clipboard.writeText('${installUrl}').then(()=>{this.textContent='Copié ✓'})">Copier le lien</button></div></li>
<li>Clique sur un site de vol sur la carte : le plugin retient ton dernier lieu.</li>
</ol>
<p class="pgs-note">Le plugin signale ensuite lui-même les nouvelles versions. Il s’utilise sur ordinateur comme sur téléphone.</p>

<h2 class="pgs-h" id="pgs-nouveautes">Nouveautés</h2>
<div class="pgs-log">
${versions
    .map(
        (v, k) => `<details${k === 0 ? ' open' : ''}><summary>Version ${v.id}<small>${dateText(v.date)}</small></summary>
<div class="pgs-log-body">
${bodyHtml(v.body)}
</div></details>`,
    )
    .join('\n')}
</div>

<p class="pgs-foot">Des estimations tirées des modèles de prévision : rien ne remplace l’observation du ciel. PG Soundings est un plugin indépendant, gratuit et <a href="${REPO}">à code ouvert</a> ; la façon dont chaque estimation est calculée est décrite dans son <a href="${REPO}#readme">README</a>.</p>
</main>
</body>
</html>
`;

const out = path.join(root, 'site');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), page);
fs.copyFileSync(path.join(root, SHOT_SOURCE), path.join(out, SHOT));
console.log(
    `site/index.html : PG Soundings ${version}, ${versions.length} versions, ${(page.length / 1024).toFixed(0)} Ko` +
        (SITE_URL ? `, pour ${SITE_URL}` : ''),
);
