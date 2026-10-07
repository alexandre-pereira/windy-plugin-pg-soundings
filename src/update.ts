/**
 * Recherche d'une version plus récente du plugin sur windy-plugins.com.
 *
 * Un plugin installé par lien reste sur la version de ce lien : on regarde donc au démarrage si
 * une version plus récente a été publiée. La dernière version est demandée à GitHub (dernière
 * release du dépôt, une seule requête), puis vérifiée sur windy-plugins.com : une version annoncée
 * doit pouvoir s'installer. Sans réponse de GitHub, on avance de version en version sur
 * windy-plugins.com (correctif, mineure, majeure), en tolérant un numéro sauté. Le résultat est
 * gardé quelques heures dans le navigateur.
 */

import config from './pluginConfig';

/** Identifiant Windy de l'auteur, dans l'adresse des versions publiées */
const AUTHOR_ID = '2727410';
const BASE = `https://windy-plugins.com/${AUTHOR_ID}/${config.name}`;
/** Dernière release du dépôt GitHub (voir « Publier une version » dans CLAUDE.md) */
const LATEST_RELEASE =
    'https://api.github.com/repos/alexandre-pereira/windy-plugin-pg-soundings/releases/latest';
const CACHE_KEY = 'wpp-update-check';
const CACHE_MS = 6 * 3600e3;
/** Numéros sautés tolérés, de version en version : correctifs et mineures essayés au-delà du suivant */
const GAP = 3;
/** Nombre maximal de requêtes vers windy-plugins.com (sécurité) */
const MAX_PROBES = 60;

export const installUrl = (version: string) => `${BASE}/${version}/plugin.min.js`;

const parse = (v: string) => v.split('.').map(n => Number(n) || 0) as [number, number, number];

/** `a` est-elle plus récente que `b` ? */
export const isNewer = (a: string, b: string): boolean => {
    const [pa, pb] = [parse(a), parse(b)];
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
    return false;
};

/**
 * Versions qui pourraient suivre `v`, de la plus proche à la plus lointaine : correctifs, mineures
 * (en tolérant GAP numéros sautés, une publication refusée par Windy laisse un trou), majeure
 */
export const nextCandidates = (v: string): string[] => {
    const [a, b, c] = parse(v);
    const out: string[] = [];
    for (let k = 1; k <= GAP; k++) out.push(`${a}.${b}.${c + k}`);
    for (let k = 1; k <= GAP; k++) out.push(`${a}.${b + k}.0`);
    out.push(`${a + 1}.0.0`);
    return out;
};

/** Réponse d'une sonde : la version existe, n'existe pas, ou le réseau n'a pas répondu */
type Probe = 'yes' | 'no' | 'error';

const exists = async (version: string): Promise<Probe> => {
    try {
        const r = await fetch(`${BASE}/${version}/plugin.json`, { cache: 'no-store' });
        return r.ok ? 'yes' : 'no';
    } catch {
        return 'error';
    }
};

/** Version de la dernière release GitHub (étiquette `vX.Y.Z`), null sans réponse */
const latestRelease = async (): Promise<string | null> => {
    try {
        const r = await fetch(LATEST_RELEASE, { cache: 'no-store' });
        if (!r.ok) return null;
        const tag = String((await r.json()).tag_name ?? '');
        const m = /^v?(\d+\.\d+\.\d+)$/.exec(tag);
        return m ? m[1] : null;
    } catch {
        return null;
    }
};

/**
 * Dernière version publiée si elle est plus récente que la version en cours, sinon null. Le
 * résultat n'est gardé que si le réseau a répondu : une panne passagère ne doit pas cacher une
 * version pendant des heures.
 */
export const checkForUpdate = async (current: string = config.version): Promise<string | null> => {
    try {
        const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (saved && saved.from === current && Date.now() - saved.t < CACHE_MS) return saved.latest;
    } catch {
        /* stockage indisponible : on vérifie */
    }

    let latest: string = current;
    let failed = false;

    // GitHub d'abord : la dernière release, vérifiée sur windy-plugins.com
    const release = await latestRelease();
    if (release && isNewer(release, current)) {
        const probe = await exists(release);
        if (probe === 'yes') latest = release;
        failed = probe === 'error';
    }

    // Sinon, de version en version sur windy-plugins.com
    if (latest === current && !failed) {
        let probes = 0;
        search: while (probes < MAX_PROBES) {
            let found: string | null = null;
            for (const v of nextCandidates(latest)) {
                if (probes++ >= MAX_PROBES) break;
                const probe = await exists(v);
                if (probe === 'error') {
                    failed = true;
                    break search;
                }
                if (probe === 'yes') {
                    found = v;
                    break;
                }
            }
            if (!found) break;
            latest = found;
        }
    }
    const result = latest === current ? null : latest;

    if (!failed) {
        try {
            localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({ from: current, latest: result, t: Date.now() }),
            );
        } catch {
            /* stockage indisponible */
        }
    }
    return result;
};
