import { describe, expect, it } from 'vitest';

import type { ForecastPayload } from '../src/physics';
import { dayKey, euSummerTime, inEuDstZone, localHour, makeOffsetAt } from '../src/time';

const HOUR = 3600e3;

/** Prévision horaire minimale : `hours` calculées avec un décalage fixe (comme un en-tête unique) */
const payload = (start: number, n: number, offset: number, hourOf?: (ts: number) => number): ForecastPayload => {
    const ts = Array.from({ length: n }, (_, k) => start + k * HOUR);
    return {
        header: { elevation: 0, utcOffset: offset, availableLevels: [], model: 'ecmwf' },
        data: { ts, hour: ts.map(t => (hourOf ? hourOf(t) : localHour(t, offset))) },
    };
};

describe('heure d’été européenne', () => {
    it('change le dernier dimanche de mars et d’octobre à 1 h UTC', () => {
        expect(euSummerTime(Date.UTC(2026, 2, 29, 0, 59))).toBe(false);
        expect(euSummerTime(Date.UTC(2026, 2, 29, 1, 0))).toBe(true);
        expect(euSummerTime(Date.UTC(2026, 9, 25, 0, 59))).toBe(true);
        expect(euSummerTime(Date.UTC(2026, 9, 25, 1, 0))).toBe(false);
    });

    it('zone : Alpes, Espagne, Scandinavie oui ; Turquie, Islande, Maghreb non', () => {
        expect(inEuDstZone(45.78, 6.22)).toBe(true);
        expect(inEuDstZone(40.4, -3.7)).toBe(true);
        expect(inEuDstZone(61.1, 10.5)).toBe(true);
        expect(inEuDstZone(36.55, 29.12)).toBe(false); // Ölüdeniz
        expect(inEuDstZone(64.1, -21.9)).toBe(false); // Reykjavik
        expect(inEuDstZone(36.75, 3.06)).toBe(false); // Alger
    });
});

describe('décalage horaire au fil de la prévision', () => {
    const start = Date.UTC(2026, 9, 23, 0);

    it('en France, passe de +2 à +1 au changement d’heure même si Windy garde +2', () => {
        const offsetAt = makeOffsetAt(payload(start, 96, 2), 45.78, 6.22);
        expect(offsetAt(Date.UTC(2026, 9, 24, 12))).toBe(2);
        expect(offsetAt(Date.UTC(2026, 9, 25, 12))).toBe(1);
        // Les jours suivent l'heure locale : 23 h 30 UTC le 25 octobre, c'est déjà le 26 à 0 h 30
        expect(dayKey(Date.UTC(2026, 9, 25, 23, 30), offsetAt(Date.UTC(2026, 9, 25, 23, 30)))).toBe('2026-9-26');
    });

    it('suit l’heure locale de Windy quand elle tient compte du changement', () => {
        const windyHour = (t: number) => localHour(t, euSummerTime(t) ? 2 : 1);
        const offsetAt = makeOffsetAt(payload(start, 96, 2, windyHour), 36.55, 29.12);
        expect(offsetAt(Date.UTC(2026, 9, 24, 12))).toBe(2);
        expect(offsetAt(Date.UTC(2026, 9, 25, 12))).toBe(1);
    });

    it('hors de la zone, garde le décalage de Windy', () => {
        const offsetAt = makeOffsetAt(payload(start, 96, 3), 36.55, 29.12);
        expect(offsetAt(Date.UTC(2026, 9, 26, 12))).toBe(3);
    });
});
