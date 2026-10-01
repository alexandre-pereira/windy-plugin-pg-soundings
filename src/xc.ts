/**
 * Grille de points de la carte des cross, image colorée posée sur la carte, et file de requêtes.
 */

export type RGBA = [number, number, number, number];

// ---------------------------------------------------------------------------
// Grille et image de la couche
// ---------------------------------------------------------------------------

export const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

export interface GridSpec {
    south: number;
    north: number;
    west: number;
    east: number;
    cols: number;
    rows: number;
}

/** Pas de grille « ronds » (degrés), pour que les points tombent toujours aux mêmes endroits */
const NICE_CELLS = [0.02, 0.025, 0.05, 0.1, 0.125, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 1, 1.5, 2];

/**
 * Grille régulière en projection Mercator (celle de la carte), pour que l'image posée sur la
 * carte tombe exactement sur les points calculés. Environ `target` points au total.
 *
 * Les points sont calés sur un quadrillage fixe du globe (pas « rond », multiples entiers) :
 * après un déplacement de la carte au même zoom, on retombe sur les mêmes points, déjà en cache.
 * Les points couvrent toute la zone demandée, bords compris (le premier et le dernier point de
 * chaque ligne tombent juste sur ou juste au-delà du bord) ; les bords de la grille sont les bords
 * des cellules extrêmes.
 */
export const makeGrid = (
    b: { south: number; north: number; west: number; east: number },
    target: number,
): GridSpec => {
    const w = b.east - b.west;
    const h = (mercY(b.north) - mercY(b.south)) * (180 / Math.PI);
    const raw = Math.sqrt((w * h) / target);
    const cell = NICE_CELLS.find(c => c >= raw * 0.85) ?? NICE_CELLS[NICE_CELLS.length - 1];

    const i0 = Math.floor(b.west / cell);
    const i1 = Math.max(i0, Math.ceil(b.east / cell));
    const yStep = (cell * Math.PI) / 180;
    const jTop = Math.ceil(mercY(b.north) / yStep);
    const jBottom = Math.min(jTop, Math.floor(mercY(b.south) / yStep));

    return {
        west: (i0 - 0.5) * cell,
        east: (i1 + 0.5) * cell,
        north: invMercY((jTop + 0.5) * yStep),
        south: invMercY((jBottom - 0.5) * yStep),
        cols: i1 - i0 + 1,
        rows: jTop - jBottom + 1,
    };
};

/** Coordonnées du point (i, j) : centre de la cellule, i en longitude, j en latitude (du nord au sud) */
export const gridPoint = (g: GridSpec, i: number, j: number) => {
    const lon = g.west + ((i + 0.5) / g.cols) * (g.east - g.west);
    const yN = mercY(g.north);
    const yS = mercY(g.south);
    const lat = invMercY(yN - ((j + 0.5) / g.rows) * (yN - yS));
    return { lat, lon };
};

/** Poids de Catmull-Rom pour les 4 voisins d'une position fractionnaire t ∈ [0, 1] */
const cubicWeights = (t: number): [number, number, number, number] => {
    const t2 = t * t;
    const t3 = t2 * t;
    return [
        0.5 * (-t3 + 2 * t2 - t),
        0.5 * (3 * t3 - 5 * t2 + 2),
        0.5 * (-3 * t3 + 4 * t2 + t),
        0.5 * (t3 - t2),
    ];
};

/**
 * Image de la couche, en data-URL PNG, à la résolution de l'écran (`targetWidth` pixels) :
 * interpolation bicubique entre les points (pas de losanges), dégradé continu, et isolignes
 * gris foncé discrètes tous les `contourStep`. `values[j * cols + i]` ; null = sans donnée (transparent).
 */
export const renderGridImage = (
    g: GridSpec,
    values: (number | null)[],
    targetWidth: number,
    colorOf: (v: number) => RGBA,
    contourStep: number,
): string => {
    const pxPerCell = Math.max(8, Math.min(96, Math.round(Math.min(2400, targetWidth) / g.cols)));
    const W = g.cols * pxPerCell;
    const H = g.rows * pxPerCell;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const at = (i: number, j: number) => {
        const v = values[Math.min(g.rows - 1, Math.max(0, j)) * g.cols + Math.min(g.cols - 1, Math.max(0, i))];
        return v == null ? NaN : v;
    };

    // 1) Champ de valeurs interpolé (bicubique ; bilinéaire à côté d'un point sans donnée)
    const field = new Float32Array(W * H).fill(NaN);
    for (let y = 0; y < H; y++) {
        const fj = (y + 0.5) / pxPerCell - 0.5;
        const j0 = Math.floor(fj);
        const ty = fj - j0;
        const wy = cubicWeights(ty);
        for (let x = 0; x < W; x++) {
            const fi = (x + 0.5) / pxPerCell - 0.5;
            const i0 = Math.floor(fi);
            const tx = fi - i0;
            const wx = cubicWeights(tx);
            let sum = 0;
            let ok = true;
            for (let b = 0; b < 4 && ok; b++) {
                for (let a = 0; a < 4; a++) {
                    const v = at(i0 - 1 + a, j0 - 1 + b);
                    if (Number.isNaN(v)) {
                        ok = false;
                        break;
                    }
                    sum += v * wx[a] * wy[b];
                }
            }
            if (!ok) {
                // Bilinéaire sur les voisins disponibles
                const q = [at(i0, j0), at(i0 + 1, j0), at(i0, j0 + 1), at(i0 + 1, j0 + 1)];
                const w4 = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
                let s = 0;
                let ws = 0;
                q.forEach((v, k) => {
                    if (!Number.isNaN(v)) {
                        s += v * w4[k];
                        ws += w4[k];
                    }
                });
                if (ws < 0.25) continue;
                sum = s / ws;
            }
            field[y * W + x] = Math.max(0, sum);
        }
    }

    // 2) Couleurs + isolignes (1 px, gris foncé et discrètes) là où l'on change de palier
    const img = ctx.createImageData(W, H);
    const level = (v: number) => (Number.isNaN(v) ? -1 : Math.floor(v / contourStep));
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const p = y * W + x;
            const v = field[p];
            if (Number.isNaN(v)) continue;
            let [r, gg, b, a] = colorOf(v);
            const l = level(v);
            const edge =
                l >= 1 && ((x + 1 < W && level(field[p + 1]) !== l) || (y + 1 < H && level(field[p + W]) !== l));
            if (edge) {
                // Isoligne gris foncé discrète (lisible sur le fond blanc de la carte)
                r += (55 - r) * 0.5;
                gg += (65 - gg) * 0.5;
                b += (80 - b) * 0.5;
                a = Math.max(a, 150);
            }
            const k = p * 4;
            img.data[k] = r;
            img.data[k + 1] = gg;
            img.data[k + 2] = b;
            img.data[k + 3] = a;
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
};

/** Exécute des tâches asynchrones avec un nombre limité en parallèle */
export const runPool = async <T>(
    tasks: (() => Promise<T>)[],
    concurrency: number,
    onDone: (done: number) => void,
    signal: { cancelled: boolean },
): Promise<(T | null)[]> => {
    const results: (T | null)[] = new Array(tasks.length).fill(null);
    let next = 0;
    let done = 0;
    const worker = async () => {
        while (next < tasks.length && !signal.cancelled) {
            const k = next++;
            try {
                results[k] = await tasks[k]();
            } catch {
                results[k] = null;
            }
            onDone(++done);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
    return results;
};
