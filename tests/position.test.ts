import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { coarsePosition, forgetLastLocation, lastLocation, saveLastLocation } from '../src/position';

describe('dernier lieu gardé', () => {
    let store: Map<string, string>;
    beforeEach(() => {
        store = new Map();
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, v),
            removeItem: (k: string) => void store.delete(k),
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('arrondit une position à 0,01° (environ 1 km)', () => {
        expect(coarsePosition({ lat: 45.81234, lon: 6.21789 })).toEqual({ lat: 45.81, lon: 6.22 });
        expect(coarsePosition({ lat: -33.86882, lon: 151.20929 })).toEqual({ lat: -33.87, lon: 151.21 });
        // Pas de « -0 »
        expect(Object.is(coarsePosition({ lat: -0.001, lon: -0.004 }).lat, 0)).toBe(true);
        // Jamais plus de ~0,005° (550 m) d'écart
        for (let k = 0; k < 200; k++) {
            const p = { lat: Math.random() * 180 - 90, lon: Math.random() * 360 - 180 };
            const c = coarsePosition(p);
            expect(Math.abs(c.lat - p.lat)).toBeLessThanOrEqual(0.005 + 1e-9);
            expect(Math.abs(c.lon - p.lon)).toBeLessThanOrEqual(0.005 + 1e-9);
            // Deux décimales au plus une fois écrite
            expect(JSON.stringify(c)).toMatch(/^\{"lat":-?\d+(\.\d{1,2})?,"lon":-?\d+(\.\d{1,2})?\}$/);
        }
    });

    it('position de l’appareil gardée arrondie, lieu choisi sur la carte gardé tel quel', () => {
        saveLastLocation({ lat: 45.81234, lon: 6.21789 }, true);
        expect(lastLocation()).toEqual({ lat: 45.81, lon: 6.22 });
        saveLastLocation({ lat: 45.81234, lon: 6.21789 }, false);
        expect(lastLocation()).toEqual({ lat: 45.81234, lon: 6.21789 });
    });

    it('oublie le dernier lieu', () => {
        saveLastLocation({ lat: 45.8, lon: 6.2 }, false);
        forgetLastLocation();
        expect(lastLocation()).toBeNull();
        expect(store.size).toBe(0);
    });
});
