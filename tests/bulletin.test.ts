import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { bulletinOf, daylightOf, type Front, frontsOf } from '../src/bulletin';
import { toHourly } from '../src/interpolate';
import { buildColumns, type Column, type ForecastPayload } from '../src/physics';
import { dayKey } from '../src/time';

/** Prévisions ECMWF réelles enregistrées le 29/09/2026 : trois jours, de 0 h à 23 h (heure locale) */
const columnsOf = (file: string, lat: number, lon: number) => {
    const payload = JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8'));
    return buildColumns(toHourly(payload as ForecastPayload, lat, lon), lat, lon);
};
const DOUSSARD = { lat: 45.78, lon: 6.22 };
const SAINT_ANDRE = { lat: 43.97, lon: 6.5 };
const doussard = columnsOf('doussard.json', DOUSSARD.lat, DOUSSARD.lon);
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

/** Journée d'air calme (Doussard, 29/09), avec les heures locales `hours` modifiées */
const calmDay = (hours: number[] = [], change: Partial<Column> = {}) =>
    dayOf(doussard, 0).map(c => (hours.includes(c.hour) ? { ...calm(c), ...change } : calm(c)));

describe('heures de jour', () => {
    it('du lever au coucher du soleil : le soleil est levé au milieu de l’heure', () => {
        // Fin septembre à Doussard : soleil levé de 7 h 30 à 19 h 20 environ
        expect(daylightOf(calmDay(), DOUSSARD.lat, DOUSSARD.lon).map(c => c.hour)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    });
});

describe('vent', () => {
    const bulletin = (cols: Column[]) => bulletinOf(cols, DOUSSARD.lat, DOUSSARD.lon)!;
    /** Vent de `speed` m/s venant de `dir`° à tous les niveaux */
    const blowing = (c: Column, dir: number, speed: number): Column => {
        const rad = (dir * Math.PI) / 180;
        return { ...c, profile: c.profile.map(p => ({ ...p, u: -speed * Math.sin(rad), v: -speed * Math.cos(rad) })) };
    };

    it('vent du matin et de l’après-midi : moyenne des heures de jour avant et à partir de 13 h', () => {
        // Ouest 2 m/s jusqu'à 12 h, sud 6 m/s ensuite ; la nuit, un vent de nord fort qui ne compte pas
        const cols = calmDay().map(c => (c.hour < 8 || c.hour > 18 ? blowing(c, 0, 20) : c.hour < 13 ? blowing(c, 270, 2) : blowing(c, 180, 6)));
        const { surface, levels } = bulletin(cols).wind;
        expect(surface.am!.dir).toBeCloseTo(270, 3);
        expect(surface.am!.speed).toBeCloseTo(2, 6);
        expect(surface.pm!.dir).toBeCloseTo(180, 3);
        expect(surface.pm!.speed).toBeCloseTo(6, 6);
        // En altitude : deux niveaux ronds au-dessus du sol, à 1 000 m d'écart
        expect(levels).toHaveLength(2);
        expect(levels[0].z % 500).toBe(0);
        expect(levels[0].z).toBeGreaterThanOrEqual(cols[0].ground + 700);
        expect(levels[1].z).toBe(levels[0].z + 1000);
        expect(levels[0].pm!.dir).toBeCloseTo(180, 3);
    });

    it('vitesse moyenne, pas celle du vecteur moyen : deux vents opposés ne s’annulent pas', () => {
        const cols = calmDay().map(c => (c.hour < 13 ? blowing(c, c.hour % 2 ? 90 : 270, 5) : c));
        expect(bulletin(cols).wind.surface.am!.speed).toBeCloseTo(5, 6);
    });

    it('rafale la plus forte : celle des heures de jour', () => {
        const cols = calmDay().map(c => (c.hour === 3 ? { ...c, gust: 20 } : c.hour === 15 ? { ...c, gust: 10 } : c));
        expect(bulletin(cols).wind.gust).toEqual({ speed: 10, hour: 15 });
    });
});

describe('passages de front', () => {
    /**
     * Trois jours d'air calme au profil figé (celui de la première heure), dont la température de
     * l'air varie de `change` K entre les heures `from` et `from + hours` de la série
     */
    const series = (change: number, extra: (c: Column, inside: boolean, done: number) => Partial<Column> = () => ({})) => {
        const ref = doussard[0].profile;
        const from = 30;
        const hours = 6;
        return doussard.map((c, i) => {
            const done = Math.min(1, Math.max(0, (i - from) / hours));
            const base = { ...calm(c), profile: ref.map(p => ({ ...p, u: 1, v: 0, t: p.t == null ? null : p.t + change * done })) };
            return { ...base, ...extra(base, i >= from && i <= from + hours, done) };
        });
    };
    const fronts = (cols: Column[], lat = DOUSSARD.lat) => frontsOf(cols, lat);

    it('aucun front sur les prévisions de test (temps calme, puis pluie sans changement de masse d’air)', () => {
        expect(fronts(doussard)).toEqual([]);
        expect(fronts(saintAndre, SAINT_ANDRE.lat)).toEqual([]);
    });

    it('front froid : l’air libre se refroidit sous la pluie', () => {
        const found = fronts(series(-5, (_, inside) => ({ precip: inside ? 0.5 : 0, cloudCover: 1 })));
        expect(found).toHaveLength(1);
        const [f] = found;
        expect(f.kind).toBe('cold');
        expect(f.tempChange).toBeCloseTo(-5, 1);
        expect(f.rain).toBeCloseTo(3.5, 1);
        // Passage pendant le refroidissement
        expect(f.at.ts).toBeGreaterThan(doussard[30].ts);
        expect(f.at.ts).toBeLessThan(doussard[36].ts);
    });

    it('le même refroidissement par ciel clair, sans pluie ni rotation du vent, n’est pas un front', () => {
        expect(fronts(series(-5))).toEqual([]);
    });

    it('front sec : fort refroidissement sous un ciel très nuageux', () => {
        expect(fronts(series(-5, () => ({ cloudCover: 0.9 }))).map(f => f.kind)).toEqual(['cold']);
        expect(fronts(series(-3.2, () => ({ cloudCover: 0.9 })))).toEqual([]);
    });

    it('rotation du vent : du sud-ouest au nord-ouest dans l’hémisphère nord, l’inverse dans le sud', () => {
        // Vent de 30 km/h qui tourne de 225° à 315° pendant le refroidissement
        const turning = series(-3.2, (c, _inside, done) => {
            const dir = ((225 + 90 * done) * Math.PI) / 180;
            const u = -30 * KMH * Math.sin(dir);
            const v = -30 * KMH * Math.cos(dir);
            return { cloudCover: 0.9, profile: c.profile.map(p => ({ ...p, u, v })) };
        });
        const [f] = fronts(turning);
        expect(f.kind).toBe('cold');
        expect(f.turns).toBe(true);
        expect(f.before!.dir).toBeCloseTo(225, 0);
        expect(f.after!.dir).toBeCloseTo(315, 0);
        expect(fronts(turning, -45)).toEqual([]);
    });

    it('front chaud : réchauffement sous un ciel couvert et une pluie de nuages en couches, pas sous des averses', () => {
        const rain = (_: Column, inside: boolean) => ({ precip: inside ? 0.5 : 0, cloudCover: 1 });
        expect(fronts(series(4, rain)).map(f => f.kind)).toEqual(['warm']);
        expect(fronts(series(4, (c, inside) => ({ ...rain(c, inside), showerBase: 1500, showerTop: 4000 })))).toEqual([]);
        // Réchauffement par ciel clair (subsidence) : pas de front
        expect(fronts(series(4))).toEqual([]);
    });
});

describe('ciel et précipitations', () => {
    const bulletin = (cols: Column[]) => bulletinOf(cols, DOUSSARD.lat, DOUSSARD.lon)!;

    it('épisodes de pluie : une heure sèche isolée ne sépare pas deux épisodes, deux heures oui', () => {
        const wet = calmDay([9, 11, 15, 16, 17], { precip: 0.5 }).map(c => (c.hour === 16 ? { ...c, precip: 5 } : c));
        const r = bulletin(wet).rain!;
        expect(r.episodes.map(e => [e.from, e.to, e.hours])).toEqual([
            [9, 12, 2],
            [15, 18, 3],
        ]);
        expect(r.episodes[1].total).toBeCloseTo(6, 6);
        expect([r.episodes[1].peak, r.episodes[1].peakHour]).toEqual([5, 16]);
        // Ensemble de la journée
        expect([r.from, r.to, r.hours]).toEqual([9, 18, 5]);
        expect(r.total).toBeCloseTo(7, 6);
    });

    it('averses, neige et limite pluie-neige 300 m sous l’isotherme 0 °C', () => {
        const showers = bulletin(calmDay([14, 15], { precip: 1, showerBase: 1500, showerTop: 4000, freezing: 2100 })).rain!;
        expect(showers.showers).toBe(true);
        expect(showers.snow).toBe(false);
        expect(showers.snowLine).toBeCloseTo(1800, 6);
        expect(bulletin(calmDay([14, 15], { precip: 1, snow: 1 })).rain!.snow).toBe(true);
        expect(bulletin(calmDay()).rain).toBeNull();
    });

    it('sol mouillé au lever du jour à partir de 2 mm tombés dans les 24 h précédentes', () => {
        expect(bulletin(calmDay().map(c => ({ ...c, recentRain: 5 }))).wetGround).toBe(5);
        expect(bulletin(calmDay().map(c => ({ ...c, recentRain: 1 }))).wetGround).toBeNull();
    });

    it('étages de nuages et altitude des plus bas', () => {
        // Nuages au premier niveau au-dessus du sol (étage bas) le matin, ciel clair l'après-midi
        const cloudy = calmDay().map(c =>
            c.hour < 13
                ? { ...c, cloudCover: 0.9, highCloud: 0, profile: c.profile.map((p, k) => ({ ...p, cloud: k === 1 ? 90 : 0 })) }
                : { ...c, highCloud: 0, profile: c.profile.map(p => ({ ...p, cloud: 0 })) },
        );
        const { am, pm } = bulletin(cloudy).sky;
        expect(am!.sky).toBe('overcast');
        expect(am!.decks).toEqual(['low']);
        expect(am!.base).toBe(cloudy[10].profile[1].z);
        expect(pm!.sky).toBe('clear');
        expect(pm!.decks).toEqual([]);
        expect(pm!.base).toBeNull();
    });

    it('voile de nuages élevés : couvert par l’étage élevé seulement', () => {
        const veiled = calmDay().map(c => ({ ...c, cloudCover: 0.8, highCloud: 0.8, profile: c.profile.map(p => ({ ...p, cloud: 0 })) }));
        const { am } = bulletin(veiled).sky;
        expect(am!.sky).toBe('veil');
        expect(am!.decks).toEqual(['high']);
    });

    it('cumulus des thermiques : heures, bases et sommet de la journée', () => {
        expect(bulletin(calmDay()).cumulus).toBeNull();
        const cu = calmDay([12, 13, 14], { ceiling: 1700, cuBase: 1800, cuTop: 2600, cuTopCapped: false }).map(c =>
            c.hour === 14 ? { ...c, cuBase: 2100, cuTop: 4300 } : c,
        );
        expect(bulletin(cu).cumulus).toEqual({ from: 12, to: 15, baseMin: 1800, baseMax: 2100, top: 4300, capped: false, depth: 2200 });
    });

    it('cumulus sans thermique exploitable (air saturé sous un ciel couvert) : pas cités', () => {
        const cu = calmDay([12, 13, 14], { ceiling: 1700, cuBase: 1800, cuTop: 2600, cuTopCapped: false }).map(c =>
            c.hour === 14 ? { ...c, ceiling: null, cuBase: 1600, cuTop: 5000 } : c,
        );
        expect(bulletin(cu).cumulus).toMatchObject({ from: 12, to: 14, baseMin: 1800, top: 2600 });
        expect(bulletin(cu.map(c => ({ ...c, ceiling: null }))).cumulus).toBeNull();
    });

    it('brume ou brouillard possible : air saturé au sol, sans vent ni pluie, en début de matinée', () => {
        const spread = (k: number, wind = 1) => calmDay().map(c => ({ ...c, td2m: c.t2m - (c.hour <= 9 ? k : 8), windSurf: wind }));
        expect(bulletin(spread(0.3)).fog).toBe(true);
        expect(bulletin(spread(3)).fog).toBe(false);
        expect(bulletin(spread(0.3, 5)).fog).toBe(false);
        // Sous la pluie, un air saturé n'est pas du brouillard
        expect(bulletin(spread(0.3).map(c => ({ ...c, precip: 1 }))).fog).toBe(false);
    });
});

describe('bulletin de la journée', () => {
    it('Doussard, 29/09 : journée sèche, sans orage ni front', () => {
        const cols = dayOf(doussard, 0);
        const b = bulletinOf(cols, DOUSSARD.lat, DOUSSARD.lon)!;
        expect(b.rain).toBeNull();
        expect(b.storm).toBeNull();
        expect(b.overdevFrom).toBeNull();
        expect(b.fronts).toEqual([]);
        expect(b.ground).toBe(cols[0].ground);
        expect(b.tMin).toBe(Math.min(...cols.map(c => c.t2m)));
        expect(b.tMax).toBe(Math.max(...cols.map(c => c.t2m)));

        // Thermiques de 11 h à 17 h ; meilleure montée et plafond le plus haut : ceux des colonnes de la journée
        const t = b.thermals!;
        expect([t.from, t.to]).toEqual([11, 17]);
        expect(t.climb).toBe(Math.max(...cols.map(c => c.climb)));
        expect(t.bestHour).toBe(cols.find(c => c.climb === t.climb)!.hour);
        expect(t.ceiling).toBe(Math.max(...cols.map(c => c.ceiling ?? 0)));
    });

    it('Doussard, 30/09 : la pluie arrive à 14 h et dure jusqu’à minuit', () => {
        const b = bulletinOf(dayOf(doussard, 1), DOUSSARD.lat, DOUSSARD.lon)!;
        expect(b.rain!.from).toBe(14);
        expect(b.rain!.to).toBe(24);
        expect(b.rain!.showers).toBe(false);
    });

    it('Doussard, 01/10 : ciel couvert et pluie, pas de thermique', () => {
        const b = bulletinOf(dayOf(doussard, 2), DOUSSARD.lat, DOUSSARD.lon)!;
        expect([b.sky.am!.sky, b.sky.pm!.sky]).toEqual(['overcast', 'overcast']);
        expect(b.rain).not.toBeNull();
        expect(b.thermals).toBeNull();
        expect(b.cumulus).toBeNull();
    });

    it('Saint-André, 29/09 : ciel dégagé, vent donné à 2 000 et 3 000 m, rafales de jour', () => {
        const cols = dayOf(saintAndre, 0);
        const b = bulletinOf(cols, SAINT_ANDRE.lat, SAINT_ANDRE.lon)!;
        // Sol du modèle à 1 052 m : vent donné à 2 000 et 3 000 m
        expect(b.wind.levels.map(l => l.z)).toEqual([2000, 3000]);
        const day = daylightOf(cols, SAINT_ANDRE.lat, SAINT_ANDRE.lon);
        expect(b.wind.gust!.speed).toBe(Math.max(...day.map(c => c.gust ?? 0)));
        expect([b.sky.am!.sky, b.sky.pm!.sky]).toEqual(['clear', 'clear']);
        expect(b.sky.am!.decks).toEqual([]);
    });

    it('fronts rangés par rapport à la journée : pendant, la veille (froid seulement), la nuit suivante', () => {
        const cols = dayOf(doussard, 1);
        const front = (ts: number, kind: Front['kind'] = 'cold'): Front => ({
            kind,
            at: { ...cols[0], ts },
            tempChange: kind === 'cold' ? -4 : 4,
            windZ: 2000,
            before: null,
            after: null,
            turns: false,
            rain: 2,
            gust: null,
        });
        const start = cols[0].ts;
        const end = cols[cols.length - 1].ts;
        const all = [front(start - 20 * HOUR), front(start - 5 * HOUR, 'warm'), front(start - 3 * HOUR), front(start + 10 * HOUR), front(end + 4 * HOUR, 'warm'), front(end + 9 * HOUR)];
        const b = bulletinOf(cols, DOUSSARD.lat, DOUSSARD.lon, all)!;
        expect(b.fronts).toEqual([all[3]]);
        expect(b.frontBefore).toBe(all[2]);
        expect(b.frontAfter).toBe(all[4]);
    });

    it('surdéveloppement : première heure de jour, sauf les jours d’orage probable', () => {
        const bulletin = (cols: Column[]) => bulletinOf(cols, DOUSSARD.lat, DOUSSARD.lon)!;
        expect(bulletin(calmDay([15, 16], { stormRisk: 1 })).overdevFrom).toBe(15);
        const stormy = bulletin(calmDay([15, 16], { stormRisk: 1 }).map(c => (c.hour === 17 ? { ...c, stormRisk: 2 as const } : c)));
        expect(stormy.overdevFrom).toBeNull();
        expect([stormy.storm!.level, stormy.storm!.from.hour]).toEqual([2, 17]);
    });

    it('pas de bulletin sans heure de jour', () => {
        expect(bulletinOf(dayOf(doussard, 0).filter(c => c.hour < 5), DOUSSARD.lat, DOUSSARD.lon)).toBeNull();
        expect(bulletinOf([], DOUSSARD.lat, DOUSSARD.lon)).toBeNull();
    });
});
