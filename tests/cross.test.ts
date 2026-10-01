import { describe, expect, it } from 'vitest';

import { bestFreeFlight, type HourlyXc, kmRGBA, XC_HOURS, type XcField } from '../src/cross';

const N = XC_HOURS[1] - XC_HOURS[0] + 1;

/** Champ uniforme : vitesse de cross 20 km/h de 10 h à 16 h, vent et hauteur exploitable donnés */
const field = (h: number, u = 0, v = 0): XcField => {
    const hourly: HourlyXc = {
        s: Array.from({ length: N }, (_, k) => (XC_HOURS[0] + k >= 10 && XC_HOURS[0] + k <= 16 ? 20 : 0)),
        u: Array(N).fill(u),
        v: Array(N).fill(v),
        h: Array(N).fill(h),
    };
    return {
        grid: { south: 40, north: 50, west: 0, east: 12, cols: 3, rows: 3 },
        data: Array(9).fill(hourly),
    };
};

describe('simulation de cross', () => {
    it('la dernière transition part de la hauteur exploitable', () => {
        const low = bestFreeFlight(field(0), 45, 6)!;
        const high = bestFreeFlight(field(1500), 45, 6)!;
        // 60 % de 1500 m à 1,4 m/s de chute et 35 km/h : ≈ 6,25 km, contre ≈ 1,4 km depuis 200 m
        expect(high.km - low.km).toBeGreaterThan(4.3);
        expect(high.km - low.km).toBeLessThan(5.4);
    });

    it('le vent pousse aussi pendant la dernière transition', () => {
        const calm = bestFreeFlight(field(1500), 45, 6)!;
        const windy = bestFreeFlight(field(1500, 15, 0), 45, 6)!;
        expect(windy.km).toBeGreaterThan(calm.km);
        // Le meilleur cap part sous le vent (vers l'est)
        expect(windy.heading).toBeGreaterThan(45);
        expect(windy.heading).toBeLessThan(135);
    });
});

describe('couleurs de la carte des cross', () => {
    it('la carte reste lisible un jour faible : voile là où rien ne vole, couleur franche dès 15 km', () => {
        // Zone calculée sans cross possible : voile visible, pas du transparent
        expect(kmRGBA(0)[3]).toBeGreaterThan(60);
        // Hors saison presque tout vaut 15 à 60 km : assez opaque pour se voir sur le fond clair
        for (const km of [15, 30, 60]) expect(kmRGBA(km)[3]).toBeGreaterThanOrEqual(180);
    });

    it("l'opacité ne baisse jamais quand la distance augmente", () => {
        let prev = 0;
        for (let km = 0; km <= 400; km += 5) {
            const a = kmRGBA(km)[3];
            expect(a).toBeGreaterThanOrEqual(prev);
            prev = a;
        }
    });
});
