/**
 * Transformation des données "sounding" de Windy (niveaux de pression) en colonnes
 * altitude/heure exploitables pour un graphique de vol libre, plus quelques
 * estimations aérologiques (plafond thermique, base des cumulus, w*, isotherme 0 °C).
 */

import { CARDINALS } from './i18n';

type Series = (number | null | undefined)[];
type Hash = { [key: string]: Series | undefined };

export interface ForecastHeader {
    elevation: number;
    modelElevation?: number;
    utcOffset: number;
    availableLevels: string[];
    model: string;
    refTime?: string;
    update?: string;
    /** Présents seulement sur un point de mer / grand lac */
    sst?: number;
    hasWaves?: boolean;
}

export interface ForecastSummaryDay {
    timestamp: number;
    index: number;
    segments: number;
    day: number;
}

/** Forme simplifiée (et tolérante) de la réponse de `getPointForecastData` */
export interface ForecastPayload {
    data: Hash;
    header: ForecastHeader;
    summary?: ForecastSummaryDay[];
    sounding?: Hash;
    meteogram?: Hash;
    airgram?: Hash;
}

export interface ProfilePoint {
    /** Altitude (m AMSL) */
    z: number;
    /** Température (K) */
    t: number | null;
    /** Point de rosée (K) */
    td: number | null;
    /** Composantes du vent (m/s) */
    u: number;
    v: number;
    /** Nébulosité 0-100 % */
    cloud: number;
    /** Pression (hPa) */
    p: number;
}

export interface Column {
    ts: number;
    /** Heure locale 0-23 */
    hour: number;
    ground: number;
    /** Profil trié par altitude croissante, sol inclus */
    profile: ProfilePoint[];
    t2m: number;
    td2m: number | null;
    windSurf: number;
    windDirSurf: number;
    /** Rafales au sol (m/s), null si le modèle n'en fournit pas */
    gust: number | null;
    /** Précipitations du pas (mm d'eau), dont neige */
    precip: number;
    snow: number;
    sunElev: number;
    /** Couverture nuageuse totale estimée 0-1 */
    cloudCover: number;
    /** Sommet théorique des thermiques (m AMSL) : fin de la flottabilité de la particule */
    thermalTop: number | null;
    /** Base des cumulus (m AMSL) si les thermiques atteignent le niveau de condensation */
    cuBase: number | null;
    /** Sommet des cumulus estimé (m AMSL) : ascension pseudo-adiabatique depuis la base */
    cuTop: number | null;
    /** Température de départ de la particule (K) : air de la couche mélangée + surchauffe */
    parcelStart: number;
    /** Point de rosée (K) de la particule : humidité moyenne de la couche brassée */
    parcelDew: number | null;
    /**
     * Plafond exploitable (m AMSL) : altitude où l'ascendance au cœur des thermiques ne compense
     * plus le taux de chute d'une aile en spirale, limitée à la base des cumulus
     */
    ceiling: number | null;
    /** Énergie convective disponible (J/kg) de la particule au-dessus de la base des nuages */
    cape: number;
    /** Indice de soulèvement à 500 hPa (K) : négatif = instable ; null sans cumulus */
    liftedIndex: number | null;
    /** Risque de surdéveloppement : 0 aucun, 1 possible, 2 orage probable */
    stormRisk: 0 | 1 | 2;
    /** Pluie des 24 h précédentes (mm) : un sol mouillé chauffe moins l'air */
    recentRain: number;
    /** Vitesse convective de Deardorff estimée (m/s) */
    wStar: number;
    /** Isotherme 0 °C (m AMSL), 0 si gel au sol */
    freezing: number | null;
}

const G = 9.81;
const DRY_LAPSE = 0.0098; // K/m
const KELVIN = 273.15;
/** Surchauffe des thermiques (K) : b · flux / w* (Holtslag & Boville), bornée */
const EXCESS_B = 8.5;
const EXCESS_RANGE: readonly [number, number] = [0.3, 2];
/** Épaisseur maximale (m) de la couche mélangée dont l'air alimente les thermiques */
const MIXED_LAYER_MAX = 500;
/** Taux de chute en spirale d'une aile (m/s) */
export const CIRCLING_SINK = 1.1;
/**
 * Rapport entre l'ascendance au cœur des thermiques exploités et w* : les cœurs sont nettement
 * plus forts que la moyenne de la couche (w* 2 m/s donne ~1,4 m/s de montée nette au vario)
 */
export const CORE_FACTOR = 1.25;
const KAPPA = 0.2857;
/** En dessous de cette hauteur de soleil (°), pas de thermique */
const MIN_SUN_ELEV = 8;

const DEG = Math.PI / 180;

/** Hauteur du soleil (°) — formule simplifiée NOAA, précise à ~0.5° */
export const sunElevation = (tsMs: number, lat: number, lon: number): number => {
    const n = (tsMs - 946728000000) / 86400000; // jours depuis J2000.0
    const L = (280.46 + 0.9856474 * n) % 360;
    const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
    const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
    const eps = (23.439 - 0.0000004 * n) * DEG;
    const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
    const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
    const ha = (gmst * 15 + lon) * DEG - ra;
    const latR = lat * DEG;
    return (
        Math.asin(
            Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha),
        ) / DEG
    );
};

/** Point de rosée (K) à partir de T (K) et HR (%) — formule de Magnus */
const dewPointFromRh = (t: number, rh: number): number => {
    const tc = t - KELVIN;
    const a = 17.62;
    const b = 243.12;
    const gamma = Math.log(Math.max(rh, 1) / 100) + (a * tc) / (b + tc);
    return (b * gamma) / (a - gamma) + KELVIN;
};

const windToUV = (speed: number, dir: number) => ({
    u: -speed * Math.sin(dir * DEG),
    v: -speed * Math.cos(dir * DEG),
});

export const uvToWind = (u: number, v: number) => ({
    speed: Math.hypot(u, v),
    dir: (Math.atan2(-u, -v) / DEG + 360) % 360,
});

/**
 * Interpolation linéaire dans le profil. Retourne null hors du profil
 * ou si la valeur n'est pas disponible.
 */
type ProfileKey = 't' | 'td' | 'u' | 'v' | 'cloud';

/**
 * Pentes de l'interpolation cubique monotone de Steffen (1990) : la courbe passe exactement
 * par les niveaux du modèle, reste lisse et ne crée jamais de dépassement (pas d'inversion
 * ou de maximum fictif entre deux niveaux). Mis en cache par profil et par variable.
 */
const splineCache = new WeakMap<ProfilePoint[], Map<ProfileKey, { xs: number[]; ys: number[]; ds: number[] }>>();

const spline = (profile: ProfilePoint[], key: ProfileKey) => {
    let byKey = splineCache.get(profile);
    if (!byKey) splineCache.set(profile, (byKey = new Map()));
    let s = byKey.get(key);
    if (s) return s;

    const xs: number[] = [];
    const ys: number[] = [];
    for (const p of profile) {
        const v = p[key];
        if (v != null && (!xs.length || p.z > xs[xs.length - 1])) {
            xs.push(p.z);
            ys.push(v);
        }
    }
    const n = xs.length;
    const sec = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
    const ds = xs.map((_, i) => {
        if (n < 2) return 0;
        if (i === 0) return sec[0];
        if (i === n - 1) return sec[n - 2];
        const h0 = xs[i] - xs[i - 1];
        const h1 = xs[i + 1] - xs[i];
        const p = (sec[i - 1] * h1 + sec[i] * h0) / (h0 + h1);
        return (
            (Math.sign(sec[i - 1]) + Math.sign(sec[i])) *
            Math.min(Math.abs(sec[i - 1]), Math.abs(sec[i]), 0.5 * Math.abs(p))
        );
    });
    s = { xs, ys, ds };
    byKey.set(key, s);
    return s;
};

/**
 * Interpolation (cubique monotone) dans le profil. Retourne null hors du profil
 * ou si la valeur n'est pas disponible.
 */
export const interpProfile = (profile: ProfilePoint[], z: number, key: ProfileKey): number | null => {
    const { xs, ys, ds } = spline(profile, key);
    const n = xs.length;
    if (!n || z < xs[0] || z > xs[n - 1]) return null;
    if (n === 1) return ys[0];

    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (xs[mid] <= z) lo = mid;
        else hi = mid;
    }
    const h = xs[hi] - xs[lo];
    const t = h ? (z - xs[lo]) / h : 0;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
        (2 * t3 - 3 * t2 + 1) * ys[lo] +
        (t3 - 2 * t2 + t) * h * ds[lo] +
        (-2 * t3 + 3 * t2) * ys[hi] +
        (t3 - t2) * h * ds[hi]
    );
};

/** Vent interpolé à l'altitude z : vitesse (m/s) et direction (° d'où vient le vent) */
export const windAt = (profile: ProfilePoint[], z: number) => {
    const u = interpProfile(profile, z, 'u');
    const v = interpProfile(profile, z, 'v');
    return u == null || v == null ? null : uvToWind(u, v);
};

// ---------------------------------------------------------------------------
// Thermodynamique (émagramme)
// ---------------------------------------------------------------------------

const RD = 287.05;
const CP = 1004;
const LV = 2.501e6;
const EPS = 0.622;

/** Pression (hPa) à l'altitude z, interpolée en log(p) dans le profil (extrapolée aux bords) */
export const pressureAt = (profile: ProfilePoint[], z: number): number => {
    const n = profile.length;
    if (n < 2) return 1013.25 * Math.exp(-z / 8400);
    let i = profile.findIndex(p => p.z >= z);
    if (i <= 0) i = i === 0 ? 1 : n - 1;
    const a = profile[i - 1];
    const b = profile[i];
    const f = (z - a.z) / (b.z - a.z || 1);
    return Math.exp(Math.log(a.p) + (Math.log(b.p) - Math.log(a.p)) * f);
};

/** Pression de vapeur saturante (hPa), T en K */
const satVapor = (t: number) => 6.112 * Math.exp((17.67 * (t - KELVIN)) / (t - KELVIN + 243.5));

/** Rapport de mélange saturant (kg/kg) */
export const satMixingRatio = (t: number, p: number) => {
    const es = satVapor(t);
    return (EPS * es) / Math.max(p - es, 1);
};

/** Point de rosée (K) correspondant à un rapport de mélange w (kg/kg) à la pression p (hPa) */
export const dewPointFromMixingRatio = (w: number, p: number) => {
    const e = (w * p) / (EPS + w);
    const l = Math.log(e / 6.112);
    return (243.5 * l) / (17.67 - l) + KELVIN;
};

/** Gradient pseudo-adiabatique (K/m) */
export const moistLapse = (t: number, p: number) => {
    const w = satMixingRatio(t, p);
    return (G * (1 + (LV * w) / (RD * t))) / (CP + (LV * LV * w * EPS) / (RD * t * t));
};

/** Pseudo-adiabatique partant de (t0, z0), intégrée jusqu'à z1 (vers le haut ou le bas) */
export const moistAdiabat = (
    profile: ProfilePoint[],
    t0: number,
    z0: number,
    z1: number,
    dz = 20,
): { z: number; t: number }[] => {
    const step = z1 >= z0 ? dz : -dz;
    const out = [{ z: z0, t: t0 }];
    let t = t0;
    for (let z = z0; step > 0 ? z < z1 : z > z1; ) {
        const h = step > 0 ? Math.min(step, z1 - z) : Math.max(step, z1 - z);
        // Runge-Kutta d'ordre 2 (point milieu)
        const tMid = t - (moistLapse(t, pressureAt(profile, z)) * h) / 2;
        t -= moistLapse(tMid, pressureAt(profile, z + h / 2)) * h;
        z += h;
        out.push({ z, t });
    }
    return out;
};

/**
 * Niveau de condensation (m AMSL) d'une particule partant du sol à T (K) avec un point de
 * rosée Td (K) — température de condensation de Bolton (1980), puis montée adiabatique sèche.
 */
export const lclHeight = (ground: number, t: number, td: number | null): number => {
    if (td == null) return Infinity;
    const dew = Math.min(td, t);
    const tLcl = 1 / (1 / (dew - 56) + Math.log(t / dew) / 800) + 56;
    return ground + Math.max(0, t - tLcl) / DRY_LAPSE;
};

/**
 * Point de rosée (K) de la couche brassée entre le sol et `top` : rapport de mélange moyen de
 * l'air (tous les 50 m), ramené à la pression du sol. Sans humidité en altitude : valeur au sol.
 */
const mixedLayerDewPoint = (profile: ProfilePoint[], ground: number, top: number, tdSurface: number | null) => {
    if (tdSurface == null) return null;
    let sum = 0;
    let n = 0;
    for (let z = ground; z <= top; z += 50) {
        const t = interpProfile(profile, z, 't');
        const td = interpProfile(profile, z, 'td');
        if (t == null || td == null) continue;
        sum += satMixingRatio(Math.min(td, t), pressureAt(profile, z));
        n++;
    }
    return n ? Math.min(tdSurface, dewPointFromMixingRatio(sum / n, profile[0].p)) : tdSurface;
};

/** Transition douce de 0 (x ≤ a) à 1 (x ≥ b) */
const smoothStep = (x: number, a: number, b: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

/** Altitude (m) d'une pression (hPa) dans le profil, interpolée en log(p) ; null hors du profil */
const heightOfPressure = (profile: ProfilePoint[], p: number): number | null => {
    for (let k = 1; k < profile.length; k++) {
        const a = profile[k - 1];
        const b = profile[k];
        if (a.p >= p && b.p <= p && a.p !== b.p) {
            const f = (Math.log(a.p) - Math.log(p)) / (Math.log(a.p) - Math.log(b.p));
            return a.z + (b.z - a.z) * f;
        }
    }
    return null;
};

/** Température virtuelle (K) : T corrigée de l'humidité (l'air humide est plus léger) */
const virtualTemp = (t: number, mixingRatio: number) => t * (1 + 0.608 * mixingRatio);

/**
 * Chemin de la particule : adiabatique sèche depuis le sol jusqu'au niveau de condensation,
 * puis pseudo-adiabatique au-dessus.
 */
export const parcelPath = (col: Column, zTop: number): { z: number; t: number }[] => {
    const lcl = lclHeight(col.ground, col.parcelStart, col.parcelDew);
    const dryTop = Math.min(lcl, zTop);
    const path = [
        { z: col.ground, t: col.parcelStart },
        { z: dryTop, t: col.parcelStart - DRY_LAPSE * (dryTop - col.ground) },
    ];
    if (lcl < zTop) {
        path.push(...moistAdiabat(col.profile, path[1].t, lcl, zTop, 10).slice(1));
    }
    return path;
};

/**
 * Profil vertical de la vitesse ascensionnelle relative à w*, en fonction de la hauteur
 * réduite zr = (z - sol) / épaisseur de la couche convective. Forme volontairement simple :
 * montée en puissance dans les premiers 15 %, puis décroissance vers le sommet.
 */
export const thermalShape = (zr: number): number => {
    if (zr <= 0 || zr >= 1) return 0;
    const bottom = zr < 0.15 ? zr / 0.15 : 1;
    return bottom * (1 - 0.6 * zr * zr);
};

/**
 * Accès aux séries de plusieurs "hash" (sounding, airgram, meteogram) qui peuvent chacun
 * avoir leur propre axe temporel.
 */
const makeLookup = (sources: (Hash | undefined)[]) => {
    const indexed = sources
        .filter((s): s is Hash => !!s && Array.isArray(s.ts))
        .map(hash => {
            const idx = new Map<number, number>();
            (hash.ts as number[]).forEach((ts, i) => idx.set(ts, i));
            return { hash, idx };
        });

    /** Indice du pas le plus proche de ts, à 30 min près (séries pas toujours calées sur les mêmes heures) */
    const nearestIndex = (list: number[], idx: Map<number, number>, ts: number) => {
        const exact = idx.get(ts);
        if (exact !== undefined) return exact;
        let lo = 0;
        let hi = list.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (list[mid] < ts) lo = mid + 1;
            else hi = mid;
        }
        let best = lo;
        if (lo > 0 && Math.abs(list[lo - 1] - ts) < Math.abs(list[lo] - ts)) best = lo - 1;
        return Math.abs(list[best] - ts) <= 30 * 60e3 ? best : undefined;
    };

    return (key: string, ts: number): number | null => {
        for (const { hash, idx } of indexed) {
            const serie = hash[key];
            const i = serie ? nearestIndex(hash.ts as number[], idx, ts) : undefined;
            if (serie && i !== undefined) {
                const val = serie[i];
                if (val != null && Number.isFinite(val)) return val;
            }
        }
        return null;
    };
};

const num = (serie: Series | undefined, i: number, fallback = 0): number => {
    const v = serie?.[i];
    return v != null && Number.isFinite(v) ? v : fallback;
};

/**
 * Part de neige (mm d'eau) des précipitations d'un pas : série de Windy si elle existe, sinon type de
 * précipitation (neige, neige mouillée, pluie et neige), sinon température au sol (≤ 0,5 °C)
 */
const snowPart = (data: Hash, i: number, t2m: number): number => {
    const total = num(data.precipAmount, i);
    if (total <= 0) return 0;
    const snow = data.precipSnowAmount?.[i];
    if (snow != null && Number.isFinite(snow)) return Math.min(total, Math.max(0, snow));
    const type = data.precipType?.[i];
    if (type === 4 || type === 5) return total;
    if (type === 6 || type === 3) return total / 2;
    if (type != null) return 0;
    return t2m <= KELVIN + 0.5 ? total : 0;
};

/** Valeur à l'indice i, sinon la plus proche dans ±maxDist pas (séries parfois tri-horaires) ; null sinon */
const nearestNum = (serie: Series | undefined, i: number, maxDist = 3): number | null => {
    for (let d = 0; d <= maxDist; d++) {
        for (const k of d ? [i - d, i + d] : [i]) {
            const v = serie?.[k];
            if (v != null && Number.isFinite(v)) return v;
        }
    }
    return null;
};

/**
 * `keepHour` (optionnel) : ne calcule que les heures locales retenues, pour aller plus vite quand
 * seule une partie de la journée sert (carte des Vz : 11 h – 17 h).
 */
export const buildColumns = (
    payload: ForecastPayload,
    lat: number,
    lon: number,
    keepHour?: (hour: number) => boolean,
): Column[] => {
    const { data, header } = payload;
    const ground = Math.round(header.modelElevation ?? header.elevation ?? 0);
    // Tous les niveaux réellement présents dans les données, en plus de ceux annoncés dans l'en-tête :
    // aucun niveau fourni par le modèle ne doit être ignoré (c'est ce qui fait la précision des courbes)
    const levelSet = new Set((header.availableLevels || []).filter(l => l !== 'surface'));
    for (const hash of [payload.sounding, payload.airgram, payload.meteogram]) {
        for (const key of Object.keys(hash || {})) {
            const m = /^temp-(\d+h)$/.exec(key);
            if (m) levelSet.add(m[1]);
        }
    }
    const levels = [...levelSet];
    const get = makeLookup([payload.sounding, payload.airgram, payload.meteogram]);

    const tsList = (data.ts || []) as number[];
    const columns: Column[] = [];

    tsList.forEach((ts, i) => {
        if (keepHour && !keepHour(num(data.hour, i, new Date(ts + header.utcOffset * 3600e3).getUTCHours()))) return;
        const t2m = num(data.temperature, i, NaN);
        if (!Number.isFinite(t2m)) return;

        const windSurf = num(data.wind, i);
        const windDirSurf = num(data.windDir, i);
        const td2m = get('dewPoint', ts);

        const profile: ProfilePoint[] = [
            {
                z: ground,
                t: t2m,
                td: td2m,
                ...windToUV(windSurf, windDirSurf),
                cloud: 0,
                p: 0, // calculée ci-dessous
            },
        ];

        for (const level of levels) {
            const gh = get(`gh-${level}`, ts);
            const speed = get(`wind-${level}`, ts);
            const dir = get(`windDir-${level}`, ts);
            if (gh == null || speed == null || dir == null || gh <= ground + 20) continue;

            const t = get(`temp-${level}`, ts);
            let td = get(`dewPoint-${level}`, ts);
            const rh = get(`rh-${level}`, ts);
            if (td == null && t != null && rh != null) td = dewPointFromRh(t, rh);

            profile.push({
                z: gh,
                t,
                td,
                ...windToUV(speed, dir),
                cloud: get(`cloud-${level}`, ts) ?? 0,
                p: parseFloat(level),
            });
        }

        // Pas de données en altitude pour ce pas de temps (hors échéance du modèle)
        if (profile.length < 3) return;
        profile.sort((a, b) => a.z - b.z);

        // Pression au sol par la loi hypsométrique depuis le premier niveau au-dessus
        const first = profile[1];
        const tMean = ((first.t ?? t2m) + t2m) / 2;
        profile[0].p = first.p * Math.exp(((first.z - ground) * G) / (RD * tMean));

        const sunElev = sunElevation(ts, lat, lon);
        // Couverture nuageuse totale : maximum par étage (bas / moyen / haut), puis recouvrement
        // aléatoire entre étages (écart moyen ~12 % avec la couverture totale des modèles)
        const layerMax = (pMin: number, pMax: number) =>
            Math.max(0, ...profile.filter(p => p.p > pMin && p.p <= pMax).map(p => p.cloud / 100));
        const cloudCover = Math.min(
            1,
            1 - (1 - layerMax(700, 1100)) * (1 - layerMax(450, 700)) * (1 - layerMax(0, 450)),
        );
        // Couverture « vue par le soleil » : un voile de cirrus (étage haut) laisse passer l'essentiel
        // du rayonnement, un altostratus (étage moyen) beaucoup moins, les nuages bas presque rien
        const sunCover = Math.min(
            1,
            1 - (1 - layerMax(700, 1100)) * (1 - 0.7 * layerMax(450, 700)) * (1 - 0.3 * layerMax(0, 450)),
        );

        // --- Méthode de la particule, air de la couche mélangée
        let thermalTop: number | null = null;
        let cuBase: number | null = null;
        let cuTop: number | null = null;
        let wStar = 0;
        let parcelStart = t2m;
        let parcelDew: number | null = td2m;
        let cape = 0;
        let liftedIndex: number | null = null;
        let stormRisk: 0 | 1 | 2 = 0;
        let ceiling: number | null = null;

        // Pluie des 24 h précédentes : fournie par la prévision réduite à un instant (curseur de
        // l'émagramme), sinon cumulée sur la série
        let recentRain = 0;
        if (data.recentRain) {
            recentRain = num(data.recentRain, i);
        } else {
            for (let k = Math.max(0, i - 24); k < i; k++) recentRain += num(data.precipAmount, k);
        }

        // Point de mer ou de grand lac : l'eau ne chauffe pas l'air, pas de thermiques
        const overWater = header.sst != null || header.hasWaves === true;

        if (sunElev > MIN_SUN_ELEV && !overWater) {
            const zMax = profile[profile.length - 1].z;
            const p0 = profile[0].p;
            const theta = (t: number, p: number) => t * Math.pow(1000 / p, KAPPA);
            const fromTheta = (th: number) => th * Math.pow(p0 / 1000, KAPPA);

            // Flux de chaleur sensible (cinématique, K·m/s) : rayonnement global (ciel clair atténué
            // par les nuages vus par le soleil, Kasten & Czeplak), dont ~35 % chauffe l'air ; beaucoup
            // moins sous ciel couvert, et jusqu'à 40 % de moins sur un sol mouillé (évaporation)
            const global = 1361 * Math.sin(sunElev * DEG) * 0.75 * (1 - 0.75 * Math.pow(sunCover, 3.4));
            const soilDry = 1 - 0.4 * smoothStep(recentRain, 0.5, 10);
            const sensibleFraction = 0.35 * (1 - 0.5 * sunCover) * soilDry;
            const kinematicFlux = (sensibleFraction * Math.max(0, global)) / 1200;

            // Flottabilité (K) = Tv particule − Tv environnement, en température virtuelle
            const envTv = (z: number) => {
                const t = interpProfile(profile, z, 't');
                if (t == null) return null;
                const td = interpProfile(profile, z, 'td');
                return virtualTemp(t, td == null ? 0 : satMixingRatio(Math.min(td, t), pressureAt(profile, z)));
            };
            // Sommet sec d'une particule (t0 au sol, rapport de mélange q) : pas de 10 m, puis
            // interpolation du passage à zéro. La particule de la couche mélangée est plus fraîche que
            // la couche surchauffée juste au-dessus du sol (qui l'alimente) : la recherche commence là
            // où elle devient plus légère que l'air, dans la couche mélangée (sur « within » m au plus)
            const STEP = 10;
            const dryTop = (t0: number, q: number, within = 0) => {
                let top = ground;
                const buoy = (z: number) => {
                    const tv = envTv(z);
                    return tv == null ? null : virtualTemp(t0 - DRY_LAPSE * (z - ground), q) - tv;
                };
                let start = ground;
                while (start < ground + within && (buoy(start) ?? -1) < 0) start += STEP;
                if ((buoy(start) ?? -1) < 0) return ground;
                top = start;
                let prev = buoy(start) ?? 0;
                for (let z = start + STEP; z <= zMax; z += STEP) {
                    const b = buoy(z);
                    if (b == null) break;
                    if (b < 0) {
                        top = z - STEP + (STEP * prev) / Math.max(prev - b, 1e-6);
                        break;
                    }
                    prev = b;
                    top = z;
                }
                return top;
            };
            const qOf = (dew: number | null) => (dew == null ? 0 : satMixingRatio(Math.min(dew, t2m), p0));

            // 1er passage : particule de surface (+1 K), pour connaître l'épaisseur brassée
            const firstTop = dryTop(t2m + 1, qOf(td2m));
            const mixDepth = Math.min(MIXED_LAYER_MAX, Math.max(100, firstTop - ground));

            // Air de départ : température potentielle moyenne de la couche mélangée. L'après-midi,
            // l'air à 2 m est surchauffé juste au-dessus du sol : un thermique emporte en réalité
            // l'air mélangé de toute la couche. On ne dépasse jamais l'air de surface (matin stable).
            let thSum = 0;
            let thN = 0;
            for (let z = ground; z <= ground + mixDepth; z += 25) {
                const t = interpProfile(profile, z, 't');
                if (t == null) continue;
                thSum += theta(t, pressureAt(profile, z));
                thN++;
            }
            const thetaBase = Math.min(theta(t2m, p0), thN ? thSum / thN : theta(t2m, p0));
            parcelDew = mixedLayerDewPoint(profile, ground, ground + mixDepth, td2m);

            // Surchauffe selon le flux et w* (Holtslag & Boville) : ~0,5 K le matin, jusqu'à ~1,5 K
            // en plein soleil, au lieu d'une valeur fixe
            const wFirst = Math.cbrt((G / t2m) * kinematicFlux * Math.max(100, firstTop - ground));
            const excess = Math.min(
                EXCESS_RANGE[1],
                Math.max(EXCESS_RANGE[0], (EXCESS_B * kinematicFlux) / Math.max(0.3, wFirst)),
            );
            parcelStart = fromTheta(thetaBase) + excess;
            const qParcel = qOf(parcelDew);

            const top = firstTop - ground < 150 ? ground : dryTop(parcelStart, qParcel, mixDepth);
            const depth = top - ground;
            if (depth >= 150) {
                thermalTop = top;
                wStar = Math.cbrt((G / t2m) * kinematicFlux * depth);

                // Base des cumulus : condensation de la particule mélangée (Bolton)
                const lcl = lclHeight(ground, parcelStart, parcelDew);
                if (lcl < top) {
                    cuBase = lcl;
                    // Au-dessus : la particule saturée monte tant qu'elle reste plus légère (sommet du
                    // cumulus), et son énergie de flottaison donne la CAPE
                    const path = moistAdiabat(profile, parcelStart - DRY_LAPSE * (lcl - ground), lcl, zMax, STEP);
                    cuTop = lcl;
                    let rising = true;
                    for (let k = 1; k < path.length; k++) {
                        const pt = path[k];
                        const tv = envTv(pt.z);
                        if (tv == null) break;
                        const tvParcel = virtualTemp(pt.t, satMixingRatio(pt.t, pressureAt(profile, pt.z)));
                        if (rising && tvParcel >= tv) cuTop = pt.z;
                        else rising = false;
                        if (tvParcel > tv) cape += (G * (tvParcel - tv) * (pt.z - path[k - 1].z)) / tv;
                    }
                    // Indice de soulèvement : écart environnement − particule à 500 hPa
                    const z500 = heightOfPressure(profile, 500);
                    if (z500 != null && z500 > lcl) {
                        const pt = path.reduce((best, q) => (Math.abs(q.z - z500) < Math.abs(best.z - z500) ? q : best));
                        const tEnv = interpProfile(profile, z500, 't');
                        if (tEnv != null && Math.abs(pt.z - z500) < 50) liftedIndex = tEnv - pt.t;
                    }
                    // Risque de surdéveloppement, en trois questions :
                    // 1. La bulle a-t-elle assez d'énergie (CAPE) pour faire de gros cumulus épais ?
                    // 2. Le modèle prévoit-il lui-même des nuages dans cette couche (hors voiles de cirrus,
                    //    au-dessus de 450 hPa) ou de la pluie d'averse ? Sinon : aucun risque affiché.
                    // 3. L'air vers 4 000 m est-il très sec ? Les cumulus s'y étouffent : un cran de moins.
                    const cuDepth = cuTop - cuBase;
                    let risk = 0;
                    if (cape >= 800 && cuDepth >= 3000 && (liftedIndex == null || liftedIndex <= -2)) risk = 2;
                    else if (cape >= 300 && cuDepth >= 2000) risk = 1;
                    const convRain = num(data.precipConvectiveAmount, i);
                    const z450 = heightOfPressure(profile, 450) ?? Infinity;
                    const cuLayerTop = Math.min(cuTop, z450, cuBase + 4000);
                    const modelCumulus = Math.max(
                        0,
                        ...profile.filter(p => p.z >= cuBase! - 200 && p.z <= cuLayerTop).map(p => p.cloud / 100),
                    );
                    if (modelCumulus < 0.2 && convRain < 0.1) risk = 0;
                    const z600 = heightOfPressure(profile, 600);
                    if (risk > 0 && z600 != null && convRain < 0.1) {
                        const t6 = interpProfile(profile, z600, 't');
                        const td6 = interpProfile(profile, z600, 'td');
                        if (t6 != null && td6 != null && t6 - td6 > 12) risk--;
                    }
                    stormRisk = risk as 0 | 1 | 2;
                }

                // Plafond exploitable (« Hcrit ») : l'ascendance au cœur des thermiques doit compenser
                // le taux de chute en spirale ; sous 15 % de la couche, la montée en puissance du
                // thermique n'est pas limitante. Jamais au-dessus de la base des cumulus.
                const limit = cuBase == null ? top : Math.min(top, cuBase);
                let usable = ground;
                for (let z = ground + 25; z <= limit; z += 25) {
                    if (CORE_FACTOR * wStar * thermalShape((z - ground) / depth) < CIRCLING_SINK && (z - ground) / depth > 0.15) {
                        break;
                    }
                    usable = z;
                }
                ceiling = Math.max(usable, Math.min(limit, ground + 0.15 * depth));
                // Moins de 100 m au-dessus du sol : pas de thermique exploitable
                if (ceiling - ground < 100) ceiling = null;
            }
        }

        // --- Isotherme 0 °C
        let freezing: number | null = null;
        if (t2m <= KELVIN) {
            freezing = ground;
        } else {
            // Sur la courbe interpolée, par pas de 10 m
            const zMax = profile[profile.length - 1].z;
            let prevT = t2m;
            for (let z = ground + 10; z <= zMax; z += 10) {
                const t = interpProfile(profile, z, 't');
                if (t == null) break;
                if (t <= KELVIN) {
                    freezing = z - 10 + (10 * (prevT - KELVIN)) / Math.max(prevT - t, 1e-6);
                    break;
                }
                prevT = t;
            }
        }

        columns.push({
            ts,
            hour: num(data.hour, i, new Date(ts + header.utcOffset * 3600e3).getUTCHours()),
            ground,
            profile,
            t2m,
            td2m,
            windSurf,
            windDirSurf,
            gust: nearestNum(data.windGust, i),
            precip: num(data.precipAmount, i),
            snow: snowPart(data, i, t2m),
            sunElev,
            cloudCover,
            thermalTop,
            cuBase,
            cuTop,
            parcelStart,
            parcelDew,
            ceiling,
            wStar,
            freezing,
            cape: Math.round(cape),
            liftedIndex: liftedIndex == null ? null : Math.round(liftedIndex * 10) / 10,
            stormRisk,
            recentRain,
        });
    });

    return columns;
};

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

type RGB3 = [number, number, number];

/**
 * Ciel du fond des graphiques (haut → bas) : bleu ciel le jour, bleu nuit la nuit, et nuages
 * (blancs le jour, gris-bleu la nuit pour ne pas « briller »). `night` : 0 jour … 1 nuit.
 */
const SKY = {
    dark: {
        day: { top: [58, 120, 186] as RGB3, bottom: [120, 176, 226] as RGB3, cloud: [242, 246, 250] as RGB3 },
        night: { top: [9, 16, 38] as RGB3, bottom: [20, 34, 68] as RGB3, cloud: [92, 104, 130] as RGB3 },
    },
    light: {
        day: { top: [138, 192, 238] as RGB3, bottom: [204, 228, 248] as RGB3, cloud: [252, 253, 255] as RGB3 },
        night: { top: [70, 90, 136] as RGB3, bottom: [108, 128, 170] as RGB3, cloud: [150, 160, 182] as RGB3 },
    },
};

const lerp3 = (a: RGB3, b: RGB3, t: number): RGB3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
];

export const skyColors = (light: boolean, night: number) => {
    const s = light ? SKY.light : SKY.dark;
    const t = Math.min(1, Math.max(0, night));
    return { top: lerp3(s.day.top, s.night.top, t), bottom: lerp3(s.day.bottom, s.night.bottom, t), cloud: lerp3(s.day.cloud, s.night.cloud, t) };
};

/** Part de nuit (0 jour … 1 nuit) selon la hauteur du soleil, avec transition à l'aube et au crépuscule */
export const nightFactor = (sunElev: number) => (sunElev <= -4 ? 1 : sunElev >= 4 ? 0 : (4 - sunElev) / 8);

export const rgbCss = (c: RGB3) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

type Stop = [number, [number, number, number]];

const hex = (h: string): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
];

const gradientRGB =
    (stops: Stop[]) =>
    (value: number): [number, number, number] => {
        if (!(value > stops[0][0])) return stops[0][1];
        for (let i = 0; i < stops.length - 1; i++) {
            const [v0, c0] = stops[i];
            const [v1, c1] = stops[i + 1];
            if (value <= v1) {
                const f = (value - v0) / (v1 - v0);
                return c0.map((c, k) => Math.round(c + (c1[k] - c) * f)) as [number, number, number];
            }
        }
        return stops[stops.length - 1][1];
    };

const css = (rgb: [number, number, number]) => `rgb(${rgb.join(',')})`;

/** Couleur du vent en km/h */
const windRGB = gradientRGB([
    [0, hex('#9be7ff')],
    [10, hex('#52d68a')],
    [20, hex('#e6e84a')],
    [30, hex('#ffa233')],
    [40, hex('#ff4a4a')],
    [55, hex('#d64bff')],
]);

/**
 * Couleur de l'ascendance en m/s : une famille de couleur différente tous les 0,5 m/s, du jaune
 * pâle au violet profond pour les thermiques forts
 */
export const thermalRGB = gradientRGB([
    [0, hex('#fef9c3')],
    [0.5, hex('#fde047')],
    [1, hex('#fb923c')],
    [1.5, hex('#ef4444')],
    [2, hex('#db2777')],
    [2.5, hex('#a21caf')],
    [3, hex('#7c3aed')],
    [3.5, hex('#4c1d95')],
    [4.5, hex('#2e1065')],
]);

/** Texte lisible (sombre ou blanc) sur un fond coloré d'ascendance */
export const thermalTextColor = (w: number) => (w >= 1.5 ? '#fff' : '#111');

/** Même échelle en teintes plus soutenues, lisibles sur fond clair (thème clair) */
const windRGBLight = gradientRGB([
    [0, hex('#0284c7')],
    [10, hex('#15803d')],
    [20, hex('#a16207')],
    [30, hex('#c2410c')],
    [40, hex('#b91c1c')],
    [55, hex('#86198f')],
]);

export const windColor = (kmh: number, light = false) => css((light ? windRGBLight : windRGB)(kmh));
export const thermalColor = (w: number) => css(thermalRGB(w));

/** Direction cardinale (d'où vient le vent) */
export const cardinal = (dir: number) => CARDINALS[Math.round((((dir % 360) + 360) % 360) / 22.5) % 16];

export const toKmh = (ms: number) => ms * 3.6;
export const toCelsius = (k: number) => k - KELVIN;
