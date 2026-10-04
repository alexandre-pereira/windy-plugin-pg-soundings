/**
 * Lieux favoris : ceux du compte Windy de l'utilisateur. Le plugin n'a pas sa propre liste : un lieu
 * ajouté ici se retrouve dans les favoris de Windy (et sur ses autres appareils), et inversement.
 */

import * as userFavs from '@windy/userFavs';

import type { LatLon } from '@windy/interfaces';

export interface Favorite {
    id: string;
    title: string;
    lat: number;
    lon: number;
}

/** Écart (°) sous lequel un lieu est celui d'un favori : le critère de Windy, environ 1 km */
const NEAR = 0.01;

/**
 * Favoris qui désignent un lieu (les itinéraires sont laissés de côté), ceux que l'utilisateur a
 * épinglés en tête dans Windy d'abord, puis par ordre alphabétique
 */
export const loadFavorites = async (): Promise<Favorite[]> => {
    const all = await userFavs.getAll();
    return all
        .filter(f => f.type !== 'route' && !!f.title)
        .map(f => ({
            id: f.id,
            title: f.title,
            lat: Number(f.lat),
            lon: Number(f.lon),
            pin: f.pin2top ?? 0,
        }))
        .filter(f => Number.isFinite(f.lat) && Number.isFinite(f.lon))
        .sort((a, b) => b.pin - a.pin || a.title.localeCompare(b.title))
        .map(({ id, title, lat, lon }) => ({ id, title, lat, lon }));
};

/** Favori posé sur le lieu `at` ; null s'il n'y en a pas */
export const favoriteAt = (favorites: Favorite[], at: LatLon | null): Favorite | null =>
    (at &&
        favorites.find(f => Math.abs(f.lat - at.lat) < NEAR && Math.abs(f.lon - at.lon) < NEAR)) ||
    null;

export const addFavorite = (title: string, at: LatLon) =>
    userFavs.add({ type: 'fav', title, lat: at.lat, lon: at.lon });

export const removeFavorite = (id: string) => userFavs.remove(id);
