/**
 * Orages des points voisins du lieu (ceux où la carte est lue pour les fronts) : un orage que le
 * modèle prévoit à quelques dizaines de kilomètres et que le vent pousse vers le lieu, alors qu'il
 * n'en prévoit pas sur le lieu lui-même. Son front de rafales arrive avant lui.
 */

import type { Column } from './physics';

const HOUR = 3600e3;
const KM_PER_DEG = 111.2;

/** Prévision d'un point voisin du lieu */
export interface Neighbour {
    lat: number;
    lon: number;
    columns: Column[];
}

export interface NearbyStorm {
    /** 2 : orage probable ; 3 : orage violent possible */
    level: 2 | 3;
    /** Heure de l'orage au point voisin */
    at: Column;
    /** Distance (km) du point voisin, et direction (°) où il se trouve vu du lieu */
    distance: number;
    bearing: number;
    /** Vitesse de déplacement de l'orage (m/s) : vent moyen du sol à 6 km au point voisin */
    speed: number;
    /** Heure (timestamp) où l'orage atteindrait le lieu à cette vitesse */
    arrival: number;
}

/**
 * Heures locales surveillées (comme l'alerte d'orage du lieu), vitesse (m/s) en dessous de laquelle
 * un orage ne va nulle part (10 km/h), écart maximal (°) entre son déplacement et la direction du
 * lieu, et heures après son arrivée pendant lesquelles un orage prévu sur le lieu en tient lieu
 */
const NEARBY = { hours: [8, 22], minSpeed: 10 / 3.6, cone: 45, own: 2 };

/**
 * Premier orage d'un point voisin qui se dirige vers le lieu (`lat`, `lon`) pendant la journée
 * `cols` (ses heures, dans l'ordre), hors des heures déjà passées à `nowTs` ; null s'il n'y en a pas.
 * Un orage voisin compte quand le vent qui le déplace (au moins 10 km/h) pointe vers le lieu à 45°
 * près, et que le modèle ne prévoit pas d'orage sur le lieu lui-même entre l'heure de l'orage et
 * 2 h après son arrivée : sinon l'alerte d'orage du lieu le dit déjà.
 */
export const nearbyStormOf = (
    lat: number,
    lon: number,
    cols: Column[],
    around: Neighbour[],
    nowTs = 0,
): NearbyStorm | null => {
    const here = new Map(cols.map(c => [c.ts, c]));
    const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    let best: NearbyStorm | null = null;
    for (const nb of around) {
        // Du point voisin vers le lieu (km vers l'est et vers le nord)
        const dx = (lon - nb.lon) * KM_PER_DEG * cosLat;
        const dy = (lat - nb.lat) * KM_PER_DEG;
        const distance = Math.hypot(dx, dy);
        if (distance < 1) continue;
        for (const c of nb.columns) {
            const hour = here.get(c.ts)?.hour;
            if (c.stormRisk < 2 || hour == null || c.ts + HOUR <= nowTs) continue;
            if (hour < NEARBY.hours[0] || hour > NEARBY.hours[1]) continue;
            const speed = Math.hypot(c.steerU, c.steerV);
            const along = (c.steerU * dx + c.steerV * dy) / distance;
            if (speed < NEARBY.minSpeed || along < speed * Math.cos((NEARBY.cone * Math.PI) / 180))
                continue;
            const arrival = c.ts + (distance / (along * 3.6)) * HOUR;
            if (
                cols.some(
                    o =>
                        o.stormRisk >= 2 &&
                        o.ts >= c.ts - HOUR &&
                        o.ts <= arrival + NEARBY.own * HOUR,
                )
            )
                continue;
            if (
                best &&
                (best.arrival < arrival || (best.arrival === arrival && best.level >= c.stormRisk))
            )
                continue;
            best = {
                level: c.stormRisk === 3 ? 3 : 2,
                at: c,
                distance,
                bearing: ((Math.atan2(-dx, -dy) * 180) / Math.PI + 360) % 360,
                speed,
                arrival,
            };
        }
    }
    return best;
};
