/** Petits utilitaires de dessin SVG partagés par le graphique et l'émagramme */

export type Pt = { x: number; y: number };

/**
 * Courbe lissée (Catmull-Rom convertie en Bézier cubiques) passant par tous les points.
 * Les `null` coupent la courbe en plusieurs segments.
 */
export const smoothPath = (points: (Pt | null)[], tension = 0.5): string => {
    const segments: Pt[][] = [[]];
    for (const p of points) {
        if (p) segments[segments.length - 1].push(p);
        else if (segments[segments.length - 1].length) segments.push([]);
    }

    const f = (v: number) => v.toFixed(1);
    return segments
        .filter(s => s.length)
        .map(s => {
            if (s.length === 1) return `M${f(s[0].x - 3)},${f(s[0].y)}h6`;
            let d = `M${f(s[0].x)},${f(s[0].y)}`;
            for (let i = 0; i < s.length - 1; i++) {
                const p0 = s[i - 1] ?? s[i];
                const p1 = s[i];
                const p2 = s[i + 1];
                const p3 = s[i + 2] ?? p2;
                const k = tension / 3;
                const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
                const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
                d += `C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(p2.x)},${f(p2.y)}`;
            }
            return d;
        })
        .join('');
};

/** Flèche pleine pointant vers le haut (à tourner), longueur totale `len`, centrée sur 0,0 */
export const arrowPath = (len: number, head = 6, headW = 4, shaftW = 1.1): string => {
    const t = -len / 2;
    const b = len / 2;
    const h = Math.min(head, len * 0.55);
    return `M0,${t}L${headW},${t + h}L${shaftW},${t + h}L${shaftW},${b}L${-shaftW},${b}L${-shaftW},${t + h}L${-headW},${t + h}Z`;
};

/**
 * Symboles d'un front posés sur son trait, un en chaque point de `at` : triangles (front froid),
 * demi-cercles (front chaud) ou les deux en alternance (occlusion), de demi-hauteur `r`. Le trait
 * va du point `from` (au sol) au point `to` (en altitude), droit ou penché ; les symboles sont du
 * côté gauche, celui des heures qui précèdent.
 */
export const frontPips = (
    kind: 'cold' | 'warm' | 'occluded',
    from: Pt,
    to: Pt,
    at: Pt[],
    r = 5,
): string => {
    const f = (v: number) => v.toFixed(1);
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    // Le long du trait vers le haut, et perpendiculaire vers la gauche
    const tx = ((to.x - from.x) / len) * r;
    const ty = ((to.y - from.y) / len) * r;
    return at
        .map((p, k) => {
            const lo = `${f(p.x - tx)},${f(p.y - ty)}`;
            const hi = `${f(p.x + tx)},${f(p.y + ty)}`;
            return kind === 'cold' || (kind === 'occluded' && k % 2 === 0)
                ? `M${hi}L${f(p.x + ty * 1.5)},${f(p.y - tx * 1.5)}L${lo}Z`
                : `M${hi}A${r},${r} 0 0 0 ${lo}Z`;
        })
        .join('');
};

/**
 * Couche de nuage vue de côté, de `x0` à `x1` : base plate à `yBase`, sommet bourgeonnant dont les
 * bosses, de largeurs et de hauteurs inégales, culminent à `yTop`. `fill` : la couche fermée ;
 * `edge` : son sommet seul, pour en tracer le contour.
 */
export const cloudBand = (x0: number, x1: number, yBase: number, yTop: number) => {
    const f = (v: number) => v.toFixed(1);
    // Une couche mince garde des bosses à sa mesure
    const bump = Math.min(12, Math.max(0, yBase - yTop) * 0.6);
    const widths = [1, 0.7, 1.2, 0.85, 1.1, 0.65];
    const heights = [1, 0.7, 0.9, 0.75, 1, 0.6];
    const n = Math.max(1, Math.round((x1 - x0) / Math.max(bump * 2.4, 8)));
    let total = 0;
    for (let i = 0; i < n; i++) total += widths[i % widths.length];
    const yb = yTop + bump;
    let edge = `M${f(x0)},${f(yb)}`;
    let x = x0;
    for (let i = 0; i < n; i++) {
        const w = (widths[i % widths.length] / total) * (x1 - x0);
        x += w;
        edge += `A${f(w / 2)},${f(bump * heights[i % heights.length])} 0 0 1 ${f(x)},${f(yb)}`;
    }
    return { fill: `${edge}L${f(x1)},${f(yBase)}L${f(x0)},${f(yBase)}Z`, edge };
};

/**
 * Bourgeons des flancs d'un cumulus, du bas vers le haut : hauteur `h` (part de la largeur du
 * nuage) et saillie `out` (part de sa demi-largeur). Deux suites différentes, pour que les deux
 * flancs ne se répondent pas
 */
const CU_LEFT = [
    { h: 0.75, out: 0.06 },
    { h: 1.1, out: -0.07 },
    { h: 0.55, out: 0.08 },
    { h: 0.9, out: -0.03 },
    { h: 0.65, out: 0.05 },
];
const CU_RIGHT = [
    { h: 1.05, out: -0.05 },
    { h: 0.6, out: 0.08 },
    { h: 0.85, out: -0.08 },
    { h: 0.5, out: 0.04 },
    { h: 1, out: -0.02 },
];

/**
 * Silhouette d'un cumulus : base plate à `yBase`, flancs bourgeonnants qui se resserrent un peu en
 * montant, sommet en chou-fleur à `yBase - h`. Largeur `w`, centré sur `cx`. Elle convient aussi
 * bien à un petit cumulus aplati qu'à une tour de plusieurs kilomètres.
 */
export const cumulusPath = (cx: number, yBase: number, w: number, h: number): string => {
    const f = (v: number) => v.toFixed(1);
    const half = w / 2;
    const yTop = yBase - h;
    // Chou-fleur du sommet : trois bourgeons, celui du milieu plus haut. Il prend au plus la moitié
    // de la largeur en hauteur ; le reste du nuage, ce sont les flancs
    const crown = Math.min(h, w * 0.5);
    const flank = yBase - yTop - crown * 0.62;

    /**
     * Bourgeons d'un flanc, du bas vers l'épaule : de hauteurs inégales (0,5 à 1,1 largeur), plus
     * ou moins saillants. Le nuage perd un cinquième de sa largeur en montant
     */
    const side = (sign: 1 | -1) => {
        const sizes = sign < 0 ? CU_LEFT : CU_RIGHT;
        const points: Pt[] = [];
        for (let k = 0, up = 0; up < flank; k++) {
            up = Math.min(flank, up + w * sizes[k % sizes.length].h);
            // Un dernier bourgeon trop court rejoint le précédent
            if (flank - up < w * 0.3) up = flank;
            const t = flank ? up / flank : 1;
            const out = up < flank ? sizes[k % sizes.length].out : 0;
            points.push({ x: cx + sign * half * (1 - 0.2 * t) * (1 + out), y: yBase - up });
        }
        return points;
    };
    const points: Pt[] = [
        { x: cx - half * 0.84, y: yBase },
        ...side(-1),
        { x: cx - w * 0.19, y: yTop + crown * 0.25 },
        { x: cx + w * 0.21, y: yTop + crown * 0.3 },
        ...side(1).reverse(),
        { x: cx + half * 0.84, y: yBase },
    ];

    // Un arc bombé vers l'extérieur d'un point au suivant, presque un demi-cercle pour un petit
    // bourgeon, plus tendu pour un long, puis la base plate
    let d = `M${f(points[0].x)},${f(points[0].y)}`;
    for (let k = 1; k < points.length; k++) {
        const chord = Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y);
        const r = chord * (0.54 + 0.28 * Math.min(1, Math.max(0, (chord / w - 0.45) / 0.55)));
        d += `A${f(r)},${f(r)} 0 0 1 ${f(points[k].x)},${f(points[k].y)}`;
    }
    return `${d}Z`;
};

/**
 * Valeur d'une courbe lissée (Catmull-Rom, sans dépassement entre deux points) qui passe par les
 * points d'abscisses `xs` croissantes et d'ordonnées `ys`, à l'abscisse `x` ; au-delà du premier et
 * du dernier point, la valeur de ce point.
 */
export const smoothAt = (xs: number[], ys: number[], x: number): number => {
    const last = xs.length - 1;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[last]) return ys[last];
    let i = 0;
    while (i < last - 1 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
    const p0 = ys[Math.max(0, i - 1)];
    const p1 = ys[i];
    const p2 = ys[i + 1];
    const p3 = ys[Math.min(last, i + 2)];
    const v =
        0.5 *
        (2 * p1 +
            (p2 - p0) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
            (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
    return Math.min(Math.max(v, Math.min(p1, p2)), Math.max(p1, p2));
};

/** Largeur des bourgeons du sommet d'une masse nuageuse (part de la taille d'un bourgeon), à la suite */
const MASS_TOP = [0.62, 0.42, 0.7, 0.5, 0.58, 0.38, 0.66];

/**
 * Silhouette d'une masse de nuages qui dure plusieurs heures (nuages d'averses d'heures qui se
 * suivent) : une seule forme de la première à la dernière heure, au lieu d'une tour par heure. Aux
 * abscisses `xs` (une par heure), `bases` et `tops` donnent la base et le sommet (px) ; d'une heure
 * à l'autre, ils sont reliés par une courbe lissée. La masse dépasse de `half` (px) la première et
 * la dernière heure. Base lisse, flancs et sommet bourgeonnants ; `unit` : taille (px) d'un
 * bourgeon. `d` : le contour fermé ; `base` : la ligne de base seule.
 */
export const cloudMassPath = (
    xs: number[],
    bases: number[],
    tops: number[],
    half: number,
    unit: number,
): { d: string; base: string } => {
    const f = (v: number) => v.toFixed(1);
    const x0 = xs[0] - half;
    const x1 = xs[xs.length - 1] + half;
    const yBase = (x: number) => smoothAt(xs, bases, x);
    // Le sommet reste au moins un bourgeon au-dessus de la base
    const yTop = (x: number) => Math.min(smoothAt(xs, tops, x), yBase(x) - unit * 0.6);

    // Bourgeons bombés vers l'extérieur, d'un point au suivant (voir cumulusPath)
    const arcs = (points: Pt[]) =>
        points
            .slice(1)
            .map((p, k) => {
                const chord = Math.hypot(p.x - points[k].x, p.y - points[k].y);
                const r =
                    chord * (0.54 + 0.28 * Math.min(1, Math.max(0, (chord / unit - 0.45) / 0.55)));
                return `A${f(r)},${f(r)} 0 0 1 ${f(p.x)},${f(p.y)}`;
            })
            .join('');

    // Flanc : de la base à l'épaule, en bourgeons de hauteurs inégales, plus ou moins saillants
    const flank = (x: number, sign: 1 | -1) => {
        const sizes = sign < 0 ? CU_LEFT : CU_RIGHT;
        const yb = yBase(x);
        const rise = yb - (yTop(x) + unit * 0.2);
        const points: Pt[] = [];
        for (let k = 0, up = 0; up < rise; k++) {
            up = Math.min(rise, up + unit * sizes[k % sizes.length].h);
            if (rise - up < unit * 0.3) up = rise;
            const out = up < rise ? sizes[k % sizes.length].out : 0;
            points.push({ x: x + sign * unit * 0.5 * out, y: yb - up });
        }
        return points;
    };

    // Sommet : bourgeons de largeurs inégales, dont les creux suivent le sommet de chaque heure
    const crown: Pt[] = [];
    for (let k = 0, x = x0; x < x1; k++) {
        x = Math.min(x1, x + unit * MASS_TOP[k % MASS_TOP.length]);
        if (x1 - x < unit * 0.3) x = x1;
        if (x < x1) crown.push({ x, y: yTop(x) + unit * 0.2 });
    }

    const outline: Pt[] = [
        { x: x0, y: yBase(x0) },
        ...flank(x0, -1),
        ...crown,
        ...flank(x1, 1).reverse(),
        { x: x1, y: yBase(x1) },
    ];
    // Base, de la droite vers la gauche
    let base = `M${f(x1)},${f(yBase(x1))}`;
    for (let x = x1 - 3; x > x0; x -= 3) base += `L${f(x)},${f(yBase(x))}`;
    base += `L${f(x0)},${f(yBase(x0))}`;
    return {
        d: `M${f(outline[0].x)},${f(outline[0].y)}${arcs(outline)}${base.slice(base.indexOf('L'))}Z`,
        base,
    };
};
