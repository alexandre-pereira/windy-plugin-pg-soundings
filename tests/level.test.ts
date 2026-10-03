import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { toHourly } from '../src/interpolate';
import { altitudeOfLevel, levelOfAltitude, MAP_LEVELS } from '../src/level';
import { buildColumns, type ForecastPayload } from '../src/physics';

/** Prévision ECMWF réelle enregistrée le 29/09/2026 à Saint-André-les-Alpes */
const payload = JSON.parse(
    readFileSync(new URL('./fixtures/saint-andre.json', import.meta.url), 'utf8'),
) as ForecastPayload;
const cols = buildColumns(toHourly(structuredClone(payload), 43.97, 6.5), 43.97, 6.5);
const { profile } = cols[12];
const ground = profile[0].z;

describe('niveaux de la carte', () => {
    it('altitude d’un niveau : le sol, 100 m au-dessus, ou celle du niveau de pression', () => {
        expect(altitudeOfLevel(profile, 'surface')).toBe(ground);
        expect(altitudeOfLevel(profile, '100m')).toBe(ground + 100);
        const p700 = profile.find(p => p.p === 700)!;
        expect(altitudeOfLevel(profile, '700h')).toBeCloseTo(p700.z, 0);
        // Entre deux niveaux du modèle : entre leurs altitudes
        const z800 = altitudeOfLevel(profile, '800h')!;
        expect(z800).toBeGreaterThan(profile.find(p => p.p === 850)!.z);
        expect(z800).toBeLessThan(p700.z);
    });

    it('pas d’altitude pour un niveau sous le sol, plus haut que le profil ou inconnu', () => {
        // Saint-André : sol du modèle vers 1 100 m, bien au-dessus de 975 hPa
        expect(altitudeOfLevel(profile, '975h')).toBeNull();
        expect(altitudeOfLevel(profile, '150h')).toBeNull();
        expect(altitudeOfLevel(profile, 'ailleurs')).toBeNull();
    });

    it('niveau le plus proche d’une altitude', () => {
        expect(levelOfAltitude(profile, ground)).toBe('surface');
        expect(levelOfAltitude(profile, ground - 300)).toBe('surface');
        expect(levelOfAltitude(profile, ground + 90)).toBe('100m');
        for (const level of ['850h', '800h', '700h', '600h', '500h']) {
            const z = altitudeOfLevel(profile, level);
            if (z == null || z < ground + 150) continue;
            expect(levelOfAltitude(profile, z + 40)).toBe(level);
        }
        // Jamais un niveau situé sous le sol
        for (let z = ground; z < ground + 4000; z += 100) {
            const level = levelOfAltitude(profile, z)!;
            expect(MAP_LEVELS).toContain(level);
            expect(altitudeOfLevel(profile, level)).not.toBeNull();
        }
    });

    it('parmi les seuls niveaux que la carte propose', () => {
        const z700 = altitudeOfLevel(profile, '700h')!;
        expect(levelOfAltitude(profile, z700, ['surface', '850h', '500h'])).not.toBe('700h');
        expect(levelOfAltitude(profile, z700, ['surface'])).toBe('surface');
        expect(levelOfAltitude(profile, z700, [])).toBeNull();
    });
});
