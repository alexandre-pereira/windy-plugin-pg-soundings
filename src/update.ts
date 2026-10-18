/**
 * Recherche d'une version plus récente du plugin sur windy-plugins.com.
 *
 * Un plugin installé par lien reste sur la version de ce lien : on regarde donc au démarrage si
 * une version plus récente a été publiée, en avançant de version en version sur windy-plugins.com
 * (correctif, mineure, majeure) et en tolérant des numéros sautés, en MAX_PROBES requêtes au plus.
 * Seul windy-plugins.com est interrogé : aucun site extérieur à Windy ne voit passer l'utilisateur.
 * Le résultat est gardé quelques heures dans le navigateur.
 */

import config from './pluginConfig';

/** Identifiant Windy de l'auteur, dans l'adresse des versions publiées */
const AUTHOR_ID = '2727410';
const BASE = `https://windy-plugins.com/${AUTHOR_ID}/${config.name}`;
const CACHE_KEY = 'wpp-update-check';
const CACHE_MS = 6 * 3600e3;
/** Numéros sautés tolérés, de version en version : correctifs et mineures essayés au-delà du suivant */
const GAP = 3;
/**
 * Nombre maximal de requêtes vers windy-plugins.com par recherche, pour ne pas charger le site de
 * Windy. Les candidates étant essayées de la plus lointaine à la plus proche, chaque requête
 * positive saute le plus loin possible : un plugin à jour fait 7 requêtes, un plugin en retard de
 * plusieurs versions trouve en général la dernière dans ce nombre. S'il est très en retard, la
 * recherche s'arrête sur une version intermédiaire, déjà plus récente (le bandeau s'affiche), et la
 * recherche suivante, une fois le résultat gardé périmé, repart d'elle au lieu de tout reprendre.
 */
const MAX_PROBES = 10;

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

/**
 * Dernière version publiée si elle est plus récente que la version en cours, sinon null. Le
 * résultat n'est gardé que si le réseau a répondu : une panne passagère ne doit pas cacher une
 * version pendant des heures.
 */
export const checkForUpdate = async (current: string = config.version): Promise<string | null> => {
    /** Version plus récente trouvée par une recherche précédente : la recherche repart d'elle */
    let known: string | null = null;
    try {
        const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (saved && saved.from === current) {
            if (Date.now() - saved.t < CACHE_MS) return saved.latest;
            if (typeof saved.latest === 'string' && isNewer(saved.latest, current))
                known = saved.latest;
        }
    } catch {
        /* stockage indisponible : on vérifie */
    }

    let latest: string = known ?? current;
    let failed = false;

    let probes = 0;
    search: while (probes < MAX_PROBES) {
        let found: string | null = null;
        // De la plus lointaine à la plus proche : la première qui existe est la plus récente des
        // candidates, et celles qu'elle saute sont plus anciennes qu'elle (aucune n'est perdue :
        // les candidates de la plus récente couvrent tout ce qui suit les autres)
        for (const v of [...nextCandidates(latest)].reverse()) {
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
