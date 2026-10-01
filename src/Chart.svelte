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
                    <!-- Contour sombre : la tour se détache nettement des nuages en couches du fond -->
                    <feMorphology in="goo" operator="dilate" radius="1.1" result="fat" />
                    <feFlood flood-color="#243244" flood-opacity="0.85" />
                    <feComposite in2="fat" operator="in" result="edge" />
                    <feMerge>
                        <feMergeNode in="edge" />
                        <feMergeNode in="goo" />
                    </feMerge>
                </filter>
                <linearGradient id="wpp-ground-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#7a5f45" />
                    <stop offset="1" stop-color="#3f3025" />
                </linearGradient>
                <!-- Hachures du bandeau des thermiques, quand le vent les hache -->
                <pattern id="wpp-ease-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="1.6" height="4" fill="#111" fill-opacity="0.5" />
                </pattern>
                <!-- Voile hachuré de la zone située au-dessus du dernier niveau fourni par le modèle -->
                <pattern
                    id="wpp-nodata-hatch"
                    class="wpp-plot"
                    width="7"
                    height="7"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                >
                    <rect width="7" height="7" style="fill: var(--wpp-halo)" fill-opacity="0.45" />
                    <rect width="1.2" height="7" fill="currentColor" fill-opacity="0.22" />
                </pattern>
            </defs>

            <!-- Grille altitude -->
            {#each gridLines as z}
                <line
                    class="wpp-plot"
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
                        class="wpp-plot"
                        x1={left + i * colW}
                        x2={left + i * colW}
                        y1={top}
                        y2={top + mainH}
                        stroke="currentColor"
                        stroke-opacity="0.05"
                    />
                {/if}
            {/each}

            <g class="wpp-plot" clip-path="url(#wpp-chart-clip)">
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

                <!-- Tours de nuages : empilement de « bourgeons » ronds, base plate et sombre, qui
                     s'affine vers le sommet. Blanches pour les cumulus de beau temps, grises quand il
                     en pleut (nuage d'averses, ou couche de nuages du modèle). Rideau de pluie dessous -->
                {#each cols as col, i}
                    {#if col.streaks}
                        {#each col.streaks.rows as row}
                            {#each [-0.28, -0.04, 0.2] as dx}
                                <line
                                    x1={col.streaks.x + (dx + row.shift) * col.streaks.w + 2.5}
                                    x2={col.streaks.x + (dx + row.shift) * col.streaks.w - 1.5}
                                    y1={col.streaks.y + 3 + row.dy}
                                    y2={col.streaks.y + 13 + row.dy}
                                    class="wpp-streak"
                                    stroke-opacity={row.alpha}
                                />
                            {/each}
                        {/each}
                    {/if}
                    {#each col.clouds as cu, k}
                        <clipPath id="wpp-cu-clip-{i}-{k}">
                            <rect x={cu.x - cu.w} y={top} width={cu.w * 2} height={cu.yb - top} />
                        </clipPath>
                        <linearGradient
                            id="wpp-cu-grad-{i}-{k}"
                            gradientUnits="userSpaceOnUse"
                            x1="0"
                            x2="0"
                            y1={cu.yb}
                            y2={cu.yb - cu.w * 0.7}
                        >
                            <stop offset="0" stop-color={cu.base} />
                            <stop offset="1" stop-color={cu.body} />
                        </linearGradient>
                        <g clip-path="url(#wpp-cu-clip-{i}-{k})">
                            <!-- Les bourgeons fusionnent en une seule silhouette lisse (filtre « goo ») -->
                            <g filter="url(#wpp-cu-goo)">
                                {#each cu.puffs as p}
                                    <circle cx={p.x} cy={p.y} r={p.r} fill="url(#wpp-cu-grad-{i}-{k})" />
                                {/each}
                            </g>
                        </g>
                        <line
                            x1={cu.x - cu.w * 0.46}
                            x2={cu.x + cu.w * 0.46}
                            y1={cu.yb}
                            y2={cu.yb}
                            stroke="#243244"
                            stroke-opacity="0.85"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        />
                    {/each}
                {/each}

                <!-- Plafond thermique exploitable -->
                <path d={ceilingPath} class="wpp-ceiling wpp-ceiling--halo" />
                <path d={ceilingPath} class="wpp-ceiling" />
                {#each cols as col, i}
                    {#if col.src.ceiling != null && col.src.ceiling < yMax}
                        <circle cx={cx(i)} cy={y(col.src.ceiling)} r="2.8" fill="#ffffff" style="stroke: var(--wpp-halo)" />
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

                <!-- Au-dessus du dernier niveau fourni par le modèle : ni vent ni nuages connus, la zone
                     est voilée pour ne pas se lire comme un ciel clair et calme -->
                {#each shown as c, i}
                    {#if profileTop(c) < yMax}
                        <rect
                            x={left + i * colW}
                            y={top}
                            width={colW + 0.5}
                            height={y(profileTop(c)) - top}
                            fill="url(#wpp-nodata-hatch)"
                        />
                    {/if}
                {/each}

                <!-- Nuages situés au-dessus du haut du graphique (souvent ceux qui donnent la pluie) :
                     bande claire en haut, d'autant plus opaque que la couche est épaisse -->
                {#each shown as c, i}
                    {@const above = cloudAbove(c, yMax)}
                    {#if above > 0.05}
                        <rect
                            x={left + i * colW}
                            y={top}
                            width={colW + 0.5}
                            height="7"
                            fill={rgbCss(skyColors(nightFactor(c.sunElev)).cloud)}
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
                        stroke="#ffc94a"
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
                     possible), cumulonimbus avec éclair (orage probable), violet à deux éclairs
                     (orage violent possible) -->
                {#each shown as c, i}
                    {#if c.stormRisk > 0}
                        <StormIcon level={c.stormRisk || 1} size={15} x={cx(i) - 7.5} y={top + 17} />
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
                class="wpp-plot"
                x={left + 0.5}
                y={top}
                width={plotW - 1}
                height={mainH}
                rx="3"
                fill="none"
                stroke="currentColor"
                stroke-opacity="0.25"
            />

            <!-- Facilité d'exploitation des thermiques de chaque heure : du vert (faciles) au rouge,
                 hachuré quand le vent les hache -->
            <rect x={left} y={easeTop} width={plotW} height={EASE_H} rx="3" fill="currentColor" opacity="0.05" />
            {#each cols as col, i}
                {#if col.ease}
                    <rect x={left + i * colW + 1} y={easeTop} width={colW - 2} height={EASE_H} rx="2" fill={col.ease.color} />
                    {#if col.ease.hatch}
                        <rect
                            x={left + i * colW + 1}
                            y={easeTop}
                            width={colW - 2}
                            height={EASE_H}
                            rx="2"
                            fill="url(#wpp-ease-hatch)"
                        />
                    {/if}
                {/if}
            {/each}

            <!-- Heures -->
            {#each cols as col, i}
                {#if colW >= 22 || i % 2 === 0}
                    <text x={cx(i)} y={hoursY} class="wpp-hour" text-anchor="middle"
                        >{hourShort(col.src.hour)}</text
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

            <!-- Instabilité de chaque heure, sur une ligne : CAPE standard à gauche de la case, LI à
                 droite, chacun sur la couleur de son palier -->
            {#each cols as col, i}
                {@const li = col.src.liftedIndex}
                {@const x0 = left + i * colW + 1}
                {@const cape = fitText(String(col.src.cape), ixCapeW)}
                <rect x={x0} y={ixTop} width={colW - 2} height={IX_H} rx="2" fill={capeColor(col.src.cape)} />
                <text
                    x={x0 + ixCapeW / 2}
                    y={ixTop + IX_H - 3.5}
                    class="wpp-ix"
                    font-size={ixFont}
                    text-anchor="middle"
                    textLength={cape.length}
                    lengthAdjust="spacingAndGlyphs">{cape.text}</text
                >
                {#if li != null}
                    {@const value = fitText(String(Math.round(li) || 0), ixLiW)}
                    <!-- Coins arrondis à droite seulement : la case de l'heure reste d'un seul tenant -->
                    <rect x={x0 + ixCapeW} y={ixTop} width={ixLiW} height={IX_H} rx="2" fill={liftedIndexColor(li)} />
                    <rect x={x0 + ixCapeW} y={ixTop} width="3" height={IX_H} fill={liftedIndexColor(li)} />
                    <text
                        x={x0 + ixCapeW + ixLiW / 2}
                        y={ixTop + IX_H - 3.5}
                        class="wpp-ix"
                        font-size={ixFont}
                        text-anchor="middle"
                        textLength={value.length}
                        lengthAdjust="spacingAndGlyphs">{value.text}</text
                    >
                {/if}
            {/each}

            <!-- Survol : colonne et altitude pointées -->
            {#if hover}
                <!-- En deux parties : le graphique garde ses couleurs, les bandeaux suivent le thème -->
                <rect
                    class="wpp-plot"
                    x={left + hover.i * colW}
                    y={top}
                    width={colW}
                    height={mainH}
                    fill="currentColor"
                    opacity="0.07"
                    pointer-events="none"
                />
                <rect
                    x={left + hover.i * colW}
                    y={top + mainH}
                    width={colW}
                    height={height - top - mainH}
                    fill="currentColor"
                    opacity="0.07"
                    pointer-events="none"
                />
                {#if hover.z != null}
                    <line
                        class="wpp-plot"
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
        <!-- Infobulle rangée par thème. Dans chaque groupe, la valeur à l'altitude pointée vient en
             premier, repérée par la couleur de l'altitude du titre -->
        <div class="wpp-tip" style="left:{tipX - left}px;top:{tipY}px" bind:offsetHeight={tipH}>
            <div class="wpp-tip__title">
                {hourText(tip.col.hour)}
                {#if tip.alt}<span>· {r50(tip.alt.z)} m</span>{/if}
            </div>
            {#if tip.alt?.beyond}
                <div class="wpp-tip__nodata">
                    {tr(
                        `Le modèle ne fournit rien au-dessus de ${r50(profileTop(tip.col))} m`,
                        `The model provides nothing above ${r50(profileTop(tip.col))} m`,
                    )}
                </div>
            {/if}

            <div class="wpp-tip__group"><span>{tr('Vent', 'Wind')}</span></div>
            {#if tip.alt?.wind}
                <div class="wpp-tip__row wpp-tip__row--alt">
                    <span>{tr(`à ${r50(tip.alt.z)} m`, `at ${r50(tip.alt.z)} m`)}</span>
                    <b style="color:{windColor(tip.alt.wind.kmh, light)}"
                        >{tip.alt.wind.kmh} km/h {cardinal(tip.alt.wind.dir)}</b
                    >
                </div>
            {/if}
            <div class="wpp-tip__row">
                <span>{tr('Sol', 'Surface')}</span>
                <b style="color:{windColor(toKmh(tip.col.windSurf), light)}"
                    >{Math.round(toKmh(tip.col.windSurf))} km/h {cardinal(tip.col.windDirSurf)}</b
                >
            </div>
            {#if tip.col.gust != null}
                <div class="wpp-tip__row">
                    <span>{tr('Rafales au sol', 'Surface gusts')}</span>
                    <b style="color:{windColor(toKmh(tip.col.gust), light)}">{Math.round(toKmh(tip.col.gust))} km/h</b>
                </div>
            {/if}

            <div class="wpp-tip__group">
                <span>{tr('Thermiques', 'Thermals')}</span>
                {#if tip.col.ceiling == null}
                    <b>{tr('aucun', 'none')}</b>
                {:else if tip.ease}
                    <b><i class="wpp-sw" style="background:{tip.ease.color}"></i>{tip.ease.label}</b>
                {/if}
            </div>
            {#if tip.alt && tip.alt.w > 0.05}
                <div class="wpp-tip__row wpp-tip__row--alt">
                    <span>{tr(`Vario à ${r50(tip.alt.z)} m`, `Vario at ${r50(tip.alt.z)} m`)}</span>
                    <b><i class="wpp-sw" style="background:{thermalColor(tip.alt.w)}"></i>+{tip.alt.w.toFixed(1)} m/s</b>
                </div>
            {/if}
            {#if tip.col.climb >= 0.1}
                <div class="wpp-tip__row">
                    <span>{tr('Vario max', 'Max vario')}</span><b
                        ><i class="wpp-sw" style="background:{thermalColor(tip.col.climb)}"></i>+{tip.col.climb.toFixed(1)} m/s
                        <small>({tr('air', 'air')} {tip.col.wStar.toFixed(1)})</small></b
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
            {/if}

            <div class="wpp-tip__group"><span>{tr('Température', 'Temperature')}</span></div>
            {#if tip.alt && tip.alt.t != null}
                <div class="wpp-tip__row wpp-tip__row--alt">
                    <span>{tr(`à ${r50(tip.alt.z)} m`, `at ${r50(tip.alt.z)} m`)}</span><b>{tip.alt.t.toFixed(1)} °C</b>
                </div>
            {/if}
            <div class="wpp-tip__row">
                <span>{tip.col.td2m != null ? tr('Sol / point de rosée', 'Surface / dew point') : tr('Sol', 'Surface')}</span>
                <b
                    >{toCelsius(tip.col.t2m).toFixed(0)}°{tip.col.td2m != null
                        ? ` / ${toCelsius(tip.col.td2m).toFixed(0)}°`
                        : ''}</b
                >
            </div>
            {#if tip.col.freezing != null}
                <div class="wpp-tip__row"><span>{tr('Isotherme 0 °C', 'Freezing level')}</span><b>{r50(tip.col.freezing)} m</b></div>
            {/if}

            {#if tip.clouds}
                <div class="wpp-tip__group"><span>{tr('Nuages et précipitations', 'Clouds and precipitation')}</span></div>
                {#if tip.alt && tip.alt.cloud > 3}
                    <div class="wpp-tip__row wpp-tip__row--alt">
                        <span>{tr(`à ${r50(tip.alt.z)} m`, `at ${r50(tip.alt.z)} m`)}</span><b>{Math.round(tip.alt.cloud)} %</b>
                    </div>
                {/if}
                {#if tip.col.cloudCover > 0.03}
                    <div class="wpp-tip__row">
                        <span
                            title={tip.col.cloudTop != null
                                ? tr(
                                      'Le modèle ne fournit pas les nuages plus hauts : les voiles de cirrus ne sont pas comptés',
                                      'The model does not provide higher clouds: cirrus veils are not counted',
                                  )
                                : undefined}
                            >{tip.col.cloudTop != null
                                ? tr(`Total sous ${Math.floor(tip.col.cloudTop / 500) * 500} m`, `Total below ${Math.floor(tip.col.cloudTop / 500) * 500} m`)
                                : tr('Total', 'Total')}</span
                        ><b>{Math.round(tip.col.cloudCover * 100)} %</b>
                    </div>
                {/if}
                {#if cloudAbove(tip.col, yMax) > 0.05}
                    <div class="wpp-tip__row">
                        <span>{tr(`Au-dessus de ${yMax} m`, `Above ${yMax} m`)}</span><b
                            >{Math.round(cloudAbove(tip.col, yMax) * 100)} %</b
                        >
                    </div>
                {/if}
                {#if tip.col.cuBase != null && hasCumulus(tip.col)}
                    <div class="wpp-tip__row">
                        <span>Cumulus</span><b
                            title={tip.col.cuTopCapped
                                ? tr('Sommet au-delà du dernier niveau fourni par le modèle', 'Top beyond the highest level provided by the model')
                                : undefined}
                            >{r50(tip.col.cuBase)}{tip.col.cuTop != null ? `–${r50(tip.col.cuTop)}${tip.col.cuTopCapped ? '+' : ''}` : ''} m</b
                        >
                    </div>
                {/if}
                {#if tip.col.showerBase != null && tip.col.showerTop != null}
                    <div class="wpp-tip__row">
                        <span>{tr('Nuage d’averses', 'Shower cloud')}</span><b
                            title={showerCapped(tip.col)
                                ? tr('Sommet au-delà du dernier niveau fourni par le modèle', 'Top beyond the highest level provided by the model')
                                : undefined}
                            >{r50(tip.col.showerBase)}–{r50(tip.col.showerTop)}{showerCapped(tip.col) ? '+' : ''} m</b
                        >
                    </div>
                {/if}
                {#if tip.layer}
                    <div class="wpp-tip__row">
                        <span>{tr('Nuages de la pluie', 'Rain cloud layer')}</span><b
                            title={tip.layer.top >= profileTop(tip.col) - 25
                                ? tr('Sommet au-delà du dernier niveau fourni par le modèle', 'Top beyond the highest level provided by the model')
                                : undefined}
                            >{r50(tip.layer.base)}–{r50(tip.layer.top)}{tip.layer.top >= profileTop(tip.col) - 25 ? '+' : ''} m</b
                        >
                    </div>
                {/if}
                {#if tip.col.precip - tip.col.snow >= 0.1}
                    <div class="wpp-tip__row">
                        <span>{tip.col.showerBase != null ? tr('Averses', 'Showers') : tr('Pluie', 'Rain')}</span><b
                            >{(tip.col.precip - tip.col.snow).toFixed(1)} mm</b
                        >
                    </div>
                {/if}
                {#if tip.col.snow >= 0.1}
                    <div class="wpp-tip__row">
                        <span>{tr('Neige', 'Snow')}</span><b
                            >~{Math.max(1, Math.round(tip.col.snow))} cm <small>({tip.col.snow.toFixed(1)} mm {tr('d’eau', 'water')})</small></b
                        >
                    </div>
                {/if}
            {/if}

            <!-- Le risque d'orage sert de titre au groupe : il se lit avant la CAPE et le LI -->
            {#if tip.col.stormRisk > 0}
                <div class="wpp-tip__group wpp-tip__group--storm" style="color:{STORM_COLORS[tip.col.stormRisk]}">
                    <span
                        ><StormIcon level={tip.col.stormRisk || 1} size={13} />
                        {tip.col.stormRisk === 3
                            ? tr('Orage violent possible', 'Severe storm possible')
                            : tip.col.stormRisk === 2
                              ? tr('Orage probable', 'Storm likely')
                              : tr('Surdéveloppement', 'Overdevelopment')}</span
                    >
                </div>
            {:else if tip.col.cape >= 100}
                <div class="wpp-tip__group"><span>{tr('Instabilité', 'Instability')}</span></div>
            {/if}
            {#if tip.col.cape >= 100}
                <div class="wpp-tip__row">
                    <span>CAPE{tip.col.liftedIndex != null ? ' / LI' : ''}</span><b
                        ><i class="wpp-sw wpp-sw--dot" style="background:{capeColor(tip.col.cape)}"></i>{tip.col.cape} J/kg{#if tip.col.liftedIndex != null}{' / '}<i
                                class="wpp-sw wpp-sw--dot"
                                style="background:{liftedIndexColor(tip.col.liftedIndex)}"
                            ></i>{tip.col.liftedIndex > 0 ? '+' : ''}{tip.col.liftedIndex}{/if}</b
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
            <text x={left - 6} y={easeTop + EASE_H - 1} class="wpp-axis wpp-axis--ease" text-anchor="end"
                >Therm.</text
            >
            <text x={left - 6} y={rainTop + 13} class="wpp-axis wpp-axis--rain" text-anchor="end"
                >{tr('Pluie', 'Rain')}</text
            >
            <text x={left - 6} y={rainTop + 24} class="wpp-axis wpp-axis--unit" text-anchor="end"
                >mm</text
            >
            <text x={left - 6} y={ixTop + IX_H - 3.5} class="wpp-axis wpp-axis--ix" text-anchor="end"
                >CAPE LI</text
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
    import { tr } from './i18n';
    import type { ThermalEase } from './physics';

    /** Défilement horizontal du graphique, gardé quand on change de jour, d'onglet ou de lieu */
    let savedScroll: number | null = null;

    /** Facilité d'exploitation des thermiques : couleur et libellé, hachures quand le vent les hache */
    export const EASE: Record<ThermalEase, { color: string; label: string; hatch: boolean }> = {
        easy: { color: '#4caf50', label: tr('faciles', 'easy'), hatch: false },
        weak: { color: '#f5c542', label: tr('faibles', 'weak'), hatch: false },
        low: { color: '#f5c542', label: tr('plafond bas', 'low ceiling'), hatch: false },
        choppy: { color: '#f59e0b', label: tr('hachés', 'choppy'), hatch: true },
        rough: { color: '#ef4444', label: tr('très hachés', 'very choppy'), hatch: true },
    };
</script>

<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';

    import { clockText, hourShort, hourText } from './i18n';
    import StormIcon from './StormIcon.svelte';
    import {
        type Column,
        STORM_COLORS,
        capeColor,
        cardinal,
        hasCumulus,
        interpProfile,
        liftedIndexColor,
        nightFactor,
        rainLayer,
        rgbCss,
        skyColors,
        thermalColor,
        thermalEase,
        netClimb,
        thermalRGB,
        thermalShape,
        toCelsius,
        toKmh,
        towerColors,
        varioAt,
        windAt,
        windColor,
    } from './physics';
    import { arrowPath, cumulusPuffs, smoothPath } from './svg';

    export let columns: Column[] = [];
    export let width = 760;
    export let yMin = 0;
    export let yMax = 4000;
    export let nowTs: number = Date.now();
    /** Lever et coucher du soleil (timestamps) et décalage horaire du lieu (h), pour l'affichage */
    export let sunrise: number | null = null;
    export let sunset: number | null = null;
    export let utcOffset = 0;
    /** Thème clair : couleurs du vent plus soutenues dans l'infobulle (le graphique, lui, ne change pas) */
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
    /** Rangées du rideau de pluie : décalage vers le bas (px), en travers (part de sa largeur), opacité */
    const RAIN_ROWS = [
        { dy: 0, shift: 0, alpha: 1 },
        { dy: 13, shift: 0.12, alpha: 0.6 },
        { dy: 26, shift: 0, alpha: 0.3 },
    ];

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
    /** Bandeau de facilité d'exploitation des thermiques, entre le graphique et les heures */
    const EASE_H = 9;
    const easeTop = top + mainH + 6;
    const hoursY = easeTop + EASE_H + 13;
    /** Bandeau de pluviométrie sous les heures */
    const RAIN_H = 30;
    const rainTop = hoursY + 7;
    /** Bandeau de la CAPE et du LI sous la pluie : une case par heure, CAPE à gauche et LI à droite */
    const IX_H = 14;
    const ixTop = rainTop + RAIN_H + 5;
    const height = ixTop + IX_H + 3;
    /** Part de la case réservée à la CAPE (jusqu'à 4 chiffres), le reste au LI (arrondi à l'unité) */
    const IX_CAPE_SHARE = 0.62;
    $: ixCapeW = (colW - 2) * IX_CAPE_SHARE;
    $: ixLiW = colW - 2 - ixCapeW;
    $: ixFont = Math.max(8, Math.min(9.5, colW * 0.27));
    /**
     * Texte d'une demi-case : resserré à la largeur disponible s'il dépasse (CAPE à 4 chiffres ou LI
     * à deux chiffres dans une colonne étroite). Largeur estimée : ~0,56 em par chiffre, 0,33 pour « - »
     */
    $: fitText = (text: string, avail: number) => {
        const w = [...text].reduce((sum, ch) => sum + (ch === '-' ? 0.33 : 0.56), 0) * ixFont;
        return { text, length: w > avail - 1 ? avail - 1 : undefined };
    };
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

    /** Base (m AMSL) de la tour de cumulus d'une heure : cumulus des thermiques, sinon nuage d'averses */
    const towerBase = (c: Column) => (hasCumulus(c) ? c.cuBase : null) ?? c.showerBase;

    /**
     * La pluie de l'heure vient-elle des nuages en couches du modèle ? Oui s'il pleut sans nuage
     * d'averses dessiné sous `zTop`, le haut du graphique.
     */
    const rainsFromLayers = (c: Column, zTop: number) =>
        c.precip >= 0.1 && !(c.showerBase != null && (towerBase(c) as number) < zTop);

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
            winds.push({ y: y(z), dir: wind.dir, kmh, color: windColor(kmh) });
        }

        // Tours de nuages, de la base au sommet : cumulus des thermiques (seulement s'ils sont
        // exploitables) ou nuage d'averses du modèle ; quand il en tombe des averses, la tour est grise
        // et monte jusqu'au plus haut des deux sommets. Une tour qui dépasse le haut du graphique y est
        // coupée net (pas de sommet arrondi)
        const night = nightFactor(src.sunElev);
        const tower = (yb: number, yt: number, w: number, grey: boolean) => {
            const colors = towerColors(grey, night);
            return {
                x: cx(i),
                yb,
                w,
                body: rgbCss(colors.body),
                base: rgbCss(colors.base),
                puffs: cumulusPuffs(cx(i), yb, w, Math.min(yb - top + w, Math.max(w * 0.45, yb - yt))),
            };
        };
        const clouds: ReturnType<typeof tower>[] = [];
        /** Pied du rideau de pluie : base du nuage dont elle tombe */
        let rain: { x: number; y: number; w: number } | null = null;
        const thermalCu = hasCumulus(src);
        const cuBase = towerBase(src);
        // Largeur d'un nuage de pluie : d'autant plus étroit qu'elle est faible (même échelle que les
        // barres de pluie), pour que des heures de pluie ne forment pas un mur devant le ciel
        const rainW = Math.min(colW * (0.45 + 0.5 * Math.min(1, Math.sqrt(src.precip / 5))), 64);
        const yGround = y(Math.max(src.ground, yMin));

        // Pluie sans nuage d'averses : elle vient des nuages en couches du modèle. Une tour grise
        // montre la couche d'où elle tombe, de sa base à son sommet (base jamais au ras du sol). Si
        // la couche est plus haute que le graphique, la pluie part de son bord supérieur
        if (rainsFromLayers(src, yMax)) {
            const layer = rainLayer(src.profile);
            if (layer && layer.base < yMax) {
                const yb = Math.min(y(layer.base), yGround - 18);
                clouds.push(tower(yb, y(layer.top), rainW, true));
                rain = { x: cx(i), y: yb, w: rainW };
            } else rain = { x: cx(i), y: top, w: rainW };
        }
        if (cuBase != null && cuBase < yMax) {
            const shower = src.showerBase != null;
            const cuTop = Math.max((thermalCu ? src.cuTop : null) ?? cuBase, src.showerTop ?? cuBase);
            const w = thermalCu ? Math.min(colW * 0.95, 64) : rainW;
            clouds.push(tower(y(cuBase), y(cuTop), w, shower));
            if (shower) rain = { x: cx(i), y: y(cuBase), w };
        }

        // Rideau de pluie sous le nuage : quelques rangées de traits qui s'estompent vers le bas,
        // autant qu'il en tient au-dessus du sol
        const yRain = rain?.y ?? 0;
        const streaks = rain && { ...rain, rows: RAIN_ROWS.filter((row, k) => k === 0 || yRain + row.dy + 15 <= yGround) };

        const ease = thermalEase(src);
        return { src, winds, clouds, streaks, ease: ease && EASE[ease] };
    });

    /** Altitude (m AMSL) du dernier niveau fourni par le modèle */
    const profileTop = (c: Column) => c.profile[c.profile.length - 1].z;

    /** Sommet du nuage d'averses au dernier niveau des données : le vrai sommet est plus haut */
    const showerCapped = (c: Column) => c.showerTop != null && c.showerTop >= profileTop(c) - 25;

    /** Nébulosité maximale (0-1) des niveaux du modèle situés au-dessus du haut du graphique */
    // Niveaux du profil au-dessus du graphique, et nébulosité seule plus haut encore (cirrus)
    const cloudAbove = (c: Column, zTop: number) =>
        Math.max(c.highCloud, ...c.profile.filter(p => p.z > zTop).map(p => p.cloud / 100));

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
    ) => {
        // Ciel bleu le jour, bleu nuit la nuit (fondu à l'aube et au crépuscule), le même dans les
        // deux thèmes ; opacité des nuages à 100 % de couverture : un ciel couvert doit se lire comme
        // un voile plein
        const cloudAlpha = 0.96;
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
            // Paramètres de la couche thermique : sans thermique, sommet au sol et force nulle
            const hasThermal = c.thermalTop != null && c.climb > 0;
            return {
                cloud,
                sunElev: c.sunElev,
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
            // On interpole la hauteur du soleil (quasi linéaire sur une heure), pas la part de nuit :
            // le fondu garde sa vraie durée au lieu de s'étaler sur tout l'intervalle entre deux heures
            const night = nightFactor(a.sunElev + (b.sunElev - a.sunElev) * f);
            const gz = spline('ground', i0, f);
            const topZ = spline('top', i0, f);
            const wStar = spline('wStar', i0, f);
            const depth = topZ - gz;
            const sky = skyColors(night);

            for (let gy = 0; gy < gh; gy++) {
                // Ciel : dégradé vertical
                const s = gy / gh;
                px[0] = sky.top[0] + (sky.bottom[0] - sky.top[0]) * s;
                px[1] = sky.top[1] + (sky.bottom[1] - sky.top[1]) * s;
                px[2] = sky.top[2] + (sky.bottom[2] - sky.top[2]) * s;

                const z = zAt(gy);
                const zr = (z - gz) / depth;
                // Montée au vario (cœur du thermique moins le taux de chute en spirale)
                const wv = depth > 20 && wStar > 0 ? netClimb(wStar * thermalShape(zr)) : 0;
                if (wv > 0.03) {
                    // Fondu doux sur les derniers ~3 % de la couche : bord supérieur net mais sans escalier
                    const edge = Math.min(1, Math.max(0, (1 - zr) / 0.03));
                    mix(px, thermalRGB(wv), Math.min(1, wv / 0.6) * 0.88 * edge);
                }

                const cl = a.cloud[gy] + (b.cloud[gy] - a.cloud[gy]) * f;
                // Courbe légèrement bombée : les couvertures moyennes se voient mieux, 100 % est presque opaque
                // Voile uni : les tours de cumulus s'en détachent par leur contour sombre
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

    $: if (canvasEl) drawField(canvasEl, shown, plotW, yMin, yMax);

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
    /**
     * Position horizontale d'un instant sur l'axe des heures (null s'il est hors du graphique).
     * Comme pour le fond, les courbes et les libellés, l'heure d'une colonne est au centre de la colonne.
     */
    $: xOfTs = (ts: number) => {
        if (!n) return null;
        const x = cx((ts - shown[0].ts) / stepMs);
        return x >= left && x <= left + plotW ? x : null;
    };
    $: nowX = xOfTs(nowTs);

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
        const key = thermalEase(col);
        const ease = key && EASE[key];
        let alt = null;
        if (z != null && z > col.ground) {
            const wind = windAt(col.profile, z);
            const t = interpProfile(col.profile, z, 't');
            alt = {
                z,
                wind: wind ? { kmh: Math.round(toKmh(wind.speed)), dir: wind.dir } : null,
                t: t == null ? null : toCelsius(t),
                w: varioAt(col, z),
                cloud: interpProfile(col.profile, z, 'cloud') ?? 0,
                /** Altitude pointée au-dessus du dernier niveau du modèle : rien à y lire */
                beyond: z > profileTop(col),
            };
        }
        // Le groupe « Nuages et précipitations » ne s'affiche que s'il a au moins une ligne
        const clouds =
            (alt != null && alt.cloud > 3) ||
            col.cloudCover > 0.03 ||
            cloudAbove(col, yMax) > 0.05 ||
            hasCumulus(col) ||
            (col.showerBase != null && col.showerTop != null) ||
            col.precip >= 0.1;
        // Couche de nuages d'où tombe la pluie, quand elle ne vient pas d'un nuage d'averses
        const layer = rainsFromLayers(col, yMax) ? rainLayer(col.profile) : null;
        return { col, ease, alt, clouds, layer };
    };

    // --- Position de l'infobulle, toujours dans le cadre. Au doigt, on la place dans la moitié
    // du graphique opposée au point touché pour ne pas le masquer.
    const TIP_W = 196;
    /** Hauteur mesurée de l'infobulle : elle varie avec le nombre de lignes affichées */
    let tipH = 0;
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
          ? clamp(hover.y - 30, 4, height - tipH - 4)
          : hover.y > top + mainH / 2
            ? top + 4
            : clamp(top + mainH - tipH, 4, height - tipH - 4);

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
            &--ease {
                font-size: 9.5px;
            }
            &--ix {
                font-size: 8.5px;
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

        // Le graphique lui-même (ciel, vent, plafond, nuages) a les mêmes couleurs dans les deux
        // thèmes. Seuls les axes et les bandeaux « Therm. » et « Pluie », posés sur le fond du
        // panneau, suivent le thème.
        .wpp-plot {
            color: #ffffff;
            --wpp-halo: #0f1822;
            --wpp-text-halo: #0f1822;
            --wpp-text-halo-k: 1;
            --wpp-freezing: #5fd3ff;
        }
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
        }
        .wpp-sun {
            font-size: 10px;
            font-weight: bold;
            fill: #ffc94a;
            paint-order: stroke;
            stroke: var(--wpp-text-halo);
            stroke-width: calc(3px * var(--wpp-text-halo-k));
            stroke-linejoin: round;
        }
        .wpp-rain--snow {
            fill: var(--wpp-snow);
        }
        .wpp-rain {
            font-size: 9px;
            font-weight: bold;
            fill: var(--wpp-rain);
            paint-order: stroke;
            stroke: var(--wpp-text-halo);
            stroke-width: calc(2.5px * var(--wpp-text-halo-k));
            stroke-linejoin: round;
        }
        // Valeur de la CAPE ou du LI, sur la couleur de son palier
        .wpp-ix {
            font-weight: bold;
            font-variant-numeric: tabular-nums;
            fill: #111;
        }
        .wpp-wind {
            font-size: 9.5px;
            font-weight: bold;
            paint-order: stroke;
            stroke: var(--wpp-text-halo);
            stroke-width: calc(2.8px * var(--wpp-text-halo-k));
            stroke-linejoin: round;
            stroke-opacity: 0.85;
        }
        .wpp-ceiling {
            fill: none;
            stroke: #ffffff;
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
        .wpp-streak {
            stroke: #2f7cf6;
            stroke-width: 1.6;
            stroke-linecap: round;
        }
        .wpp-freezing-label {
            fill: var(--wpp-freezing);
            font-size: 10px;
            font-weight: bold;
            paint-order: stroke;
            stroke: var(--wpp-text-halo);
            stroke-width: calc(3px * var(--wpp-text-halo-k));
            stroke-linejoin: round;
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
            // Valeur à l'altitude pointée : même couleur que l'altitude du titre
            &--alt span {
                color: var(--wpp-accent);
            }
        }
        // Titre d'un groupe de lignes, avec au besoin sa valeur de synthèse à droite
        &__group {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 8px;
            margin-top: 4px;
            padding-top: 3px;
            border-top: 1px solid var(--wpp-border);
            color: var(--wpp-fg-faint);
            span {
                font-size: 9.5px;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }
            b {
                color: var(--wpp-fg);
                white-space: nowrap;
            }
            &--storm span {
                font-size: inherit;
                font-weight: bold;
                letter-spacing: 0;
                text-transform: none;
            }
        }
        .wpp-sw {
            display: inline-block;
            width: 9px;
            height: 9px;
            margin-right: 5px;
            border-radius: 2px;
            vertical-align: 0;
            // Pastille ronde des paliers de la CAPE et du LI, comme dans la légende
            &--dot {
                border-radius: 50%;
            }
        }
        &__hint {
            margin-top: 4px;
            font-size: 10px;
            opacity: 0.55;
        }
        &__nodata {
            font-size: 10.5px;
            line-height: 1.35;
            color: var(--wpp-fg-faint);
        }
        &__row small {
            margin-left: 3px;
            font-weight: normal;
            color: var(--wpp-fg-faint);
        }
    }

</style>
