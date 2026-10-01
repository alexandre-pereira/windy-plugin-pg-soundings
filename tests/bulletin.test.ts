import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { bulletinOf, type Front, frontsOf, GUST_LIMITS, LOW_WIND_LIMITS, rateHours, WIND_LIMITS } from '../src/bulletin';
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

const rate = (cols: Column[]) => rateHours(cols, DOUSSARD.lat, DOUSSARD.lon);
const at = (cols: Column[], hour: number) => rate(cols).find(h => h.col.hour === hour)!;

describe('conditions de chaque heure', () => {
    it('air calme : niveau 0 à toute heure, heures de jour entre le lever et le coucher du soleil', () => {
        const hours = rate(calmDay());
        expect(hours.every(h => h.level === 0 && h.limit === null)).toBe(true);
        // Fin septembre à Doussard : soleil levé de 7 h 30 à 19 h 20 environ
        expect(hours.filter(h => h.daylight).map(h => h.col.hour)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    });

    it('le critère le plus exigeant fixe le niveau', () => {
        const cases: [Partial<Column>, number, string][] = [
            [{ gust: (GUST_LIMITS[0] + 2) * KMH }, 1, 'gust'],
            [{ gust: (GUST_LIMITS[1] + 2) * KMH }, 2, 'gust'],
            [{ gust: (GUST_LIMITS[2] + 2) * KMH }, 3, 'gust'],
            [{ windSurf: (WIND_LIMITS[0] + 2) * KMH }, 1, 'wind'],
            [{ windSurf: (WIND_LIMITS[2] + 2) * KMH }, 3, 'wind'],
            [{ climb: 1.5 }, 1, 'thermal'],
            [{ climb: 3 }, 2, 'thermal'],
            [{ choppy: 1 }, 1, 'choppy'],
            [{ choppy: 2 }, 2, 'choppy'],
            [{ stormRisk: 1 }, 2, 'overdev'],
            [{ precip: 0.5 }, 3, 'rain'],
        ];
        for (const [change, level, limit] of cases) {
            const h = at(calmDay([14], change), 14);
            expect([h.level, h.limit], JSON.stringify(change)).toEqual([level, limit]);
        }
    });

    it('un seuil atteint fait passer au niveau suivant : rafales de 20 km/h modérées, de 30 km/h fortes', () => {
        expect(GUST_LIMITS).toEqual([20, 30, 40]);
        const cases: [Partial<Column>, number][] = [
            [{ gust: 19 * KMH }, 0],
            [{ gust: 20 * KMH }, 1],
            [{ gust: 29 * KMH }, 1],
            [{ gust: 30 * KMH }, 2],
            [{ gust: 40 * KMH }, 3],
            [{ windSurf: WIND_LIMITS[1] * KMH }, 2],
            [{ climb: 1 }, 1],
        ];
        for (const [change, level] of cases) {
            expect(at(calmDay([14], change), 14).level, JSON.stringify(change)).toBe(level);
        }
    });

    it('le vent des basses couches compte autant que le vent au sol', () => {
        const speed = (LOW_WIND_LIMITS[1] + 5) * KMH;
        const windy = calmDay().map(c =>
            c.hour === 14 ? { ...c, profile: c.profile.map((p, k) => (k === 0 ? p : { ...p, u: speed, v: 0 })) } : c,
        );
        const h = at(windy, 14);
        expect([h.level, h.limit]).toEqual([2, 'wind']);
        expect(h.lowWind / KMH).toBeCloseTo(LOW_WIND_LIMITS[1] + 5, 0);
    });

    it('vent et pluie ensemble : c’est le vent qui est retenu', () => {
        expect(at(calmDay([14], { precip: 2, windSurf: 50 * KMH }), 14).limit).toBe('wind');
    });

    it('orage probable : conditions défavorables à ±2 h, plus de conditions calmes à moins de 4 h', () => {
        const levels = rate(calmDay([15], { stormRisk: 2 })).map(h => [h.col.hour, h.level, h.limit]);
        const byHour = new Map(levels.map(([hour, level, limit]) => [hour, [level, limit]]));
        for (const hour of [13, 14, 15, 16, 17]) expect(byHour.get(hour)).toEqual([3, 'storm']);
        for (const hour of [11, 12, 18, 19]) expect(byHour.get(hour)).toEqual([1, 'storm']);
        expect(byHour.get(10)).toEqual([0, null]);
        expect(byHour.get(20)).toEqual([0, null]);
    });
});

describe('créneaux', () => {
    const slots = (cols: Column[]) => bulletinOf(cols, DOUSSARD.lat, DOUSSARD.lon)!;

    it('journée d’air calme : un seul créneau, sur toutes les heures de jour', () => {
        const b = slots(calmDay());
        expect(b.calm).toEqual([{ from: 8, to: 19, hours: 11 }]);
        expect(b.moderate).toEqual(b.calm);
        expect(b.verdict).toBe('calm');
    });

    it('une seule heure d’un niveau au-dessus coupe un créneau, même à peine au-dessus du seuil', () => {
        const b = slots(calmDay([13], { climb: 1.2 }));
        expect(b.calm).toEqual([
            { from: 8, to: 13, hours: 5 },
            { from: 14, to: 19, hours: 5 },
        ]);
        expect(b.moderate).toEqual([{ from: 8, to: 19, hours: 11 }]);
        expect(slots(calmDay([13], { climb: 3 })).moderate).toEqual(b.calm);
    });

    it('les créneaux suivent les cases du bandeau : toutes les suites d’au moins 2 h de jour du niveau, et elles seules', () => {
        // Suites d'heures de jour consécutives dont le niveau ne dépasse pas `max`, lues sur le bandeau
        const runs = (b: ReturnType<typeof slots>, max: number) => {
            const out: { from: number; to: number; hours: number }[] = [];
            let from: number | null = null;
            const day = b.hours.filter(h => h.daylight);
            day.forEach((h, i) => {
                if (h.level <= max) from ??= h.col.hour;
                const last = i === day.length - 1;
                if (from != null && (h.level > max || last)) {
                    const to = h.level > max ? h.col.hour : h.col.hour + 1;
                    if (to - from >= 2) out.push({ from, to, hours: to - from });
                    from = null;
                }
            });
            return out;
        };
        const days = [
            ...[0, 1, 2].map(n => bulletinOf(dayOf(doussard, n), DOUSSARD.lat, DOUSSARD.lon)!),
            ...[0, 1, 2].map(n => bulletinOf(dayOf(saintAndre, n), SAINT_ANDRE.lat, SAINT_ANDRE.lon)!),
            // Niveaux mêlés : heures isolées, suites courtes, pluie
            slots(calmDay([9, 13, 14, 17], { climb: 1.2 }).map(c => (c.hour === 11 ? { ...c, precip: 1 } : c.hour === 16 ? { ...c, climb: 3 } : c))),
        ];
        for (const b of days) {
            expect(b.calm).toEqual(runs(b, 0));
            expect(b.moderate).toEqual(runs(b, 1));
        }
        // 8 h calme, 9 h modérée, 10 h calme, 11 h pluie, 12 h calme, 13–14 h modérées, 15 h calme, 16 h forte, 17 h modérée, 18 h calme
        expect(days[6].calm).toEqual([]);
        expect(days[6].moderate).toEqual([
            { from: 8, to: 11, hours: 3 },
            { from: 12, to: 16, hours: 4 },
            { from: 17, to: 19, hours: 2 },
        ]);
    });

    it('une heure de pluie coupe toujours un créneau', () => {
        expect(slots(calmDay([13], { precip: 1 })).calm).toEqual([
            { from: 8, to: 13, hours: 5 },
            { from: 14, to: 19, hours: 5 },
        ]);
    });

    it('un créneau dure au moins 2 h', () => {
        const b = slots(calmDay([8, 9, 10, 11, 13, 14, 15, 16, 17, 18], { precip: 1 }));
        expect(b.calm).toEqual([]);
        expect(b.verdict).toBe('adverse');
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
    it('Doussard, 29/09 : journée thermique, air calme le matin et en fin de journée', () => {
        const b = bulletinOf(dayOf(doussard, 0), DOUSSARD.lat, DOUSSARD.lon)!;
        expect(b.verdict).toBe('thermal');
        expect(b.moderate).toEqual([{ from: 8, to: 19, hours: 11 }]);
        expect(b.calm.map(s => [s.from, s.to])).toEqual([
            [8, 13],
            [16, 19],
        ]);
        expect(b.calmLimit).toBe('thermal');
        expect(b.strongLimit).toBeNull();
        expect(b.rain).toBeNull();
        expect(b.storm).toBeNull();
        expect(b.fronts).toEqual([]);

        const t = b.thermals!;
        expect([t.from, t.to]).toEqual([11, 17]);
        expect(t.easy).toEqual({ from: 11, to: 17, hours: 6 });
        // Meilleure montée et plafond le plus haut : ceux des colonnes de la journée
        const cols = dayOf(doussard, 0);
        expect(t.climb).toBe(Math.max(...cols.map(c => c.climb)));
        expect(t.ceiling).toBe(Math.max(...cols.map(c => c.ceiling ?? 0)));
        expect(t.depth).toBe(t.ceiling - cols[0].ground);
    });

    it('Doussard, 30/09 : conditions calmes jusqu’à l’arrivée de la pluie', () => {
        const b = bulletinOf(dayOf(doussard, 1), DOUSSARD.lat, DOUSSARD.lon)!;
        expect(b.verdict).toBe('windows');
        expect(b.moderate).toEqual([{ from: 8, to: 14, hours: 6 }]);
        expect(b.strongLimit).toBe('rain');
        expect(b.rain!.from).toBe(14);
        expect(b.rain!.to).toBe(24);
        expect(b.rain!.showers).toBe(false);
    });

    it('Doussard, 01/10 : pluie toute la journée, conditions défavorables', () => {
        const b = bulletinOf(dayOf(doussard, 2), DOUSSARD.lat, DOUSSARD.lon)!;
        expect(b.verdict).toBe('adverse');
        expect(b.calm).toEqual([]);
        expect(b.moderate).toEqual([]);
        expect(b.strongLimit).toBe('rain');
        expect([b.sky.am!.sky, b.sky.pm!.sky]).toEqual(['overcast', 'overcast']);
        expect(b.thermals).toBeNull();
    });

    it('Saint-André, 29/09 : conditions fortes toute la journée, à cause du vent des basses couches et des rafales', () => {
        const b = bulletinOf(dayOf(saintAndre, 0), SAINT_ANDRE.lat, SAINT_ANDRE.lon)!;
        // Moins de 15 km/h au sol, mais 19 à 23 km/h dans les basses couches et des rafales de 33 à 38 km/h
        expect(b.verdict).toBe('strong');
        expect(b.calm).toEqual([]);
        expect(b.moderate).toEqual([]);
        expect(b.calmLimit).toBe('wind');
        expect(b.strongLimit).toBe('wind');
        expect(b.hours.filter(h => h.daylight).every(h => h.level === 2)).toBe(true);
        // Sol du modèle à 1 052 m : vent donné à 2 000 et 3 000 m
        expect(b.wind.levels.map(l => l.z)).toEqual([2000, 3000]);
        expect(b.wind.gust!.speed).toBe(Math.max(...b.hours.filter(h => h.daylight).map(h => h.col.gust ?? 0)));
        expect([b.sky.am!.sky, b.sky.pm!.sky]).toEqual(['clear', 'clear']);
        expect(b.sky.am!.decks).toEqual([]);
    });

    it('un créneau calme est toujours dans un créneau calme à modéré', () => {
        for (const [cols, site] of [
            [doussard, DOUSSARD],
            [saintAndre, SAINT_ANDRE],
        ] as const) {
            for (const n of [0, 1, 2]) {
                const b = bulletinOf(dayOf(cols, n), site.lat, site.lon)!;
                for (const s of b.calm) {
                    expect(b.moderate.some(f => f.from <= s.from && f.to >= s.to)).toBe(true);
                }
            }
        }
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

    it('pas de bulletin sans heure de jour', () => {
        expect(bulletinOf(dayOf(doussard, 0).filter(c => c.hour < 5), DOUSSARD.lat, DOUSSARD.lon)).toBeNull();
        expect(bulletinOf([], DOUSSARD.lat, DOUSSARD.lon)).toBeNull();
    });
});
