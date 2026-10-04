<svelte:window on:pointerdown={onWindowPointer} />

<div class="wpp-chart-outer" bind:this={wrapEl} style="width:{width}px">
<!-- Lecture de la journée, d'heure en heure : dans la marge de l'axe, au bout de la barre de l'heure -->
{#if n > 0}
    <button
        class="wpp-rail-play"
        class:on={playing}
        style="width:{left - 6}px;height:{RAIL_H - 2}px"
        title={playing ? tr('Pause', 'Pause') : tr('Faire défiler la journée', 'Play the day')}
        on:click={() => dispatch('play')}>{playing ? '❚❚' : '▶'}</button
    >
{/if}
<!-- Zone du graphique : commence après l'axe des altitudes et défile si l'écran est étroit. Sa
     hauteur n'est pas fixée : la barre de défilement d'un ordinateur s'ajoute sous le graphique -->
<div
    class="wpp-chart-scroll"
    style="margin-left:{left}px;width:{width - left}px"
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
                <linearGradient id="wpp-ground-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#7a5f45" />
                    <stop offset="1" stop-color="#3f3025" />
                </linearGradient>
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

            <!-- Barre de l'heure, en haut du graphique : c'est l'axe des heures, qui ne sont écrites
                 qu'ici. L'heure choisie est écrite sur son bouton, à la place des heures qu'il
                 recouvre, au sommet du trait orange qui descend jusqu'au bas du graphique. Le bouton
                 se déplace au doigt ou à la souris, d'heure en heure -->
            <rect x={left} y={railY - 7} width={plotW} height="14" rx="4" fill="currentColor" opacity="0.05" />
            {#each cols as col, i}
                {#if (colW >= 22 || i % 2 === 0) && !(selPill && Math.abs(cx(i) - selPill.x) < selPill.w / 2 + 9)}
                    <text x={cx(i)} y={railY + 3.5} class="wpp-hour" text-anchor="middle"
                        >{hourShort(col.src.hour)}</text
                    >
                {/if}
            {/each}
            {#if selPill}
                <rect
                    x={selPill.x - selPill.w / 2}
                    y={railY - 8}
                    width={selPill.w}
                    height="16"
                    rx="8"
                    class="wpp-rail-thumb"
                />
                <text x={selPill.x} y={railY + 4} class="wpp-rail-time" text-anchor="middle">{selPill.label}</text>
            {/if}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <rect
                x={left}
                y="0"
                width={plotW}
                height={RAIL_H}
                fill="transparent"
                pointer-events="all"
                class="wpp-rail-hit"
                on:pointerdown={railDown}
                on:pointermove={railMove}
                on:pointerup={railUp}
                on:pointercancel={railUp}
            />

            <!-- Bandeau « Nuages » : ciel de chaque heure, au-dessus du graphique. Une case, de transparente (ciel
                 dégagé) à grise (ciel couvert), de jour comme de nuit, où est écrite la part du ciel
                 prise par les nuages, tous étages confondus et plus haut que le graphique compris -->
            <rect x={left} y={skyTop} width={plotW} height={SKY_H} rx="3" fill="currentColor" opacity="0.05" />
            {#each sky as s, i}
                <rect
                    x={left + i * colW + 1}
                    y={skyTop}
                    width={colW - 2}
                    height={SKY_H}
                    rx="2"
                    fill={SKY_GREY}
                    fill-opacity={s.cover}
                />
                <text
                    x={cx(i)}
                    y={skyTop + SKY_H - 4}
                    class="wpp-sky-pct"
                    font-size={ixFont}
                    style="fill:{s.ink}"
                    text-anchor="middle"
                    textLength={s.label.length}
                    lengthAdjust="spacingAndGlyphs">{s.label.text}</text
                >
            {/each}

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
            <text x={left - 6} y={y(ground) + 3.5} class="wpp-axis wpp-axis--ground" text-anchor="end"
                >{ground}</text
            >

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

                <!-- Niveau des crêtes voisines : l'air saturé n'accroche le relief qu'en dessous -->
                {#if crest != null && crest < yMax}
                    <line x1={left} x2={left + plotW} y1={y(crest)} y2={y(crest)} class="wpp-crest" />
                {/if}

                <!-- Limite pluie-neige aux heures de précipitations -->
                <path d={snowPath} class="wpp-snowline" />
                {#if snowLabel}
                    <text x={snowLabel.x} y={snowLabel.y - 5} class="wpp-snowline-label" text-anchor="middle">❄&#xFE0E;</text>
                {/if}

                <!-- Isotherme 0 °C -->
                <path d={freezingPath} class="wpp-freezing" />
                {#if freezingLabel}
                    <text x={freezingLabel.x - 4} y={freezingLabel.y - 5} class="wpp-freezing-label" text-anchor="end"
                        >0 °C</text
                    >
                {/if}

                <!-- Rideau de pluie sous le nuage, tour ou nappe, d'où elle tombe -->
                {#each cols as col}
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
                {/each}

                <!-- Nuages convectifs, en tour : base plate et sombre, flancs bourgeonnants, sommet en
                     chou-fleur. Blancs pour les cumulus des thermiques, gris quand il en tombe des
                     averses. Tous les contours d'abord, les corps ensuite : les nuages d'averses
                     d'heures qui se suivent se recouvrent et ne font qu'une masse -->
                {#each cols as col}
                    {#if col.cloud}<path d={col.cloud.d} class="wpp-cu-edge" />{/if}
                {/each}
                {#each cols as col, i}
                    {#if col.cloud}
                        {@const cu = col.cloud}
                        <linearGradient
                            id="wpp-cu-grad-{i}"
                            gradientUnits="userSpaceOnUse"
                            x1="0"
                            x2="0"
                            y1={cu.yb}
                            y2={cu.yb - cu.w * 0.7}
                        >
                            <stop offset="0" stop-color={cu.base} />
                            <stop offset="1" stop-color={cu.body} />
                        </linearGradient>
                        <path d={cu.d} class="wpp-cu" fill="url(#wpp-cu-grad-{i})" />
                        <line x1={cu.x - cu.w * 0.42} x2={cu.x + cu.w * 0.42} y1={cu.yb} y2={cu.yb} class="wpp-cu-base" />
                    {/if}
                {/each}

                <!-- Virga : chevrons de l'air qui descend sous une averse à base haute -->
                {#each cols as col}
                    {#if col.virga}
                        <!-- Un troisième chevron, en rouge, quand l'air sec peut donner de fortes rafales -->
                        {@const d = `M${col.virga.x - 4},${col.virga.y}l4,4l4,-4M${col.virga.x - 4},${col.virga.y + 5}l4,4l4,-4${
                            col.virga.strong ? `M${col.virga.x - 4},${col.virga.y + 10}l4,4l4,-4` : ''
                        }`}
                        <path {d} class="wpp-virga wpp-virga--halo" />
                        <path {d} class="wpp-virga" class:wpp-virga--strong={col.virga.strong} />
                    {/if}
                {/each}

                <!-- Tourbillons de poussière possibles : entonnoir au ras du sol -->
                {#each cols as col, i}
                    {#if col.dust}
                        {@const yd = y(ground) - 3}
                        {@const d = `M${cx(i) - 6},${yd - 11}q6,-4 12,0M${cx(i) - 4},${yd - 6}q4,-3 8,0M${cx(i) - 2},${yd - 1}q2,-2 4,0`}
                        <path {d} class="wpp-dust wpp-dust--halo" />
                        <path {d} class="wpp-dust" />
                    {/if}
                {/each}

                <!-- Plafond thermique exploitable -->
                <path d={ceilingPath} class="wpp-ceiling wpp-ceiling--halo" />
                <path d={ceilingPath} class="wpp-ceiling" />
                {#each cols as col, i}
                    {#if col.src.ceiling != null && col.src.ceiling < yMax}
                        <circle cx={cx(i)} cy={y(col.src.ceiling)} r="2.8" fill="#ffffff" style="stroke: var(--wpp-halo)" />
                    {/if}
                {/each}

                <!-- Passages de front, comme sur une coupe météo : trait bleu à triangles (front froid) ou
                     rouge à demi-cercles (front chaud), sous les flèches du vent qui restent lisibles.
                     Le trait suit la surface du front : il part du sol à l'heure où le front y passe
                     et rejoint, d'altitude en altitude, l'heure où il passe plus haut. Les symboles sont tournés vers
                     les heures qui précèdent, celles de l'air que le front remplace -->
                {#each frontMarks as f}
                    <path d={f.path} class="wpp-front wpp-front--halo" />
                    <path d={f.pips} class="wpp-front-pips" fill={f.color} />
                    <path d={f.path} class="wpp-front" stroke={f.color} />
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
                            <text x={cx(i)} y={w.y + windTextDy} class="wpp-wind" fill={w.color} text-anchor="middle"
                                >{w.kmh}</text
                            >
                        {/if}
                    {/each}
                {/each}

                <!-- Vent au sol de chaque heure (km/h), écrit dans le relief sous la ligne du sol, aux
                     couleurs du vent en altitude : vent moyen et sa direction, rafales en dessous -->
                {#each cols as col, i}
                    {@const s = col.surf}
                    {#if s.arrowX != null}
                        <path
                            d={surfArrow}
                            transform="translate({s.arrowX},{surfY - 3.5}) rotate({s.dir + 180})"
                            fill={windColor(s.mean)}
                            style="stroke: var(--wpp-halo)"
                            stroke-width="0.7"
                            stroke-opacity="0.8"
                        />
                    {/if}
                    <text x={s.textX} y={surfY} class="wpp-wind" fill={windColor(s.mean)}>{s.mean}</text>
                    {#if s.gust != null}
                        <text x={cx(i)} y={gustY} class="wpp-wind" fill={windColor(s.gust)} text-anchor="middle"
                            >{s.gust}</text
                        >
                    {/if}
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

                <!-- Orage d'un point voisin qui se dirige vers le lieu : icône estompée, cerclée de
                     tirets, à l'heure où il peut y arriver -->
                {#if nearbyAt != null && nearby && shown[nearbyAt].stormRisk < 2}
                    <g opacity="0.75">
                        <circle
                            cx={cx(nearbyAt)}
                            cy={top + 24.5}
                            r="11"
                            fill="none"
                            stroke={STORM_COLORS[nearby.level]}
                            stroke-width="1.3"
                            stroke-dasharray="3 2.5"
                        />
                        <StormIcon level={nearby.level} size={15} x={cx(nearbyAt) - 7.5} y={top + 17} />
                    </g>
                {/if}

                <!-- Ondes de relief possibles : vague en haut de la colonne, sous l'icône d'orage -->
                {#each cols as col, i}
                    {#if col.wave}
                        {@const yw = top + (col.src.stormRisk > 0 ? 42 : 25)}
                        <path d="M{cx(i) - 8},{yw}q4,-9 8,0t8,0" class="wpp-wave wpp-wave--halo" />
                        <path d="M{cx(i) - 8},{yw}q4,-9 8,0t8,0" class="wpp-wave" />
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

            <!-- Pluviométrie de chaque heure (mm) -->
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

            <!-- Heure choisie, celle de la carte : trait orange de la barre de l'heure jusqu'au bas du
                 graphique, à travers les bandeaux (nuages, pluie, CAPE et LI) -->
            {#if selX != null}
                <line
                    x1={selX}
                    x2={selX}
                    y1={railY + 8}
                    y2={ixTop + IX_H}
                    stroke="#0f1822"
                    stroke-opacity="0.5"
                    stroke-width="3.5"
                    pointer-events="none"
                />
                <line
                    x1={selX}
                    x2={selX}
                    y1={railY + 8}
                    y2={ixTop + IX_H}
                    stroke="#f5a623"
                    stroke-width="1.5"
                    pointer-events="none"
                />
            {/if}

            <!-- Altitude de la carte : tirets orange, comme le repère de l'heure choisie -->
            {#if mapY != null}
                <line
                    class="wpp-plot"
                    x1={left}
                    x2={left + plotW}
                    y1={mapY}
                    y2={mapY}
                    stroke="#f5a623"
                    stroke-opacity="0.85"
                    stroke-dasharray="7 5"
                    pointer-events="none"
                />
            {/if}

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

            <!-- Zone interactive : survol = infobulle, clic = heure et altitude choisies -->
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <rect
                x={left}
                y={top}
                width={plotW}
                height={height - top}
                fill="transparent"
                pointer-events="all"
                class="wpp-hit"
                use:scrub={onScrub}
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

            <!-- Front qui passe au sol à cette heure, ou dont le trait la traverse : ce qu'il change -->
            {#if tipFront}
                <div class="wpp-tip__group wpp-tip__group--front">
                    <span><i class="wpp-sw" style="background:{FRONT[tipFront.kind].color}"></i>{frontLabel(tipFront)}</span>
                </div>
                <div class="wpp-tip__row">
                    <span
                        >{tipFront.kind === 'occluded'
                            ? tr('Air chaud en altitude', 'Warm air aloft')
                            : tr(`Air, en ${tipFront.window} h`, `Air, over ${tipFront.window} h`)}</span
                    >
                    <b>{tipFront.tempChange > 0 ? '+' : '−'}{Math.abs(tipFront.tempChange).toFixed(1)} °C</b>
                </div>
                {#if tipFront.abrupt}
                    <div class="wpp-tip__row">
                        <span
                            title={tr(
                                'Passage brutal : l’essentiel du changement d’air se fait en 2 heures',
                                'Abrupt passage: most of the air change happens within 2 hours',
                            )}>{tr('dont en 2 h', 'of which in 2 h')}</span
                        >
                        <b>{tipFront.tempStep > 0 ? '+' : '−'}{Math.abs(tipFront.tempStep).toFixed(1)} °C</b>
                    </div>
                {/if}
                {#if tipFront.speed != null && tipFront.bearing != null}
                    <div class="wpp-tip__row">
                        <span
                            title={tr(
                                'Vitesse du front, lue sur le retard de son passage aux points voisins du lieu',
                                'Speed of the front, read from the delay of its passage at the points around the place',
                            )}>{tr('Déplacement', 'Motion')}</span
                        >
                        <b
                            >~{round5(tipFront.speed)} km/h {tr('de', 'from')}
                            {cardinal(tipFront.bearing)}</b
                        >
                    </div>
                {/if}
                {#if tipFront.between}
                    <div class="wpp-tip__row">
                        <span
                            title={tr(
                                'Windy ne fournit ce modèle que toutes les 3 heures : l’heure du passage n’est connue qu’à ce pas près',
                                'Windy only provides this model every 3 hours: the hour of the passage is only known to within that step',
                            )}>{tr('Passage au sol', 'Passage at the ground')}</span
                        >
                        <b>{frontWhen(tipFront)}</b>
                    </div>
                {:else if tipFront.at.ts !== tip.col.ts}
                    <div class="wpp-tip__row">
                        <span>{tr('Passage au sol', 'Passage at the ground')}</span>
                        <b>{hourText(tipFront.at.hour)}</b>
                    </div>
                {/if}
                {#if tipFront.aloft.ts !== tipFront.at.ts}
                    <div class="wpp-tip__row">
                        <span>{tr('Passage en altitude', 'Passage aloft')}</span>
                        <b>{hourText(tipFront.aloft.hour)}</b>
                    </div>
                {/if}
                {#if tipFront.pressureRise != null}
                    <div class="wpp-tip__row">
                        <span>{tr('Pression, 3 h après', 'Pressure, 3 h later')}</span>
                        <b>{tipFront.pressureRise > 0 ? '+' : '−'}{Math.abs(tipFront.pressureRise).toFixed(1)} hPa</b>
                    </div>
                {/if}
                {#if tipFront.turns && tipFront.before && tipFront.after}
                    <div class="wpp-tip__row">
                        <span>{tr(`Vent à ${r50(tipFront.windZ)} m`, `Wind at ${r50(tipFront.windZ)} m`)}</span>
                        <b>{cardinal(tipFront.before.dir)} → {cardinal(tipFront.after.dir)}</b>
                    </div>
                {/if}
                {#if tipFront.gustJump && tipFront.gustBefore != null && tipFront.gustAfter != null}
                    <div class="wpp-tip__row">
                        <span
                            title={tr(
                                'Plus fortes rafales au sol des 3 heures qui précèdent le passage, puis des 3 heures qui le suivent',
                                'Strongest surface gusts in the 3 hours before the passage, then in the 3 hours after it',
                            )}>{tr('Rafales au sol', 'Surface gusts')}</span
                        >
                        <b
                            >{Math.round(toKmh(tipFront.gustBefore))} → {Math.round(toKmh(tipFront.gustAfter))} km/h</b
                        >
                    </div>
                {/if}
                <div class="wpp-tip__row">
                    <span>{tr('Pluie du passage', 'Rain at the passage')}</span>
                    <b>{tipFront.rain < 1 ? '< 1' : Math.round(tipFront.rain)} mm</b>
                </div>
            {/if}

            {#if nearby && nearbyAt != null && shown[nearbyAt].ts === tip.col.ts}
                <div class="wpp-tip__group" style="color:{STORM_COLORS[nearby.level]}">
                    <span
                        >{tr(
                            `Orage à ${round5(nearby.distance)} km (${cardinal(nearby.bearing)}) : il peut arriver vers cette heure`,
                            `Storm ${round5(nearby.distance)} km away (${cardinal(nearby.bearing)}): it may arrive around this hour`,
                        )}</span
                    >
                </div>
            {/if}

            <!-- Vent à l'altitude pointée. Le vent au sol et les rafales sont écrits dans le relief du
                 graphique : ils ne sont pas répétés ici -->
            {#if tip.alt?.wind || tip.wave || tip.dust}
                <div class="wpp-tip__group"><span>{tr('Vent', 'Wind')}</span></div>
            {/if}
            {#if tip.alt?.wind}
                <div class="wpp-tip__row wpp-tip__row--alt">
                    <span>{tr(`à ${r50(tip.alt.z)} m`, `at ${r50(tip.alt.z)} m`)}</span>
                    <b style="color:{windColor(tip.alt.wind.kmh, light)}"
                        >{tip.alt.wind.kmh} km/h {cardinal(tip.alt.wind.dir)}</b
                    >
                </div>
            {/if}
            {#if tip.wave}
                <div class="wpp-tip__row">
                    <span
                        title={tr(
                            'Vent soutenu aux crêtes dans un air stable : ondes et rotors possibles sous le vent du relief',
                            'Strong wind at ridge level in stable air: waves and rotors possible downwind of the terrain',
                        )}>{tr('Ondes possibles', 'Waves possible')}</span
                    >
                    <b>{Math.round(toKmh(tip.wave.wind.speed))} km/h {tr('aux crêtes', 'at ridges')}</b>
                </div>
            {/if}
            {#if tip.dust}
                <div class="wpp-tip__row">
                    <span
                        title={tr(
                            'Thermiques puissants dans une couche épaisse, vent faible au sol, air et sol secs, plein soleil : les ingrédients des tourbillons de poussière (« dusts »)',
                            'Strong thermals in a deep layer, light surface wind, dry air and ground, full sun: the ingredients of dust devils',
                        )}>{tr('Tourbillons', 'Dust devils')}</span
                    >
                    <b>{tr('possibles', 'possible')}</b>
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
                    <span
                        title={tr(
                            'Plafond exploitable : altitude où l’ascendance compense encore le taux de chute d’une aile en spirale',
                            'Usable ceiling: height where the climb still beats a glider’s circling sink rate',
                        )}>{tr('Plafond', 'Ceiling')}</span
                    ><b>{r50(tip.col.ceiling)} m</b>
                </div>
            {/if}

            <div class="wpp-tip__group"><span>{tr('Température', 'Temperature')}</span></div>
            {#if tip.alt && tip.alt.t != null}
                <div class="wpp-tip__row wpp-tip__row--alt">
                    <span>{tr(`à ${r50(tip.alt.z)} m`, `at ${r50(tip.alt.z)} m`)}</span><b>{tip.alt.t.toFixed(1)} °C</b>
                </div>
            {/if}
            <!-- Température au sol, à l'altitude que le modèle donne au sol du lieu -->
            <div class="wpp-tip__row">
                <span
                    title={tr(
                        'Altitude du sol dans le modèle : la moyenne de sa maille, qui peut différer de celle du site',
                        'Ground elevation in the model: the average of its grid cell, which may differ from the site’s',
                    )}>{tr(`Sol (${tip.col.ground} m)`, `Ground (${tip.col.ground} m)`)}</span
                >
                <b>{toCelsius(tip.col.t2m).toFixed(0)} °C</b>
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
                <!-- Couverture totale, et entre parenthèses celle des nuages plus hauts que le graphique -->
                {#if tip.col.cloudCover > 0.03 || cloudAbove(tip.col, yMax) > 0.05}
                    {@const above = cloudAbove(tip.col, yMax)}
                    <div class="wpp-tip__row">
                        <span
                            title={tip.col.cloudTop != null
                                ? tr(
                                      `Total sous ${Math.floor(tip.col.cloudTop / 500) * 500} m : le modèle ne fournit pas les nuages plus hauts, les voiles de cirrus ne sont pas comptés`,
                                      `Total below ${Math.floor(tip.col.cloudTop / 500) * 500} m: the model does not provide higher clouds, cirrus veils are not counted`,
                                  )
                                : undefined}>{tr('Total', 'Total')}</span
                        ><b
                            >{Math.round(tip.col.cloudCover * 100)} %{#if above > 0.05}<small
                                    title={tr('Nuages plus hauts que le graphique', 'Clouds higher than the chart')}
                                    >({Math.round(above * 100)} % {tr('à plus de', 'above')} {yMax} m)</small
                                >{/if}</b
                        >
                    </div>
                {/if}
                {#if tip.low}
                    <div class="wpp-tip__row">
                        <span
                            title={tip.genus === 'cumulus'
                                ? tr(
                                      'Couche basse que les thermiques nourrissent : des cumulus ou des stratocumulus, en amas séparés par des trouées, pas une nappe continue',
                                      'Low layer fed by thermals: cumulus or stratocumulus, in clumps separated by gaps, not a continuous sheet',
                                  )
                                : undefined}
                            >{tip.low.sea
                                ? tr('Mer de nuages', 'Sea of clouds')
                                : tip.low.fog
                                  ? tr('Brouillard', 'Fog')
                                  : tip.genus === 'cumulus'
                                    ? tr('Couche de cumulus', 'Cumulus layer')
                                    : tr('Nuages bas', 'Low cloud')}</span
                        ><b
                            title={tr(
                                'Base et sommet placés entre deux niveaux du modèle : à quelques centaines de mètres près',
                                'Base and top placed between two model levels: accurate to a few hundred metres',
                            )}
                            >~{tip.low.fog ? tr('sol', 'ground') : r50(tip.low.base)}–{r50(tip.low.top)} m</b
                        >
                    </div>
                {/if}
                {#if tip.ceiling}
                    <div class="wpp-tip__row">
                        <span
                            title={tip.genus === 'altostratus'
                                ? tr(
                                      'Couche épaisse de l’étage moyen : altostratus, ou altocumulus épais ou en plusieurs couches',
                                      'Thick mid-level layer: altostratus, or thick or multi-layered altocumulus',
                                  )
                                : tip.genus === 'altocumulus'
                                  ? tr(
                                        'Couche mince de l’étage moyen, en amas séparés par des trouées',
                                        'Thin mid-level layer, in clumps separated by gaps',
                                    )
                                  : undefined}
                            >{tip.genus === 'altocumulus'
                                ? 'Altocumulus'
                                : tip.genus === 'altostratus'
                                  ? 'Altostratus'
                                  : tr('Couche', 'Layer')}</span
                        ><b
                            title={tr(
                                'Plus basse couche où le modèle prévoit au moins 50 % de nuages. Base et sommet placés entre deux niveaux du modèle : à quelques centaines de mètres près',
                                'Lowest layer where the model forecasts at least 50 % cloud. Base and top placed between two model levels: accurate to a few hundred metres',
                            )}
                            >~{r50(tip.ceiling.base)}–{r50(tip.ceiling.top)}{tip.ceiling.top >= profileTop(tip.col) ? '+' : ''} m</b
                        >
                    </div>
                {/if}
                {#if tip.col.cuBase != null && hasCumulus(tip.col)}
                    <div class="wpp-tip__row">
                        <span
                            title={tip.spread
                                ? tr(
                                      'Le modèle met au moins 60 % de nuages dans la couche des cumulus : ils s’étalent en nappe',
                                      'The model has at least 60 % cloud in the cumulus layer: they spread into a sheet',
                                  )
                                : undefined}>{tip.spread ? tr('Cumulus étalés', 'Spreading cumulus') : 'Cumulus'}</span
                        ><b
                            title={tip.col.cuTopCapped
                                ? tr('Sommet au-delà du dernier niveau fourni par le modèle', 'Top beyond the highest level provided by the model')
                                : undefined}
                            >{r50(tip.col.cuBase)}{tip.col.cuTop != null ? `–${r50(tip.col.cuTop)}${tip.col.cuTopCapped ? '+' : ''}` : ''} m</b
                        >
                    </div>
                {/if}
                <!-- Pluie et neige de l'heure. Le nuage d'où elles tombent (nuage d'averses, ou couche
                     de la pluie) est donné sur la première de ces lignes ; sans précipitations, le nuage
                     d'averses a sa propre ligne -->
                {@const rainy = tip.col.precip - tip.col.snow >= 0.1}
                {@const snowy = tip.col.snow >= 0.1}
                {#if tip.rainCloud && !rainy && !snowy}
                    <div class="wpp-tip__row">
                        <span>{tr('Nuage d’averses', 'Shower cloud')}</span><b title={tip.rainCloud.title}>{tip.rainCloud.text}</b>
                    </div>
                {/if}
                {#if rainy}
                    <div class="wpp-tip__row wpp-tip__row--wrap">
                        <span
                            >{tip.col.showerBase != null
                                ? tr('Averses', 'Showers')
                                : tip.low && tip.col.precip < DRIZZLE
                                  ? tr('Bruine', 'Drizzle')
                                  : tr('Pluie', 'Rain')}</span
                        ><b
                            >{(tip.col.precip - tip.col.snow).toFixed(1)} mm{#if tip.col.precipStep > 1}<small
                                    title={tr(
                                        `Cumul de ${tip.col.precipStep} h du modèle, réparti sur ses heures`,
                                        `${tip.col.precipStep} h total of the model, spread over its hours`,
                                    )}>({tr(`sur ${tip.col.precipStep} h`, `over ${tip.col.precipStep} h`)})</small
                                >{/if}{#if tip.rainCloud}<small title={tip.rainCloud.title}>{tip.rainCloud.text}</small>{/if}</b
                        >
                    </div>
                {/if}
                {#if snowy}
                    <div class="wpp-tip__row wpp-tip__row--wrap">
                        <span>{tr('Neige', 'Snow')}</span><b
                            >~{Math.max(1, Math.round(tip.col.snow))} cm <small>({tip.col.snow.toFixed(1)} mm {tr('d’eau', 'water')})</small
                            >{#if tip.rainCloud && !rainy}<small title={tip.rainCloud.title}>{tip.rainCloud.text}</small>{/if}</b
                        >
                    </div>
                {/if}
                {#if tip.snowLine != null}
                    <div class="wpp-tip__row">
                        <span
                            title={tr(
                                'Altitude au-dessus de laquelle les flocons ne fondent pas : thermomètre mouillé à +1 °C',
                                'Altitude above which snowflakes do not melt: wet-bulb temperature of +1 °C',
                            )}>{tr('Limite pluie-neige', 'Snow line')}</span
                        ><b>{tip.snowLine <= tip.col.ground ? tr('au sol', 'at the ground') : `~${r50(tip.snowLine)} m`}</b>
                    </div>
                {/if}
                {#if tip.virga != null}
                    <div class="wpp-tip__row">
                        <span
                            title={tr(
                                'Base des averses à plus de 1 500 m du sol : la pluie s’évapore en tombant dans l’air sec et le refroidit',
                                'Shower base more than 1,500 m above the ground: rain evaporates as it falls through dry air and cools it',
                            )}>Virga</span
                        ><b
                            >{tip.strongVirga
                                ? tr('fortes rafales possibles', 'strong gusts possible')
                                : tr('rafales possibles', 'gusts possible')}</b
                        >
                    </div>
                {/if}
                {#if tip.col.cloudEstimated}
                    <div class="wpp-tip__nodata">
                        {tr('Nébulosité estimée d’après l’humidité : le modèle ne la fournit pas', 'Cloud cover estimated from humidity: the model does not provide it')}
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
                    ? tr('Clic : heure et altitude de la carte', 'Click: map time and altitude')
                    : tr('Détail de l’heure : onglet « Émagramme »', 'Hour details: Sounding tab')}
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
            <!-- Niveaux où le modèle fournit ses données : un point sur l'axe -->
            {#each modelLevels as z}
                <circle cx={left - 3} cy={y(z)} r="2.2" class="wpp-level" />
            {/each}
            <!-- Niveau des crêtes voisines -->
            {#if crest != null && crest < yMax && crest > yMin}
                <path d="M{left - 5.5},{y(crest) + 3}l2.5,-6.5l2.5,6.5z" fill="#b08b68" />
            {/if}
            {#each gridLines as z}
                <line x1={left - 4} x2={left - 0.5} y1={y(z)} y2={y(z)} stroke="currentColor" stroke-opacity="0.4" />
                {#if showAltLabel(z)}
                    <text x={left - 6} y={y(z) + 4} class="wpp-axis" text-anchor="end">{z}</text>
                {/if}
            {/each}
            <line x1={left - 4} x2={left - 0.5} y1={y(ground)} y2={y(ground)} stroke="#b08b68" stroke-width="1.5" />
            <text x={left - 6} y={y(ground) + 4} class="wpp-axis wpp-axis--ground" text-anchor="end"
                >{ground}</text
            >
            <!-- Vent au sol, écrit dans le relief : vent moyen sous l'altitude du sol, rafales en dessous -->
            <text x={left - 6} y={surfY} class="wpp-axis wpp-axis--unit" text-anchor="end"
                >{tr('Vent', 'Wind')}</text
            >
            {#if hasGust}
                <text x={left - 6} y={gustY} class="wpp-axis wpp-axis--unit" text-anchor="end"
                    >{tr('Raf.', 'Gust')}</text
                >
            {/if}
            <text x={left - 6} y={skyY + 3.5} class="wpp-axis wpp-axis--ease" text-anchor="end"
                >{tr('Nuages', 'Clouds')}</text
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
            <!-- Altitude de la carte, écrite sur l'axe au bout de ses tirets orange -->
            {#if mapY != null && mapZ != null}
                <rect x="2" y={mapY - 8} width={left - 4} height="16" rx="3" fill="#f5a623" />
                <text x={left / 2} y={mapY + 3.5} class="wpp-axis-hover" text-anchor="middle"
                    >{Math.round(mapZ / 10) * 10}</text
                >
            {/if}
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
    import { FAST_FRONT, type Front } from './fronts';
    import type { ThermalEase } from './physics';

    /** Défilement horizontal du graphique, gardé quand on change de jour, d'onglet ou de lieu */
    let savedScroll: number | null = null;

    /** Fronts, aux couleurs des cartes météo : bleu pour le froid, rouge pour le chaud */
    export const FRONT: Record<Front['kind'], { color: string; label: string }> = {
        cold: { color: '#2563eb', label: tr('Front froid', 'Cold front') },
        warm: { color: '#e11d48', label: tr('Front chaud', 'Warm front') },
        occluded: { color: '#9333ea', label: tr('Occlusion', 'Occluded front') },
    };
    /** Nom d'un front : un front froid qui passe sans pluie est dit sec, un front d'au moins 50 km/h rapide */
    const frontLabel = (f: Front) => {
        const name = f.dry ? tr('Front froid sec', 'Dry cold front') : FRONT[f.kind].label;
        return f.speed != null && f.speed >= FAST_FRONT
            ? tr(`${name} rapide`, `Fast ${name.toLowerCase()}`)
            : name;
    };

    /**
     * Qualité des thermiques, donnée par l'infobulle : couleur et libellé, hachures (dans la légende)
     * quand le vent les hache, gris aux heures de pluie ou de risque d'orage
     */
    export const EASE: Record<ThermalEase, { color: string; label: string; hatch: boolean }> = {
        easy: { color: '#4caf50', label: tr('francs', 'well-formed'), hatch: false },
        unsettled: { color: '#94a3b8', label: tr('pluie ou orage', 'rain or storm'), hatch: false },
        weak: { color: '#f5c542', label: tr('faibles', 'weak'), hatch: false },
        low: { color: '#f5c542', label: tr('plafond bas', 'low ceiling'), hatch: false },
        ridge: { color: '#f5c542', label: tr('sous les crêtes', 'below the ridges'), hatch: false },
        choppy: { color: '#f59e0b', label: tr('hachés', 'choppy'), hatch: true },
        rough: { color: '#ef4444', label: tr('très hachés', 'very choppy'), hatch: true },
    };
</script>

<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';

    import { FRONT_TOP } from './fronts';
    import { clockText, hourShort, hourText } from './i18n';
    import StormIcon from './StormIcon.svelte';
    import {
        type Column,
        STORM_COLORS,
        capeColor,
        cardinal,
        cloudAt,
        type CloudDeck,
        cloudDecksOf,
        cumulusCover,
        cumulusSpread,
        hasCumulus,
        isCumuliform,
        interpProfile,
        liftedIndexColor,
        lowCloudColors,
        nightFactor,
        rgbCss,
        SATURATED_SPREAD,
        saturatedLayers,
        skyColors,
        snowLineOf,
        thermalColor,
        thermalEase,
        netClimb,
        thermalRGB,
        thermalShape,
        toCelsius,
        toKmh,
        towerColors,
        varioAt,
        virgaOf,
        waveOf,
        downdraftOf,
        dustDevilsOf,
        STRONG_DOWNDRAFT,
        windAt,
        windColor,
    } from './physics';
    import { scrub, type ScrubPoint } from './scrub';
    import { arrowPath, cumulusPath, frontPips, smoothPath } from './svg';
    import { dayKey, localHour } from './time';
    import type { NearbyStorm } from './nearby';

    export let columns: Column[] = [];
    /** Passages de front de toute la prévision (frontsOf) */
    export let fronts: Front[] = [];
    /** Altitude (m AMSL) des crêtes voisines ; null en plaine ou tant qu'elle n'est pas connue */
    export let crest: number | null = null;
    export let width = 760;
    /** Bas demandé du graphique (m AMSL) : `yMin`, le bas affiché, descend plus bas quand le relief est mince */
    let yFloor = 0;
    export { yFloor as yMin };
    export let yMax = 4000;
    export let nowTs: number = Date.now();
    /** Heure choisie (celle de la carte), repérée sur le graphique */
    export let selectedTs: number | null = null;
    /** Altitude (m AMSL) du niveau qu'affiche la carte, repérée sur le graphique ; null si elle n'y est pas */
    export let mapZ: number | null = null;
    /** Orage d'un point voisin qui se dirige vers le lieu (nearbyStormOf) */
    export let nearby: NearbyStorm | null = null;
    /** La journée défile (lecture lancée) */
    export let playing = false;
    /** Lever et coucher du soleil (timestamps) et décalage horaire du lieu (h), pour l'affichage */
    export let sunrise: number | null = null;
    export let sunset: number | null = null;
    export let utcOffset = 0;
    /** Thème clair : couleurs du vent plus soutenues dans l'infobulle (le graphique, lui, ne change pas) */
    export let light = false;

    /**
     * select : heure choisie ; level : altitude pointée à cette heure, que la carte prend aussi ;
     * play : lecture de la journée lancée ou arrêtée
     */
    const dispatch = createEventDispatcher<{
        select: number;
        level: { ts: number; z: number };
        play: void;
    }>();

    const range = (from: number, to: number, step: number) => {
        const out: number[] = [];
        for (let v = from; v <= to + 1e-6; v += step) out.push(v);
        return out;
    };

    /** Largeur minimale (px) d'une colonne horaire : en dessous, le graphique défile horizontalement */
    const MIN_COL = 30;
    // Pas de marge à droite : le graphique va jusqu'au bord du panneau
    const right = 1;
    /** Bandeau du ciel, au-dessus du graphique : part du ciel couverte de nuages à chaque heure */
    const SKY_H = 15;
    /** Barre de l'heure, tout en haut : hauteur de la rangée et milieu de sa piste */
    const RAIL_H = 20;
    const railY = RAIL_H / 2;
    const skyTop = RAIL_H + 3;
    const skyY = skyTop + SKY_H / 2;
    const top = skyTop + SKY_H + 5;
    /**
     * Gris d'une case de ciel couvert (une case de ciel dégagé est transparente), et couverture à
     * partir de laquelle le thème clair y écrit en blanc : en dessous, la case est encore claire
     */
    const SKY_GREY = '#6b7280';
    const SKY_WHITE_INK = 0.7;
    const mainH = 430;
    /** Pas possibles (m) entre deux rangées de flèches du vent, et écart minimal (px) entre elles */
    const WIND_STEPS = [100, 150, 200, 250, 300, 400, 500, 750, 1000];
    const WIND_ROW = 24;
    /**
     * Vent au sol, écrit dans le relief : ligne de base (px sous la ligne du sol) du vent moyen et
     * des rafales, et marge sous la dernière
     */
    const SURF = { mean: 14, gust: 26, pad: 4 };
    /** Taille (px) d'une maille du champ de fond, lissée ensuite par le navigateur */
    const FIELD_RES = 1 / Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    /** Rangées du rideau de pluie : décalage vers le bas (px), en travers (part de sa largeur), opacité */
    const RAIN_ROWS = [
        { dy: 0, shift: 0, alpha: 1 },
        { dy: 13, shift: 0.12, alpha: 0.6 },
        { dy: 26, shift: 0, alpha: 0.3 },
    ];

    /**
     * Largeur d'un cumulus des thermiques (part de la colonne) selon la quantité de cumulus : de
     * quelques cumulus (10 % de nuages du modèle dans leur couche, ou moins) à des cumulus étalés (60 %)
     */
    const CU_WIDTH = { few: 0.5, many: 0.95, cover: [10, 60] };

    /** Tirets de l'air saturé (px) : écart entre deux lignes, épaisseur, longueur d'un tiret et période */
    const MIST = { pitch: 6, thick: 2, dash: 9, period: 15 };
    /**
     * Halo des nuages plus hauts que le graphique, sous son bord supérieur : hauteur (px), hauteur
     * (px) de la bande pleine tout en haut, et opacité au plus fort du halo pour quelques nuages et
     * pour un ciel couvert
     */
    const GLOW = 38;
    const GLOW_BAND = 5;
    const GLOW_ALPHA: readonly [number, number] = [0.6, 1];
    /**
     * Nappes de nuages du fond : opacité du corps, épaisseur (px) du trait sombre de la base et du
     * dessus éclairé d'une mer de nuages, hauteur (px) de l'ombre au-dessus de la base, hauteurs (px)
     * entre lesquelles s'estompe une couche épaisse, part de la colonne où un bout de nappe se
     * referme, bourgeons du dessus d'une couche en amas (largeur et hauteur, px), et hauteur (px) au
     * plus du corps d'un altocumulus : le modèle ne sait pas le faire aussi mince qu'il est, le voile
     * montre au-dessus où il met des nuages
     */
    const SHEET = {
        alpha: 0.9,
        base: 1.6,
        top: 2.4,
        shade: 14,
        fade: [18, 90],
        round: 0.4,
        puff: [14, 6],
        thin: 22,
    };
    /** Taille des bourgeons qui se suivent (part de leur hauteur) : inégaux, comme un dessus de cumulus */
    const PUFFS = [1, 0.6, 0.85, 0.5, 0.95, 0.7];

    /** Nappe de nuages d'une heure, à sa place sur le graphique (px) */
    interface Sheet {
        yBase: number;
        yTop: number;
        /** La pluie de l'heure en tombe */
        rain: boolean;
        /** Mer de nuages : dessus éclairé */
        sea: boolean;
        /**
         * Couche dessinée jusqu'à son sommet (nuages bas) ou en bande mince (altocumulus) ; sinon
         * couche épaisse, estompée en montant
         */
        low: boolean;
        /** Couche en amas (cumulus, stratocumulus, altocumulus) : dessus moutonné */
        puffy: boolean;
        /** Même nappe que celle de l'heure qui précède */
        joined: boolean;
    }

    let canvasEl: HTMLCanvasElement | undefined;
    let svgEl: SVGSVGElement;

    const r50 = (z: number) => Math.round(z / 50) * 50;
    /** Pluie (mm/h) en dessous de laquelle la pluie d'une couche de nuages bas est de la bruine */
    const DRIZZLE = 0.5;

    // Marge gauche réduite à la seule colonne des altitudes. Toutes les heures restent affichées :
    // si les colonnes deviennent trop fines, le graphique (largeur W) défile horizontalement
    const left = 40;
    $: shown = columns;
    $: W = Math.max(width, left + right + columns.length * MIN_COL);

    $: n = shown.length;
    $: plotW = Math.max(100, W - left - right);
    $: colW = n ? plotW / n : 0;
    /** Bandeau de pluviométrie, sous le graphique */
    const RAIN_H = 30;
    const rainTop = top + mainH + 6;
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
    /** Le modèle fournit-il des rafales ? */
    $: hasGust = shown.some(c => c.gust != null);
    // Bas du graphique : celui demandé, descendu au besoin pour que le relief, sous la ligne du sol,
    // ait la hauteur du vent au sol qui y est écrit
    $: surfRoom = (hasGust ? SURF.gust : SURF.mean) + SURF.pad;
    $: yMin = Math.min(yFloor, ground - ((yMax - ground) * surfRoom) / (mainH - surfRoom));
    $: span = Math.max(500, yMax - yMin);

    $: y = (z: number) => top + mainH * (1 - (z - yMin) / span);
    $: cx = (i: number) => left + (i + 0.5) * colW;

    // Pas des flèches de vent : le plus fin qui laisse WIND_ROW px entre deux rangées
    $: windStep = WIND_STEPS.find(s => (s / span) * mainH >= WIND_ROW) ?? 1000;
    // Graduations : à partir du bas demandé, au pas qui lui correspond
    $: gridStep = yMax - yFloor <= 2500 ? 250 : yMax - yFloor <= 5000 ? 500 : 1000;
    $: gridLines = range(Math.ceil(yFloor / gridStep) * gridStep, yMax, gridStep);
    // Vent au sol, dans le relief sous la ligne du sol : vent moyen, puis rafales
    $: surfY = y(ground) + SURF.mean;
    $: gustY = y(ground) + SURF.gust;
    /** Bas (px) de ce qui est écrit dans le relief */
    $: surfEnd = y(ground) + surfRoom;
    // L'altitude du sol est écrite sur l'axe : on masque les graduations trop proches d'elle, ou
    // des libellés du vent au sol écrits dessous
    $: showAltLabel = (z: number) =>
        Math.abs(z - ground) >= span * 0.04 && !(y(z) > y(ground) && y(z) < surfEnd + 2);
    $: showWindText = colW >= 20;
    // Flèche raccourcie quand les rangées sont serrées : elle et sa valeur tiennent entre deux rangées
    $: arrowLen = Math.max(9, Math.min(17, colW * 0.6, (windStep / span) * mainH - 11));
    $: arrow = arrowPath(arrowLen, 6, 4.2, 1.2);
    /** Ligne de base de la valeur du vent, sous sa flèche (px sous l'altitude de la rangée) */
    $: windTextDy = arrowLen / 2 + 3.5;
    /** Flèche du vent au sol, de taille fixe : la case n'a que la largeur d'une heure */
    const surfArrow = arrowPath(11, 4.5, 3.4, 1);

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
        // Rangée du haut à une rangée au moins du bord : la place des icônes du haut de la colonne
        for (
            let z = Math.max(firstRow, Math.ceil(yMin / windStep) * windStep);
            z <= yMax - (WIND_ROW / mainH) * span;
            z += windStep
        ) {
            if (z <= src.ground) continue;
            const wind = windAt(src.profile, z);
            if (!wind) continue;
            const kmh = Math.round(toKmh(wind.speed));
            winds.push({ y: y(z), dir: wind.dir, kmh, color: windColor(kmh) });
        }

        /** Pied du rideau de pluie : base du nuage dont elle tombe */
        let rain: { x: number; y: number; w: number } | null = null;
        const thermalCu = hasCumulus(src);
        const cuBase = towerBase(src);
        // Largeur d'un rideau de pluie : d'autant plus étroit qu'elle est faible (même échelle que
        // les barres de pluie)
        const rainW = Math.min(colW * (0.45 + 0.5 * Math.min(1, Math.sqrt(src.precip / 5))), 64);
        const yGround = y(Math.max(src.ground, yMin));

        // Pluie sans nuage d'averses : elle tombe de la nappe des nuages en couches du modèle. Si
        // la couche est plus haute que le graphique, la pluie part de son bord supérieur
        if (rainsFromLayers(src, yMax)) rain = { x: cx(i), y: sheets[i]?.yBase ?? top, w: rainW };

        // Nuage convectif, en tour de la base au sommet : cumulus des thermiques (seulement s'ils
        // sont exploitables) ou nuage d'averses du modèle ; quand il en tombe des averses, la tour
        // est grise et monte jusqu'au plus haut des deux sommets. Une tour qui dépasse le haut du
        // graphique y est coupée net (pas de sommet arrondi)
        let cloud = null;
        if (cuBase != null && cuBase < yMax) {
            const shower = src.showerBase != null;
            const cuTop = Math.max((thermalCu ? src.cuTop : null) ?? cuBase, src.showerTop ?? cuBase);
            // Averses d'heures qui se suivent : tours assez larges pour se rejoindre
            const fused = [shown[i - 1], shown[i + 1]].some(
                o => o?.showerBase != null && (towerBase(o) as number) < yMax,
            );
            // Cumulus des thermiques : d'autant plus large que le modèle met de nuages dans leur couche
            const [few, many] = CU_WIDTH.cover;
            const share = shower
                ? thermalCu
                    ? 0.95
                    : 0.85
                : CU_WIDTH.few + (CU_WIDTH.many - CU_WIDTH.few) * smooth((cumulusCover(src) - few) / (many - few));
            const w = shower && fused ? colW * 1.12 : Math.min(colW * share, 64);
            const yb = y(cuBase);
            const colors = towerColors(shower, nightFactor(src.sunElev));
            cloud = {
                x: cx(i),
                yb,
                w,
                body: rgbCss(colors.body),
                base: rgbCss(colors.base),
                d: cumulusPath(cx(i), yb, w, Math.min(yb - top + w, Math.max(w * 0.45, yb - y(cuTop)))),
            };
            if (shower) rain = { x: cx(i), y: yb, w: rainW };
        }

        // Rideau de pluie sous le nuage : quelques rangées de traits qui s'estompent vers le bas,
        // autant qu'il en tient au-dessus du sol
        const yRain = rain?.y ?? 0;
        const rows = RAIN_ROWS.filter((row, k) => k === 0 || yRain + row.dy + 15 <= yGround);
        const streaks = rain && { ...rain, rows };
        // Virga : chevrons là où l'air refroidi descend, sous le rideau de pluie ou, sans pluie au
        // sol, sous la base du nuage
        const virgaBase = virgaOf(src);
        const virga =
            virgaBase == null || virgaBase >= yMax
                ? null
                : {
                      x: cx(i),
                      y: rain ? yRain + rows[rows.length - 1].dy + 19 : y(virgaBase) + 7,
                      strong: (downdraftOf(src) ?? 0) >= STRONG_DOWNDRAFT,
                  };
        const wave = crest != null && waveOf(src.profile, crest) != null;
        const dust = dustDevilsOf(src);

        // Vent au sol : flèche et vent moyen côte à côte, centrés dans la colonne (pas de flèche par
        // vent presque nul, sa direction ne dit rien), et rafales
        const mean = Math.round(toKmh(src.windSurf));
        const withArrow = mean >= 2;
        const textW = String(mean).length * 5.5;
        const x0 = cx(i) - ((withArrow ? 13 : 0) + textW) / 2;
        const surf = {
            mean,
            gust: src.gust == null ? null : Math.round(toKmh(src.gust)),
            dir: src.windDirSurf,
            arrowX: withArrow ? x0 + 5.5 : null,
            textX: x0 + (withArrow ? 13 : 0),
        };

        return { src, winds, cloud, streaks, virga, surf, wave, dust };
    });

    // --- Plafond nuageux de chaque heure (cloudDecksOf), dessiné en nappe par le fond : couche de
    // nuages bas (stratus, brouillard, mer de nuages), couche d'où tombe la pluie quand elle ne
    // vient pas d'un nuage d'averses (pluie de front), sinon plus basse couche dense du modèle.
    // Le dessus d'une couche en amas (couche basse nourrie par les thermiques, altocumulus) est moutonné
    $: decks = cloudDecksOf(
        shown.map(c => c.profile),
        shown.map(c => rainsFromLayers(c, yMax)),
        shown.map(c => (c.ceiling != null ? c.thermalTop : null)),
    );
    // Sa place sur le graphique (px). Sous une couche d'où il pleut, la base n'est jamais au ras du
    // sol : le rideau de pluie garde sa place
    $: sheets = decks.map((deck, k): Sheet | null => {
        if (!deck || deck.base >= yMax) return null;
        const floor = deck.rain ? y(Math.max(shown[k].ground, yMin)) - 18 : Infinity;
        const yBase = Math.min(y(deck.base), floor);
        const alto = deck.genus === 'altocumulus';
        return {
            yBase,
            yTop: Math.min(alto ? Math.max(y(deck.top), yBase - SHEET.thin) : y(deck.top), yBase - 7),
            rain: deck.rain,
            sea: !!deck.low?.sea,
            low: !!deck.low || alto,
            puffy: isCumuliform(deck),
            joined: deck.joined,
        };
    });

    /** Altitude (m AMSL) du dernier niveau fourni par le modèle */
    const profileTop = (c: Column) => c.profile[c.profile.length - 1].z;

    /**
     * Niveaux de pression où le modèle fournit ses données : altitude moyenne de chacun sur les
     * heures affichées (elle varie de quelques dizaines de mètres dans la journée). Entre deux
     * niveaux, tout ce que montre le graphique est interpolé.
     */
    $: modelLevels = (() => {
        const byLevel = new Map<number, { sum: number; n: number }>();
        for (const c of shown) {
            for (const p of c.profile.slice(1)) {
                const level = byLevel.get(Math.round(p.p)) ?? { sum: 0, n: 0 };
                level.sum += p.z;
                level.n++;
                byLevel.set(Math.round(p.p), level);
            }
        }
        return [...byLevel.values()].map(l => l.sum / l.n).filter(z => z > yMin && z < yMax);
    })();

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
    /** Couleur entre `a` (t = 0) et `b` (t = 1) */
    const blend = (a: number[], b: number[], t: number) => {
        const c = [...a];
        mix(c, b, t);
        return c;
    };

    /** Fondu de 0 à 1 quand t va de 0 à 1, sans cassure aux deux bouts */
    const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
    /** Hauteur (px) de la part commune de deux intervalles */
    const overlap = (a0: number, a1: number, b0: number, b1: number) =>
        Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

    /**
     * Nappe à l'abscisse `x` (px depuis le bord gauche du graphique, colonnes de largeur `cw`) : base
     * et sommet (px depuis son haut), lissés d'une heure à l'autre comme la ligne de plafond, part de
     * pluie, de mer de nuages, de couche épaisse et de couche en amas, et opacité. null hors de toute
     * nappe. Là où la couche ne se prolonge pas à l'heure voisine, la nappe se referme au bord de la colonne : en
     * arrondi pour une couche basse, en fondu pour une couche épaisse ; au bord du graphique, elle
     * reste ouverte.
     */
    const sheetAt = (marks: (Sheet | null)[], x: number, cw: number) => {
        const u = x / cw;
        const c = Math.min(marks.length - 1, Math.max(0, Math.floor(u)));
        const here = marks[c];
        if (!here) return null;
        const after = u - c >= 0.5;
        const i0 = after ? c : c - 1;
        const a = marks[i0];
        const b = marks[i0 + 1];
        if (a && b && b.joined) {
            const f = u - 0.5 - i0;
            const p0 = (a.joined && marks[i0 - 1]) || a;
            const p3 = (marks[i0 + 2]?.joined && marks[i0 + 2]) || b;
            const at = (key: 'yBase' | 'yTop') => {
                const v =
                    0.5 *
                    (2 * a[key] +
                        (b[key] - p0[key]) * f +
                        (2 * p0[key] - 5 * a[key] + 4 * b[key] - p3[key]) * f * f +
                        (3 * a[key] - p0[key] - 3 * b[key] + p3[key]) * f * f * f);
                return Math.min(Math.max(v, Math.min(a[key], b[key])), Math.max(a[key], b[key]));
            };
            const part = (key: 'rain' | 'sea' | 'low' | 'puffy') => +a[key] + (+b[key] - +a[key]) * f;
            return {
                yb: at('yBase'),
                yt: at('yTop'),
                rain: part('rain'),
                sea: part('sea'),
                thick: 1 - part('low'),
                puffy: part('puffy'),
                alpha: 1,
            };
        }
        let yb = here.yBase;
        let yt = here.yTop;
        let alpha = 1;
        // Bout de nappe, s'il y a une heure affichée au-delà
        if (after ? c < marks.length - 1 : c > 0) {
            const d = (after ? c + 1 - u : u - c) * cw;
            const r = Math.min(cw * SHEET.round, here.low ? (yb - yt) / 2 : Infinity);
            if (d < r) {
                if (here.low) {
                    const squeeze = ((yb - yt) / 2) * (1 - Math.sqrt(1 - ((r - d) / r) ** 2));
                    yb -= squeeze;
                    yt += squeeze;
                } else alpha = smooth(d / r);
            }
        }
        return { yb, yt, rain: +here.rain, sea: +here.sea, thick: +!here.low, puffy: +here.puffy, alpha };
    };

    /**
     * Dessus moutonné d'une couche en amas : hauteur (px, vers le haut) du bourgeon à l'abscisse `x`.
     * Une suite d'arcs inégaux, dont les creux descendent un peu sous le sommet de la couche.
     */
    const puffAt = (x: number) => {
        const u = x / SHEET.puff[0];
        const k = Math.floor(u);
        const arc = Math.sqrt(1 - (2 * (u - k) - 1) ** 2);
        return SHEET.puff[1] * (PUFFS[k % PUFFS.length] * arc - 0.25);
    };

    const drawField = (
        canvas: HTMLCanvasElement,
        cols: Column[],
        marks: (Sheet | null)[],
        w: number,
        zMin: number,
        zMax: number,
        crestZ: number | null,
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
            // Écart T − Td dans les couches d'air saturé, borné au double du seuil partout ailleurs :
            // entre deux heures, la limite de la zone saturée glisse au lieu de faire une marche
            const spread = new Float32Array(gh).fill(2 * SATURATED_SPREAD);
            const wet = saturatedLayers(c.profile);
            for (let row = 0; row < gh; row++) {
                const z = zAt(row);
                cloud[row] = cloudAt(c.profile, z) / 100;
                // Seulement là où il y a du relief pour faire condenser l'air : sous les crêtes voisines
                if (crestZ != null && z <= crestZ && wet.some(l => z >= l.base && z <= l.top)) {
                    const t = interpProfile(c.profile, z, 't');
                    const td = interpProfile(c.profile, z, 'td');
                    if (t != null && td != null) spread[row] = Math.min(t - td, 2 * SATURATED_SPREAD);
                }
            }
            // Paramètres de la couche thermique : sans thermique, sommet au sol et force nulle
            const hasThermal = c.thermalTop != null && c.climb > 0;
            return {
                cloud,
                spread,
                above: cloudAbove(c, zMax),
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
        const tint = [0, 0, 0];
        const cw = w / cols.length;
        const half = FIELD_RES / 2;
        // Nappe de chaque abscisse, et pente de sa base : son trait garde son épaisseur là où elle
        // monte ou descend vite
        const sheetOf = Array.from({ length: gw }, (_, gx) =>
            sheetAt(marks, (gx + 0.5) * FIELD_RES, cw),
        );
        const slopeOf = (gx: number) => {
            const before = sheetOf[gx - 1] ?? sheetOf[gx];
            const after = sheetOf[gx + 1] ?? sheetOf[gx];
            return before && after ? (after.yb - before.yb) / (2 * FIELD_RES) : 0;
        };
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
            const above = a.above + (b.above - a.above) * f;

            // Nappe : claire pour une couche sans pluie, grise quand il en pleut
            const sheet = sheetOf[gx];
            const dry = lowCloudColors(night);
            const wet = towerColors(true, night);
            const body = sheet ? blend(dry.body, wet.body, sheet.rain) : dry.body;
            const under = sheet ? blend(dry.base, wet.base, sheet.rain) : dry.base;
            const yb = sheet ? sheet.yb - top : 0;
            // Couche en amas : dessus moutonné
            const yt = sheet ? sheet.yt - top - sheet.puffy * puffAt((gx + 0.5) * FIELD_RES) : 0;
            const baseLine = SHEET.base * Math.min(6, Math.hypot(1, slopeOf(gx)));

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

                // Nuages plus hauts que le graphique : halo clair qui descend de son bord supérieur
                const yMid = (gy + 0.5) * FIELD_RES;
                if (above > 0.05 && yMid < GLOW) {
                    // Bande pleine au ras du bord, puis fondu : le halo se voit sur le ciel du jour
                    // comme sur celui de la nuit
                    const fade = yMid <= GLOW_BAND ? 1 : 1 - (yMid - GLOW_BAND) / (GLOW - GLOW_BAND);
                    mix(px, sky.glow, (GLOW_ALPHA[0] + (GLOW_ALPHA[1] - GLOW_ALPHA[0]) * above) * fade);
                }

                // Nappe : corps à la base ombrée, d'un trait sombre dessous ; dessus éclairé d'une mer
                // de nuages. Une couche épaisse s'estompe en montant : son sommet se perd dans le voile
                let inSheet = false;
                if (sheet && yMid > yt - half && yMid < yb + half) {
                    /** Part de la maille (0 à 1) prise par la tranche de la nappe qui va de y0 à y1 */
                    const cover = (y0: number, y1: number) => overlap(yMid - half, yMid + half, y0, y1) / FIELD_RES;
                    const up = yb - yMid;
                    const fade = smooth((up - SHEET.fade[0]) / (SHEET.fade[1] - SHEET.fade[0]));
                    const solid = sheet.alpha * (1 - sheet.thick * fade);
                    const shade = 0.45 * Math.max(0, 1 - up / SHEET.shade);
                    tint[0] = body[0] + (under[0] - body[0]) * shade;
                    tint[1] = body[1] + (under[1] - body[1]) * shade;
                    tint[2] = body[2] + (under[2] - body[2]) * shade;
                    mix(px, tint, SHEET.alpha * solid * cover(yt, yb));
                    if (sheet.sea > 0) {
                        const lit = cover(yt, Math.min(yb, yt + SHEET.top));
                        mix(px, dry.top, lit * sheet.sea * (1 - sheet.thick) * sheet.alpha);
                    }
                    mix(px, under, 0.95 * sheet.alpha * cover(Math.max(yt, yb - baseLine), yb));
                    inSheet = solid > 0.5;
                }

                // Air saturé à hauteur du relief voisin (il est pris dans les nuages) : tirets horizontaux
                // en quinconce, comme le symbole de la brume ; clairs sur le ciel, sombres sur le voile.
                // Rien dans une nappe : elle dit déjà que le relief est dans les nuages
                if (a.spread[gy] + (b.spread[gy] - a.spread[gy]) * f <= SATURATED_SPREAD) {
                    const yPx = gy * FIELD_RES;
                    const line = Math.floor(yPx / MIST.pitch);
                    const xPx = gx * FIELD_RES + (line % 2) * (MIST.period / 2);
                    if (!inSheet && yPx - line * MIST.pitch < MIST.thick && xPx % MIST.period < MIST.dash) {
                        if (cl > 0.4) mix(px, sky.top, 0.34);
                        else mix(px, sky.cloud, 0.95);
                    }
                }

                const k = (gy * gw + gx) * 4;
                img.data[k] = px[0];
                img.data[k + 1] = px[1];
                img.data[k + 2] = px[2];
                img.data[k + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    };

    $: if (canvasEl) drawField(canvasEl, shown, sheets, plotW, yMin, yMax, crest);

    // --- Courbes lissées
    $: curve = (values: (number | null)[]) =>
        smoothPath(values.map((v, i) => (v == null || v > yMax + 200 ? null : { x: cx(i), y: y(v) })));

    $: ceilingPath = curve(shown.map(c => c.ceiling));
    $: freezingPath = curve(shown.map(c => c.freezing));
    // Limite pluie-neige, aux heures de précipitations seulement
    $: snowLines = shown.map(c => (c.precip >= 0.1 ? snowLineOf(c.profile) : null));
    $: snowPath = curve(snowLines);
    $: snowLabel = (() => {
        const i = snowLines.findIndex(z => z != null && z < yMax && z > yMin);
        return i < 0 ? null : { x: cx(i), y: y(snowLines[i] as number) };
    })();
    $: freezingLabel = (() => {
        for (let i = n - 1; i >= 0; i--) {
            const f = shown[i].freezing;
            if (f != null && f < yMax && f > yMin) return { x: left + plotW, y: y(f) };
        }
        return null;
    })();

    // --- Bandeau du ciel : case de chaque heure, d'autant plus grise que le ciel est couvert, où la
    // couverture est écrite à la couleur du texte du thème (en blanc sur une case grise du thème clair)
    $: sky = shown.map(c => ({
        cover: c.cloudCover,
        ink: light && c.cloudCover >= SKY_WHITE_INK ? '#fff' : 'var(--wpp-fg)',
        label: fitText(`${Math.round(c.cloudCover * 100)}%`, colW - 2),
    }));

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
    /**
     * L'heure actuelle n'est repérée que le jour même, à l'heure locale du lieu : peu avant minuit,
     * elle tomberait sinon dans la demi-colonne qui précède 0 h sur le graphique du lendemain.
     */
    $: isToday = (() => {
        if (!n) return false;
        const at = [...shown].reverse().find(c => c.ts <= nowTs) ?? shown[0];
        return dayKey(nowTs, at.utcOffset) === dayKey(shown[0].ts, shown[0].utcOffset);
    })();
    $: nowX = isToday ? xOfTs(nowTs) : null;
    $: selX = selectedTs == null ? null : xOfTs(selectedTs);

    const hhmm = (ts: number, offset: number) => {
        const d = new Date(ts + offset * 3600e3);
        return clockText(d.getUTCHours(), d.getUTCMinutes());
    };

    /**
     * Bouton de la barre de l'heure : l'heure choisie, à l'heure locale de sa colonne (un changement
     * d'heure peut tomber dans la journée). Il reste dans le cadre aux deux bouts de la journée.
     */
    $: selPill = (() => {
        if (selectedTs == null || selX == null) return null;
        const col = shown[Math.max(0, Math.min(n - 1, Math.floor((selectedTs - shown[0].ts) / stepMs)))];
        const label = hhmm(selectedTs, col.utcOffset);
        const w = label.length * 6.6 + 12;
        return { label, w, x: clamp(selX, left + w / 2, left + plotW - w / 2) };
    })();

    // --- Barre de l'heure : appui ou glissé, l'heure choisie est celle de la colonne sous le doigt
    let railDrag = false;
    const railPick = (e: PointerEvent) => {
        const r = svgEl.getBoundingClientRect();
        const x = ((e.clientX - r.left) * (W - left)) / r.width + left;
        const i = Math.max(0, Math.min(n - 1, Math.floor((x - left) / colW)));
        if (shown[i] && shown[i].ts !== selectedTs) dispatch('select', shown[i].ts);
    };
    const railDown = (e: PointerEvent) => {
        railDrag = true;
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        railPick(e);
    };
    const railMove = (e: PointerEvent) => {
        if (railDrag) railPick(e);
    };
    const railUp = () => (railDrag = false);

    $: sunMarks = [
        { ts: sunrise, icon: '☀↑' },
        { ts: sunset, icon: '☀↓' },
    ]
        .map(s => (s.ts == null ? null : { x: xOfTs(s.ts), label: `${s.icon} ${hhmm(s.ts, utcOffset)}` }))
        .filter((s): s is { x: number; label: string } => !!s && s.x != null);

    // --- Passages de front : ceux dont le trait traverse les heures affichées
    $: frontMarks = (() => {
        if (!n) return [];
        // Symboles entre deux rangées de flèches du vent, là où elles les cachent le moins, sous les
        // icônes du haut et au-dessus de la ligne du sol
        const pipZs = range((Math.ceil(yMin / windStep) + 0.5) * windStep, yMax, windStep).filter(
            z => y(z) > top + 40 && y(z) < y(Math.max(ground, yMin)) - 10,
        );
        const xOf = (ts: number) => cx((ts - shown[0].ts) / stepMs);
        return fronts.flatMap(front => {
            const { color } = FRONT[front.kind];
            // Surface du front : l'heure où il passe à chaque altitude connue (sol, niveau lu sur la
            // carte, milieu de la couche de l'air libre), reliées par des droites. Au-dessus, le
            // dernier segment se prolonge jusqu'au sommet de cette couche : plus haut, rien ne dit où
            // elle est
            const known = front.surface.map(p => ({ z: p.z, x: xOf(p.ts) }));
            const xAt = (z: number) => {
                const above = known.findIndex(p => p.z >= z);
                const k = above < 0 ? known.length - 1 : Math.max(1, above);
                const [a, b] = [known[k - 1], known[k]];
                return a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z || 1);
            };
            const zFoot = Math.max(ground, yMin);
            const zHead = Math.min(yMax, ground + FRONT_TOP);
            const point = (z: number) => ({ x: xAt(z), y: y(z) });
            const bends = known.map(p => p.z).filter(z => z > zFoot && z < zHead);
            const line = [zFoot, ...bends, zHead].map(point);
            const x0 = Math.min(...line.map(p => p.x));
            const x1 = Math.max(...line.map(p => p.x));
            if (zHead <= zFoot || x1 < left || x0 > left + plotW) return [];
            // Symboles : chacun tourné selon le segment qui le porte
            const edges = [zFoot, ...bends, zHead];
            const pips = pipZs
                .filter(z => z > zFoot && z < zHead)
                .map(z => {
                    const k = Math.max(1, edges.findIndex(e => e >= z));
                    return frontPips(front.kind, point(edges[k - 1]), point(edges[k]), [point(z)], 6.5);
                })
                .join('');

            return {
                front,
                color,
                path: line.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(''),
                x0,
                x1,
                pips,
            };
        });
    })();

    /**
     * Heure du passage au sol d'un front : « entre 13h et 16h » quand le modèle n'est fourni que
     * toutes les 3 h, sinon son heure
     */
    const frontWhen = (f: Front) => {
        if (!f.between) return hourText(f.at.hour);
        const [a, b] = f.between.map(ts => hourShort(localHour(ts, f.at.utcOffset)));
        return tr(`entre ${a} et ${b}`, `between ${a} and ${b}`);
    };
    const round5 = (v: number) => Math.round(v / 5) * 5;

    /** Colonne de l'heure où l'orage voisin peut arriver, si elle est affichée */
    $: nearbyAt = (() => {
        if (!nearby || !n) return null;
        const i = Math.floor((nearby.arrival - shown[0].ts) / stepMs);
        return i >= 0 && i < n ? i : null;
    })();

    /** Position (px) de l'altitude de la carte, quand elle tient dans le graphique */
    $: mapY = mapZ != null && mapZ >= ground && mapZ <= yMax ? y(mapZ) : null;

    // --- Survol et infobulle
    let hover: { i: number; z: number | null; x: number; y: number } | null = null;

    const pointer = (e: ScrubPoint) => {
        const r = svgEl.getBoundingClientRect();
        const x = ((e.clientX - r.left) * (W - left)) / r.width + left;
        const yy = ((e.clientY - r.top) * height) / r.height;
        const i = Math.floor((x - left) / colW);
        if (i < 0 || i >= n) return null;
        // Pas d'altitude pointée sous le bas demandé du graphique : il n'y a là que du relief
        const z = yy >= top && yy <= y(yFloor) ? yMin + (1 - (yy - top) / mainH) * span : null;
        return { i, z, x, y: yy };
    };

    const onMove = (e: MouseEvent) => (hover = pointer(e));

    /** Au doigt, après un appui maintenu : l'infobulle suit le doigt, d'heure en heure et en altitude */
    const onScrub = (point: ScrubPoint) => {
        pointerType = 'touch';
        hover = pointer(point) ?? hover;
    };

    const onClick = (e: MouseEvent) => {
        const p = pointer(e);
        if (p) {
            hover = p;
            dispatch('select', shown[p.i].ts);
            if (p.z != null) dispatch('level', { ts: shown[p.i].ts, z: p.z });
        }
    };

    $: tip = hover && shown[hover.i] ? buildTip(shown[hover.i], hover.z, decks[hover.i] ?? null) : null;
    // Front de l'heure survolée : celui qui y passe au sol, sinon celui dont le trait la traverse
    $: tipFront =
        (tip &&
            hover &&
            (frontMarks.find(m => m.front.at.ts === tip.col.ts) ??
                frontMarks.find(m => cx(hover!.i) >= m.x0 - colW / 2 && cx(hover!.i) <= m.x1 + colW / 2)
            )?.front) ||
        null;

    const buildTip = (col: Column, z: number | null, deck: CloudDeck | null) => {
        const low = deck?.low ?? null;
        const key = thermalEase(col, crest);
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
                cloud: cloudAt(col.profile, z),
                /** Altitude pointée au-dessus du dernier niveau du modèle : rien à y lire */
                beyond: z > profileTop(col),
            };
        }
        // Limite pluie-neige aux heures de précipitations, virga et ondes de relief
        const snowLine = col.precip >= 0.1 ? snowLineOf(col.profile) : null;
        const virga = virgaOf(col);
        const strongVirga = (downdraftOf(col) ?? 0) >= STRONG_DOWNDRAFT;
        const dust = dustDevilsOf(col);
        const wave = crest == null ? null : waveOf(col.profile, crest);
        // Le groupe « Nuages et précipitations » ne s'affiche que s'il a au moins une ligne
        const clouds =
            deck != null ||
            virga != null ||
            col.cloudEstimated ||
            (alt != null && alt.cloud > 3) ||
            col.cloudCover > 0.03 ||
            cloudAbove(col, yMax) > 0.05 ||
            hasCumulus(col) ||
            (col.showerBase != null && col.showerTop != null) ||
            col.precip >= 0.1;
        // Plafond nuageux qui n'est pas une couche basse : couche d'où tombe la pluie, quand elle ne
        // vient pas d'un nuage d'averses, ou simple couche dense
        const layer = deck && !low && deck.rain ? deck : null;
        const ceiling = deck && !low && !deck.rain ? deck : null;
        const genus = deck?.genus ?? null;
        // Nuage d'où tombent les précipitations : nuage d'averses, sinon couche de la pluie
        const cloudRange = (base: number, top: number, capped: boolean, name: string) => ({
            text: `${r50(base)}–${r50(top)}${capped ? '+' : ''} m`,
            title:
                name +
                (capped
                    ? tr(
                          ' ; sommet au-delà du dernier niveau fourni par le modèle',
                          '; top beyond the highest level provided by the model',
                      )
                    : ''),
        });
        const rainCloud =
            col.showerBase != null && col.showerTop != null
                ? cloudRange(
                      col.showerBase,
                      col.showerTop,
                      showerCapped(col),
                      tr('Base et sommet du nuage d’averses', 'Base and top of the shower cloud'),
                  )
                : layer
                  ? cloudRange(
                        layer.base,
                        layer.top,
                        layer.top >= profileTop(col),
                        tr('Base et sommet de la couche d’où tombe la pluie', 'Base and top of the layer the rain falls from'),
                    )
                  : null;
        return { col, ease, alt, clouds, low, ceiling, genus, rainCloud, snowLine, virga, strongVirga, dust, wave, spread: cumulusSpread(col) };
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
    // Ensuite le graphique garde sa position (changement de jour, d'onglet, de lieu…), sauf si
    // l'heure choisie sort de la partie affichée : il défile alors jusqu'à elle
    let scrollReady = false;
    $: if (scrollEl && n && !scrollReady) {
        scrollReady = true;
        const nowIdx = shown.findIndex(c => nowTs >= c.ts && nowTs < c.ts + stepMs);
        const idx = nowIdx >= 0 ? nowIdx : Math.max(0, shown.findIndex(c => c.hour >= 11));
        tick().then(() => {
            scrollEl.scrollLeft = savedScroll ?? Math.max(0, idx * colW - (width - left) / 3);
            savedScroll = scrollX = scrollEl.scrollLeft;
            showSelected(selX);
        });
    }
    $: if (scrollReady) showSelected(selX);

    const showSelected = (x: number | null) => {
        if (x == null || !scrollEl) return;
        const view = width - left;
        const pos = x - left;
        if (pos >= scrollEl.scrollLeft + colW / 2 && pos <= scrollEl.scrollLeft + view - colW / 2) return;
        scrollEl.scrollLeft = Math.max(0, pos - view / 2);
    };

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

    // Lecture de la journée : petit bouton dans la marge de l'axe, à la hauteur de la barre de l'heure
    .wpp-rail-play {
        position: absolute;
        left: 2px;
        top: 1px;
        z-index: 1;
        padding: 0;
        border: 1px solid var(--wpp-border);
        border-radius: 6px;
        background: var(--wpp-surface);
        color: var(--wpp-fg);
        font-size: 9px;
        line-height: 1;
        cursor: pointer;

        &:hover {
            background: var(--wpp-surface-hover);
        }
        &.on {
            background: #f5a623;
            border-color: #f5a623;
            color: #111;
        }
    }

    .wpp-chart-scroll {
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        // Barre de défilement discrète, la même pour les jours, le graphique et l'émagramme : fine,
        // sans piste, pour ne pas passer pour un second curseur de l'heure
        scrollbar-width: thin;
        scrollbar-color: var(--wpp-border-strong) transparent;
        &::-webkit-scrollbar {
            height: 5px;
        }
        &::-webkit-scrollbar-track {
            background: transparent;
        }
        &::-webkit-scrollbar-thumb {
            border-radius: 3px;
            background: var(--wpp-border-strong);
        }
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
        // Niveau du modèle : point posé sur le bord du graphique
        .wpp-level {
            fill: var(--wpp-fg);
            stroke: var(--wpp-halo);
            stroke-width: 1;
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
        // thèmes. Seuls les axes et les bandeaux du bas (pluie, CAPE et LI), posés sur le fond du
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
        // Limite pluie-neige : pointillé pâle, de la couleur de la neige du bandeau de pluie
        .wpp-snowline {
            fill: none;
            stroke: #e4dcff;
            stroke-width: 1.6;
            stroke-dasharray: 1.5 4;
            stroke-linecap: round;
        }
        .wpp-snowline-label {
            fill: #e4dcff;
            font-size: 11px;
            paint-order: stroke;
            stroke: rgba(15, 24, 34, 0.6);
            stroke-width: 2.5px;
        }
        // Niveau des crêtes voisines
        .wpp-crest {
            stroke: #b08b68;
            stroke-width: 1.2;
            stroke-dasharray: 1 5;
            stroke-linecap: round;
            stroke-opacity: 0.8;
        }
        // Virga : chevrons de l'air qui descend sous l'averse
        .wpp-virga {
            fill: none;
            stroke: #f59e0b;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
            &--halo {
                stroke: #0f1822;
                stroke-opacity: 0.55;
                stroke-width: 4;
            }
            // Air très sec sous le nuage : fortes rafales possibles
            &--strong {
                stroke: #ef4444;
            }
        }
        // Tourbillons de poussière possibles : entonnoir couleur sable, au ras du sol
        .wpp-dust {
            fill: none;
            stroke: #f3d9a4;
            stroke-width: 1.8;
            stroke-linecap: round;
            &--halo {
                stroke: #0f1822;
                stroke-opacity: 0.6;
                stroke-width: 4;
            }
        }
        // Ondes de relief possibles
        .wpp-wave {
            fill: none;
            stroke: #ffffff;
            stroke-width: 1.8;
            stroke-linecap: round;
            &--halo {
                stroke: #0f1822;
                stroke-opacity: 0.55;
                stroke-width: 4;
            }
        }
        // Barre de l'heure : bouton orange qui porte l'heure choisie
        .wpp-rail-thumb {
            fill: #f5a623;
            stroke: #fff;
            stroke-width: 1.5;
        }
        .wpp-rail-time {
            font-size: 11.5px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            fill: #111;
            pointer-events: none;
        }
        // Le glissé sur la barre choisit l'heure : il ne fait pas défiler le graphique
        .wpp-rail-hit {
            cursor: ew-resize;
            touch-action: none;
        }
        // Couverture nuageuse écrite sur la case du ciel
        .wpp-sky-pct {
            font-weight: bold;
            font-variant-numeric: tabular-nums;
        }
        // Nuage convectif : contour sombre, pour se détacher du voile comme des nappes ; dans une
        // masse de nuages qui se recouvrent, il ne reste des contours qu'un bourgeonnement discret
        .wpp-cu-edge {
            fill: none;
            stroke: #243244;
            stroke-opacity: 0.85;
            stroke-width: 2.6;
            stroke-linejoin: round;
        }
        .wpp-cu {
            stroke: #243244;
            stroke-opacity: 0.2;
            stroke-width: 1;
            stroke-linejoin: round;
        }
        .wpp-cu-base {
            stroke: #243244;
            stroke-opacity: 0.85;
            stroke-width: 1.5;
            stroke-linecap: round;
        }
        // Passage de front : trait et symboles cernés de blanc, pour ressortir sur le ciel comme sur
        // les nuages
        .wpp-front {
            fill: none;
            stroke-width: 2.2;
            stroke-linecap: round;
            stroke-linejoin: round;
            &--halo {
                stroke: #ffffff;
                stroke-width: 4.6;
                stroke-opacity: 0.85;
            }
        }
        .wpp-front-pips {
            stroke: #ffffff;
            stroke-width: 1.2;
            stroke-linejoin: round;
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
        padding: 6px 10px;
        border-radius: 8px;
        background: var(--wpp-popup-bg);
        border: 1px solid var(--wpp-popup-border);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
        font-size: 11.5px;
        line-height: 1.4;
        color: var(--wpp-fg-dim);
        pointer-events: none;

        &__title {
            font-size: 13px;
            font-weight: bold;
            color: var(--wpp-fg);
            margin-bottom: 2px;
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
            // Valeur suivie de précisions : elles passent à la ligne plutôt que de déborder
            &--wrap b {
                white-space: normal;
                text-align: right;
            }
        }
        // Titre d'un groupe de lignes, avec au besoin sa valeur de synthèse à droite
        &__group {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 8px;
            margin-top: 3px;
            padding-top: 2px;
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
            &--storm span,
            &--front span {
                font-size: inherit;
                font-weight: bold;
                letter-spacing: 0;
                text-transform: none;
            }
            &--front span {
                color: var(--wpp-fg);
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
            margin-top: 3px;
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
