/**
 * Meilleur départ pour un cross, en distance libre ou en aller-retour.
 *
 * Pour chaque point d'une grille, on simule le vol d'un parapente parti de là : heure par heure,
 * il avance à sa vitesse de cross (spirales dans les thermiques puis transitions, théorie de
 * MacCready) dans une direction fixe, et le vent de la couche thermique le pousse ou le freine.
 * Le vol s'arrête quand les thermiques s'éteignent (plus d'ascendance exploitable, pluie, mer,
 * fin de journée), après une dernière transition. On essaie 16 caps et on garde le plus long.
 * En aller-retour, on essaie aussi l'heure du demi-tour, le retour visant le décollage.
 * C'est une estimation à partir du modèle : ni relief fin, ni brises, ni espaces aériens.
 */

import { CIRCLING_SINK, CORE_FACTOR, type Column, toKmh, windAt } from './physics';
import { CARDINALS, clockText } from './i18n';
import { type GridSpec, mercY, usableTop } from './xc';

/** Heures locales simulées (premier décollage possible → fin des thermiques) */
export const XC_HOURS: readonly [number, number] = [8, 20];
const N_HOURS = XC_HOURS[1] - XC_HOURS[0] + 1;

/** Profil d'un parapente EN-B / EN-C moyen */
const GLIDE_SPEED_KMH = 35;
/** Taux de chute en transition, y compris les dégueulantes (m/s) */
const GLIDE_SINK = 1.4;
/** Hauteur exploitable (m sol) : rien en dessous, pleinement exploitable au-delà */
const MIN_DEPTH = 300;
const FULL_DEPTH = 1500;
/** Vent moyen dans la couche thermique (km/h) qui commence à casser les thermiques, puis les rend inexploitables */
const WIND_BREAK: readonly [number, number] = [20, 45];
/** Vitesse de cross minimale (km/h) pour décoller et partir */
const MIN_LAUNCH_SPEED = 6;
/** En dessous de cette vitesse (km/h), plus de thermique exploitable : dernière transition */
const MIN_FLY_SPEED = 2;
/** Dernière transition quand les thermiques s'arrêtent (km, depuis ~1000 m sol à finesse 7) */
const FINAL_GLIDE_KM = 6;
/** Pas de temps de la simulation (h) et nombre de caps essayés */
const STEP_H = 1 / 6;
const HEADINGS = 16;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (x: number, a: number, b: number) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};

/** Données horaires d'un point pour une journée : vitesse de cross en air calme et vent (km/h) */
export interface HourlyXc {
    /** Vitesse de cross « en air calme » (km/h), index = heure − 8 */
    s: number[];
    /** Vent moyen de la couche thermique, composantes est (u) et nord (v), km/h */
    u: number[];
    v: number[];
}

/** Vent moyen (vecteur, km/h) entre le sol et le plafond exploitable */
const layerWind = (c: Column, top: number) => {
    let u = 0;
    let v = 0;
    let n = 0;
    for (let z = c.ground + 50; z <= Math.max(top, c.ground + 60); z += 100) {
        const w = windAt(c.profile, z);
        if (!w) continue;
        const kmh = toKmh(w.speed);
        // Direction météo (d'où vient le vent) → vecteur vers où il va
        u += -kmh * Math.sin((w.dir * Math.PI) / 180);
        v += -kmh * Math.cos((w.dir * Math.PI) / 180);
        n++;
    }
    return n ? { u: u / n, v: v / n } : { u: 0, v: 0 };
};

/** Vitesse de cross en air calme (km/h) pour un pas de temps, 0 si pas de thermique exploitable */
export const xcAirSpeed = (c: Column): { s: number; u: number; v: number } => {
    const top = usableTop(c);
    const wind = layerWind(c, top ?? c.ground + 500);
    if (top == null) return { s: 0, ...wind };
    const depth = top - c.ground;
    if (depth < MIN_DEPTH || c.precip >= 0.5) return { s: 0, ...wind };
    const climb = CORE_FACTOR * c.wStar - CIRCLING_SINK;
    if (climb <= 0.05) return { s: 0, ...wind };

    let s = (GLIDE_SPEED_KMH * climb) / (climb + GLIDE_SINK);
    // Plafond bas : transitions plus courtes, plus de temps à remonter
    s *= 0.25 + 0.75 * smooth(depth, MIN_DEPTH, FULL_DEPTH);
    // Vent fort : thermiques hachés, puis inexploitables
    s *= 1 - smooth(Math.hypot(wind.u, wind.v), WIND_BREAK[0], WIND_BREAK[1]);
    // Cumulus très développés (congestus, risque d'orage) et averses
    const cuDepth = c.cuBase != null && c.cuTop != null ? c.cuTop - c.cuBase : 0;
    s *= 1 - 0.7 * smooth(cuDepth, 2500, 5000);
    if (c.precip >= 0.1) s *= 0.4;
    return { s, ...wind };
};

/** Données horaires d'une journée (colonnes horaires ou tri-horaires, heures manquantes interpolées) */
export const hourlyXc = (dayCols: Column[]): HourlyXc => {
    const known = new Map<number, { s: number; u: number; v: number }>();
    for (const c of dayCols) {
        if (c.hour >= XC_HOURS[0] && c.hour <= XC_HOURS[1]) known.set(c.hour, xcAirSpeed(c));
    }
    const hours = [...known.keys()].sort((a, b) => a - b);
    const out: HourlyXc = { s: [], u: [], v: [] };
    for (let k = 0; k < N_HOURS; k++) {
        const h = XC_HOURS[0] + k;
        let val = known.get(h);
        if (!val && hours.length) {
            const before = hours.filter(x => x < h).pop();
            const after = hours.find(x => x > h);
            if (before != null && after != null) {
                const a = known.get(before)!;
                const b = known.get(after)!;
                const f = (h - before) / (after - before);
                val = { s: a.s + (b.s - a.s) * f, u: a.u + (b.u - a.u) * f, v: a.v + (b.v - a.v) * f };
            }
        }
        const r = (x: number) => Math.round(x * 10) / 10;
        out.s.push(r(val?.s ?? 0));
        out.u.push(r(val?.u ?? 0));
        out.v.push(r(val?.v ?? 0));
    }
    return out;
};

/** Données d'une grille entière pour un jour : `data[j * cols + i]` */
export interface XcField {
    grid: GridSpec;
    data: (HourlyXc | null)[];
}

/** Valeurs interpolées (espace bilinéaire, temps linéaire) ; null hors de la grille */
const sample = (field: XcField, lat: number, lon: number, t: number) => {
    const g = field.grid;
    const fi = ((lon - g.west) / (g.east - g.west)) * g.cols - 0.5;
    const yN = mercY(g.north);
    const yS = mercY(g.south);
    const fj = ((yN - mercY(lat)) / (yN - yS)) * g.rows - 0.5;
    if (fi < -0.5 || fi > g.cols - 0.5 || fj < -0.5 || fj > g.rows - 0.5) return null;

    const i0 = Math.max(0, Math.min(g.cols - 1, Math.floor(fi)));
    const j0 = Math.max(0, Math.min(g.rows - 1, Math.floor(fj)));
    const i1 = Math.min(g.cols - 1, i0 + 1);
    const j1 = Math.min(g.rows - 1, j0 + 1);
    const tx = Math.max(0, Math.min(1, fi - i0));
    const ty = Math.max(0, Math.min(1, fj - j0));

    const hk = Math.max(0, Math.min(N_HOURS - 1, t - XC_HOURS[0]));
    const k0 = Math.floor(hk);
    const k1 = Math.min(N_HOURS - 1, k0 + 1);
    const tk = hk - k0;

    let s = 0;
    let u = 0;
    let v = 0;
    let wsum = 0;
    const corners: [number, number, number][] = [
        [i0, j0, (1 - tx) * (1 - ty)],
        [i1, j0, tx * (1 - ty)],
        [i0, j1, (1 - tx) * ty],
        [i1, j1, tx * ty],
    ];
    for (const [i, j, w] of corners) {
        const d = field.data[j * g.cols + i];
        if (!d || w === 0) continue;
        s += w * (d.s[k0] + (d.s[k1] - d.s[k0]) * tk);
        u += w * (d.u[k0] + (d.u[k1] - d.u[k0]) * tk);
        v += w * (d.v[k0] + (d.v[k1] - d.v[k0]) * tk);
        wsum += w;
    }
    if (wsum < 0.25) return null;
    return { s: s / wsum, u: u / wsum, v: v / wsum };
};

/** Distance (km) entre deux points (haversine) */
export const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
};

/** Type de vol simulé */
export type XcMode = 'free' | 'outReturn';

export interface FlightResult {
    /**
     * Distance du vol (km). Distance libre : du départ à l'atterrissage, en ligne droite.
     * Aller-retour : double de la partie volée dans les deux sens (le double de l'aller si la
     * boucle est fermée).
     */
    km: number;
    /** Cap de l'aller (degrés, 0 = nord) */
    heading: number;
    /** Heure locale de décollage (h, décimale) et d'atterrissage */
    launch: number;
    landing: number;
    /** Trajectoire [lat, lon] */
    path: [number, number][];
    /** Le vol est sorti de la zone calculée : la distance réelle pourrait être plus grande */
    reachedEdge: boolean;
    /** Aller-retour : point de demi-tour, distance de l'aller et boucle fermée ou non */
    turn?: [number, number];
    outKm?: number;
    closed?: boolean;
}

type LegPoint = { la: number; lo: number; t: number };

/** Cap (degrés) pour aller d'un point à un autre (approximation plane, suffisante à cette échelle) */
const bearing = (la1: number, lo1: number, la2: number, lo2: number) => {
    const dx = (lo2 - lo1) * Math.cos((((la1 + la2) / 2) * Math.PI) / 180);
    const dy = la2 - la1;
    return (Math.atan2(dx, dy) * 180) / Math.PI;
};

/**
 * Vole une branche depuis (lat, lon) à l'heure t, au cap donné par `headingAt` (recalculé à chaque
 * pas), jusqu'à la fin des thermiques (puis dernière transition), la sortie de la zone, ou `stop`.
 * Positions enregistrées tous les pas de 10 min.
 */
const flyLeg = (
    field: XcField,
    lat: number,
    lon: number,
    t0: number,
    headingAt: (la: number, lo: number) => number,
    stop?: (la: number, lo: number) => boolean,
) => {
    let la = lat;
    let lo = lon;
    let t = t0;
    let edge = false;
    let stopped = false;
    const steps: LegPoint[] = [{ la, lo, t }];
    while (t < XC_HOURS[1]) {
        if (stop?.(la, lo)) {
            stopped = true;
            break;
        }
        const smp = sample(field, la, lo, t);
        if (!smp) {
            edge = true;
            break;
        }
        const heading = (headingAt(la, lo) * Math.PI) / 180;
        const hx = Math.sin(heading);
        const hy = Math.cos(heading);
        if (smp.s < MIN_FLY_SPEED) {
            // Plus de thermique : dernière transition dans la même direction
            la += (hy * FINAL_GLIDE_KM) / 111.2;
            lo += (hx * FINAL_GLIDE_KM) / (111.2 * Math.cos((la * Math.PI) / 180));
            steps.push({ la, lo, t });
            break;
        }
        const vx = smp.s * hx + smp.u;
        const vy = smp.s * hy + smp.v;
        la += (vy * STEP_H) / 111.2;
        lo += (vx * STEP_H) / (111.2 * Math.cos((la * Math.PI) / 180));
        t += STEP_H;
        steps.push({ la, lo, t });
    }
    return { steps, edge, stopped };
};

/** Première heure où les thermiques permettent de décoller et de partir depuis ce point */
const launchTime = (field: XcField, lat: number, lon: number): number | null => {
    for (let t = XC_HOURS[0]; t < XC_HOURS[1]; t += 0.25) {
        const smp = sample(field, lat, lon, t);
        if (smp && smp.s >= MIN_LAUNCH_SPEED) return t;
    }
    return null;
};

/** Trajectoire allégée (un point sur trois) pour l'affichage */
const toPath = (steps: LegPoint[]): [number, number][] =>
    steps.filter((_, k) => k % 3 === 0 || k === steps.length - 1).map(p => [p.la, p.lo]);

/** Meilleur vol en distance libre depuis un point : 16 caps fixes essayés */
export const bestFreeFlight = (field: XcField, lat: number, lon: number): FlightResult | null => {
    const launch = launchTime(field, lat, lon);
    if (launch == null) return null;
    let best: FlightResult | null = null;
    for (let k = 0; k < HEADINGS; k++) {
        const heading = (k * 360) / HEADINGS;
        const leg = flyLeg(field, lat, lon, launch, () => heading);
        const end = leg.steps[leg.steps.length - 1];
        const km = distanceKm(lat, lon, end.la, end.lo);
        if (!best || km > best.km) {
            best = { km, heading, launch, landing: end.t, path: toPath(leg.steps), reachedEdge: leg.edge };
        }
    }
    return best;
};

/** Distance (km) sous laquelle on considère être revenu au décollage */
const CLOSE_KM = 3;
/** Demi-tour essayé à chaque pas de simulation (10 min) */
const TURN_EVERY = 1;

/**
 * Meilleur aller-retour depuis un point : pour chaque cap d'aller, on essaie de faire demi-tour
 * toutes les 10 min, puis on revient vers le décollage. Seuls comptent les vols qui reviennent
 * vraiment au décollage (à moins de 3 km) : distance = 2 × l'aller.
 */
export const bestOutAndReturn = (field: XcField, lat: number, lon: number): FlightResult | null => {
    const launch = launchTime(field, lat, lon);
    if (launch == null) return null;
    const home = (la: number, lo: number) => bearing(la, lo, lat, lon);
    const atHome = (la: number, lo: number) => distanceKm(la, lo, lat, lon) < CLOSE_KM;

    let best: FlightResult | null = null;
    for (let k = 0; k < HEADINGS; k++) {
        const heading = (k * 360) / HEADINGS;
        const out = flyLeg(field, lat, lon, launch, () => heading);
        // Demi-tour possible à intervalles réguliers, tant que l'aller vole encore
        for (let m = TURN_EVERY; m < out.steps.length - 1; m += TURN_EVERY) {
            const turn = out.steps[m];
            const outKm = distanceKm(lat, lon, turn.la, turn.lo);
            if (best && 2 * outKm <= best.km) continue;
            const back = flyLeg(field, turn.la, turn.lo, turn.t, home, atHome);
            const end = back.steps[back.steps.length - 1];
            const remaining = distanceKm(end.la, end.lo, lat, lon);
            const closed = back.stopped || remaining < CLOSE_KM;
            // Retour inachevé (posé en route, fin des thermiques, sortie de la carte) : pas un aller-retour
            if (!closed) continue;
            const km = 2 * outKm;
            if (!best || km > best.km) {
                best = {
                    km,
                    heading,
                    launch,
                    landing: end.t,
                    // Trace bouclée jusqu'au décollage
                    path: [...toPath(out.steps.slice(0, m + 1)), ...toPath(back.steps).slice(1), [lat, lon]],
                    reachedEdge: out.edge || back.edge,
                    turn: [turn.la, turn.lo],
                    outKm,
                    closed,
                };
            }
        }
    }
    return best;
};

/** Meilleur vol depuis un point selon le type de vol choisi */
export const bestFlight = (field: XcField, lat: number, lon: number, mode: XcMode = 'free') =>
    mode === 'outReturn' ? bestOutAndReturn(field, lat, lon) : bestFreeFlight(field, lat, lon);

/** Cap (degrés) → direction cardinale */
export const headingName = (deg: number) => CARDINALS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

/** Heure décimale → « 11h15 » (« 11:15 » en anglais) */
export const hourLabel = (h: number) => {
    const total = Math.round(h * 60);
    return clockText(Math.floor(total / 60), total % 60);
};

// ---------------------------------------------------------------------------
// Couleurs de la carte (distance en km)
// ---------------------------------------------------------------------------

type RGBA = [number, number, number, number];

const KM_STOPS: [number, RGBA][] = [
    [5, [254, 249, 195, 0]],
    [15, [254, 240, 138, 100]],
    [30, [253, 224, 71, 135]],
    [60, [251, 146, 60, 155]],
    [100, [239, 68, 68, 165]],
    [150, [219, 39, 119, 172]],
    [200, [162, 28, 175, 178]],
    [300, [124, 58, 237, 185]],
    [400, [76, 29, 149, 190]],
];

/** Valeurs montrées dans la légende */
export const KM_LEGEND = [15, 30, 60, 100, 150, 200, 300];

export const kmRGBA = (km: number): RGBA => {
    if (!(km > KM_STOPS[0][0])) return KM_STOPS[0][1];
    for (let i = 0; i < KM_STOPS.length - 1; i++) {
        const [v0, c0] = KM_STOPS[i];
        const [v1, c1] = KM_STOPS[i + 1];
        if (km <= v1) {
            const f = (km - v0) / (v1 - v0);
            return c0.map((c, k) => Math.round(c + (c1[k] - c) * f)) as RGBA;
        }
    }
    return KM_STOPS[KM_STOPS.length - 1][1];
};

export const kmColor = (km: number) => {
    const [r, g, b] = kmRGBA(Math.max(km, 15));
    return `rgb(${r},${g},${b})`;
};
