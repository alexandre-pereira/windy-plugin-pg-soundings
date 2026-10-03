import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { payloadAt, toHourly } from '../src/interpolate';
import {
    buildColumns,
    CAPE_LEVELS,
    capeColor,
    CIRCLING_SINK,
    type Column,
    CORE_FACTOR,
    cloudAt,
    cloudDecksOf,
    isCumuliform,
    cloudOfRh,
    cloudOpacity,
    cloudStage,
    cumulusCover,
    cumulusEntrainment,
    cumulusSpread,
    cumulusTop,
    dewPointFromMixingRatio,
    type ForecastPayload,
    freezingLevelOf,
    hasCumulus,
    INSTABILITY_COLORS,
    interpProfile,
    isSevereEnv,
    isShower,
    lclHeight,
    liftedIndexColor,
    lowCloudOf,
    lowCloudsOf,
    moistAdiabat,
    moistLapse,
    netClimb,
    parcelAscent,
    pressureAt,
    type ProfilePoint,
    rainLayer,
    satMixingRatio,
    saturatedLayers,
    showerHours,
    snowLineOf,
    standardAltitude,
    type StormInputs,
    type StormRisk,
    stormRiskOf,
    stormWatchOf,
    sunElevation,
    thermalEase,
    thermalShape,
    totalTotals,
    varioAt,
    virgaOf,
    waveOf,
    wetBulb,
    withSurfaceLayer,
} from '../src/physics';

/** Prévisions ECMWF réelles enregistrées le 29/09/2026 (Doussard, Saint-André-les-Alpes) */
const fixture = (file: string): unknown =>
    JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8'));
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
    // Une bonne heure de thermiques, sans vent, sans pluie ni risque d'orage
    const good = {
        ...cols.find(c => c.ceiling != null)!,
        climb: 1.5,
        choppy: 0 as const,
        stormRisk: 0 as StormRisk,
        precip: 0,
    };
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

    it('en montagne, un plafond qui n’atteint pas les crêtes voisines est « sous les crêtes »', () => {
        // Plafond à 1 200 m du sol du modèle, crêtes 300 m plus haut, puis 200 m plus bas
        expect(thermalEase(good, good.ceiling + 300)).toBe('ridge');
        expect(thermalEase(good, good.ceiling - 200)).toBe('easy');
        // En plaine (pas de crêtes), rien ne change
        expect(thermalEase(good, null)).toBe('easy');
        // Faibles, bas ou hachés passent avant
        expect(thermalEase({ ...good, climb: 0.3 }, good.ceiling + 300)).toBe('weak');
        expect(thermalEase({ ...good, ceiling: good.ground + 200 }, good.ground + 900)).toBe('low');
        expect(thermalEase({ ...good, choppy: 1 }, good.ceiling + 300)).toBe('choppy');
    });

    it('jamais « faciles » à une heure de pluie ou de risque d’orage', () => {
        // Surdéveloppement, orage, ou au moins 0,5 mm de pluie dans l'heure
        expect(thermalEase({ ...good, stormRisk: 1 })).toBe('unsettled');
        expect(thermalEase({ ...good, stormRisk: 3 })).toBe('unsettled');
        expect(thermalEase({ ...good, precip: 0.5 })).toBe('unsettled');
        expect(thermalEase({ ...good, precip: 0.3 })).toBe('easy');
        // Faibles, sous les crêtes ou hachés restent dits tels quels
        expect(thermalEase({ ...good, stormRisk: 2, climb: 0.3 })).toBe('weak');
        expect(thermalEase({ ...good, stormRisk: 2 }, good.ceiling + 300)).toBe('ridge');
        expect(thermalEase({ ...good, precip: 2, choppy: 1 })).toBe('choppy');
    });

    it('prévisions réelles : aucune heure « faciles » sous la pluie ou un risque d’orage', () => {
        for (const { payload, lat, lon } of SITES) {
            for (const c of columnsOf(payload, lat, lon)) {
                if (thermalEase(c) === 'easy')
                    expect(c.stormRisk === 0 && c.precip < 0.5).toBe(true);
            }
        }
    });
});

describe('isotherme 0 °C', () => {
    /** Profil de températures (°C) aux altitudes données, sol en premier */
    const air = (levels: [number, number][]): ProfilePoint[] =>
        levels.map(([z, t]) => ({
            z,
            t: 273.15 + t,
            td: null,
            u: 0,
            v: 0,
            cloud: 0,
            p: 1013.25 * Math.exp(-z / 8000),
        }));

    it('air qui se refroidit en montant : là où il passe sous 0 °C', () => {
        // 10 °C à 500 m, −6,5 K/km : 0 °C vers 2 040 m
        const z = freezingLevelOf(
            air([
                [500, 10],
                [1500, 3.5],
                [3000, -6.25],
                [5500, -22.5],
            ]),
        )!;
        expect(Math.abs(z - 2040)).toBeLessThan(40);
    });

    it('inversion : gel au sol sous un air doux, c’est le sommet de la couche douce', () => {
        // −2 °C en vallée, +5 °C à 1 500 m, puis 0 °C vers 2 500 m
        const z = freezingLevelOf(
            air([
                [500, -2],
                [1500, 5],
                [3000, -2.5],
                [5500, -20],
            ]),
        )!;
        expect(z).toBeGreaterThan(2300);
        expect(z).toBeLessThan(2700);
    });

    it('gel sur toute la colonne : l’altitude du sol ; plus de 0 °C au dernier niveau : inconnue', () => {
        expect(
            freezingLevelOf(
                air([
                    [500, -3],
                    [1500, -8],
                    [3000, -17],
                ]),
            ),
        ).toBe(500);
        expect(
            freezingLevelOf(
                air([
                    [500, 30],
                    [1500, 22],
                    [3000, 12],
                ]),
            ),
        ).toBeNull();
    });

    it('prévisions réelles : au-dessus, il gèle jusqu’en haut du profil', () => {
        for (const { payload, lat, lon } of SITES) {
            for (const c of columnsOf(payload, lat, lon)) {
                expect(c.freezing).toBe(freezingLevelOf(c.profile));
                if (c.freezing == null) continue;
                const top = c.profile[c.profile.length - 1].z;
                for (let z = c.freezing + 20; z <= top; z += 100) {
                    expect(interpProfile(c.profile, z, 't')!).toBeLessThanOrEqual(273.15 + 1e-6);
                }
            }
        }
    });
});

describe('cisaillement de la couche thermique', () => {
    /** Saint-André avec un vent de `surf` m/s au sol et de `aloft` m/s à tous les niveaux, de directions données (°) */
    const withWind = (surf: number, surfDir: number, aloft: number, aloftDir: number) => {
        const p = structuredClone(saintAndre) as ForecastPayload;
        const n = p.data.ts!.length;
        p.data.wind = Array(n).fill(surf);
        p.data.windDir = Array(n).fill(surfDir);
        p.data.windGust = Array(n).fill(surf);
        for (const key of Object.keys(p.sounding!)) {
            if (/^wind-\d+h$/.test(key))
                p.sounding![key] = Array(p.sounding!.ts!.length).fill(aloft);
            if (/^windDir-\d+h$/.test(key))
                p.sounding![key] = Array(p.sounding!.ts!.length).fill(aloftDir);
        }
        return columnsOf(p, 43.97, 6.5);
    };

    it('nul sans thermique exploitable, sinon écart entre le vent au sol et le vent au plafond', () => {
        const cols = columnsOf(saintAndre, 43.97, 6.5);
        for (const c of cols) {
            expect(c.blShear).toBeGreaterThanOrEqual(0);
            if (c.ceiling == null) expect(c.blShear).toBe(0);
        }
        expect(cols.some(c => c.blShear > 0)).toBe(true);
    });

    it('vent faible partout : thermiques ni hachés ni cisaillés', () => {
        const calm = withWind(2, 0, 2, 0).filter(c => c.ceiling != null);
        expect(calm.length).toBeGreaterThan(0);
        for (const c of calm) {
            expect(c.blShear * 3.6).toBeLessThan(1);
            expect(c.choppy).toBe(0);
        }
    });

    it('brise au sol sous un vent contraire en altitude : hachés, alors que le vent moyen reste faible', () => {
        // 2 m/s de nord au sol, 6 m/s de sud en altitude : jusqu'à 8 m/s (29 km/h) d'écart
        const sheared = withWind(2, 0, 6, 180).filter(c => c.ceiling != null);
        const hit = sheared.filter(c => c.blShear * 3.6 >= 20);
        expect(hit.length).toBeGreaterThan(0);
        for (const c of sheared) {
            expect(c.blSpeed * 3.6).toBeLessThan(25);
            expect(c.choppy).toBe(c.blShear * 3.6 >= 20 ? 1 : 0);
        }
    });

    it('très hachés au-delà de 35 km/h d’écart', () => {
        // 3 m/s de nord au sol, 9 m/s de sud en altitude : jusqu'à 12 m/s (43 km/h) d'écart
        const sheared = withWind(3, 0, 9, 180).filter(c => c.ceiling != null);
        expect(sheared.some(c => c.blShear * 3.6 >= 35)).toBe(true);
        for (const c of sheared.filter(k => k.blShear * 3.6 >= 35)) expect(c.choppy).toBe(2);
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
    const risk = (
        patch: Partial<StormInputs>,
        cu: Partial<NonNullable<StormInputs['cumulus']>> = {},
    ) => stormRiskOf({ ...stormy, ...patch, cumulus: { ...stormy.cumulus!, ...cu } });

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

    it.each(SITES)(
        'prévision réelle, $name : la particule la plus instable a au moins l’énergie standard',
        ({ payload, lat, lon }) => {
            for (const c of columnsOf(payload, lat, lon)) {
                expect(c.muCape).toBeGreaterThanOrEqual(c.cape);
                if (c.liftedIndex != null)
                    expect(c.muLiftedIndex).toBeLessThanOrEqual(c.liftedIndex);
                expect(c.shear).toBeGreaterThanOrEqual(0);
                expect(Math.hypot(c.steerU, c.steerV)).toBeLessThan(80);
                // Fin septembre sans orage : rien de violent
                expect(c.stormRisk).toBeLessThan(3);
            }
        },
    );
});

describe('alerte d’orage de la journée', () => {
    // Une journée de la prévision réelle (heures locales 0–23), rendue calme puis orageuse à la demande
    const day = columnsOf(saintAndre, 43.97, 6.5)
        .filter(c => new Date(c.ts + 2 * 3600e3).getUTCDate() === 30)
        .map((c): Column => ({
            ...c,
            stormRisk: 0,
            severeEnv: false,
            precip: 0,
            gust: 5,
            profile: c.profile.map(p => ({ ...p, cloud: 0 })),
        }));
    /** Profil d'une heure, couvert à 90 % au niveau de pression donné */
    const overcastAt = (hour: number, hPa: number) =>
        day.find(c => c.hour === hour)!.profile.map(p => (p.p === hPa ? { ...p, cloud: 90 } : p));
    const withStorm = (patch: Record<number, Partial<Column>>) =>
        day.map(c => ({ ...c, ...patch[c.hour] }));

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
        expect(
            stormWatchOf(withStorm({ 16: { stormRisk: 1 }, 17: { stormRisk: 2 } }))!.calmBefore,
        ).toBeNull();
        expect(
            stormWatchOf(withStorm({ 16: { precip: 1 }, 17: { stormRisk: 2 } }))!.calmBefore,
        ).toBeNull();
    });

    it('ciel déjà couvert l’heure d’avant : l’orage peut rester caché (pas derrière un voile de cirrus)', () => {
        expect(
            stormWatchOf(withStorm({ 16: { profile: overcastAt(16, 700) }, 17: { stormRisk: 2 } }))!
                .hidden,
        ).toBe(true);
        expect(
            stormWatchOf(withStorm({ 16: { profile: overcastAt(16, 400) }, 17: { stormRisk: 2 } }))!
                .hidden,
        ).toBe(false);
    });

    it('surdéveloppement dans un air propice aux orages violents : alerte de niveau 1', () => {
        const w = stormWatchOf(
            withStorm({ 14: { stormRisk: 1 }, 15: { stormRisk: 1, severeEnv: true } }),
        )!;
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
        // Seuils d'une CAPE complète (300, 1 000, 2 500 J/kg) ramenés à la part que le profil contient
        expect(CAPE_LEVELS).toEqual([200, 650, 1600]);
        expect([0, 199, 200, 649, 650, 1599, 1600].map(capeColor)).toEqual(
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

    it('instant isolé : la nature de sa pluie est celle qu’on lui donne, celle de l’heure qui le contient', () => {
        let clouds = 0;
        for (const { payload, lat, lon } of SITES) {
            const p = toHourly(structuredClone(payload) as ForecastPayload, lat, lon);
            for (const c of buildColumns(p, lat, lon)) {
                const at = payloadAt(p, c.ts + 1800e3, lat, lon);
                if (!at) continue;
                const [no] = buildColumns(at, lat, lon, { shower: false });
                const [yes] = buildColumns(at, lat, lon, { shower: true });
                if (!no || !yes) continue;
                expect(no.showerBase).toBeNull();
                // Averses : le nuage n'est dessiné que si la particule standard, ou la plus
                // instable, en donne un
                if (yes.showerBase != null) {
                    clouds++;
                    expect(yes.showerTop!).toBeGreaterThan(yes.showerBase);
                }
            }
        }
        expect(clouds).toBeGreaterThan(0);
    });

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

    it('un peu de pluie convective dans une pluie de front : pas une averse', () => {
        // Moins de la moitié de la pluie de l'heure
        expect(isShower({ ...shower, cape: 0, depth: 0, precip: 2, convRain: 0.3 })).toBe(false);
    });

    it('air froid en altitude au-dessus d’un air humide : averse, même presque sans énergie', () => {
        const weak = { ...shower, cape: 10, depth: 600 };
        expect(isShower({ ...weak, totals: 48 })).toBe(true);
        expect(isShower({ ...weak, totals: 44 })).toBe(false);
        expect(isShower({ ...weak, totals: 48, precip: 0 })).toBe(false);
    });

    it('850 hPa sous le sol : l’indice de soulèvement remplace l’indice des totaux', () => {
        const weak = { ...shower, cape: 10, depth: 600, totals: null };
        expect(isShower({ ...weak, liftedIndex: 2 })).toBe(true);
        expect(isShower({ ...weak, liftedIndex: 4 })).toBe(false);
        expect(isShower({ ...weak, liftedIndex: null })).toBe(false);
        // L'indice des totaux, quand il existe, décide seul
        expect(isShower({ ...weak, totals: 44, liftedIndex: 1 })).toBe(false);
    });

    it('indice des totaux : T et Td à 850 hPa, moins deux fois T à 500 hPa', () => {
        const at = (p: number, z: number, t: number, td: number | null): ProfilePoint => ({
            z,
            t,
            td,
            u: 0,
            v: 0,
            cloud: 0,
            p,
        });
        const aloft = [at(700, 3000, 270, 262), at(500, 5600, 252, 240)];
        expect(
            totalTotals([at(1000, 100, 288, 283), at(850, 1500, 280, 277), ...aloft]),
        ).toBeCloseTo(280 + 277 - 2 * 252, 5);
        // Sol au-dessus du niveau 850 hPa, ou humidité inconnue : pas d'indice
        expect(totalTotals([at(800, 2000, 280, 277), ...aloft])).toBeNull();
        const dryless = [at(1000, 100, 288, 283), at(850, 1500, 280, 277), ...aloft].map(l => ({
            ...l,
            td: null,
        }));
        expect(totalTotals(dryless)).toBeNull();
    });

    it.each(SITES)(
        'prévision réelle, $name : nuage d’averses seulement sous la pluie, au-dessus du sol',
        ({ payload, lat, lon }) => {
            for (const c of columnsOf(payload, lat, lon)) {
                if (c.showerBase == null) continue;
                expect(c.precip).toBeGreaterThanOrEqual(0.1);
                expect(c.showerBase).toBeGreaterThanOrEqual(c.ground);
                expect(c.showerTop!).toBeGreaterThan(c.showerBase);
            }
        },
    );

    /** Heures qui se suivent : pluie (mm) et pluie convective de l'heure prise seule */
    const rainy = (hours: [number, boolean][]) =>
        showerHours(
            hours.map(([precip, convective], k) => ({ ts: k * 3600e3, precip, convective })),
        );

    it('une heure convective isolée dans une pluie de front : pas d’averse', () => {
        // Pluie continue de quatre heures, l'énergie ne passe le seuil qu'à la première
        expect(
            rainy([
                [0.2, false],
                [0, false],
                [2.8, true],
                [4.1, false],
                [3.7, false],
                [0.4, false],
            ]),
        ).toEqual(Array(6).fill(false));
    });

    it('une heure sous le seuil au milieu des averses : averse aussi', () => {
        expect(
            rainy([
                [1, true],
                [1, true],
                [1, false],
                [1, true],
                [1, true],
            ]),
        ).toEqual(Array(5).fill(true));
    });

    it('la pluie change de nature quand le front laisse la place aux averses', () => {
        const hours: [number, boolean][] = [
            [1, false],
            [1, false],
            [1, false],
            [1, true],
            [1, true],
            [1, true],
        ];
        expect(rainy(hours)).toEqual([false, false, false, true, true, true]);
    });

    it('la pluie compte, pas le nombre d’heures : une forte averse l’emporte sur la bruine qui la suit', () => {
        expect(
            rainy([
                [0, false],
                [8, true],
                [0.3, false],
                [0.3, false],
            ]),
        ).toEqual([false, true, true, true]);
    });

    it('averse seule, loin de toute autre pluie : inchangée, et jamais d’averse sans pluie', () => {
        expect(
            rainy([
                [0, true],
                [0, false],
                [0, false],
                [1, true],
                [0, false],
                [0, false],
                [1, false],
            ]),
        ).toEqual([false, false, false, true, false, false, false]);
    });

    it.each(SITES)(
        'prévision réelle, $name : seulement aux heures de pluie, base sous le sommet',
        ({ payload, lat, lon }) => {
            const cols = columnsOf(payload, lat, lon);
            for (const c of cols) {
                expect(c.showerBase == null).toBe(c.showerTop == null);
                if (c.showerBase == null || c.showerTop == null) continue;
                expect(c.precip).toBeGreaterThanOrEqual(0.1);
                expect(c.showerBase).toBeGreaterThanOrEqual(c.ground);
                expect(c.showerTop).toBeGreaterThan(c.showerBase);
            }
        },
    );

    it('Doussard : averses derrière le front (1er octobre), pluie de front la veille en air stable', () => {
        const cols = columnsOf(doussard, 45.78, 6.22);
        const day = (d: number) =>
            cols.filter(c => new Date(c.ts + 2 * 3600e3).getUTCDate() === d && c.precip >= 0.1);
        // 30 septembre après-midi : le front arrive sur un air stable (CAPE ~10 J/kg)
        expect(
            day(30)
                .filter(c => c.hour >= 14 && c.hour <= 17)
                .every(c => c.showerBase == null),
        ).toBe(true);
        // 1er octobre, milieu de journée : pluie sous ciel couvert, sans thermiques, mais air instable
        const showers = day(1).filter(c => c.hour >= 11 && c.hour <= 16);
        expect(showers.length).toBeGreaterThan(3);
        expect(showers.every(c => c.cuBase == null && c.showerBase != null)).toBe(true);
    });

    it('Doussard : la nature de la pluie ne change pas pour une heure au ras du seuil', () => {
        const cols = columnsOf(doussard, 45.78, 6.22);
        const at = (d: number, hour: number) =>
            cols.find(c => new Date(c.ts + 2 * 3600e3).getUTCDate() === d && c.hour === hour)!;
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
    const level = (z: number, cloud: number) => ({
        z,
        t: 280,
        td: 278,
        u: 0,
        v: 0,
        cloud,
        p: 1000 - z / 10,
    });

    it('base au plus bas niveau où la nébulosité atteint 50 %, sommet au dernier niveau si elle y reste', () => {
        const { base, top } = rainLayer([
            level(500, 0),
            level(1500, 0),
            level(2500, 100),
            level(4000, 100),
        ])!;
        expect(base).toBeGreaterThan(1500);
        expect(base).toBeLessThan(2500);
        expect(top).toBe(4000);
    });

    it('couche épaisse sous un ciel dégagé : le sommet s’arrête où la nébulosité retombe', () => {
        const { base, top } = rainLayer([
            level(500, 0),
            level(1000, 95),
            level(3000, 95),
            level(4000, 0),
            level(6000, 0),
        ])!;
        expect(base).toBeLessThan(1000);
        expect(top).toBeGreaterThan(3000);
        expect(top).toBeLessThan(4000);
    });

    it('deux couches séparées : la plus basse', () => {
        const { base, top } = rainLayer([
            level(500, 0),
            level(1000, 90),
            level(2000, 0),
            level(3000, 0),
            level(4000, 90),
        ])!;
        expect(base).toBeLessThan(1000);
        expect(top).toBeLessThan(2000);
    });

    it('voile peu dense : la moitié de sa plus forte nébulosité', () => {
        const { base } = rainLayer([
            level(500, 0),
            level(1500, 0),
            level(2500, 30),
            level(4000, 10),
        ])!;
        expect(base).toBeGreaterThan(1500);
        expect(base).toBeLessThanOrEqual(2500);
    });

    it('sans nuage dans le profil : pas de couche', () => {
        expect(rainLayer([level(500, 0), level(1500, 2), level(4000, 0)])).toBeNull();
    });

    it.each(SITES)(
        'prévision réelle, $name : une couche au-dessus du sol à chaque heure de pluie',
        ({ payload, lat, lon }) => {
            const wet = columnsOf(payload, lat, lon).filter(c => c.precip >= 0.1);
            expect(wet.length).toBeGreaterThan(5);
            for (const c of wet) {
                const layer = rainLayer(c.profile);
                expect(layer).not.toBeNull();
                expect(layer!.base).toBeGreaterThan(c.ground);
                expect(layer!.top).toBeGreaterThanOrEqual(layer!.base);
            }
        },
    );
});

describe('nuages bas, mer de nuages et relief accroché', () => {
    /** Niveau à l'altitude z : nébulosité (%) et écart T − Td (K) ; sol à 500 m en premier */
    const level = (z: number, cloud: number, spread: number): ProfilePoint => {
        const t = 290 - 0.0065 * z;
        return { z, t, td: t - spread, u: 0, v: 0, cloud, p: 1013.25 * Math.exp(-z / 8000) };
    };
    const GROUND = level(500, 0, 5);
    const HIGH = [level(3200, 0, 20), level(4400, 0, 20)];

    it('mer de nuages : couche basse presque continue sous un air clair et sec', () => {
        const low = lowCloudOf([GROUND, level(900, 90, 0.5), level(1600, 0, 15), ...HIGH])!;
        expect(low.base).toBeGreaterThan(500);
        expect(low.base).toBeLessThan(900);
        expect(low.top).toBeGreaterThan(900);
        expect(low.top).toBeLessThan(1600);
        expect(low).toMatchObject({ sea: true, fog: false });
    });

    it('pas une mer de nuages si l’air au-dessus est nuageux ou humide, ou la couverture partielle', () => {
        expect(lowCloudOf([GROUND, level(900, 90, 0.5), level(1600, 40, 15), ...HIGH])!.sea).toBe(
            false,
        );
        expect(lowCloudOf([GROUND, level(900, 90, 0.5), level(1600, 0, 3), ...HIGH])!.sea).toBe(
            false,
        );
        expect(lowCloudOf([GROUND, level(900, 55, 0.5), level(1600, 0, 15), ...HIGH])!.sea).toBe(
            false,
        );
    });

    it('brouillard : la couche touche le sol quand l’air y est saturé', () => {
        const low = lowCloudOf([
            level(500, 0, 0.3),
            level(650, 80, 0.2),
            level(1600, 0, 15),
            ...HIGH,
        ])!;
        expect(low).toMatchObject({ base: 500, fog: true });
        // Air saturé au sol, mais couche qui commence trop haut pour le toucher
        expect(
            lowCloudOf([level(500, 0, 0.3), level(900, 0, 4), level(1600, 80, 0.5), ...HIGH])!.fog,
        ).toBe(false);
    });

    it('ni masse nuageuse épaisse, ni couche trop haute, ni ciel clair', () => {
        // Nuages du sol à 4 400 m (front) : pas une couche basse
        expect(
            lowCloudOf([
                GROUND,
                level(900, 90, 0.5),
                level(1600, 90, 0.5),
                level(3200, 90, 0.5),
                level(4400, 90, 0.5),
            ]),
        ).toBeNull();
        // Base à plus de 2 000 m du sol
        expect(
            lowCloudOf([
                GROUND,
                level(900, 0, 8),
                level(1600, 0, 8),
                level(3200, 90, 0.5),
                level(4400, 0, 9),
            ]),
        ).toBeNull();
        expect(lowCloudOf([GROUND, level(900, 30, 2), level(1600, 0, 15), ...HIGH])).toBeNull();
    });

    it('d’heure en heure, la couche naît à 50 % et se prolonge tant qu’elle garde 40 %', () => {
        const hour = (cloud: number) => [
            GROUND,
            level(900, cloud, 0.5),
            level(1600, 0, 15),
            ...HIGH,
        ];
        const lows = lowCloudsOf([45, 60, 45, 55, 45, 30, 45].map(hour));
        expect(lows.map(l => l != null)).toEqual([true, true, true, true, true, false, false]);
    });

    it('air saturé : couches où T − Td ne dépasse pas 1,5 K, sur au moins 100 m', () => {
        const layers = saturatedLayers([
            GROUND,
            level(900, 0, 4),
            level(1600, 0, 0.5),
            level(2200, 0, 0.5),
            ...HIGH,
        ]);
        expect(layers).toHaveLength(1);
        expect(layers[0].base).toBeGreaterThan(900);
        expect(layers[0].base).toBeLessThan(1600);
        expect(layers[0].top).toBeGreaterThan(2200);
        expect(layers[0].top).toBeLessThan(3200);
        // Air saturé au ras du sol seulement (rosée du matin) : trop mince pour compter
        expect(
            saturatedLayers([level(500, 0, 1), level(900, 0, 12), level(1600, 0, 15), ...HIGH]),
        ).toEqual([]);
        // Sans humidité en altitude : rien
        expect(
            saturatedLayers([
                GROUND,
                { ...level(900, 80, 0), td: null },
                { ...level(1600, 0, 0), td: null },
            ]),
        ).toEqual([]);
    });

    it.each(SITES)(
        'prévision réelle, $name : couches au-dessus du sol, dans le profil',
        ({ payload, lat, lon }) => {
            const cols = columnsOf(payload, lat, lon);
            const lows = lowCloudsOf(cols.map(c => c.profile));
            expect(lows).toHaveLength(cols.length);
            cols.forEach((c, k) => {
                const low = lows[k];
                if (low) {
                    expect(low.base).toBeGreaterThanOrEqual(c.ground);
                    expect(low.top).toBeGreaterThanOrEqual(low.base);
                    expect(low.top - c.ground).toBeLessThanOrEqual(3000);
                }
                const zTop = c.profile[c.profile.length - 1].z;
                let last = c.ground - 1;
                for (const l of saturatedLayers(c.profile)) {
                    expect(l.base).toBeGreaterThan(last);
                    expect(l.top - l.base).toBeGreaterThanOrEqual(100);
                    expect(l.top).toBeLessThanOrEqual(zTop);
                    last = l.top;
                }
            });
        },
    );
});

describe('plafond nuageux d’heure en heure', () => {
    /** Niveau à l'altitude z : nébulosité (%) et écart T − Td (K) ; sol à 500 m en premier */
    const level = (z: number, cloud: number, spread: number): ProfilePoint => {
        const t = 290 - 0.0065 * z;
        return { z, t, td: t - spread, u: 0, v: 0, cloud, p: 1013.25 * Math.exp(-z / 8000) };
    };
    const GROUND = level(500, 0, 5);
    const CLEAR = [
        GROUND,
        level(900, 0, 8),
        level(1600, 0, 8),
        level(3200, 0, 20),
        level(4400, 0, 20),
    ];
    /** Stratus sous un air clair et sec, masse nuageuse de 1 600 m au dernier niveau, couche vers 3 200 m */
    const STRATUS = [
        GROUND,
        level(900, 90, 0.5),
        level(1600, 0, 15),
        level(3200, 0, 20),
        level(4400, 0, 20),
    ];
    const MASS = [
        GROUND,
        level(900, 0, 8),
        level(1600, 90, 0.5),
        level(3200, 90, 0.5),
        level(4400, 90, 0.5),
    ];
    const middle = (cloud: number) => [
        GROUND,
        level(900, 0, 8),
        level(1600, 0, 8),
        level(3200, cloud, 0.5),
        level(4400, 0, 9),
    ];
    const dry = (n: number) => Array<boolean>(n).fill(false);

    it('couche basse avec son sommet, sinon la plus basse couche dense, à n’importe quelle altitude', () => {
        const [low, mass, mid, none] = cloudDecksOf([STRATUS, MASS, middle(90), CLEAR], dry(4));
        expect(low!.low).toMatchObject({ sea: true, fog: false });
        expect(low!.top).toBeLessThan(1600);
        expect(mass).toMatchObject({ low: null, rain: false, top: 4400 });
        expect(mass!.base).toBeGreaterThan(900);
        expect(mass!.base).toBeLessThan(1600);
        expect(mid!.low).toBeNull();
        expect(mid!.base).toBeGreaterThan(1600);
        expect(mid!.base).toBeLessThan(3200);
        expect(mid!.top).toBeLessThan(4400);
        expect(none).toBeNull();
    });

    it('la pluie tombe de la couche dense ; sans elle, de la moitié de la plus forte nébulosité', () => {
        expect(cloudDecksOf([MASS], [true])[0]).toMatchObject({ low: null, rain: true, top: 4400 });
        // Voile de 30 % : pas une couche dense, mais la couche de la pluie s'il pleut
        expect(cloudDecksOf([middle(30)], [false])[0]).toBeNull();
        const veil = cloudDecksOf([middle(30)], [true])[0]!;
        expect(veil.rain).toBe(true);
        expect(veil.base).toBeGreaterThan(1600);
        expect(veil.base).toBeLessThanOrEqual(3200);
    });

    it('la couche naît à 50 % et se prolonge tant qu’elle garde 40 %', () => {
        const decks = cloudDecksOf([45, 60, 45, 30, 45].map(middle), dry(5));
        expect(decks.map(d => d != null)).toEqual([true, true, true, false, false]);
    });

    it('couche basse : en amas quand les thermiques montent jusqu’à elle, à 300 m près', () => {
        const { base } = cloudDecksOf([STRATUS], dry(1))[0]!;
        // Sans thermique, le profil ne dit pas le genre d'une couche basse (stratus, stratocumulus)
        expect(cloudDecksOf([STRATUS], dry(1))[0]!.genus).toBeNull();
        expect(cloudDecksOf([STRATUS], dry(1), [null])[0]!.genus).toBeNull();
        const fed = cloudDecksOf([STRATUS], dry(1), [base - 200])[0]!;
        expect(fed.genus).toBe('cumulus');
        expect(isCumuliform(fed)).toBe(true);
        // Thermiques qui s'arrêtent loin sous la couche : elle n'est pas faite de leurs cumulus
        expect(cloudDecksOf([STRATUS], dry(1), [base - 400])[0]!.genus).toBeNull();
        // Les thermiques ne changent rien à une couche plus haute
        expect(cloudDecksOf([MASS], dry(1), [3000])[0]!.genus).toBeNull();
    });

    it('étage moyen : altocumulus pour une couche mince, altostratus pour une couche épaisse', () => {
        /** Nuages aux niveaux de 4 400 m et plus haut donnés, sous un air sec jusqu'à 3 200 m */
        const aloft = (clouds: number[]) => [
            GROUND,
            level(900, 0, 8),
            level(1600, 0, 8),
            level(3200, 0, 15),
            ...[4400, 5600, 7200, 8000].map((z, k) => level(z, clouds[k], clouds[k] ? 0.5 : 15)),
        ];
        const [thin, thick, high] = cloudDecksOf(
            [aloft([90, 0, 0, 0]), aloft([90, 90, 90, 0]), aloft([0, 0, 0, 90])],
            dry(3),
        );
        expect(thin!.base - 500).toBeGreaterThan(2000);
        expect(thin!.top - thin!.base).toBeLessThan(2000);
        expect(thin).toMatchObject({ low: null, genus: 'altocumulus' });
        expect(isCumuliform(thin!)).toBe(true);
        expect(thick!.top - thick!.base).toBeGreaterThanOrEqual(2000);
        expect(thick!.genus).toBe('altostratus');
        expect(isCumuliform(thick!)).toBe(false);
        // Étage haut (450 hPa et plus haut) : nuages de glace, pas un altocumulus
        expect(high!.genus).toBeNull();
        // Couche d'où il pleut : nuages de la pluie, sans genre
        expect(cloudDecksOf([aloft([90, 0, 0, 0])], [true])[0]!.genus).toBeNull();
        // Masse nuageuse partie de l'étage bas
        expect(cloudDecksOf([MASS], dry(1))[0]!.genus).toBeNull();
    });

    it('même couche d’une heure à la suivante si leurs altitudes se recouvrent, à 250 m près', () => {
        const decks = cloudDecksOf([STRATUS, STRATUS, middle(90), MASS, CLEAR, MASS], dry(6));
        // Le stratus se dissipe sous la couche de 3 200 m : deux couches ; la masse nuageuse la prolonge
        expect(decks.map(d => d?.joined)).toEqual([false, true, false, true, undefined, false]);
    });

    it.each(SITES)(
        'prévision réelle, $name : dans le profil, et une couche à chaque heure de pluie',
        ({ payload, lat, lon }) => {
            const cols = columnsOf(payload, lat, lon);
            const rains = cols.map(c => c.precip >= 0.1 && c.showerBase == null);
            const decks = cloudDecksOf(
                cols.map(c => c.profile),
                rains,
                cols.map(c => (c.ceiling != null ? c.thermalTop : null)),
            );
            expect(decks).toHaveLength(cols.length);
            expect(rains.filter(Boolean).length).toBeGreaterThan(3);
            cols.forEach((c, k) => {
                const deck = decks[k];
                if (rains[k]) expect(deck).toMatchObject({ rain: true });
                if (!deck) return;
                // Genre : cumulus pour une couche basse sous des thermiques exploitables, altocumulus
                // et altostratus à plus de 2 000 m du sol et sans pluie
                if (deck.genus === 'cumulus') {
                    expect(deck.low).not.toBeNull();
                    expect(c.ceiling).not.toBeNull();
                } else if (deck.genus) {
                    expect(deck).toMatchObject({ low: null, rain: false });
                    expect(deck.base - c.ground).toBeGreaterThan(2000);
                    expect(deck.top - deck.base < 2000).toBe(deck.genus === 'altocumulus');
                }
                expect(deck.base).toBeGreaterThanOrEqual(c.ground);
                expect(deck.top).toBeGreaterThanOrEqual(deck.base);
                expect(deck.top).toBeLessThanOrEqual(c.profile[c.profile.length - 1].z);
                if (deck.joined) expect(decks[k - 1]).not.toBeNull();
            });
        },
    );
});

describe('nuages placés entre les niveaux d’après l’humidité', () => {
    const level = (z: number, cloud: number, spread: number): ProfilePoint => {
        const t = 290 - 0.0065 * z;
        return { z, t, td: t - spread, u: 0, v: 0, cloud, p: 1013.25 * Math.exp(-z / 8000) };
    };

    it('formule de Sundqvist : rien sous 70 % d’humidité, ciel couvert à saturation', () => {
        expect(cloudOfRh(0.5)).toBe(0);
        expect(cloudOfRh(0.7)).toBe(0);
        expect(cloudOfRh(1)).toBe(1);
        expect(cloudOfRh(0.9)).toBeGreaterThan(cloudOfRh(0.8));
    });

    it('aux niveaux du modèle, sa nébulosité ; entre deux niveaux aussi humides, l’interpolation', () => {
        const profile = [
            level(500, 0, 2),
            level(900, 80, 2),
            level(1600, 40, 2),
            level(3200, 0, 2),
        ];
        expect(cloudAt(profile, 900)).toBe(80);
        expect(cloudAt(profile, 1600)).toBe(40);
        const mid = cloudAt(profile, 1250);
        expect(mid).toBeGreaterThan(40);
        expect(mid).toBeLessThan(80);
    });

    it('sous une inversion sèche, le nuage s’arrête où l’air s’assèche, pas à mi-chemin', () => {
        // Niveau saturé et couvert à 900 m, air très sec et clair à 1 600 m
        const profile = [
            level(500, 0, 5),
            level(900, 100, 0),
            level(1600, 0, 17),
            level(3200, 0, 20),
        ];
        expect(cloudAt(profile, 950)).toBeGreaterThan(50);
        // À mi-chemin, l'air n'a plus que ~55 % d'humidité : plus de nuage
        expect(cloudAt(profile, 1250)).toBeLessThan(5);
        // Sommet de la couche basse : bien sous le milieu de l'intervalle
        const low = lowCloudOf(profile)!;
        expect(low.top).toBeGreaterThanOrEqual(900);
        expect(low.top).toBeLessThan(1150);
    });

    it('jamais plus que l’interpolation, et sans humidité connue l’interpolation seule', () => {
        const profile = [
            level(500, 0, 0),
            level(900, 60, 0),
            level(1600, 20, 6),
            level(3200, 0, 20),
        ];
        for (let z = 500; z <= 3200; z += 100) {
            const plain = [900, 1600].includes(z)
                ? cloudAt(profile, z)
                : cloudAt(
                      profile.map(p => ({ ...p, td: null })),
                      z,
                  );
            expect(cloudAt(profile, z)).toBeLessThanOrEqual(plain + 1e-9);
        }
    });

    it('modèle sans nébulosité par niveau : estimée d’après l’humidité de chaque niveau', () => {
        const bare = structuredClone(doussard) as ForecastPayload;
        for (const key of Object.keys(bare.sounding!))
            if (key.startsWith('cloud-')) delete bare.sounding![key];
        const cols = columnsOf(bare, 45.78, 6.22);
        expect(cols.every(c => c.cloudEstimated)).toBe(true);
        expect(cols.some(c => c.profile.some(p => p.cloud > 50))).toBe(true);
        for (const c of cols) {
            for (const p of c.profile.slice(1)) {
                expect(p.cloud).toBeGreaterThanOrEqual(0);
                expect(p.cloud).toBeLessThanOrEqual(100);
            }
        }
        expect(columnsOf(doussard, 45.78, 6.22).every(c => !c.cloudEstimated)).toBe(true);
    });
});

describe('pluie : limite pluie-neige, virga, pas de temps, pression', () => {
    /** Air à `t0` °C au sol (500 m), −6,5 K/km, point de rosée `spread` K sous la température */
    const air = (t0: number, spread: number): ProfilePoint[] =>
        [500, 900, 1600, 3200, 4400].map(z => {
            const t = 273.15 + t0 - 0.0065 * (z - 500);
            return { z, t, td: t - spread, u: 0, v: 0, cloud: 0, p: 1013.25 * Math.exp(-z / 8000) };
        });

    it('thermomètre mouillé : la température dans un air saturé, entre elle et le point de rosée sinon', () => {
        expect(wetBulb(283.15, 283.15, 900)).toBeCloseTo(283.15, 2);
        // 20 °C et 10 °C de point de rosée à 1 000 hPa : environ 14 °C
        const tw = wetBulb(293.15, 283.15, 1000) - 273.15;
        expect(tw).toBeGreaterThan(13.5);
        expect(tw).toBeLessThan(15);
    });

    it('limite pluie-neige : thermomètre mouillé à +1 °C, plus bas dans un air sec', () => {
        // Air saturé à 8 °C au sol : +1 °C à 7 K ÷ 6,5 K/km ≈ 1 080 m au-dessus
        const wet = snowLineOf(air(8, 0))!;
        expect(Math.abs(wet - 1577)).toBeLessThan(40);
        const dry = snowLineOf(air(8, 10))!;
        expect(dry).toBeLessThan(wet - 300);
        expect(dry).toBeGreaterThan(500);
    });

    it('neige jusqu’au sol, ou limite au-dessus du dernier niveau fourni', () => {
        expect(snowLineOf(air(-2, 0))).toBe(500);
        expect(snowLineOf(air(40, 0))).toBeNull();
        expect(snowLineOf(air(8, 0).map(p => ({ ...p, td: null })))).toBeNull();
    });

    it('virga : base des averses ou des cumulus d’orage à plus de 1 500 m du sol', () => {
        const hour = { ground: 500, showerBase: null, cuBase: null, stormRisk: 0 } as const;
        expect(virgaOf({ ...hour, showerBase: 2200 })).toBe(2200);
        expect(virgaOf({ ...hour, showerBase: 1500 })).toBeNull();
        expect(virgaOf({ ...hour, cuBase: 2300, stormRisk: 1 })).toBe(2300);
        // Cumulus de beau temps, même hauts : pas de pluie à évaporer
        expect(virgaOf({ ...hour, cuBase: 2300 })).toBeNull();
    });

    it('pression au sol en hPa, que Windy la donne en Pa ou en hPa ; null sans elle', () => {
        const withPressure = (value: number) => {
            const p = structuredClone(doussard) as ForecastPayload;
            p.data.pressure = p.data.ts!.map(() => value);
            return columnsOf(p, 45.78, 6.22);
        };
        expect(withPressure(101325)[0].pressure).toBeCloseTo(1013.25, 2);
        expect(withPressure(1013.25)[0].pressure).toBeCloseTo(1013.25, 2);
        expect(columnsOf(doussard, 45.78, 6.22)[0].pressure).toBeNull();
    });

    it('prévision horaire : la pluie de chaque heure vient d’un pas d’une heure', () => {
        expect(columnsOf(doussard, 45.78, 6.22).every(c => c.precipStep === 1)).toBe(true);
    });
});

describe('cumulus étalés et ondes de relief', () => {
    const cols = columnsOf(doussard, 45.78, 6.22);

    it('cumulus étalés : au moins 60 % de nuages du modèle dans la couche des cumulus', () => {
        const hour = (cloud: number, ceiling: number | null = 1400) => ({
            ...cols[0],
            ground: 500,
            ceiling,
            cuBase: 1500,
            cuTop: 1900,
            profile: [500, 900, 1600, 3200, 4400].map(z => ({
                z,
                t: 290 - 0.0065 * z,
                td: 289 - 0.0065 * z,
                u: 0,
                v: 0,
                cloud: z === 1600 ? cloud : 0,
                p: 1013.25 * Math.exp(-z / 8000),
            })),
        });
        expect(cumulusSpread(hour(80))).toBe(true);
        expect(cumulusSpread(hour(30))).toBe(false);
        // Sans thermique exploitable, pas de cumulus à étaler
        expect(cumulusSpread(hour(80, null))).toBe(false);
    });

    it('quantité de cumulus : la plus forte nébulosité du modèle dans leur couche', () => {
        const hour = (cloud: number, ceiling: number | null = 1400) => ({
            ...cols[0],
            ground: 500,
            ceiling,
            cuBase: 1500,
            cuTop: 1900,
            profile: [500, 900, 1600, 3200, 4400].map(z => ({
                z,
                t: 290 - 0.0065 * z,
                td: 289 - 0.0065 * z,
                u: 0,
                v: 0,
                // Un voile plus haut que les cumulus ne compte pas
                cloud: z === 1600 ? cloud : z === 4400 ? 90 : 0,
                p: 1013.25 * Math.exp(-z / 8000),
            })),
        });
        expect(cumulusCover(hour(0))).toBe(0);
        expect(cumulusCover(hour(30))).toBeGreaterThan(20);
        expect(cumulusCover(hour(30))).toBeLessThanOrEqual(30);
        expect(cumulusCover(hour(80))).toBeGreaterThan(cumulusCover(hour(30)));
        expect(cumulusCover(hour(80, null))).toBe(0);
    });

    /**
     * Profil au-dessus de crêtes à 2 000 m : gradient `low` K/km jusqu'à 3 500 m puis `up` K/km, vent
     * de `speed` m/s aux crêtes qui double vers 6 000 m et tourne de `turn` degrés
     */
    const flow = (low: number, up: number, speed: number, turn = 0): ProfilePoint[] =>
        [500, 1000, 2000, 3500, 5000, 6000, 7000].map(z => {
            const t = 288 - (low * Math.min(z, 3500)) / 1000 - (up * Math.max(0, z - 3500)) / 1000;
            const s = speed * (1 + Math.max(0, z - 2000) / 4000);
            const dir = ((270 + (turn * Math.max(0, z - 2000)) / 4000) * Math.PI) / 180;
            return {
                z,
                t,
                td: t - 10,
                u: -s * Math.sin(dir),
                v: -s * Math.cos(dir),
                cloud: 0,
                p: 1013.25 * Math.exp(-z / 8000),
            };
        });

    it('ondes possibles : vent soutenu aux crêtes, air stable dessous, vent qui forcit sans tourner', () => {
        const wave = waveOf(flow(3, 8, 15), 2000)!;
        expect(wave.crest).toBe(2000);
        expect(wave.wind.speed).toBeCloseTo(15, 1);
        expect(wave.wind.dir).toBeCloseTo(270, 0);
        // Longueur d'onde de quelques kilomètres à quelques dizaines
        expect(wave.length).toBeGreaterThan(3000);
        expect(wave.length).toBeLessThan(30000);
    });

    it('pas d’onde par vent faible, vent qui tourne, air instable ou crêtes sous le sol', () => {
        expect(waveOf(flow(3, 8, 5), 2000)).toBeNull();
        expect(waveOf(flow(3, 8, 15, 90), 2000)).toBeNull();
        // Gradient plus fort que l'adiabatique sèche : pas de couche stable
        expect(waveOf(flow(10.5, 8, 15), 2000)).toBeNull();
        expect(waveOf(flow(3, 8, 15), 300)).toBeNull();
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

    it('la part du ciel qui cache le soleil ne dépasse jamais la couverture totale', () => {
        for (const c of cols) {
            expect(c.sunCover).toBeGreaterThanOrEqual(0);
            expect(c.sunCover).toBeLessThanOrEqual(c.cloudCover + 1e-9);
        }
        expect(cols.some(c => c.sunCover < c.cloudCover - 0.05)).toBe(true);
    });

    it('étages comptés depuis le sol : un nuage à 700 hPa est moyen en plaine, bas au-dessus d’un site d’altitude', () => {
        expect(standardAltitude(1013.25)).toBeCloseTo(0, 0);
        expect(standardAltitude(700)).toBeCloseTo(3012, -1);
        expect(standardAltitude(500)).toBeCloseTo(5574, -1);
        expect(cloudStage(850, 0)).toBe(0);
        expect(cloudStage(700, 0)).toBe(1);
        expect(cloudStage(700, 466)).toBe(1);
        expect(cloudStage(700, 2000)).toBe(0);
        expect(cloudStage(600, 2000)).toBe(1);
        // Au-dessus de 450 hPa, des nuages de glace, quelle que soit l'altitude du site
        expect(cloudStage(400, 0)).toBe(2);
        expect(cloudStage(400, 3000)).toBe(2);
    });

    it('opacité : entière à moins de 1 500 m du sol, 70 % à plus de 2 500 m, sans marche entre les deux', () => {
        expect(cloudOpacity(850, 0)).toBe(1);
        expect(cloudOpacity(700, 0)).toBeCloseTo(0.7, 6);
        // Doussard (466 m) : 700 hPa est à plus de 2 500 m du sol, rien ne change
        expect(cloudOpacity(700, 466)).toBeCloseTo(0.7, 6);
        // Site à 2 000 m : 700 hPa n'est qu'à 1 000 m du sol
        expect(cloudOpacity(700, 2000)).toBe(1);
        expect(cloudOpacity(600, 2000)).toBeGreaterThan(0.7);
        expect(cloudOpacity(600, 2000)).toBeLessThan(1);
        expect(cloudOpacity(300, 2000)).toBeCloseTo(0.3, 6);
        // D'un site à l'autre, l'opacité d'un même niveau varie sans saut
        const steps = Array.from({ length: 40 }, (_, k) => cloudOpacity(700, k * 50));
        for (let k = 1; k < steps.length; k++) {
            expect(steps[k]).toBeGreaterThanOrEqual(steps[k - 1]);
            expect(steps[k] - steps[k - 1]).toBeLessThan(0.02);
        }
    });

    it('ciel couvert à 700 hPa : il cache plus de soleil à Saint-André (1 052 m) qu’à Doussard (466 m)', () => {
        const overcast = (payload: unknown, lat: number, lon: number) => {
            const p = structuredClone(payload) as ForecastPayload;
            const n = p.sounding!.ts!.length;
            for (const key of Object.keys(p.sounding!))
                if (/^cloud-/.test(key))
                    p.sounding![key] = Array(n).fill(key === 'cloud-700h' ? 100 : 0);
            return columnsOf(p, lat, lon);
        };
        for (const c of overcast(doussard, 45.78, 6.22)) {
            expect(c.cloudCover).toBe(1);
            expect(c.sunCover).toBeCloseTo(0.7, 6);
        }
        const high = overcast(saintAndre, 43.97, 6.5);
        for (const c of high) {
            expect(c.cloudCover).toBe(1);
            expect(c.sunCover).toBeCloseTo(cloudOpacity(700, c.ground), 6);
        }
        expect(high[0].sunCover).toBeGreaterThan(0.8);
        expect(high[0].sunCover).toBeLessThan(0.95);
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
            // Le voile couvre tout le ciel, mais ne cache à lui seul que 30 % du soleil
            expect(c.sunCover).toBeGreaterThanOrEqual(0.3 - 1e-9);
            expect(c.sunCover).toBeGreaterThanOrEqual(cols[k].sunCover - 1e-9);
            expect(c.sunCover).toBeLessThanOrEqual(1 - (1 - cols[k].sunCover) * 0.7 + 1e-9);
            // Un voile de cirrus laisse passer l'essentiel du soleil : thermiques à peine affaiblis
            expect(c.wStar).toBeLessThanOrEqual(cols[k].wStar + 1e-9);
            expect(c.wStar).toBeGreaterThanOrEqual(0.85 * cols[k].wStar);
        });
    });
});

describe('sommet des cumulus', () => {
    const BASE = 1500;
    const T_BASE = 283.15;
    /**
     * Air qui suit la pseudo-adiabatique du nuage (base à 1 500 m, 10 °C), plus froid qu'elle de
     * `margin` K à tous les niveaux, avec un point de rosée `spread` K sous la température
     */
    const air = (margin: number, spread: number): ProfilePoint[] => {
        const levels = Array.from({ length: 15 }, (_, k) => 500 + 500 * k);
        const shell = levels.map(z => ({
            z,
            t: 280,
            td: 270,
            u: 0,
            v: 0,
            cloud: 0,
            p: 1013.25 * Math.exp(-z / 8000),
        }));
        const adiabat = moistAdiabat(shell, T_BASE, BASE, 7500, 10);
        return shell.map(pt => {
            const t =
                pt.z < BASE
                    ? T_BASE + 0.0065 * (BASE - pt.z)
                    : adiabat[Math.round((pt.z - BASE) / 10)].t;
            return { ...pt, t: t - margin, td: t - margin - spread };
        });
    };

    it('air sec à peine instable : sans dilution le nuage monte jusqu’en haut, dilué il reste un petit cumulus', () => {
        // Particule plus chaude que l'air de 0,2 K seulement, dans un air très sec (voile d'altitude ou non)
        const profile = air(0.2, 15);
        expect(cumulusTop(profile, BASE, T_BASE, 0)).toEqual({ top: 7500, capped: true });
        const { top, capped } = cumulusTop(profile, BASE, T_BASE);
        expect(capped).toBe(false);
        expect(top).toBeGreaterThan(BASE);
        expect(top).toBeLessThan(BASE + 1500);
    });

    it('air humide nettement instable : le nuage reste épais de plusieurs kilomètres', () => {
        // Particule plus chaude que l'air de 2 K à tous les niveaux, dans un air presque saturé
        expect(cumulusTop(air(2, 1), BASE, T_BASE).top).toBeGreaterThan(BASE + 4500);
        // Et de 6 K : elle est encore plus légère au dernier niveau des données
        expect(cumulusTop(air(6, 1), BASE, T_BASE)).toEqual({ top: 7500, capped: true });
    });

    it('plus l’air est sec, plus le sommet est bas', () => {
        const tops = [2, 6, 12, 20].map(spread => cumulusTop(air(0.5, spread), BASE, T_BASE).top);
        expect(tops).toEqual([...tops].sort((a, b) => b - a));
        expect(tops[0]).toBeGreaterThan(tops[3] + 500);
    });

    it('entraînement : d’autant plus fort que la base est proche du sol, donc le nuage petit', () => {
        // Base à 2 000 m du sol ou plus : tour d'un kilomètre de rayon
        expect(cumulusEntrainment(2000)).toBeCloseTo(2e-4, 9);
        expect(cumulusEntrainment(3500)).toBeCloseTo(2e-4, 9);
        expect(cumulusEntrainment(1000)).toBeCloseTo(4e-4, 9);
        // Jamais plus que le taux d'un nuage de 200 m de rayon
        expect(cumulusEntrainment(400)).toBeCloseTo(1e-3, 9);
        expect(cumulusEntrainment(100)).toBeCloseTo(1e-3, 9);
        expect(cumulusEntrainment(0)).toBeCloseTo(1e-3, 9);
    });

    it('un petit cumulus se dilue plus vite : son sommet est plus bas', () => {
        const profile = air(0.5, 6);
        const tops = [2000, 1000, 400].map(
            h => cumulusTop(profile, BASE, T_BASE, cumulusEntrainment(h)).top,
        );
        expect(tops).toEqual([...tops].sort((a, b) => b - a));
        expect(tops[0]).toBeGreaterThan(tops[2] + 300);
    });

    it('particule plus froide que l’air dès la base : sommet à la base', () => {
        expect(cumulusTop(air(-1, 5), BASE, T_BASE)).toEqual({ top: BASE, capped: false });
    });

    it('prévision réelle : entre la base et le sommet atteint sans dilution, qui ne change pas', () => {
        const humid = structuredClone(saintAndre) as ForecastPayload;
        humid.sounding!.dewPoint = humid.sounding!.ts!.map(
            (_, k) => (humid.data.temperature![k] ?? 290) - 3,
        );
        const cols = columnsOf(humid, 43.97, 6.5).filter(c => c.cuBase != null);
        expect(cols.length).toBeGreaterThan(0);
        for (const c of cols) {
            expect(c.cuTop!).toBeGreaterThanOrEqual(c.cuBase!);
            expect(c.cuTop!).toBeLessThanOrEqual(c.cuFreeTop!);
            // Sans dilution, le calcul redonne le sommet de la pseudo-adiabatique pure
            const tBase = c.parcelStart - 0.0098 * (c.cuBase! - c.ground);
            expect(cumulusTop(c.profile, c.cuBase!, tBase, 0).top).toBeCloseTo(c.cuFreeTop!, 6);
            // Le sommet affiché est celui de l'entraînement qui convient à la hauteur de la base,
            // jamais plus haut que celui d'une tour
            expect(c.cuTop!).toBe(
                cumulusTop(c.profile, c.cuBase!, tBase, cumulusEntrainment(c.cuBase! - c.ground))
                    .top,
            );
            expect(c.cuTop!).toBeLessThanOrEqual(cumulusTop(c.profile, c.cuBase!, tBase).top);
        }
        // Les sommets dilués sont plus bas que les autres au moins une fois
        expect(cols.some(c => c.cuTop! < c.cuFreeTop! - 200)).toBe(true);
        // Sans cumulus, ni l'un ni l'autre
        for (const c of columnsOf(saintAndre, 43.97, 6.5).filter(k => k.cuBase == null)) {
            expect(c.cuTop).toBeNull();
            expect(c.cuFreeTop).toBeNull();
        }
    });

    it('signalé comme minimum quand la particule dépasse le dernier niveau des données', () => {
        // Air humide près du sol (point de rosée 3 K sous la température) : cumulus à coup sûr
        const humid = structuredClone(saintAndre) as ForecastPayload;
        humid.sounding!.dewPoint = humid.sounding!.ts!.map(
            (_, k) => (humid.data.temperature![k] ?? 290) - 3,
        );
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
        return (
            c.parcelStart -
            0.0098 * (z - c.ground) -
            dewPointFromMixingRatio(q, pressureAt(c.profile, z))
        );
    };

    it.each(SITES)(
        'prévision réelle, $name : du sol au sommet des thermiques, sans thermique rien',
        ({ payload, lat, lon }) => {
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
                expect(a!.condensation).toBeCloseTo(
                    lclHeight(c.ground, c.parcelStart, c.parcelDew),
                    6,
                );
                expect(a!.dew[a!.dew.length - 1].z).toBeCloseTo(
                    Math.min(a!.condensation!, zMax),
                    6,
                );
                // Thermique bleu : la condensation est au-dessus du sommet, où la particule est encore
                // plus chaude que son point de rosée
                if (a!.base == null) {
                    expect(a!.condensation!).toBeGreaterThanOrEqual(a!.top);
                    expect(spread(c, a!.top)).toBeGreaterThan(0);
                    if (a!.condensation! <= zMax)
                        expect(Math.abs(spread(c, a!.condensation!))).toBeLessThan(0.5);
                }
            }
        },
    );

    it('sous un cumulus, le point de rosée rejoint la température de la particule à la base', () => {
        const humid = structuredClone(saintAndre) as ForecastPayload;
        humid.sounding!.dewPoint = humid.sounding!.ts!.map(
            (_, k) => (humid.data.temperature![k] ?? 290) - 3,
        );
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
            if (top.z > c.cuBase! + 100)
                expect(top.t).toBeGreaterThan(c.parcelStart - 0.0098 * (top.z - c.ground));
        }
    });
});

describe('couche surchauffée près du sol (tracé de la courbe d’état)', () => {
    /** Sol à 500 m, premier niveau à `first` m, plus chaud au sol de `excess` K que l'adiabatique sèche de ce niveau */
    const profile = (first: number, excess: number): ProfilePoint[] =>
        [500, first, 3000, 5500].map((z, k) => ({
            z,
            t:
                285 -
                0.0098 * (Math.min(z, first) - first) -
                0.006 * Math.max(0, z - first) +
                (k === 0 ? excess : 0),
            td: 278 - 0.004 * z,
            u: 2 + z / 1000,
            v: 0,
            cloud: 0,
            p: 1013.25 * Math.exp(-z / 8000),
        }));

    it('sol surchauffé : l’air rejoint l’adiabatique sèche du premier niveau à 100 m du sol, puis la suit', () => {
        const src = profile(900, 2);
        const out = withSurfaceLayer(src);
        expect(out.map(p => p.z)).toEqual([500, 600, 700, 800, 900, 3000, 5500]);
        // Le sol et les niveaux du modèle ne changent pas
        expect(out[0]).toBe(src[0]);
        expect(out.slice(4)).toEqual(src.slice(1));
        for (const p of out.slice(1, 4)) {
            expect(p.t).toBeCloseTo(src[1].t! + 0.0098 * (900 - p.z), 6);
            // Humidité, vent et pression : ceux du profil d'origine à cette altitude
            expect(p.td).toBeGreaterThan(src[1].td!);
            expect(p.td).toBeLessThan(src[0].td!);
            expect(p.u).toBeCloseTo(2 + p.z / 1000, 6);
            expect(p.p).toBeGreaterThan(src[1].p);
            expect(p.p).toBeLessThan(src[0].p);
        }
        // Toute la surchauffe tient dans les 100 premiers mètres
        expect(src[0].t! - 0.0098 * 100 - out[1].t!).toBeCloseTo(2, 6);
    });

    it('premier niveau proche du sol : la couche surchauffée n’en prend que le tiers', () => {
        const out = withSurfaceLayer(profile(650, 1.5));
        expect(out.map(p => p.z)).toEqual([500, 550, 650, 3000, 5500]);
    });

    it('sans surchauffe (nuit, matin stable) ou premier niveau au ras du sol : profil rendu tel quel', () => {
        const stable = profile(900, -3);
        expect(withSurfaceLayer(stable)).toBe(stable);
        const neutral = profile(900, 0);
        expect(withSurfaceLayer(neutral)).toBe(neutral);
        const close = profile(540, 2);
        expect(withSurfaceLayer(close)).toBe(close);
    });

    it('prévisions réelles : le profil des calculs n’est pas modifié, et la courbe ne change qu’entre le sol et le premier niveau', () => {
        for (const { payload, lat, lon } of SITES) {
            const cols = columnsOf(payload, lat, lon);
            const changed = cols.filter(c => withSurfaceLayer(c.profile) !== c.profile);
            expect(changed.length).toBeGreaterThan(0);
            for (const c of changed) {
                const out = withSurfaceLayer(c.profile);
                const added = out.length - c.profile.length;
                expect(out.slice(1 + added)).toEqual(c.profile.slice(1));
                // Jamais plus chaud que le sol sur l'adiabatique sèche, jamais plus froid que celle du premier niveau
                for (const p of out.slice(1, 1 + added)) {
                    expect(p.z).toBeGreaterThan(c.ground);
                    expect(p.z).toBeLessThan(c.profile[1].z);
                    expect(p.t!).toBeLessThan(c.t2m - 0.0098 * (p.z - c.ground));
                }
            }
            // La nuit, pas de couche surchauffée
            for (const c of cols.filter(k => k.hour >= 2 && k.hour <= 5))
                expect(withSurfaceLayer(c.profile)).toBe(c.profile);
        }
    });
});
