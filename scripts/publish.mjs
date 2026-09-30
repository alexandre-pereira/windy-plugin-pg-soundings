// Publie le plugin sur les serveurs de Windy (équivalent du script manuel de la doc
// https://docs.windy-plugins.com/getting-started/publishing-plugin.html).
//
// La clé « Windy Plugins API » (https://api.windy.com/keys) est lue dans la variable
// d'environnement WINDY_API_KEY, ou à défaut dans le fichier .windy-api-key (ignoré par git).

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = path.join(root, '.windy-api-key');

const apiKey = (
    process.env.WINDY_API_KEY || (fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8') : '')
).trim();

if (!apiKey) {
    console.error(
        'Clé API introuvable. Créez une clé « Windy Plugins API » sur https://api.windy.com/keys,\n' +
            `puis collez-la seule dans le fichier ${keyFile}`,
    );
    process.exit(1);
}

console.log('Compilation...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

const dist = path.join(root, 'dist');
const manifestPath = path.join(dist, 'plugin.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Mêmes métadonnées que le script officiel (le projet n'est pas un dépôt git)
Object.assign(manifest, {
    repositoryName: manifest.name,
    commitSha: `v${manifest.version}`,
    repositoryOwner: manifest.author,
});
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.copyFileSync(path.join(root, 'package.json'), path.join(dist, 'package.json'));

console.log(`Création de l'archive de ${manifest.name} v${manifest.version}...`);
// Chemins relatifs : le tar GNU de Git Bash prendrait « C: » pour un hôte distant
const archive = path.join(root, 'plugin.tar');
execFileSync('tar', ['-cf', '../plugin.tar', '.'], { cwd: dist, stdio: 'inherit' });

console.log('Envoi à Windy...');
const form = new FormData();
form.append('plugin_archive', new Blob([fs.readFileSync(archive)]), 'plugin.tar');

const res = await fetch('https://node.windy.com/plugins/v1.0/upload', {
    method: 'POST',
    headers: { 'x-windy-api-key': apiKey },
    body: form,
});
const body = await res.text();
fs.rmSync(archive, { force: true });

if (!res.ok) {
    console.error(`Échec de la publication (HTTP ${res.status}) :\n${body}`);
    if (res.status === 409 || /version/i.test(body)) {
        console.error('\nAugmentez la version dans src/pluginConfig.ts (ex. 1.0.0 → 1.0.1) puis relancez.');
    }
    process.exit(1);
}

console.log(`\nPlugin publié ! Réponse de Windy :\n${body}`);
