/**
 * Recherche d'une version plus récente du plugin sur windy-plugins.com.
 *
 * Un plugin installé par lien reste sur la version de ce lien : on regarde donc au démarrage si
 * une version suivante a été publiée (correctif, version mineure ou majeure), en avançant de
 * version en version jusqu'à la dernière. Le résultat est gardé quelques heures dans le navigateur.
 */

import config from './pluginConfig';

/** Identifiant Windy de l'auteur, dans l'adresse des versions publiées */
const AUTHOR_ID = '2727410';
const BASE = `https://windy-plugins.com/${AUTHOR_ID}/${config.name}`;
const CACHE_KEY = 'wpp-update-check';
const CACHE_MS = 6 * 3600e3;
/** Nombre maximal de versions parcourues (sécurité) */
const MAX_HOPS = 20;

export const installUrl = (version: string) => `${BASE}/${version}/plugin.min.js`;

const parse = (v: string) => v.split('.').map(n => Number(n) || 0) as [number, number, number];

/** Versions qui pourraient suivre `v` : correctif, mineure, majeure */
const nextCandidates = (v: string) => {
    const [a, b, c] = parse(v);
    return [`${a}.${b}.${c + 1}`, `${a}.${b + 1}.0`, `${a + 1}.0.0`];
};

const exists = async (version: string) => {
    try {
        const r = await fetch(`${BASE}/${version}/plugin.json`, { cache: 'no-store' });
        return r.ok;
    } catch {
        return false;
    }
};

/** Dernière version publiée si elle est plus récente que la version en cours, sinon null */
export const checkForUpdate = async (current: string = config.version): Promise<string | null> => {
    try {
        const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (saved && saved.from === current && Date.now() - saved.t < CACHE_MS) return saved.latest;
    } catch {
        /* stockage indisponible : on vérifie */
    }

    let latest: string = current;
    for (let hop = 0; hop < MAX_HOPS; hop++) {
        let found: string | null = null;
        // Les candidats sont testés du plus proche au plus lointain : le premier trouvé suffit
        for (const v of nextCandidates(latest)) {
            if (await exists(v)) {
                found = v;
                break;
            }
        }
        if (!found) break;
        latest = found;
    }
    const result = latest === current ? null : latest;

    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ from: current, latest: result, t: Date.now() }));
    } catch {
        /* stockage indisponible */
    }
    return result;
};
