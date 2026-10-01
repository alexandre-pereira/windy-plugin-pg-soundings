import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { toHourly } from '../src/interpolate';
import {
    buildColumns,
    CIRCLING_SINK,
    CORE_FACTOR,
    type ForecastPayload,
    isShower,
    lclHeight,
    moistLapse,
    netClimb,
    type StormInputs,
    stormRiskOf,
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
        capeTopTemp: C - 40,
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
        expect(stormRiskOf({ ...night, cape: 20, precip: 5, deepCloud: 1 })).toBe(0);
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

    it.each(SITES)('prévision réelle, $name : seulement aux heures de pluie, base sous le sommet', ({ payload, lat, lon }) => {
        const cols = columnsOf(payload, lat, lon);
        for (const c of cols) {
            expect(c.showerBase == null).toBe(c.showerTop == null);
            if (c.showerBase == null || c.showerTop == null) continue;
            expect(c.precip).toBeGreaterThanOrEqual(0.1);
            expect(c.showerBase).toBeGreaterThanOrEqual(c.ground);
            expect(c.showerTop - c.showerBase).toBeGreaterThanOrEqual(2000);
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
