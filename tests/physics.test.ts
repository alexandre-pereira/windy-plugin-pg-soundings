import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { toHourly } from '../src/interpolate';
import {
    buildColumns,
    capeColor,
    CIRCLING_SINK,
    type Column,
    CORE_FACTOR,
    dewPointFromMixingRatio,
    type ForecastPayload,
    hasCumulus,
    INSTABILITY_COLORS,
    isSevereEnv,
    isShower,
    lclHeight,
    liftedIndexColor,
    moistLapse,
    netClimb,
    parcelAscent,
    pressureAt,
    rainLayer,
    satMixingRatio,
    showerHours,
    type StormInputs,
    stormRiskOf,
    stormWatchOf,
    sunElevation,
    thermalEase,
    thermalShape,
    varioAt,
} from '../src/physics';

/** Prévisions ECMWF réelles enregistrées le 29/09/2026 (Doussard, Saint-André-les-Alpes) */
const fixture = (file: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8'));
const doussard = fixture('doussard.json');
const saintAndre = fixture('saint-andre.json');

const SITES = [
    { name: 'Doussard', payload: doussard, lat: 45.78, lon: 6.22 },
    { name: 'Saint-André', payload: saintAndre, lat: 43.97, lon: 6.5 },
];

const columnsOf = (payload: unknown, lat: number, lon: number) => {
    const p = toHourly(structuredClone(payload) as ForecastPayload, lat, lon);
    return buildColumns(p, lat, lon);
};

describe('formules de base', () => {
    it('hauteur du soleil (Paris, solstices à midi solaire)', () => {
        expect(sunElevation(Date.UTC(2026, 5, 21, 11, 50), 48.85, 2.35)).toBeCloseTo(64.6, 0);
        expect(sunElevation(Date.UTC(2026, 11, 21, 11, 58), 48.85, 2.35)).toBeCloseTo(17.7, 0);
    });

    it('gradient pseudo-adiabatique', () => {
        expect(moistLapse(293.15, 1000) * 1000).toBeCloseTo(4.2, 1);
        expect(moistLapse(273.15, 700) * 1000).toBeCloseTo(5.8, 1);
    });

    it('niveau de condensation (Bolton) ≈ 125 m par degré d’écart', () => {
        expect(Math.abs(lclHeight(0, 298.15, 283.15) - 1870)).toBeLessThan(40);
        expect(lclHeight(500, 290, null)).toBe(Infinity);
    });
});

describe('profil des thermiques', () => {
    it('nul sous le sol et au sommet', () => {
        expect(thermalShape(0)).toBe(0);
        expect(thermalShape(-0.1)).toBe(0);
        expect(thermalShape(1)).toBe(0);
    });

    it('pleine force dès le sol : pas de bande sans ascendance au ras du relief', () => {
        expect(thermalShape(0.001)).toBeGreaterThan(0.99);
        expect(thermalShape(0.15)).toBeGreaterThan(0.99);
    });

    it('décroît au sommet : les thermiques s’essoufflent sous l’inversion', () => {
        expect(thermalShape(0.5)).toBeGreaterThan(thermalShape(0.8));
        expect(thermalShape(0.9)).toBeLessThan(0.4);
        expect(thermalShape(0.97)).toBeLessThan(0.15);
    });

    it('montée au vario = cœur du thermique moins le taux de chute en spirale', () => {
        expect(netClimb(2)).toBeCloseTo(CORE_FACTOR * 2 - CIRCLING_SINK, 6);
        expect(netClimb(0.5)).toBe(0);
    });
});

describe.each(SITES)('prévision réelle : $name', ({ payload, lat, lon }) => {
    const cols = columnsOf(payload, lat, lon);

    it('une colonne par heure, heures locales qui se suivent', () => {
        expect(cols.length).toBeGreaterThan(48);
        for (let k = 1; k < cols.length; k++) {
            expect(cols[k].ts - cols[k - 1].ts).toBe(3600e3);
            expect(cols[k].hour).toBe((cols[k - 1].hour + 1) % 24);
        }
        expect(cols.every(c => c.utcOffset === 2)).toBe(true);
    });

    it('plafond ≤ sommet thermique, et sous la base des cumulus', () => {
        for (const c of cols) {
            if (c.ceiling == null) continue;
            expect(c.thermalTop).not.toBeNull();
            expect(c.ceiling).toBeLessThanOrEqual(c.thermalTop! + 1);
            if (c.cuBase != null) expect(c.ceiling).toBeLessThanOrEqual(c.cuBase + 1);
        }
    });

    it('valeurs plausibles (w*, vario, vent de couche, CAPE)', () => {
        for (const c of cols) {
            expect(c.wStar).toBeGreaterThanOrEqual(0);
            expect(c.wStar).toBeLessThan(4);
            expect(c.climb).toBe(c.ceiling == null ? 0 : netClimb(c.wStar));
            expect(c.blSpeed).toBeGreaterThanOrEqual(0);
            expect(c.cape).toBeGreaterThanOrEqual(0);
            expect([0, 1, 2]).toContain(c.choppy);
            // La nuit, pas de thermique
            if (c.sunElev < 0) expect(c.ceiling).toBeNull();
        }
    });

    it('la montée au vario à une altitude ne dépasse jamais la montée max', () => {
        for (const c of cols) {
            for (let z = c.ground; z < c.ground + 4000; z += 100) {
                expect(varioAt(c, z)).toBeLessThanOrEqual(c.climb + 1e-9);
            }
        }
    });
});

describe('sol enneigé', () => {
    it('la neige tombée dans les 48 h affaiblit les thermiques', () => {
        const dry = columnsOf(saintAndre, 43.97, 6.5);
        const snowy = structuredClone(saintAndre) as ForecastPayload;
        // 1 mm d'eau de neige par heure pendant les 10 premières heures de la prévision
        snowy.data.precipAmount = snowy.data.precipAmount!.map((v, k) => (k < 10 ? 1 : v));
        snowy.data.precipSnowAmount = snowy.data.precipAmount.map((v, k) => (k < 10 ? 1 : 0));
        const cols = columnsOf(snowy, 43.97, 6.5);
        const at = (list: typeof dry) => list.find(c => c.hour === 13 && c.wStar > 0)!;
        expect(at(cols).wStar).toBeLessThan(0.85 * at(dry).wStar);
    });
});

describe('plafond exploitable', () => {
    it('reste nettement sous le sommet des thermiques les jours forts', () => {
        const cols = columnsOf(saintAndre, 43.97, 6.5);
        const strong = cols.filter(c => c.wStar >= 2 && c.ceiling != null && c.cuBase == null);
        expect(strong.length).toBeGreaterThan(0);
        for (const c of strong) {
            const depth = c.thermalTop! - c.ground;
            expect(c.thermalTop! - c.ceiling!).toBeGreaterThan(0.05 * depth);
        }
    });
});

describe('facilité d’exploitation des thermiques', () => {
    const cols = columnsOf(saintAndre, 43.97, 6.5);
    // Une bonne heure de thermiques, sans vent
    const good = { ...cols.find(c => c.ceiling != null)!, climb: 1.5, choppy: 0 as const };
    good.ceiling = good.ground + 1200;

    it('pas de thermique exploitable : rien à afficher', () => {
        for (const c of cols) expect(thermalEase(c) == null).toBe(c.ceiling == null);
    });

    it('faciles quand ils montent bien, assez haut, sans vent fort', () => {
        expect(thermalEase(good)).toBe('easy');
    });

    it('délicats quand ils montent peu ou que le plafond est bas', () => {
        expect(thermalEase({ ...good, climb: 0.3 })).toBe('weak');
        expect(thermalEase({ ...good, ceiling: good.ground + 200 })).toBe('low');
    });

    it('le vent prime : hachés, même forts et hauts', () => {
        expect(thermalEase({ ...good, choppy: 1 })).toBe('choppy');
        expect(thermalEase({ ...good, choppy: 2 })).toBe('rough');
        expect(thermalEase({ ...good, climb: 0.3, choppy: 1 })).toBe('choppy');
    });
});

describe('risque d’orage', () => {
    const C = 273.15;
    // Journée d'été orageuse : gros cumulus des thermiques au sommet glacé, confirmés par le modèle
    const stormy: StormInputs = {
        cumulus: { cape: 1500, depth: 5000, topTemp: C - 30, modelCloud: 0.6, dryMid: false },
        cape: 800,
        muCape: 800,
        muTopTemp: C - 40,
        severe: false,
        precip: 0,
        convRain: 0,
        rainNear: 0.5,
        deepCloud: 0,
    };
    const risk = (patch: Partial<StormInputs>, cu: Partial<NonNullable<StormInputs['cumulus']>> = {}) =>
        stormRiskOf({ ...stormy, ...patch, cumulus: { ...stormy.cumulus!, ...cu } });

    it('orage probable : cumulus épais au sommet glacé, énergie standard suffisante', () => {
        expect(risk({})).toBe(2);
    });

    it('sans pluie du modèle à ±1 h, les cumulus des thermiques restent un surdéveloppement', () => {
        expect(risk({ rainNear: 0 })).toBe(1);
        // Même en air sec : l'énergie d'un orage reste un signal de surdéveloppement
        expect(risk({ rainNear: 0 }, { dryMid: true })).toBe(1);
    });

    it('pas d’orage sans sommet plus froid que −20 °C (pas de glace, pas d’éclairs)', () => {
        expect(risk({}, { topTemp: C - 12 })).toBe(1);
    });

    it('les seuils de l’orage portent sur la CAPE standard, pas sur celle des thermiques surchauffés', () => {
        expect(risk({ cape: 150 })).toBe(1);
    });

    it('sans nuages ni averses du modèle, les cumulus des thermiques ne donnent rien', () => {
        expect(risk({}, { modelCloud: 0.1 })).toBe(0);
    });

    it('l’air sec en altitude étouffe les cumulus moyens, pas un orage', () => {
        expect(risk({}, { dryMid: true })).toBe(2);
        expect(risk({}, { depth: 2500, dryMid: true })).toBe(0);
        expect(risk({}, { depth: 2500 })).toBe(1);
    });

    it('orage du modèle sans thermiques (soir, ciel couvert, orage venu d’ailleurs)', () => {
        const night = { ...stormy, cumulus: null, rainNear: 0 };
        expect(stormRiskOf(night)).toBe(0);
        expect(stormRiskOf({ ...night, convRain: 1 })).toBe(2);
        expect(stormRiskOf({ ...night, precip: 2, deepCloud: 0.8 })).toBe(2);
        // Pluie de front en air stable : pas d'orage
        expect(stormRiskOf({ ...night, cape: 20, muCape: 20, precip: 5, deepCloud: 1 })).toBe(0);
    });

    it('orage venu d’ailleurs sur un air stable près du sol : c’est l’air le plus instable qui compte', () => {
        const evening = { ...stormy, cumulus: null, rainNear: 0, cape: 30, convRain: 1 };
        expect(stormRiskOf({ ...evening, muCape: 600 })).toBe(2);
        expect(stormRiskOf({ ...evening, muCape: 30 })).toBe(0);
    });

    it('orage violent possible : un orage probable dans un air propice, pas un simple surdéveloppement', () => {
        expect(risk({ severe: true })).toBe(3);
        expect(risk({ severe: true, rainNear: 0 })).toBe(1);
        expect(stormRiskOf({ ...stormy, cumulus: null, rainNear: 0, severe: true })).toBe(0);
    });
});

describe('air propice aux orages violents', () => {
    it('instabilité très forte, même sans vent en altitude', () => {
        expect(isSevereEnv({ cape: 1500, liftedIndex: -7, shear: 3 })).toBe(true);
        expect(isSevereEnv({ cape: 1500, liftedIndex: -5, shear: 3 })).toBe(false);
    });

    it('air instable et vent fort en altitude : orages organisés', () => {
        // √(2 × 800) × 18 = 720 m²/s²
        expect(isSevereEnv({ cape: 800, liftedIndex: -4, shear: 18 })).toBe(true);
        // Même vent, peu d'énergie : √(2 × 150) × 18 = 312 m²/s²
        expect(isSevereEnv({ cape: 150, liftedIndex: -2.5, shear: 18 })).toBe(false);
    });

    it('un vent fort en altitude ne suffit pas sans air nettement instable', () => {
        // √(2 × 300) × 30 = 735 m²/s², mais indice de soulèvement à peine négatif
        expect(isSevereEnv({ cape: 300, liftedIndex: -1, shear: 30 })).toBe(false);
        expect(isSevereEnv({ cape: 300, liftedIndex: -2.5, shear: 30 })).toBe(true);
    });

    it.each(SITES)('prévision réelle, $name : la particule la plus instable a au moins l’énergie standard', ({ payload, lat, lon }) => {
        for (const c of columnsOf(payload, lat, lon)) {
            expect(c.muCape).toBeGreaterThanOrEqual(c.cape);
            if (c.liftedIndex != null) expect(c.muLiftedIndex).toBeLessThanOrEqual(c.liftedIndex);
            expect(c.shear).toBeGreaterThanOrEqual(0);
            expect(Math.hypot(c.steerU, c.steerV)).toBeLessThan(80);
            // Fin septembre sans orage : rien de violent
            expect(c.stormRisk).toBeLessThan(3);
        }
    });
});

describe('alerte d’orage de la journée', () => {
    // Une journée de la prévision réelle (heures locales 0–23), rendue calme puis orageuse à la demande
    const day = columnsOf(saintAndre, 43.97, 6.5)
        .filter(c => new Date(c.ts + 2 * 3600e3).getUTCDate() === 30)
        .map((c): Column => ({ ...c, stormRisk: 0, severeEnv: false, precip: 0, gust: 5, profile: c.profile.map(p => ({ ...p, cloud: 0 })) }));
    /** Profil d'une heure, couvert à 90 % au niveau de pression donné */
    const overcastAt = (hour: number, hPa: number) =>
        day.find(c => c.hour === hour)!.profile.map(p => (p.p === hPa ? { ...p, cloud: 90 } : p));
    const withStorm = (patch: Record<number, Partial<Column>>) => day.map(c => ({ ...c, ...patch[c.hour] }));

    it('journée complète', () => {
        expect(day.map(c => c.hour)).toEqual([...Array(24).keys()]);
    });

    it('rien à signaler sans orage, ni pour un simple surdéveloppement', () => {
        expect(stormWatchOf(day)).toBeNull();
        expect(stormWatchOf(withStorm({ 15: { stormRisk: 1 } }))).toBeNull();
    });

    it('orage probable : première heure, déplacement, heure calme qui précède', () => {
        const w = stormWatchOf(
            withStorm({
                17: { stormRisk: 2, steerU: 10, steerV: 10, gust: 14 },
                18: { stormRisk: 2, gust: 18 },
            }),
        )!;
        expect(w.level).toBe(2);
        expect(w.from.hour).toBe(17);
        // Vent de 14 m/s (51 km/h) qui souffle vers le nord-est : l'orage vient du sud-ouest
        expect(w.speed).toBeCloseTo(Math.hypot(10, 10), 6);
        expect(w.dir).toBeCloseTo(225, 6);
        expect(w.gust).toBe(18);
        expect(w.calmBefore?.hour).toBe(16);
        expect(w.hidden).toBe(false);
    });

    it('violent dès qu’une heure d’orage l’est ; l’épisode commence à la première heure d’orage', () => {
        const w = stormWatchOf(
            withStorm({
                16: { stormRisk: 2 },
                18: { stormRisk: 3, severeEnv: true, muLiftedIndex: -6.5, shear: 20 },
            }),
        )!;
        expect(w.level).toBe(3);
        expect(w.from.hour).toBe(16);
        expect(w.severeEnv).toBe(true);
        expect(w.liftedIndex).toBe(-6.5);
        expect(w.shear).toBe(20);
    });

    it('un surdéveloppement ou de la pluie l’heure d’avant : l’orage n’arrive pas sans prévenir', () => {
        expect(stormWatchOf(withStorm({ 16: { stormRisk: 1 }, 17: { stormRisk: 2 } }))!.calmBefore).toBeNull();
        expect(stormWatchOf(withStorm({ 16: { precip: 1 }, 17: { stormRisk: 2 } }))!.calmBefore).toBeNull();
    });

    it('ciel déjà couvert l’heure d’avant : l’orage peut rester caché (pas derrière un voile de cirrus)', () => {
        expect(stormWatchOf(withStorm({ 16: { profile: overcastAt(16, 700) }, 17: { stormRisk: 2 } }))!.hidden).toBe(true);
        expect(stormWatchOf(withStorm({ 16: { profile: overcastAt(16, 400) }, 17: { stormRisk: 2 } }))!.hidden).toBe(false);
    });

    it('surdéveloppement dans un air propice aux orages violents : alerte de niveau 1', () => {
        const w = stormWatchOf(withStorm({ 14: { stormRisk: 1 }, 15: { stormRisk: 1, severeEnv: true } }))!;
        expect(w.level).toBe(1);
        expect(w.from.hour).toBe(15);
        expect(w.calmBefore).toBeNull();
        // Un air propice seul, sans convection au modèle, ne déclenche rien
        expect(stormWatchOf(withStorm({ 15: { severeEnv: true } }))).toBeNull();
    });

    it('seulement entre 8 h et 22 h, et pas pour les heures déjà passées', () => {
        expect(stormWatchOf(withStorm({ 3: { stormRisk: 3 }, 23: { stormRisk: 2 } }))).toBeNull();
        const stormy = withStorm({ 12: { stormRisk: 2 }, 18: { stormRisk: 2 } });
        const at = (hour: number) => stormy.find(c => c.hour === hour)!.ts;
        expect(stormWatchOf(stormy, at(11))!.from.hour).toBe(12);
        // À 12 h 30, l'orage de midi est en cours : il reste signalé, sans « heure calme » avant
        expect(stormWatchOf(stormy, at(12) + 1800e3)!.from.hour).toBe(12);
        expect(stormWatchOf(stormy, at(12) + 1800e3)!.calmBefore).toBeNull();
        expect(stormWatchOf(stormy, at(14))!.from.hour).toBe(18);
        expect(stormWatchOf(stormy, at(20))).toBeNull();
    });
});

describe('pastilles de la CAPE et du LI', () => {
    it('quatre paliers, aux seuils de la légende', () => {
        expect([0, 299, 300, 999, 1000, 2499, 2500].map(capeColor)).toEqual(
            [0, 0, 1, 1, 2, 2, 3].map(k => INSTABILITY_COLORS[k]),
        );
        expect([2, 0.1, 0, -2.9, -3, -5.9, -6, -9].map(liftedIndexColor)).toEqual(
            [0, 0, 1, 1, 2, 2, 3, 3].map(k => INSTABILITY_COLORS[k]),
        );
    });
});

describe('nuage d’averses', () => {
    // Pluie sur un air qui a de quoi monter : particule standard instable sur 4 000 m
    const shower = { precip: 0.6, convRain: 0, cape: 150, depth: 4000 };

    it('pluie avec de l’énergie sur une couche épaisse : averse', () => {
        expect(isShower(shower)).toBe(true);
    });

    it('sans pluie, pas de nuage d’averses, quelle que soit l’énergie', () => {
        expect(isShower({ ...shower, precip: 0 })).toBe(false);
        expect(isShower({ ...shower, precip: 0, convRain: 1 })).toBe(false);
    });

    it('pluie de front en air stable, ou convection trop mince : pas une averse', () => {
        expect(isShower({ ...shower, cape: 20 })).toBe(false);
        expect(isShower({ ...shower, depth: 800 })).toBe(false);
    });

    it('précipitations convectives annoncées par le modèle : averse, même sans énergie calculée', () => {
        expect(isShower({ ...shower, cape: 0, depth: 0, convRain: 0.3 })).toBe(true);
    });

    /** Heures qui se suivent : pluie (mm) et pluie convective de l'heure prise seule */
    const rainy = (hours: [number, boolean][]) =>
        showerHours(hours.map(([precip, convective], k) => ({ ts: k * 3600e3, precip, convective })));

    it('une heure convective isolée dans une pluie de front : pas d’averse', () => {
        // Pluie continue de quatre heures, l'énergie ne passe le seuil qu'à la première
        expect(rainy([[0.2, false], [0, false], [2.8, true], [4.1, false], [3.7, false], [0.4, false]])).toEqual(
            Array(6).fill(false),
        );
    });

    it('une heure sous le seuil au milieu des averses : averse aussi', () => {
        expect(rainy([[1, true], [1, true], [1, false], [1, true], [1, true]])).toEqual(Array(5).fill(true));
    });

    it('la pluie change de nature quand le front laisse la place aux averses', () => {
        const hours: [number, boolean][] = [[1, false], [1, false], [1, false], [1, true], [1, true], [1, true]];
        expect(rainy(hours)).toEqual([false, false, false, true, true, true]);
    });

    it('la pluie compte, pas le nombre d’heures : une forte averse l’emporte sur la bruine qui la suit', () => {
        expect(rainy([[0, false], [8, true], [0.3, false], [0.3, false]])).toEqual([false, true, true, true]);
    });

    it('averse seule, loin de toute autre pluie : inchangée, et jamais d’averse sans pluie', () => {
        expect(rainy([[0, true], [0, false], [0, false], [1, true], [0, false], [0, false], [1, false]])).toEqual([
            false,
            false,
            false,
            true,
            false,
            false,
            false,
        ]);
    });

    it.each(SITES)('prévision réelle, $name : seulement aux heures de pluie, base sous le sommet', ({ payload, lat, lon }) => {
        const cols = columnsOf(payload, lat, lon);
        for (const c of cols) {
            expect(c.showerBase == null).toBe(c.showerTop == null);
            if (c.showerBase == null || c.showerTop == null) continue;
            expect(c.precip).toBeGreaterThanOrEqual(0.1);
            expect(c.showerBase).toBeGreaterThanOrEqual(c.ground);
            expect(c.showerTop).toBeGreaterThan(c.showerBase);
        }
    });

    it('Doussard : averses derrière le front (1er octobre), pluie de front la veille en air stable', () => {
        const cols = columnsOf(doussard, 45.78, 6.22);
        const day = (d: number) => cols.filter(c => new Date(c.ts + 2 * 3600e3).getUTCDate() === d && c.precip >= 0.1);
        // 30 septembre après-midi : le front arrive sur un air stable (CAPE ~10 J/kg)
        expect(day(30).filter(c => c.hour >= 14 && c.hour <= 17).every(c => c.showerBase == null)).toBe(true);
        // 1er octobre, milieu de journée : pluie sous ciel couvert, sans thermiques, mais air instable
        const showers = day(1).filter(c => c.hour >= 11 && c.hour <= 16);
        expect(showers.length).toBeGreaterThan(3);
        expect(showers.every(c => c.cuBase == null && c.showerBase != null)).toBe(true);
    });

    it('Doussard : la nature de la pluie ne change pas pour une heure au ras du seuil', () => {
        const cols = columnsOf(doussard, 45.78, 6.22);
        const at = (d: number, hour: number) => cols.find(c => new Date(c.ts + 2 * 3600e3).getUTCDate() === d && c.hour === hour)!;
        // 30 septembre, 19 h : première heure au-dessus du seuil (58 J/kg), encore dans la pluie du front
        expect(at(30, 19).cape).toBeGreaterThanOrEqual(50);
        expect(at(30, 19).showerBase).toBeNull();
        expect(at(30, 20).showerBase).not.toBeNull();
        // 1er octobre, 22 h : dernière heure des averses, à peine sous le seuil (49 J/kg)
        expect(at(1, 22).cape).toBeLessThan(50);
        expect(at(1, 22).showerBase).not.toBeNull();
        // 7 h – 9 h : trois heures sous le seuil entre deux séries d'averses restent une pluie de couches
        expect([7, 8, 9].every(h => at(1, h).showerBase == null)).toBe(true);
    });
});

describe('couche de nuages qui donne la pluie', () => {
    const level = (z: number, cloud: number) => ({ z, t: 280, td: 278, u: 0, v: 0, cloud, p: 1000 - z / 10 });

    it('base au plus bas niveau où la nébulosité atteint 50 %, sommet au dernier niveau si elle y reste', () => {
        const { base, top } = rainLayer([level(500, 0), level(1500, 0), level(2500, 100), level(4000, 100)])!;
        expect(base).toBeGreaterThan(1500);
        expect(base).toBeLessThan(2500);
        expect(top).toBe(4000);
    });

    it('couche épaisse sous un ciel dégagé : le sommet s’arrête où la nébulosité retombe', () => {
        const { base, top } = rainLayer([level(500, 0), level(1000, 95), level(3000, 95), level(4000, 0), level(6000, 0)])!;
        expect(base).toBeLessThan(1000);
        expect(top).toBeGreaterThan(3000);
        expect(top).toBeLessThan(4000);
    });

    it('deux couches séparées : la plus basse', () => {
        const { base, top } = rainLayer([level(500, 0), level(1000, 90), level(2000, 0), level(3000, 0), level(4000, 90)])!;
        expect(base).toBeLessThan(1000);
        expect(top).toBeLessThan(2000);
    });

    it('voile peu dense : la moitié de sa plus forte nébulosité', () => {
        const { base } = rainLayer([level(500, 0), level(1500, 0), level(2500, 30), level(4000, 10)])!;
        expect(base).toBeGreaterThan(1500);
        expect(base).toBeLessThanOrEqual(2500);
    });

    it('sans nuage dans le profil : pas de couche', () => {
        expect(rainLayer([level(500, 0), level(1500, 2), level(4000, 0)])).toBeNull();
    });

    it.each(SITES)('prévision réelle, $name : une couche au-dessus du sol à chaque heure de pluie', ({ payload, lat, lon }) => {
        const wet = columnsOf(payload, lat, lon).filter(c => c.precip >= 0.1);
        expect(wet.length).toBeGreaterThan(5);
        for (const c of wet) {
            const layer = rainLayer(c.profile);
            expect(layer).not.toBeNull();
            expect(layer!.base).toBeGreaterThan(c.ground);
            expect(layer!.top).toBeGreaterThanOrEqual(layer!.base);
        }
    });
});

describe('cumulus des thermiques affichés', () => {
    it('seulement avec un thermique exploitable', () => {
        expect(hasCumulus({ cuBase: 1800, ceiling: 1700 })).toBe(true);
        // Air saturé sous un ciel couvert : la particule condense, mais aucun thermique ne porte
        expect(hasCumulus({ cuBase: 1600, ceiling: null })).toBe(false);
        expect(hasCumulus({ cuBase: null, ceiling: 1700 })).toBe(false);
    });
});

describe('nuages', () => {
    const cols = columnsOf(doussard, 45.78, 6.22);

    it('sans niveau au-dessus de 400 hPa, la nébulosité connue s’arrête au dernier niveau', () => {
        for (const c of cols) {
            expect(c.cloudTop).toBe(c.profile[c.profile.length - 1].z);
            expect(c.highCloud).toBe(0);
        }
    });

    it('les niveaux où le modèle ne donne que la nébulosité comptent (voile de cirrus)', () => {
        const withCirrus = structuredClone(doussard) as ForecastPayload;
        const n = withCirrus.sounding!.ts!.length;
        withCirrus.sounding!['cloud-250h'] = Array(n).fill(100);
        const cirrus = columnsOf(withCirrus, 45.78, 6.22);
        cirrus.forEach((c, k) => {
            expect(c.cloudTop).toBeNull();
            expect(c.highCloud).toBe(1);
            expect(c.cloudCover).toBe(1);
            // Un voile de cirrus laisse passer l'essentiel du soleil : thermiques à peine affaiblis
            expect(c.wStar).toBeLessThanOrEqual(cols[k].wStar + 1e-9);
            expect(c.wStar).toBeGreaterThanOrEqual(0.85 * cols[k].wStar);
        });
    });
});

describe('sommet des cumulus', () => {
    it('signalé comme minimum quand la particule dépasse le dernier niveau des données', () => {
        // Air humide près du sol (point de rosée 3 K sous la température) : cumulus à coup sûr
        const humid = structuredClone(saintAndre) as ForecastPayload;
        humid.sounding!.dewPoint = humid.sounding!.ts!.map((_, k) => (humid.data.temperature![k] ?? 290) - 3);
        const cols = columnsOf(humid, 43.97, 6.5).filter(c => c.cuTop != null);
        expect(cols.length).toBeGreaterThan(0);
        for (const c of cols) {
            const zTop = c.profile[c.profile.length - 1].z;
            if (c.cuTopCapped) expect(c.cuTop!).toBeGreaterThan(zTop - 25);
            else expect(c.cuTop!).toBeLessThan(zTop);
        }
    });
});

describe('ascension de la particule', () => {
    // Écart (K) entre le point de rosée de la particule et sa température au niveau z
    const spread = (c: Column, z: number) => {
        const q = satMixingRatio(Math.min(c.parcelDew!, c.parcelStart), c.profile[0].p);
        return c.parcelStart - 0.0098 * (z - c.ground) - dewPointFromMixingRatio(q, pressureAt(c.profile, z));
    };

    it.each(SITES)('prévision réelle, $name : du sol au sommet des thermiques, sans thermique rien', ({ payload, lat, lon }) => {
        const cols = columnsOf(payload, lat, lon);
        expect(cols.some(c => c.thermalTop != null && c.cuBase == null)).toBe(true);
        for (const c of cols) {
            const a = parcelAscent(c);
            if (c.thermalTop == null) {
                expect(a).toBeNull();
                continue;
            }
            expect(a!.path[0]).toEqual({ z: c.ground, t: c.parcelStart });
            expect(a!.path[a!.path.length - 1].z).toBeCloseTo(a!.top, 6);
            expect(a!.top).toBe(c.cuBase == null ? c.thermalTop : c.cuTop);
            // Le chemin s'arrête au sommet : il ne dépasse pas celui tracé jusqu'en haut du profil
            const zs = a!.path.map(p => p.z);
            expect(zs).toEqual([...zs].sort((x, y) => x - y));
            // Point de rosée de la particule : part de celui de l'air brassé et baisse en montant
            expect(a!.dew[0].t).toBeCloseTo(Math.min(c.parcelDew!, c.parcelStart), 6);
            // Il va jusqu'au niveau de condensation, atteint ou non, sans sortir du profil
            const zMax = c.profile[c.profile.length - 1].z;
            expect(a!.condensation).toBeCloseTo(lclHeight(c.ground, c.parcelStart, c.parcelDew), 6);
            expect(a!.dew[a!.dew.length - 1].z).toBeCloseTo(Math.min(a!.condensation!, zMax), 6);
            // Thermique bleu : la condensation est au-dessus du sommet, où la particule est encore
            // plus chaude que son point de rosée
            if (a!.base == null) {
                expect(a!.condensation!).toBeGreaterThanOrEqual(a!.top);
                expect(spread(c, a!.top)).toBeGreaterThan(0);
                if (a!.condensation! <= zMax) expect(Math.abs(spread(c, a!.condensation!))).toBeLessThan(0.5);
            }
        }
    });

    it('sous un cumulus, le point de rosée rejoint la température de la particule à la base', () => {
        const humid = structuredClone(saintAndre) as ForecastPayload;
        humid.sounding!.dewPoint = humid.sounding!.ts!.map((_, k) => (humid.data.temperature![k] ?? 290) - 3);
        const cols = columnsOf(humid, 43.97, 6.5).filter(c => c.cuBase != null);
        expect(cols.length).toBeGreaterThan(0);
        for (const c of cols) {
            const a = parcelAscent(c)!;
            expect(a.base).toBe(c.cuBase);
            expect(a.condensation).toBe(c.cuBase);
            expect(a.top).toBe(c.cuTop);
            const end = a.dew[a.dew.length - 1];
            expect(end.z).toBe(c.cuBase);
            expect(end.t).toBeCloseTo(c.parcelStart - 0.0098 * (c.cuBase! - c.ground), 6);
            // Le rapport de mélange constant et le niveau de condensation de Bolton se rejoignent
            expect(Math.abs(spread(c, c.cuBase!))).toBeLessThan(0.5);
            // Au-dessus de la base, la particule suit la pseudo-adiabatique : elle se refroidit moins vite
            const top = a.path[a.path.length - 1];
            if (top.z > c.cuBase! + 100) expect(top.t).toBeGreaterThan(c.parcelStart - 0.0098 * (top.z - c.ground));
        }
    });
});
