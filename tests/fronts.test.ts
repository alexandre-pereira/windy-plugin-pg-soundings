import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { surroundingPoints } from '../src/forecast';
import {
    type AirMass,
    airMassOf,
    type Front,
    frontDays,
    frontsAround,
    frontsOf,
    mapFronts,
    type MapFront,
    thermalAdvection,
} from '../src/fronts';
import { toHourly } from '../src/interpolate';
import { buildColumns, type Column, type ForecastPayload } from '../src/physics';
import { dayKey } from '../src/time';

/** Prévisions ECMWF réelles enregistrées le 29/09/2026 : trois jours, de 0 h à 23 h (heure locale) */
const columnsOf = (file: string, lat: number, lon: number) => {
    const payload = JSON.parse(
        readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8'),
    );
    return buildColumns(toHourly(payload as ForecastPayload, lat, lon), lat, lon);
};
const DOUSSARD = { lat: 45.78, lon: 6.22 };
const SAINT_ANDRE = { lat: 43.97, lon: 6.5 };
const doussard = columnsOf('doussard.json', DOUSSARD.lat, DOUSSARD.lon);
/** Altitude du sol du modèle à Doussard (m) */
const DOUSSARD_GROUND = doussard[0].ground;
const saintAndre = columnsOf('saint-andre.json', SAINT_ANDRE.lat, SAINT_ANDRE.lon);

/** Heures d'une journée locale (0 : 29/09, 1 : 30/09, 2 : 01/10) */
const dayOf = (cols: Column[], n: number) => {
    const keys = [...new Set(cols.map(c => dayKey(c.ts, c.utcOffset)))];
    return cols.filter(c => dayKey(c.ts, c.utcOffset) === keys[n]);
};

const KMH = 1 / 3.6;
const HOUR = 3600e3;

/** La même heure en air calme : ni vent, ni thermique, ni pluie, ni orage */
const calm = (c: Column): Column => ({
    ...c,
    windSurf: 1,
    gust: 2,
    precip: 0,
    snow: 0,
    climb: 0,
    ceiling: null,
    choppy: 0,
    stormRisk: 0,
    showerBase: null,
    showerTop: null,
    cloudCover: 0,
    profile: c.profile.map(p => ({ ...p, u: 1, v: 0 })),
});

describe('passages de front', () => {
    const ref = doussard[0].profile;
    const ground = doussard[0].ground;
    /** Part faite (0 à 1) d'un changement qui commence à l'heure `from` de la série et dure `hours` heures */
    const done = (i: number, from: number, hours: number) =>
        Math.min(1, Math.max(0, (i - from) / hours));
    type Wind = { low: [number, number]; high: [number, number] };
    /** Vent (m/s, vers l'est et vers le nord) qui ne tourne pas avec l'altitude : aucune advection */
    const STEADY: Wind = { low: [1, 0], high: [1, 0] };
    /** Vent de sud en bas, d'ouest en haut : il tourne à droite en montant (advection chaude dans le nord) */
    const VEERING: Wind = { low: [0, 10], high: [10, 0] };
    /** Vent d'ouest en bas, de sud en haut : il tourne à gauche en montant (advection froide dans le nord) */
    const BACKING: Wind = { low: [10, 0], high: [0, 10] };
    /**
     * Trois jours d'air calme au profil figé (celui de la première heure). `high(i)` et `low(i)` :
     * écart de température (K) de l'heure i au-dessus et en dessous de 1 200 m du sol, à point de
     * rosée inchangé ; `wind` : vent en dessous et au-dessus de cette hauteur
     */
    const air = (
        high: (i: number) => number,
        low: (i: number) => number,
        extra: (i: number) => Partial<Column> = () => ({}),
        wind: Wind = STEADY,
    ) =>
        doussard.map((c, i) => ({
            ...calm(c),
            profile: ref.map(p => {
                const up = p.z > ground + 1200;
                const [u, v] = up ? wind.high : wind.low;
                return { ...p, u, v, t: p.t == null ? null : p.t + (up ? high(i) : low(i)) };
            }),
            ...extra(i),
        }));
    /** Le même changement à toutes les altitudes : `change` K entre les heures `from` et `from + hours` */
    const whole = (
        change: number,
        extra?: (i: number) => Partial<Column>,
        wind?: Wind,
        hours = 6,
        from = 30,
    ) =>
        air(
            i => change * done(i, from, hours),
            i => change * done(i, from, hours),
            extra,
            wind,
        );
    const wet = (from: number, to: number) => (i: number) => ({
        precip: i >= from && i <= to ? 0.5 : 0,
        cloudCover: 1,
    });
    const overcast = () => ({ cloudCover: 1 });
    const fronts = (cols: Column[], lat = DOUSSARD.lat) => frontsOf(cols, lat);

    it('aucun front sur les prévisions de test (temps calme, puis pluie sans changement de masse d’air)', () => {
        expect(fronts(doussard)).toEqual([]);
        expect(fronts(saintAndre, SAINT_ANDRE.lat)).toEqual([]);
    });

    it('front froid : la masse d’air se refroidit de 5 K en 6 h, sous la pluie ou par temps sec', () => {
        const [rainy, ...none] = fronts(whole(-5, wet(30, 36)));
        expect(none).toEqual([]);
        expect(rainy.kind).toBe('cold');
        expect(rainy.window).toBe(6);
        expect(rainy.tempChange).toBeCloseTo(-5, 1);
        expect(rainy.rain).toBeCloseTo(3.5, 1);
        expect(rainy.dry).toBe(false);
        // Passage pendant le refroidissement
        expect(rainy.at.ts).toBeGreaterThan(doussard[30].ts);
        expect(rainy.at.ts).toBeLessThan(doussard[36].ts);
        // Sans pluie ni nuages, c'est encore un front : un front froid sec
        expect(fronts(whole(-5)).map(f => [f.kind, f.dry])).toEqual([['cold', true]]);
    });

    it('pas de front quand l’air change trop peu, ou quand seule son humidité change', () => {
        expect(fronts(whole(-3, wet(30, 36)))).toEqual([]);
        // L'air s'assèche (point de rosée −12 K) sans se refroidir : intrusion d'air sec, pas un front
        const drying = doussard.map((c, i) => ({
            ...calm(c),
            profile: ref.map(p => ({
                ...p,
                u: 1,
                v: 0,
                td: p.td == null ? null : p.td - 12 * done(i, 30, 6),
            })),
        }));
        expect(fronts(drying)).toEqual([]);
    });

    it('front froid : le vent doit amener l’air froid (advection), dans chaque hémisphère', () => {
        // Vent qui tourne à gauche en montant : advection froide dans le nord, chaude dans le sud
        expect(fronts(whole(-5, wet(30, 36), BACKING)).map(f => f.kind)).toEqual(['cold']);
        expect(fronts(whole(-5, wet(30, 36), BACKING), -45)).toEqual([]);
        // Vent qui tourne à droite en montant : il amène de l'air chaud, le refroidissement n'est pas un front
        expect(fronts(whole(-5, wet(30, 36), VEERING))).toEqual([]);
        expect(fronts(whole(-5, wet(30, 36), VEERING), -45).map(f => f.kind)).toEqual(['cold']);
    });

    it('rotation du vent au passage : donnée avec le front', () => {
        // Vent de 30 km/h qui tourne de 225° à 315° pendant le refroidissement, 20° plus à droite près
        // du sol qu'en altitude (il tourne à gauche en montant : advection froide)
        const turning = doussard.map((c, i) => {
            const part = done(i, 30, 6);
            const wind = (dir: number) => {
                const rad = (dir * Math.PI) / 180;
                return { u: -30 * KMH * Math.sin(rad), v: -30 * KMH * Math.cos(rad) };
            };
            const profile = ref.map(p => ({
                ...p,
                ...wind(225 + 90 * part + (p.z > ground + 1200 ? 0 : 20)),
                t: p.t == null ? null : p.t - 5 * part,
            }));
            return { ...calm(c), profile };
        });
        const [f] = fronts(turning);
        expect(f.kind).toBe('cold');
        expect(f.turns).toBe(true);
        // Vent donné à 1 500 m du sol, entre les deux niveaux : un quart de tour de plus après le front
        expect(f.before!.dir).toBeGreaterThan(225);
        expect(f.before!.dir).toBeLessThan(245);
        expect(f.after!.dir - f.before!.dir).toBeCloseTo(90, 0);
        expect(fronts(whole(-5))[0].turns).toBe(false);
    });

    it('front chaud : réchauffement sous un ciel couvert, amené par un vent qui tourne à droite en montant', () => {
        const [f, ...none] = fronts(whole(5, overcast, VEERING));
        expect(none).toEqual([]);
        expect(f.kind).toBe('warm');
        expect(f.dry).toBe(false);
        expect(f.tempChange).toBeCloseTo(5, 1);
        expect(f.advection!).toBeGreaterThan(0.1);
        // Par ciel clair (air humide monté par les thermiques, subsidence) ou sans advection chaude : pas de front
        expect(fronts(whole(5, undefined, VEERING))).toEqual([]);
        expect(fronts(whole(5, overcast))).toEqual([]);
        expect(fronts(whole(5, overcast, BACKING))).toEqual([]);
    });

    it('advection : chaude quand le vent tourne à droite en montant, froide à gauche, inverse dans l’hémisphère sud', () => {
        const veering = whole(0, undefined, VEERING)[0];
        const backing = whole(0, undefined, BACKING)[0];
        expect(thermalAdvection(veering, 45)!).toBeGreaterThan(0.1);
        expect(thermalAdvection(backing, 45)!).toBeLessThan(-0.1);
        expect(thermalAdvection(veering, -45)!).toBeLessThan(-0.1);
        expect(thermalAdvection(whole(0)[0], 45)).toBeCloseTo(0, 9);
    });

    it('front froid : au sol quelques heures avant l’altitude, là où l’air bas change le plus vite', () => {
        // L'air se refroidit de 6 K : dès la 27e heure près du sol, à partir de la 32e en altitude
        const cols = air(
            i => -6 * done(i, 32, 4),
            i => -6 * done(i, 27, 3),
            wet(27, 36),
        );
        const [f, ...none] = fronts(cols);
        expect(none).toEqual([]);
        expect(f.kind).toBe('cold');
        expect(f.at.ts).toBeGreaterThanOrEqual(cols[27].ts);
        expect(f.at.ts).toBeLessThanOrEqual(cols[30].ts);
        expect(f.aloft.ts).toBeGreaterThan(cols[32].ts);
        expect(f.aloft.ts - f.at.ts).toBeGreaterThanOrEqual(2 * HOUR);
    });

    it('front chaud : en altitude avant le sol', () => {
        // L'air se réchauffe de 6 K : dès la 27e heure en altitude, à partir de la 31e près du sol
        const cols = air(
            i => 6 * done(i, 27, 4),
            i => 6 * done(i, 31, 4),
            overcast,
            VEERING,
        );
        const [f, ...none] = fronts(cols);
        expect(none).toEqual([]);
        expect(f.kind).toBe('warm');
        expect(f.aloft.ts).toBeLessThan(f.at.ts);
        expect(f.at.ts).toBeGreaterThan(cols[31].ts);
    });

    it('la surface d’un front ne penche jamais à l’envers, ni de plus de 6 h', () => {
        // Air libre refroidi avant l'air bas : le passage en altitude reste celui du sol
        const early = fronts(
            air(
                i => -6 * done(i, 26, 4),
                i => -6 * done(i, 30, 4),
            ),
        );
        expect(early.length).toBeGreaterThan(0);
        for (const f of early) expect(f.aloft.ts).toBe(f.at.ts);
        // Air libre refroidi 12 h après l'air bas : au-delà de 6 h, ce n'est plus la même surface
        const late = fronts(
            air(
                i => -6 * done(i, 42, 4),
                i => -6 * done(i, 30, 4),
            ),
        );
        expect(late.length).toBeGreaterThan(0);
        for (const f of late) {
            expect(f.aloft.ts).toBeGreaterThanOrEqual(f.at.ts);
            expect(f.aloft.ts - f.at.ts).toBeLessThanOrEqual(6 * HOUR);
        }
    });

    it('pression : sa variation après le passage est donnée quand le modèle la fournit', () => {
        expect(fronts(whole(-5))[0].pressureRise).toBeNull();
        // La pression baisse jusqu'à la 32e heure, puis remonte de 1,5 hPa par heure
        const pressure = (i: number) => 1010 - 0.5 * Math.min(i, 32) + 1.5 * Math.max(0, i - 32);
        const [f] = fronts(whole(-5, i => ({ pressure: pressure(i) })));
        const k = doussard.findIndex(c => c.ts === f.at.ts);
        expect(f.pressureRise).toBeCloseTo(pressure(k + 3) - pressure(k), 6);
        // La pression ne change ni le front ni son heure
        expect(f.at.ts).toBe(fronts(whole(-5))[0].at.ts);
    });

    it('front lent : le même changement étalé sur 12 h', () => {
        // −7 K en 12 h : moins de 5 K en 6 h, le changement franc ne le voit pas
        const cold = fronts(whole(-7, wet(24, 36), BACKING, 12, 24));
        expect(cold.map(f => [f.kind, f.window])).toEqual([['cold', 12]]);
        expect(cold[0].tempChange).toBeCloseTo(-7, 1);
        const warm = fronts(whole(8, overcast, VEERING, 12, 24));
        expect(warm.map(f => [f.kind, f.window])).toEqual([['warm', 12]]);
        // Trop peu en 12 h, ou par ciel clair pour un front chaud : pas de front
        expect(fronts(whole(-5, wet(24, 36), BACKING, 12, 24))).toEqual([]);
        expect(fronts(whole(8, undefined, VEERING, 12, 24))).toEqual([]);
        // Un changement franc n'est pas compté une seconde fois comme front lent
        expect(fronts(whole(-9, wet(30, 36), BACKING)).map(f => [f.kind, f.window])).toEqual([
            ['cold', 6],
        ]);
    });

    it('occlusion : l’air gagne puis reperd quelques degrés en altitude sous la pluie, sans changer près du sol', () => {
        // +4 K au-dessus de 1 200 m du sol en 6 h, reperdus dans les 6 h suivantes
        const tongue = (i: number) => 4 * (done(i, 24, 6) - done(i, 30, 6));
        const found = fronts(air(tongue, () => 0, wet(24, 36)));
        expect(found.map(f => f.kind)).toEqual(['occluded']);
        expect(found[0].at.ts).toBe(doussard[30].ts);
        expect(found[0].tempChange).toBeGreaterThan(1.5);
        expect(found[0].tempChange).toBeLessThanOrEqual(4);
        // Sans pluie, ou quand l'air bas change lui aussi : pas d'occlusion
        expect(fronts(air(tongue, () => 0, overcast))).toEqual([]);
        expect(
            fronts(air(tongue, i => -3 * done(i, 24, 12), wet(24, 36))).some(
                f => f.kind === 'occluded',
            ),
        ).toBe(false);
    });

    it('fronts rendus dans l’ordre de leur passage au sol, et rangés par jour', () => {
        const change = (i: number) => -6 * done(i, 8, 6) + 6 * done(i, 54, 6);
        // Advection froide pendant le refroidissement, chaude pendant le réchauffement
        const cols = air(change, change, wet(6, 62)).map((c, i) => ({
            ...c,
            profile: c.profile.map(p => {
                const [u, v] = (i < 40 ? BACKING : VEERING)[p.z > ground + 1200 ? 'high' : 'low'];
                return { ...p, u, v };
            }),
        }));
        const found = fronts(cols);
        expect(found.map(f => f.kind)).toEqual(['cold', 'warm']);
        expect(found[0].at.ts).toBeLessThan(found[1].at.ts);
        // Le front froid passe le premier jour (29/09), le front chaud le troisième (01/10)
        const days = frontDays(found);
        const key = (n: number) => dayKey(dayOf(cols, n)[0].ts, cols[0].utcOffset);
        expect(days.get(key(0))).toEqual(['cold']);
        expect(days.get(key(1))).toBeUndefined();
        expect(days.get(key(2))).toEqual(['warm']);
    });

    describe('fronts lus sur la carte', () => {
        const HOURS = 72;
        const ts = Array.from({ length: HOURS }, (_, i) => doussard[0].ts + i * HOUR);
        /** Points voisins à 55 km au nord, au sud, à l'est et à l'ouest du lieu (km vers l'est, vers le nord) */
        const SPOTS: [number, number][] = [
            [0, 55],
            [0, -55],
            [55, 0],
            [-55, 0],
        ];
        const KM = 111.2;
        const COS = Math.cos((DOUSSARD.lat * Math.PI) / 180);
        /**
         * Masse d'air d'un point situé à `x` km à l'est et `y` km au nord du lieu, aux deux niveaux :
         * `field(x, hour)` donne l'écart (K) de température potentielle équivalente et de température
         * potentielle ; vent d'ouest de `wind` m/s ; niveaux à 1 500 et 3 000 m
         */
        const spot = (
            x: number,
            y: number,
            field: (x: number, hour: number) => [number, number],
            wind = 11,
        ): AirMass => {
            const level = (z: number) => ({
                thetaE: ts.map((_, i) => 320 + field(x, i)[0]),
                theta: ts.map((_, i) => 300 + field(x, i)[1]),
                u: ts.map(() => wind),
                v: ts.map(() => 0),
                z: ts.map(() => z),
            });
            return {
                lat: DOUSSARD.lat + y / KM,
                lon: DOUSSARD.lon + x / (KM * COS),
                ts,
                levels: { 850: level(1500), 700: level(3000) },
            };
        };
        const scene = (
            field: (x: number, hour: number) => [number, number],
            wind?: number,
            spots = SPOTS,
        ) => ({
            center: spot(0, 0, field, wind),
            around: spots.map(([x, y]) => spot(x, y, field, wind)),
        });
        /**
         * Part d'air nouveau (0 à 1) à `x` km, à l'heure `hour`, derrière un front qui avance vers
         * l'est à 40 km/h et passe sur le lieu à la 30e heure
         */
        const behind = (x: number, hour: number) =>
            1 / (1 + Math.exp(-(40 * (hour - 30) - x) / 40));
        const coldFront = (x: number, hour: number): [number, number] => [
            -12 * behind(x, hour),
            -5 * behind(x, hour),
        ];

        it('front froid : un fort gradient de masse d’air traverse le lieu, poussé par le vent', () => {
            const { center, around } = scene(coldFront);
            const found = mapFronts(center, around, DOUSSARD_GROUND);
            expect(found.map(f => [f.kind, f.window, f.level])).toEqual([['cold', 6, 850]]);
            expect(Math.abs(found[0].ts - ts[30])).toBeLessThanOrEqual(HOUR);
            expect(found[0].to - found[0].from).toBe(6 * HOUR);
            expect(found[0].z).toBe(1500);
            // Le même front de l'autre sens : front chaud
            const warm = scene((x, h) => coldFront(x, h).map(v => -v) as [number, number]);
            expect(mapFronts(warm.center, warm.around, DOUSSARD_GROUND).map(f => f.kind)).toEqual([
                'warm',
            ]);
        });

        it('pas de front sans gradient, sans vent qui le pousse, ou quand seule l’humidité change', () => {
            // L'air change partout en même temps (cycle du jour, subsidence) : aucun gradient
            const everywhere = scene((_, h) => coldFront(0, h));
            expect(mapFronts(everywhere.center, everywhere.around, DOUSSARD_GROUND)).toEqual([]);
            // Vent d'est : il éloigne l'air froid du lieu au lieu de l'amener
            const away = scene(coldFront, -11);
            expect(mapFronts(away.center, away.around, DOUSSARD_GROUND)).toEqual([]);
            // Air plus sec derrière, pas plus froid : intrusion d'air sec
            const dryer = scene((x, h) => [coldFront(x, h)[0], 0]);
            expect(mapFronts(dryer.center, dryer.around, DOUSSARD_GROUND)).toEqual([]);
            // Front trop faible
            const weak = scene((x, h) => coldFront(x, h).map(v => v / 3) as [number, number]);
            expect(mapFronts(weak.center, weak.around, DOUSSARD_GROUND)).toEqual([]);
        });

        it('niveau sous le sol du lieu : la carte est lue à 700 hPa ; voisins alignés : pas de carte', () => {
            const { center, around } = scene(coldFront);
            expect(mapFronts(center, around, 1600).map(f => [f.kind, f.level, f.z])).toEqual([
                ['cold', 700, 3000],
            ]);
            // Deux voisins suffisent s'ils ne sont pas alignés avec le lieu
            const corner = scene(coldFront, undefined, [SPOTS[0], SPOTS[2]]);
            expect(
                mapFronts(corner.center, corner.around, DOUSSARD_GROUND).map(f => f.kind),
            ).toEqual(['cold']);
            const line = scene(coldFront, undefined, [SPOTS[2], SPOTS[3]]);
            expect(mapFronts(line.center, line.around, DOUSSARD_GROUND)).toEqual([]);
        });

        it('masse d’air d’une prévision de Windy : température potentielle et potentielle équivalente par niveau', () => {
            const payload = JSON.parse(
                readFileSync(new URL('./fixtures/doussard.json', import.meta.url), 'utf8'),
            );
            const mass = airMassOf(
                toHourly(payload as ForecastPayload, DOUSSARD.lat, DOUSSARD.lon),
                DOUSSARD.lat,
                DOUSSARD.lon,
            );
            expect(mass.ts).toHaveLength(72);
            const t850 = payload.sounding['temp-850h'][0] as number;
            expect(mass.levels[850].theta[0]).toBeCloseTo(t850 * Math.pow(1000 / 850, 0.2857), 6);
            expect(mass.levels[850].thetaE[0]!).toBeGreaterThan(mass.levels[850].theta[0]!);
            expect(mass.levels[850].z[0]).toBe(payload.sounding['gh-850h'][0]);
            expect(mass.levels[700].z[0]!).toBeGreaterThan(mass.levels[850].z[0]!);
        });

        it('points voisins : à 55 km au nord, au sud, à l’est et à l’ouest', () => {
            const [north, south, east, west] = surroundingPoints(DOUSSARD.lat, DOUSSARD.lon);
            expect((north.lat - DOUSSARD.lat) * KM).toBeCloseTo(55, 6);
            expect((DOUSSARD.lat - south.lat) * KM).toBeCloseTo(55, 6);
            expect((east.lon - DOUSSARD.lon) * KM * COS).toBeCloseTo(55, 6);
            expect((DOUSSARD.lon - west.lon) * KM * COS).toBeCloseTo(55, 6);
            expect([north.lon, south.lon, east.lat, west.lat]).toEqual([
                DOUSSARD.lon,
                DOUSSARD.lon,
                DOUSSARD.lat,
                DOUSSARD.lat,
            ]);
        });

        it('la carte dit qu’un front passe et quand, le lieu dit où il passe au sol et en altitude', () => {
            // L'air du lieu se refroidit de 6 K : dès la 27e heure près du sol, à partir de la 32e en altitude
            const cols = air(
                i => -6 * done(i, 32, 4),
                i => -6 * done(i, 27, 3),
                wet(27, 36),
            );
            const front: MapFront = {
                kind: 'cold',
                from: cols[26].ts,
                to: cols[32].ts,
                ts: cols[29].ts,
                window: 6,
                level: 850,
                z: ground + 1500,
            };
            const [f, ...none] = frontsOf(cols, DOUSSARD.lat, [front]);
            expect(none).toEqual([]);
            expect(f.kind).toBe('cold');
            // Au sol dans les 3 h qui précèdent le passage de la carte, jamais après
            expect(f.at.ts).toBeGreaterThanOrEqual(cols[27].ts);
            expect(f.at.ts).toBeLessThanOrEqual(cols[29].ts);
            // Surface : sol, niveau de la carte à l'heure de la carte, air libre plus tard
            expect(f.surface.map(p => p.z)).toEqual([ground, ground + 1500, ground + 2250]);
            expect(f.surface[1].ts).toBe(cols[29].ts);
            expect(f.surface[2].ts).toBe(f.aloft.ts);
            expect(f.aloft.ts).toBeGreaterThan(cols[32].ts);
            for (let k = 1; k < f.surface.length; k++) {
                expect(f.surface[k].ts).toBeGreaterThanOrEqual(f.surface[k - 1].ts);
            }
        });

        it('avec la carte, elle seule décide : ni front ajouté par le lieu, ni front de la carte écarté', () => {
            // L'air du lieu change, la carte ne voit aucun front
            expect(fronts(whole(-5, wet(30, 36))).map(f => f.kind)).toEqual(['cold']);
            expect(frontsOf(whole(-5, wet(30, 36)), DOUSSARD.lat, [])).toEqual([]);
            // La carte voit un front chaud par ciel clair, que le lieu seul aurait écarté
            const warm: MapFront = {
                kind: 'warm',
                from: doussard[30].ts,
                to: doussard[36].ts,
                ts: doussard[33].ts,
                window: 6,
                level: 850,
                z: null,
            };
            expect(fronts(whole(5, undefined, VEERING))).toEqual([]);
            const [f] = frontsOf(whole(5, undefined, VEERING), DOUSSARD.lat, [warm]);
            expect(f.kind).toBe('warm');
            expect(f.at.ts).toBeGreaterThanOrEqual(doussard[33].ts);
            expect(f.at.ts).toBeLessThanOrEqual(doussard[36].ts);
            // Sans niveau de carte entre l'air bas et l'air libre : sol et air libre seulement
            expect(f.surface.map(p => p.z)).toEqual([ground, ground + 2250]);
        });
    });
});

describe('fronts autour des heures affichées', () => {
    it('pendant, dans les 12 h qui précèdent (froid seulement), dans les 6 h qui suivent', () => {
        const cols = dayOf(doussard, 1);
        const front = (ts: number, kind: Front['kind'] = 'cold'): Front => ({
            kind,
            at: { ...cols[0], ts },
            aloft: { ...cols[0], ts },
            tempChange: kind === 'cold' ? -4 : 4,
            window: 6,
            advection: null,
            pressureRise: null,
            windZ: 2000,
            before: null,
            after: null,
            turns: false,
            rain: 2,
            dry: false,
            gust: null,
            surface: [],
        });
        const start = cols[0].ts;
        const end = cols[cols.length - 1].ts;
        const all = [
            front(start - 20 * HOUR),
            front(start - 5 * HOUR, 'warm'),
            front(start - 3 * HOUR),
            front(start + 10 * HOUR),
            front(end + 4 * HOUR, 'warm'),
            front(end + 9 * HOUR),
        ];

        // Journée entière
        expect(frontsAround(all, start, end)).toEqual({
            during: [all[3]],
            before: all[2],
            after: all[4],
        });
        // De 8 h à 20 h
        const [from, to] = [start + 8 * HOUR, start + 20 * HOUR];
        expect(frontsAround(all, from, to)).toEqual({
            during: [all[3]],
            before: all[2],
            after: null,
        });
        // Bornes comprises : 12 h avant la première heure, 6 h après la dernière
        expect(frontsAround(all, start + 9 * HOUR, start + 10 * HOUR)).toEqual({
            during: [all[3]],
            before: all[2],
            after: null,
        });
        expect(frontsAround(all, start + 9 * HOUR + 1, end - 2 * HOUR)).toEqual({
            during: [all[3]],
            before: null,
            after: all[4],
        });
        expect(frontsAround([], from, to)).toEqual({ during: [], before: null, after: null });
    });
});
