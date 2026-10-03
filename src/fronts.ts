/**
 * Passages de front : lus sur la carte autour du lieu (sa masse d'air et celle de quatre points
 * voisins), placés au sol et en altitude d'après la prévision du lieu, puis rangés par jour. Sans
 * les points voisins, ils sont repérés sur le lieu seul. Un front froid passe à l'heure où l'air
 * commence à changer, un front chaud à celle où il finit de changer.
 */

import {
    type Column,
    type ForecastPayload,
    interpProfile,
    levelAir,
    pressureAt,
    thetaE,
    windAt,
} from './physics';
import { dayKey } from './time';

const HOUR = 3600e3;

/**
 * Couche (m au-dessus du sol) dont l'air dit la masse d'air : au-dessus de la couche de surface et
 * de son cycle jour / nuit, mais assez bas pour que le front y soit net. Plus haut, l'air change
 * plus tard et plus lentement (la surface d'un front est très inclinée) : la variation y dépasse
 * rarement quelques degrés en 6 h, et la plupart des fronts y passent inaperçus.
 */
const AIR_MASS: readonly [number, number] = [750, 2000];
/** Couche de l'air libre (m au-dessus du sol) : elle donne l'heure du passage en altitude */
const FREE_AIR: readonly [number, number] = [1500, 3000];
/**
 * Hauteurs (m au-dessus du sol) entre lesquelles le graphique trace la surface d'un front : elle
 * passe à l'heure du sol (`at`) au niveau du sol, à l'heure de l'altitude (`aloft`) au milieu de
 * la couche de l'air libre, et n'est pas connue au-dessus de cette couche
 */
export const FRONT_ALOFT = (FREE_AIR[0] + FREE_AIR[1]) / 2;
export const FRONT_TOP = FREE_AIR[1];
/** Durée (h) sur laquelle on mesure le changement de masse d'air */
const FRONT_WINDOW = 6;
/**
 * Seuils d'un front repéré sur le lieu seul (points voisins indisponibles), calés sur GFS, ICON et
 * ECMWF (16 sites d'Europe, du 8 septembre au 8 octobre 2026) contre les fronts de la carte (voir
 * MAP). Le front est reconnu au changement de masse d'air, mesuré par la température potentielle
 * équivalente (elle baisse ou monte de plusieurs degrés quand l'air change, et ne bouge pas quand
 * il ne fait que monter ou descendre) et confirmé par la température.
 * - changement franc : au moins 5 K de température potentielle équivalente en 6 h, dont au moins
 *   1,5 K de température ;
 * - changement lent : au moins 7 K en 12 h, dont au moins 2,5 K de température.
 * Ce changement ne suffit pas (humidité brassée par les thermiques, subsidence, brises) : il doit
 * être amené par le vent, ce que dit sa rotation avec l'altitude (advection, voir thermalAdvection).
 * - front froid : l'advection moyenne pendant le changement est froide ;
 * - front chaud : advection chaude d'au moins 0,1 K/h, sous un ciel couvert (sans quoi l'air humide
 *   que les thermiques montent dans la couche, l'après-midi, passerait pour un front chaud).
 * Sur ces prévisions, 79 % des fronts de la carte sont retrouvés, et 78 % des fronts annoncés y
 * sont. La rotation du vent et le creux de pression n'ajoutent rien à ces règles : ils ne servent
 * qu'à décrire le front.
 */
const CHANGE = {
    fast: { window: FRONT_WINDOW, thetaE: 5, temp: 1.5 },
    slow: { window: 12, thetaE: 7, temp: 2.5 },
};
const COLD = { advection: 0, rain: 1 };
const WARM = { advection: 0.1, cloud: 0.8 };
/** Deux changements de même sens à moins de 9 h l'un de l'autre sont le même front */
const SAME_FRONT = 9;
/**
 * Occlusion : une langue d'air chaud passe en altitude sans que l'air change près du sol. L'air
 * libre gagne puis reperd au moins 1,5 K en 6 h de part et d'autre, sous un ciel couvert et au
 * moins 2 mm de pluie de nuages en couches, quand l'air bas change de moins de 2 K d'un bord à
 * l'autre et qu'aucun front froid ou chaud ne passe à ±12 h. Seuils non calés : un seul point ne
 * permet pas de les vérifier sur la carte.
 */
const OCCLUDED = { swing: 1.5, rain: 2, cloud: 0.8, lowChange: 2 };
/** Couche basse (m au-dessus du sol) dont l'air change quand le front passe au sol */
const LOW_AIR: readonly [number, number] = [250, 1000];
/** Variation minimale (K en 2 h) de la température potentielle équivalente de l'air bas au passage */
const LOW_AIR_STEP = 1;
/** Heures avant la fenêtre où l'on cherche le passage au sol d'un front froid : il précède l'altitude */
const GROUND_LEAD = 3;
/** Heures après la fenêtre où l'on cherche le passage au sol d'un front chaud : il suit l'altitude */
const GROUND_LAG = 6;
/**
 * Heures avant (front froid) ou après (front chaud) le changement le plus rapide lu sur la carte où
 * l'on cherche celui de l'air bas, qui date le passage au sol
 */
const MAP_GROUND = 3;
/**
 * Un front est le bord de l'air chaud, pas le milieu du changement d'air. Un front froid est le bord
 * avant de l'air froid : il passe quand l'air commence à changer (le vent tourne, la pression cesse
 * de baisser), deux à trois heures avant l'heure où il change le plus vite. Un front chaud est le
 * bord arrière de l'air froid qu'il remplace : il passe quand l'air finit de changer, deux heures
 * environ après cette heure. Le début (ou la fin) du changement se lit en remontant (ou en
 * descendant) le temps depuis l'heure où l'air change le plus vite, tant qu'il change encore d'au
 * moins `rate` K par heure, de `hours` heures au plus.
 */
const EDGE = { rate: 0.5, hours: 6 };
/**
 * Écart minimal (m) entre deux points de la surface d'un front : plus près du sol, l'heure du niveau
 * lu sur la carte est celle du sol ; plus près du milieu de l'air libre, elle en tient lieu
 */
const MAP_LEVEL_GAP = 250;
/**
 * Plus grand écart (h) entre le passage au sol et le passage en altitude : au-delà, les deux heures
 * ne décrivent plus la même surface
 */
const MAX_LEAN = 6;
/** Couche (m au-dessus du sol) dont la rotation du vent avec l'altitude donne l'advection */
const ADVECTION_LAYER: readonly [number, number] = [500, 3000];
/** Vent (m/s) en dessous duquel sa direction ne veut rien dire : 15 km/h */
const TURN_MIN_WIND = 15 / 3.6;
/** Rotation du vent (°) entre le début et la fin du changement d'air, à partir de laquelle on dit qu'il tourne */
const TURN = 30;
/** Heures comptées avant et après la fenêtre pour la pluie du front */
const FRONT_RAIN_MARGIN = 3;

export interface WindPart {
    /** Direction d'où vient le vent (°) et vitesse (m/s) */
    dir: number;
    speed: number;
}

export interface Front {
    kind: 'cold' | 'warm' | 'occluded';
    /**
     * Heure du passage au sol : celle où l'air bas (250 à 1 000 m au-dessus du sol) commence à
     * changer pour un front froid, finit de changer pour un front chaud (voir EDGE) ; sinon celle
     * où la masse d'air commence ou finit de changer
     */
    at: Column;
    /**
     * Heure où l'air libre (1 500 à 3 000 m au-dessus du sol) change le plus vite : jamais avant le
     * passage plus bas pour un front froid, jamais après pour un front chaud, et à 6 h du sol au plus
     */
    aloft: Column;
    /**
     * Variation de température de l'air (K) entre 750 et 2 000 m au-dessus du sol sur `window`
     * heures : négative pour un front froid ; pour une occlusion, ce que l'air libre gagne avant de
     * le reperdre
     */
    tempChange: number;
    window: number;
    /** Advection moyenne pendant la fenêtre (K/h), lue sur la rotation du vent avec l'altitude */
    advection: number | null;
    /** Variation de la pression au sol dans les 3 h qui suivent le passage (hPa) ; null sans pression */
    pressureRise: number | null;
    /** Altitude (m AMSL) du vent donné avant et après le front */
    windZ: number;
    before: WindPart | null;
    after: WindPart | null;
    /** Le vent tourne nettement au passage du front (les deux vents dépassent 15 km/h) */
    turns: boolean;
    /** Pluie autour du passage (mm) */
    rain: number;
    /** Front froid sec : il passe avec moins de 1 mm de pluie */
    dry: boolean;
    /** Plus fortes rafales du modèle autour du passage (m/s) ; null s'il n'en fournit pas */
    gust: number | null;
    /**
     * Vitesse de déplacement du front (km/h) et direction d'où il vient (°), lues sur le retard de
     * son passage aux points voisins (voir MOVE) ; null sans eux, ou pour une occlusion
     */
    speed: number | null;
    bearing: number | null;
    /**
     * Variation de température de l'air (K) entre 750 et 2 000 m au-dessus du sol dans les 2 h qui
     * encadrent l'heure où la masse d'air change le plus vite, et passage brutal : l'essentiel du
     * changement de la fenêtre tient dans ces 2 h (voir ABRUPT)
     */
    tempStep: number;
    abrupt: boolean;
    /**
     * Vent au sol de part et d'autre du passage : plus fortes rafales (vent moyen si le modèle n'en
     * fournit pas) des 3 h qui le précèdent et des 3 h qui le suivent (m/s), et saut de vent quand
     * les secondes dépassent nettement les premières (voir JUMP)
     */
    gustBefore: number | null;
    gustAfter: number | null;
    gustJump: boolean;
    /**
     * Heures (timestamps) entre lesquelles le front passe au sol, quand Windy ne fournit le modèle
     * que toutes les 3 heures : l'heure du passage (`at`) est alors interpolée, et n'est connue
     * qu'à ce pas près. null quand la prévision est horaire.
     */
    between: [number, number] | null;
    /**
     * Surface du front, du sol vers le haut : à chaque altitude (m AMSL), l'heure (timestamp) où le
     * front y passe. Le sol à l'heure de `at`, le niveau lu sur la carte à l'heure où elle l'y fait
     * passer, le milieu de la couche de l'air libre à l'heure de `aloft` (sauf si le niveau de la
     * carte est à cette hauteur ou plus haut : il en tient lieu). Elle ne penche jamais à l'envers :
     * un front froid passe de plus en plus tard en montant, un front chaud de plus en plus tôt.
     */
    surface: { z: number; ts: number }[];
}

/** Moyenne d'une grandeur sur une couche (bornes en mètres au-dessus du sol) ; null si le profil ne l'atteint pas */
const layerMean = (
    c: Column,
    layer: readonly [number, number],
    value: (z: number) => number | null,
): number | null => {
    let sum = 0;
    let n = 0;
    for (let z = c.ground + layer[0]; z <= c.ground + layer[1]; z += 250) {
        const v = value(z);
        if (v == null) continue;
        sum += v;
        n++;
    }
    return n ? sum / n : null;
};

/** Température moyenne (K) d'une couche */
const layerTemp = (c: Column, layer: readonly [number, number]) =>
    layerMean(c, layer, z => interpProfile(c.profile, z, 't'));

/** Température potentielle équivalente moyenne (K) d'une couche : elle suit la masse d'air */
const layerThetaE = (c: Column, layer: readonly [number, number]) =>
    layerMean(c, layer, z => {
        const t = interpProfile(c.profile, z, 't');
        return t == null
            ? null
            : thetaE(t, interpProfile(c.profile, z, 'td'), pressureAt(c.profile, z));
    });

/**
 * Advection de température (K/h) entre 500 et 3 000 m au-dessus du sol, lue sur un seul point : un
 * vent qui tourne à droite en montant (dans l'hémisphère nord) amène de l'air chaud, à gauche de
 * l'air froid. C'est le vent thermique : −(f · T ÷ (g · Δz)) · (u₁v₂ − u₂v₁), avec f le paramètre de
 * Coriolis, qui change de signe avec l'hémisphère. null hors du profil.
 */
export const thermalAdvection = (c: Column, lat: number): number | null => {
    const lo = c.ground + ADVECTION_LAYER[0];
    const hi = c.ground + ADVECTION_LAYER[1];
    const u1 = interpProfile(c.profile, lo, 'u');
    const v1 = interpProfile(c.profile, lo, 'v');
    const u2 = interpProfile(c.profile, hi, 'u');
    const v2 = interpProfile(c.profile, hi, 'v');
    const t = interpProfile(c.profile, (lo + hi) / 2, 't');
    if (u1 == null || v1 == null || u2 == null || v2 == null || t == null) return null;
    const coriolis = 2 * 7.292e-5 * Math.sin((lat * Math.PI) / 180);
    return -((coriolis * t) / (9.81 * (hi - lo))) * (u1 * v2 - u2 * v1) * 3600;
};

/**
 * Heure (indice) où le front passe, quand `serie` change le plus vite à l'heure `k` dans le sens
 * `sign` : celle où ce changement commence s'il est un refroidissement (front froid), celle où il
 * finit s'il est un réchauffement (front chaud) ; voir EDGE
 */
const edgeOf = (serie: (number | null)[], k: number, sign: number): number => {
    // Front froid : on remonte le temps ; front chaud : on le descend
    const step = sign < 0 ? -1 : 1;
    let at = k;
    while (at + step >= 0 && at + step < serie.length && Math.abs(at - k) < EDGE.hours) {
        const a = serie[Math.min(at, at + step)];
        const b = serie[Math.max(at, at + step)];
        if (a == null || b == null || (b - a) * sign < EDGE.rate) break;
        at += step;
    }
    return at;
};

/** Moyenne des valeurs connues ; null s'il n'y en a aucune */
const mean = (values: (number | null)[]): number | null => {
    const known = values.filter((v): v is number => v != null);
    return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
};

// ---------------------------------------------------------------------------
// Fronts lus sur la carte : la masse d'air du lieu et de quatre points voisins
// ---------------------------------------------------------------------------

/** Niveaux de pression (hPa) où la carte est lue : 850 hPa, et 700 hPa pour les sites d'altitude */
const MAP_LEVELS = [850, 700] as const;
type MapLevel = (typeof MAP_LEVELS)[number];
/** Altitude du sol (m) à partir de laquelle un front qui ne passe qu'à 700 hPa compte aussi */
const HIGH_GROUND = 900;
/**
 * Un front sur la carte : une zone où la masse d'air change vite d'un endroit à l'autre, et qui
 * traverse le lieu. Au niveau lu, la température potentielle équivalente du lieu (lissée sur 3 h)
 * change d'au moins `thetaE` K sur la fenêtre, dans un gradient horizontal moyen d'au moins
 * `gradient` K/100 km, que le vent du niveau pousse sur le lieu (advection moyenne d'au moins
 * `advection` K/h, de même sens). L'humidité seule ne fait pas un front (intrusion d'air sec,
 * subsidence) : la température potentielle doit suivre (`theta` K, gradient d'au moins
 * `thetaGradient` K/100 km, advection d'au moins `thetaAdvection` K/h).
 */
const MAP = {
    gradient: 3.5,
    thetaGradient: 1.5,
    fast: { window: FRONT_WINDOW, thetaE: 5, theta: 2, advection: 0.3, thetaAdvection: 0.15 },
    slow: { window: 12, thetaE: 7, theta: 2.8, advection: 0.15, thetaAdvection: 0.075 },
};
const KM_PER_DEG = 111.2;
/**
 * Déplacement d'un front, lu sur le retard de son passage aux points voisins : la température
 * potentielle équivalente d'un voisin est décalée dans le temps (de −`maxLag` à +`maxLag` h, par pas
 * de `step` h) jusqu'à se superposer à celle du lieu sur la fenêtre du front élargie de `margin` h.
 * Le voisin ne compte que s'il voit bien le même changement d'air (l'écart qui reste ne dépasse pas
 * `fit` de la variation du lieu) et que son retard n'est pas au bord de la plage. Les retards d'au
 * moins `points` voisins donnent la lenteur du front (h/km), donc sa vitesse et sa direction. Hors
 * de `speed` (km/h), la vitesse n'est pas donnée : front presque immobile, ou retards trop petits
 * pour être mesurés au pas d'une heure.
 */
const MOVE = { margin: 3, maxLag: 6, step: 0.25, fit: 0.5, points: 3, speed: [8, 120] };
/** Vitesse (km/h) à partir de laquelle un front est dit rapide : 10 km en 12 minutes */
export const FAST_FRONT = 50;
/**
 * Passage brutal : au moins cette part du changement de masse d'air de la fenêtre se fait en 2 h,
 * autour de l'heure où il est le plus rapide
 */
const ABRUPT = 0.6;
/** Heures comptées avant et après le passage au sol pour le saut de vent */
const JUMP_HOURS = 3;
/**
 * Saut de vent au sol : les plus fortes rafales des 3 h qui suivent le passage dépassent d'au moins
 * 15 km/h celles des 3 h qui précèdent, et atteignent 30 km/h (m/s)
 */
const JUMP = { rise: 15 / 3.6, gust: 30 / 3.6 };

/** Masse d'air d'un point, heure par heure, aux niveaux où la carte est lue */
export interface AirMass {
    lat: number;
    lon: number;
    ts: number[];
    levels: Record<
        MapLevel,
        {
            /** Température potentielle équivalente et température potentielle (K) */
            thetaE: (number | null)[];
            theta: (number | null)[];
            /** Vent du niveau (m/s) */
            u: (number | null)[];
            v: (number | null)[];
            /** Altitude du niveau (m AMSL) */
            z: (number | null)[];
        }
    >;
}

/** Masse d'air du point d'une prévision de Windy (voir levelAir) */
export const airMassOf = (payload: ForecastPayload, lat: number, lon: number): AirMass => {
    const level = (p: MapLevel) => {
        const air = levelAir(payload, p);
        return {
            thetaE: air.t.map((t, i) =>
                t == null || air.td[i] == null ? null : thetaE(t, air.td[i], p),
            ),
            theta: air.t.map(t => (t == null ? null : thetaE(t, null, p))),
            u: air.u,
            v: air.v,
            z: air.z,
        };
    };
    return {
        lat,
        lon,
        ts: (payload.data.ts || []) as number[],
        levels: { 850: level(850), 700: level(700) },
    };
};

export interface MapFront {
    kind: 'cold' | 'warm';
    /** Début et fin (timestamps) de la fenêtre où la masse d'air change */
    from: number;
    to: number;
    /** Heure (timestamp) où elle change le plus vite au niveau lu */
    ts: number;
    /**
     * Heure (timestamp) où le front passe au niveau lu : celle où la masse d'air commence à changer
     * pour un front froid, celle où elle finit de changer pour un front chaud (voir EDGE)
     */
    passage: number;
    /** Durée de la fenêtre (h) : 6 pour un front franc, 12 pour un front lent */
    window: number;
    /** Niveau de pression lu (hPa), et son altitude (m AMSL) à l'heure où le front y passe */
    level: MapLevel;
    z: number | null;
    /** Vitesse de déplacement du front (km/h) et direction d'où il vient (°) ; null si elles ne se lisent pas (voir MOVE) */
    speed: number | null;
    bearing: number | null;
}

/**
 * Fronts de la carte qui traversent le lieu (`center`), lus sur sa masse d'air et celle de points
 * voisins (`around`, à quelques dizaines de km de chaque côté) : voir MAP. Un front franc (6 h)
 * l'emporte sur un front lent (12 h) de même sens à moins de 9 h ; un front de 700 hPa n'est gardé
 * que si le sol du lieu (`ground`, m) est haut et qu'aucun front de même sens ne passe à 850 hPa à
 * moins de 9 h. Un niveau situé sous le sol du lieu n'est pas lu.
 */
export const mapFronts = (center: AirMass, around: AirMass[], ground: number): MapFront[] => {
    const n = center.ts.length;
    const indexOf = new Map(center.ts.map((ts, i) => [ts, i]));
    const cosLat = Math.max(0.2, Math.cos((center.lat * Math.PI) / 180));
    const points = [center, ...around].map(a => ({
        air: a,
        x: (a.lon - center.lon) * KM_PER_DEG * cosLat,
        y: (a.lat - center.lat) * KM_PER_DEG,
        index: a === center ? null : new Map(a.ts.map((ts, i) => [ts, i])),
    }));
    /**
     * Gradient horizontal (K/km) d'une grandeur à l'heure i du lieu : plan ajusté aux points connus
     * (moindres carrés) ; null s'ils sont trop peu nombreux ou alignés
     */
    const gradient = (level: MapLevel, field: 'thetaE' | 'theta', i: number) => {
        let sx = 0,
            sy = 0,
            sv = 0,
            sxx = 0,
            syy = 0,
            sxy = 0,
            sxv = 0,
            syv = 0,
            m = 0;
        for (const p of points) {
            const k = p.index ? p.index.get(center.ts[i]) : i;
            const v = k == null ? null : p.air.levels[level][field][k];
            if (v == null) continue;
            sx += p.x;
            sy += p.y;
            sv += v;
            sxx += p.x * p.x;
            syy += p.y * p.y;
            sxy += p.x * p.y;
            sxv += p.x * v;
            syv += p.y * v;
            m++;
        }
        if (m < 3) return null;
        const cxx = sxx - (sx * sx) / m;
        const cyy = syy - (sy * sy) / m;
        const cxy = sxy - (sx * sy) / m;
        const det = cxx * cyy - cxy * cxy;
        if (det < 1e-6 * cxx * cyy || det <= 0) return null;
        const cxv = sxv - (sx * sv) / m;
        const cyv = syv - (sy * sv) / m;
        return { x: (cxv * cyy - cyv * cxy) / det, y: (cyv * cxx - cxv * cxy) / det };
    };

    /**
     * Retard (h) du passage du front au point `p` par rapport au lieu, entre les heures i et j du
     * lieu (voir MOVE) ; null si le voisin ne voit pas le même changement d'air
     */
    const lagOf = (p: (typeof points)[number], level: MapLevel, i: number, j: number) => {
        const ref = center.levels[level].thetaE;
        const serie = p.air.levels[level].thetaE;
        const value = (k: number) => {
            const m = k < 0 || k >= n ? undefined : p.index?.get(center.ts[k]);
            return m == null ? null : serie[m];
        };
        const from = Math.max(0, i - MOVE.margin);
        const to = Math.min(n - 1, j + MOVE.margin);
        /** Variance de `values` ; null s'il en manque */
        const variance = (values: (number | null)[]) => {
            if (values.some(v => v == null)) return null;
            const m = (values as number[]).reduce((a, b) => a + b, 0) / values.length;
            return (values as number[]).reduce((a, b) => a + (b - m) ** 2, 0) / values.length;
        };
        const spread = variance(ref.slice(from, to + 1));
        if (!spread) return null;
        let best: { lag: number; err: number } | null = null;
        for (let lag = -MOVE.maxLag; lag <= MOVE.maxLag + 1e-9; lag += MOVE.step) {
            const diff: (number | null)[] = [];
            for (let k = from; k <= to; k++) {
                // Valeur du voisin `lag` heures après l'heure k, entre deux heures pleines
                const x = k + lag;
                const k0 = Math.floor(x);
                const a = value(k0);
                const b = x === k0 ? a : value(k0 + 1);
                const r = ref[k];
                diff.push(a == null || b == null || r == null ? null : a + (b - a) * (x - k0) - r);
            }
            const err = variance(diff);
            if (err != null && (!best || err < best.err)) best = { lag, err };
        }
        if (!best || best.err > MOVE.fit * spread || Math.abs(best.lag) >= MOVE.maxLag) return null;
        return best.lag;
    };
    /** Vitesse (km/h) du front qui change l'air du lieu entre les heures i et j, et direction d'où il vient (°) */
    const motionOf = (level: MapLevel, i: number, j: number) => {
        const none = { speed: null, bearing: null };
        let sxx = 0,
            syy = 0,
            sxy = 0,
            sxt = 0,
            syt = 0,
            m = 0;
        for (const p of points) {
            const lag = p.index ? lagOf(p, level, i, j) : null;
            if (lag == null) continue;
            sxx += p.x * p.x;
            syy += p.y * p.y;
            sxy += p.x * p.y;
            sxt += p.x * lag;
            syt += p.y * lag;
            m++;
        }
        const det = sxx * syy - sxy * sxy;
        if (m < MOVE.points || det < 1e-6 * sxx * syy || det <= 0) return none;
        // Lenteur (h/km) : le front arrive plus tard du côté vers lequel il va
        const slowX = (sxt * syy - syt * sxy) / det;
        const slowY = (syt * sxx - sxt * sxy) / det;
        const slow = Math.hypot(slowX, slowY);
        const speed = slow > 0 ? 1 / slow : Infinity;
        if (speed < MOVE.speed[0] || speed > MOVE.speed[1]) return none;
        return { speed, bearing: ((Math.atan2(-slowX, -slowY) * 180) / Math.PI + 360) % 360 };
    };

    const frontsAt = (level: MapLevel): MapFront[] => {
        const here = center.levels[level];
        // Niveau sous le sol du lieu : ses valeurs sont prolongées, pas mesurées
        if (here.z.some(z => z != null && z <= ground)) return [];
        /** Par grandeur : valeur du lieu, norme du gradient (K/100 km) et advection (K/h) */
        const fieldOf = (field: 'thetaE' | 'theta') => {
            const g: (number | null)[] = [];
            const adv: (number | null)[] = [];
            for (let i = 0; i < n; i++) {
                const grad = gradient(level, field, i);
                const u = here.u[i];
                const v = here.v[i];
                g.push(grad ? Math.hypot(grad.x, grad.y) * 100 : null);
                adv.push(grad && u != null && v != null ? -(u * grad.x + v * grad.y) * 3.6 : null);
            }
            return { value: here[field], g, adv };
        };
        const moist = fieldOf('thetaE');
        const dry = fieldOf('theta');
        // Température potentielle équivalente lissée sur 3 h
        const smooth = moist.value.map((_, i) =>
            mean(moist.value.slice(Math.max(0, i - 1), i + 2)),
        );

        const pass = ({
            window,
            thetaE: dMin,
            theta: thMin,
            advection,
            thetaAdvection,
        }: typeof MAP.fast) => {
            const end = (i: number) => indexOf.get(center.ts[i] + window * HOUR);
            const changes = smooth.map((a, i) => {
                const j = end(i);
                const b = j == null ? null : smooth[j];
                return j == null || a == null || b == null ? null : { j, d: b - a };
            });
            const found: MapFront[] = [];
            changes.forEach((w, i) => {
                if (!w || Math.abs(w.d) < dMin) return;
                const sign = Math.sign(w.d);
                // Une seule fenêtre par front : la plus forte variation de même sens à ± une fenêtre
                for (let k = Math.max(0, i - window); k <= Math.min(n - 1, i + window); k++) {
                    const o = changes[k];
                    if (k === i || !o || Math.sign(o.d) !== sign) continue;
                    if (Math.abs(o.d) > Math.abs(w.d) || (Math.abs(o.d) === Math.abs(w.d) && k < i))
                        return;
                }
                const over = (serie: (number | null)[]) => mean(serie.slice(i, w.j + 1)) ?? 0;
                if (over(moist.g) < MAP.gradient || over(moist.adv) * sign < advection) return;
                const a = dry.value[i];
                const b = dry.value[w.j];
                if (a == null || b == null || (b - a) * sign < thMin) return;
                if (over(dry.g) < MAP.thetaGradient || over(dry.adv) * sign < thetaAdvection)
                    return;
                let at = i + 1;
                let best = -Infinity;
                for (let k = i + 1; k < w.j; k++) {
                    const before = smooth[k - 1];
                    const after = smooth[k + 1];
                    if (before == null || after == null) continue;
                    const step = (after - before) * sign;
                    if (step > best) {
                        best = step;
                        at = k;
                    }
                }
                const passage = edgeOf(smooth, at, sign);
                found.push({
                    kind: sign < 0 ? 'cold' : 'warm',
                    from: center.ts[i],
                    to: center.ts[w.j],
                    ts: center.ts[at],
                    passage: center.ts[passage],
                    window,
                    level,
                    z: here.z[passage],
                    ...motionOf(level, i, w.j),
                });
            });
            return found;
        };
        const fast = pass(MAP.fast);
        return [...fast, ...pass(MAP.slow).filter(s => !near(s, fast))];
    };
    /** Un front de même sens passe-t-il à moins de 9 h ? */
    const near = (f: MapFront, others: MapFront[]) =>
        others.some(o => o.kind === f.kind && Math.abs(o.ts - f.ts) <= SAME_FRONT * HOUR);

    const low = frontsAt(850);
    const buried = center.levels[850].z.some(z => z != null && z <= ground);
    const high = ground >= HIGH_GROUND || buried ? frontsAt(700).filter(f => !near(f, low)) : [];
    return [...low, ...high].sort((a, b) => a.ts - b.ts);
};

/**
 * Passages de front de toute la prévision (`cols` : heures dans l'ordre). Avec `map` (les fronts de
 * la carte autour du lieu, voir mapFronts), ce sont eux : la carte dit qu'un front passe et à quelle
 * heure, la prévision du lieu dit où il passe au sol et en altitude et ce qui l'accompagne. Sans
 * `map` (points voisins indisponibles), les fronts sont repérés sur le lieu seul, par le changement
 * de masse d'air qu'ils apportent entre 750 et 2 000 m au-dessus du sol : la température
 * potentielle équivalente y varie d'au moins 5 K en 6 h (ou 7 K en 12 h pour un front lent), la
 * température suit, et le vent amène cet air (voir CHANGE, COLD et WARM) ; un front peu actif ou
 * qui passe à côté peut alors manquer. L'heure du passage est celle du sol, qui précède l'altitude
 * pour un front froid et la suit pour un front chaud.
 */
export const frontsOf = (cols: Column[], lat: number, map: MapFront[] | null = null): Front[] => {
    const mass = cols.map(c => layerThetaE(c, AIR_MASS));
    const massTemp = cols.map(c => layerTemp(c, AIR_MASS));
    const air = cols.map(c => layerTemp(c, FREE_AIR));
    const free = cols.map(c => layerThetaE(c, FREE_AIR));
    const low = cols.map(c => layerThetaE(c, LOW_AIR));
    const lowTemp = cols.map(c => layerTemp(c, LOW_AIR));
    const advection = cols.map(c => thermalAdvection(c, lat));
    const indexOf = new Map(cols.map((c, i) => [c.ts, i]));
    const last = cols.length - 1;
    /** Variation de `serie` sur les `hours` heures qui suivent l'heure i ; null si elles sortent de la prévision */
    const change = (serie: (number | null)[], i: number, hours: number) => {
        const j = indexOf.get(cols[i].ts + hours * HOUR);
        const a = serie[i];
        const b = j == null ? null : serie[j];
        return j == null || a == null || b == null ? null : { j, d: b - a };
    };
    /** La fenêtre de l'heure i porte-t-elle la plus forte variation de même sens à ±`hours` heures ? */
    const strongest = (changes: ReturnType<typeof change>[], i: number, hours: number) => {
        const w = changes[i];
        if (!w) return false;
        for (let k = Math.max(0, i - hours); k <= Math.min(last, i + hours); k++) {
            const o = changes[k];
            if (k === i || !o || Math.sign(o.d) !== Math.sign(w.d)) continue;
            if (Math.abs(o.d) > Math.abs(w.d) || (Math.abs(o.d) === Math.abs(w.d) && k < i))
                return false;
        }
        return true;
    };

    /** Ce qui accompagne le changement d'air de l'heure i à l'heure j : pluie, nuages, rafales, vent */
    const signature = (i: number, j: number) => {
        const from = cols[i].ts - FRONT_RAIN_MARGIN * HOUR;
        const to = cols[j].ts + FRONT_RAIN_MARGIN * HOUR;
        const around = cols.filter(c => c.ts >= from && c.ts <= to);
        const gusts = around.map(c => c.gust).filter((g): g is number => g != null);
        const windZ = cols[i].ground + FREE_AIR[0];
        const before = windAt(cols[i].profile, windZ);
        const after = windAt(cols[j].profile, windZ);
        // Rotation dans le sens des aiguilles d'une montre dans l'hémisphère nord, inverse dans le sud
        let veer = 0;
        if (before && after && Math.min(before.speed, after.speed) >= TURN_MIN_WIND) {
            veer = (((after.dir - before.dir + 540) % 360) - 180) * (lat < 0 ? -1 : 1);
        }
        return {
            rain: around.reduce((s, c) => s + c.precip, 0),
            layerRain: around.reduce((s, c) => s + (c.showerBase == null ? c.precip : 0), 0),
            cloud: Math.max(...cols.slice(i, j + 1).map(c => c.cloudCover)),
            gust: gusts.length ? Math.max(...gusts) : null,
            windZ,
            before,
            after,
            veer,
            advection: mean(advection.slice(i, j + 1)),
        };
    };

    /**
     * Heure où `serie` change le plus vite (sur 2 h) dans le sens `sign`, entre les heures `from` et
     * `to` ; null si elle ne change nulle part de plus de `min`
     */
    const steepest = (
        serie: (number | null)[],
        from: number,
        to: number,
        sign: number,
        min = -Infinity,
    ) => {
        let at: number | null = null;
        let best = min;
        for (let k = Math.max(1, from); k <= Math.min(last - 1, to); k++) {
            const a = serie[k - 1];
            const b = serie[k + 1];
            if (a == null || b == null) continue;
            const step = (b - a) * sign;
            if (step > best) {
                best = step;
                at = k;
            }
        }
        return at;
    };
    /** Variation de la pression au sol (hPa) dans les 3 h qui suivent l'heure k ; null sans pression */
    const pressureRise = (k: number) => {
        const j = indexOf.get(cols[k].ts + 3 * HOUR);
        const a = cols[k].pressure;
        const b = j == null ? null : cols[j].pressure;
        return a == null || b == null ? null : b - a;
    };

    /**
     * Heure où le front passe au sol, quand l'air bas change le plus vite à l'heure k dans le sens
     * `sign` : début du changement pour un front froid, fin pour un front chaud (voir EDGE). Modèle
     * fourni toutes les 3 heures : entre deux pas tout est interpolé, le changement commence ou
     * finit à un pas du modèle et le front passe dans le pas voisin, du côté du changement ;
     * l'heure rendue est le milieu de ce pas.
     */
    const lowEdge = (k: number, sign: number) => {
        const at = edgeOf(low, k, sign);
        const inward = sign < 0 ? 1 : -1;
        const here = cols[at].step;
        const next = cols[at + inward]?.step;
        if (!here || here[1] > here[0] || !next || next[1] <= next[0]) return at;
        const half = Math.floor((next[1] - next[0]) / HOUR / 2);
        return sign < 0 ? Math.min(k, at + half) : Math.max(k, at - half);
    };

    /** Fronts retenus, avec l'heure (indice) où la masse d'air change le plus vite */
    const fronts: (Front & { mid: number })[] = [];
    /** Plus fortes rafales (vent moyen sans elles) entre les heures `from` et `to` ; null hors de la prévision */
    const strongest10m = (from: number, to: number) => {
        const hours = cols.slice(Math.max(0, from), Math.min(last, to) + 1);
        return hours.length ? Math.max(...hours.map(c => c.gust ?? c.windSurf)) : null;
    };
    /**
     * Pas du modèle (timestamps) dans lequel tombe le passage au sol de l'heure `at`, pour un front
     * de sens `sign` ; null quand la prévision est horaire. À une heure que le modèle fournit, c'est
     * celui de ses deux pas voisins où l'air bas change le plus.
     */
    const betweenOf = (at: number, sign: number): [number, number] | null => {
        const step = cols[at].step;
        if (!step) return null;
        if (step[1] > step[0]) return step;
        const before = cols[at - 1]?.step;
        const after = cols[at + 1]?.step;
        const moved = (s: [number, number] | null | undefined) => {
            const a = s ? indexOf.get(s[0]) : undefined;
            const b = s ? indexOf.get(s[1]) : undefined;
            const va = a == null ? null : (low[a] ?? mass[a]);
            const vb = b == null ? null : (low[b] ?? mass[b]);
            return !s || s[1] <= s[0] || va == null || vb == null ? null : (vb - va) * sign;
        };
        const mb = moved(before);
        const ma = moved(after);
        if (mb == null && ma == null) return null;
        return (mb ?? -Infinity) >= (ma ?? -Infinity) ? before! : after!;
    };

    const add = (
        kind: Front['kind'],
        window: number,
        tempChange: number,
        sig: ReturnType<typeof signature>,
        mid: number,
        aloft: number,
        at: number,
        surface: Front['surface'],
        motion: { speed: number | null; bearing: number | null } = { speed: null, bearing: null },
    ) => {
        // Deux fenêtres qui mènent au même passage au sol sont le même front ; la carte, elle, a déjà
        // fait le tri : seuls deux fronts de même sorte à la même heure se confondent
        const same = (map && kind !== 'occluded' ? 0 : FRONT_WINDOW) * HOUR;
        if (fronts.some(o => o.kind === kind && Math.abs(o.at.ts - cols[at].ts) <= same)) return;
        // Ce que l'air change en 2 h autour de l'heure où il change le plus vite
        const two = (serie: (number | null)[]) => {
            const a = serie[mid - 1];
            const b = serie[mid + 1];
            return a == null || b == null ? 0 : b - a;
        };
        const start = indexOf.get(cols[mid].ts - (window / 2) * HOUR);
        const whole = start == null ? null : change(mass, start, window);
        const tempStep = two(massTemp);
        const abrupt =
            kind !== 'occluded' &&
            !!whole &&
            Math.abs(whole.d) > 0 &&
            two(mass) / whole.d >= ABRUPT;
        const gustBefore = strongest10m(at - JUMP_HOURS, at - 1);
        const gustAfter = strongest10m(at, at + JUMP_HOURS - 1);
        fronts.push({
            kind,
            at: cols[at],
            aloft: cols[aloft],
            tempChange,
            window,
            advection: sig.advection,
            pressureRise: pressureRise(at),
            windZ: sig.windZ,
            before: sig.before,
            after: sig.after,
            turns: Math.abs(sig.veer) >= TURN,
            rain: sig.rain,
            dry: kind === 'cold' && sig.rain < COLD.rain,
            gust: sig.gust,
            ...motion,
            tempStep,
            abrupt,
            gustBefore,
            gustAfter,
            gustJump:
                gustBefore != null &&
                gustAfter != null &&
                gustAfter >= JUMP.gust &&
                gustAfter - gustBefore >= JUMP.rise,
            between: kind === 'occluded' ? null : betweenOf(at, kind === 'cold' ? -1 : 1),
            surface,
            mid,
        });
    };
    /** Un front déjà retenu (de la sorte `kind`, s'il est donné) change-t-il l'air entre les heures `from` et `to` ? */
    const taken = (from: number, to: number, kind?: Front['kind']) =>
        fronts.some(f => (!kind || f.kind === kind) && f.mid >= from && f.mid <= to);

    /**
     * Retient le front dont la masse d'air change de l'heure i à l'heure j, le plus vite à l'heure
     * `mid`, et trace sa surface. L'heure où l'air bas change le plus vite est cherchée entre les
     * heures `from` et `to` : au sol, un front froid passe à celle où ce changement commence, un
     * front chaud à celle où il finit (voir EDGE). À l'altitude `levelZ` (m AMSL) du niveau lu sur
     * la carte, s'il y en a un, il passe à l'heure `pass` : c'est elle que donne la carte. Plus
     * haut, à l'heure où l'air libre change le plus vite : après les passages plus bas pour un
     * front froid, avant pour un front chaud.
     */
    const place = (
        kind: 'cold' | 'warm',
        window: number,
        [i, j, mid, pass]: [number, number, number, number],
        [from, to]: [number, number],
        levelZ: number | null = null,
        motion?: { speed: number | null; bearing: number | null },
    ) => {
        const cold = kind === 'cold';
        const sign = cold ? -1 : 1;
        const ground = cols[mid].ground;
        const top = ground + FRONT_ALOFT;
        // Niveau de la carte au ras du sol : son heure est celle du sol
        const level = levelZ != null && levelZ >= ground + MAP_LEVEL_GAP ? levelZ : null;
        const fastest =
            levelZ != null && level == null ? null : steepest(low, from, to, sign, LOW_AIR_STEP);
        const at = fastest == null ? pass : lowEdge(fastest, sign);
        const surface = [{ z: ground, ts: cols[at].ts }];
        let below = at;
        if (level != null) {
            // Jamais à l'envers du sol, ni à plus de 6 h de lui
            below = cold
                ? Math.min(at + MAX_LEAN, Math.max(at, pass))
                : Math.max(at - MAX_LEAN, Math.min(at, pass));
            surface.push({ z: level, ts: cols[below].ts });
        }
        // Niveau de la carte dans l'air libre : c'est lui qui donne le passage en altitude
        let aloft = below;
        if (level == null || level <= top - MAP_LEVEL_GAP) {
            aloft =
                (cold
                    ? steepest(free, below, at + MAX_LEAN, -1, LOW_AIR_STEP)
                    : steepest(free, at - MAX_LEAN, below, 1, LOW_AIR_STEP)) ?? below;
            surface.push({ z: top, ts: cols[aloft].ts });
        }
        add(
            kind,
            window,
            change(massTemp, i, window)?.d ?? 0,
            signature(i, j),
            mid,
            aloft,
            at,
            surface,
            motion,
        );
    };

    if (map) {
        // --- Fronts de la carte : elle dit qu'un front passe et quand, le lieu dit où il passe au sol
        for (const m of map) {
            const i = indexOf.get(m.from);
            const j = indexOf.get(m.to);
            const mid = indexOf.get(m.ts);
            const pass = indexOf.get(m.passage);
            if (i == null || j == null || mid == null || pass == null) continue;
            // Au sol, le front froid passe avant d'atteindre le niveau de la carte, le front chaud après
            const span: [number, number] =
                m.kind === 'cold' ? [mid - MAP_GROUND, mid] : [mid, mid + MAP_GROUND];
            place(m.kind, m.window, [i, j, mid, pass], span, m.z, {
                speed: m.speed,
                bearing: m.bearing,
            });
        }
    } else {
        // --- Sans la carte : l'air du lieu change en 6 h (front franc), sinon en 12 h (front lent)
        for (const speed of [CHANGE.fast, CHANGE.slow]) {
            const changes = cols.map((_, i) => change(mass, i, speed.window));
            changes.forEach((w, i) => {
                // Une seule fenêtre par front : la plus forte variation de même sens à ±6 h
                if (!w || Math.abs(w.d) < speed.thetaE || !strongest(changes, i, FRONT_WINDOW))
                    return;
                const sign = Math.sign(w.d);
                const kind = sign < 0 ? 'cold' : 'warm';
                const temp = change(massTemp, i, speed.window);
                if (!temp || temp.d * sign < speed.temp) return;
                const mid = steepest(mass, i + 1, w.j - 1, sign) ?? i + 1;
                // Front lent : pas celui qu'un changement franc a déjà donné
                if (speed === CHANGE.slow && taken(mid - SAME_FRONT, mid + SAME_FRONT, kind))
                    return;
                const sig = signature(i, w.j);
                const brought = (sig.advection ?? 0) * sign;
                if (
                    sign < 0
                        ? brought < COLD.advection
                        : brought < WARM.advection || sig.cloud < WARM.cloud
                )
                    return;
                // Au sol, le front froid passe avant d'atteindre l'air libre, le front chaud après
                const span: [number, number] =
                    sign < 0 ? [i - GROUND_LEAD, w.j] : [i, w.j + GROUND_LAG];
                const pass = edgeOf(mass, mid, sign);
                place(kind, speed.window, [i, w.j, mid, pass], span);
            });
        }
    }

    // --- Occlusions : l'air libre gagne puis reperd quelques degrés, sans changement d'air près du sol
    for (let k = FRONT_WINDOW; k <= last - FRONT_WINDOW; k++) {
        const here = air[k];
        const span = air.slice(k - FRONT_WINDOW, k + FRONT_WINDOW + 1);
        if (here == null || span.some(v => v == null)) continue;
        const temps = span as number[];
        // Sommet de la langue d'air chaud : plus haute température à ±6 h (la première en cas d'égalité)
        if (temps.some((v, j) => v > here || (v === here && j < FRONT_WINDOW))) continue;
        const rise = here - Math.min(...temps.slice(0, FRONT_WINDOW));
        const fall = here - Math.min(...temps.slice(FRONT_WINDOW + 1));
        if (rise < OCCLUDED.swing || fall < OCCLUDED.swing) continue;
        const before = lowTemp[k - FRONT_WINDOW];
        const after = lowTemp[k + FRONT_WINDOW];
        if (before == null || after == null || Math.abs(after - before) >= OCCLUDED.lowChange)
            continue;
        if (taken(k - 2 * FRONT_WINDOW, k + 2 * FRONT_WINDOW)) continue;
        // Pluie et nuages de la langue elle-même, sans marge
        const during = cols.slice(k - FRONT_WINDOW, k + FRONT_WINDOW + 1);
        const layerRain = during.reduce((s, c) => s + (c.showerBase == null ? c.precip : 0), 0);
        if (
            layerRain < OCCLUDED.rain ||
            Math.max(...during.map(c => c.cloudCover)) < OCCLUDED.cloud
        )
            continue;
        const upright = [cols[k].ground, cols[k].ground + FRONT_ALOFT].map(z => ({
            z,
            ts: cols[k].ts,
        }));
        add(
            'occluded',
            FRONT_WINDOW,
            rise,
            signature(k - FRONT_WINDOW, k + FRONT_WINDOW),
            k,
            k,
            k,
            upright,
        );
    }

    return fronts.sort((a, b) => a.at.ts - b.at.ts).map(({ mid: _mid, ...front }) => front);
};

/**
 * Sortes de front qui passent au sol chaque jour local (clé de dayKey), dans l'ordre de leur passage
 * et sans doublon : de quoi signaler le jour dans la liste des jours
 */
export const frontDays = (fronts: Front[]): Map<string, Front['kind'][]> => {
    const days = new Map<string, Front['kind'][]>();
    for (const f of fronts) {
        const key = dayKey(f.at.ts, f.at.utcOffset);
        const kinds = days.get(key) ?? [];
        if (!kinds.includes(f.kind)) kinds.push(f.kind);
        days.set(key, kinds);
    }
    return days;
};
