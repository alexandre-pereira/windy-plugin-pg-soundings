<div class="wpp-xc" bind:this={rootEl}>
    <div class="wpp-xc__row">
        <button class="wpp-xc__btn" class:wpp-xc__btn--on={visible} on:click={toggle}>
            {visible ? tr('Masquer la carte', 'Hide map') : tr('Carte des meilleurs départs', 'Best take-offs map')}
        </button>
        <div class="wpp-xc__modes" role="group" aria-label={tr('Type de vol', 'Flight type')}>
            {#each MODES as m}
                <button
                    class="wpp-xc__mode"
                    class:wpp-xc__mode--on={mode === m.id}
                    aria-pressed={mode === m.id}
                    on:click={() => setMode(m.id)}>{m.label}</button
                >
            {/each}
        </div>
    </div>

    <div class="wpp-xc__site">
        {#if !visible}
            {mode === 'outReturn'
                ? tr('Aller-retour estimé depuis chaque point de la carte visible', 'Estimated out-and-return from every point of the visible map')
                : tr('Distance libre estimée depuis chaque point de la carte visible', 'Estimated free distance from every point of the visible map')}
        {:else if siteFlight}
            {tr('Depuis ce site :', 'From this site:')}
            <b style="color:{kmColor(siteFlight.km)}">~{roundKm(siteFlight.km)} km</b>
            {#if siteFlight.turn}
                {tr('en aller-retour vers le', 'out-and-return towards')} {headingName(siteFlight.heading)}
                <small
                    >({tr('demi-tour à', 'turn at')} ~{roundKm(siteFlight.outKm ?? 0)} km, {tr('décollage', 'take-off')}
                    {hourLabel(siteFlight.launch)}, {siteFlight.closed
                        ? tr(`retour au déco vers ${hourLabel(siteFlight.landing)}`, `back at take-off around ${hourLabel(siteFlight.landing)}`)
                        : tr(
                              `posé à ~${roundKm((siteFlight.outKm ?? 0) - siteFlight.km / 2)} km du déco vers ${hourLabel(siteFlight.landing)}`,
                              `landed ~${roundKm((siteFlight.outKm ?? 0) - siteFlight.km / 2)} km short around ${hourLabel(siteFlight.landing)}`,
                          )}{siteFlight.reachedEdge ? tr(', sort de la carte', ', leaves the map') : ''})</small
                >
            {:else}
                {tr('vers le', 'towards')} {headingName(siteFlight.heading)}
                <small
                    >({tr('décollage', 'take-off')} {hourLabel(siteFlight.launch)}, {tr('posé vers', 'landing around')}
                    {hourLabel(siteFlight.landing)}{siteFlight.reachedEdge ? tr(', sort de la carte', ', leaves the map') : ''})</small
                >
            {/if}
        {:else if field}
            {tr('Depuis ce site : pas de cross possible ce jour-là', 'From this site: no cross-country possible that day')}
        {/if}
    </div>

    {#if visible && field && !loading && !anyCross}
        <div class="wpp-xc__toptitle">
            {tr('Pas de cross possible sur la carte visible ce jour-là', 'No cross-country possible on the visible map that day')}
        </div>
    {/if}

    {#if loading}
        <div class="wpp-xc__progress">
            <div class="wpp-xc__bar" style="width:{(done / Math.max(total, 1)) * 100}%"></div>
            <span>{simulating
                    ? tr('Simulation des vols', 'Simulating flights')
                    : tr('Chargement de la carte visible', 'Loading the visible map')} : {Math.round(
                    (done / Math.max(total, 1)) * 100,
                )} %</span>
            <button class="wpp-xc__link" on:click={cancel}>{tr('Annuler', 'Cancel')}</button>
        </div>
    {:else if error}
        <div class="wpp-xc__error">{error}</div>
        {#if visible}
            <button class="wpp-xc__link" on:click={compute}>↻ {tr('Réessayer', 'Retry')}</button>
        {/if}
    {/if}
</div>

<script context="module" lang="ts">
    import type { HourlyXc } from './cross';

    /**
     * Cache des données horaires de cross par modèle et par point de grille, partagé entre
     * ouvertures du plugin et conservé dans le navigateur quelques heures (les modèles sont mis à
     * jour toutes les 3 à 6 h). Il ne contient que quelques nombres par heure et par jour.
     */
    export type PointData = { byDay: Record<string, HourlyXc>; days: number; t: number };

    /** À changer si le calcul change, pour ignorer les anciens résultats */
    const CACHE_KEY = 'wpp-xc-cache-v4';
    export const CACHE_TTL_MS = 3 * 3600e3;
    const CACHE_MAX_ENTRIES = 8000;

    export const cache = new Map<string, PointData>();
    export const cacheKey = (m: string, lat: number, lon: number) => `${m}|${lat.toFixed(3)}|${lon.toFixed(3)}`;

    try {
        const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as Record<string, PointData>;
        const now = Date.now();
        for (const [k, v] of Object.entries(saved)) if (now - v.t < CACHE_TTL_MS) cache.set(k, v);
    } catch {
        /* stockage indisponible (navigation privée…) : cache en mémoire seulement */
    }

    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    /** Enregistre le cache (regroupé, 2 s après la dernière mise à jour), sans les entrées périmées */
    export const scheduleSave = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            const now = Date.now();
            const fresh = [...cache.entries()]
                .filter(([, v]) => now - v.t < CACHE_TTL_MS)
                .sort((a, b) => b[1].t - a[1].t)
                .slice(0, CACHE_MAX_ENTRIES);
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(fresh)));
            } catch {
                /* quota dépassé ou stockage indisponible : tant pis, le cache mémoire suffit */
            }
        }, 2000);
    };
</script>

<script lang="ts">
    import { loadForecast } from './forecast';
    import { map } from '@windy/map';
    import store from '@windy/store';

    import { onDestroy, onMount } from 'svelte';

    import { type Column } from './physics';
    import {
        bestFlight,
        headingName,
        hourlyXc,
        hourLabel,
        KM_LEGEND,
        KM_NONE_COLOR,
        kmColor,
        kmRGBA,
        XC_HOURS,
        type FlightResult,
        type XcField,
        type XcMode,
    } from './cross';
    import { tr } from './i18n';
    import { dayKey } from './time';
    import { gridPoint, makeGrid, renderGridImage, runPool, type GridSpec } from './xc';

    /** Modèle météo choisi dans le panneau */
    export let model: string;
    /** Jour choisi (clé de date locale) */
    export let selectedDay: string | null;
    /** Nombre de jours de prévision à charger pour couvrir le jour choisi */
    export let daysNeeded: number;
    /** Site choisi dans le panneau (pour estimer le vol depuis ce site) */
    export let siteLat: number | null = null;
    export let siteLon: number | null = null;

    /** Points de grille sur la carte visible (≈ 13 × 13 à 16 × 16) : seule la partie visible est chargée */
    const GRID_MIN_POINTS = 169;
    const GRID_MAX_POINTS = 256;
    /** Requêtes simultanées vers Windy */
    const CONCURRENCY = 10;
    /** Étendue maximale (degrés) de la zone visible calculée */
    const MAX_SPAN_LAT = 12;
    const MAX_SPAN_LON = 18;
    /** Distance (km) à partir de laquelle un point compte comme un cross possible */
    const MIN_CROSS_KM = 5;
    /** Distance (km) à partir de laquelle la valeur est écrite sur la carte */
    const MIN_LABEL_KM = 15;

    /** Type de vol simulé, mémorisé dans le navigateur */
    const MODES: { id: XcMode; label: string }[] = [
        { id: 'free', label: tr('Distance libre', 'Free distance') },
        { id: 'outReturn', label: tr('Aller-retour', 'Out & return') },
    ];
    const MODE_KEY = 'wpp-xc-mode';
    let mode: XcMode = 'free';
    try {
        if (localStorage.getItem(MODE_KEY) === 'outReturn') mode = 'outReturn';
    } catch {
        /* stockage indisponible */
    }

    /** Change de type de vol : on resimule depuis les données déjà chargées */
    const setMode = (m: XcMode) => {
        if (m === mode) return;
        mode = m;
        if (legendEl) showMapLegend();
        try {
            localStorage.setItem(MODE_KEY, m);
        } catch {
            /* stockage indisponible */
        }
        if (!visible || !grid) return;
        if (simulating) {
            // Simulation en cours pour l'autre type de vol : on l'abandonne
            run.cancelled = true;
            run = { cancelled: false };
            loading = false;
        }
        // Pendant un chargement, la simulation qui suivra utilisera déjà le nouveau type de vol
        if (!loading) draw();
    };

    let visible = false;
    let loading = false;
    let simulating = false;
    let error = '';
    let done = 0;
    let total = 0;
    let grid: GridSpec | null = null;
    let gridModel = '';
    let points: (PointData | null)[] = [];
    let field: XcField | null = null;
    /** Distances de la dernière simulation, par point de grille (null : sans donnée) */
    let values: (number | null)[] = [];
    /** Au moins un point de la carte permet un cross */
    let anyCross = false;
    let siteFlight: FlightResult | null = null;
    let run = { cancelled: false };
    /** Jour pour lequel la carte a été simulée */
    let drawnDay: string | null = null;

    let overlay: L.ImageOverlay | null = null;
    let mapLayers: L.Layer[] = [];
    let siteLayers: L.Layer[] = [];

    let rootEl: HTMLDivElement;

    /** Largeur (px) de la partie de carte réellement visible lors du dernier calcul */
    let visibleWidth = 800;

    const roundKm = (km: number) => (km >= 100 ? Math.round(km / 10) * 10 : Math.round(km / 5) * 5);

    /**
     * Zone de carte réellement visible. Sur ordinateur, le panneau du plugin recouvre la droite
     * de la carte : on ne garde que la partie à sa gauche (sinon la zone paraît deux fois trop grande).
     */
    const viewBounds = () => {
        try {
            const size = map.getSize();
            const mapRect = map.getContainer().getBoundingClientRect();
            let w = size.x;
            // Bord gauche du panneau (même quand l'onglet de la carte est masqué)
            const pane = rootEl?.closest('.wpp') ?? rootEl;
            const paneLeft = pane ? pane.getBoundingClientRect().left - 20 - mapRect.left : w;
            if (paneLeft > 150 && paneLeft < w) w = paneLeft;
            const nw = map.containerPointToLatLng([0, 0]);
            const se = map.containerPointToLatLng([w, size.y]);
            visibleWidth = w;
            let west = nw.lng;
            let east = se.lng;
            if (east < west) east += 360;
            return { south: se.lat, north: nw.lat, west, east };
        } catch {
            const b = map.getBounds();
            visibleWidth = 800;
            return { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() };
        }
    };

    const loadPoint = async (lat: number, lon: number, m: string, days: number): Promise<PointData> => {
        const key = cacheKey(m, lat, lon);
        const hit = cache.get(key);
        if (hit && hit.days >= days && Date.now() - hit.t < CACHE_TTL_MS) return hit;
        const { columns: cols } = await loadForecast(
            m,
            lat,
            lon,
            { header: true, sounding: true },
            days,
            // Seules les heures de vol comptent : bien moins de calcul par point, et pas de CAPE
            { keepHour: h => h >= XC_HOURS[0] && h <= XC_HOURS[1], stability: false },
        );
        // On ne garde que l'utile : vitesse de cross, vent et hauteur, heure par heure, pour chaque jour
        const groups = new Map<string, Column[]>();
        for (const c of cols) {
            const k = dayKey(c.ts, c.utcOffset);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k)!.push(c);
        }
        const byDay: Record<string, HourlyXc> = {};
        groups.forEach((list, k) => (byDay[k] = hourlyXc(list)));
        const entry: PointData = { byDay, days, t: Date.now() };
        cache.set(key, entry);
        scheduleSave();
        return entry;
    };

    const nextFrame = () => new Promise(r => setTimeout(r, 0));

    /** Simule les vols depuis tous les points (par petits lots, sans figer la page), puis dessine */
    const draw = async () => {
        if (!grid || !visible || selectedDay == null) return;
        const g = grid;
        const f: XcField = { grid: g, data: points.map(p => p?.byDay[selectedDay as string] ?? null) };
        const current = run;
        const m = mode;
        drawnDay = selectedDay;

        simulating = true;
        loading = true;
        done = 0;
        total = g.cols * g.rows;
        const res: (FlightResult | null)[] = new Array(total).fill(null);
        // Calcul par tranches de ~25 ms pour garder la page fluide
        let slice = performance.now();
        for (let k = 0; k < total; k++) {
            if (f.data[k]) {
                const { lat, lon } = gridPoint(g, k % g.cols, Math.floor(k / g.cols));
                res[k] = bestFlight(f, lat, lon, m);
            }
            if (performance.now() - slice > 25) {
                done = k + 1;
                await nextFrame();
                if (current.cancelled) return;
                slice = performance.now();
            }
        }
        simulating = false;
        loading = false;
        field = f;

        values = res.map((r, k) => (f.data[k] ? (r?.km ?? 0) : null));
        anyCross = values.some(v => v != null && v > MIN_CROSS_KM);
        const url = renderGridImage(g, values, visibleWidth * 0.5, kmRGBA, 50);
        const bounds: L.LatLngBoundsExpression = [
            [g.south, g.west],
            [g.north, g.east],
        ];
        if (overlay) {
            overlay.setUrl(url);
            overlay.setBounds(L.latLngBounds(bounds));
        } else {
            showBackdrop();
            overlay = L.imageOverlay(url, bounds, { opacity: 1, interactive: false }).addTo(map);
            overlay.bringToFront();
        }

        drawLayers(g, values);
        drawSite();
    };

    /** Bulle d'une distance, à la couleur de l'échelle (texte sombre sur les teintes claires) */
    const kmBubble = (km: number, unit = '') =>
        `<span class="km" style="background:${kmColor(km)};color:${km >= 100 ? '#fff' : '#111'}">${roundKm(km)}${unit}</span>`;

    /** Distances écrites sur la carte */
    const drawLayers = (g: GridSpec, values: (number | null)[]) => {
        removeLayers(mapLayers);
        const step = Math.max(1, Math.ceil(100 / (visibleWidth / g.cols)));
        const offset = Math.floor(step / 2);
        for (let j = offset; j < g.rows; j += step) {
            for (let i = offset; i < g.cols; i += step) {
                const v = values[j * g.cols + i];
                if (v == null || v < MIN_LABEL_KM) continue;
                const { lat, lon } = gridPoint(g, i, j);
                const icon = new L.DivIcon({
                    className: 'wpp-xc-label',
                    html: kmBubble(v),
                    iconSize: [40, 18],
                    iconAnchor: [20, 9],
                });
                mapLayers.push(L.marker([lat, lon], { icon, interactive: false }).addTo(map));
            }
        }
        showMapLegend();
    };

    /** Cap (°) d'un segment, pour orienter les flèches (la carte est conforme : les angles sont justes) */
    const segmentBearing = (a: [number, number], b: [number, number]) => {
        const dx = (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
        return (Math.atan2(dx, b[0] - a[0]) * 180) / Math.PI;
    };

    /** Trace d'un vol : ligne, flèches de sens, point d'arrivée ou de demi-tour */
    const flightLayers = (f: FlightResult, color: string, dashed = false): L.Layer[] => {
        const layers = routeLayers(f.path, color, dashed);
        const n = f.path.length;
        if (n < 2) return layers;
        // Flèches aux 30 % et 70 % du trajet (à l'aller seulement pour un aller-retour)
        const marks = f.turn ? [0.2, 0.4] : [0.3, 0.7];
        for (const frac of marks) {
            const i = Math.min(n - 2, Math.max(0, Math.floor(frac * (n - 1))));
            const angle = segmentBearing(f.path[i], f.path[i + 1]);
            const icon = new L.DivIcon({
                className: 'wpp-xc-arrow',
                html: `<svg viewBox="0 0 16 16" width="16" height="16" style="transform:rotate(${angle}deg)"><path d="M8 2l5 10-5-3-5 3z" fill="${color}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
            });
            layers.push(L.marker(f.path[i + 1], { icon, interactive: false }).addTo(map));
        }
        // Arrivée (distance libre) ou demi-tour (aller-retour)
        const end = f.turn ?? f.path[n - 1];
        const endIcon = new L.DivIcon({
            className: 'wpp-xc-end',
            html: `<span style="border-color:${color}">${f.turn ? '↺' : '●'}</span>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });
        layers.push(L.marker(end, { icon: endIcon, interactive: false }).addTo(map));
        return layers;
    };

    // --- Légende posée sur la carte, en bas à gauche de la zone visible
    let legendEl: HTMLDivElement | null = null;

    const showMapLegend = () => {
        try {
            if (!legendEl) {
                legendEl = document.createElement('div');
                legendEl.className = 'wpp-xc-maplegend';
                map.getContainer().appendChild(legendEl);
            }
        } catch {
            return;
        }
        const chips =
            `<span style="background:${KM_NONE_COLOR};color:#fff">0</span>` +
            KM_LEGEND.map(
                (km, k) =>
                    `<span style="background:${kmColor(km)};color:${km >= 100 ? '#fff' : '#111'}">${km}${k === KM_LEGEND.length - 1 ? '+' : ''}</span>`,
            ).join('');
        legendEl.innerHTML = `
            <div class="t">${mode === 'outReturn' ? tr('Aller-retour possible depuis chaque point', 'Out & return from each point') : tr('Distance libre possible depuis chaque point', 'Free distance from each point')}</div>
            <div class="c">${chips}<em>km</em></div>
            <div class="h">${tr('Gris : pas de cross possible ce jour-là', 'Grey: no cross-country possible that day')}</div>
            <div class="h">${tr('Touchez la carte pour voir le vol depuis un point', 'Tap the map to see the flight from a point')}</div>`;
    };

    const hideMapLegend = () => {
        legendEl?.remove();
        legendEl = null;
    };

    /** Trajectoire : trait sombre sur un liseré blanc, lisible sur tous les fonds */
    const routeLayers = (path: [number, number][], color: string, dashed = false): L.Layer[] => [
        L.polyline(path, { color: '#ffffff', weight: 6, opacity: 0.85, interactive: false } as L.PolylineOptions).addTo(
            map,
        ),
        L.polyline(path, {
            color,
            weight: 3,
            opacity: 0.95,
            dashArray: dashed ? '6 6' : undefined,
            interactive: false,
        } as L.PolylineOptions).addTo(map),
    ];

    /** Vol estimé depuis le site choisi dans le panneau */
    const drawSite = () => {
        removeLayers(siteLayers);
        siteFlight = null;
        if (!field || siteLat == null || siteLon == null) return;
        siteFlight = bestFlight(field, siteLat, siteLon, mode);
        if (siteFlight && siteFlight.km > 1) {
            siteLayers = flightLayers(siteFlight, '#2563eb', true);
            // Distance au bout du trajet du site choisi
            const icon = new L.DivIcon({
                className: 'wpp-xc-site',
                html: kmBubble(siteFlight.km, ' km'),
                iconSize: [0, 0],
                iconAnchor: [-10, 10],
            });
            siteLayers.push(L.marker(siteFlight.turn ?? siteFlight.path[siteFlight.path.length - 1], { icon, interactive: false }).addTo(map));
        }
    };

    // Changement de site : on resimule son vol sur la carte déjà calculée
    $: if (visible && field && siteLat != null && siteLon != null) drawSite();

    const removeLayers = (layers: L.Layer[]) => {
        layers.forEach(l => l.remove());
        layers.length = 0;
    };

    /** Charge la zone actuellement visible (en arrière-plan), puis simule les vols */
    const compute = async () => {
        const b = viewBounds();
        const spanLat = b.north - b.south;
        const spanLon = b.east - b.west;
        if (spanLat > MAX_SPAN_LAT || spanLon > MAX_SPAN_LON) {
            // Trop dézoomé : on zoome d'office jusqu'au niveau le plus large autorisé ; le calcul
            // repart tout seul à la fin du zoom (événement « moveend »)
            const factor = Math.max(spanLat / MAX_SPAN_LAT, spanLon / MAX_SPAN_LON);
            try {
                const zoom = Math.ceil(map.getZoom() + Math.log2(factor));
                error = '';
                map.setView(map.getCenter(), zoom, { animate: true });
            } catch {
                error = tr(
                    `Zone visible trop grande : zoomez un peu (jusqu'à ~${MAX_SPAN_LON}° de large).`,
                    `Visible area too large: zoom in a little (up to ~${MAX_SPAN_LON}° wide).`,
                );
            }
            return;
        }
        run.cancelled = true;
        run = { cancelled: false };
        const current = run;

        error = '';
        loading = true;
        simulating = false;
        const visibleTarget = Math.min(
            GRID_MAX_POINTS,
            Math.max(GRID_MIN_POINTS, GRID_MIN_POINTS * Math.sqrt((spanLat * spanLon) / 20)),
        );
        const loadBounds = { south: Math.max(-80, b.south), north: Math.min(80, b.north), west: b.west, east: b.east };
        // Nouvelle grille chargée en arrière-plan : l'ancienne carte reste affichée jusqu'à la fin
        const g = makeGrid(loadBounds, Math.round(visibleTarget));
        try {
            gridZoom = map.getZoom();
        } catch {
            gridZoom = null;
        }
        const m = model;
        const days = daysNeeded;
        const newPoints: (PointData | null)[] = new Array(g.cols * g.rows).fill(null);
        total = newPoints.length;
        done = 0;

        // Du centre vers les bords
        const cLat = (b.north + b.south) / 2;
        const cLon = (b.east + b.west) / 2;
        const order = newPoints
            .map((_, k) => {
                const { lat, lon } = gridPoint(g, k % g.cols, Math.floor(k / g.cols));
                return { k, lat, lon, d: ((lat - cLat) / spanLat) ** 2 + ((lon - cLon) / spanLon) ** 2 };
            })
            .sort((a, c) => a.d - c.d);
        const tasks = order.map(({ k, lat, lon }) => async () => {
            const p = await loadPoint(lat, lon, m, days);
            if (!current.cancelled) newPoints[k] = p;
            return p;
        });

        await runPool(
            tasks,
            CONCURRENCY,
            n => {
                if (!current.cancelled) done = n;
            },
            current,
        );

        if (current.cancelled) return;
        if (newPoints.every(p => !p)) {
            loading = false;
            error = tr(
                `Le modèle ${m} n'a pas pu être chargé sur cette zone (hors couverture ?).`,
                `The ${m} model could not be loaded for this area (outside its coverage?).`,
            );
            return;
        }
        // Tout est chargé : on simule les vols, puis on remplace la carte d'un coup
        grid = g;
        points = newPoints;
        gridModel = m;
        await draw();
    };

    const cancel = () => {
        run.cancelled = true;
        loading = false;
        simulating = false;
    };

    const removeOverlay = () => {
        overlay?.remove();
        overlay = null;
        removeLayers(mapLayers);
        removeLayers(siteLayers);
        field = null;
        values = [];
        anyCross = false;
        siteFlight = null;
        hideMapLegend();
        hideBackdrop();
    };

    // --- Fond neutre : carte Windy de base (relief, frontières, villes) sans couche météo, sans
    // animation du vent ni isolignes, pour bien lire la carte. Les réglages Windy d'avant sont
    // rétablis quand la carte est masquée ou le plugin fermé.
    let savedMap: { overlay: unknown; particles: unknown; isolines: unknown } | null = null;

    const showBackdrop = () => {
        if (savedMap) return;
        try {
            savedMap = {
                overlay: store.get('overlay'),
                particles: store.get('particlesAnim'),
                isolines: store.get('isolinesOn'),
            };
            store.set('overlay', 'topoMap');
            store.set('particlesAnim', 'off');
            store.set('isolinesOn', false);
        } catch {
            savedMap = null;
        }
    };

    const hideBackdrop = () => {
        if (!savedMap) return;
        const s = savedMap;
        savedMap = null;
        try {
            store.set('overlay', s.overlay as 'wind');
            store.set('particlesAnim', s.particles as 'on');
            store.set('isolinesOn', s.isolines as boolean);
        } catch {
            /* rien à rétablir */
        }
    };

    const toggle = () => {
        visible = !visible;
        if (visible) {
            compute();
        } else {
            cancel();
            removeOverlay();
            error = '';
        }
    };

    // Changement de jour : on resimule depuis le cache (ou on charge les jours manquants)
    $: if (visible && selectedDay && grid && !loading && selectedDay !== drawnDay) {
        drawnDay = selectedDay;
        const missing = points.some(p => p && p.days < daysNeeded);
        if (missing) compute();
        else draw();
    }

    // Changement de modèle : nouveau calcul
    $: if (visible && grid && model !== gridModel && !loading) compute();

    // La carte suit le niveau de zoom : après un zoom, ou un déplacement qui sort de la zone
    // calculée, on recalcule pour la zone visible (1 s après l'arrêt de la carte)
    let gridZoom: number | null = null;
    let moveTimer: ReturnType<typeof setTimeout> | null = null;

    const onMoveEnd = () => {
        if (!visible) return;
        let zoomChanged = false;
        try {
            zoomChanged = map.getZoom() !== gridZoom;
        } catch {
            /* zoom indisponible : on se fie à l'emprise */
        }
        const b = viewBounds();
        const outside =
            !grid || b.south < grid.south || b.north > grid.north || b.west < grid.west || b.east > grid.east;
        // Simple déplacement dans la zone déjà calculée : rien à refaire
        if (!zoomChanged && !outside) return;
        if (moveTimer) clearTimeout(moveTimer);
        moveTimer = setTimeout(() => {
            moveTimer = null;
            if (visible) compute();
        }, 1000);
    };

    onMount(() => {
        map.on('moveend', onMoveEnd);
    });

    onDestroy(() => {
        run.cancelled = true;
        if (moveTimer) clearTimeout(moveTimer);
        map.off('moveend', onMoveEnd);
        removeOverlay();
    });
</script>

<style lang="less">
    .wpp-xc {
        font-size: 12px;

        &__row {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 10px;
            flex-wrap: wrap;
        }
        &__modes {
            display: inline-flex;
            border: 1px solid var(--wpp-border);
            border-radius: 7px;
            overflow: hidden;
        }
        &__mode {
            padding: 7px 11px;
            border: none;
            background: none;
            color: var(--wpp-fg-dim);
            font-size: 13px;
            cursor: pointer;
            & + & {
                border-left: 1px solid var(--wpp-border);
            }
            &:hover {
                background: var(--wpp-surface);
            }
            &--on,
            &--on:hover {
                background: var(--wpp-surface-hover);
                color: var(--wpp-fg);
                font-weight: 600;
            }
        }
        &__toptitle {
            margin-top: 10px;
            color: var(--wpp-fg-faint);
            font-size: 11px;
        }
        &__site {
            margin-top: 8px;
            color: var(--wpp-fg-dim);
            b {
                font-size: 14px;
            }
            small {
                opacity: 0.7;
                margin-left: 2px;
            }
        }
        &__btn {
            padding: 8px 14px;
            border: 1px solid var(--wpp-border);
            border-radius: 7px;
            background: var(--wpp-surface);
            color: var(--wpp-fg);
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition:
                background 0.15s,
                border-color 0.15s;

            &--on,
            &:hover {
                background: var(--wpp-surface-hover);
                border-color: var(--wpp-border-strong);
            }
        }
        &__progress {
            position: relative;
            margin-top: 8px;
            padding: 4px 8px;
            border-radius: 6px;
            background: var(--wpp-surface);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;

            span {
                position: relative;
            }
        }
        &__bar {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: rgba(255, 210, 74, 0.25);
            transition: width 0.2s;
        }
        &__link {
            position: relative;
            margin-top: 6px;
            padding: 0;
            border: none;
            background: none;
            color: var(--wpp-accent);
            font-size: 12px;
            cursor: pointer;
            text-decoration: underline;
        }
        &__error {
            margin-top: 8px;
            color: #ff8a80;
        }
    }

    // Étiquettes posées sur la carte (hors du composant : styles globaux)
    :global(.wpp-xc-label) {
        background: none;
        border: none;
        text-align: center;
        pointer-events: none;
    }
    // Bulle de distance, à la couleur de l'échelle (fond et texte posés en ligne) ; le liseré blanc
    // la détache de la carte, de la même teinte dessous
    :global(.wpp-xc-label .km) {
        display: inline-block;
        padding: 1px 5px;
        border: 1.5px solid #ffffff;
        border-radius: 9px;
        font: 700 11.5px/14px -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        white-space: nowrap;
    }

    // Distance du vol depuis le site choisi, au bout de sa trajectoire : liseré bleu comme elle
    :global(.wpp-xc-site) {
        background: none;
        border: none;
        pointer-events: none;
        white-space: nowrap;
    }
    :global(.wpp-xc-site .km) {
        display: inline-block;
        padding: 2px 7px;
        border: 2px solid #2563eb;
        border-radius: 11px;
        font: 700 12.5px/16px -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    }
    // Flèches de sens et point d'arrivée / de demi-tour
    :global(.wpp-xc-arrow),
    :global(.wpp-xc-end) {
        background: none;
        border: none;
        pointer-events: none;
    }
    :global(.wpp-xc-arrow svg) {
        display: block;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
    }
    :global(.wpp-xc-end span) {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        box-sizing: border-box;
        border-radius: 50%;
        border: 2px solid;
        background: #ffffff;
        color: #1f2933;
        font: 700 10px/1 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    // Légende posée sur la carte
    :global(.wpp-xc-maplegend) {
        position: absolute;
        left: 12px;
        bottom: 110px;
        z-index: 800;
        max-width: min(340px, calc(100% - 24px));
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        color: #1f2933;
        font: 12px/1.35 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
        pointer-events: none;
    }
    :global(.wpp-xc-maplegend .t) {
        font-weight: 700;
        margin-bottom: 5px;
    }
    :global(.wpp-xc-maplegend .c) {
        display: flex;
        align-items: center;
    }
    :global(.wpp-xc-maplegend .c span) {
        flex: 1;
        padding: 2px 0;
        text-align: center;
        font-weight: 700;
        font-size: 11px;
    }
    :global(.wpp-xc-maplegend .c span:first-child) {
        border-radius: 5px 0 0 5px;
    }
    :global(.wpp-xc-maplegend .c span:last-of-type) {
        border-radius: 0 5px 5px 0;
    }
    :global(.wpp-xc-maplegend .c em) {
        margin-left: 6px;
        font-style: normal;
        color: #4b5563;
    }
    :global(.wpp-xc-maplegend .h) {
        margin-top: 5px;
        color: #4b5563;
        font-size: 11px;
    }

    @media (pointer: coarse) {
        .wpp-xc__btn {
            padding: 8px 14px;
        }
    }
</style>
