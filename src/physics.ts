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
    /**
     * Durée (h) du pas de temps du modèle dont vient la pluie de l'heure : 1 quand la prévision est
     * horaire, 3 quand le cumul de 3 h d'un pas tri-horaire a été réparti sur ses trois heures
     */
    precipStep: number;
    /** Pression au sol (hPa) ; null si le modèle ne la fournit pas */
    pressure: number | null;
    /**
     * Pas de temps du modèle (timestamps) qui encadrent cette heure quand Windy ne fournit l'air en
     * altitude que toutes les 3 heures (voir toHourly) : entre les deux, tout est interpolé. Les
     * deux sont égaux à une heure que le modèle fournit ; null quand la prévision est horaire.
     */
    step: [number, number] | null;
    sunElev: number;
    /** Couverture nuageuse totale estimée 0-1 */
    cloudCover: number;
    /**
     * Part du ciel (0-1) qui cache le soleil : la couverture, pondérée par l'opacité de chaque niveau
     * (voir cloudOpacity). Les nuages bas comptent en entier, les nuages moyens pour 70 %, un voile
     * d'altitude pour 30 %. C'est elle qui affaiblit les thermiques.
     */
    sunCover: number;
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
    /**
     * Le modèle ne fournit la nébulosité d'aucun niveau : elle est estimée d'après l'humidité
     * relative de chaque niveau (cloudOfRh)
     */
    cloudEstimated: boolean;
    /** Sommet théorique des thermiques (m AMSL) : fin de la flottabilité de la particule */
    thermalTop: number | null;
    /** Base des cumulus (m AMSL) si les thermiques atteignent le niveau de condensation */
    cuBase: number | null;
    /**
     * Sommet des cumulus estimé (m AMSL) : ascension de la particule saturée depuis la base, diluée
     * par l'air ambiant (voir cumulusTop)
     */
    cuTop: number | null;
    /**
     * La particule est encore plus légère que l'air au dernier niveau des données : cuTop n'est
     * qu'un minimum, le vrai sommet est plus haut
     */
    cuTopCapped: boolean;
    /**
     * Sommet (m AMSL) que le cumulus atteindrait sans se diluer (pseudo-adiabatique pure) : le
     * développement possible, qui sert au risque d'orage. Souvent bien plus haut que cuTop dans un
     * air à peine instable.
     */
    cuFreeTop: number | null;
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
     * Nuage d'averses (m AMSL), les heures où la pluie est faite d'averses (voir showerHours) : nuage
     * que le modèle développe lui-même, sans les thermiques du sol (nuit, ciel couvert, averses venues
     * d'ailleurs). De la condensation au niveau d'équilibre de la particule standard, ou de la
     * particule la plus instable quand la première ne fait pas de nuage ; null sinon.
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
    /** Vitesse moyenne du vent dans la couche thermique, du sol au plafond (m/s) */
    blSpeed: number;
    /**
     * Cisaillement de la couche thermique (m/s) : écart entre le vent au sol et le vent au plafond
     * exploitable, en force comme en direction ; 0 sans thermique exploitable
     */
    blShear: number;
    /** Rapport w* ÷ u* : sous ~2,3 la turbulence mécanique (vent) domine, les thermiques sont hachés */
    convRatio: number | null;
    /**
     * Thermiques hachés par le vent (vent moyen de la couche, turbulence mécanique ou cisaillement) :
     * 0 non, 1 hachés, 2 très hachés / inexploitables
     */
    choppy: 0 | 1 | 2;
    /** Isotherme 0 °C (m AMSL, voir freezingLevelOf) : altitude du sol quand il gèle sur toute la colonne */
    freezing: number | null;
}

/** Options du calcul des colonnes */
export interface BuildOptions {
    /**
     * Nature de la pluie, déjà décidée : averses ou non. Pour un instant isolé (curseur de
     * l'émagramme), qui n'a pas ses heures voisines : c'est celle de l'heure qui le contient
     */
    shower?: boolean;
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
/** Montée au vario (m/s) et hauteur exploitable (m sol) à partir desquelles un thermique est dit franc */
const EASY_CLIMB = 0.5;
const EASY_DEPTH = 300;
/** Pluie de l'heure (mm) à partir de laquelle un thermique n'est plus dit franc */
const EASY_RAIN = 0.5;
const KAPPA = 0.2857;
/** En dessous de cette hauteur de soleil (°), pas de thermique */
const MIN_SUN_ELEV = 8;
/** Constante de von Kármán et rugosité du sol (m, relief et végétation variés) pour u* */
const KARMAN = 0.4;
const ROUGHNESS = 0.3;
/**
 * Seuils des thermiques hachés : rapport w* ÷ u* (−zi/L = κ·(w* ÷ u*)³ ; sous ~5, soit w* ÷ u* < 2,3,
 * convection forcée), vent moyen de la couche thermique (km/h) et cisaillement de la couche (km/h) :
 * écart entre le vent au sol et le vent au plafond, qui couche et casse les thermiques même quand
 * le vent moyen reste modéré (brise au sol sous un vent contraire en altitude)
 */
const CHOPPY_RATIO: readonly [number, number] = [1.5, 2.3];
const CHOPPY_WIND_KMH: readonly [number, number] = [25, 40];
const CHOPPY_SHEAR_KMH: readonly [number, number] = [20, 35];

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

type ProfileKey = 't' | 'td' | 'u' | 'v' | 'cloud';

/**
 * Pentes de l'interpolation cubique monotone de Steffen (1990) : la courbe passe exactement
 * par les niveaux du modèle, reste lisse et ne crée jamais de dépassement (pas d'inversion
 * ou de maximum fictif entre deux niveaux). Mis en cache par profil et par variable.
 */
const splineCache = new WeakMap<
    ProfilePoint[],
    Map<ProfileKey, { xs: number[]; ys: number[]; ds: number[] }>
>();

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
export const interpProfile = (
    profile: ProfilePoint[],
    z: number,
    key: ProfileKey,
): number | null => {
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

/** Épaisseur (m) de la couche surchauffée au-dessus du sol, et pas (m) des points ajoutés au-dessus */
const SURFACE_LAYER = 100;
const SURFACE_LAYER_STEP = 100;

/**
 * Profil où la couche surchauffée reste près du sol, pour le tracé de la courbe d'état. Entre le
 * point à 2 m et le premier niveau de pression, souvent 300 à 500 m plus haut, le modèle ne donne
 * rien : reliés tels quels, ils dessinent une instabilité absolue sur toute cette épaisseur, alors
 * que l'air surchauffé ne tient que dans les premières dizaines de mètres ; au-dessus, la convection
 * brasse l'air, qui suit l'adiabatique sèche. Quand le sol est plus chaud que l'adiabatique sèche
 * qui passe par le premier niveau, le profil rejoint donc cette adiabatique à 100 m du sol (au
 * tiers de l'écart s'il est plus mince) puis la suit jusqu'au premier niveau. Sans surchauffe
 * (nuit, matin stable), le profil est rendu tel quel. Seule la température est modifiée : humidité,
 * vent et nuages des points ajoutés sont ceux du profil d'origine à leur altitude.
 */
export const withSurfaceLayer = (profile: ProfilePoint[]): ProfilePoint[] => {
    const [surface, first] = profile;
    if (!first || surface.t == null || first.t == null) return profile;
    const depth = Math.min(SURFACE_LAYER, (first.z - surface.z) / 3);
    /** Température de l'adiabatique sèche qui passe par le premier niveau */
    const adiabat = (z: number) => (first.t as number) + DRY_LAPSE * (first.z - z);
    if (depth < 20 || surface.t - adiabat(surface.z) < 0.1) return profile;
    const added: ProfilePoint[] = [];
    for (let z = surface.z + depth; z < first.z - SURFACE_LAYER_STEP / 2; z += SURFACE_LAYER_STEP) {
        added.push({
            z,
            t: adiabat(z),
            td: interpProfile(profile, z, 'td'),
            u: interpProfile(profile, z, 'u') ?? surface.u,
            v: interpProfile(profile, z, 'v') ?? surface.v,
            cloud: interpProfile(profile, z, 'cloud') ?? 0,
            p: pressureAt(profile, z),
        });
    }
    return [surface, ...added, ...profile.slice(1)];
};

/** Pression de vapeur saturante (hPa), T en K */
const satVapor = (t: number) =>
    6.112 * Math.exp((MAGNUS_A * (t - KELVIN)) / (t - KELVIN + MAGNUS_B));

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

/** Humidité relative (0–1) d'un air à la température t et au point de rosée td (K) */
const relHumidity = (t: number, td: number) => Math.min(1, satVapor(Math.min(td, t)) / satVapor(t));

/** Humidité relative (0–1) en dessous de laquelle la formule de Sundqvist ne met aucun nuage */
const CLOUD_RH = 0.7;

/** Nébulosité (0–1) qu'une humidité relative (0–1) laisse attendre : Sundqvist et al. (1989) */
export const cloudOfRh = (rh: number) =>
    rh >= 1 ? 1 : rh <= CLOUD_RH ? 0 : 1 - Math.sqrt((1 - rh) / (1 - CLOUD_RH));

/**
 * Nébulosité (%) à l'altitude z. Aux niveaux du modèle, c'est la sienne. Entre deux niveaux, la
 * nébulosité interpolée est réduite là où l'air est plus sec que ne le laisse attendre l'humidité
 * des deux niveaux : sous une inversion, entre un niveau saturé et un niveau très sec, le nuage
 * s'arrête où l'air s'assèche, pas à mi-chemin. La température et le point de rosée, eux, varient
 * continûment : ils placent le nuage mieux que la seule nébulosité. Jamais plus que l'interpolation.
 */
export const cloudAt = (profile: ProfilePoint[], z: number): number => {
    const cloud = interpProfile(profile, z, 'cloud');
    if (cloud == null || cloud <= 0) return 0;
    const hi = profile.findIndex(p => p.z >= z);
    if (hi <= 0 || profile[hi].z === z) return cloud;
    const a = profile[hi - 1];
    const b = profile[hi];
    const t = interpProfile(profile, z, 't');
    const td = interpProfile(profile, z, 'td');
    if (t == null || td == null || a.t == null || a.td == null || b.t == null || b.td == null)
        return cloud;
    const from = cloudOfRh(relHumidity(a.t, a.td));
    const expected = from + ((cloudOfRh(relHumidity(b.t, b.td)) - from) * (z - a.z)) / (b.z - a.z);
    // L'humidité n'explique pas les nuages du modèle (cirrus, air sec aux deux niveaux) : interpolation seule
    if (expected <= 0.02) return cloud;
    return cloud * Math.min(1, cloudOfRh(relHumidity(t, td)) / expected);
};

/**
 * Température du thermomètre mouillé (K) d'un air à la température t, au point de rosée td (K) et
 * à la pression p (hPa) : celle qu'il prend en évaporant de l'eau jusqu'à saturation. Par dichotomie.
 */
export const wetBulb = (t: number, td: number, p: number): number => {
    const w = satMixingRatio(Math.min(td, t), p);
    let lo = Math.min(td, t);
    let hi = t;
    for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        // Chaleur cédée par l'air qui se refroidit contre chaleur prise par l'eau qui s'évapore
        if (CP * (t - mid) > LV * (satMixingRatio(mid, p) - w)) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
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
    for (let z = z0; step > 0 ? z < z1 : z > z1;) {
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
const mixedLayerDewPoint = (
    profile: ProfilePoint[],
    ground: number,
    top: number,
    tdSurface: number | null,
) => {
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
export const heightOfPressure = (profile: ProfilePoint[], p: number): number | null => {
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

/** Altitude (m) d'une pression (hPa) dans l'atmosphère standard */
export const standardAltitude = (p: number) => 44330.8 * (1 - Math.pow(p / 1013.25, 0.190263));

/** Hauteur (m au-dessus du sol) sous laquelle un nuage est de l'étage bas */
const LOW_STAGE = 2000;
/** Pression (hPa) à partir de laquelle, en montant, un nuage est de l'étage haut : nuages de glace */
const HIGH_STAGE = 450;
/** Part du soleil que cache un nuage de l'étage moyen, et un voile de l'étage haut */
const MID_OPACITY = 0.7;
const HIGH_OPACITY = 0.3;
/** Hauteurs (m au-dessus du sol) entre lesquelles l'opacité passe de celle d'un nuage bas à celle d'un nuage moyen */
const OPACITY_HEIGHTS: readonly [number, number] = [1500, 2500];

/**
 * Étage d'un niveau de pression (hPa) au-dessus d'un sol à l'altitude `ground` : 0 bas (à moins de
 * 2 000 m du sol), 1 moyen, 2 haut (450 hPa et plus haut, où les nuages sont de glace). La hauteur
 * est celle du niveau dans l'atmosphère standard : la même à toute heure, pour qu'un niveau ne
 * change pas d'étage au gré de la pression du jour. Compté depuis le sol, l'étage bas garde son
 * épaisseur en montagne : avec une limite fixe à 700 hPa, il ne ferait plus que 1 000 m au-dessus
 * d'un site à 2 000 m, et un stratocumulus juste au-dessus passerait pour un nuage moyen.
 */
export const cloudStage = (p: number, ground: number): 0 | 1 | 2 =>
    p <= HIGH_STAGE ? 2 : standardAltitude(p) - ground < LOW_STAGE ? 0 : 1;

/**
 * Part du soleil (0–1) que cache un nuage au niveau de pression `p` (hPa), au-dessus d'un sol à
 * l'altitude `ground` : 1 à moins de 1 500 m du sol (nuages bas), 0,7 à plus de 2 500 m (nuages
 * moyens), entre les deux progressivement ; 0,3 pour un voile de l'étage haut. Sans marche entre
 * les étages : un site un peu plus haut qu'un autre ne voit pas le même nuage changer d'opacité
 * d'un coup. Même hauteur standard que cloudStage.
 */
export const cloudOpacity = (p: number, ground: number): number => {
    if (p <= HIGH_STAGE) return HIGH_OPACITY;
    const [lo, hi] = OPACITY_HEIGHTS;
    const f = Math.min(1, Math.max(0, (standardAltitude(p) - ground - lo) / (hi - lo)));
    return 1 - (1 - MID_OPACITY) * f;
};

/** Température virtuelle (K) : T corrigée de l'humidité (l'air humide est plus léger) */
const virtualTemp = (t: number, mixingRatio: number) => t * (1 + 0.608 * mixingRatio);

/**
 * Taux d'entraînement des cumulus (1/m) : part de sa masse que le nuage prend à l'air ambiant par
 * mètre de montée. 0,2 par km est la valeur des modèles de panache pour une tour d'environ 1 km de
 * rayon (0,2 / rayon).
 */
const ENTRAINMENT = 2e-4;
/** Taux le plus fort (1/m) : celui d'un petit cumulus d'environ 200 m de rayon */
const ENTRAINMENT_MAX = 1e-3;

/**
 * Taux d'entraînement (1/m) d'un cumulus dont la base est à `baseHeight` m du sol : 0,2 / rayon, avec
 * un rayon égal à la moitié de cette hauteur. Les thermiques, donc les nuages qu'ils nourrissent,
 * sont d'autant plus larges que la couche qu'ils brassent est épaisse : un petit cumulus sur une
 * couche mince se dilue bien plus vite qu'une tour. Borné entre le taux d'une tour d'un kilomètre
 * de rayon (base à 2 000 m du sol ou plus) et celui d'un nuage de 200 m de rayon (400 m ou moins).
 */
export const cumulusEntrainment = (baseHeight: number) =>
    Math.min(ENTRAINMENT_MAX, Math.max(ENTRAINMENT, 0.4 / Math.max(baseHeight, 1)));

/**
 * Sommet (m AMSL) d'un cumulus dont la particule quitte la base `zBase` à la température `tBase` (K).
 * Elle suit la pseudo-adiabatique en se mélangeant à l'air ambiant : l'air sec qu'elle brasse évapore
 * une partie du nuage, ce qui la refroidit. Sans cette dilution, un dixième de degré d'avance suffit
 * à porter le nuage jusqu'en haut du profil dans un air à peine instable (petits cumulus dessinés
 * comme des tours de plusieurs kilomètres). Le sommet est le dernier niveau où elle reste plus légère
 * que l'air (température virtuelle) ; `capped` : elle l'est encore au dernier niveau des données, le
 * vrai sommet est plus haut.
 */
export const cumulusTop = (
    profile: ProfilePoint[],
    zBase: number,
    tBase: number,
    entrainment = ENTRAINMENT,
): { top: number; capped: boolean } => {
    const zMax = profile[profile.length - 1].z;
    const STEP = 10;
    let t = tBase;
    let top = zBase;
    for (let z = zBase; z < zMax;) {
        const h = Math.min(STEP, zMax - z);
        // Montée pseudo-adiabatique (point milieu, comme moistAdiabat)
        const tMid = t - (moistLapse(t, pressureAt(profile, z)) * h) / 2;
        t -= moistLapse(tMid, pressureAt(profile, z + h / 2)) * h;
        z += h;
        const tEnv = interpProfile(profile, z, 't');
        if (tEnv == null) break;
        const p = pressureAt(profile, z);
        const tdEnv = interpProfile(profile, z, 'td');
        const qEnv = tdEnv == null ? 0 : satMixingRatio(Math.min(tdEnv, tEnv), p);
        // Mélange avec l'air ambiant, puis retour à la saturation : l'eau du nuage s'évapore dans le
        // mélange (ou la vapeur en trop condense), ce qui le refroidit (ou le réchauffe)
        const part = entrainment * h;
        const qSat = satMixingRatio(t, p);
        const tMix = t + part * (tEnv - t);
        const qMix = qSat + part * (qEnv - qSat);
        const slope = (satMixingRatio(tMix + 0.05, p) - satMixingRatio(tMix - 0.05, p)) / 0.1;
        t = tMix - (satMixingRatio(tMix, p) - qMix) / (slope + CP / LV);
        const lighter = virtualTemp(t, satMixingRatio(t, p)) >= virtualTemp(tEnv, qEnv);
        if (!lighter) return { top, capped: false };
        top = z;
    }
    return { top, capped: true };
};

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
        const dewAt = (z: number) => ({
            z,
            t: dewPointFromMixingRatio(q, pressureAt(col.profile, z)),
        });
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
        ? Math.max(
              0,
              CORE_FACTOR * c.wStar * thermalShape((z - c.ground) / (c.thermalTop - c.ground)) -
                  CIRCLING_SINK,
          )
        : 0;

/** Montée nette au vario (m/s) pour une ascendance de l'air w (m/s) au cœur des thermiques */
export const netClimb = (wAir: number) => Math.max(0, CORE_FACTOR * wAir - CIRCLING_SINK);

/**
 * Qualité des thermiques, des plus francs (`easy`) aux plus hachés ; `unsettled` : heure de pluie
 * ou de risque d'orage, où rien n'en est dit
 */
export type ThermalEase = 'easy' | 'unsettled' | 'weak' | 'low' | 'ridge' | 'choppy' | 'rough';

/**
 * Qualité des thermiques d'une heure ; null sans thermique exploitable.
 * Le vent prime (hachés, puis très hachés : voir `choppy`) ; sinon un thermique reste délicat à
 * tenir quand il monte peu ou que la hauteur exploitable est faible. En montagne, le sol du modèle
 * est l'altitude moyenne de sa maille : un plafond qui le dépasse de 300 m peut rester sous le
 * relief. `crest` : altitude des crêtes voisines (m AMSL, voir relief.ts), null en plaine ; un
 * plafond qui ne les atteint pas est « sous les crêtes ». Un thermique qui serait franc ne l'est
 * pas dit à une heure de pluie (au moins 0,5 mm) ou de risque d'orage (surdéveloppement compris) :
 * le bandeau ne doit pas passer au vert sous une averse ou un cumulonimbus.
 */
export const thermalEase = (c: Column, crest: number | null = null): ThermalEase | null => {
    if (c.ceiling == null) return null;
    if (c.choppy === 2) return 'rough';
    if (c.choppy === 1) return 'choppy';
    if (c.climb < EASY_CLIMB) return 'weak';
    if (c.ceiling - c.ground < EASY_DEPTH) return 'low';
    if (crest != null && c.ceiling < crest) return 'ridge';
    if (c.stormRisk > 0 || c.precip >= EASY_RAIN) return 'unsettled';
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

const NO_STABILITY: ParcelStability = {
    cape: 0,
    liftedIndex: null,
    topTemp: null,
    base: null,
    top: null,
};

/**
 * CAPE et indice de soulèvement d'une particule partie de l'altitude z0 à la température t0 (K) avec
 * le rapport de mélange q : montée sèche jusqu'à la condensation, puis pseudo-adiabatique.
 */
const liftParcel = (
    profile: ProfilePoint[],
    z0: number,
    t0: number,
    q: number,
): ParcelStability => {
    const zMax = profile[profile.length - 1].z;
    const p0 = z0 <= profile[0].z ? profile[0].p : pressureAt(profile, z0);
    const lcl = Math.min(
        q > 1e-5 ? lclHeight(z0, t0, dewPointFromMixingRatio(q, p0)) : Infinity,
        zMax,
    );

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
    const path =
        lcl < zMax ? moistAdiabat(profile, t0 - DRY_LAPSE * (lcl - z0), lcl, zMax, STEP) : [];
    for (const pt of path.slice(1))
        add(pt.z, virtualTemp(pt.t, satMixingRatio(pt.t, pressureAt(profile, pt.z))));

    // Indice de soulèvement : environnement − particule à 500 hPa
    let liftedIndex: number | null = null;
    const z500 = heightOfPressure(profile, 500);
    const tEnv = z500 == null ? null : interpProfile(profile, z500, 't');
    if (z500 != null && tEnv != null && z500 > z0) {
        if (z500 <= lcl) liftedIndex = tEnv - (t0 - DRY_LAPSE * (z500 - z0));
        else if (path.length) {
            const pt = path.reduce((best, p) =>
                Math.abs(p.z - z500) < Math.abs(best.z - z500) ? p : best,
            );
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
export const thetaE = (t: number, td: number | null, p: number) => {
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
    return {
        ...(lifted.cape > std.cape ? lifted : std),
        liftedIndex: li.length ? Math.min(...li) : null,
    };
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
    return {
        shear: Math.hypot(uTop - u0, vTop - v0),
        steerU: n ? su / n : u0,
        steerV: n ? sv / n : v0,
    };
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
export const isSevereEnv = (e: {
    cape: number;
    liftedIndex: number | null;
    shear: number;
}): boolean => {
    const li = e.liftedIndex;
    if (li != null && li <= SEVERE_LI) return true;
    return (
        wmaxShear(e.cape, e.shear) >= SEVERE_WMAXSHEAR && (li == null || li <= SEVERE_WMAXSHEAR_LI)
    );
};

/** Éléments du risque d'orage d'une heure (températures en K, énergies en J/kg) */
export interface StormInputs {
    /** Cumulus des thermiques de l'heure, s'il y en a */
    cumulus: {
        /** CAPE de la particule des thermiques (surchauffée), plus forte que la CAPE standard */
        cape: number;
        /** Épaisseur (m) de la base au sommet que le nuage peut atteindre, sans dilution */
        depth: number;
        /** Température de l'air à ce sommet */
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
    if (
        s.muCape >= 300 &&
        below(s.muTopTemp, -20) &&
        (s.convRain >= 0.5 || (deep && s.precip >= 0.5))
    )
        fromModel = 2;
    else if (s.muCape >= 200 && below(s.muTopTemp, -10) && (showers || (deep && s.precip >= 0.2)))
        fromModel = 1;

    const risk = Math.max(fromCumulus, fromModel) as 0 | 1 | 2;
    return risk === 2 && s.severe ? 3 : risk;
};

/**
 * Indice des totaux (« Total Totals », K) : T(850 hPa) + Td(850 hPa) − 2 · T(500 hPa). Il grandit
 * avec le refroidissement de l'air entre 850 et 500 hPa et avec l'humidité à 850 hPa : c'est l'air
 * froid en altitude au-dessus d'un air encore humide, celui des averses. null quand le niveau
 * 850 hPa est sous le sol, ou sans humidité connue.
 */
export const totalTotals = (profile: ProfilePoint[]): number | null => {
    const z850 = heightOfPressure(profile, 850);
    const z500 = heightOfPressure(profile, 500);
    if (z850 == null || z500 == null) return null;
    const t850 = interpProfile(profile, z850, 't');
    const td850 = interpProfile(profile, z850, 'td');
    const t500 = interpProfile(profile, z500, 't');
    if (t850 == null || td850 == null || t500 == null) return null;
    return t850 + Math.min(td850, t850) - 2 * t500;
};

/** Énergie (J/kg) et épaisseur (m) minimales du nuage convectif pour parler d'averse */
const SHOWER_CAPE = 50;
const SHOWER_DEPTH = 2000;
/**
 * Indice des totaux (K) à partir duquel la pluie est faite d'averses, et indice de soulèvement
 * standard (K) qui le remplace là où le niveau 850 hPa est sous le sol
 */
const SHOWER_TOTALS = 47;
const SHOWER_LI = 2.5;

/**
 * La pluie de l'heure, prise seule, est-elle convective (nuage « vertical ») plutôt qu'une pluie de
 * nuages en couches (front) ? Oui dans trois cas :
 * - le modèle annonce lui-même des précipitations convectives, pour la moitié au moins de la pluie
 *   de l'heure (certains modèles en mettent un peu dans toute pluie de front) ;
 * - la particule standard a de quoi monter : un peu d'énergie sur une couche épaisse ;
 * - l'air est froid en altitude au-dessus d'un air humide : indice des totaux d'au moins 47 K, ou,
 *   là où il n'existe pas (850 hPa sous le sol), indice de soulèvement d'au plus 2,5 K. Les averses
 *   de traîne, derrière un front froid, n'ont presque pas d'énergie : la CAPE ne les voit pas.
 * Seuils calés sur le temps noté par les observateurs de 62 stations d'Europe (messages SYNOP, du 9
 * septembre au 2 octobre 2026 : averse ou orage, contre pluie continue ou bruine), avec ECMWF, GFS
 * et ICON : 7 heures dessinées en averses sur 10 en sont bien, et 5 à 7 heures d'averses observées
 * sur 10 sont dessinées en averses. Sans l'indice des totaux, ECMWF, qui ne fournit pas de
 * précipitations convectives, n'en dessinait que 3 sur 10.
 * La nature affichée de la pluie tient aussi compte des heures voisines : voir showerHours.
 */
export const isShower = (s: {
    /** Précipitations de l'heure (mm), dont convectives quand le modèle les fournit */
    precip: number;
    convRain: number;
    /** CAPE standard (J/kg) et épaisseur (m) du nuage de la particule standard */
    cape: number;
    depth: number;
    /** Indice des totaux (K, voir totalTotals) ; null quand le niveau 850 hPa est sous le sol */
    totals?: number | null;
    /** Indice de soulèvement standard (K) */
    liftedIndex?: number | null;
}): boolean => {
    if (s.precip < 0.1) return false;
    if (s.convRain >= 0.1 && s.convRain >= s.precip / 2) return true;
    if (s.cape >= SHOWER_CAPE && s.depth >= SHOWER_DEPTH) return true;
    return s.totals != null
        ? s.totals >= SHOWER_TOTALS
        : s.liftedIndex != null && s.liftedIndex <= SHOWER_LI;
};

/** Heures de part et d'autre qui comptent pour la nature de la pluie d'une heure */
const SHOWER_SPAN = 2;

/**
 * Heures dont la pluie est faite d'averses. La nature de la pluie se décide sur cinq heures (l'heure
 * et les deux de chaque côté), pas sur l'heure seule : averses quand la moitié au moins de la pluie
 * de ces heures tombe à des heures convectives (isShower). En deux temps : une heure convective
 * minoritaire autour d'elle est d'abord écartée (énergie qui passe le seuil d'un rien au milieu d'une
 * pluie de front), puis les heures convectives qui restent entraînent leurs voisines (heure à peine
 * sous le seuil parmi des averses). Une pluie qui change de nature pour de bon (front, puis averses
 * à l'arrière) change toujours.
 */
export const showerHours = (
    hours: {
        ts: number;
        /** Précipitations de l'heure (mm) */
        precip: number;
        /** Pluie convective, l'heure prise seule (isShower) */
        convective: boolean;
    }[],
): boolean[] => {
    /** Les heures `showers` donnent-elles au moins la moitié de la pluie tombée autour de l'heure k ? */
    const mostly = (k: number, showers: boolean[]) => {
        let total = 0;
        let fromShowers = 0;
        hours.forEach((o, j) => {
            if (Math.abs(o.ts - hours[k].ts) > SHOWER_SPAN * 3600e3) return;
            total += o.precip;
            if (showers[j]) fromShowers += o.precip;
        });
        return fromShowers >= total / 2;
    };
    const convective = hours.map(h => h.convective);
    const kept = hours.map((h, k) => h.precip >= 0.1 && h.convective && mostly(k, convective));
    return hours.map((h, k) => h.precip >= 0.1 && (kept[k] || mostly(k, kept)));
};

/** Pas (m) du balayage vertical d'un profil à la recherche d'une couche */
const LAYER_STEP = 25;

/** Couche de nuages d'un profil (altitudes en m AMSL) */
interface CloudLayer {
    base: number;
    top: number;
    /** Plus forte nébulosité (%) de la couche */
    most: number;
}

/**
 * Couches continues, de bas en haut, où la nébulosité du modèle, placée entre ses niveaux d'après
 * l'humidité (cloudAt), atteint `limit` %, de leur base à leur sommet (au plus le dernier niveau
 * fourni). Le profil est lu tous les 25 m depuis le sol, et à chaque niveau du modèle : une couche
 * qui s'arrête à un niveau le contient, le niveau « juste au-dessus » d'elle n'est jamais le sien.
 */
const cloudLayers = (profile: ProfilePoint[], limit: number): CloudLayer[] => {
    const zTop = profile[profile.length - 1].z;
    const heights = profile.map(p => p.z);
    for (let z = profile[0].z + LAYER_STEP; z < zTop; z += LAYER_STEP) heights.push(z);
    const layers: CloudLayer[] = [];
    let layer: CloudLayer | null = null;
    for (const z of heights.sort((a, b) => a - b)) {
        const cloud = cloudAt(profile, z);
        if (cloud < limit) layer = null;
        else if (layer) {
            layer.top = z;
            layer.most = Math.max(layer.most, cloud);
        } else layers.push((layer = { base: z, top: z, most: cloud }));
    }
    return layers;
};

/** Plus basse couche continue où la nébulosité atteint `limit` % (voir cloudLayers) ; null sans elle */
const lowestLayer = (profile: ProfilePoint[], limit: number): CloudLayer | null =>
    cloudLayers(profile, limit)[0] ?? null;

/** Nébulosité (%) d'une couche de nuages du modèle assez dense pour porter la pluie dessinée */
const RAIN_CLOUD = 50;

/**
 * Couche de nuages (m AMSL) d'où tombe la pluie d'une heure sans nuage d'averses : la plus basse
 * couche continue où la nébulosité du modèle atteint 50 % (ou la moitié de sa plus forte valeur si
 * elle reste en dessous), de sa base à son sommet. Le sommet s'arrête au dernier niveau fourni.
 * null sans nuage dans le profil : la pluie vient de plus haut que ce dernier niveau.
 */
export const rainLayer = (profile: ProfilePoint[]): { base: number; top: number } | null => {
    const peak = Math.max(0, ...profile.map(p => p.cloud));
    if (peak < 5) return null;
    const layer = lowestLayer(profile, Math.min(RAIN_CLOUD, peak / 2));
    return layer && { base: layer.base, top: layer.top };
};

/** Écart (K) entre la température et le point de rosée d'un niveau ; null si l'un manque */
const spreadOf = (p: Pick<ProfilePoint, 't' | 'td'>) =>
    p.t == null || p.td == null ? null : p.t - p.td;

/** Hauteurs (m au-dessus du sol) sous lesquelles une couche de nuages est basse : sa base, son sommet */
const LOW_CLOUD_BASE = 2000;
const LOW_CLOUD_TOP = 3000;
/**
 * Nébulosité (%) d'une couche de nuages bas, celle qu'elle doit garder pour se prolonger aux heures
 * voisines, et celle d'une mer de nuages (couverture presque continue)
 */
const LOW_CLOUD = 50;
const LOW_CLOUD_KEEP = 40;
const SEA_CLOUD = 70;
/** Air clair et sec au-dessus d'une mer de nuages : nébulosité (%) au plus, écart T − Td (K) au moins */
const SEA_CLEAR = 20;
const SEA_DRY = 5;
/** Écart T − Td au sol (K) sous lequel une couche qui commence à moins de 300 m du sol le touche */
const FOG_SPREAD = 0.5;
const FOG_BASE = 300;

/** Couche de nuages bas d'une heure (altitudes en m AMSL) */
export interface LowCloud {
    /**
     * Base et sommet, placés entre deux niveaux du modèle : à quelques centaines de mètres près
     * quand ils sont espacés (souvent rien entre 925, 850 et 700 hPa)
     */
    base: number;
    top: number;
    /** La couche touche le sol : brouillard */
    fog: boolean;
    /** Air clair et sec juste au-dessus : une mer de nuages pour qui est plus haut */
    sea: boolean;
}

/**
 * Couche de nuages bas (stratus, stratocumulus, brouillard) : la plus basse couche continue où la
 * nébulosité du modèle atteint 50 %, si sa base est à moins de 2 000 m du sol et son sommet à moins
 * de 3 000 m (plus épaisse, c'est une masse nuageuse de front, pas une couche basse). Elle touche le
 * sol quand l'air y est saturé (T − Td ≤ 0,5 K) et qu'elle commence à moins de 300 m. C'est une mer
 * de nuages quand elle couvre au moins 70 % du ciel sous un air clair (≤ 20 % de nuages) et sec
 * (T − Td ≥ 5 K) au niveau du modèle juste au-dessus. null sans couche basse. `limit` : nébulosité
 * (%) de la couche, plus basse pour la prolonger aux heures voisines (lowCloudsOf).
 */
export const lowCloudOf = (profile: ProfilePoint[], limit = LOW_CLOUD): LowCloud | null => {
    const layer = lowestLayer(profile, limit);
    const ground = profile[0].z;
    if (!layer || layer.base - ground > LOW_CLOUD_BASE || layer.top - ground > LOW_CLOUD_TOP)
        return null;
    const above = profile.find(p => p.z > layer.top);
    if (!above) return null;
    const cover = Math.max(
        0,
        ...profile.filter(p => p.z >= layer.base && p.z <= layer.top).map(p => p.cloud),
    );
    const fog = (spreadOf(profile[0]) ?? Infinity) <= FOG_SPREAD && layer.base - ground <= FOG_BASE;
    return {
        base: fog ? ground : layer.base,
        top: layer.top,
        fog,
        sea: cover >= SEA_CLOUD && above.cloud <= SEA_CLEAR && (spreadOf(above) ?? 0) >= SEA_DRY,
    };
};

/**
 * Écart (m) toléré entre les couches de deux heures voisines pour y voir la même : elles sont
 * placées à quelques centaines de mètres près
 */
const DECK_JOIN = 250;

/** Les couches de deux heures voisines sont-elles la même ? Oui si leurs altitudes se recouvrent */
const sameLayer = (a: { base: number; top: number }, b: { base: number; top: number }) =>
    a.base <= b.top + DECK_JOIN && b.base <= a.top + DECK_JOIN;

/**
 * Couches qui durent : celle de `born` à l'heure où elle naît, prolongée d'heure en heure, avant
 * comme après, par celle des couches de `kept` (les couches de l'heure, de bas en haut) qui est la
 * même que la couche de l'heure voisine ; null ailleurs. Une autre couche, à une autre altitude, ne
 * prolonge rien.
 */
const persisting = <T extends { base: number; top: number }>(
    born: (T | null)[],
    kept: T[][],
): (T | null)[] => {
    const out = [...born];
    const extend = (k: number, from: number) => {
        const near = out[from];
        if (!out[k] && near) out[k] = kept[k].find(l => sameLayer(l, near)) ?? null;
    };
    for (let k = 1; k < out.length; k++) extend(k, k - 1);
    for (let k = out.length - 2; k >= 0; k--) extend(k, k + 1);
    return out;
};

/**
 * Couches de nuages bas d'une suite d'heures (voir lowCloudOf). Une couche naît à 50 % de
 * nébulosité et se prolonge d'heure en heure tant qu'elle en garde 40 % à la même altitude, à
 * 250 m près : une couverture qui oscille autour du seuil ne fait pas clignoter la couche.
 */
export const lowCloudsOf = (profiles: ProfilePoint[][]): (LowCloud | null)[] => {
    const born = profiles.map(p => lowCloudOf(p));
    return persisting(
        born,
        profiles.map((p, k) => {
            const low = born[k] ? null : lowCloudOf(p, LOW_CLOUD_KEEP);
            return low ? [low] : [];
        }),
    );
};

/**
 * Écart (m) toléré entre le sommet des thermiques et la base de la couche basse qu'ils nourrissent :
 * elle est placée à quelques centaines de mètres près
 */
const FED_MARGIN = 300;
/** Épaisseur (m) à partir de laquelle une couche de l'étage moyen n'est plus un altocumulus mince */
const MID_THICK = 2000;

/**
 * Genre d'une couche de nuages, quand le profil le dit :
 * - `cumulus` : couche basse que nourrissent les thermiques. Ce sont des cumulus ou des
 *   stratocumulus, en amas séparés par des trouées, pas une nappe continue ;
 * - `altocumulus` : couche mince (moins de 2 000 m) de l'étage moyen, sans pluie. L'étage moyen
 *   commence à 2 000 m du sol, où finit celui des nuages bas, et s'arrête à 450 hPa ;
 * - `altostratus` : couche épaisse de l'étage moyen, sans pluie : altocumulus épais ou en plusieurs
 *   couches, altostratus.
 * Calé sur le genre noté par les observateurs de 62 stations d'Europe (messages SYNOP, du 9
 * septembre au 2 octobre 2026), avec ECMWF, GFS et ICON : sous une couche basse nourrie par les
 * thermiques, l'observateur note des cumulus ou des cumulonimbus 8 fois sur 10 (4 fois sur 10 sans
 * thermique) ; sous une couche de l'étage moyen, des altocumulus près de 8 fois sur 10, et leur
 * forme épaisse ou en plusieurs couches, ou un altostratus, 5 à 7 fois sur 10 quand la couche
 * dépasse 2 000 m (4 fois sur 10 en dessous). Le profil ne sépare ni le stratus du stratocumulus,
 * ni l'altocumulus castellanus des autres altocumulus : ils ne sont pas nommés.
 */
export type DeckGenus = 'cumulus' | 'altocumulus' | 'altostratus';

/** Plafond nuageux d'une heure : sa plus basse couche de nuages dense (altitudes en m AMSL) */
export interface CloudDeck {
    base: number;
    /** Sommet, au plus le dernier niveau fourni par le modèle */
    top: number;
    /** Couche de nuages bas (voir lowCloudOf) ; null pour une couche plus haute ou plus épaisse */
    low: LowCloud | null;
    /** La pluie de l'heure tombe de cette couche */
    rain: boolean;
    /** Même couche que celle de l'heure qui précède : leurs altitudes se recouvrent */
    joined: boolean;
    /**
     * Genre de la couche (voir DeckGenus) ; null quand le profil ne le dit pas : couche basse sans
     * thermique, couche d'où il pleut, couche de l'étage haut, masse nuageuse partie de l'étage bas
     */
    genus: DeckGenus | null;
}

/** Couche en amas (cumulus, stratocumulus, altocumulus) plutôt qu'en voile continu */
export const isCumuliform = (deck: Pick<CloudDeck, 'genus'>): boolean =>
    deck.genus === 'cumulus' || deck.genus === 'altocumulus';

/**
 * Plafond nuageux de chaque heure : la couche de nuages bas s'il y en a une (lowCloudsOf), sinon la
 * plus basse couche dense du modèle, à n'importe quelle altitude : celle où la nébulosité atteint
 * 50 %, de l'altitude où elle dépasse 40 % à celle où elle y retombe. Mesurée à 40 %, la base ne
 * saute pas d'un niveau à l'autre quand la nébulosité oscille autour de 50 %. Comme la couche
 * basse, elle naît à 50 % et se prolonge d'heure en heure tant qu'elle garde 40 % à la même
 * altitude. Sans couche dense, une heure de pluie garde la couche d'où elle tombe (rainLayer : la
 * moitié de la plus forte nébulosité). `rains` : heures où la pluie ne vient pas d'un nuage
 * d'averses. Deux heures voisines portent la même couche quand leurs altitudes se recouvrent, à
 * 250 m près : sinon ce sont deux couches (un stratus qui se dissipe sous un voile d'altitude).
 * null sans couche.
 * `thermalTops` : sommet des thermiques (m AMSL) aux heures où ils sont exploitables, null sinon ;
 * il donne le genre d'une couche basse (voir DeckGenus).
 */
export const cloudDecksOf = (
    profiles: ProfilePoint[][],
    rains: boolean[],
    thermalTops: (number | null)[] = [],
): (CloudDeck | null)[] => {
    const lows = lowCloudsOf(profiles);
    const layers = profiles.map(p => cloudLayers(p, LOW_CLOUD_KEEP));
    const dense = persisting(
        layers.map(hour => hour.find(l => l.most >= LOW_CLOUD) ?? null),
        layers,
    );
    const decks = profiles.map((p, k): CloudDeck | null => {
        const rain = !!rains[k];
        const layer = lows[k] ?? dense[k] ?? (rain ? rainLayer(p) : null);
        if (!layer) return null;
        const thermalTop = thermalTops[k];
        let genus: DeckGenus | null = null;
        if (lows[k]) {
            if (thermalTop != null && thermalTop >= layer.base - FED_MARGIN) genus = 'cumulus';
        } else if (
            !rain &&
            layer.base - p[0].z > LOW_CLOUD_BASE &&
            pressureAt(p, layer.base) > HIGH_STAGE
        )
            genus = layer.top - layer.base < MID_THICK ? 'altocumulus' : 'altostratus';
        return { base: layer.base, top: layer.top, low: lows[k], rain, joined: false, genus };
    });
    decks.forEach((deck, k) => {
        const before = decks[k - 1];
        if (deck && before) deck.joined = sameLayer(deck, before);
    });
    return decks;
};

/**
 * Écart T − Td (K) sous lequel l'air condense dès qu'une pente le soulève de moins de 200 m (le
 * niveau de condensation monte d'environ 125 m par kelvin d'écart)
 */
export const SATURATED_SPREAD = 1.5;
/** Épaisseur (m) en dessous de laquelle une couche d'air saturé n'est pas retenue */
const SATURATED_DEPTH = 100;

/**
 * Couches d'air saturé (m AMSL), du sol au dernier niveau fourni : là où l'écart T − Td, interpolé
 * entre les niveaux du modèle, ne dépasse pas 1,5 K. Le relief qui atteint ces altitudes est pris
 * dans les nuages, que le modèle y annonce une couche de nuages ou non : c'est la pente qui fait
 * condenser l'air. Seul le point choisi est lu, pas le relief autour ni son versant au vent.
 */
export const saturatedLayers = (profile: ProfilePoint[]): { base: number; top: number }[] => {
    const zTop = profile[profile.length - 1].z;
    const layers: { base: number; top: number }[] = [];
    let layer = null as { base: number; top: number } | null;
    for (let z = profile[0].z; z <= zTop; z += LAYER_STEP) {
        const t = interpProfile(profile, z, 't');
        const td = interpProfile(profile, z, 'td');
        if (t != null && td != null && t - td <= SATURATED_SPREAD)
            layer = { base: layer?.base ?? z, top: z };
        else if (layer) {
            layers.push(layer);
            layer = null;
        }
    }
    if (layer) layers.push(layer);
    return layers.filter(l => l.top - l.base >= SATURATED_DEPTH);
};

/**
 * Cumulus des thermiques à montrer : seulement avec un thermique exploitable. Sans lui, la particule
 * surchauffée trouve encore un « nuage » dans un air saturé (ciel couvert, pluie), parfois de
 * plusieurs kilomètres d'épaisseur, que rien ne nourrit depuis le sol.
 */
export const hasCumulus = (c: Pick<Column, 'cuBase' | 'ceiling'>): boolean =>
    c.cuBase != null && c.ceiling != null;

/** Nébulosité (%) du modèle dans la couche des cumulus à partir de laquelle ils s'étalent en nappe */
const SPREAD_CLOUD = 60;

/**
 * Quantité de cumulus (%) : la plus forte nébulosité du modèle dans la couche des cumulus des
 * thermiques (de 200 m sous leur base à 200 m au-dessus de leur sommet). 0 sans cumulus à montrer.
 */
export const cumulusCover = (c: Column): number => {
    if (!hasCumulus(c) || c.cuBase == null) return 0;
    const top = Math.max(c.cuTop ?? c.cuBase, c.cuBase + 300) + 200;
    let cover = 0;
    for (let z = Math.max(c.ground, c.cuBase - 200); z <= top; z += 100)
        cover = Math.max(cover, cloudAt(c.profile, z));
    return cover;
};

/**
 * Cumulus qui s'étalent : le modèle met au moins 60 % de nuages dans la couche des cumulus des
 * thermiques. Ils butent sur une couche stable et se rejoignent en nappe ; leur ombre affaiblit les
 * thermiques, ce que le calcul du flux de chaleur compte déjà.
 */
export const cumulusSpread = (c: Column): boolean => cumulusCover(c) >= SPREAD_CLOUD;

/**
 * Isotherme 0 °C (m AMSL) : le plus haut niveau où l'air repasse au-dessus de 0 °C, cherché depuis
 * le haut du profil sur la courbe interpolée, par pas de 10 m. Sous une inversion (gel au sol, air
 * doux au-dessus), c'est le sommet de la couche douce, pas le sol. Vaut l'altitude du sol quand il
 * gèle sur toute la colonne ; null quand il fait encore plus de 0 °C au dernier niveau fourni.
 */
export const freezingLevelOf = (profile: ProfilePoint[]): number | null => {
    const ground = profile[0].z;
    const STEP = 10;
    let zAbove = profile[profile.length - 1].z;
    let above: number | null = null;
    for (let z = zAbove; ; z = Math.max(ground, z - STEP)) {
        const t = interpProfile(profile, z, 't');
        if (t != null) {
            if (t > KELVIN) {
                return above == null
                    ? null
                    : z + ((zAbove - z) * (t - KELVIN)) / Math.max(t - above, 1e-6);
            }
            above = t;
            zAbove = z;
        }
        if (z <= ground) return ground;
    }
};

/** Thermomètre mouillé (°C) en dessous duquel les flocons ne fondent pas encore */
const SNOW_WET_BULB = 1;

/**
 * Limite pluie-neige (m AMSL) : au-dessus, le thermomètre mouillé reste sous +1 °C et les flocons
 * ne fondent pas. Dans un air sec, elle est nettement plus basse que l'isotherme 0 °C : la neige
 * qui s'évapore en tombant refroidit l'air. Cherchée depuis le haut du profil : c'est la première
 * couche de fonte que rencontrent les flocons. Vaut l'altitude du sol quand la neige l'atteint ;
 * null quand elle est au-dessus du dernier niveau fourni, ou sans humidité connue.
 */
export const snowLineOf = (profile: ProfilePoint[]): number | null => {
    const ground = profile[0].z;
    const melts = (z: number) => {
        const t = interpProfile(profile, z, 't');
        const td = interpProfile(profile, z, 'td');
        return t == null || td == null
            ? null
            : wetBulb(t, td, pressureAt(profile, z)) > KELVIN + SNOW_WET_BULB;
    };
    let z = profile[profile.length - 1].z;
    if (melts(z) !== false) return null;
    for (; z - LAYER_STEP >= ground; z -= LAYER_STEP) {
        const below = melts(z - LAYER_STEP);
        if (below == null) return null;
        if (below) return z;
    }
    return ground;
};

/** Hauteur (m au-dessus du sol) de la base d'un nuage d'averses à partir de laquelle on parle de virga */
const VIRGA_BASE = 1500;

/**
 * Virga : averses dont la base est à plus de 1 500 m du sol. L'air est alors sec sous le nuage (au
 * moins 12 K entre la température et le point de rosée au sol) : la pluie s'y évapore en route et
 * le refroidit, il descend en rafales, même sans pluie au sol. Concerne le nuage d'averses du
 * modèle, ou les cumulus des heures de surdéveloppement et d'orage. Rend la base du nuage (m AMSL),
 * null sinon.
 */
export const virgaOf = (
    c: Pick<Column, 'ground' | 'showerBase' | 'cuBase' | 'stormRisk'>,
): number | null => {
    const base = c.showerBase ?? (c.stormRisk > 0 ? c.cuBase : null);
    return base != null && base - c.ground >= VIRGA_BASE ? base : null;
};

/**
 * Rafale descendante (m/s) que peut donner une virga : l'air pris à la base du nuage, refroidi
 * jusqu'à son thermomètre mouillé par la pluie qui s'y évapore, descend le long de la
 * pseudo-adiabatique jusqu'au sol en restant plus froid, donc plus lourd, que l'air qui l'entoure.
 * L'énergie de cette descente (DCAPE, J/kg) donne une vitesse, √(2 · DCAPE) : c'est un maximum, que
 * le mélange avec l'air ambiant réduit (sur les prévisions d'essai, environ trois fois les rafales
 * que le modèle prévoit à ces heures). Elle ne s'affiche donc pas comme une rafale prévue : à
 * partir de STRONG_DOWNDRAFT (100 km/h, soit une DCAPE d'environ 400 J/kg), la virga est signalée
 * comme pouvant donner de fortes rafales. null sans virga (voir virgaOf).
 */
export const STRONG_DOWNDRAFT = 100 / 3.6;

export const downdraftOf = (
    c: Pick<Column, 'ground' | 'showerBase' | 'cuBase' | 'stormRisk' | 'profile'>,
): number | null => {
    const base = virgaOf(c);
    if (base == null) return null;
    const t = interpProfile(c.profile, base, 't');
    const td = interpProfile(c.profile, base, 'td');
    if (t == null || td == null) return null;
    const path = moistAdiabat(
        c.profile,
        wetBulb(t, td, pressureAt(c.profile, base)),
        base,
        c.ground,
        50,
    );
    let dcape = 0;
    for (let k = 1; k < path.length; k++) {
        const z = (path[k - 1].z + path[k].z) / 2;
        const tp = (path[k - 1].t + path[k].t) / 2;
        const env = envVirtualTemp(c.profile, z);
        if (env == null) continue;
        const parcel = virtualTemp(tp, satMixingRatio(tp, pressureAt(c.profile, z)));
        dcape += Math.max(0, (G * (env - parcel)) / env) * (path[k - 1].z - path[k].z);
    }
    return Math.sqrt(2 * dcape);
};

/**
 * Tourbillons de poussière (« dusts ») possibles : les ingrédients que le modèle peut voir.
 * Thermiques puissants (w* d'au moins 2,5 m/s) dans une couche convective d'au moins 1 500 m,
 * convection libre (w* ÷ u* d'au moins 5, soit −zi/L ≥ 50 : le vent au sol reste faible devant les
 * thermiques), air sec au sol (au moins 10 K entre la température et le point de rosée), sol sec
 * (moins de 1 mm de pluie dans les 24 h qui précèdent et dans l'heure) et soleil (moins de 30 % du
 * ciel le cache). Seuils tirés de la littérature, non calés : aucune observation de tourbillons ne
 * permet de les vérifier. Un potentiel sur l'heure, pas un lieu.
 */
const DUST = { wStar: 2.5, ratio: 5, depth: 1500, spread: 10, rain: 1, sun: 0.3 };

export const dustDevilsOf = (
    c: Pick<
        Column,
        | 'ceiling'
        | 'thermalTop'
        | 'ground'
        | 'wStar'
        | 'convRatio'
        | 't2m'
        | 'td2m'
        | 'recentRain'
        | 'precip'
        | 'sunCover'
    >,
): boolean =>
    c.ceiling != null &&
    c.thermalTop != null &&
    c.wStar >= DUST.wStar &&
    c.thermalTop - c.ground >= DUST.depth &&
    c.convRatio != null &&
    c.convRatio >= DUST.ratio &&
    c.td2m != null &&
    c.t2m - c.td2m >= DUST.spread &&
    c.recentRain + c.precip < DUST.rain &&
    c.sunCover <= DUST.sun;

/** Vent (m/s) au niveau des crêtes à partir duquel le relief fait onduler l'air : 30 km/h */
const WAVE_WIND = 30 / 3.6;
/** Hauteurs (m au-dessus des crêtes) qui bornent les deux couches comparées */
const WAVE_LAYERS: readonly [number, number] = [1500, 4000];
/** Rapport minimal entre les paramètres de Scorer des deux couches, et rotation maximale du vent (°) */
const WAVE_SCORER = 2;
const WAVE_TURN = 30;

/** Ondes de relief possibles (altitudes en m AMSL) */
export interface Wave {
    /** Altitude des crêtes, vent qui y souffle (m/s, ° d'où il vient) */
    crest: number;
    wind: { speed: number; dir: number };
    /** Longueur d'onde naturelle (m) : 2π · vent ÷ fréquence de Brunt-Väisälä de la couche basse */
    length: number;
}

/**
 * Ondes de relief possibles au-dessus de crêtes à l'altitude `crest` : vent d'au moins 30 km/h aux
 * crêtes, qui tourne de moins de 30° sur les 4 000 m au-dessus, dans un air stable dont le
 * paramètre de Scorer (N² ÷ U², stabilité sur carré du vent) est au moins deux fois plus fort dans
 * les 1 500 premiers mètres que dans la couche du dessus : l'onde y reste piégée, avec ses rotors
 * sous le vent. L'orientation des crêtes n'est pas connue : c'est un signal, pas une carte.
 */
export const waveOf = (profile: ProfilePoint[], crest: number): Wave | null => {
    const z1 = crest + WAVE_LAYERS[0];
    const z2 = Math.min(crest + WAVE_LAYERS[1], profile[profile.length - 1].z);
    if (crest < profile[0].z || z2 - z1 < 1000) return null;
    const at = (z: number) => {
        const wind = windAt(profile, z);
        const t = interpProfile(profile, z, 't');
        return wind && t != null
            ? { wind, theta: t * Math.pow(1000 / pressureAt(profile, z), KAPPA) }
            : null;
    };
    const a = at(crest);
    const b = at(z1);
    const c = at(z2);
    if (!a || !b || !c || a.wind.speed < WAVE_WIND) return null;
    if (Math.abs(((c.wind.dir - a.wind.dir + 540) % 360) - 180) > WAVE_TURN) return null;
    const scorer = (lo: NonNullable<typeof a>, hi: NonNullable<typeof a>, dz: number) => {
        const n2 = ((G * 2) / (lo.theta + hi.theta)) * ((hi.theta - lo.theta) / dz);
        const u = (lo.wind.speed + hi.wind.speed) / 2;
        return { n2, l2: Math.max(0, n2) / (u * u), u };
    };
    const low = scorer(a, b, z1 - crest);
    const up = scorer(b, c, z2 - z1);
    if (low.n2 <= 0 || low.l2 < WAVE_SCORER * up.l2) return null;
    return { crest, wind: a.wind, length: (2 * Math.PI * low.u) / Math.sqrt(low.n2) };
};

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
    const watched = cols.filter(
        c => c.hour >= WATCH_HOURS[0] && c.hour <= WATCH_HOURS[1] && c.ts + 3600e3 > nowTs,
    );
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
        hidden:
            !!before &&
            Math.max(0, ...before.profile.filter(p => p.p > 450).map(p => p.cloud)) >= 80,
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

/** Air d'un niveau de pression à chaque heure de `data.ts` ; null là où le modèle ne le donne pas */
export interface LevelAir {
    ts: number[];
    /** Température et point de rosée (K) */
    t: (number | null)[];
    td: (number | null)[];
    /** Altitude du niveau (m AMSL) */
    z: (number | null)[];
    /** Composantes du vent (m/s) */
    u: (number | null)[];
    v: (number | null)[];
}

/**
 * Air du niveau de pression `level` (hPa), lu tel que Windy le donne : il le fournit aussi sous le
 * relief (valeurs prolongées), ce qui permet de comparer des points d'altitudes différentes.
 */
export const levelAir = (payload: ForecastPayload, level: number): LevelAir => {
    const get = makeLookup([payload.sounding, payload.airgram, payload.meteogram]);
    const ts = (payload.data.ts || []) as number[];
    const out: LevelAir = { ts, t: [], td: [], z: [], u: [], v: [] };
    for (const at of ts) {
        const t = get(`temp-${level}h`, at);
        const rh = get(`rh-${level}h`, at);
        const speed = get(`wind-${level}h`, at);
        const dir = get(`windDir-${level}h`, at);
        const wind = speed == null || dir == null ? null : windToUV(speed, dir);
        out.t.push(t);
        out.td.push(
            get(`dewPoint-${level}h`, at) ??
                (t != null && rh != null ? dewPointFromRh(t, rh) : null),
        );
        out.z.push(get(`gh-${level}h`, at));
        out.u.push(wind ? wind.u : null);
        out.v.push(wind ? wind.v : null);
    }
    return out;
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

/** Pression au sol (hPa) d'une valeur de Windy, donnée en Pa ou en hPa ; null si elle manque */
const surfacePressure = (v: number | null | undefined): number | null =>
    v == null || !Number.isFinite(v) || v <= 0 ? null : v > 2000 ? v / 100 : v;

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

/** Colonnes altitude × heure de la prévision */
export const buildColumns = (
    payload: ForecastPayload,
    lat: number,
    lon: number,
    { shower }: BuildOptions = {},
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
    /**
     * Nuage convectif de chaque colonne (celui de la particule standard, sinon de la plus instable),
     * et pluie convective de l'heure prise seule
     */
    const convective: { base: number | null; top: number | null; alone: boolean }[] = [];

    tsList.forEach((ts, i) => {
        const utcOffset = offsetAt(ts);
        const hour = localHour(ts, utcOffset);
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

        // Modèle sans nébulosité par niveau : estimée d'après l'humidité, plutôt qu'un ciel vide
        const cloudEstimated = cloudMinP === Infinity;
        if (cloudEstimated) {
            for (const p of profile.slice(1)) {
                if (p.t != null && p.td != null) p.cloud = 100 * cloudOfRh(relHumidity(p.t, p.td));
            }
        }

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
        // Couverture nuageuse totale : maximum par étage (bas / moyen / haut, voir cloudStage), puis
        // recouvrement aléatoire entre étages (écart moyen ~12 % avec la couverture totale des modèles)
        const stageMax = (stage: 0 | 1 | 2, weight: (p: number) => number = () => 1) =>
            Math.max(
                0,
                ...[...profile.slice(1), ...highLevels]
                    .filter(p => cloudStage(p.p, ground) === stage)
                    .map(p => (p.cloud / 100) * weight(p.p)),
            );
        const cloudCover = Math.min(
            1,
            1 - (1 - stageMax(0)) * (1 - stageMax(1)) * (1 - stageMax(2)),
        );
        // Couverture « vue par le soleil » : chaque niveau pèse selon son opacité (cloudOpacity). Un
        // voile de cirrus (étage haut) laisse passer l'essentiel du rayonnement, un altostratus
        // (étage moyen) beaucoup moins, les nuages bas presque rien
        const opacity = (p: number) => cloudOpacity(p, ground);
        const sunCover = Math.min(
            1,
            1 -
                (1 - stageMax(0, opacity)) *
                    (1 - stageMax(1, opacity)) *
                    (1 - stageMax(2, opacity)),
        );

        // --- Méthode de la particule, air de la couche mélangée
        let thermalTop: number | null = null;
        let cuBase: number | null = null;
        let cuTop: number | null = null;
        let cuTopCapped = false;
        let cuFreeTop: number | null = null;
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
            for (let k = Math.max(0, i - 48); k < i; k++)
                recentSnow += snowPart(data, k, num(data.temperature, k, t2m));
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
            const qOf = (dew: number | null) =>
                dew == null ? 0 : satMixingRatio(Math.min(dew, t2m), p0);

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
                    const tBase = parcelStart - DRY_LAPSE * (lcl - ground);
                    // Sommet du cumulus : la particule saturée monte en se diluant dans l'air ambiant,
                    // d'autant plus vite que le nuage est petit (base proche du sol), tant qu'elle
                    // reste plus légère. Encore plus légère au dernier niveau : le sommet réel est
                    // au-delà des données
                    ({ top: cuTop, capped: cuTopCapped } = cumulusTop(
                        profile,
                        lcl,
                        tBase,
                        cumulusEntrainment(lcl - ground),
                    ));
                    // Sans dilution, la même particule donne l'énergie de flottaison des thermiques
                    // (CAPE) et le sommet que le nuage peut atteindre : ce sont eux qui servent au
                    // risque d'orage, dont les seuils supposent une particule non diluée
                    const path = moistAdiabat(profile, tBase, lcl, zMax, STEP);
                    let freeTop = lcl;
                    let rising = true;
                    for (let k = 1; k < path.length; k++) {
                        const pt = path[k];
                        const tv = envTv(pt.z);
                        if (tv == null) break;
                        const tvParcel = virtualTemp(
                            pt.t,
                            satMixingRatio(pt.t, pressureAt(profile, pt.z)),
                        );
                        if (rising && tvParcel >= tv) freeTop = pt.z;
                        else rising = false;
                        if (tvParcel > tv)
                            thermalCape += (G * (tvParcel - tv) * (pt.z - path[k - 1].z)) / tv;
                    }
                    cuFreeTop = freeTop;
                    // Cumulus des thermiques, pour le risque d'orage : nuages du modèle dans la même
                    // couche (hors voiles de cirrus, au-dessus de 450 hPa) et humidité vers 4 000 m
                    const z450 = heightOfPressure(profile, 450) ?? Infinity;
                    const cuLayerTop = Math.min(freeTop, z450, cuBase + 4000);
                    const modelCloud = Math.max(
                        0,
                        ...profile
                            .filter(p => p.z >= cuBase! - 200 && p.z <= cuLayerTop)
                            .map(p => p.cloud / 100),
                    );
                    const z600 = heightOfPressure(profile, 600);
                    const t6 = z600 == null ? null : interpProfile(profile, z600, 't');
                    const td6 = z600 == null ? null : interpProfile(profile, z600, 'td');
                    cumulus = {
                        cape: thermalCape,
                        depth: freeTop - cuBase,
                        topTemp: interpProfile(profile, freeTop, 't'),
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
                    if (
                        CORE_FACTOR * wStar * thermalShape((z - ground) / depth) < CIRCLING_SINK &&
                        (z - ground) / depth > 0.15
                    ) {
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
        let ss = 0;
        let nw = 0;
        for (let z = ground + 50; z <= blTop; z += 100) {
            const wind = windAt(profile, z);
            if (!wind) continue;
            ss += wind.speed;
            nw++;
        }
        const blSpeed = nw ? ss / nw : windSurf;
        // Cisaillement de la couche : vent du plafond comparé au vent au sol
        const uTop = ceiling == null ? null : interpProfile(profile, ceiling, 'u');
        const vTop = ceiling == null ? null : interpProfile(profile, ceiling, 'v');
        const blShear =
            uTop == null || vTop == null ? 0 : Math.hypot(uTop - profile[0].u, vTop - profile[0].v);
        const uStar = (KARMAN * windSurf) / Math.log(10 / ROUGHNESS);
        const convRatio = wStar > 0 ? wStar / Math.max(uStar, 0.05) : null;
        let choppy: 0 | 1 | 2 = 0;
        if (ceiling != null && convRatio != null) {
            const kmh = blSpeed * 3.6;
            const shearKmh = blShear * 3.6;
            if (
                kmh >= CHOPPY_WIND_KMH[1] ||
                convRatio < CHOPPY_RATIO[0] ||
                shearKmh >= CHOPPY_SHEAR_KMH[1]
            )
                choppy = 2;
            else if (
                kmh >= CHOPPY_WIND_KMH[0] ||
                convRatio < CHOPPY_RATIO[1] ||
                shearKmh >= CHOPPY_SHEAR_KMH[0]
            )
                choppy = 1;
        }

        // --- CAPE et indice de soulèvement standard (affichés)
        const std = standardStability(profile, ground);

        // --- Risque d'orage
        const mu = mostUnstable(profile, std);
        const deepWind = deepLayerWind(profile, ground);
        const severeEnv = isSevereEnv({
            cape: mu.cape,
            liftedIndex: mu.liftedIndex,
            shear: deepWind.shear,
        });
        // Rafales du modèle à ±1 h : le front de rafales précède l'orage. Fournies par la prévision
        // réduite à un instant, comme la pluie voisine
        const gustNear = data.gustNear
            ? num(data.gustNear, i)
            : Math.max(0, ...[i - 1, i, i + 1].map(k => num(data.windGust, k)));
        const cloudWhere = (keep: (p: ProfilePoint) => boolean) =>
            Math.max(0, ...profile.filter(keep).map(p => p.cloud / 100));
        const midCloud = cloudWhere(p => p.p <= 700 && p.p >= 500);
        const coldCloud = cloudWhere(p => p.p >= 350 && p.t != null && p.t <= KELVIN - 20);
        const stormRisk = stormRiskOf({
            cumulus,
            cape: std.cape,
            muCape: mu.cape,
            muTopTemp: mu.topTemp,
            severe: severeEnv || gustNear >= SEVERE_GUST,
            precip: num(data.precipAmount, i),
            convRain: num(data.precipConvectiveAmount, i),
            rainNear: data.rainNear
                ? num(data.rainNear, i)
                : Math.max(
                      num(data.precipAmount, i - 1),
                      num(data.precipAmount, i),
                      num(data.precipAmount, i + 1),
                  ),
            deepCloud: Math.min(midCloud, coldCloud),
        });

        // --- Nuage d'averses : convection que le modèle développe lui-même. La nature de la pluie se
        // décide après la boucle, avec les heures voisines
        // Son nuage : celui de la particule standard, sinon celui de la particule la plus instable
        // (averses de traîne, dont l'air instable n'est pas celui du sol)
        const showerCloud = std.base != null && std.top != null ? std : mu;
        convective.push({
            base: showerCloud.base,
            top: showerCloud.top,
            alone:
                showerCloud.base != null &&
                showerCloud.top != null &&
                isShower({
                    precip: num(data.precipAmount, i),
                    convRain: num(data.precipConvectiveAmount, i),
                    cape: std.cape,
                    depth: std.base != null && std.top != null ? std.top - std.base : 0,
                    totals: totalTotals(profile),
                    liftedIndex: std.liftedIndex,
                }),
        });

        const freezing = freezingLevelOf(profile);
        const stepFrom = get('stepFrom', ts);
        const stepTo = get('stepTo', ts);

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
            precipStep: Math.max(1, Math.round(num(data.precipStep, i, 1))),
            pressure: surfacePressure(data.pressure?.[i]),
            step: stepFrom != null && stepTo != null ? [stepFrom, stepTo] : null,
            sunElev,
            cloudCover,
            sunCover,
            highCloud,
            cloudTop,
            cloudEstimated,
            thermalTop,
            cuBase,
            cuTop,
            cuTopCapped,
            cuFreeTop,
            parcelStart,
            parcelDew,
            ceiling,
            wStar,
            climb: ceiling == null ? 0 : netClimb(wStar),
            blSpeed,
            blShear,
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
            showerBase: null,
            showerTop: null,
            recentRain,
        });
    });

    // --- Nuage d'averses aux heures dont la pluie est faite d'averses, s'il y a un nuage convectif
    const showers =
        shower != null
            ? columns.map(() => shower)
            : showerHours(
                  columns.map((c, k) => ({
                      ts: c.ts,
                      precip: c.precip,
                      convective: convective[k].alone,
                  })),
              );
    columns.forEach((c, k) => {
        const { base, top } = convective[k];
        if (!showers[k] || base == null || top == null) return;
        c.showerBase = base;
        c.showerTop = top;
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
    day: {
        top: [58, 120, 186] as RGB3,
        bottom: [120, 176, 226] as RGB3,
        cloud: [206, 214, 225] as RGB3,
        glow: [240, 243, 248] as RGB3,
    },
    night: {
        top: [9, 16, 38] as RGB3,
        bottom: [20, 34, 68] as RGB3,
        cloud: [92, 104, 130] as RGB3,
        glow: [158, 170, 196] as RGB3,
    },
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

/**
 * Couche de nuages bas du graphique : corps plus clair que le voile des nuages en couches, base
 * sombre, et dessus éclairé d'une mer de nuages ; assombris la nuit comme le reste du ciel.
 */
const LOW_LAYER = {
    day: {
        body: [220, 227, 237] as RGB3,
        base: [140, 153, 173] as RGB3,
        top: [255, 255, 255] as RGB3,
    },
    night: {
        body: [118, 130, 154] as RGB3,
        base: [70, 81, 104] as RGB3,
        top: [182, 192, 212] as RGB3,
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
        // Halo des nuages plus hauts que le graphique : plus clair que les nuages eux-mêmes
        glow: lerp3(SKY.day.glow, SKY.night.glow, t),
    };
};

export const towerColors = (shower: boolean, night: number) => {
    const s = shower ? TOWER.shower : TOWER.fair;
    const t = Math.min(1, Math.max(0, night));
    return { body: lerp3(s.day.body, s.night.body, t), base: lerp3(s.day.base, s.night.base, t) };
};

export const lowCloudColors = (night: number) => {
    const t = Math.min(1, Math.max(0, night));
    return {
        body: lerp3(LOW_LAYER.day.body, LOW_LAYER.night.body, t),
        base: lerp3(LOW_LAYER.day.base, LOW_LAYER.night.base, t),
        top: lerp3(LOW_LAYER.day.top, LOW_LAYER.night.top, t),
    };
};

/**
 * Part de nuit (0 jour … 1 nuit) selon la hauteur du soleil, avec transition à l'aube et au crépuscule.
 * Fondu de ±4° centré sur −0,833° (soleil apparent) : mi-transition pile au lever / coucher officiel.
 */
export const nightFactor = (sunElev: number) => Math.min(1, Math.max(0, (3.167 - sunElev) / 8));

export const rgbCss = (c: RGB3) =>
    `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

const hex = (h: string): RGB3 => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
];

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

/**
 * Paliers de la CAPE affichée (J/kg) : les seuils usuels d'une CAPE complète (300, 1 000 et 2 500)
 * ramenés à la part que le profil en contient. La CAPE calculée ici s'arrête au dernier niveau
 * fourni (400 hPa) : elle vaut environ 65 % de la CAPE complète (voir SEVERE_WMAXSHEAR).
 */
export const CAPE_LEVELS: readonly [number, number, number] = [200, 650, 1600];

/** Couleur du palier d'une CAPE (J/kg) : faible, modérée, forte, très forte (voir CAPE_LEVELS) */
export const capeColor = (cape: number) =>
    INSTABILITY_COLORS[
        cape < CAPE_LEVELS[0] ? 0 : cape < CAPE_LEVELS[1] ? 1 : cape < CAPE_LEVELS[2] ? 2 : 3
    ];

/** Couleur du palier d'un indice de soulèvement (K) : > 0 stable, > −3 faiblement instable, > −6 instable, au-delà très instable */
export const liftedIndexColor = (li: number) =>
    INSTABILITY_COLORS[li > 0 ? 0 : li > -3 ? 1 : li > -6 ? 2 : 3];

/** Couleur d'un niveau de risque d'orage (1 surdéveloppement, 2 orage probable, 3 orage violent possible) */
export const STORM_COLORS = ['', '#f59e0b', '#ef4444', '#d946ef'] as const;

/** Direction cardinale (d'où vient le vent) */
export const cardinal = (dir: number) =>
    CARDINALS[Math.round((((dir % 360) + 360) % 360) / 22.5) % 16];

export const toKmh = (ms: number) => ms * 3.6;
export const toCelsius = (k: number) => k - KELVIN;
