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
 * « Bourgeons » d'un cumulus, du bas vers le haut : cercles empilés dont les plus bas débordent
 * sous la base (à rogner pour obtenir une base plate). La tour s'affine vers le sommet, ce qui
 * donne une silhouette réaliste aussi bien aux petits cumulus qu'aux gros développements.
 * Base à `yBase`, sommet à `yBase - h`, largeur `w`, centré sur `cx`.
 */
export const cumulusPuffs = (cx: number, yBase: number, w: number, h: number) => {
    const r0 = w * 0.3;
    const rows = Math.max(1, Math.round((h - r0) / (r0 * 1.5)));
    const puffs: { x: number; y: number; r: number }[] = [];
    for (let k = 0; k < rows; k++) {
        const t = rows === 1 ? 0 : k / (rows - 1);
        // Corps qui s'affine à peine, sommet arrondi en « chou-fleur »
        const shrink = 1 - 0.15 * t;
        const r = r0 * shrink;
        const yc = yBase - r0 * 0.55 - t * Math.max(0, h - r0 * 0.55 - r * 1.1);
        const dx = (k % 2 ? 0.05 : -0.04) * w;
        if (k === rows - 1) {
            puffs.push({ x: cx - 0.24 * w + dx, y: yc + r * 0.12, r: r * 0.92 });
            puffs.push({ x: cx + 0.23 * w + dx, y: yc + r * 0.18, r: r * 0.86 });
            puffs.push({ x: cx + dx, y: yc - r * 0.28, r: r * 1.12 });
        } else {
            puffs.push({ x: cx - 0.2 * w * shrink + dx, y: yc, r });
            puffs.push({ x: cx + 0.21 * w * shrink + dx, y: yc + r * 0.1, r: r * 0.97 });
        }
    }
    return puffs;
};
