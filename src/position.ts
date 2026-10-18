/**
 * Dernier lieu choisi, gardé dans le navigateur pour rouvrir le plugin dessus.
 *
 * Il est gardé dans le `localStorage` du site windy.com : Windy et les autres plugins peuvent le
 * lire. Un lieu choisi sur la carte y est gardé tel quel ; la position de l'appareil (géolocalisation)
 * n'y est gardée qu'arrondie à 0,01° (environ 1 km), comme dans l'adresse de la page. Le bouton
 * « Oublier le dernier lieu » des réglages l'efface.
 */

import type { LatLon } from '@windy/interfaces';

const LAST_LOC_KEY = 'wpp-last-location';

/** Pas de l'arrondi (°) de la position de l'appareil : 0,01°, environ 1 km (1,1 km en latitude) */
const COARSE = 100;

/** Position arrondie à 0,01° près (environ 1 km), pour ne garder ni publier la position exacte */
export const coarsePosition = ({ lat, lon }: LatLon): LatLon => ({
    // `|| 0` : pas de « -0 » pour une position arrondie à zéro
    lat: Math.round(lat * COARSE) / COARSE || 0,
    lon: Math.round(lon * COARSE) / COARSE || 0,
});

/** Garde le dernier lieu ; arrondi (coarsePosition) s'il vient de la géolocalisation */
export const saveLastLocation = (at: LatLon, fromDevice: boolean) => {
    const { lat, lon } = fromDevice ? coarsePosition(at) : at;
    try {
        localStorage.setItem(LAST_LOC_KEY, JSON.stringify({ lat, lon }));
    } catch {
        /* stockage indisponible */
    }
};

/** Dernier lieu gardé ; null s'il n'y en a pas */
export const lastLocation = (): LatLon | null => {
    try {
        const saved = JSON.parse(localStorage.getItem(LAST_LOC_KEY) || 'null');
        return saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)
            ? { lat: saved.lat, lon: saved.lon }
            : null;
    } catch {
        return null;
    }
};

/** Efface le dernier lieu gardé */
export const forgetLastLocation = () => {
    try {
        localStorage.removeItem(LAST_LOC_KEY);
    } catch {
        /* stockage indisponible */
    }
};
