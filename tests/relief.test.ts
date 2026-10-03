import { describe, expect, it } from 'vitest';

import { crestOf, reliefPoints } from '../src/relief';

describe('relief autour du point', () => {
    it('trois cercles de huit points, à 3, 6 et 10 km', () => {
        const points = reliefPoints(45, 6);
        expect(points).toHaveLength(24);
        const km = (p: { lat: number; lon: number }) =>
            Math.hypot((p.lat - 45) * 111.2, (p.lon - 6) * 111.2 * Math.cos((45 * Math.PI) / 180));
        expect(points.slice(0, 8).every(p => Math.abs(km(p) - 3) < 0.01)).toBe(true);
        expect(points.slice(8, 16).every(p => Math.abs(km(p) - 6) < 0.01)).toBe(true);
        expect(points.slice(16).every(p => Math.abs(km(p) - 10) < 0.01)).toBe(true);
        // Aucun point en double
        expect(new Set(points.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`)).size).toBe(24);
    });

    it('crêtes voisines : le plus haut des points lus, s’il dépasse le sol d’au moins 300 m', () => {
        expect(crestOf([600, 1800, 2350.4, 900], 500)).toBe(2350);
        // Plaine : pas de relief
        expect(crestOf([510, 620, 700, 480], 500)).toBeNull();
        // Points manquants : on s'en passe tant que la moitié a répondu
        expect(crestOf([null, 1800, null, 900], 500)).toBe(1800);
        expect(crestOf([null, 1800, null, null], 500)).toBeNull();
        expect(crestOf([], 500)).toBeNull();
    });
});
