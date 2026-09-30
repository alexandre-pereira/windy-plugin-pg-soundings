/**
 * Prévisions heure par heure même quand Windy ne les fournit que toutes les 3 heures (comptes sans
 * abonnement Premium, ou échéances lointaines).
 *
 * Les séries brutes sont interpolées avant tout calcul : plafond, thermiques et cumulus sont ensuite
 * calculés pour chaque heure avec la vraie hauteur du soleil, au lieu d'interpoler des résultats.
 * - grandeurs continues (températures, humidité, nuages, altitudes, vitesse du vent) : linéaire ;
 * - direction du vent : par le vecteur vent (350° → 10° passe par 0°, pas par 180°) ;
 * - précipitations : le cumul d'un pas de 3 h est réparti sur ses 3 heures (pas de triple compte) ;
 *   chez Windy, l'horodatage d'un pas est son début : le cumul vaut pour les heures qui suivent ;
 * - autres valeurs (jour/nuit, pictogrammes…) : pas de temps le plus proche.
 */

import type { ForecastPayload } from './physics';

type Hash = { [key: string]: unknown };

const HOUR = 3600e3;

/** Cumuls sur le pas de temps : à répartir, pas à interpoler (noms des séries Windy) */
const ACCUMULATED = new Set(['precipAmount', 'precipSnowAmount', 'precipConvectiveAmount', 'mm']);
/** Codes (type de précipitation, pictogramme, phase de lune, jour/nuit) : pas le plus proche */
const CODES = new Set(['precipType', 'icon', 'icon2', 'moonPhase', 'isDay']);
/** Clés recalculées à partir de l'heure (heure locale) */
const DERIVED = new Set(['ts', 'hour']);

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Clé de vitesse associée à une clé de direction : windDir → wind, windDir-850h → wind-850h */
const speedKeyOf = (dirKey: string) => dirKey.replace(/^windDir/, 'wind');

const interpolateHash = (hash: Hash, utcOffset: number): Hash => {
    const ts = hash.ts;
    if (!Array.isArray(ts) || ts.length < 2 || !ts.every(isNum)) return hash;
    const src = ts as number[];
    // Déjà horaire et calé sur les heures pleines : rien à faire
    const onHour = (t: number) => t % HOUR === 0;
    if (src.every((t, i) => onHour(t) && (i === 0 || t - src[i - 1] <= HOUR))) return hash;

    // Grille des heures pleines (UTC) couvertes par la série. Le premier pas peut commencer à une
    // heure quelconque (« maintenant ») : on ne part pas de lui, sinon toutes les heures seraient
    // décalées et ne correspondraient plus aux données d'altitude
    const out: Hash = { ...hash };
    const hours: number[] = [];
    for (let t = Math.ceil(src[0] / HOUR) * HOUR; t <= src[src.length - 1]; t += HOUR) hours.push(t);
    if (hours.length < 2) return hash;

    // Pour chaque heure : pas de temps encadrant [i, i + 1] et position f entre les deux
    let seg = 0;
    const where = hours.map(t => {
        while (seg < src.length - 2 && src[seg + 1] < t) seg++;
        const span = src[seg + 1] - src[seg];
        const f = span > 0 ? Math.min(1, Math.max(0, (t - src[seg]) / span)) : 0;
        return { i: seg, f, t };
    });

    for (const [key, raw] of Object.entries(hash)) {
        if (DERIVED.has(key) || !Array.isArray(raw) || raw.length !== src.length) continue;
        const serie = raw as unknown[];

        if (ACCUMULATED.has(key)) {
            // Valeur de l'heure t = cumul du pas qui la contient (pas qui commence avant ou à t),
            // divisé par le nombre d'heures de ce pas
            out[key] = hours.map(t => {
                let j = 0;
                while (j < src.length - 1 && src[j + 1] <= t) j++;
                const v = serie[j];
                if (!isNum(v)) return null;
                const stepMs = j < src.length - 1 ? src[j + 1] - src[j] : src[j] - src[j - 1];
                return v / Math.max(1, stepMs / HOUR);
            });
            continue;
        }

        if (CODES.has(key)) {
            out[key] = where.map(({ i, f }) => (f < 0.5 ? (serie[i] ?? serie[i + 1] ?? null) : (serie[i + 1] ?? serie[i] ?? null)));
            continue;
        }

        if (/^windDir/.test(key) && Array.isArray(hash[speedKeyOf(key)])) {
            const speed = hash[speedKeyOf(key)] as unknown[];
            out[key] = where.map(({ i, f }) => {
                const d0 = serie[i];
                const d1 = serie[i + 1];
                if (!isNum(d0) || !isNum(d1)) return f < 0.5 ? (d0 ?? d1 ?? null) : (d1 ?? d0 ?? null);
                // Vecteurs unitaires pondérés par la vitesse : la direction suit le vent le plus fort
                const s0 = isNum(speed[i]) ? Math.max(0.1, speed[i] as number) : 1;
                const s1 = isNum(speed[i + 1]) ? Math.max(0.1, speed[i + 1] as number) : 1;
                const r = Math.PI / 180;
                const x = (1 - f) * s0 * Math.sin(d0 * r) + f * s1 * Math.sin(d1 * r);
                const y = (1 - f) * s0 * Math.cos(d0 * r) + f * s1 * Math.cos(d1 * r);
                return ((Math.atan2(x, y) / r) + 360) % 360;
            });
            continue;
        }

        out[key] = where.map(({ i, f }) => {
            const a = serie[i];
            const b = serie[i + 1];
            if (isNum(a) && isNum(b)) return a + (b - a) * f;
            // Valeur manquante d'un côté, ou non numérique : pas de temps le plus proche
            return f < 0.5 ? (a ?? b ?? null) : (b ?? a ?? null);
        });
    }

    out.ts = hours;
    if (Array.isArray(hash.hour)) out.hour = hours.map(t => new Date(t + utcOffset * HOUR).getUTCHours());
    return out;
};

/**
 * Toutes les séries de la prévision (sol et altitude) ramenées au pas horaire si besoin.
 * En cas de souci, la prévision est rendue telle quelle : mieux vaut un pas de 3 h que rien.
 */
export const toHourly = (payload: ForecastPayload): ForecastPayload => {
    try {
        return interpolateAll(payload);
    } catch (e) {
        console.error('PG Soundings : interpolation horaire impossible', e);
        return payload;
    }
};

const interpolateAll = (payload: ForecastPayload): ForecastPayload => {
    const offset = payload.header?.utcOffset || 0;
    const res: ForecastPayload = { ...payload, data: interpolateHash(payload.data as Hash, offset) as ForecastPayload['data'] };
    for (const k of ['sounding', 'airgram', 'meteogram'] as const) {
        const h = payload[k];
        if (h) res[k] = interpolateHash(h as Hash, offset) as ForecastPayload['data'];
    }
    return res;
};

/**
 * Prévision réduite à un seul instant quelconque (à la minute près), par interpolation linéaire
 * entre les deux pas qui l'encadrent : sert au curseur de l'émagramme. Mêmes règles que ci-dessus
 * (vent par le vecteur, cumuls au pas qui contient l'instant, le reste au pas le plus proche).
 */
export const payloadAt = (payload: ForecastPayload, t: number): ForecastPayload | null => {
    const offset = payload.header?.utcOffset || 0;
    const sample = (hash: Hash | undefined): Hash | undefined => {
        const ts = hash?.ts;
        if (!hash || !Array.isArray(ts) || !ts.length || !ts.every(isNum)) return hash;
        const src = ts as number[];
        if (t < src[0] || t > src[src.length - 1]) return undefined;
        let i = 0;
        while (i < src.length - 2 && src[i + 1] <= t) i++;
        const span = src[i + 1] - src[i];
        const f = src.length > 1 && span > 0 ? Math.min(1, Math.max(0, (t - src[i]) / span)) : 0;
        const j = src.length > 1 ? i + 1 : i;

        const out: Hash = {};
        for (const [key, raw] of Object.entries(hash)) {
            if (DERIVED.has(key) || !Array.isArray(raw) || raw.length !== src.length) continue;
            const serie = raw as unknown[];
            const a = serie[i];
            const b = serie[j];
            if (ACCUMULATED.has(key)) {
                // Débit horaire du pas qui contient l'instant
                const k = f >= 1 ? j : i;
                const stepMs = k < src.length - 1 ? src[k + 1] - src[k] : src[k] - src[k - 1] || HOUR;
                out[key] = [isNum(serie[k]) ? (serie[k] as number) / Math.max(1, stepMs / HOUR) : null];
            } else if (CODES.has(key)) {
                out[key] = [f < 0.5 ? (a ?? b ?? null) : (b ?? a ?? null)];
            } else if (/^windDir/.test(key) && isNum(a) && isNum(b)) {
                const speed = hash[speedKeyOf(key)] as unknown[] | undefined;
                const s0 = isNum(speed?.[i]) ? Math.max(0.1, speed![i] as number) : 1;
                const s1 = isNum(speed?.[j]) ? Math.max(0.1, speed![j] as number) : 1;
                const r = Math.PI / 180;
                const x = (1 - f) * s0 * Math.sin(a * r) + f * s1 * Math.sin(b * r);
                const y = (1 - f) * s0 * Math.cos(a * r) + f * s1 * Math.cos(b * r);
                out[key] = [(Math.atan2(x, y) / r + 360) % 360];
            } else if (isNum(a) && isNum(b)) {
                out[key] = [a + (b - a) * f];
            } else {
                out[key] = [f < 0.5 ? (a ?? b ?? null) : (b ?? a ?? null)];
            }
        }
        out.ts = [t];
        if (Array.isArray(hash.hour)) out.hour = [new Date(t + offset * HOUR).getUTCHours()];
        return out;
    };
    try {
        const data = sample(payload.data as Hash);
        if (!data) return null;
        // Pluie des 24 h précédentes (sol mouillé), que la prévision réduite à un instant n'a plus
        const allTs = (payload.data as Hash).ts as number[] | undefined;
        const rain = (payload.data as Hash).precipAmount as unknown[] | undefined;
        if (Array.isArray(allTs) && Array.isArray(rain)) {
            let sum = 0;
            allTs.forEach((ts, k) => {
                if (ts >= t - 24 * HOUR && ts < t && isNum(rain[k])) sum += rain[k] as number;
            });
            data.recentRain = [sum];
        }
        return {
            ...payload,
            data: data as ForecastPayload['data'],
            sounding: sample(payload.sounding as Hash) as ForecastPayload['data'] | undefined,
            airgram: sample(payload.airgram as Hash) as ForecastPayload['data'] | undefined,
            meteogram: sample(payload.meteogram as Hash) as ForecastPayload['data'] | undefined,
        };
    } catch (e) {
        console.error('PG Soundings : interpolation impossible', e);
        return null;
    }
};
