/**
 * Prévisions heure par heure même quand Windy ne les fournit que toutes les 3 heures (comptes sans
 * abonnement Premium, ou échéances lointaines).
 *
 * Les séries brutes sont interpolées avant tout calcul : plafond, thermiques et cumulus sont ensuite
 * calculés pour chaque heure avec la vraie hauteur du soleil, au lieu d'interpoler des résultats.
 * - grandeurs continues (températures, humidité, nuages, altitudes, vitesse du vent) : linéaire ;
 * - direction du vent : par le vecteur vent (350° → 10° passe par 0°, pas par 180°) ;
 * - précipitations : chez Windy, la valeur d'un pas est le cumul de la période qui le PRÉCÈDE (pluie
 *   « de l'heure écoulée »). Chaque heure reçoit ici la pluie de l'heure qui la SUIT, même quand la
 *   prévision est déjà horaire : la colonne « 15h » du graphique montre le ciel de 15 h et la pluie
 *   de 15 h à 16 h, au lieu de la pluie déjà tombée entre 14 h et 15 h. Le cumul d'un pas de 3 h
 *   est réparti sur ses 3 heures (pas de triple compte), et la série `precipStep` garde la durée
 *   du pas d'où vient chaque heure ;
 * - autres valeurs (jour/nuit, pictogrammes…) : pas de temps le plus proche.
 * Les séries `stepFrom` et `stepTo` gardent, pour chaque heure, les pas du modèle qui l'encadrent.
 */

import { type ForecastPayload, snowPart } from './physics';
import { localHour, makeOffsetAt } from './time';

type Hash = { [key: string]: unknown };

const HOUR = 3600e3;

/** Cumuls sur le pas de temps : à répartir, pas à interpoler (noms des séries Windy) */
const ACCUMULATED = new Set(['precipAmount', 'precipSnowAmount', 'precipConvectiveAmount', 'mm']);
/**
 * Codes (type de précipitation, pictogramme, phase de lune, jour/nuit) et repères du pas de temps
 * du modèle : pas le plus proche
 */
const CODES = new Set([
    'precipType',
    'icon',
    'icon2',
    'moonPhase',
    'isDay',
    'precipStep',
    'stepFrom',
    'stepTo',
]);
/** Clés recalculées à partir de l'heure (heure locale) */
const DERIVED = new Set(['ts', 'hour']);

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Clé de vitesse associée à une clé de direction : windDir → wind, windDir-850h → wind-850h */
const speedKeyOf = (dirKey: string) => dirKey.replace(/^windDir/, 'wind');

/**
 * Cumul (mm) de l'heure qui suit chaque instant de `hours` (croissants), à partir d'une série Windy
 * où la valeur d'un pas est le cumul de la période qui le précède : débit horaire du premier pas qui
 * se termine après l'instant. null au-delà du dernier pas (pluie pas encore prévue).
 * Vérifié sur ECMWF : mêmes valeurs, aux mêmes heures, que les cumuls « de l'heure écoulée » de la
 * même prévision publiés par une autre source.
 */
const followingHour = (src: number[], serie: unknown[], hours: number[]): (number | null)[] => {
    let j = 0;
    return hours.map(t => {
        while (j < src.length && src[j] <= t) j++;
        const v = serie[j];
        if (j >= src.length || !isNum(v)) return null;
        const stepMs = j > 0 ? src[j] - src[j - 1] : src[1] - src[0];
        return v / Math.max(1, stepMs / HOUR);
    });
};

const interpolateHash = (hash: Hash, offsetAt: (ts: number) => number): Hash => {
    const ts = hash.ts;
    if (!Array.isArray(ts) || ts.length < 2 || !ts.every(isNum)) return hash;
    const src = ts as number[];
    // Déjà horaire et calé sur les heures pleines : seuls les cumuls changent (heure qui suit)
    const onHour = (t: number) => t % HOUR === 0;
    if (src.every((t, i) => onHour(t) && (i === 0 || t - src[i - 1] <= HOUR))) {
        const shifted: Hash = { ...hash };
        for (const key of ACCUMULATED) {
            const serie = hash[key];
            if (Array.isArray(serie) && serie.length === src.length)
                shifted[key] = followingHour(src, serie, src);
        }
        return shifted;
    }

    // Grille des heures pleines (UTC) couvertes par la série. Le premier pas peut commencer à une
    // heure quelconque (« maintenant ») : on ne part pas de lui, sinon toutes les heures seraient
    // décalées et ne correspondraient plus aux données d'altitude
    const out: Hash = { ...hash };
    const hours: number[] = [];
    for (let t = Math.ceil(src[0] / HOUR) * HOUR; t <= src[src.length - 1]; t += HOUR)
        hours.push(t);
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
            out[key] = followingHour(src, serie, hours);
            continue;
        }

        if (CODES.has(key)) {
            out[key] = where.map(({ i, f }) =>
                f < 0.5 ? (serie[i] ?? serie[i + 1] ?? null) : (serie[i + 1] ?? serie[i] ?? null),
            );
            continue;
        }

        if (/^windDir/.test(key) && Array.isArray(hash[speedKeyOf(key)])) {
            const speed = hash[speedKeyOf(key)] as unknown[];
            out[key] = where.map(({ i, f }) => {
                const d0 = serie[i];
                const d1 = serie[i + 1];
                if (!isNum(d0) || !isNum(d1))
                    return f < 0.5 ? (d0 ?? d1 ?? null) : (d1 ?? d0 ?? null);
                // Vecteurs unitaires pondérés par la vitesse : la direction suit le vent le plus fort
                const s0 = isNum(speed[i]) ? Math.max(0.1, speed[i] as number) : 1;
                const s1 = isNum(speed[i + 1]) ? Math.max(0.1, speed[i + 1] as number) : 1;
                const r = Math.PI / 180;
                const x = (1 - f) * s0 * Math.sin(d0 * r) + f * s1 * Math.sin(d1 * r);
                const y = (1 - f) * s0 * Math.cos(d0 * r) + f * s1 * Math.cos(d1 * r);
                return (Math.atan2(x, y) / r + 360) % 360;
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

    // Durée (h) du pas d'où vient la pluie de chaque heure : 3 quand un cumul de 3 h a été réparti
    if (Array.isArray(hash.precipAmount)) {
        let j = 0;
        out.precipStep = hours.map(t => {
            while (j < src.length && src[j] <= t) j++;
            if (j >= src.length) return null;
            return Math.max(1, Math.round((j > 0 ? src[j] - src[j - 1] : src[1] - src[0]) / HOUR));
        });
    }

    // Pas de temps du modèle qui encadrent chaque heure (les deux sont égaux à une heure qu'il
    // fournit) : entre les deux, tout est interpolé, et l'heure d'un changement brusque n'est connue
    // qu'à la durée du pas près
    out.stepFrom = where.map(({ i, f }) => (f >= 1 ? src[i + 1] : src[i]));
    out.stepTo = where.map(({ i, f }) => (f <= 0 ? src[i] : src[i + 1]));

    out.ts = hours;
    if (Array.isArray(hash.hour)) out.hour = hours.map(t => localHour(t, offsetAt(t)));
    return out;
};

/**
 * Toutes les séries de la prévision (sol et altitude) ramenées au pas horaire si besoin.
 * En cas de souci, la prévision est rendue telle quelle : mieux vaut un pas de 3 h que rien.
 */
export const toHourly = (payload: ForecastPayload, lat: number, lon: number): ForecastPayload => {
    try {
        return interpolateAll(payload, makeOffsetAt(payload, lat, lon));
    } catch (e) {
        console.error('PG Soundings : interpolation horaire impossible', e);
        return payload;
    }
};

const interpolateAll = (
    payload: ForecastPayload,
    offsetAt: (ts: number) => number,
): ForecastPayload => {
    const res: ForecastPayload = {
        ...payload,
        data: interpolateHash(payload.data as Hash, offsetAt) as ForecastPayload['data'],
    };
    for (const k of ['sounding', 'airgram', 'meteogram'] as const) {
        const h = payload[k];
        if (h) res[k] = interpolateHash(h as Hash, offsetAt) as ForecastPayload['data'];
    }
    return res;
};

/**
 * Prévision réduite à un seul instant quelconque (à la minute près), par interpolation linéaire
 * entre les deux pas qui l'encadrent : sert au curseur de l'émagramme. Mêmes règles que ci-dessus
 * (vent par le vecteur, cumuls au pas qui contient l'instant, le reste au pas le plus proche). Ce
 * que le calcul d'une heure lit sur ses voisines l'accompagne : pluie des 24 h et neige des 48 h
 * précédentes, pluie et rafales les plus fortes autour de l'instant.
 * `payload` est une prévision déjà passée par toHourly : ses cumuls valent pour l'heure qui suit.
 */
export const payloadAt = (
    payload: ForecastPayload,
    t: number,
    lat: number,
    lon: number,
): ForecastPayload | null => {
    // Décalage horaire en vigueur à cet instant (changement d'heure compris)
    const offset = makeOffsetAt(payload, lat, lon)(t);
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
                const stepMs =
                    k < src.length - 1 ? src[k + 1] - src[k] : src[k] - src[k - 1] || HOUR;
                out[key] = [
                    isNum(serie[k]) ? (serie[k] as number) / Math.max(1, stepMs / HOUR) : null,
                ];
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
        if (Array.isArray(hash.hour)) out.hour = [localHour(t, offset)];
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
            // Pluie la plus forte (mm/h) du pas qui contient l'instant et de ceux à ±1 h (risque d'orage)
            let near = 0;
            allTs.forEach((ts, k) => {
                const end = k < allTs.length - 1 ? allTs[k + 1] : ts + HOUR;
                if (end > t - HOUR && ts <= t + HOUR && isNum(rain[k])) {
                    near = Math.max(near, (rain[k] as number) / Math.max(1, (end - ts) / HOUR));
                }
            });
            data.rainNear = [near];
            // Et neige des 48 h précédentes (sol enneigé)
            let snow = 0;
            const temp = (payload.data as Hash).temperature as unknown[] | undefined;
            allTs.forEach((ts, k) => {
                const tk = temp?.[k];
                if (ts >= t - 48 * HOUR && ts < t)
                    snow += snowPart(payload.data, k, isNum(tk) ? tk : 280);
            });
            data.recentSnow = [snow];
        }
        // Plus fortes rafales des heures qui encadrent l'instant et de leurs voisines : entre deux
        // heures pleines, le risque d'orage ne retombe pas faute de voir les rafales qu'elles voient
        const gust = (payload.data as Hash).windGust as unknown[] | undefined;
        if (Array.isArray(allTs) && Array.isArray(gust)) {
            let near = 0;
            allTs.forEach((ts, k) => {
                const g = gust[k];
                if (Math.abs(ts - t) < 2 * HOUR && isNum(g)) near = Math.max(near, g);
            });
            data.gustNear = [near];
        }
        return {
            ...payload,
            // L'instant isolé garde son propre décalage horaire
            header: { ...payload.header, utcOffset: offset },
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
