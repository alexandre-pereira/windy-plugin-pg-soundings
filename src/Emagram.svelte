<!--
    Émagramme « redressé » :
    - altitude linéaire en mètres ;
    - abscisse = température ramenée au niveau de la mer le long de l'adiabatique sèche
      (T + 9,8 °C/km × z) : les adiabatiques sèches sont donc verticales et les isothermes obliques ;
    - courbe d'état colorée selon la stabilité (rouge : instabilité absolue, vert : instabilité
      conditionnelle, clair : stable), point de rosée en bleu ;
    - colonne de vent à droite, flèches dimensionnées par la force, couche convective en jaune.

    Mise en page : axe des altitudes fixe à gauche, courbes au centre (défilement horizontal sur
    smartphone), colonne de vent fixe à droite. Les trois SVG partagent le même repère : chacun
    n'affiche que sa bande grâce à son viewBox.
-->
<svelte:window on:pointerdown={onWindowPointer} />

<div class="wpp-ema-wrap" bind:this={wrapEl} style="width:{width}px;height:{height}px">
    <!-- Axe des altitudes (fixe) -->
    <svg class="wpp-ema wpp-ema-side" style="left:0" width={left} {height} viewBox="0 0 {left} {height}">
        {#each altLabels as z}
            <text x={left - 6} y={y(z) + 3.5} class="wpp-axis" text-anchor="end">{z}</text>
        {/each}
        {#if column.ground > yMin + span * 0.04}
            <text x={left - 6} y={y(column.ground) + 3.5} class="wpp-axis wpp-axis--ground" text-anchor="end"
                >{column.ground}</text
            >
        {/if}
        {#if hover}
            <rect x="2" y={y(hover.z) - 8} width={left - 4} height="16" rx="3" fill="#ffd24a" />
            <text x={left / 2} y={y(hover.z) + 3.5} class="wpp-axis-hover" text-anchor="middle"
                >{r50(hover.z)}</text
            >
        {/if}
    </svg>

    <!-- Courbes (défilent horizontalement si l'écran est étroit) -->
    <div
        class="wpp-ema-scroll"
        style="left:{left}px;width:{viewW}px;height:{height}px"
        bind:this={scrollEl}
        on:scroll={() => (savedScroll = scrollEl.scrollLeft)}
    >
    <svg width={plotW} {height} viewBox="{left} 0 {plotW} {height}" class="wpp-ema">
        <defs>
            <clipPath id="wpp-ema-clip">
                <rect x={left} y={top} width={plotW} height={plotH} />
            </clipPath>
            <linearGradient id="wpp-ema-ground" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#7a5f45" />
                <stop offset="1" stop-color="#3f3025" />
            </linearGradient>
            <linearGradient id="wpp-ema-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style="stop-color: var(--wpp-sky-top)" />
                <stop offset="1" style="stop-color: var(--wpp-sky-bottom)" />
            </linearGradient>
        </defs>

        <rect x={left} y={top} width={plotW} height={plotH} rx="3" fill="url(#wpp-ema-sky)" />

        <g clip-path="url(#wpp-ema-clip)">
            <!-- Grille d'altitude -->
            {#each altMinor as z}
                <line
                    x1={left}
                    x2={left + plotW}
                    y1={y(z)}
                    y2={y(z)}
                    stroke="currentColor"
                    stroke-opacity={z % 1000 === 0 ? 0.16 : 0.06}
                />
            {/each}

            <!-- Isothermes (obliques) -->
            {#each isotherms as t}
                <line
                    x1={px(t + GAMMA_D * yMin)}
                    x2={px(t + GAMMA_D * yMax)}
                    y1={y(yMin)}
                    y2={y(yMax)}
                    style="stroke: {t === 0 ? 'var(--wpp-freezing)' : 'var(--wpp-line)'}"
                    stroke-opacity={t === 0 ? 0.75 : t % 10 === 0 ? 0.22 : 0.1}
                    stroke-width={t === 0 ? 1.4 : 1}
                />
            {/each}

            <!-- Adiabatiques sèches (verticales) -->
            {#each dryAdiabats as xv}
                <line x1={px(xv)} x2={px(xv)} y1={top} y2={top + plotH} class="wpp-dry" />
            {/each}

            <!-- Adiabatiques saturées -->
            {#each moistAdiabats as d}
                <path {d} class="wpp-moist" />
            {/each}

            <!-- Rapport de mélange saturant -->
            {#each mixingLines as m}
                <path d={m.d} class="wpp-mixing" />
            {/each}

            <!-- Couche nuageuse convective (cumulus) -->
            {#if column.cuBase != null && column.cuTop != null && column.cuTop > column.cuBase}
                <rect
                    x={left}
                    y={y(column.cuTop)}
                    width={plotW}
                    height={y(column.cuBase) - y(column.cuTop)}
                    fill="currentColor"
                    opacity="0.07"
                />
            {/if}

            <!-- Sol vu par le modèle -->
            <rect
                x={left}
                y={y(column.ground)}
                width={plotW}
                height={Math.max(0, top + plotH - y(column.ground))}
                fill="url(#wpp-ema-ground)"
            />
            <line
                x1={left}
                x2={left + plotW}
                y1={y(column.ground)}
                y2={y(column.ground)}
                stroke="#b08b68"
                stroke-width="1.5"
            />

            <!-- Point de rosée -->
            <path d={dewPath} class="wpp-halo" />
            <path d={dewPath} class="wpp-curve wpp-curve--dew" />

            <!-- Chemin de la particule -->
            <path d={parcelD} class="wpp-curve wpp-curve--parcel" />

            <!-- Courbe d'état colorée selon la stabilité -->
            <path d={tempHalo} class="wpp-halo" />
            {#each tempSegments as s}
                <path d={s.d} class="wpp-curve wpp-curve--temp" style="stroke: {stabilityColor(s.kind)}" />
            {/each}

            <!-- Niveaux remarquables -->
            {#each marks as m}
                <line
                    x1={left}
                    x2={left + plotW}
                    y1={y(m.z)}
                    y2={y(m.z)}
                    style="stroke: {m.color}"
                    stroke-width="1.3"
                    stroke-dasharray={m.dash}
                />
                <!-- Étiquette à côté de la courbe d'état, pour rester visible quand on fait défiler -->
                <text x={markX(m.z)} y={Math.min(y(m.z) - 5, y(column.ground) - 22)} class="wpp-mark" style="fill: {m.color}"
                    >{`${m.label} ${r50(m.z)} m`}</text
                >
            {/each}

            <!-- Valeurs au sol -->
            {#if column.ground >= yMin}
                <text
                    x={px(xOf(column.t2m, column.ground)) + 6}
                    y={y(column.ground) - 6}
                    class="wpp-surf wpp-surf--temp">{(column.t2m - K).toFixed(1)}°</text
                >
                {#if column.td2m != null}
                    <text
                        x={px(xOf(column.td2m, column.ground)) - 6}
                        y={y(column.ground) - 6}
                        class="wpp-surf wpp-surf--dew"
                        text-anchor="end">{(column.td2m - K).toFixed(1)}°</text
                    >
                {/if}
            {/if}

            <!-- Survol -->
            {#if hover && readout}
                <line
                    x1={left}
                    x2={left + plotW}
                    y1={y(hover.z)}
                    y2={y(hover.z)}
                    stroke="#ffd24a"
                    stroke-opacity="0.8"
                    stroke-dasharray="3 3"
                />
                {#if readout.t != null}
                    <circle cx={px(xOf(readout.t + K, hover.z))} cy={y(hover.z)} r="4" class="wpp-ring wpp-ring--temp" />
                {/if}
                {#if readout.td != null}
                    <circle cx={px(xOf(readout.td + K, hover.z))} cy={y(hover.z)} r="4" class="wpp-ring wpp-ring--dew" />
                {/if}
            {/if}
        </g>

        <!-- Étiquettes des rapports de mélange, posées sur le sol -->
        {#each mixingLines as m}
            {#if m.labelX >= left + 6 && m.labelX <= left + plotW - 6}
                <text x={m.labelX} y={labelY} class="wpp-mixing-label" text-anchor="middle">{m.w}</text>
            {/if}
        {/each}

        <!-- Étiquettes des isothermes en haut du cadre -->
        {#each isotherms as t}
            {#if t % 10 === 0 && px(t + GAMMA_D * yMax) >= left + 8 && px(t + GAMMA_D * yMax) <= left + plotW - 8}
                <text x={px(t + GAMMA_D * yMax)} y={top + 11} class="wpp-iso-label" text-anchor="middle"
                    >{t}°</text
                >
            {/if}
        {/each}

        <!-- Axe des températures -->
        {#each dryAdiabats as xv}
            {#if xv % 10 === 0 && px(xv) < left + plotW - 36}
                <text x={px(xv)} y={top + plotH + 14} class="wpp-axis" text-anchor="middle">{xv}</text>
            {/if}
        {/each}
        <text x={left + plotW - 2} y={top + plotH + 14} class="wpp-axis" text-anchor="end">T (°C)</text>
        <rect
            x={left + 0.5}
            y={top}
            width={plotW - 1}
            height={plotH}
            rx="3"
            fill="none"
            stroke="currentColor"
            stroke-opacity="0.25"
        />

        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <rect
            x={left}
            y={top}
            width={plotW}
            height={plotH}
            fill="transparent"
            pointer-events="all"
            class="wpp-hit"
            on:pointerdown={e => (pointerType = e.pointerType)}
            on:mousemove={onMove}
            on:click={onMove}
            on:mouseleave={() => pointerType === 'mouse' && (hover = null)}
        />
    </svg>
    </div>

    <!-- Colonne de vent (fixe) -->
    <svg
        class="wpp-ema wpp-ema-side"
        style="left:{panelX}px"
        width={panelW}
        {height}
        viewBox="{panelX} 0 {panelW} {height}"
    >
        <g transform="translate({panelX},0)">
            <rect x="0" y={top} width={panelW} height={plotH} rx="3" fill="url(#wpp-ema-sky)" />
            {#if blTop != null}
                <rect
                    x="0"
                    y={y(blTop)}
                    width={panelW}
                    height={y(Math.max(yMin, column.ground)) - y(blTop)}
                    fill="#ffe14a"
                    opacity="0.22"
                />
            {/if}
            {#if column.ground > yMin}
                <rect
                    x="0"
                    y={y(column.ground)}
                    width={panelW}
                    height={top + plotH - y(column.ground)}
                    fill="url(#wpp-ema-ground)"
                />
            {/if}
            {#each winds as w}
                <path
                    d={w.arrow}
                    transform="translate({panelW * 0.26},{w.y}) rotate({w.dir + 180})"
                    fill={w.color}
                    style="stroke: var(--wpp-halo)"
                    stroke-width="0.7"
                />
                <text x={panelW * 0.52} y={w.y + 3.5} class="wpp-wind" fill={w.color}>{w.kmh}</text>
            {/each}
            <rect
                x="0"
                y={top}
                width={panelW}
                height={plotH}
                rx="3"
                fill="none"
                stroke="currentColor"
                stroke-opacity="0.25"
            />
            <text x={panelW / 2} y={top + plotH + 14} class="wpp-axis" text-anchor="middle">km/h</text>
        </g>

        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <rect
            x={panelX}
            y={top}
            width={panelW}
            height={plotH}
            fill="transparent"
            pointer-events="all"
            class="wpp-hit"
            on:pointerdown={e => (pointerType = e.pointerType)}
            on:mousemove={onMove}
            on:click={onMove}
            on:mouseleave={() => pointerType === 'mouse' && (hover = null)}
        />
    </svg>

    {#if hover && readout}
        <div class="wpp-tip" style="left:{tipX}px;top:{tipY}px">
            <div class="wpp-tip__title">{r50(hover.z)} m <span>· {readout.p.toFixed(0)} hPa</span></div>
            {#if readout.stability}
                <div class="wpp-tip__stab" style="color:{stabilityColor(readout.stability)}">
                    {STABILITY[readout.stability].label}
                </div>
            {/if}
            {#if readout.t != null}
                <div class="wpp-tip__row">
                    <span>{tr('Température', 'Temperature')}</span><b>{readout.t.toFixed(1)} °C</b>
                </div>
            {/if}
            {#if readout.td != null}
                <div class="wpp-tip__row">
                    <span>{tr('Point de rosée', 'Dew point')}</span><b class="wpp-c-dew">{readout.td.toFixed(1)} °C</b>
                </div>
            {/if}
            {#if readout.t != null && readout.td != null}
                <div class="wpp-tip__row">
                    <span>{tr('Écart T − Td', 'Spread T − Td')}</span><b>{(readout.t - readout.td).toFixed(1)} °C</b>
                </div>
            {/if}
            {#if readout.lapse != null}
                <div class="wpp-tip__row">
                    <span>{tr('Gradient', 'Lapse rate')}</span><b>{readout.lapse.toFixed(1)} °C/km</b>
                </div>
            {/if}
            {#if readout.parcel != null && readout.t != null}
                <div class="wpp-tip__row">
                    <span>{tr('Particule', 'Parcel')}</span><b class="wpp-c-parcel"
                        >{readout.parcel.toFixed(1)} °C ({readout.parcel - readout.t >= 0 ? '+' : ''}{(
                            readout.parcel - readout.t
                        ).toFixed(1)})</b
                    >
                </div>
            {/if}
            {#if readout.wind}
                <div class="wpp-tip__row">
                    <span>{tr('Vent', 'Wind')}</span><b style="color:{windColor(readout.wind.kmh, light)}"
                        >{readout.wind.kmh} km/h {cardinal(readout.wind.dir)}</b
                    >
                </div>
            {/if}
        </div>
    {/if}
</div>

<script context="module" lang="ts">
    import { tr } from './i18n';
    import { interpProfile as interpProfileM, parcelPath as parcelPathM, type Column as ColumnM } from './physics';

    /** Classes de stabilité de la courbe d'état, couleurs adaptées au fond sombre */
    export const STABILITY = {
        absolute: { color: '#ff4d4d', label: tr('Instabilité absolue', 'Absolutely unstable') },
        conditional: { color: '#3ddc84', label: tr('Instabilité conditionnelle', 'Conditionally unstable') },
        stable: { color: '#e9edf2', label: tr('Stable', 'Stable') },
    } as const;
    export type Stability = keyof typeof STABILITY;

    /** Défilement horizontal des courbes, gardé quand on change d'heure, de jour ou d'onglet */
    let savedScroll: number | null = null;

    /**
     * Plage de l'axe des températures redressées commune à toute une journée : en faisant défiler
     * l'heure, le cadre reste fixe et seules les courbes bougent (sinon l'axe se recale par crans).
     */
    export const emagramRange = (cols: ColumnM[], yMin: number, yMax: number): [number, number] | null => {
        const xs: number[] = [];
        const xOf = (tK: number, z: number) => tK - 273.15 + 0.0098 * z;
        for (const col of cols) {
            const zTop = Math.min(yMax, col.profile[col.profile.length - 1].z);
            for (let z = Math.max(yMin, col.profile[0].z); z <= zTop; z += 50) {
                const t = interpProfileM(col.profile, z, 't');
                if (t != null) xs.push(xOf(t, z));
            }
            for (let z = col.profile[0].z; z <= Math.min(zTop, col.ground + 1000); z += 50) {
                const td = interpProfileM(col.profile, z, 'td');
                if (td != null) xs.push(xOf(td, z));
            }
            for (const p of parcelPathM(col, zTop)) xs.push(xOf(p.t, p.z));
        }
        if (!xs.length) return null;
        const lo = Math.floor((Math.min(...xs) - 1) / 5) * 5;
        const hi = Math.ceil((Math.max(...xs) + 1) / 5) * 5;
        return [hi - lo < 25 ? hi - 25 : lo, hi];
    };
</script>

<script lang="ts">
    import {
        type Column,
        cardinal,
        dewPointFromMixingRatio,
        interpProfile,
        moistAdiabat,
        moistLapse,
        parcelPath,
        pressureAt,
        toKmh,
        windAt,
        windColor,
    } from './physics';
    import { arrowPath } from './svg';
    import { tick } from 'svelte';

    export let column: Column;
    export let width = 760;
    export let yMin = 0;
    export let yMax = 4000;
    /** Thème clair (couleurs du vent plus soutenues) */
    export let light = false;
    /** Plage fixe de l'axe des températures (toute la journée) ; sinon calculée pour l'heure affichée */
    export let xRange: [number, number] | null = null;

    const K = 273.15;
    /** Gradient adiabatique sec (°C/m) : sert au « redressement » de l'axe des températures */
    const GAMMA_D = 0.0098;
    const top = 8;
    const gap = 3;

    /** Largeur minimale (px) de la zone des courbes : en dessous, elle défile horizontalement */
    const MIN_PLOT_W = 440;
    const plotH = 460;
    const height = top + plotH + 20;

    // Smartphone : marges et colonne de vent réduites ; la zone des courbes garde une largeur
    // confortable et défile entre l'axe des altitudes et la colonne de vent, qui restent fixes
    $: narrow = width < 480;
    $: left = 38;
    $: panelW = narrow ? 44 : 52;
    /** Pas vertical (m) d'échantillonnage des courbes */
    const DZ = 10;

    let scrollEl: HTMLDivElement;

    // Tout premier affichage : on fait défiler pour montrer la courbe d'état près du sol.
    // Ensuite les courbes gardent leur position (changement d'heure, de jour, d'onglet…)
    let scrollReady = false;
    $: if (scrollEl && !scrollReady) {
        scrollReady = true;
        const target = px(xOf(column.t2m, column.ground)) - left - viewW * 0.6;
        tick().then(() => {
            scrollEl.scrollLeft = savedScroll ?? Math.max(0, target);
            savedScroll = scrollEl.scrollLeft;
        });
    }

    const range = (from: number, to: number, step: number) => {
        const out: number[] = [];
        for (let v = from; v <= to + 1e-6; v += step) out.push(v);
        return out;
    };
    const r50 = (z: number) => Math.round(z / 50) * 50;

    /** Abscisse redressée (°C) d'une température T (K) à l'altitude z */
    const xOf = (tK: number, z: number) => tK - K + GAMMA_D * z;

    /** Largeur visible de la zone des courbes, et largeur réelle (plus grande si elle défile) */
    $: viewW = Math.max(120, width - left - panelW - gap);
    $: plotW = narrow ? Math.max(viewW, MIN_PLOT_W) : viewW;
    /** Position de la colonne de vent dans le cadre (et dans son propre viewBox) */
    $: panelX = left + viewW + gap;
    $: span = Math.max(500, yMax - yMin);
    $: y = (z: number) => top + plotH * (1 - (z - yMin) / span);

    // --- Chemin de la particule
    $: zProfileTop = column.profile[column.profile.length - 1].z;
    $: parcel = parcelPath(column, Math.min(yMax, zProfileTop));

    /** Échantillonne une variable du profil tous les DZ mètres (courbe interpolée) */
    const sample = (col: Column, key: 't' | 'td', zTop: number) => {
        const pts: { z: number; t: number }[] = [];
        const z0 = col.profile[0].z;
        const z1 = Math.min(zTop, col.profile[col.profile.length - 1].z);
        for (let z = z0; z <= z1; z += DZ) {
            const v = interpProfile(col.profile, z, key);
            if (v != null) pts.push({ z, t: v });
        }
        const last = interpProfile(col.profile, z1, key);
        if (last != null) pts.push({ z: z1, t: last });
        return pts;
    };

    $: tempPts = sample(column, 't', yMax + 300);
    $: dewPts = sample(column, 'td', yMax + 300);

    // --- Plage de l'axe redressé : courbe d'état, particule et rosée près du sol
    // (plus haut, la rosée peut sortir du cadre)
    $: xValues = [
        ...tempPts.filter(p => p.z >= yMin && p.z <= yMax).map(p => xOf(p.t, p.z)),
        ...parcel.filter(p => p.z <= yMax).map(p => xOf(p.t, p.z)),
        ...dewPts.filter(p => p.z <= column.ground + 1000).map(p => xOf(p.t, p.z)),
    ];
    // Marges réduites au strict nécessaire autour des courbes
    $: xLo = Math.floor((Math.min(...xValues) - 1) / 5) * 5;
    $: xHi = Math.ceil((Math.max(...xValues) + 1) / 5) * 5;
    $: xMin = xRange ? xRange[0] : xHi - xLo < 25 ? xHi - 25 : xLo;
    $: xMax = xRange ? xRange[1] : xHi;
    $: px = (xv: number) => left + ((xv - xMin) / (xMax - xMin)) * plotW;

    $: toPath = (pts: { z: number; t: number }[]) =>
        pts.map((p, i) => `${i ? 'L' : 'M'}${px(xOf(p.t, p.z)).toFixed(1)},${y(p.z).toFixed(1)}`).join('');

    // --- Fond
    $: dryAdiabats = range(xMin, xMax, xMax - xMin > 60 ? 10 : 5);
    $: isotherms = range(
        Math.floor((xMin - GAMMA_D * yMax) / 5) * 5,
        Math.ceil((xMax - GAMMA_D * yMin) / 5) * 5,
        5,
    );
    $: altMinor = range(Math.ceil(yMin / 250) * 250, yMax, span > 5000 ? 500 : 250);
    $: altLabels = range(Math.ceil(yMin / 1000) * 1000, yMax, span > 3000 ? 1000 : 500).filter(
        z => Math.abs(z - column.ground) > span * 0.04,
    );
    $: moistAdiabats = range(xMin - 40, xMax + 10, 10).map(xv =>
        toPath(moistAdiabat(column.profile, xv - GAMMA_D * yMin + K, yMin, yMax, 25)),
    );
    $: mixingLines = [1, 2, 3, 5, 8, 12, 20].map(w => {
        const pts = range(yMin, yMax, 100).map(z => ({
            z,
            t: dewPointFromMixingRatio(w / 1000, pressureAt(column.profile, z)),
        }));
        const zl = Math.max(yMin, column.ground);
        const tl = dewPointFromMixingRatio(w / 1000, pressureAt(column.profile, zl));
        return { w, d: toPath(pts), labelX: px(xOf(tl, zl)) };
    });
    $: labelY = y(Math.max(yMin, column.ground)) - 3;

    // --- Courbe d'état découpée par classe de stabilité
    const classify = (lapse: number, tK: number, p: number): Stability =>
        lapse > GAMMA_D * 1.0001 ? 'absolute' : lapse > moistLapse(tK, p) ? 'conditional' : 'stable';

    /** Gradient vertical (°C/m, positif si la température baisse) et stabilité à l'altitude z */
    $: stabilityAt = (z: number) => {
        const a = interpProfile(column.profile, z - DZ, 't');
        const b = interpProfile(column.profile, z + DZ, 't');
        if (a == null || b == null) return null;
        const lapse = (a - b) / (2 * DZ);
        const t = (a + b) / 2;
        return { lapse, kind: classify(lapse, t, pressureAt(column.profile, z)) };
    };

    $: tempSegments = (() => {
        const segs: { kind: Stability; d: string }[] = [];
        let run: { z: number; t: number }[] = [];
        let kind: Stability | null = null;
        for (let i = 0; i < tempPts.length - 1; i++) {
            const a = tempPts[i];
            const b = tempPts[i + 1];
            const lapse = (a.t - b.t) / (b.z - a.z || 1);
            const k = classify(lapse, (a.t + b.t) / 2, pressureAt(column.profile, (a.z + b.z) / 2));
            if (k !== kind && run.length) {
                segs.push({ kind: kind as Stability, d: toPath(run) });
                run = [run[run.length - 1]];
            }
            kind = k;
            if (!run.length) run.push(a);
            run.push(b);
        }
        if (run.length > 1 && kind) segs.push({ kind, d: toPath(run) });
        return segs;
    })();
    $: tempHalo = toPath(tempPts);
    $: dewPath = toPath(dewPts);
    $: parcelD = toPath(parcel);

    /** Température de la particule (K) à l'altitude z, si elle est sur son chemin */
    $: parcelAt = (z: number): number | null => {
        if (z < parcel[0].z || z > parcel[parcel.length - 1].z) return null;
        for (let i = 0; i < parcel.length - 1; i++) {
            const a = parcel[i];
            const b = parcel[i + 1];
            if (z >= a.z && z <= b.z) return a.t + ((b.t - a.t) * (z - a.z)) / (b.z - a.z || 1);
        }
        return parcel[parcel.length - 1].t;
    };

    /** Abscisse de l'étiquette d'un niveau : juste à droite de la courbe d'état à cette altitude */
    $: markX = (z: number) => {
        const t = interpProfile(column.profile, z, 't');
        const x = t == null ? left + 8 : px(xOf(t, z)) + 10;
        return Math.min(Math.max(x, left + 6), left + plotW - 120);
    };

    /** Couleur d'une classe de stabilité ; « stable » suit le thème (clair sur fond sombre, sombre sur fond clair) */
    const stabilityColor = (k: Stability) => (k === 'stable' ? 'var(--wpp-stable)' : STABILITY[k].color);

    // --- Niveaux remarquables
    type Mark = { z: number; label: string; color: string; dash: string };
    $: marks = [
        column.cuTop != null ? { z: column.cuTop, label: tr('Sommet Cu', 'Cu top'), color: 'var(--wpp-fg-dim)', dash: '2 3' } : null,
        column.cuBase != null ? { z: column.cuBase, label: tr('Base Cu', 'Cu base'), color: 'var(--wpp-fg)', dash: '6 3' } : null,
        column.cuBase == null && column.ceiling != null
            ? { z: column.ceiling, label: tr('Plafond', 'Ceiling'), color: 'var(--wpp-fg)', dash: '' }
            : null,
        // Un niveau collé au sol (moins de 100 m) n'apporte rien et masquerait les valeurs au sol
    ].filter((m): m is Mark => !!m && m.z <= yMax && m.z - column.ground >= 100);

    // --- Colonne de vent : flèches dimensionnées par la force, couche convective en jaune
    $: blTop = column.thermalTop != null ? Math.min(column.thermalTop, yMax) : null;
    // Colonne de vent dense : tous les 100 m dès qu'il y a ~12 px par ligne
    $: windStep = [100, 200, 250, 500, 1000].find(s => (s / span) * plotH >= 12) ?? 1000;
    $: windGapPx = (windStep / span) * plotH;
    $: winds = range(
        Math.ceil(Math.max(yMin, column.ground + windStep * 0.4) / windStep) * windStep,
        yMax - windStep * 0.3,
        windStep,
    )
        .map(z => {
            const w = windAt(column.profile, z);
            if (!w) return null;
            const kmh = Math.round(toKmh(w.speed));
            const len = Math.min(10 + Math.min(kmh, 60) / 6, windGapPx * 0.95);
            return {
                y: y(z),
                dir: w.dir,
                kmh,
                color: windColor(kmh, light),
                arrow: arrowPath(len, 4 + len * 0.15, 3 + len * 0.12, 0.9 + len * 0.04),
            };
        })
        .filter((w): w is NonNullable<typeof w> => !!w);

    // --- Survol : lecture des valeurs à l'altitude pointée
    let hover: { z: number; x: number } | null = null;

    const onMove = (e: MouseEvent) => {
        // Coordonnées dans le cadre global (les trois SVG sont alignés en haut)
        const r = wrapEl.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const z = yMin + (1 - (my - top) / plotH) * span;
        hover = z >= Math.max(yMin, column.ground) && z <= yMax ? { z, x: mx } : null;
    };

    $: readout = hover
        ? (() => {
              const z = hover.z;
              const t = interpProfile(column.profile, z, 't');
              const td = interpProfile(column.profile, z, 'td');
              const p = parcelAt(z);
              const w = windAt(column.profile, z);
              const s = stabilityAt(z);
              return {
                  p: pressureAt(column.profile, z),
                  t: t == null ? null : t - K,
                  td: td == null ? null : td - K,
                  parcel: p == null ? null : p - K,
                  lapse: s ? s.lapse * 1000 : null,
                  stability: s?.kind ?? null,
                  wind: w ? { kmh: Math.round(toKmh(w.speed)), dir: w.dir } : null,
              };
          })()
        : null;

    // --- Position de l'infobulle, toujours dans le cadre ; au doigt, dans la moitié opposée
    const TIP_W = 196;
    const TIP_H = 200;
    let pointerType = 'mouse';
    let wrapEl: HTMLDivElement;

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

    $: tipX = !hover
        ? 0
        : pointerType === 'mouse'
          ? clamp(hover.x + 16 + TIP_W > width ? hover.x - 16 - TIP_W : hover.x + 16, 4, width - TIP_W - 4)
          : clamp(hover.x - TIP_W / 2, 4, width - TIP_W - 4);
    $: tipY = !hover
        ? 0
        : pointerType === 'mouse'
          ? clamp(y(hover.z) - 40, 4, height - TIP_H)
          : y(hover.z) > top + plotH / 2
            ? top + 4
            : clamp(top + plotH - TIP_H, 4, height - TIP_H);

    /** Un toucher en dehors de l'émagramme ferme l'infobulle */
    const onWindowPointer = (e: PointerEvent) => {
        if (hover && wrapEl && !wrapEl.contains(e.target as Node)) hover = null;
    };
</script>

<style lang="less">
    .wpp-ema-wrap {
        position: relative;
        max-width: 100%;
    }

    .wpp-ema-side {
        position: absolute;
        top: 0;
    }

    .wpp-ema-scroll {
        position: absolute;
        top: 0;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
    }

    .wpp-ema {
        display: block;
        color: var(--wpp-line);
        user-select: none;

        .wpp-axis {
            fill: var(--wpp-fg-dim);
            font-size: 10px;
            &--ground {
                fill: var(--wpp-fg-faint);
            }
        }
        .wpp-axis-hover {
            font-size: 10px;
            font-weight: bold;
            fill: #111;
        }
        .wpp-iso-label {
            fill: var(--wpp-fg-faint);
            font-size: 9px;
            paint-order: stroke;
            stroke: var(--wpp-halo);
            stroke-width: 3px;
        }
        .wpp-dry {
            stroke: #4caf50;
            stroke-opacity: 0.45;
            stroke-width: 1;
        }
        .wpp-moist {
            fill: none;
            stroke: #4caf50;
            stroke-opacity: 0.5;
            stroke-width: 1;
            stroke-dasharray: 5 4;
        }
        .wpp-mixing {
            fill: none;
            stroke: #f0b13a;
            stroke-opacity: 0.5;
            stroke-width: 1;
            stroke-dasharray: 1.5 3;
        }
        .wpp-mixing-label {
            fill: #f0b13a;
            font-size: 9.5px;
            paint-order: stroke;
            stroke: var(--wpp-halo);
            stroke-width: 3px;
        }
        .wpp-halo {
            fill: none;
            stroke: var(--wpp-halo);
            stroke-opacity: 0.55;
            stroke-width: 6;
            stroke-linejoin: round;
            stroke-linecap: round;
        }
        .wpp-curve {
            fill: none;
            stroke-linejoin: round;
            stroke-linecap: round;
            &--temp {
                stroke-width: 3;
            }
            &--dew {
                stroke: #4ea3ff;
                stroke-width: 2.4;
            }
            &--parcel {
                stroke: var(--wpp-parcel);
                stroke-width: 1.6;
                stroke-dasharray: 6 4;
                stroke-opacity: 0.85;
            }
        }
        .wpp-ring {
            fill: none;
            stroke-width: 2;
            &--temp {
                stroke: var(--wpp-fg);
            }
            &--dew {
                stroke: #4ea3ff;
            }
        }
        .wpp-surf {
            font-size: 10.5px;
            font-weight: bold;
            paint-order: stroke;
            stroke: var(--wpp-halo);
            stroke-width: 3px;
            &--temp {
                fill: var(--wpp-stable);
            }
            &--dew {
                fill: var(--wpp-dew);
            }
        }
        .wpp-mark {
            font-size: 10.5px;
            font-weight: bold;
            paint-order: stroke;
            stroke: var(--wpp-halo);
            stroke-width: 3px;
        }
        .wpp-wind {
            font-size: 9.5px;
            font-weight: bold;
            paint-order: stroke;
            stroke: var(--wpp-halo);
            stroke-width: 2.5px;
        }
        .wpp-hit {
            cursor: crosshair;
        }
    }

    .wpp-tip {
        position: absolute;
        z-index: 5;
        width: 196px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--wpp-popup-bg);
        border: 1px solid var(--wpp-popup-border);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
        font-size: 11.5px;
        line-height: 1.55;
        color: var(--wpp-fg-dim);
        pointer-events: none;

        &__title {
            font-size: 13px;
            font-weight: bold;
            color: var(--wpp-fg);
            span {
                font-weight: normal;
                opacity: 0.7;
            }
        }
        &__stab {
            font-weight: bold;
            margin-bottom: 3px;
        }
        &__row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            b {
                color: var(--wpp-fg);
                white-space: nowrap;
            }
        }
        .wpp-c-dew {
            color: var(--wpp-dew);
        }
        .wpp-c-parcel {
            color: var(--wpp-parcel);
        }
    }
</style>
