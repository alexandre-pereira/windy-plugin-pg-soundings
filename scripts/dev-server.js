import { createServer } from 'node:https';
import { readFile } from 'node:fs';
import path from 'node:path';

/** Les pages qui chargent le plugin en développement : le mode développeur de Windy. */
const ORIGINS = new Set(['https://www.windy.com', 'https://windy.com']);

const TYPES = {
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
};

/**
 * Le fichier de `root` que demande `url`, ou null s'il en sortirait. Une barre oblique inverse, un octet nul ou un
 * « .. » qui remonte au-dessus de `root` sont refusés : sous Windows, `%5C` (« \ ») échappe à la normalisation POSIX
 * de l'adresse mais compte comme séparateur pour le disque, et menait n'importe où sur le disque.
 */
export function resolveInside(root, url) {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(url, 'https://localhost').pathname);
    } catch {
        return null;
    }
    if (pathname.includes('\\') || pathname.includes('\0')) {
        return null;
    }
    const base = path.resolve(root);
    const file = path.resolve(base, '.' + path.posix.normalize(pathname));
    return file.startsWith(base + path.sep) ? file : null;
}

/**
 * Sert `dir` en HTTPS sur localhost pendant `rollup -w`, pour le mode développeur de Windy. À la place de
 * rollup-plugin-serve (amené par @windycom/plugin-devtools), qui écoutait sur tout le réseau, répondait à toute origine
 * et laissait sortir du dossier : n'importe quel appareil du Wi-Fi ou page visitée lisait les fichiers du poste, dont
 * la clé d'API Windy.
 */
export function devServer({ dir, port, key, cert }) {
    let started = false;
    return {
        name: 'dev-server',
        writeBundle() {
            if (started) {
                return;
            }
            started = true;
            createServer({ key, cert }, (req, res) => {
                const origin = req.headers.origin;
                if (origin && ORIGINS.has(origin)) {
                    res.setHeader('Access-Control-Allow-Origin', origin);
                    res.setHeader('Access-Control-Allow-Private-Network', 'true');
                    res.setHeader('Vary', 'Origin');
                }
                if (req.method === 'OPTIONS') {
                    res.writeHead(204).end();
                    return;
                }
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    res.writeHead(405).end();
                    return;
                }
                const file = resolveInside(dir, req.url ?? '/');
                if (!file) {
                    res.writeHead(403).end();
                    return;
                }
                readFile(file, (err, data) => {
                    if (err) {
                        res.writeHead(404).end();
                        return;
                    }
                    res.writeHead(200, {
                        'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
                        'Cache-Control': 'no-store',
                    });
                    res.end(req.method === 'HEAD' ? undefined : data);
                });
            }).listen(port, 'localhost', () => console.log(`Plugin servi sur https://localhost:${port}/plugin.js`));
        },
    };
}
