/**
 * Altitude de la carte de Windy : correspondance entre une altitude du graphique et les niveaux que
 * la carte sait afficher (sol, 100 m au-dessus du sol, niveaux de pression).
 */

import { type ProfilePoint, heightOfPressure, standardAltitude } from './physics';

/** Niveaux de la carte de Windy, du sol vers le haut */
export const MAP_LEVELS = [
    'surface',
    '100m',
    '975h',
    '950h',
    '925h',
    '900h',
    '850h',
    '800h',
    '700h',
    '600h',
    '500h',
    '400h',
    '300h',
    '250h',
    '200h',
    '150h',
] as const;

/** Hauteur (m) du niveau « 100 m » de la carte au-dessus du sol */
const NEAR_GROUND = 100;

/** Pression (hPa) d'un niveau de pression de la carte (« 850h ») ; null pour les autres */
const pressureOf = (level: string): number | null => {
    const m = /^(\d+)h$/.exec(level);
    return m ? Number(m[1]) : null;
};

/**
 * Altitude (m AMSL) d'un niveau de la carte dans le profil d'une heure (sol inclus, voir Column) :
 * le sol, 100 m au-dessus, ou l'altitude du niveau de pression. null pour un niveau inconnu, sous le
 * sol ou plus haut que le profil.
 */
export const altitudeOfLevel = (profile: ProfilePoint[], level: string): number | null => {
    const ground = profile[0].z;
    if (level === 'surface') return ground;
    if (level === '100m') return ground + NEAR_GROUND;
    const p = pressureOf(level);
    if (p == null || p >= profile[0].p) return null;
    return heightOfPressure(profile, p);
};

/**
 * Niveau de la carte le plus proche de l'altitude `z` (m AMSL) dans le profil d'une heure, parmi les
 * niveaux `available` (ceux que la carte propose pour la couche affichée). Les niveaux de pression
 * situés sous le sol du lieu sont écartés ; null si aucun niveau ne convient.
 */
export const levelOfAltitude = (
    profile: ProfilePoint[],
    z: number,
    available: readonly string[] = MAP_LEVELS,
): string | null => {
    const ground = profile[0].z;
    const height = (level: string): number | null => {
        if (level === 'surface') return ground;
        if (level === '100m') return ground + NEAR_GROUND;
        const p = pressureOf(level);
        if (p == null || p >= profile[0].p) return null;
        // Plus haut que le profil : altitude de l'atmosphère standard
        return heightOfPressure(profile, p) ?? standardAltitude(p);
    };
    let best: string | null = null;
    let gap = Infinity;
    for (const level of available) {
        const h = height(level);
        if (h == null) continue;
        const d = Math.abs(h - Math.max(z, ground));
        if (d < gap) {
            gap = d;
            best = level;
        }
    }
    return best;
};
