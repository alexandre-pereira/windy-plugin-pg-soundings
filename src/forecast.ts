/**
 * Chargement des prévisions d'un point, commun au panneau et à la carte des cross.
 */

import { getPointForecastData } from '@windy/fetch';

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

export const loadForecast = async (
    model: string,
    lat: number,
    lon: number,
    include: Include,
    days = MAX_DAYS,
    options: BuildOptions = {},
): Promise<LoadedForecast> => {
    // Windy ne tient compte de `days` qu'avec un abonnement Premium ; sans lui, il sert 5 jours,
    // ou 7 avec `extended` (le maximum que son serveur accorde à un compte sans Premium)
    const query: Query = { lat, lon, step: 1, days, extended: days > FREE_DAYS };
    const { data } = await getPointForecastData(model as Model, query, include);
    // Heure par heure même si Windy ne donne qu'un pas de 3 h (compte sans Premium)
    const payload = toHourly(data as unknown as ForecastPayload, lat, lon);
    // Au-delà de l'échéance du modèle, Windy complète avec un autre modèle : ces heures-là ne sont
    // pas celles du modèle choisi, on ne les garde pas (jours affichés « Hors échéance »)
    const mergeStart = Date.parse(payload.header.merged?.mergedModelStart ?? '');
    const columns = buildColumns(payload, lat, lon, options).filter(c => !(c.ts >= mergeStart));
    return { payload, columns };
};
