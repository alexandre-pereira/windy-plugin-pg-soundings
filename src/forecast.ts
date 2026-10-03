/**
 * Chargement des prévisions d'un point, commun au panneau et à la carte des cross.
 */

import { getPointForecastData } from '@windy/fetch';

import { type AirMass, airMassOf } from './fronts';
import { toHourly } from './interpolate';
import { type BuildOptions, buildColumns, type Column, type ForecastPayload } from './physics';

type Include = Parameters<typeof getPointForecastData>[2];
type Model = Parameters<typeof getPointForecastData>[0];
/** `extended` : accepté par Windy, absent des types publiés */
type Query = Parameters<typeof getPointForecastData>[1] & { extended?: boolean };

/** Toute l'échéance du modèle : Windy ne sert pas plus de 15 jours */
export const MAX_DAYS = 15;
/** Sans `extended`, Windy s'arrête à 5 jours pour un compte sans Premium */
const FREE_DAYS = 5;

export interface LoadedForecast {
    payload: ForecastPayload;
    columns: Column[];
}

/** Prévision d'un point telle que Windy la donne, ramenée au pas horaire */
const loadPayload = async (
    model: string,
    lat: number,
    lon: number,
    include: Include,
    days: number,
) => {
    // Windy ne tient compte de `days` qu'avec un abonnement Premium ; sans lui, il sert 5 jours,
    // ou 7 avec `extended` (le maximum que son serveur accorde à un compte sans Premium)
    const query: Query = { lat, lon, step: 1, days, extended: days > FREE_DAYS };
    const { data } = await getPointForecastData(model as Model, query, include);
    // Heure par heure même si Windy ne donne qu'un pas de 3 h (compte sans Premium)
    return toHourly(data as unknown as ForecastPayload, lat, lon);
};

export const loadForecast = async (
    model: string,
    lat: number,
    lon: number,
    include: Include,
    days = MAX_DAYS,
    options: BuildOptions = {},
): Promise<LoadedForecast> => {
    const payload = await loadPayload(model, lat, lon, include, days);
    // Au-delà de l'échéance du modèle, Windy complète avec un autre modèle : ces heures-là ne sont
    // pas celles du modèle choisi, on ne les garde pas (jours affichés « Hors échéance »)
    const mergeStart = Date.parse(payload.header.merged?.mergedModelStart ?? '');
    const columns = buildColumns(payload, lat, lon, options).filter(c => !(c.ts >= mergeStart));
    return { payload, columns };
};

/** Distance (km) des points voisins du lieu, au nord, au sud, à l'est et à l'ouest, où la carte est lue */
const AROUND_KM = 55;
const KM_PER_DEG = 111.2;

/** Points voisins du lieu où lire la masse d'air : nord, sud, est, ouest */
export const surroundingPoints = (lat: number, lon: number): { lat: number; lon: number }[] => {
    const dLat = AROUND_KM / KM_PER_DEG;
    const dLon = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    return [
        { lat: lat + dLat, lon },
        { lat: lat - dLat, lon },
        { lat, lon: lon + dLon },
        { lat, lon: lon - dLon },
    ];
};

/** Point voisin du lieu : sa masse d'air (fronts lus sur la carte) et ses heures (orages voisins) */
export interface Surrounding {
    lat: number;
    lon: number;
    air: AirMass;
    columns: Column[];
}

/**
 * Points voisins du lieu : leur masse d'air, de quoi lire sur la carte les fronts qui le traversent
 * (voir mapFronts), et leurs heures, de quoi voir un orage qui se dirige vers lui (voir
 * nearbyStormOf). Un voisin qui ne répond pas, ou que Windy sert avec un autre modèle que `served`
 * (bord du domaine d'un modèle local), manque dans la liste.
 */
export const loadSurroundings = async (
    model: string,
    lat: number,
    lon: number,
    served: string,
    days = MAX_DAYS,
): Promise<Surrounding[]> => {
    const fields = await Promise.all(
        surroundingPoints(lat, lon).map(p =>
            loadPayload(model, p.lat, p.lon, { header: true, sounding: true }, days)
                .then(payload =>
                    payload.header.model === served
                        ? {
                              ...p,
                              air: airMassOf(payload, p.lat, p.lon),
                              columns: columnsOrNone(payload, p.lat, p.lon),
                          }
                        : null,
                )
                .catch(() => null),
        ),
    );
    return fields.filter((f): f is Surrounding => f != null);
};

/** Heures d'un point voisin ; aucune si sa prévision ne suffit pas à les calculer */
const columnsOrNone = (payload: ForecastPayload, lat: number, lon: number): Column[] => {
    try {
        return buildColumns(payload, lat, lon);
    } catch {
        return [];
    }
};
