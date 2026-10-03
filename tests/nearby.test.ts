import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { surroundingPoints } from '../src/forecast';
import { toHourly } from '../src/interpolate';
import { nearbyStormOf, type Neighbour } from '../src/nearby';
import { buildColumns, type Column, type ForecastPayload, type StormRisk } from '../src/physics';
import { dayKey } from '../src/time';

const HOUR = 3600e3;
const KMH = 1 / 3.6;
const SITE = { lat: 45.78, lon: 6.22 };

/** Une journée de la prévision ECMWF réelle de Doussard (30/09/2026), sans orage */
const payload = JSON.parse(
    readFileSync(new URL('./fixtures/doussard.json', import.meta.url), 'utf8'),
) as ForecastPayload;
const all = buildColumns(toHourly(payload, SITE.lat, SITE.lon), SITE.lat, SITE.lon).map(
    (c): Column => ({ ...c, stormRisk: 0, steerU: 0, steerV: 0 }),
);
const keys = [...new Set(all.map(c => dayKey(c.ts, c.utcOffset)))];
const day = all.filter(c => dayKey(c.ts, c.utcOffset) === keys[1]);
const at = (hour: number) => day.find(c => c.hour === hour)!;

const [north, south, east, west] = surroundingPoints(SITE.lat, SITE.lon);
/** Point voisin où un orage (`risk`) est prévu à l'heure `hour`, poussé par un vent (m/s vers l'est et le nord) */
const stormy = (
    point: { lat: number; lon: number },
    hour: number,
    [steerU, steerV]: [number, number],
    risk: StormRisk = 2,
): Neighbour => ({
    ...point,
    columns: day.map(c => (c.hour === hour ? { ...c, stormRisk: risk, steerU, steerV } : c)),
});

describe('orage d’un point voisin', () => {
    it('orage à l’ouest poussé par un vent d’ouest : il se dirige vers le lieu', () => {
        const storm = nearbyStormOf(SITE.lat, SITE.lon, day, [stormy(west, 14, [40 * KMH, 0])])!;
        expect(storm.level).toBe(2);
        expect(storm.at.hour).toBe(14);
        expect(storm.distance).toBeCloseTo(55, 0);
        expect(storm.bearing).toBeCloseTo(270, 0);
        expect(storm.speed).toBeCloseTo(40 * KMH, 6);
        // 55 km à 40 km/h : un peu plus de 1 h 20 après
        expect(storm.arrival - at(14).ts).toBeCloseTo((55 / 40) * HOUR, -5);
    });

    it('rien si le vent l’emmène ailleurs, s’il est presque immobile, ou sans orage', () => {
        const none = (around: Neighbour[]) => nearbyStormOf(SITE.lat, SITE.lon, day, around);
        // Vent d'est à l'ouest du lieu : l'orage s'éloigne ; vent de sud : il passe à côté
        expect(none([stormy(west, 14, [-40 * KMH, 0])])).toBeNull();
        expect(none([stormy(west, 14, [0, 40 * KMH])])).toBeNull();
        expect(none([stormy(west, 14, [5 * KMH, 0])])).toBeNull();
        expect(none([stormy(west, 14, [40 * KMH, 0], 1)])).toBeNull();
        expect(none([])).toBeNull();
        // À 45° près : un vent d'ouest-sud-ouest compte encore, un vent de sud-ouest franc aussi
        expect(none([stormy(west, 14, [35 * KMH, 20 * KMH])])).not.toBeNull();
    });

    it('rien la nuit, dans les heures passées, ou quand le lieu a déjà son orage', () => {
        const around = [stormy(west, 14, [40 * KMH, 0])];
        expect(nearbyStormOf(SITE.lat, SITE.lon, day, [stormy(west, 3, [40 * KMH, 0])])).toBeNull();
        expect(nearbyStormOf(SITE.lat, SITE.lon, day, around, at(16).ts)).toBeNull();
        expect(nearbyStormOf(SITE.lat, SITE.lon, day, around, at(14).ts)).not.toBeNull();
        // Orage prévu sur le lieu à 15 h : son alerte le dit déjà
        const own = day.map(c => (c.hour === 15 ? { ...c, stormRisk: 2 as StormRisk } : c));
        expect(nearbyStormOf(SITE.lat, SITE.lon, own, around)).toBeNull();
    });

    it('plusieurs voisins : le premier à arriver, de n’importe quel côté', () => {
        const storm = nearbyStormOf(SITE.lat, SITE.lon, day, [
            stormy(west, 16, [40 * KMH, 0]),
            stormy(south, 13, [0, 30 * KMH], 3),
            stormy(north, 12, [0, 30 * KMH]),
            stormy(east, 12, [30 * KMH, 0]),
        ])!;
        expect(storm.at.hour).toBe(13);
        expect(storm.level).toBe(3);
        expect(storm.bearing).toBeCloseTo(180, 0);
    });
});
