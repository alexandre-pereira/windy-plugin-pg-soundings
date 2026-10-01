/**
 * Transformation des données "sounding" de Windy (niveaux de pression) en colonnes
 * altitude/heure exploitables pour un graphique de vol libre, plus quelques
 * estimations aérologiques (plafond thermique, base des cumulus, w*, isotherme 0 °C).
 */

import { CARDINALS } from './i18n';
import { localHour, makeOffsetAt } from './time';

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
    /**
     * Présent quand Windy a prolongé la prévision avec un autre modèle au-delà de l'échéance
     * du modèle demandé (ex. ICON-D2 complété par un modèle à plus longue échéance)
     */
    merged?: { mergedModelName?: string; mergedModelStart?: string };
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
    /** Décalage horaire du lieu à cet instant (h), changement d'heure compris */
    utcOffset: number;
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
    /**
     * Nuages (0-1) des niveaux situés au-dessus du profil et dont le modèle ne donne que la
     * nébulosité (souvent les cirrus, 300–150 hPa) ; 0 s'il n'y en a pas
     */
    highCloud: number;
    /**
     * Altitude (m AMSL) du plus haut niveau dont la nébulosité est connue, quand le modèle ne
     * fournit rien au-dessus de 350 hPa : les voiles de cirrus (300–200 hPa) échappent alors à
     * cloudCover. null quand ces niveaux sont fournis.
     */
    cloudTop: number | null;
    /** Sommet théorique des thermiques (m AMSL) : fin de la flottabilité de la particule */
    thermalTop: number | null;
    /** Base des cumulus (m AMSL) si les thermiques atteignent le niveau de condensation */
    cuBase: number | null;
    /** Sommet des cumulus estimé (m AMSL) : ascension pseudo-adiabatique depuis la base */
    cuTop: number | null;
    /**
     * La particule est encore plus légère que l'air au dernier niveau des données : cuTop n'est
     * qu'un minimum, le vrai sommet est plus haut
     */
    cuTopCapped: boolean;
    /** Température de départ de la particule (K) : air de la couche mélangée + surchauffe */
    parcelStart: number;
    /** Point de rosée (K) de la particule : humidité moyenne de la couche brassée */
    parcelDew: number | null;
    /**
     * Plafond exploitable (m AMSL) : altitude où l'ascendance au cœur des thermiques ne compense
     * plus le taux de chute d'une aile en spirale, limitée à la base des cumulus
     */
    ceiling: number | null;
    /**
     * CAPE (J/kg) « standard » : particule mélangée des 100 hPa les plus bas, sans surchauffe.
     * Nettement plus faible que la CAPE publiée par certains modèles (ECMWF : particule la plus
     * instable, souvent 2 à 4 fois plus). Elle sert aussi aux seuils du risque d'orage.
     */
    cape: number;
    /** Indice de soulèvement standard à 500 hPa (K) : négatif = instable */
    liftedIndex: number | null;
    /**
     * CAPE (J/kg) et indice de soulèvement (K) de la particule la plus instable : la particule
     * standard, ou l'air d'un niveau plus haut (300 hPa les plus bas) s'il a plus d'énergie. C'est
     * elle qui nourrit un orage venu d'ailleurs, même quand l'air près du sol est stable (soir, nuit).
     */
    muCape: number;
    muLiftedIndex: number | null;
    /** Cisaillement (m/s) : écart entre le vent au sol et le vent 6 km plus haut */
    shear: number;
    /** Vent moyen du sol à 6 km, celui qui déplace les orages : composantes vers l'est et le nord (m/s) */
    steerU: number;
    steerV: number;
    /** Air propice aux orages violents (voir isSevereEnv), qu'un orage soit prévu ou non */
    severeEnv: boolean;
    /**
     * Risque d'orage (voir stormRiskOf) : 0 aucun signal, 1 surdéveloppement possible, 2 orage
     * probable, 3 orage violent possible
     */
    stormRisk: StormRisk;
    /**
     * Nuage d'averses (m AMSL), les heures de pluie convective (voir isShower) : nuage que le modèle
     * développe lui-même, sans les thermiques du sol (nuit, ciel couvert, averses venues d'ailleurs).
     * De la condensation au niveau d'équilibre de la particule standard ; null sinon.
     */
    showerBase: number | null;
    showerTop: number | null;
    /** Pluie des 24 h précédentes (mm) : un sol mouillé chauffe moins l'air */
    recentRain: number;
    /** Vitesse convective de Deardorff estimée (m/s) : vitesse de l'air, pas du parapente */
    wStar: number;
    /**
     * Montée nette au vario (m/s) au meilleur de la couche : cœur des thermiques (CORE_FACTOR · w*)
     * moins le taux de chute en spirale ; 0 sans thermique exploitable
     */
    climb: number;
    /** Vent moyen de la couche thermique (sol → plafond), composantes vers l'est et le nord (m/s) */
    blU: number;
    blV: number;
    /** Vitesse moyenne du vent dans la couche thermique (m/s) */
    blSpeed: number;
    /** Rapport w* ÷ u* : sous ~2,3 la turbulence mécanique (vent) domine, les thermiques sont hachés */
    convRatio: number | null;
    /** Thermiques hachés par le vent : 0 non, 1 hachés, 2 très hachés / inexploitables */
    choppy: 0 | 1 | 2;
    /** Isotherme 0 °C (m AMSL), 0 si gel au sol */
    freezing: number | null;
}

/** Options du calcul des colonnes */
export interface BuildOptions {
    /** Ne calcule que les heures locales retenues (carte des cross : heures de vol seulement) */
    keepHour?: (hour: number) => boolean;
    /** CAPE, indice de soulèvement et risque d'orage (inutiles pour la carte des cross) ; oui par défaut */
    stability?: boolean;
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
/** Montée au vario minimale (m/s) pour parler de thermique exploitable */
const MIN_CLIMB = 0.1;
/** Montée au vario (m/s) et hauteur exploitable (m sol) à partir desquelles un thermique est facile à tenir */
const EASY_CLIMB = 0.5;
const EASY_DEPTH = 300;
const KAPPA = 0.2857;
/** En dessous de cette hauteur de soleil (°), pas de thermique */
const MIN_SUN_ELEV = 8;
/** Constante de von Kármán et rugosité du sol (m, relief et végétation variés) pour u* */
const KARMAN = 0.4;
const ROUGHNESS = 0.3;
/**
 * Seuils des thermiques hachés : rapport w* ÷ u* (−zi/L = κ·(w* ÷ u*)³ ; sous ~5, soit w* ÷ u* < 2,3,
 * convection forcée) et vent moyen de la couche thermique (km/h)
 */
const CHOPPY_RATIO: readonly [number, number] = [1.5, 2.3];
const CHOPPY_WIND_KMH: readonly [number, number] = [25, 40];

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

/** Constantes de Magnus (Bolton 1980), les mêmes pour la vapeur saturante et le point de rosée */
const MAGNUS_A = 17.67;
const MAGNUS_B = 243.5;

/** Point de rosée (K) à partir de T (K) et HR (%) — formule de Magnus */
const dewPointFromRh = (t: number, rh: number): number => {
    const tc = t - KELVIN;
    const gamma = Math.log(Math.max(rh, 1) / 100) + (MAGNUS_A * tc) / (MAGNUS_B + tc);
    return (MAGNUS_B * gamma) / (MAGNUS_A - gamma) + KELVIN;
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
const satVapor = (t: number) => 6.112 * Math.exp((MAGNUS_A * (t - KELVIN)) / (t - KELVIN + MAGNUS_B));

/** Rapport de mélange saturant (kg/kg) */
export const satMixingRatio = (t: number, p: number) => {
    const es = satVapor(t);
    return (EPS * es) / Math.max(p - es, 1);
};

/** Point de rosée (K) correspondant à un rapport de mélange w (kg/kg) à la pression p (hPa) */
export const dewPointFromMixingRatio = (w: number, p: number) => {
    const e = (w * p) / (EPS + w);
    const l = Math.log(e / 6.112);
    return (MAGNUS_B * l) / (MAGNUS_A - l) + KELVIN;
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

/** Ascension de la particule des thermiques (températures en K, altitudes en m AMSL) */
export interface ParcelAscent {
    /** Température de la particule, du sol au sommet de son ascension */
    path: { z: number; t: number }[];
    /**
     * Point de rosée de la particule (rapport de mélange constant), du sol au niveau de condensation,
     * qu'elle l'atteigne ou non (borné au sommet du profil) ; vide quand l'humidité au sol est inconnue
     */
    dew: { z: number; t: number }[];
    /**
     * Niveau de condensation de la particule, où elle passe de l'adiabatique sèche à la
     * pseudo-adiabatique, qu'elle l'atteigne ou non ; null quand l'humidité au sol est inconnue
     */
    condensation: number | null;
    /** Base des cumulus : le niveau de condensation, si la particule l'atteint */
    base: number | null;
    /** Sommet de l'ascension : sommet des cumulus, sinon sommet des thermiques */
    top: number;
}

/**
 * Ascension réelle de la particule des thermiques, là où `parcelPath` prolonge son chemin jusqu'en
 * haut du profil : adiabatique sèche depuis le sol, puis pseudo-adiabatique dans le cumulus, arrêtée
 * au sommet des thermiques ou du cumulus. null sans thermique.
 */
export const parcelAscent = (col: Column): ParcelAscent | null => {
    if (col.thermalTop == null) return null;
    const base = col.cuBase;
    const top = base == null ? col.thermalTop : Math.max(base, col.cuTop ?? base);
    const path = parcelPath(col, top);

    const dew: { z: number; t: number }[] = [];
    let condensation: number | null = null;
    if (col.parcelDew != null) {
        condensation = base ?? lclHeight(col.ground, col.parcelStart, col.parcelDew);
        const q = satMixingRatio(Math.min(col.parcelDew, col.parcelStart), col.profile[0].p);
        const dewAt = (z: number) => ({ z, t: dewPointFromMixingRatio(q, pressureAt(col.profile, z)) });
        const zMax = col.profile[col.profile.length - 1].z;
        const end = Math.min(condensation, zMax);
        for (let z = col.ground; z < end; z += 50) dew.push(dewAt(z));
        // Au niveau de condensation, le point de rosée rejoint la température de la particule
        dew.push(
            condensation <= zMax
                ? { z: condensation, t: col.parcelStart - DRY_LAPSE * (condensation - col.ground) }
                : dewAt(zMax),
        );
    }
    return { path, dew, condensation, base, top };
};

/**
 * Profil vertical de la vitesse ascensionnelle relative à w*, en fonction de la hauteur
 * réduite zr = (z - sol) / épaisseur de la couche convective : pleine force dès le sol, presque
 * constante jusqu'au milieu, puis nulle au sommet, où les thermiques s'essoufflent en se mélangeant
 * à l'air stable du dessus (à 90 % de la couche : 0,34 ; à 95 % : 0,19).
 * Pas de montée en puissance au-dessus du sol : elle n'existe que sur terrain plat (thermiques
 * étroits et désorganisés dans les premières dizaines de mètres). En relief, les pentes déclenchent
 * à toutes les altitudes et le pilote décolle dedans : la hauteur au-dessus du sol du modèle n'y
 * a pas de sens, et une bande sans ascendance au ras du sol serait fausse.
 */
export const thermalShape = (zr: number): number => (zr <= 0 || zr >= 1 ? 0 : 1 - zr ** 4);

/**
 * Montée nette au vario (m/s) à l'altitude z : ascendance au cœur des thermiques moins le taux de
 * chute en spirale. C'est ce que lit le pilote, et ce qu'affichent graphiques et résumés.
 */
export const varioAt = (c: Column, z: number): number =>
    c.thermalTop != null && c.climb > 0 && z > c.ground && z < c.thermalTop
        ? Math.max(0, CORE_FACTOR * c.wStar * thermalShape((z - c.ground) / (c.thermalTop - c.ground)) - CIRCLING_SINK)
        : 0;

/** Montée nette au vario (m/s) pour une ascendance de l'air w (m/s) au cœur des thermiques */
export const netClimb = (wAir: number) => Math.max(0, CORE_FACTOR * wAir - CIRCLING_SINK);

/** Facilité d'exploitation des thermiques, du plus facile au plus difficile */
export type ThermalEase = 'easy' | 'weak' | 'low' | 'choppy' | 'rough';

/**
 * Facilité d'exploitation des thermiques d'une heure ; null sans thermique exploitable.
 * Le vent prime (hachés, puis très hachés : voir `choppy`) ; sinon un thermique reste délicat à
 * tenir quand il monte peu ou que la hauteur exploitable est faible.
 */
export const thermalEase = (c: Column): ThermalEase | null => {
    if (c.ceiling == null) return null;
    if (c.choppy === 2) return 'rough';
    if (c.choppy === 1) return 'choppy';
    if (c.climb < EASY_CLIMB) return 'weak';
    if (c.ceiling - c.ground < EASY_DEPTH) return 'low';
    return 'easy';
};

/** Température virtuelle de l'environnement (K) à l'altitude z ; null hors du profil */
const envVirtualTemp = (profile: ProfilePoint[], z: number) => {
    const t = interpProfile(profile, z, 't');
    if (t == null) return null;
    const td = interpProfile(profile, z, 'td');
    return virtualTemp(t, td == null ? 0 : satMixingRatio(Math.min(td, t), pressureAt(profile, z)));
};

/** Énergie et sommet d'une particule soulevée (températures en K, altitudes en m AMSL) */
interface ParcelStability {
    cape: number;
    liftedIndex: number | null;
    /** Température de l'air au niveau d'équilibre */
    topTemp: number | null;
    /** Nuage convectif de la particule : de la condensation au niveau d'équilibre */
    base: number | null;
    top: number | null;
}

const NO_STABILITY: ParcelStability = { cape: 0, liftedIndex: null, topTemp: null, base: null, top: null };

/**
 * CAPE et indice de soulèvement d'une particule partie de l'altitude z0 à la température t0 (K) avec
 * le rapport de mélange q : montée sèche jusqu'à la condensation, puis pseudo-adiabatique.
 */
const liftParcel = (profile: ProfilePoint[], z0: number, t0: number, q: number): ParcelStability => {
    const zMax = profile[profile.length - 1].z;
    const p0 = z0 <= profile[0].z ? profile[0].p : pressureAt(profile, z0);
    const lcl = Math.min(q > 1e-5 ? lclHeight(z0, t0, dewPointFromMixingRatio(q, p0)) : Infinity, zMax);

    const STEP = 20;
    let cape = 0;
    // Plus haut niveau où la particule est encore plus légère que l'air (niveau d'équilibre)
    let topZ: number | null = null;
    const add = (z: number, tvParcel: number) => {
        const tv = envVirtualTemp(profile, z);
        if (tv != null && tvParcel > tv) {
            cape += (G * (tvParcel - tv) * STEP) / tv;
            topZ = z;
        }
    };
    for (let z = z0 + STEP; z < lcl; z += STEP) add(z, virtualTemp(t0 - DRY_LAPSE * (z - z0), q));
    const path = lcl < zMax ? moistAdiabat(profile, t0 - DRY_LAPSE * (lcl - z0), lcl, zMax, STEP) : [];
    for (const pt of path.slice(1)) add(pt.z, virtualTemp(pt.t, satMixingRatio(pt.t, pressureAt(profile, pt.z))));

    // Indice de soulèvement : environnement − particule à 500 hPa
    let liftedIndex: number | null = null;
    const z500 = heightOfPressure(profile, 500);
    const tEnv = z500 == null ? null : interpProfile(profile, z500, 't');
    if (z500 != null && tEnv != null && z500 > z0) {
        if (z500 <= lcl) liftedIndex = tEnv - (t0 - DRY_LAPSE * (z500 - z0));
        else if (path.length) {
            const pt = path.reduce((best, p) => (Math.abs(p.z - z500) < Math.abs(best.z - z500) ? p : best));
            if (Math.abs(pt.z - z500) <= STEP) liftedIndex = tEnv - pt.t;
        }
    }
    const topTemp = topZ == null ? null : interpProfile(profile, topZ, 't');
    // Nuage convectif de cette particule : de la condensation au niveau d'équilibre, s'il est au-dessus
    const cloudy = topZ != null && lcl < topZ;
    return { cape, liftedIndex, topTemp, base: cloudy ? lcl : null, top: cloudy ? topZ : null };
};

/**
 * CAPE et indice de soulèvement « standard » (particule mélangée, pas la plus instable) : air
 * mélangé des 100 hPa les plus bas (température potentielle et humidité moyennes), sans
 * surchauffe. Calculés aussi la nuit.
 */
const standardStability = (profile: ProfilePoint[], ground: number): ParcelStability => {
    const p0 = profile[0].p;
    const zTopMl = heightOfPressure(profile, p0 - 100) ?? ground + 1000;
    let thSum = 0;
    let qSum = 0;
    let n = 0;
    for (let z = ground; z <= zTopMl; z += 50) {
        const t = interpProfile(profile, z, 't');
        if (t == null) continue;
        const td = interpProfile(profile, z, 'td');
        const p = pressureAt(profile, z);
        thSum += t * Math.pow(1000 / p, KAPPA);
        qSum += td == null ? 0 : satMixingRatio(Math.min(td, t), p);
        n++;
    }
    if (!n) return NO_STABILITY;
    return liftParcel(profile, ground, (thSum / n) * Math.pow(p0 / 1000, KAPPA), qSum / n);
};

/** Température potentielle équivalente (K) — Bolton (1980), forme simplifiée */
const thetaE = (t: number, td: number | null, p: number) => {
    const theta = t * Math.pow(1000 / p, KAPPA);
    if (td == null) return theta;
    const dew = Math.min(td, t);
    const tLcl = 1 / (1 / (dew - 56) + Math.log(t / dew) / 800) + 56;
    return theta * Math.exp((LV * satMixingRatio(dew, p)) / (CP * tLcl));
};

/**
 * Particule la plus instable : la particule standard, ou l'air du niveau le plus « chaud et humide »
 * (température potentielle équivalente la plus forte) des 300 hPa les plus bas, s'il a plus d'énergie.
 * L'air à 2 m n'est pas candidat : surchauffé l'après-midi, il fausserait les seuils. Un orage déjà
 * formé se nourrit de cet air-là, où qu'il soit : c'est la particule qui compte pour un orage venu
 * d'ailleurs, quand l'air près du sol s'est stabilisé (soir, nuit, fond de vallée).
 */
const mostUnstable = (profile: ProfilePoint[], std: ParcelStability): ParcelStability => {
    const pMin = profile[0].p - 300;
    let best: ProfilePoint | null = null;
    let bestTheta = -Infinity;
    for (const pt of profile.slice(1)) {
        if (pt.p < pMin || pt.t == null) continue;
        const th = thetaE(pt.t, pt.td, pt.p);
        if (th > bestTheta) {
            bestTheta = th;
            best = pt;
        }
    }
    if (!best || best.t == null) return std;
    const lifted = liftParcel(
        profile,
        best.z,
        best.t,
        best.td == null ? 0 : satMixingRatio(Math.min(best.td, best.t), best.p),
    );
    const li = [std.liftedIndex, lifted.liftedIndex].filter((v): v is number => v != null);
    return { ...(lifted.cape > std.cape ? lifted : std), liftedIndex: li.length ? Math.min(...li) : null };
};

/** Épaisseur (m) de la couche du cisaillement et du vent qui déplace les orages */
const DEEP_LAYER = 6000;

/**
 * Vent de la couche profonde (sol → 6 km, ou le sommet du profil s'il est plus bas) : cisaillement
 * (écart entre le vent du sommet et celui du sol, m/s) et vent moyen, qui déplace les orages.
 */
const deepLayerWind = (profile: ProfilePoint[], ground: number) => {
    const top = Math.min(ground + DEEP_LAYER, profile[profile.length - 1].z);
    const { u: u0, v: v0 } = profile[0];
    let su = 0;
    let sv = 0;
    let n = 0;
    for (let z = ground; z <= top; z += 250) {
        const u = interpProfile(profile, z, 'u');
        const v = interpProfile(profile, z, 'v');
        if (u == null || v == null) continue;
        su += u;
        sv += v;
        n++;
    }
    const uTop = interpProfile(profile, top, 'u') ?? u0;
    const vTop = interpProfile(profile, top, 'v') ?? v0;
    return { shear: Math.hypot(uTop - u0, vTop - v0), steerU: n ? su / n : u0, steerV: n ? sv / n : v0 };
};

/**
 * Seuils d'un air propice aux orages violents. WMAXSHEAR = √(2 · CAPE) × cisaillement sol–6 km
 * (m²/s²) : le produit de la force des ascendances et de l'organisation de l'orage par le vent,
 * meilleur indicateur des orages violents en Europe (Taszarek et al., 2020 : violents à partir de
 * ~500 m²/s²). La CAPE calculée ici s'arrête au dernier niveau fourni (400 hPa) : elle vaut environ
 * 65 % de la CAPE complète, donc 500 ici ≈ 620 sur un profil complet. Un vent fort en altitude ne
 * suffit pas : il faut aussi un air nettement instable (LI ≤ −2). Sans vent en altitude, il faut
 * une instabilité très forte (LI ≤ −6). Seuils calés sur GFS et ICON-EU (30 sites d'Europe,
 * septembre 2026) : un jour d'orage sur trois à quatre y est classé violent.
 */
const SEVERE_WMAXSHEAR = 500;
const SEVERE_WMAXSHEAR_LI = -2;
const SEVERE_LI = -6;
/** Rafales du modèle (m/s) qui font d'un orage un orage violent : 70 km/h */
const SEVERE_GUST = 70 / 3.6;

/** √(2 · CAPE) × cisaillement (m²/s²) */
export const wmaxShear = (cape: number, shear: number) => Math.sqrt(2 * Math.max(0, cape)) * shear;

/**
 * L'air est-il propice aux orages violents (grêle, fortes rafales) ? Énergie de la particule la plus
 * instable (J/kg), son indice de soulèvement (K) et cisaillement sol–6 km (m/s).
 */
export const isSevereEnv = (e: { cape: number; liftedIndex: number | null; shear: number }): boolean => {
    const li = e.liftedIndex;
    if (li != null && li <= SEVERE_LI) return true;
    return wmaxShear(e.cape, e.shear) >= SEVERE_WMAXSHEAR && (li == null || li <= SEVERE_WMAXSHEAR_LI);
};

/** Éléments du risque d'orage d'une heure (températures en K, énergies en J/kg) */
export interface StormInputs {
    /** Cumulus des thermiques de l'heure, s'il y en a */
    cumulus: {
        /** CAPE de la particule des thermiques (surchauffée), plus forte que la CAPE standard */
        cape: number;
        /** Épaisseur (m) de la base au sommet estimé */
        depth: number;
        /** Température de l'air au sommet */
        topTemp: number | null;
        /** Plus forte couverture nuageuse (0–1) prévue par le modèle dans la couche du cumulus */
        modelCloud: number;
        /** Air très sec vers 600 hPa (écart T − Td > 12 K) : les petits cumulus s'y étouffent */
        dryMid: boolean;
    } | null;
    /** CAPE standard (particule mélangée, sans surchauffe) : énergie des cumulus des thermiques */
    cape: number;
    /** CAPE de la particule la plus instable : énergie des orages du modèle, venus d'ailleurs ou non */
    muCape: number;
    /** Température au sommet de la particule la plus instable (niveau d'équilibre) */
    muTopTemp: number | null;
    /** Air propice aux orages violents (isSevereEnv), ou fortes rafales du modèle à cette heure */
    severe: boolean;
    /** Précipitations de l'heure (mm), dont convectives (averses du modèle) */
    precip: number;
    convRain: number;
    /**
     * Pluie du modèle (mm/h) au plus fort sur l'heure et les deux qui l'encadrent : confirme que le
     * modèle fait lui-même tourner la convection près de là
     */
    rainNear: number;
    /** Nuages épais du modèle (0–1) : présents à la fois entre 700 et 500 hPa et là où il fait moins de −20 °C */
    deepCloud: number;
}

/** 0 aucun signal, 1 surdéveloppement possible, 2 orage probable, 3 orage violent possible */
export type StormRisk = 0 | 1 | 2 | 3;

/**
 * Risque d'orage : 0 aucun signal, 1 surdéveloppement possible, 2 orage probable, 3 orage violent
 * possible. Un orage demande un nuage qui monte bien au-dessus de −20 °C : sans glace au sommet,
 * pas d'éclairs. Deux voies, la plus forte l'emporte :
 * - les cumulus des thermiques (journée) : épaisseur, énergie et sommet froid, confirmés par
 *   les nuages ou les averses du modèle ; l'orage probable demande en plus de la pluie du modèle
 *   à ±1 h (sans elle, le modèle ne développe pas lui-même la convection : surdéveloppement) ;
 * - les orages du modèle lui-même, à toute heure (soir, ciel couvert, orages venus d'ailleurs) :
 *   énergie de la particule la plus instable, sommet froid, nuages épais et pluie. Ces orages-là
 *   ne dépendent pas de l'air près du sol, qui peut s'être stabilisé.
 * Les seuils d'énergie (≥ 300 J/kg, ceux de la littérature) supposent une particule sans surchauffe.
 * Un orage probable devient un orage violent possible dans un air propice (`severe`).
 */
export const stormRiskOf = (s: StormInputs): StormRisk => {
    const below = (t: number | null, c: number) => t != null && t <= KELVIN + c;
    const showers = s.convRain >= 0.1;

    let fromCumulus: 0 | 1 | 2 = 0;
    const cu = s.cumulus;
    if (cu && (cu.modelCloud >= 0.2 || showers)) {
        const stormCloud = cu.depth >= 4000 && below(cu.topTemp, -20) && s.cape >= 300;
        if (stormCloud) {
            // Sans pluie du modèle à ±1 h, il ne développe pas lui-même la convection : surdéveloppement
            fromCumulus = s.rainNear >= 0.1 ? 2 : 1;
        } else if (cu.depth >= 2000 && cu.cape >= 300) {
            // Air sec en altitude : il étouffe les cumulus moyens, pas un nuage d'orage déjà bien
            // nourri (au contraire, il rend ses rafales plus violentes)
            fromCumulus = cu.dryMid && !showers ? 0 : 1;
        }
    }

    let fromModel: 0 | 1 | 2 = 0;
    const deep = s.deepCloud >= 0.5;
    if (s.muCape >= 300 && below(s.muTopTemp, -20) && (s.convRain >= 0.5 || (deep && s.precip >= 0.5))) fromModel = 2;
    else if (s.muCape >= 200 && below(s.muTopTemp, -10) && (showers || (deep && s.precip >= 0.2))) fromModel = 1;

    const risk = Math.max(fromCumulus, fromModel) as 0 | 1 | 2;
    return risk === 2 && s.severe ? 3 : risk;
};

/** Énergie (J/kg) et épaisseur (m) minimales du nuage convectif pour parler d'averse */
const SHOWER_CAPE = 50;
const SHOWER_DEPTH = 2000;

/**
 * La pluie de l'heure est-elle une averse (nuage convectif, « vertical ») plutôt qu'une pluie de
 * nuages en couches (front) ? Oui si le modèle annonce lui-même des précipitations convectives,
 * sinon si la particule standard a de quoi monter : un peu d'énergie sur une couche épaisse.
 * Seuils calés sur les précipitations convectives de GFS et d'ICON-EU (24 sites d'Europe,
 * septembre 2026) : 7 à 9 heures ainsi repérées sur 10 sont bien des averses pour le modèle, et
 * 6 à 8 averses sur 10 sont repérées (les autres sont de faibles averses presque sans énergie).
 */
export const isShower = (s: {
    /** Précipitations de l'heure (mm), dont convectives quand le modèle les fournit */
    precip: number;
    convRain: number;
    /** CAPE standard (J/kg) et épaisseur (m) du nuage de la particule standard */
    cape: number;
    depth: number;
}): boolean => s.precip >= 0.1 && (s.convRain >= 0.1 || (s.cape >= SHOWER_CAPE && s.depth >= SHOWER_DEPTH));

/** Heures locales surveillées par l'alerte d'orage d'une journée (première et dernière) */
const WATCH_HOURS: readonly [number, number] = [8, 22];
/** Vitesse de déplacement (m/s) à partir de laquelle un orage arrive vite : 40 km/h */
export const FAST_STORM = 40 / 3.6;

/** Alerte d'orage d'une journée : ce qui peut surprendre un pilote, résumé en une fois */
export interface StormWatch {
    /**
     * 3 : orage violent possible ; 2 : orage probable ; 1 : surdéveloppement dans un air propice aux
     * orages violents (s'il tourne à l'orage, il sera violent)
     */
    level: 1 | 2 | 3;
    /** Première heure de l'épisode */
    from: Column;
    /** L'air de l'épisode est propice aux orages violents (sinon, niveau 3 : fortes rafales du modèle) */
    severeEnv: boolean;
    /** Indice de soulèvement le plus bas de l'épisode (particule la plus instable, K) */
    liftedIndex: number | null;
    /** Cisaillement sol–6 km le plus fort de l'épisode (m/s) */
    shear: number;
    /** Vent qui déplace l'orage à la première heure : vitesse (m/s) et direction d'où il vient (°) */
    speed: number;
    dir: number;
    /** Plus fortes rafales du modèle pendant l'épisode (m/s) ; null s'il n'en fournit pas */
    gust: number | null;
    /** Heure qui précède l'épisode, quand le modèle n'y montre aucun signe (ni surdéveloppement, ni pluie) */
    calmBefore: Column | null;
    /**
     * Ciel déjà couvert de nuages bas ou moyens l'heure qui précède (un voile de cirrus ne cache
     * rien) : l'orage peut arriver sans qu'on le voie
     */
    hidden: boolean;
}

/**
 * Alerte d'orage d'une journée (`cols` : ses heures, dans l'ordre), entre 8 h et 22 h et hors des
 * heures déjà passées à `nowTs` ; null sans rien à signaler. L'épisode retenu est le plus grave :
 * les heures d'orage (niveau 2 ou 3), sinon les heures de surdéveloppement dans un air propice aux
 * orages violents.
 */
export const stormWatchOf = (cols: Column[], nowTs = 0): StormWatch | null => {
    const watched = cols.filter(c => c.hour >= WATCH_HOURS[0] && c.hour <= WATCH_HOURS[1] && c.ts + 3600e3 > nowTs);
    let hours = watched.filter(c => c.stormRisk >= 2);
    let level: StormWatch['level'] = hours.some(c => c.stormRisk === 3) ? 3 : 2;
    if (!hours.length) {
        hours = watched.filter(c => c.stormRisk === 1 && c.severeEnv);
        level = 1;
    }
    if (!hours.length) return null;

    const from = hours[0];
    const prev = cols[cols.indexOf(from) - 1];
    // Sans signe avant-coureur : seulement pour un orage, et s'il n'a pas déjà commencé
    const before = level >= 2 && prev && from.ts > nowTs ? prev : null;
    const gusts = hours.map(c => c.gust).filter((g): g is number => g != null);
    const lis = hours.map(c => c.muLiftedIndex).filter((v): v is number => v != null);
    const steer = uvToWind(from.steerU, from.steerV);
    return {
        level,
        from,
        severeEnv: hours.some(c => c.severeEnv),
        liftedIndex: lis.length ? Math.min(...lis) : null,
        shear: Math.max(...hours.map(c => c.shear)),
        speed: steer.speed,
        dir: steer.dir,
        gust: gusts.length ? Math.max(...gusts) : null,
        calmBefore: before && before.stormRisk === 0 && before.precip < 0.1 ? before : null,
        hidden: !!before && Math.max(0, ...before.profile.filter(p => p.p > 450).map(p => p.cloud)) >= 80,
    };
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
export const snowPart = (data: Hash, i: number, t2m: number): number => {
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
 * Colonnes altitude × heure de la prévision. `options.keepHour` : ne calcule que les heures locales
 * retenues, pour aller plus vite quand seule une partie de la journée sert (carte des cross).
 */
export const buildColumns = (
    payload: ForecastPayload,
    lat: number,
    lon: number,
    { keepHour, stability = true }: BuildOptions = {},
): Column[] => {
    const { data, header } = payload;
    const offsetAt = makeOffsetAt(payload, lat, lon);
    const ground = Math.round(header.modelElevation ?? header.elevation ?? 0);
    // Tous les niveaux réellement présents dans les données, en plus de ceux annoncés dans l'en-tête :
    // aucun niveau fourni par le modèle ne doit être ignoré (c'est ce qui fait la précision des courbes)
    const levelSet = new Set((header.availableLevels || []).filter(l => l !== 'surface'));
    for (const hash of [payload.sounding, payload.airgram, payload.meteogram]) {
        for (const key of Object.keys(hash || {})) {
            const m = /^(?:temp|cloud)-(\d+h)$/.exec(key);
            if (m) levelSet.add(m[1]);
        }
    }
    const levels = [...levelSet];
    const get = makeLookup([payload.sounding, payload.airgram, payload.meteogram]);

    const tsList = (data.ts || []) as number[];
    const columns: Column[] = [];

    tsList.forEach((ts, i) => {
        const utcOffset = offsetAt(ts);
        const hour = localHour(ts, utcOffset);
        if (keepHour && !keepHour(hour)) return;
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

        // Niveaux dont le modèle ne donne que la nébulosité (cirrus) : comptés pour les nuages seulement
        const cloudOnly: { p: number; cloud: number }[] = [];
        // Plus basse pression (hPa) dont la nébulosité est connue
        let cloudMinP = Infinity;
        for (const level of levels) {
            const gh = get(`gh-${level}`, ts);
            const speed = get(`wind-${level}`, ts);
            const dir = get(`windDir-${level}`, ts);
            const cloudLevel = get(`cloud-${level}`, ts);
            if (gh != null && gh <= ground + 20) continue;
            if (cloudLevel != null) cloudMinP = Math.min(cloudMinP, parseFloat(level));
            if (gh == null || speed == null || dir == null) {
                if (cloudLevel != null) cloudOnly.push({ p: parseFloat(level), cloud: cloudLevel });
                continue;
            }

            const t = get(`temp-${level}`, ts);
            let td = get(`dewPoint-${level}`, ts);
            const rh = get(`rh-${level}`, ts);
            if (td == null && t != null && rh != null) td = dewPointFromRh(t, rh);

            profile.push({
                z: gh,
                t,
                td,
                ...windToUV(speed, dir),
                cloud: cloudLevel ?? 0,
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

        // Nébulosité seule : uniquement au-dessus du profil (sans altitude, un niveau plus bas pourrait
        // être sous le sol)
        const pTop = profile[profile.length - 1].p;
        const highLevels = cloudOnly.filter(c => c.p < pTop);
        const highCloud = Math.max(0, ...highLevels.map(c => c.cloud / 100));
        const cloudTop = cloudMinP <= 350 ? null : profile[profile.length - 1].z;

        const sunElev = sunElevation(ts, lat, lon);
        // Couverture nuageuse totale : maximum par étage (bas / moyen / haut), puis recouvrement
        // aléatoire entre étages (écart moyen ~12 % avec la couverture totale des modèles)
        const layerMax = (pMin: number, pMax: number) =>
            Math.max(0, ...[...profile, ...highLevels].filter(p => p.p > pMin && p.p <= pMax).map(p => p.cloud / 100));
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
        let cuTopCapped = false;
        let wStar = 0;
        let parcelStart = t2m;
        let parcelDew: number | null = td2m;
        // CAPE de la particule des thermiques (surchauffée) : sert au surdéveloppement, car ce sont
        // les thermiques qui font grossir les cumulus
        let thermalCape = 0;
        let cumulus: StormInputs['cumulus'] = null;
        let ceiling: number | null = null;

        // Pluie des 24 h précédentes : fournie par la prévision réduite à un instant (curseur de
        // l'émagramme), sinon cumulée sur la série
        let recentRain = 0;
        if (data.recentRain) {
            recentRain = num(data.recentRain, i);
        } else {
            for (let k = Math.max(0, i - 24); k < i; k++) recentRain += num(data.precipAmount, k);
        }
        // Neige tombée dans les 48 h (mm d'eau), faute d'épaisseur de neige au sol chez Windy : un sol
        // enneigé renvoie le soleil et reste à 0 °C, il ne chauffe presque plus l'air. Seule la neige
        // tombée pendant la prévision est connue (pas celle des jours d'avant)
        let recentSnow = 0;
        if (data.recentSnow) {
            recentSnow = num(data.recentSnow, i);
        } else {
            for (let k = Math.max(0, i - 48); k < i; k++) recentSnow += snowPart(data, k, num(data.temperature, k, t2m));
        }

        // Point de mer ou de grand lac : l'eau ne chauffe pas l'air, pas de thermiques
        const overWater = header.sst != null || header.hasWaves === true;

        if (sunElev > MIN_SUN_ELEV && !overWater) {
            const zMax = profile[profile.length - 1].z;
            const p0 = profile[0].p;
            const theta = (t: number, p: number) => t * Math.pow(1000 / p, KAPPA);
            const fromTheta = (th: number) => th * Math.pow(p0 / 1000, KAPPA);

            // Flux de chaleur sensible (cinématique, K·m/s). Rayonnement global par ciel clair selon
            // Haurwitz (juste aussi quand le soleil est bas, matin, soir et hiver), atténué par les nuages
            // vus par le soleil (Kasten & Czeplak), dont ~35 % chauffe l'air ; jusqu'à 40 % de moins sur
            // un sol mouillé (évaporation). Le facteur (1 − 0,5 · nuages) compte les nuages une seconde
            // fois : c'est un calage volontaire (sous ciel couvert, le sol humide évapore davantage).
            const sinH = Math.sin(sunElev * DEG);
            const clearSky = 1098 * sinH * Math.exp(-0.057 / sinH);
            const global = clearSky * (1 - 0.75 * Math.pow(sunCover, 3.4));
            const soilDry = 1 - 0.4 * smoothStep(recentRain, 0.5, 10);
            // Neige fraîche au sol (plus de ~1 cm) : jusqu'à 70 % de flux en moins
            const snowFree = 1 - 0.7 * smoothStep(recentSnow, 1, 8);
            const sensibleFraction = 0.35 * (1 - 0.5 * sunCover) * soilDry * snowFree;
            // ρ·cp de l'air au sol : l'air moins dense en altitude se réchauffe plus pour le même flux
            const rhoCp = ((p0 * 100) / (RD * t2m)) * CP;
            const kinematicFlux = (sensibleFraction * Math.max(0, global)) / rhoCp;

            // Flottabilité (K) = Tv particule − Tv environnement, en température virtuelle
            const envTv = (z: number) => envVirtualTemp(profile, z);
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

            // Surchauffe selon le flux et w* (Holtslag & Boville) : ~0,5 K le matin, ~1,5 K en plein
            // soleil (2 K au plus), au lieu d'une valeur fixe
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
                // Base des cumulus : condensation de la particule mélangée (Bolton)
                const lcl = lclHeight(ground, parcelStart, parcelDew);
                // w* de Deardorff sur la couche brassée : sous les cumulus, elle s'arrête à leur base
                // (au-dessus, c'est la condensation qui entretient l'ascendance, pas le sol)
                const mixedDepth = Math.max(100, Math.min(top, lcl) - ground);
                wStar = Math.cbrt((G / t2m) * kinematicFlux * mixedDepth);

                if (lcl < top) {
                    cuBase = lcl;
                    // Au-dessus : la particule saturée monte tant qu'elle reste plus légère (sommet du
                    // cumulus), et son énergie de flottaison donne la CAPE des thermiques
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
                        if (tvParcel > tv) thermalCape += (G * (tvParcel - tv) * (pt.z - path[k - 1].z)) / tv;
                    }
                    // Encore plus légère au dernier niveau : le sommet réel est au-delà des données
                    cuTopCapped = rising;
                    // Cumulus des thermiques, pour le risque d'orage : nuages du modèle dans la même
                    // couche (hors voiles de cirrus, au-dessus de 450 hPa) et humidité vers 4 000 m
                    const z450 = heightOfPressure(profile, 450) ?? Infinity;
                    const cuLayerTop = Math.min(cuTop, z450, cuBase + 4000);
                    const modelCloud = Math.max(
                        0,
                        ...profile.filter(p => p.z >= cuBase! - 200 && p.z <= cuLayerTop).map(p => p.cloud / 100),
                    );
                    const z600 = heightOfPressure(profile, 600);
                    const t6 = z600 == null ? null : interpProfile(profile, z600, 't');
                    const td6 = z600 == null ? null : interpProfile(profile, z600, 'td');
                    cumulus = {
                        cape: thermalCape,
                        depth: cuTop - cuBase,
                        topTemp: interpProfile(profile, cuTop, 't'),
                        modelCloud,
                        dryMid: t6 != null && td6 != null && t6 - td6 > 12,
                    };
                }

                // Plafond exploitable (« Hcrit ») : l'ascendance au cœur des thermiques doit compenser
                // le taux de chute en spirale ; jamais sous 15 % de la couche, ni au-dessus de la base
                // des cumulus.
                const limit = cuBase == null ? top : Math.min(top, cuBase);
                let usable = ground;
                for (let z = ground + 25; z <= limit; z += 25) {
                    if (CORE_FACTOR * wStar * thermalShape((z - ground) / depth) < CIRCLING_SINK && (z - ground) / depth > 0.15) {
                        break;
                    }
                    usable = z;
                }
                ceiling = Math.max(usable, Math.min(limit, ground + 0.15 * depth));
                // Moins de 100 m au-dessus du sol, ou à peine de quoi tenir en l'air (moins de
                // 0,1 m/s au vario) : pas de thermique exploitable
                if (ceiling - ground < 100 || netClimb(wStar) < MIN_CLIMB) ceiling = null;
            }
        }

        // --- Vent de la couche thermique (sol → plafond, ou 500 m sans thermique) et turbulence
        // mécanique : u* par la loi logarithmique depuis le vent à 10 m, comparé à w*
        const blTop = Math.max(ceiling ?? ground + 500, ground + 60);
        let su = 0;
        let sv = 0;
        let ss = 0;
        let nw = 0;
        for (let z = ground + 50; z <= blTop; z += 100) {
            const u = interpProfile(profile, z, 'u');
            const v = interpProfile(profile, z, 'v');
            if (u == null || v == null) continue;
            su += u;
            sv += v;
            ss += Math.hypot(u, v);
            nw++;
        }
        const blSpeed = nw ? ss / nw : windSurf;
        const uStar = (KARMAN * windSurf) / Math.log(10 / ROUGHNESS);
        const convRatio = wStar > 0 ? wStar / Math.max(uStar, 0.05) : null;
        let choppy: 0 | 1 | 2 = 0;
        if (ceiling != null && convRatio != null) {
            const kmh = blSpeed * 3.6;
            if (kmh >= CHOPPY_WIND_KMH[1] || convRatio < CHOPPY_RATIO[0]) choppy = 2;
            else if (kmh >= CHOPPY_WIND_KMH[0] || convRatio < CHOPPY_RATIO[1]) choppy = 1;
        }

        // --- CAPE et indice de soulèvement standard (affichés)
        const std = stability ? standardStability(profile, ground) : NO_STABILITY;

        // --- Risque d'orage (inutile sans la CAPE standard : carte des cross)
        let stormRisk: StormRisk = 0;
        let mu = std;
        let deepWind = { shear: 0, steerU: 0, steerV: 0 };
        let severeEnv = false;
        if (stability) {
            mu = mostUnstable(profile, std);
            deepWind = deepLayerWind(profile, ground);
            severeEnv = isSevereEnv({ cape: mu.cape, liftedIndex: mu.liftedIndex, shear: deepWind.shear });
            // Rafales du modèle à ±1 h : le front de rafales précède l'orage
            const gustNear = Math.max(0, ...[i - 1, i, i + 1].map(k => num(data.windGust, k)));
            const cloudWhere = (keep: (p: ProfilePoint) => boolean) =>
                Math.max(0, ...profile.filter(keep).map(p => p.cloud / 100));
            const midCloud = cloudWhere(p => p.p <= 700 && p.p >= 500);
            const coldCloud = cloudWhere(p => p.p >= 350 && p.t != null && p.t <= KELVIN - 20);
            stormRisk = stormRiskOf({
                cumulus,
                cape: std.cape,
                muCape: mu.cape,
                muTopTemp: mu.topTemp,
                severe: severeEnv || gustNear >= SEVERE_GUST,
                precip: num(data.precipAmount, i),
                convRain: num(data.precipConvectiveAmount, i),
                rainNear: data.rainNear
                    ? num(data.rainNear, i)
                    : Math.max(num(data.precipAmount, i - 1), num(data.precipAmount, i), num(data.precipAmount, i + 1)),
                deepCloud: Math.min(midCloud, coldCloud),
            });
        }

        // --- Nuage d'averses : convection que le modèle développe lui-même
        const shower =
            std.base != null &&
            std.top != null &&
            isShower({
                precip: num(data.precipAmount, i),
                convRain: num(data.precipConvectiveAmount, i),
                cape: std.cape,
                depth: std.top - std.base,
            });

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
            hour,
            utcOffset,
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
            highCloud,
            cloudTop,
            thermalTop,
            cuBase,
            cuTop,
            cuTopCapped,
            parcelStart,
            parcelDew,
            ceiling,
            wStar,
            climb: ceiling == null ? 0 : netClimb(wStar),
            blU: nw ? su / nw : 0,
            blV: nw ? sv / nw : 0,
            blSpeed,
            convRatio,
            choppy,
            freezing,
            cape: Math.round(std.cape),
            liftedIndex: std.liftedIndex == null ? null : Math.round(std.liftedIndex * 10) / 10,
            muCape: Math.round(mu.cape),
            muLiftedIndex: mu.liftedIndex == null ? null : Math.round(mu.liftedIndex * 10) / 10,
            shear: deepWind.shear,
            steerU: deepWind.steerU,
            steerV: deepWind.steerV,
            severeEnv,
            stormRisk,
            showerBase: shower ? std.base : null,
            showerTop: shower ? std.top : null,
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
 * Ciel du fond du graphique (haut → bas), le même dans les deux thèmes : bleu ciel le jour, bleu
 * nuit la nuit, et nuages en couches du modèle (gris clair le jour, pour laisser le blanc aux
 * cumulus ; gris-bleu la nuit pour ne pas « briller »). `night` : 0 jour … 1 nuit.
 */
const SKY = {
    day: { top: [58, 120, 186] as RGB3, bottom: [120, 176, 226] as RGB3, cloud: [206, 214, 225] as RGB3 },
    night: { top: [9, 16, 38] as RGB3, bottom: [20, 34, 68] as RGB3, cloud: [92, 104, 130] as RGB3 },
};

/**
 * Tours de cumulus du graphique (corps, et base plus sombre) : blanches par beau temps, grises
 * quand il en tombe des averses ; assombries la nuit comme le reste du ciel.
 */
const TOWER = {
    fair: {
        day: { body: [255, 255, 255] as RGB3, base: [184, 196, 211] as RGB3 },
        night: { body: [168, 178, 198] as RGB3, base: [120, 131, 154] as RGB3 },
    },
    shower: {
        day: { body: [158, 169, 186] as RGB3, base: [92, 104, 124] as RGB3 },
        night: { body: [126, 137, 160] as RGB3, base: [84, 95, 118] as RGB3 },
    },
};

const lerp3 = (a: RGB3, b: RGB3, t: number): RGB3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
];

export const skyColors = (night: number) => {
    const t = Math.min(1, Math.max(0, night));
    return {
        top: lerp3(SKY.day.top, SKY.night.top, t),
        bottom: lerp3(SKY.day.bottom, SKY.night.bottom, t),
        cloud: lerp3(SKY.day.cloud, SKY.night.cloud, t),
    };
};

export const towerColors = (shower: boolean, night: number) => {
    const s = shower ? TOWER.shower : TOWER.fair;
    const t = Math.min(1, Math.max(0, night));
    return { body: lerp3(s.day.body, s.night.body, t), base: lerp3(s.day.base, s.night.base, t) };
};

/**
 * Part de nuit (0 jour … 1 nuit) selon la hauteur du soleil, avec transition à l'aube et au crépuscule.
 * Fondu de ±4° centré sur −0,833° (soleil apparent) : mi-transition pile au lever / coucher officiel.
 */
export const nightFactor = (sunElev: number) => Math.min(1, Math.max(0, (3.167 - sunElev) / 8));

export const rgbCss = (c: RGB3) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

const hex = (h: string): RGB3 => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * Dégradé par paliers : composantes (RGB ou RGBA) interpolées linéairement entre les valeurs
 * données, arrondies ; première couleur en dessous du premier palier, dernière au-delà du dernier
 */
export const gradient =
    <C extends number[]>(stops: [number, C][]) =>
    (value: number): C => {
        if (!(value > stops[0][0])) return stops[0][1];
        for (let i = 0; i < stops.length - 1; i++) {
            const [v0, c0] = stops[i];
            const [v1, c1] = stops[i + 1];
            if (value <= v1) {
                const f = (value - v0) / (v1 - v0);
                return c0.map((c, k) => Math.round(c + (c1[k] - c) * f)) as C;
            }
        }
        return stops[stops.length - 1][1];
    };

const gradientRGB = gradient<RGB3>;

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
 * Couleur de la montée au vario en m/s : une famille de couleur différente tous les 0,5 m/s, du
 * jaune pâle au violet profond pour les thermiques forts
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

/** Couleurs des quatre paliers de la CAPE et de l'indice de soulèvement, du plus calme au plus orageux */
export const INSTABILITY_COLORS = ['#4caf50', '#f5c542', '#f59e0b', '#ef4444'] as const;

/** Couleur du palier d'une CAPE (J/kg) : < 300 faible, < 1 000 modérée, < 2 500 forte, au-delà très forte */
export const capeColor = (cape: number) => INSTABILITY_COLORS[cape < 300 ? 0 : cape < 1000 ? 1 : cape < 2500 ? 2 : 3];

/** Couleur du palier d'un indice de soulèvement (K) : > 0 stable, > −3 faiblement instable, > −6 instable, au-delà très instable */
export const liftedIndexColor = (li: number) => INSTABILITY_COLORS[li > 0 ? 0 : li > -3 ? 1 : li > -6 ? 2 : 3];

/** Couleur d'un niveau de risque d'orage (1 surdéveloppement, 2 orage probable, 3 orage violent possible) */
export const STORM_COLORS = ['', '#f59e0b', '#ef4444', '#d946ef'] as const;

/** Direction cardinale (d'où vient le vent) */
export const cardinal = (dir: number) => CARDINALS[Math.round((((dir % 360) + 360) % 360) / 22.5) % 16];

export const toKmh = (ms: number) => ms * 3.6;
export const toCelsius = (k: number) => k - KELVIN;
