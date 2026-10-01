/**
 * Bulletin de vol d'une journée : l'essentiel de la prévision du modèle, sous forme de faits
 * chiffrés (force des conditions heure par heure, créneaux, vent, thermiques, ciel, passages de
 * front). Les phrases sont écrites par Bulletin.svelte.
 *
 * Le bulletin décrit des conditions, jamais un niveau de pilote ni une aptitude à voler : ni
 * « débutant », ni « confirmé », ni « volable ».
 */

import {
    type Column,
    interpProfile,
    type StormWatch,
    stormWatchOf,
    sunElevation,
    type ThermalEase,
    thermalEase,
    toKmh,
    uvToWind,
    windAt,
} from './physics';

const HOUR = 3600e3;

// ---------------------------------------------------------------------------
// Force des conditions de chaque heure
// ---------------------------------------------------------------------------

/** Conditions d'une heure : 0 calmes, 1 modérées, 2 fortes, 3 défavorables (vent très fort, pluie, orage) */
export type Level = 0 | 1 | 2 | 3;

/**
 * Ce qui impose le niveau d'une heure : orage, vent (au sol ou dans les basses couches), rafales,
 * pluie, force des thermiques, thermiques hachés par le vent, surdéveloppement
 */
export type Limit = 'storm' | 'wind' | 'gust' | 'rain' | 'thermal' | 'choppy' | 'overdev';

/**
 * Seuils à partir desquels les conditions sont modérées, fortes puis défavorables (en dessous du
 * premier : calmes), en km/h : vent à 10 m, vent le plus fort des basses couches, rafales du modèle
 */
export const WIND_LIMITS = [10, 15, 25] as const;
export const LOW_WIND_LIMITS = [15, 20, 30] as const;
export const GUST_LIMITS = [20, 30, 40] as const;
/** Montée au vario (m/s) à partir de laquelle les thermiques ne sont plus calmes, puis sont forts */
export const CLIMB_LIMITS = [1, 2.5] as const;
/** Épaisseur (m au-dessus du sol) des basses couches, où se trouvent les décollages */
export const LOW_LAYER = 1000;
/** Pluie (mm/h) à partir de laquelle les conditions d'une heure sont défavorables */
const RAIN = 0.1;
/**
 * Un orage est mal daté : les 2 h qui précèdent et qui suivent un orage probable sont
 * défavorables, et à moins de 4 h d'un orage les conditions ne sont plus calmes
 */
const STORM_MARGIN = 2;
const STORM_APPROACH = 4;
/** Durée minimale d'un créneau (h) */
const MIN_SLOT = 2;

export interface HourRating {
    col: Column;
    /** Le soleil est levé au milieu de l'heure */
    daylight: boolean;
    level: Level;
    /** Ce qui impose ce niveau ; null pour une heure calme */
    limit: Limit | null;
    /** Vent le plus fort des basses couches, du sol à LOW_LAYER (m/s) */
    lowWind: number;
}

/** Niveau d'une valeur : nombre de seuils atteints */
const levelOf = (value: number, limits: readonly number[]) => limits.filter(l => value >= l).length as Level;

/** Vent le plus fort (m/s) entre le sol et LOW_LAYER, tous les 250 m */
const lowLayerWind = (c: Column) => {
    let max = c.windSurf;
    for (let z = c.ground + 250; z <= c.ground + LOW_LAYER; z += 250) {
        max = Math.max(max, windAt(c.profile, z)?.speed ?? 0);
    }
    return max;
};

/**
 * Conditions de chaque heure (`cols` : heures qui se suivent). Le niveau est celui du
 * facteur le plus exigeant ; à égalité, le premier de la liste l'emporte (orage, vent, rafales,
 * pluie, thermiques, thermiques hachés, surdéveloppement).
 */
export const rateHours = (cols: Column[], lat: number, lon: number): HourRating[] =>
    cols.map(c => {
        const lowWind = lowLayerWind(c);
        const stormWithin = (h: number) => cols.some(o => o.stormRisk >= 2 && Math.abs(o.ts - c.ts) <= h * HOUR);
        const factors: [Limit, Level][] = [
            ['storm', stormWithin(STORM_MARGIN) ? 3 : stormWithin(STORM_APPROACH) ? 1 : 0],
            ['wind', Math.max(levelOf(toKmh(c.windSurf), WIND_LIMITS), levelOf(toKmh(lowWind), LOW_WIND_LIMITS)) as Level],
            ['gust', c.gust == null ? 0 : levelOf(toKmh(c.gust), GUST_LIMITS)],
            ['rain', c.precip >= RAIN ? 3 : 0],
            ['thermal', levelOf(c.climb, CLIMB_LIMITS)],
            ['choppy', c.choppy],
            ['overdev', c.stormRisk === 1 ? 2 : 0],
        ];
        const [limit, level] = factors.reduce((worst, f) => (f[1] > worst[1] ? f : worst));
        return {
            col: c,
            daylight: sunElevation(c.ts + HOUR / 2, lat, lon) > -0.833,
            level,
            limit: level ? limit : null,
            lowWind,
        };
    });

/** Créneau : de l'heure locale `from` à l'heure locale `to` (fin de la dernière heure : 24 pour minuit) */
export interface Slot {
    from: number;
    to: number;
    hours: number;
}

/** Créneaux d'au moins MIN_SLOT heures de jour consécutives qui satisfont `ok` */
const slotsOf = (hours: HourRating[], ok: (h: HourRating) => boolean): Slot[] => {
    const slots: Slot[] = [];
    let run: HourRating[] = [];
    const close = () => {
        if (run.length >= MIN_SLOT) {
            slots.push({ from: run[0].col.hour, to: run[run.length - 1].col.hour + 1, hours: run.length });
        }
        run = [];
    };
    hours.forEach((h, i) => {
        if (h.daylight && ok(h)) run.push(h);
        else close();
        // Fin de la série, ou trou dans les heures
        const after = hours[i + 1];
        if (!after || after.col.ts - h.col.ts !== HOUR) close();
    });
    return slots;
};

/**
 * Créneaux dont les conditions ne dépassent pas le niveau `max`. Ils suivent les cases du bandeau
 * des heures : une seule heure d'un niveau au-dessus coupe un créneau.
 */
const levelSlots = (hours: HourRating[], max: Level) => slotsOf(hours, h => h.level <= max);

// ---------------------------------------------------------------------------
// Passages de front
// ---------------------------------------------------------------------------

/**
 * Couche de l'air libre (m au-dessus du sol) dont la température suit la masse d'air : assez haut
 * pour échapper au cycle jour / nuit du sol
 */
const FREE_AIR: readonly [number, number] = [1500, 3000];
/** Durée (h) sur laquelle on mesure le changement de masse d'air */
const FRONT_WINDOW = 6;
/**
 * Seuils d'un front, calés sur GFS et ICON (16 sites d'Europe, trois semaines de septembre et
 * octobre 2026). Un refroidissement ou un réchauffement de l'air libre ne suffit pas (subsidence,
 * brises de montagne) : il faut la signature d'un front, pluie, nuages ou rotation du vent.
 * - front froid : −3 K en 6 h avec au moins 1 mm de pluie, ou avec un vent qui tourne d'au moins
 *   40° sous un ciel couvert, ou −3,5 K sous un ciel très nuageux (front sec) ; −2,5 K suffisent
 *   quand la pluie et une rotation d'au moins 30° sont là toutes les deux ;
 * - front chaud : +3 K en 6 h sous un ciel couvert, avec au moins 1 mm de pluie de nuages en
 *   couches (pas d'averses).
 */
const COLD = { drop: 3, weakDrop: 2.5, dryDrop: 3.5, rain: 1, veer: 40, weakVeer: 30, cloud: 0.8, dryCloud: 0.7 };
const WARM = { rise: 3, rain: 1, cloud: 0.8 };
/** Vent (m/s) en dessous duquel sa direction ne veut rien dire : 15 km/h */
const TURN_MIN_WIND = 15 / 3.6;
/** Heures comptées avant et après la fenêtre pour la pluie du front */
const FRONT_RAIN_MARGIN = 3;

export interface WindPart {
    /** Direction d'où vient le vent (°) et vitesse (m/s) */
    dir: number;
    speed: number;
}

export interface Front {
    kind: 'cold' | 'warm';
    /** Heure du passage : celle où l'air libre change le plus vite */
    at: Column;
    /** Variation de température de l'air libre sur 6 h (K) : négative pour un front froid */
    tempChange: number;
    /** Altitude (m AMSL) du vent donné avant et après le front */
    windZ: number;
    before: WindPart | null;
    after: WindPart | null;
    /** Le vent tourne nettement au passage du front (les deux vents dépassent 15 km/h) */
    turns: boolean;
    /** Pluie autour du passage (mm) */
    rain: number;
    /** Plus fortes rafales du modèle autour du passage (m/s) ; null s'il n'en fournit pas */
    gust: number | null;
}

/** Température moyenne de l'air libre (K) ; null si le profil ne monte pas assez haut */
const freeAirTemp = (c: Column): number | null => {
    let sum = 0;
    let n = 0;
    for (let z = c.ground + FREE_AIR[0]; z <= c.ground + FREE_AIR[1]; z += 500) {
        const t = interpProfile(c.profile, z, 't');
        if (t == null) continue;
        sum += t;
        n++;
    }
    return n ? sum / n : null;
};

/**
 * Passages de front de toute la prévision (`cols` : heures dans l'ordre), repérés par le changement
 * de masse d'air qu'ils apportent : la température de l'air libre varie d'au moins 2,5 à 3 K en
 * 6 h, avec la pluie, les nuages ou la rotation du vent d'un front (voir COLD et WARM). Un seul
 * point ne voit pas la carte : un front peu actif ou qui passe à côté peut manquer.
 */
export const frontsOf = (cols: Column[], lat: number): Front[] => {
    const air = cols.map(freeAirTemp);
    const indexOf = new Map(cols.map((c, i) => [c.ts, i]));
    /** Variation sur la fenêtre qui commence à l'heure i ; null si elle sort de la prévision */
    const change = (i: number) => {
        const j = indexOf.get(cols[i].ts + FRONT_WINDOW * HOUR);
        const a = air[i];
        const b = j == null ? null : air[j];
        return j == null || a == null || b == null ? null : { j, d: b - a };
    };
    const changes = cols.map((_, i) => change(i));

    const fronts: Front[] = [];
    changes.forEach((w, i) => {
        if (!w || Math.abs(w.d) < COLD.weakDrop) return;
        // Une seule fenêtre par front : la plus forte variation de même sens à ±6 h
        const stronger = (k: number) => {
            const o = changes[k];
            if (!o || Math.sign(o.d) !== Math.sign(w.d)) return false;
            return Math.abs(o.d) > Math.abs(w.d) || (Math.abs(o.d) === Math.abs(w.d) && k < i);
        };
        for (let k = Math.max(0, i - FRONT_WINDOW); k <= Math.min(cols.length - 1, i + FRONT_WINDOW); k++) {
            if (k !== i && stronger(k)) return;
        }

        const from = cols[i].ts - FRONT_RAIN_MARGIN * HOUR;
        const to = cols[w.j].ts + FRONT_RAIN_MARGIN * HOUR;
        const around = cols.filter(c => c.ts >= from && c.ts <= to);
        const rain = around.reduce((s, c) => s + c.precip, 0);
        const layerRain = around.reduce((s, c) => s + (c.showerBase == null ? c.precip : 0), 0);
        const cloud = Math.max(...cols.slice(i, w.j + 1).map(c => c.cloudCover));
        const gusts = around.map(c => c.gust).filter((g): g is number => g != null);

        const windZ = cols[i].ground + FREE_AIR[0];
        const before = windAt(cols[i].profile, windZ);
        const after = windAt(cols[w.j].profile, windZ);
        // Rotation dans le sens des aiguilles d'une montre dans l'hémisphère nord, inverse dans le sud
        let veer = 0;
        if (before && after && Math.min(before.speed, after.speed) >= TURN_MIN_WIND) {
            veer = (((after.dir - before.dir + 540) % 360) - 180) * (lat < 0 ? -1 : 1);
        }

        const drop = -w.d;
        let kind: Front['kind'] | null = null;
        if (
            (drop >= COLD.drop && (rain >= COLD.rain || (veer >= COLD.veer && cloud >= COLD.cloud))) ||
            (drop >= COLD.dryDrop && cloud >= COLD.dryCloud) ||
            (drop >= COLD.weakDrop && rain >= COLD.rain && veer >= COLD.weakVeer)
        ) {
            kind = 'cold';
        } else if (w.d >= WARM.rise && layerRain >= WARM.rain && cloud >= WARM.cloud) {
            kind = 'warm';
        }
        if (!kind) return;

        // Heure du passage : là où l'air libre change le plus vite (sur 2 h)
        let at = i + 1;
        let steepest = -Infinity;
        for (let k = i + 1; k < w.j; k++) {
            const a = air[k - 1];
            const b = air[k + 1];
            if (a == null || b == null) continue;
            const step = (b - a) * Math.sign(w.d);
            if (step > steepest) {
                steepest = step;
                at = k;
            }
        }
        fronts.push({
            kind,
            at: cols[at],
            tempChange: w.d,
            windZ,
            before,
            after,
            turns: Math.abs(veer) >= COLD.weakVeer,
            rain,
            gust: gusts.length ? Math.max(...gusts) : null,
        });
    });
    return fronts;
};

// ---------------------------------------------------------------------------
// Bulletin d'une journée
// ---------------------------------------------------------------------------

/** Heure locale à partir de laquelle on parle de l'après-midi */
const AFTERNOON = 13;
/** Un front passé dans les heures qui précèdent la journée laisse sa traîne ; un front des heures qui suivent s'annonce le soir */
const FRONT_BEFORE = 12;
const FRONT_AFTER = 6;
/** Ciel : part de nuages bas et moyens sous laquelle une couverture n'est qu'un voile d'altitude */
const VEIL_LOW_CLOUD = 0.3;

/** Vent d'une demi-journée (heures de jour) : matin, puis après-midi ; null sans heure de jour */
export interface WindHalves {
    am: WindPart | null;
    pm: WindPart | null;
}

export interface WindSummary {
    surface: WindHalves;
    /** Vent en altitude, à deux niveaux ronds au-dessus du site (m AMSL) */
    levels: ({ z: number } & WindHalves)[];
    /** Plus forte rafale du modèle aux heures de jour (m/s) et son heure locale */
    gust: { speed: number; hour: number } | null;
}

/** État du ciel d'une demi-journée */
export type Sky = 'clear' | 'partly' | 'cloudy' | 'overcast' | 'veil';
/** Étage de nuages du modèle : bas (sous 700 hPa), moyen (700–450 hPa), élevé (au-dessus) */
export type CloudDeck = 'low' | 'mid' | 'high';

/** Ciel d'une demi-journée (heures de jour) */
export interface SkyPart {
    sky: Sky;
    /** Couverture nuageuse totale moyenne (0–1) */
    cover: number;
    /** Étages où le modèle met des nuages (au moins 40 % en moyenne), du plus bas au plus haut */
    decks: CloudDeck[];
    /**
     * Altitude (m AMSL) des nuages les plus bas : niveau le plus bas couvert à 50 % au moins, quand
     * il y en a un la moitié des heures. Le modèle n'a que quelques niveaux : à quelques centaines
     * de mètres près.
     */
    base: number | null;
}

/** Épisode de précipitations : heures de pluie qui se suivent, à une heure sèche près */
export interface RainEpisode {
    /** De l'heure locale `from` à l'heure locale `to` (fin de la dernière heure de pluie) */
    from: number;
    to: number;
    /** Nombre d'heures de pluie, et cumul (mm) */
    hours: number;
    total: number;
    /** Heure la plus arrosée : intensité (mm/h) et heure locale */
    peak: number;
    peakHour: number;
    /** L'essentiel tombe en averses (nuages convectifs) plutôt qu'en pluie de nuages en couches */
    showers: boolean;
    /** L'essentiel tombe en neige */
    snow: boolean;
}

/** Précipitations de la journée : de la première à la dernière heure de pluie, et épisode par épisode */
export interface RainSummary extends RainEpisode {
    episodes: RainEpisode[];
    /** Limite pluie-neige (m AMSL) : 300 m sous l'isotherme 0 °C des heures de pluie ; null s'il est hors du profil */
    snowLine: number | null;
}

/** Cumulus des thermiques de la journée (m AMSL) */
export interface CumulusSummary {
    /** De la première à la dernière heure de cumulus (heures locales, `to` : fin) */
    from: number;
    to: number;
    /** Base la plus basse et la plus haute de la journée, sommet le plus haut */
    baseMin: number;
    baseMax: number;
    top: number;
    /** Le sommet dépasse le dernier niveau du modèle : il n'est qu'un minimum */
    capped: boolean;
    /** Plus grande épaisseur de la base au sommet (m) */
    depth: number;
}

export interface ThermalSummary {
    /** De la première à la dernière heure de thermiques exploitables (heures locales, `to` : fin) */
    from: number;
    to: number;
    hours: number;
    /** Heure locale de la meilleure montée, et cette montée au vario (m/s) */
    bestHour: number;
    climb: number;
    /** Plafond exploitable le plus haut (m AMSL) et sa hauteur au-dessus du sol (m) */
    ceiling: number;
    depth: number;
    /** Nombre d'heures par facilité d'exploitation */
    ease: Record<ThermalEase, number>;
    /** Créneau le plus long de thermiques faciles ; null s'il n'y en a pas */
    easy: Slot | null;
}

/**
 * Appréciation de la journée : conditions défavorables, fortes, orageuses, calmes à modérées par
 * créneaux seulement, belle ou bonne journée thermique, calme, ou modérée
 */
export type Verdict = 'adverse' | 'strong' | 'storm' | 'windows' | 'great' | 'thermal' | 'calm' | 'moderate';

export interface DayBulletin {
    /** Heures de la journée, avec le niveau de leurs conditions */
    hours: HourRating[];
    verdict: Verdict;
    /** Ce qui rend le plus souvent les heures de jour fortes ou défavorables, puis ce qui les empêche d'être calmes */
    strongLimit: Limit | null;
    calmLimit: Limit | null;
    /** Créneaux de conditions calmes (niveau 0) et créneaux de conditions calmes à modérées (niveaux 0 et 1) */
    calm: Slot[];
    moderate: Slot[];
    thermals: ThermalSummary | null;
    wind: WindSummary;
    sky: { am: SkyPart | null; pm: SkyPart | null };
    /** Cumulus des thermiques ; null sans cumulus */
    cumulus: CumulusSummary | null;
    /** Brume ou brouillard possible en début de matinée : air saturé au sol, sans vent ni pluie */
    fog: boolean;
    rain: RainSummary | null;
    /** Pluie des 24 h précédentes (mm) à la première heure de jour, quand elle a mouillé le sol ; null sinon */
    wetGround: number | null;
    /** Isotherme 0 °C en milieu de matinée et en milieu d'après-midi (m AMSL) ; null au-dessus du profil */
    freezingAm: number | null;
    freezing: number | null;
    /** Température au sol la plus basse et la plus haute de la journée (K) */
    tMin: number;
    tMax: number;
    /** Orage de la journée (toutes ses heures, passées ou non) */
    storm: StormWatch | null;
    /** Première heure locale de surdéveloppement, les jours sans orage probable */
    overdevFrom: number | null;
    /** Fronts qui passent dans la journée, dernier front froid des 12 h qui précèdent, premier front des 6 h qui suivent */
    fronts: Front[];
    frontBefore: Front | null;
    frontAfter: Front | null;
}

/** Vent moyen d'une série d'heures : direction du vecteur moyen, vitesse moyenne */
const meanWind = (cols: Column[], uvOf: (c: Column) => { u: number; v: number } | null): WindPart | null => {
    let su = 0;
    let sv = 0;
    let ss = 0;
    let n = 0;
    for (const c of cols) {
        const w = uvOf(c);
        if (!w) continue;
        su += w.u;
        sv += w.v;
        ss += Math.hypot(w.u, w.v);
        n++;
    }
    return n ? { dir: uvToWind(su / n, sv / n).dir, speed: ss / n } : null;
};

const uvAt = (z: number) => (c: Column) => {
    const u = interpProfile(c.profile, z, 'u');
    const v = interpProfile(c.profile, z, 'v');
    return u == null || v == null ? null : { u, v };
};

/** Plus forte nébulosité (0–1) des niveaux dont la pression (hPa) est dans ]pMin, pMax] */
const deckCloud = (c: Column, pMin: number, pMax: number) =>
    Math.max(0, ...c.profile.filter(p => p.p > pMin && p.p <= pMax).map(p => p.cloud / 100));

/** Nébulosité de chaque étage (0–1) ; l'étage élevé compte les cirrus au-dessus du profil */
const DECKS: Record<CloudDeck, (c: Column) => number> = {
    low: c => deckCloud(c, 700, Infinity),
    mid: c => deckCloud(c, 450, 700),
    high: c => Math.max(deckCloud(c, 0, 450), c.highCloud),
};
/** Couverture moyenne (0–1) à partir de laquelle un étage est cité, et nébulosité (%) d'un niveau « couvert » */
const DECK_COVER = 0.4;
const BASE_CLOUD = 50;

const skyOf = (cols: Column[]): SkyPart | null => {
    if (!cols.length) return null;
    const mean = (f: (c: Column) => number) => cols.reduce((s, c) => s + f(c), 0) / cols.length;
    const cover = mean(c => c.cloudCover);
    const lowMid = mean(c => Math.max(DECKS.low(c), DECKS.mid(c)));
    const sky: Sky =
        cover >= 0.5 && lowMid < VEIL_LOW_CLOUD
            ? 'veil'
            : cover < 0.25
              ? 'clear'
              : cover < 0.6
                ? 'partly'
                : cover < 0.85
                  ? 'cloudy'
                  : 'overcast';
    // Niveau couvert le plus bas de chaque heure (hors sol), puis médiane des heures qui en ont un
    const bases = cols
        .map(c => c.profile.find((p, k) => k > 0 && p.cloud >= BASE_CLOUD)?.z)
        .filter((z): z is number => z != null)
        .sort((a, b) => a - b);
    return {
        sky,
        cover,
        decks: (['low', 'mid', 'high'] as const).filter(d => mean(DECKS[d]) >= DECK_COVER),
        base: bases.length >= cols.length / 2 ? bases[Math.floor(bases.length / 2)] : null,
    };
};

const cumulusOf = (cols: Column[]): CumulusSummary | null => {
    const cu = cols.filter(c => c.cuBase != null);
    if (!cu.length) return null;
    const bases = cu.map(c => c.cuBase as number);
    const tops = cu.map(c => c.cuTop ?? (c.cuBase as number));
    const top = Math.max(...tops);
    return {
        from: cu[0].hour,
        to: cu[cu.length - 1].hour + 1,
        baseMin: Math.min(...bases),
        baseMax: Math.max(...bases),
        top,
        capped: cu.some(c => c.cuTopCapped && (c.cuTop ?? 0) >= top),
        depth: Math.max(...cu.map((c, k) => tops[k] - (c.cuBase as number))),
    };
};

/** Écart T − Td au sol (K) et vent (m/s) sous lesquels l'air du matin, s'il ne pleut pas, peut donner brume ou brouillard */
const FOG_SPREAD = 0.5;
const FOG_WIND = 3;
/** Dernière heure locale du début de matinée */
const EARLY_MORNING = 9;
/** Pluie des 24 h précédentes (mm) à partir de laquelle le sol est mouillé au lever du jour */
const WET_GROUND = 2;
/** La limite pluie-neige se tient environ 300 m sous l'isotherme 0 °C */
const SNOW_LINE_BELOW = 300;

/** Valeur la plus fréquente d'une liste ; null si elle est vide */
const mostCommon = <T>(items: T[]): T | null => {
    const counts = new Map<T, number>();
    for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
    let best: T | null = null;
    let n = 0;
    for (const [it, k] of counts) {
        if (k > n) {
            best = it;
            n = k;
        }
    }
    return best;
};

const thermalsOf = (hours: HourRating[], ground: number): ThermalSummary | null => {
    const eased = hours
        .map(h => ({ h, ease: thermalEase(h.col) }))
        .filter((e): e is { h: HourRating; ease: ThermalEase } => e.ease != null);
    if (!eased.length) return null;
    const cols = eased.map(e => e.h.col);
    const best = cols.reduce((a, c) => (c.climb > a.climb ? c : a));
    const top = cols.reduce((a, c) => ((c.ceiling ?? 0) > (a.ceiling ?? 0) ? c : a));
    const ease: Record<ThermalEase, number> = { easy: 0, weak: 0, low: 0, choppy: 0, rough: 0 };
    for (const e of eased) ease[e.ease]++;
    const easy = slotsOf(hours, h => thermalEase(h.col) === 'easy').sort((a, b) => b.hours - a.hours)[0] ?? null;
    const ceiling = top.ceiling ?? ground;
    return {
        from: cols[0].hour,
        to: cols[cols.length - 1].hour + 1,
        hours: cols.length,
        bestHour: best.hour,
        climb: best.climb,
        ceiling,
        depth: ceiling - ground,
        ease,
        easy,
    };
};

/** Heures de pluie (dans l'ordre) résumées en un épisode */
const episodeOf = (wet: Column[]): RainEpisode => {
    const total = wet.reduce((s, c) => s + c.precip, 0);
    const peak = wet.reduce((a, c) => (c.precip > a.precip ? c : a));
    return {
        from: wet[0].hour,
        to: wet[wet.length - 1].hour + 1,
        hours: wet.length,
        total,
        peak: peak.precip,
        peakHour: peak.hour,
        showers: wet.reduce((s, c) => s + (c.showerBase != null ? c.precip : 0), 0) >= total / 2,
        snow: wet.reduce((s, c) => s + c.snow, 0) >= total / 2,
    };
};

const rainOf = (cols: Column[]): RainSummary | null => {
    const wet = cols.filter(c => c.precip >= RAIN);
    if (!wet.length) return null;
    // Une seule heure sèche entre deux heures de pluie ne sépare pas deux épisodes
    const runs: Column[][] = [];
    for (const c of wet) {
        const run = runs[runs.length - 1];
        if (run && c.ts - run[run.length - 1].ts <= 2 * HOUR) run.push(c);
        else runs.push([c]);
    }
    const levels = wet.map(c => c.freezing).filter((z): z is number => z != null);
    return {
        ...episodeOf(wet),
        episodes: runs.map(episodeOf),
        snowLine: levels.length ? levels.reduce((s, z) => s + z, 0) / levels.length - SNOW_LINE_BELOW : null,
    };
};

/** Une bonne journée thermique : au moins 2 h de thermiques faciles, en conditions calmes ou modérées ; belle à partir de +2 m/s et 1 500 m de hauteur exploitable */
const GREAT_CLIMB = 2;
const GREAT_DEPTH = 1500;
/** Part des heures de jour dans un créneau calme à modéré sous laquelle la journée n'offre que des créneaux */
const WINDOWS_SHARE = 2 / 3;

const verdictOf = (day: HourRating[], moderate: Slot[], storm: StormWatch | null): Verdict => {
    if (day.filter(h => h.level <= 2).length < MIN_SLOT) return 'adverse';
    if (!moderate.length) return 'strong';
    if (storm && storm.level >= 2) return 'storm';
    if (moderate.reduce((n, s) => n + s.hours, 0) < day.length * WINDOWS_SHARE) return 'windows';
    const soarable = day.filter(h => h.level <= 1 && thermalEase(h.col) === 'easy').map(h => h.col);
    const climb = Math.max(0, ...soarable.map(c => c.climb));
    if (soarable.length >= MIN_SLOT && climb >= CLIMB_LIMITS[0]) {
        const depth = Math.max(0, ...soarable.map(c => (c.ceiling ?? c.ground) - c.ground));
        return climb >= GREAT_CLIMB && depth >= GREAT_DEPTH ? 'great' : 'thermal';
    }
    return day.filter(h => h.level === 0).length >= day.length / 2 ? 'calm' : 'moderate';
};

/**
 * Bulletin d'une journée (`cols` : ses heures, dans l'ordre) ; `fronts` : ceux de toute la
 * prévision (frontsOf). null sans heure de jour.
 */
export const bulletinOf = (cols: Column[], lat: number, lon: number, fronts: Front[] = []): DayBulletin | null => {
    const hours = rateHours(cols, lat, lon);
    const day = hours.filter(h => h.daylight);
    if (!day.length) return null;
    const dayCols = day.map(h => h.col);
    const ground = cols[0].ground;

    const am = dayCols.filter(c => c.hour < AFTERNOON);
    const pm = dayCols.filter(c => c.hour >= AFTERNOON);
    const halves = (uvOf: (c: Column) => { u: number; v: number } | null): WindHalves => ({
        am: meanWind(am, uvOf),
        pm: meanWind(pm, uvOf),
    });
    // Deux niveaux ronds : le premier multiple de 500 m à 700 m au moins au-dessus du sol, puis 1 000 m plus haut
    const z1 = Math.ceil((ground + 700) / 500) * 500;
    const gusty = dayCols.filter(c => c.gust != null);
    const maxGust = gusty.length ? gusty.reduce((a, c) => ((c.gust as number) > (a.gust as number) ? c : a)) : null;

    const storm = stormWatchOf(cols);
    const overdev = dayCols.find(c => c.stormRisk === 1);
    const thermals = thermalsOf(hours, ground);
    const nearest = (hour: number) => dayCols.reduce((a, c) => (Math.abs(c.hour - hour) < Math.abs(a.hour - hour) ? c : a));
    const early = dayCols.filter(c => c.hour <= EARLY_MORNING);

    const start = cols[0].ts;
    const end = cols[cols.length - 1].ts;
    const before = fronts.filter(f => f.kind === 'cold' && f.at.ts < start && f.at.ts >= start - FRONT_BEFORE * HOUR);

    const moderate = levelSlots(hours, 1);

    return {
        hours,
        verdict: verdictOf(day, moderate, storm),
        strongLimit: mostCommon(day.filter(h => h.level >= 2).map(h => h.limit)),
        calmLimit: mostCommon(day.filter(h => h.level >= 1).map(h => h.limit)),
        calm: levelSlots(hours, 0),
        moderate,
        thermals,
        wind: {
            surface: halves(c => c.profile[0]),
            levels: [z1, z1 + 1000].map(z => ({ z, ...halves(uvAt(z)) })).filter(l => l.am || l.pm),
            gust: maxGust ? { speed: maxGust.gust as number, hour: maxGust.hour } : null,
        },
        sky: { am: skyOf(am), pm: skyOf(pm) },
        cumulus: cumulusOf(dayCols),
        fog: early.some(c => c.td2m != null && c.t2m - c.td2m <= FOG_SPREAD && c.windSurf < FOG_WIND && c.precip < RAIN),
        rain: rainOf(cols),
        wetGround: dayCols[0].recentRain >= WET_GROUND ? dayCols[0].recentRain : null,
        freezingAm: nearest(10).freezing,
        freezing: nearest(15).freezing,
        tMin: Math.min(...cols.map(c => c.t2m)),
        tMax: Math.max(...cols.map(c => c.t2m)),
        storm,
        overdevFrom: storm && storm.level >= 2 ? null : overdev?.hour ?? null,
        fronts: fronts.filter(f => f.at.ts >= start && f.at.ts <= end),
        frontBefore: before[before.length - 1] ?? null,
        frontAfter: fronts.find(f => f.at.ts > end && f.at.ts <= end + FRONT_AFTER * HOUR) ?? null,
    };
};
