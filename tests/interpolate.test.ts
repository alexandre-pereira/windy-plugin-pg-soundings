import { describe, expect, it } from 'vitest';

import { payloadAt, toHourly } from '../src/interpolate';
import type { ForecastPayload } from '../src/physics';

const HOUR = 3600e3;
const start = Date.UTC(2026, 5, 10, 0);

/** Prévision tri-horaire (compte sans Premium) */
const threeHourly = (): ForecastPayload => {
    const ts = [0, 3, 6, 9].map(h => start + h * HOUR);
    return {
        header: { elevation: 0, utcOffset: 2, availableLevels: [], model: 'ecmwf' },
        data: {
            ts,
            hour: ts.map(t => new Date(t + 2 * HOUR).getUTCHours()),
            temperature: [280, 283, 289, 292],
            wind: [5, 5, 5, 5],
            windDir: [350, 10, 30, 30],
            precipAmount: [3, 0, 6, 0],
        },
    };
};

describe('passage au pas horaire', () => {
    const p = toHourly(threeHourly(), 45, 6);

    it('grille des heures pleines, heure locale recalculée', () => {
        expect(p.data.ts).toHaveLength(10);
        expect(p.data.hour?.slice(0, 4)).toEqual([2, 3, 4, 5]);
    });

    it('température linéaire entre deux pas', () => {
        expect(p.data.temperature?.[1]).toBeCloseTo(281, 6);
        expect(p.data.temperature?.[4]).toBeCloseTo(285, 6);
    });

    it('direction du vent par le vecteur : de 350° à 10° en passant par le nord', () => {
        const d = p.data.windDir?.[1] as number;
        expect(d > 355 || d < 5).toBe(true);
    });

    it('cumul d’un pas = pluie des heures qui le précèdent, réparti sur ces heures', () => {
        // 6 mm au pas de 6 h : tombés de 3 h à 6 h, soit 2 mm pour chacune des heures 3 h, 4 h et 5 h
        // (heure qui suit). Les 3 mm du premier pas sont tombés avant le début de la prévision.
        const rain = p.data.precipAmount ?? [];
        expect(rain.slice(0, 9)).toEqual([0, 0, 0, 2, 2, 2, 0, 0, 0]);
        // Dernière heure : la pluie qui suit n'est pas encore prévue
        expect(rain[9]).toBeNull();
    });

    it('garde la durée du pas d’où vient la pluie de chaque heure', () => {
        expect((p.data as { precipStep?: (number | null)[] }).precipStep).toEqual([
            3,
            3,
            3,
            3,
            3,
            3,
            3,
            3,
            3,
            null,
        ]);
    });

    it('garde les pas du modèle qui encadrent chaque heure', () => {
        const steps = p.data as { stepFrom?: number[]; stepTo?: number[] };
        const h = (k: number) => start + k * HOUR;
        // À une heure que le modèle fournit, les deux pas sont cette heure ; entre deux, ceux qui l'encadrent
        expect(steps.stepFrom?.slice(0, 5)).toEqual([h(0), h(0), h(0), h(3), h(3)]);
        expect(steps.stepTo?.slice(0, 5)).toEqual([h(0), h(3), h(3), h(3), h(6)]);
        expect([steps.stepFrom?.[9], steps.stepTo?.[9]]).toEqual([h(9), h(9)]);
    });

    it('prévision déjà horaire : chaque heure reçoit la pluie de l’heure qui suit', () => {
        const ts = [0, 1, 2, 3].map(h => start + h * HOUR);
        const hourly = toHourly(
            {
                header: { elevation: 0, utcOffset: 2, availableLevels: [], model: 'ecmwf' },
                data: { ts, temperature: [280, 281, 282, 283], precipAmount: [0, 0, 1.5, 0.5] },
            },
            45,
            6,
        );
        expect(hourly.data.temperature).toEqual([280, 281, 282, 283]);
        expect(hourly.data.precipAmount).toEqual([0, 1.5, 0.5, null]);
        // Aucun pas à signaler : rien n'est interpolé
        expect((hourly.data as { stepFrom?: number[] }).stepFrom).toBeUndefined();
    });
});

// payloadAt reçoit une prévision déjà passée par toHourly : cumuls valables pour le pas qui suit
describe('instant isolé (curseur de l’émagramme)', () => {
    it('interpole à la minute près et garde son décalage horaire', () => {
        const at = payloadAt(threeHourly(), start + 1.5 * HOUR, 45, 6)!;
        expect(at.data.temperature?.[0]).toBeCloseTo(281.5, 6);
        expect(at.header.utcOffset).toBe(2);
        expect(at.data.recentRain?.[0]).toBe(3);
    });

    it('pluie la plus forte à ±1 h, en mm/h (risque d’orage)', () => {
        // Pas de 3 h : 3 mm de 0 h à 3 h, rien de 3 h à 6 h, 6 mm de 6 h à 9 h
        expect(payloadAt(threeHourly(), start + 4.5 * HOUR, 45, 6)!.data.rainNear?.[0]).toBe(0);
        expect(payloadAt(threeHourly(), start + 5.5 * HOUR, 45, 6)!.data.rainNear?.[0]).toBe(2);
        expect(payloadAt(threeHourly(), start + 2.5 * HOUR, 45, 6)!.data.rainNear?.[0]).toBe(1);
    });

    it('rafales les plus fortes des heures qui encadrent l’instant et de leurs voisines (risque d’orage)', () => {
        const ts = [0, 1, 2, 3, 4, 5].map(h => start + h * HOUR);
        const hourly: ForecastPayload = {
            header: { elevation: 0, utcOffset: 2, availableLevels: [], model: 'ecmwf' },
            data: { ts, temperature: ts.map(() => 285), windGust: [5, 8, 25, 6, 4, 3] },
        };
        const near = (h: number) => payloadAt(hourly, start + h * HOUR, 45, 6)!.data.gustNear?.[0];
        // Heure pleine : la sienne et ses deux voisines, comme dans le calcul heure par heure
        expect(near(1)).toBe(25);
        expect(near(4)).toBe(6);
        // Entre 3 h et 4 h : les heures 2 à 5, tout ce que voient 3 h et 4 h
        expect(near(3.5)).toBe(25);
        expect(near(4.5)).toBe(6);
    });
});
