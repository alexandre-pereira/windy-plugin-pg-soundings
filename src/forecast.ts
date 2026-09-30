/**
 * Chargement des prévisions d'un point, commun au panneau et à la carte des Vz.
 */

import { getPointForecastData } from '@windy/fetch';

import { toHourly } from './interpolate';
import { buildColumns, type Column, type ForecastPayload } from './physics';

type Include = Parameters<typeof getPointForecastData>[2];
type Model = Parameters<typeof getPointForecastData>[0];

export interface LoadedForecast {
    payload: ForecastPayload;
    columns: Column[];
}

export const loadForecast = async (
    model: string,
    lat: number,
    lon: number,
    include: Include,
    days?: number,
    keepHour?: (hour: number) => boolean,
): Promise<LoadedForecast> => {
    const { data } = await getPointForecastData(model as Model, { lat, lon, step: 1, days }, include);
    // Heure par heure même si Windy ne donne qu'un pas de 3 h (compte sans Premium)
    const payload = toHourly(data as unknown as ForecastPayload);
    return { payload, columns: buildColumns(payload, lat, lon, keepHour) };
};
