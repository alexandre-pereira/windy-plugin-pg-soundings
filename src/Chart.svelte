<svelte:window on:pointerdown={onWindowPointer} />

<div class="wpp-chart-outer" bind:this={wrapEl} style="width:{width}px;height:{height}px">
<!-- Zone du graphique : commence après l'axe des altitudes et défile si l'écran est étroit -->
<div
    class="wpp-chart-scroll"
    style="left:{left}px;width:{width - left}px;height:{height}px"
    bind:this={scrollEl}
    on:scroll={() => (savedScroll = scrollX = scrollEl.scrollLeft)}
>
<div class="wpp-chart-wrap" style="width:{W - left}px;height:{height}px">
    {#if n > 0}
        <!-- Fond : ciel, thermiques, nuages et nuit, rendus en champ continu lissé -->
        <canvas
            bind:this={canvasEl}
            class="wpp-field"
            style="left:0;top:{top}px;width:{plotW}px;height:{mainH}px"
        ></canvas>
    {/if}

    <!-- Même repère que l'axe : le viewBox ne montre que la partie à droite de la marge -->
    <svg bind:this={svgEl} width={W - left} {height} viewBox="{left} 0 {W - left} {height}" class="wpp-chart">
        {#if n > 0}
            <defs>
                <clipPath id="wpp-chart-clip">
                    <rect x={left} y={top} width={plotW} height={mainH} />
                </clipPath>
                <filter id="wpp-cu-goo" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
                    <feColorMatrix
                        in="blur"
                        mode="matrix"
                        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
                        result="goo"
                    />
                    <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#0b1118" flood-opacity="0.35" />
                </filter>
                <linearGradient id="wpp-ground-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#7a5f45" />
                    <stop offset="1" stop-color="#3f3025" />
                </linearGradient>
            </defs>

            <!-- Grille altitude -->
            {#each gridLines as z}
                <line
                    x1={left}
                    x2={left + plotW}
                    y1={y(z)}
                    y2={y(z)}
                    stroke="currentColor"
                    stroke-opacity="0.1"
                />
                {#if showAltLabel(z)}
                    <text x={left - 6} y={y(z) + 3.5} class="wpp-axis" text-anchor="end">{z}</text>
                {/if}
            {/each}
            <!-- Altitude du sol (vue par le modèle), comme sur l'émagramme -->
            {#if ground > yMin + span * 0.04}
                <text x={left - 6} y={y(ground) + 3.5} class="wpp-axis wpp-axis--ground" text-anchor="end"
                    >{ground}</text
                >
            {/if}

            <!-- Séparateurs de colonnes -->
            {#each cols as _, i}
                {#if i > 0}
                    <line
                        x1={left + i * colW}
                        x2={left + i * colW}
                        y1={top}
                        y2={top + mainH}
                        stroke="currentColor"
                        stroke-opacity="0.05"
                    />
                {/if}
            {/each}

            <g clip-path="url(#wpp-chart-clip)">
                <!-- Relief (altitude du modèle) -->
                {#if ground > yMin}
                    <rect
                        x={left}
                        y={y(ground)}
                        width={plotW}
                        height={top + mainH - y(ground)}
                        fill="url(#wpp-ground-grad)"
                    />
                    <line
                        x1={left}
                        x2={left + plotW}
                        y1={y(ground)}
                        y2={y(ground)}
                        stroke="#b08b68"
                        stroke-width="1.5"
                    />
                {/if}

                <!-- Isotherme 0 °C -->
                <path d={freezingPath} class="wpp-freezing" />
                {#if freezingLabel}
                    <text x={freezingLabel.x - 4} y={freezingLabel.y - 5} class="wpp-freezing-label" text-anchor="end"
                        >0 °C</text
                    >
                {/if}

                <!-- Cumulus : empilement de « bourgeons » ronds, base plate, qui s'affine vers le sommet -->
                {#each cols as col, i}
                    {#if col.cu}
                        <clipPath id="wpp-cu-clip-{i}">
                            <rect x={col.cu.x - col.cu.w} y={top} width={col.cu.w * 2} height={col.cu.yb - top} />
                        </clipPath>
                        <g clip-path="url(#wpp-cu-clip-{i})" opacity="0.95">
                            <!-- Les bourgeons fusionnent en une seule silhouette lisse (filtre « goo ») -->
                            <g filter="url(#wpp-cu-goo)">
                                {#each col.cu.puffs as p}
                                    <circle cx={p.x} cy={p.y} r={p.r} style="fill: var(--wpp-cloud)" />
                                {/each}
                            </g>
                        </g>
                        <line
                            x1={col.cu.x - col.cu.w * 0.46}
                            x2={col.cu.x + col.cu.w * 0.46}
                            y1={col.cu.yb}
                            y2={col.cu.yb}
                            stroke="#aebccb"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        />
                    {/if}
                {/each}

                <!-- Plafond thermique exploitable -->
                <path d={ceilingPath} class="wpp-ceiling wpp-ceiling--halo" />
                <path d={ceilingPath} class="wpp-ceiling" />
                {#each cols as col, i}
                    {#if col.src.ceiling != null && col.src.ceiling < yMax}
                        <circle cx={cx(i)} cy={y(col.src.ceiling)} r="2.8" style="fill: var(--wpp-ceiling); stroke: var(--wpp-halo)" />
                    {/if}
                {/each}

                <!-- Vent en altitude -->
                {#each cols as col, i}
                    {#each col.winds as w}
                        <path
                            d={arrow}
                            transform="translate({cx(i)},{w.y - (showWindText ? 5 : 0)}) rotate({w.dir + 180})"
                            fill={w.color}
                            style="stroke: var(--wpp-halo)"
                            stroke-width="0.7"
                            stroke-opacity="0.8"
                        />
                        {#if showWindText}
                            <text x={cx(i)} y={w.y + 12} class="wpp-wind" fill={w.color} text-anchor="middle"
                                >{w.kmh}</text
                            >
                        {/if}
                    {/each}
                {/each}

                <!-- Nuages situés au-dessus du haut du graphique (souvent ceux qui donnent la pluie) :
                     bande blanche en haut, d'autant plus opaque que la couche est épaisse -->
                {#each shown as c, i}
                    {@const above = cloudAbove(c, yMax)}
                    {#if above > 0.05}
                        <rect
                            x={left + i * colW}
                            y={top}
                            width={colW + 0.5}
                            height="7"
                            style="fill: var(--wpp-cloud)"
                            opacity={0.25 + 0.75 * above}
                        />
                    {/if}
                {/each}

                <!-- Lever et coucher du soleil (heures officielles) -->
                {#each sunMarks as s}
                    <line
                        x1={s.x}
                        x2={s.x}
                        y1={top + 16}
                        y2={top + mainH}
                        style="stroke: var(--wpp-sun)"
                        stroke-opacity="0.7"
                        stroke-width="1.2"
                        stroke-dasharray="2 4"
                    />
                    <text
                        x={s.x}
                        y={top + 12}
                        class="wpp-sun"
                        text-anchor={s.x < left + 30 ? 'start' : s.x > left + plotW - 30 ? 'end' : 'middle'}
                        >{s.label}</text
                    >
                {/each}

                <!-- Risque convectif en haut de la colonne : cumulus bourgeonnant (surdéveloppement
                     possible) ou cumulonimbus avec éclair (orage probable) -->
                {#each shown as c, i}
                    {#if c.stormRisk > 0}
                        <StormIcon level={c.stormRisk === 2 ? 2 : 1} size={15} x={cx(i) - 7.5} y={top + 17} />
                    {/if}
                {/each}

                <!-- Maintenant -->
                {#if nowX != null}
                    <line
                        x1={nowX}
                        x2={nowX}
                        y1={top}
                        y2={top + mainH}
                        stroke="#ff5a5a"
                        stroke-width="1.5"
                        stroke-dasharray="4 3"
                    />
                {/if}
            </g>

            <!-- Cadre (décalé d'un demi-pixel pour ne pas être rogné par la zone de défilement) -->
            <rect
                x={left + 0.5}
                y={top}
                width={plotW - 1}
                height={mainH}
                rx="3"
                fill="none"
                stroke="currentColor"
                stroke-opacity="0.25"
            />

            <!-- Heures -->
            {#each cols as col, i}
                {#if colW >= 22 || i % 2 === 0}
                    <text
                        x={cx(i)}
                        y={top + mainH + 14}
                        class="wpp-hour"
                        class:wpp-hour--selected={col.src.ts === selectedTs}
                        text-anchor="middle">{hourShort(col.src.hour)}</text
                    >
                {/if}
            {/each}

            <!-- Pluviométrie de chaque heure (mm), sous les heures -->
            <rect x={left} y={rainTop} width={plotW} height={RAIN_H} rx="3" fill="currentColor" opacity="0.05" />
            {#each cols as col, i}
                {@const mm = col.src.precip}
                {#if mm >= 0.1}
                    {@const h = rainBarH(mm)}
                    {@const snowH = h * Math.min(1, col.src.snow / mm)}
                    {@const mostlySnow = col.src.snow >= mm / 2}
                    <!-- Pluie en bleu en bas, neige en violet pâle au-dessus -->
                    <rect
                        x={left + i * colW + colW * 0.18}
                        y={rainTop + RAIN_H - 1 - h}
                        width={colW * 0.64}
                        height={h}
                        rx="2"
                        fill={mm >= 2 ? '#2f7cf6' : '#5aa8ff'}
                    />
                    {#if snowH > 0.5}
                        <rect
                            x={left + i * colW + colW * 0.18}
                            y={rainTop + RAIN_H - 1 - h}
                            width={colW * 0.64}
                            height={snowH}
                            rx="2"
                            style="fill: var(--wpp-snow)"
                        />
                    {/if}
                    <text
                        x={cx(i)}
                        y={rainTop + RAIN_H - 3 - h}
                        class="wpp-rain"
                        class:wpp-rain--snow={mostlySnow}
                        text-anchor="middle">{mm < 10 ? mm.toFixed(1) : Math.round(mm)}</text
                    >
                {/if}
            {/each}


            <!-- Survol : colonne et altitude pointées -->
            {#if hover}
                <rect
                    x={left + hover.i * colW}
                    y={top}
                    width={colW}
                    height={height - top}
                    fill="currentColor"
                    opacity="0.07"
                    pointer-events="none"
                />
                {#if hover.z != null}
                    <line
                        x1={left}
                        x2={left + plotW}
                        y1={hover.y}
                        y2={hover.y}
                        stroke="currentColor"
                        stroke-opacity="0.55"
                        stroke-dasharray="3 3"
                        pointer-events="none"
                    />
                    <rect x="2" y={hover.y - 8} width={left - 4} height="16" rx="3" fill="#ffd24a" />
                    <text x={left / 2} y={hover.y + 3.5} class="wpp-axis-hover" text-anchor="middle"
                        >{r50(hover.z)}</text
                    >
                {/if}
            {/if}

            <!-- Heure sélectionnée pour l'émagramme -->
            {#each cols as col, i}
                {#if col.src.ts === selectedTs}
                    <rect
                        x={left + i * colW + 1}
                        y={top + 1}
                        width={colW - 2}
                        height={height - top - 2}
                        fill="none"
                        stroke="#ffd24a"
                        stroke-width="2"
                        rx="3"
                        pointer-events="none"
                    />
                {/if}
            {/each}

            <!-- Zone interactive : survol = infobulle, clic = heure de l'émagramme -->
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <rect
                x={left}
                y={top}
                width={plotW}
                height={height - top}
                fill="transparent"
                pointer-events="all"
                class="wpp-hit"
                on:mousemove={onMove}
                on:pointerdown={e => (pointerType = e.pointerType)}
                on:mouseleave={() => pointerType === 'mouse' && (hover = null)}
                on:click={onClick}
            />
        {/if}
    </svg>

    {#if hover && tip}
        <div class="wpp-tip" style="left:{tipX - left}px;top:{tipY}px">
            <div class="wpp-tip__title">
                {hourText(tip.col.hour)}
                {#if tip.alt}<span>· {r50(tip.alt.z)} m</span>{/if}
            </div>
            {#if tip.alt}
                {#if tip.alt.wind}
                    <div class="wpp-tip__row">
                        <span>{tr('Vent', 'Wind')}</span>
                        <b style="color:{windColor(tip.alt.wind.kmh, light)}"
                            >{tip.alt.wind.kmh} km/h {cardinal(tip.alt.wind.dir)}</b
                        >
                    </div>
                {/if}
                {#if tip.alt.t != null}
                    <div class="wpp-tip__row"><span>{tr('Température', 'Temperature')}</span><b>{tip.alt.t.toFixed(1)} °C</b></div>
                {/if}
                {#if tip.alt.w > 0.1}
                    <div class="wpp-tip__row">
                        <span>{tr('Ascendance', 'Climb')}</span>
                        <b><i class="wpp-sw" style="background:{thermalColor(tip.alt.w)}"></i>{tip.alt.w.toFixed(1)} m/s</b>
                    </div>
                {/if}
                {#if tip.alt.cloud > 3}
                    <div class="wpp-tip__row"><span>{tr('Nuages', 'Clouds')}</span><b>{Math.round(tip.alt.cloud)} %</b></div>
                {/if}
                <div class="wpp-tip__sep"></div>
            {/if}
            {#if tip.col.cloudCover > 0.03}
                <div class="wpp-tip__row">
                    <span>{tr('Nuages (total)', 'Clouds (total)')}</span><b>{Math.round(tip.col.cloudCover * 100)} %</b>
                </div>
            {/if}
            {#if cloudAbove(tip.col, yMax) > 0.05}
                <div class="wpp-tip__row">
                    <span>{tr(`Nuages au-dessus de ${yMax} m`, `Clouds above ${yMax} m`)}</span><b
                        >{Math.round(cloudAbove(tip.col, yMax) * 100)} %</b
                    >
                </div>
            {/if}
            {#if tip.col.ceiling != null}
                <div class="wpp-tip__row">
                    <span>{tr('Plafond exploitable', 'Usable ceiling')}</span><b>{r50(tip.col.ceiling)} m</b>
                </div>
                {#if tip.col.thermalTop != null && tip.col.cuBase == null && tip.col.thermalTop - tip.col.ceiling >= 100}
                    <div class="wpp-tip__row">
                        <span>{tr('Sommet thermique', 'Thermal top')}</span><b>{r50(tip.col.thermalTop)} m</b>
                    </div>
                {/if}
            {:else}
                <div class="wpp-tip__row"><span>{tr('Thermiques', 'Thermals')}</span><b>{tr('aucun', 'none')}</b></div>
            {/if}
            {#if tip.col.cuBase != null}
                <div class="wpp-tip__row">
                    <span>Cumulus</span><b
                        >{r50(tip.col.cuBase)}{tip.col.cuTop != null ? `–${r50(tip.col.cuTop)}` : ''} m</b
                    >
                </div>
            {/if}
            {#if tip.col.wStar >= 0.2}
                <div class="wpp-tip__row">
                    <span>{tr('Ascendance max', 'Max climb')}</span><b><i class="wpp-sw" style="background:{thermalColor(tip.col.wStar)}"></i>{tip.col.wStar.toFixed(1)} m/s</b>
                </div>
            {/if}
            <div class="wpp-tip__row">
                <span>{tr('Vent sol', 'Surface wind')}</span>
                <b style="color:{windColor(toKmh(tip.col.windSurf), light)}"
                    >{Math.round(toKmh(tip.col.windSurf))} km/h {cardinal(tip.col.windDirSurf)}</b
                >
            </div>
            {#if tip.col.gust != null}
                <div class="wpp-tip__row">
                    <span>{tr('Rafales sol', 'Surface gusts')}</span>
                    <b style="color:{windColor(toKmh(tip.col.gust), light)}">{Math.round(toKmh(tip.col.gust))} km/h</b>
                </div>
            {/if}
            <div class="wpp-tip__row">
                <span>{tr('T° / rosée sol', 'Surface T° / dew')}</span>
                <b
                    >{toCelsius(tip.col.t2m).toFixed(0)}°{tip.col.td2m != null
                        ? ` / ${toCelsius(tip.col.td2m).toFixed(0)}°`
                        : ''}</b
                >
            </div>
            {#if tip.col.freezing != null}
                <div class="wpp-tip__row"><span>{tr('Isotherme 0 °C', 'Freezing level')}</span><b>{r50(tip.col.freezing)} m</b></div>
            {/if}
            {#if tip.col.stormRisk > 0}
                <div class="wpp-tip__row">
                    <span style="color:{tip.col.stormRisk === 2 ? '#ef4444' : '#f59e0b'}"
                        ><StormIcon level={tip.col.stormRisk === 2 ? 2 : 1} size={13} />
                        {tip.col.stormRisk === 2 ? tr('Orage probable', 'Storm likely') : tr('Surdéveloppement', 'Overdevelopment')}</span
                    ><b>CAPE {tip.col.cape}</b>
                </div>
            {/if}
            {#if tip.col.precip - tip.col.snow >= 0.1}
                <div class="wpp-tip__row">
                    <span>{tr('Pluie', 'Rain')}</span><b>{(tip.col.precip - tip.col.snow).toFixed(1)} mm</b>
                </div>
            {/if}
            {#if tip.col.snow >= 0.1}
                <div class="wpp-tip__row">
                    <span>{tr('Neige', 'Snow')}</span><b
                        >~{Math.max(1, Math.round(tip.col.snow))} cm <small>({tip.col.snow.toFixed(1)} mm {tr('d’eau', 'water')})</small></b
                    >
                </div>
            {/if}
            <div class="wpp-tip__hint">
                {pointerType === 'mouse'
                    ? tr('Clic : émagramme de cette heure', 'Click: sounding for this hour')
                    : tr('Onglet « Émagramme » : détail de cette heure', 'Sounding tab: details for this hour')}
            </div>
        </div>
    {/if}
</div>
</div>

    <!-- Axe des altitudes, fixe (le graphique défile à sa droite sur smartphone) -->
    {#if n > 0}
        <svg class="wpp-chart-axis" width={left} {height} viewBox="0 0 {left} {height}">
            <!-- Bord gauche du graphique : reste net quand le graphique défile -->
            <line
                x1={left - 0.5}
                x2={left - 0.5}
                y1={top}
                y2={top + mainH}
                stroke="currentColor"
                stroke-opacity="0.3"
            />
            {#each gridLines as z}
                <line x1={left - 4} x2={left - 0.5} y1={y(z)} y2={y(z)} stroke="currentColor" stroke-opacity="0.4" />
                {#if showAltLabel(z)}
                    <text x={left - 6} y={y(z) + 4} class="wpp-axis" text-anchor="end">{z}</text>
                {/if}
            {/each}
            {#if ground > yMin + span * 0.04}
                <line
                    x1={left - 4}
                    x2={left - 0.5}
                    y1={y(ground)}
                    y2={y(ground)}
                    stroke="#b08b68"
                    stroke-width="1.5"
                />
                <text x={left - 6} y={y(ground) + 4} class="wpp-axis wpp-axis--ground" text-anchor="end"
                    >{ground}</text
                >
            {/if}
            <text x={left - 6} y={rainTop + 13} class="wpp-axis wpp-axis--rain" text-anchor="end"
                >{tr('Pluie', 'Rain')}</text
            >
            <text x={left - 6} y={rainTop + 24} class="wpp-axis wpp-axis--unit" text-anchor="end"
                >mm</text
            >
            {#if hover?.z != null}
                <rect x="2" y={hover.y - 8} width={left - 4} height="16" rx="3" fill="#ffd24a" />
                <text x={left / 2} y={hover.y + 3.5} class="wpp-axis-hover" text-anchor="middle"
                    >{r50(hover.z)}</text
                >
            {/if}
        </svg>
    {/if}
</div>

<script context="module" lang="ts">
    /** Défilement horizontal du graphique, gardé quand on change de jour, d'onglet ou de lieu */
    let savedScroll: number | null = null;
</script>

<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';

    import { clockText, hourShort, hourText, tr } from './i18n';
    import StormIcon from './StormIcon.svelte';
    import {
        type Column,
        cardinal,
        interpProfile,
        nightFactor,
        skyColors,
        thermalColor,
        thermalRGB,
        thermalShape,
        toCelsius,
        toKmh,
        windAt,
        windColor,
    } from './physics';
    import { arrowPath, cumulusPuffs, smoothPath } from './svg';

    export let columns: Column[] = [];
    export let width = 760;
    export let yMin = 0;
    export let yMax = 4000;
    export let nowTs: number = Date.now();
    export let selectedTs: number | null = null;
    /** Lever et coucher du soleil (timestamps) et décalage horaire du lieu (h), pour l'affichage */
    export let sunrise: number | null = null;
    export let sunset: number | null = null;
    export let utcOffset = 0;
    /** Thème clair : fond du graphique (ciel, nuages, nuit) en couleurs claires */
    export let light = false;

    /** select : heure choisie ; open : clic à la souris, pour ouvrir l'émagramme de cette heure */
    const dispatch = createEventDispatcher<{ select: number; open: number }>();

    const range = (from: number, to: number, step: number) => {
        const out: number[] = [];
        for (let v = from; v <= to + 1e-6; v += step) out.push(v);
        return out;
    };

    /** Largeur minimale (px) d'une colonne horaire : en dessous, le graphique défile horizontalement */
    const MIN_COL = 30;
    // Pas de marge à droite : le graphique va jusqu'au bord du panneau
    const right = 1;
    const top = 8;
    const mainH = 430;
    /** Taille (px) d'une maille du champ de fond, lissée ensuite par le navigateur */
    const FIELD_RES = 1 / Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

    let canvasEl: HTMLCanvasElement | undefined;
    let svgEl: SVGSVGElement;

    const r50 = (z: number) => Math.round(z / 50) * 50;

    // Marge gauche réduite à la seule colonne des altitudes. Toutes les heures restent affichées :
    // si les colonnes deviennent trop fines, le graphique (largeur W) défile horizontalement
    const left = 40;
    $: shown = columns;
    $: W = Math.max(width, left + right + columns.length * MIN_COL);

    $: n = shown.length;
    $: plotW = Math.max(100, W - left - right);
    $: colW = n ? plotW / n : 0;
    /** Bandeau de pluviométrie sous les heures */
    const RAIN_H = 30;
    $: rainTop = top + mainH + 21;
    $: height = rainTop + RAIN_H + 3;
    /** Hauteur de barre (px) : racine carrée pour voir aussi les faibles pluies, plein à 5 mm */
    const rainBarH = (mm: number) => Math.max(2, Math.min(1, Math.sqrt(mm / 5)) * (RAIN_H - 13));
    $: ground = shown[0]?.ground ?? 0;
    $: span = Math.max(500, yMax - yMin);

    $: y = (z: number) => top + mainH * (1 - (z - yMin) / span);
    $: cx = (i: number) => left + (i + 0.5) * colW;

    // Pas des flèches de vent : au moins ~30 px entre deux lignes
    $: windStep = [100, 200, 250, 500, 1000].find(s => (s / span) * mainH >= 30) ?? 1000;
    $: gridStep = span <= 2500 ? 250 : span <= 5000 ? 500 : 1000;
    $: gridLines = range(Math.ceil(yMin / gridStep) * gridStep, yMax, gridStep);
    // On masque les graduations trop proches de l'altitude du sol, écrite à la place
    $: showAltLabel = (z: number) => !(ground > yMin + span * 0.04 && Math.abs(z - ground) < span * 0.04);
    $: showWindText = colW >= 20;
    $: arrow = arrowPath(Math.max(9, Math.min(17, colW * 0.6)), 6, 4.2, 1.2);

    /** Ascendance (m/s) estimée à l'altitude z dans une colonne */
    const thermalAt = (c: Column, z: number) =>
        c.thermalTop != null && c.wStar > 0 && z > c.ground && z < c.thermalTop
            ? c.wStar * thermalShape((z - c.ground) / (c.thermalTop - c.ground))
            : 0;

    $: cols = shown.map((src, i) => {
        const winds: { y: number; dir: number; kmh: number; color: string }[] = [];
        const firstRow = Math.ceil((src.ground + windStep * 0.5) / windStep) * windStep;
        for (
            let z = Math.max(firstRow, Math.ceil(yMin / windStep) * windStep);
            z <= yMax - windStep * 0.3;
            z += windStep
        ) {
            if (z <= src.ground) continue;
            const wind = windAt(src.profile, z);
            if (!wind) continue;
            const kmh = Math.round(toKmh(wind.speed));
            winds.push({ y: y(z), dir: wind.dir, kmh, color: windColor(kmh, light) });
        }

        let cu: { x: number; yb: number; w: number; puffs: { x: number; y: number; r: number }[] } | null = null;
        if (src.cuBase != null && src.cuBase < yMax) {
            const yb = y(src.cuBase);
            const w = Math.min(colW * 0.95, 64);
            const h = Math.min(yb - top, Math.max(w * 0.45, yb - y(src.cuTop ?? src.cuBase)));
            cu = { x: cx(i), yb, w, puffs: cumulusPuffs(cx(i), yb, w, h) };
        }

        return { src, winds, cu };
    });

    /** Nébulosité maximale (0-1) des niveaux du modèle situés au-dessus du haut du graphique */
    const cloudAbove = (c: Column, zTop: number) =>
        Math.max(0, ...c.profile.filter(p => p.z > zTop).map(p => p.cloud / 100));

    // --- Champ de fond (canvas) : ciel, thermiques, nuages, nuit — interpolé entre colonnes
    const mix = (a: number[], b: number[], t: number) => {
        a[0] += (b[0] - a[0]) * t;
        a[1] += (b[1] - a[1]) * t;
        a[2] += (b[2] - a[2]) * t;
    };

    const drawField = (
        canvas: HTMLCanvasElement,
        cols: Column[],
        w: number,
        zMin: number,
        zMax: number,
        isLight: boolean,
    ) => {
        // Ciel bleu le jour, bleu nuit la nuit (fondu à l'aube et au crépuscule) ; opacité des nuages
        // à 100 % de couverture : un ciel couvert doit se lire comme un voile plein
        const cloudAlpha = isLight ? 0.85 : 0.96;
        const gw = Math.max(1, Math.round(w / FIELD_RES));
        const gh = Math.max(1, Math.round(mainH / FIELD_RES));
        canvas.width = gw;
        canvas.height = gh;
        const ctx = canvas.getContext('2d');
        if (!ctx || !cols.length) return;

        const zAt = (row: number) => zMax - ((row + 0.5) / gh) * (zMax - zMin);
        const data = cols.map(c => {
            const cloud = new Float32Array(gh);
            for (let row = 0; row < gh; row++) {
                cloud[row] = (interpProfile(c.profile, zAt(row), 'cloud') ?? 0) / 100;
            }
            const night = nightFactor(c.sunElev);
            // Paramètres de la couche thermique : sans thermique, sommet au sol et force nulle
            const hasThermal = c.thermalTop != null && c.wStar > 0;
            return {
                cloud,
                night,
                ground: c.ground,
                top: hasThermal ? (c.thermalTop as number) : c.ground,
                wStar: hasThermal ? c.wStar : 0,
            };
        });

        /**
         * Entre deux heures, on interpole le sommet et la force des thermiques (spline de
         * Catmull-Rom, comme la ligne de plafond) plutôt que les couleurs altitude par altitude :
         * la zone thermique évolue ainsi sans cassure ni marche d'escalier.
         */
        const spline = (key: 'top' | 'wStar' | 'ground', i0: number, t: number) => {
            const p = (i: number) => data[Math.min(data.length - 1, Math.max(0, i))][key];
            const p0 = p(i0 - 1);
            const p1 = p(i0);
            const p2 = p(i0 + 1);
            const p3 = p(i0 + 2);
            const t2 = t * t;
            const t3 = t2 * t;
            const v =
                0.5 *
                (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
            // Pas de dépassement au-delà des deux heures encadrantes
            return Math.min(Math.max(v, Math.min(p1, p2)), Math.max(p1, p2));
        };

        const img = ctx.createImageData(gw, gh);
        const px = [0, 0, 0];
        const cw = w / cols.length;
        for (let gx = 0; gx < gw; gx++) {
            const pos = Math.min(cols.length - 1, Math.max(0, ((gx + 0.5) * FIELD_RES) / cw - 0.5));
            const i0 = Math.floor(pos);
            const i1 = Math.min(i0 + 1, cols.length - 1);
            const f = pos - i0;
            const a = data[i0];
            const b = data[i1];
            const night = a.night + (b.night - a.night) * f;
            const gz = spline('ground', i0, f);
            const topZ = spline('top', i0, f);
            const wStar = spline('wStar', i0, f);
            const depth = topZ - gz;
            const sky = skyColors(isLight, night);

            for (let gy = 0; gy < gh; gy++) {
                // Ciel : dégradé vertical
                const s = gy / gh;
                px[0] = sky.top[0] + (sky.bottom[0] - sky.top[0]) * s;
                px[1] = sky.top[1] + (sky.bottom[1] - sky.top[1]) * s;
                px[2] = sky.top[2] + (sky.bottom[2] - sky.top[2]) * s;

                const z = zAt(gy);
                const zr = (z - gz) / depth;
                const wv = depth > 20 && wStar > 0 ? wStar * thermalShape(zr) : 0;
                if (wv > 0.03) {
                    // Fondu doux sur les derniers ~3 % de la couche : bord supérieur net mais sans escalier
                    const edge = Math.min(1, Math.max(0, (1 - zr) / 0.03));
                    mix(px, thermalRGB(wv), Math.min(1, wv / 0.6) * 0.88 * edge);
                }

                const cl = a.cloud[gy] + (b.cloud[gy] - a.cloud[gy]) * f;
                // Courbe légèrement bombée : les couvertures moyennes se voient mieux, 100 % est presque opaque
                if (cl > 0.02) mix(px, sky.cloud, Math.pow(Math.min(1, cl), 0.8) * cloudAlpha);

                const k = (gy * gw + gx) * 4;
                img.data[k] = px[0];
                img.data[k + 1] = px[1];
                img.data[k + 2] = px[2];
                img.data[k + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    };

    $: if (canvasEl) drawField(canvasEl, shown, plotW, yMin, yMax, light);

    // --- Courbes lissées
    $: curve = (values: (number | null)[]) =>
        smoothPath(values.map((v, i) => (v == null || v > yMax + 200 ? null : { x: cx(i), y: y(v) })));

    $: ceilingPath = curve(shown.map(c => c.ceiling));
    $: freezingPath = curve(shown.map(c => c.freezing));
    $: freezingLabel = (() => {
        for (let i = n - 1; i >= 0; i--) {
            const f = shown[i].freezing;
            if (f != null && f < yMax && f > yMin) return { x: left + plotW, y: y(f) };
        }
        return null;
    })();

    $: stepMs = shown.length > 1 ? shown[1].ts - shown[0].ts : 3600e3;
    $: nowX =
        n && nowTs >= shown[0].ts && nowTs < shown[n - 1].ts + stepMs
            ? left + ((nowTs - shown[0].ts) / (shown[n - 1].ts + stepMs - shown[0].ts)) * plotW
            : null;

    /** Position horizontale d'un instant sur l'axe des heures (null s'il est hors du graphique) */
    $: xOfTs = (ts: number) =>
        n && ts >= shown[0].ts && ts <= shown[n - 1].ts + stepMs
            ? left + ((ts - shown[0].ts) / (shown[n - 1].ts + stepMs - shown[0].ts)) * plotW
            : null;

    const hhmm = (ts: number, offset: number) => {
        const d = new Date(ts + offset * 3600e3);
        return clockText(d.getUTCHours(), d.getUTCMinutes());
    };

    $: sunMarks = [
        { ts: sunrise, icon: '☀↑' },
        { ts: sunset, icon: '☀↓' },
    ]
        .map(s => (s.ts == null ? null : { x: xOfTs(s.ts), label: `${s.icon} ${hhmm(s.ts, utcOffset)}` }))
        .filter((s): s is { x: number; label: string } => !!s && s.x != null);

    // --- Survol et infobulle
    let hover: { i: number; z: number | null; x: number; y: number } | null = null;

    const pointer = (e: MouseEvent) => {
        const r = svgEl.getBoundingClientRect();
        const x = ((e.clientX - r.left) * (W - left)) / r.width + left;
        const yy = ((e.clientY - r.top) * height) / r.height;
        const i = Math.floor((x - left) / colW);
        if (i < 0 || i >= n) return null;
        const z = yy >= top && yy <= top + mainH ? yMin + (1 - (yy - top) / mainH) * span : null;
        return { i, z, x, y: yy };
    };

    const onMove = (e: MouseEvent) => (hover = pointer(e));

    const onClick = (e: MouseEvent) => {
        const p = pointer(e);
        if (p) {
            hover = p;
            dispatch('select', shown[p.i].ts);
            // Au doigt, le toucher affiche l'infobulle : on reste sur le graphique
            if (pointerType === 'mouse') dispatch('open', shown[p.i].ts);
        }
    };

    $: tip = hover && shown[hover.i] ? buildTip(shown[hover.i], hover.z) : null;

    const buildTip = (col: Column, z: number | null) => {
        if (z == null || z <= col.ground) return { col, alt: null };
        const wind = windAt(col.profile, z);
        const t = interpProfile(col.profile, z, 't');
        return {
            col,
            alt: {
                z,
                wind: wind ? { kmh: Math.round(toKmh(wind.speed)), dir: wind.dir } : null,
                t: t == null ? null : toCelsius(t),
                w: thermalAt(col, z),
                cloud: interpProfile(col.profile, z, 'cloud') ?? 0,
            },
        };
    };

    // --- Position de l'infobulle, toujours dans le cadre. Au doigt, on la place dans la moitié
    // du graphique opposée au point touché pour ne pas le masquer.
    const TIP_W = 196;
    const TIP_H = 250;
    let pointerType = 'mouse';
    let wrapEl: HTMLDivElement;
    let scrollEl: HTMLDivElement;
    let scrollX = 0;

    // Tout premier affichage : on fait défiler jusqu'à l'heure actuelle, sinon jusqu'à la mi-journée.
    // Ensuite le graphique garde sa position (changement de jour, d'onglet, de lieu…)
    let scrollReady = false;
    $: if (scrollEl && n && !scrollReady) {
        scrollReady = true;
        const nowIdx = shown.findIndex(c => nowTs >= c.ts && nowTs < c.ts + stepMs);
        const idx = nowIdx >= 0 ? nowIdx : Math.max(0, shown.findIndex(c => c.hour >= 11));
        tick().then(() => {
            scrollEl.scrollLeft = savedScroll ?? Math.max(0, idx * colW - (width - left) / 3);
            savedScroll = scrollX = scrollEl.scrollLeft;
        });
    }

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

    $: tipX = !hover
        ? 0
        : pointerType === 'mouse'
          ? clamp(
                hover.x + 16 + TIP_W > scrollX + width ? hover.x - 16 - TIP_W : hover.x + 16,
                scrollX + left + 4,
                scrollX + width - TIP_W - 4,
            )
          : clamp(hover.x - TIP_W / 2, scrollX + left + 4, scrollX + width - TIP_W - 4);
    $: tipY = !hover
        ? 0
        : pointerType === 'mouse'
          ? clamp(hover.y - 30, 4, height - TIP_H)
          : hover.y > top + mainH / 2
            ? top + 4
            : clamp(top + mainH - TIP_H, 4, height - TIP_H);

    /** Un toucher en dehors du graphique ferme l'infobulle */
    const onWindowPointer = (e: PointerEvent) => {
        if (hover && wrapEl && !wrapEl.contains(e.target as Node)) hover = null;
    };
</script>

<style lang="less">
    .wpp-chart-outer {
        position: relative;
        max-width: 100%;
    }

    .wpp-chart-scroll {
        position: absolute;
        top: 0;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
    }

    .wpp-chart-wrap {
        position: relative;
    }

    .wpp-chart-axis {
        position: absolute;
        left: 0;
        top: 0;
        pointer-events: none;
        color: var(--wpp-line);
        .wpp-axis {
            fill: var(--wpp-fg-dim);
            font-size: 11px;
            font-variant-numeric: tabular-nums;
            &--rain {
                fill: var(--wpp-rain);
                font-size: 10px;
            }
            &--unit {
                fill: var(--wpp-fg-faint);
                font-size: 9px;
            }
            &--ground {
                fill: var(--wpp-fg-faint);
            }
        }
        .wpp-axis-hover {
            font-size: 10px;
            font-weight: bold;
            fill: #111;
        }
    }

    .wpp-field {
        position: absolute;
        border-radius: 3px;
        image-rendering: auto;
    }

    .wpp-chart {
        position: relative;
        display: block;
        color: var(--wpp-line);
        font-family: inherit;
        user-select: none;

        .wpp-axis,
        .wpp-hour {
            fill: var(--wpp-fg-dim);
            font-size: 10px;
        }
        .wpp-axis--ground {
            fill: var(--wpp-fg-faint);
        }
        .wpp-axis-hover {
            font-size: 10px;
            font-weight: bold;
            fill: #111;
        }
        .wpp-hour {
            font-size: 10.5px;
            &--selected {
                fill: var(--wpp-accent);
                font-weight: bold;
            }
        }
        .wpp-sun {
            font-size: 10px;
            font-weight: bold;
            fill: var(--wpp-sun);
            paint-order: stroke;
            stroke: var(--wpp-halo);
            stroke-width: 3px;
        }
        .wpp-rain--snow {
            fill: var(--wpp-snow);
        }
        .wpp-rain {
            font-size: 9px;
            font-weight: bold;
            fill: var(--wpp-rain);
            paint-order: stroke;
            stroke: var(--wpp-halo);
            stroke-width: 2.5px;
        }
        .wpp-wind {
            font-size: 9.5px;
            font-weight: bold;
            paint-order: stroke;
            stroke: var(--wpp-halo);
            stroke-width: 2.8px;
            stroke-opacity: 0.85;
        }
        .wpp-ceiling {
            fill: none;
            stroke: var(--wpp-ceiling);
            stroke-width: 2.4;
            stroke-linejoin: round;
            stroke-linecap: round;
            &--halo {
                stroke: var(--wpp-halo);
                stroke-width: 5.5;
                stroke-opacity: 0.45;
            }
        }
        .wpp-freezing {
            fill: none;
            stroke: var(--wpp-freezing);
            stroke-width: 1.6;
            stroke-dasharray: 6 4;
        }
        .wpp-freezing-label {
            fill: var(--wpp-freezing);
            font-size: 10px;
            font-weight: bold;
            paint-order: stroke;
            stroke: var(--wpp-halo);
            stroke-width: 3px;
        }
        .wpp-hit {
            cursor: pointer;
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
            margin-bottom: 3px;
            span {
                font-weight: normal;
                color: var(--wpp-accent);
            }
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
        &__sep {
            height: 1px;
            margin: 4px 0;
            background: var(--wpp-border);
        }
        .wpp-sw {
            display: inline-block;
            width: 9px;
            height: 9px;
            margin-right: 5px;
            border-radius: 2px;
            vertical-align: 0;
        }
        &__hint {
            margin-top: 4px;
            font-size: 10px;
            opacity: 0.55;
        }
    }

</style>
