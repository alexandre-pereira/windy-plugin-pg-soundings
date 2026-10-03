/**
 * Heure locale du lieu de la prévision, changement d'heure compris.
 *
 * Windy ne donne qu'un décalage horaire (`header.utcOffset`) pour toute la prévision. Quand elle
 * couvre un passage à l'heure d'hiver ou d'été (fin mars, fin octobre), les jours suivants seraient
 * décalés d'une heure (axe des heures, jours). On corrige, dans l'ordre :
 * 1. avec l'heure locale donnée par Windy pour chaque pas (`data.hour`), si elle en tient compte ;
 * 2. sinon, en Europe, avec la règle européenne (dernier dimanche de mars et d'octobre à 1 h UTC).
 */

import type { ForecastPayload } from './physics';

const HOUR = 3600e3;

/** Dernier dimanche du mois (0-11), à 1 h UTC */
const lastSunday1hUtc = (year: number, month: number) => {
    const last = new Date(Date.UTC(year, month + 1, 0));
    return Date.UTC(year, month, last.getUTCDate() - last.getUTCDay(), 1);
};

/** Heure d'été européenne en vigueur à l'instant ts */
export const euSummerTime = (ts: number) => {
    const y = new Date(ts).getUTCFullYear();
    return ts >= lastSunday1hUtc(y, 2) && ts < lastSunday1hUtc(y, 9);
};

/**
 * Pays d'Europe qui changent d'heure, approximativement : on écarte l'Islande, le Maghreb, la
 * Turquie, la Biélorussie et la Russie (sans changement d'heure)
 */
export const inEuDstZone = (lat: number, lon: number) => {
    if (lat < 35.8 || lat > 71.5 || lon < -10.7 || lon > 29.7) return false;
    if (lat < 37.35 && lon > -2.2 && lon < 11.2) return false; // Algérie, Tunisie
    if (lat < 42.1 && lon > 26.6) return false; // Turquie
    if (lat > 51.6 && lat < 56.2 && lon > (lat < 53.9 ? 23.6 : 26.7)) return false; // Biélorussie
    if (lat > 54.3 && lat < 55.3 && lon > 19.6 && lon < 22.9) return false; // Kaliningrad
    if (lat >= 56.2 && lat < 61.3 && lon > 28) return false; // Russie (Pskov, Saint-Pétersbourg)
    return true;
};

/** Heure locale (0-23) de l'instant ts pour un décalage donné (h) */
export const localHour = (ts: number, offset: number) => new Date(ts + offset * HOUR).getUTCHours();

/** Clé de jour local (même format partout : liste des jours, heure actuelle, fronts) */
export const dayKey = (ts: number, offset: number) => {
    const d = new Date(ts + offset * HOUR);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
};

/** Décalage horaire (h) du lieu à chaque instant, pour une prévision */
export const makeOffsetAt = (
    payload: ForecastPayload,
    lat: number,
    lon: number,
): ((ts: number) => number) => {
    const base = payload.header?.utcOffset || 0;
    const ts = (payload.data?.ts || []) as number[];
    const hours = payload.data?.hour;

    // 1. Heure locale de Windy : écart d'une ou deux heures entières avec le décalage de l'en-tête
    const steps: { t: number; off: number }[] = [];
    let shifted = false;
    ts.forEach((t, i) => {
        const h = hours?.[i];
        if (typeof h !== 'number' || !Number.isFinite(h) || !Number.isFinite(t)) return;
        const delta = ((((h - localHour(t, base)) % 24) + 36) % 24) - 12;
        const d = Math.abs(delta) <= 2 ? delta : 0;
        if (d) shifted = true;
        steps.push({ t, off: base + d });
    });
    if (shifted) {
        // Décalage du dernier pas qui commence avant l'instant demandé
        return (t: number) => {
            let off = steps[0].off;
            for (const s of steps) {
                if (s.t > t) break;
                off = s.off;
            }
            return off;
        };
    }

    // 2. Règle européenne, à partir du décalage en vigueur au début de la prévision
    if (ts.length && inEuDstZone(lat, lon)) {
        const summerAtStart = euSummerTime(ts[0]);
        return (t: number) => {
            const summer = euSummerTime(t);
            return summer === summerAtStart ? base : base + (summer ? 1 : -1);
        };
    }
    return () => base;
};
