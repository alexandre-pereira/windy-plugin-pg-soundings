/**
 * Relief autour du point choisi : le modèle ne connaît que l'altitude moyenne de sa maille, le
 * graphique a besoin de savoir jusqu'où montent les crêtes voisines (nuages accrochés, ondes).
 * L'altitude du terrain est lue auprès de Windy sur trois cercles autour du point.
 */

import { getElevation } from '@windy/fetch';

/** Rayons (km) des cercles et nombre de directions par cercle */
const RINGS_KM = [3, 6, 10];
const DIRECTIONS = 8;
/** Hauteur (m) au-dessus du sol du modèle à partir de laquelle on parle de relief */
const RELIEF_MIN = 300;

const KM_PER_DEG = 111.2;

/** Points où lire l'altitude : `DIRECTIONS` par cercle, décalés d'un demi-pas d'un cercle au suivant */
export const reliefPoints = (lat: number, lon: number): { lat: number; lon: number }[] =>
    RINGS_KM.flatMap((km, ring) =>
        Array.from({ length: DIRECTIONS }, (_, k) => {
            const angle = ((k + ring / 2) / DIRECTIONS) * 2 * Math.PI;
            return {
                lat: lat + (km * Math.cos(angle)) / KM_PER_DEG,
                lon:
                    lon +
                    (km * Math.sin(angle)) /
                        (KM_PER_DEG * Math.max(0.2, Math.cos((lat * Math.PI) / 180))),
            };
        }),
    );

/**
 * Altitude des crêtes voisines (m AMSL) : le plus haut des points lus, s'il dépasse d'au moins 300 m
 * le sol du modèle. null en plaine, ou quand trop peu de points ont répondu (moins de la moitié).
 * Les sommets passent entre les points : c'est le niveau des crêtes, pas celui du plus haut sommet.
 */
export const crestOf = (elevations: (number | null)[], ground: number): number | null => {
    const known = elevations.filter((v): v is number => v != null && Number.isFinite(v));
    if (known.length * 2 < elevations.length) return null;
    const crest = Math.max(...known);
    return crest - ground >= RELIEF_MIN ? Math.round(crest) : null;
};

const cache = new Map<string, Promise<(number | null)[]>>();

/** Altitudes du terrain autour du point (voir reliefPoints), gardées en mémoire par lieu */
export const loadRelief = (lat: number, lon: number): Promise<(number | null)[]> => {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    let pending = cache.get(key);
    if (!pending) {
        pending = Promise.all(
            reliefPoints(lat, lon).map(p =>
                getElevation(p.lat, p.lon)
                    .then(r => (typeof r.data === 'number' ? r.data : null))
                    .catch(() => null),
            ),
        );
        cache.set(key, pending);
    }
    return pending;
};
