<!-- Légende repliable : un bouton ⓘ en coin de graphique ouvre un panneau par-dessus -->
<button
    class="wpp-lg-btn"
    class:wpp-lg-btn--open={open}
    title={open ? tr('Fermer la légende', 'Close legend') : tr('Afficher la légende', 'Show legend')}
    aria-label={tr('Légende', 'Legend')}
    on:click={() => (open = !open)}
>
    {#if open}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
            ><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg
        >
    {:else}
        <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true"
            ><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.3" /><path
                d="M8 7.2v4.1"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
            /><circle cx="8" cy="4.8" r="0.95" fill="currentColor" /></svg
        >
    {/if}
</button>

{#if open}
    <div class="wpp-lg">
        {#if kind === 'chart'}
            <div class="wpp-lg__title">{tr('Graphique vent & thermiques', 'Wind & thermals chart')}</div>
            {#each scales as s}
                <div class="wpp-lg__scale">
                    <div class="wpp-lg__label">{s.label} <small>{s.unit}</small></div>
                    <div class="wpp-lg__bar" style="background:{s.gradient}"></div>
                    <div class="wpp-lg__ticks">
                        {#each s.ticks as v, k}
                            <span
                                class:wpp-lg-first={k === 0}
                                class:wpp-lg-last={k === s.ticks.length - 1}
                                style="left:{(v / s.max) * 100}%">{v}</span
                            >
                        {/each}
                    </div>
                </div>
            {/each}
            <ul class="wpp-lg__list">
                <li>
                    <svg width="26" height="14"
                        ><path
                            d={arrow}
                            transform="translate(13,7) rotate(90)"
                            fill={windColor(25)}
                            stroke="#0f1822"
                            stroke-width="0.7"
                            stroke-opacity="0.8"
                        /></svg
                    >
                    <span>{tr("Vent : la flèche va dans le sens du vent, chiffre en km/h", "Wind: the arrow points downwind, value in km/h")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="3" y1="7" x2="23" y2="7" stroke="#0f1822" stroke-opacity="0.45" stroke-width="5.5" stroke-linecap="round" /><line
                            x1="3"
                            y1="7"
                            x2="23"
                            y2="7"
                            stroke="#ffffff"
                            stroke-width="2.4"
                            stroke-linecap="round"
                        /><circle
                            cx="13"
                            cy="7"
                            r="2.8"
                            fill="#ffffff"
                            stroke="#0b1118"
                        /></svg
                    >
                    <span>{tr("Plafond exploitable : au-dessus, le thermique ne porte plus l'aile", "Usable ceiling: above it, the thermal no longer carries the glider")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><clipPath id="wpp-lg-cu"><rect x="0" y="0" width="26" height="12.5" /></clipPath><g
                            clip-path="url(#wpp-lg-cu)"
                            >{#each cu as p}<circle cx={p.x} cy={p.y} r={p.r} fill="#fff" stroke="#243244" stroke-width="1.6" />{/each}{#each cu as p}<circle cx={p.x} cy={p.y} r={p.r} fill="#fff" />{/each}</g
                        ><line x1="4" x2="22" y1="12.5" y2="12.5" stroke="#243244" stroke-width="1.2" /></svg
                    >
                    <span>{tr("Cumulus des thermiques (blanc), de la base au sommet estimé, aux heures de thermiques exploitables", "Thermal cumulus (white), from base to estimated top, at hours with usable thermals")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><clipPath id="wpp-lg-sh"><rect x="0" y="0" width="26" height="9" /></clipPath><g
                            clip-path="url(#wpp-lg-sh)"
                            >{#each showerCu as p}<circle cx={p.x} cy={p.y} r={p.r} fill="#9ea9ba" stroke="#243244" stroke-width="1.6" />{/each}{#each showerCu as p}<circle cx={p.x} cy={p.y} r={p.r} fill="#9ea9ba" />{/each}</g
                        ><line x1="6" x2="20" y1="9" y2="9" stroke="#243244" stroke-width="1.2" /><path
                            d="M10.5 10.5l-1.2 3M14 10.5l-1.2 3M17.5 10.5l-1.2 3"
                            stroke="#2f7cf6"
                            stroke-width="1.3"
                            stroke-linecap="round"
                        /></svg
                    >
                    <span>{tr("Nuage de pluie (gris), de sa base à son sommet, d’autant plus large que la pluie est forte : nuage d’averses que le modèle développe lui-même, même sans thermiques (nuit, ciel couvert), ou couche de nuages du modèle quand la pluie vient d’elle (pluie de front). L’infobulle dit lequel ; la nature de la pluie se juge sur l’heure et les deux de chaque côté", "Rain cloud (grey), from base to top, the wider the heavier the rain: a shower cloud the model develops by itself, even without thermals (night, overcast), or the model’s cloud layer when the rain comes from it (frontal rain). The tooltip says which; the kind of rain is judged over the hour and the two on each side")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" stroke="#5fd3ff" stroke-width="1.6" stroke-dasharray="6 4" /></svg
                    >
                    <span>{tr("Isotherme 0 °C", "Freezing level (0 °C)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"><rect x="3" y="2" width="20" height="10" rx="2" fill="#ced6e1" /></svg>
                    <span>{tr("Nuages en couches prévus par le modèle (voile gris)", "Layer clouds forecast by the model (grey veil)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="3" y="4" width="20" height="8" rx="1" fill="#1d3a5c" /><rect x="3" y="4" width="20" height="3" fill="#ced6e1" /></svg
                    >
                    <span>{tr("Bande claire en haut : nuages au-dessus du graphique", "Light strip at the top: clouds above the chart")}</span>
                </li>
                <li>
                    <svg width="26" height="14"><rect x="3" y="2" width="20" height="10" rx="3" fill="#06090f" opacity="0.6" /></svg>
                    <span>{tr("Nuit", "Night")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="13" y1="0" x2="13" y2="14" stroke="#ff5a5a" stroke-width="1.5" stroke-dasharray="4 3" /></svg
                    >
                    <span>{tr("Heure actuelle", "Current time")}</span>
                </li>
                <li>
                    <span class="wpp-lg__icons"><StormIcon level={1} size={14} /></span>
                    <span>{tr("Surdéveloppement possible : cumulus de plus de 2 000 m d’épaisseur, ou averses convectives prévues par le modèle", "Overdevelopment possible: cumulus over 2,000 m deep, or convective showers forecast by the model")}</span>
                </li>
                <li>
                    <span class="wpp-lg__icons"><StormIcon level={2} size={14} /></span>
                    <span>{tr("Orage probable : cumulonimbus (sommet au-dessus de −20 °C, CAPE ≥ 300 J/kg). L’absence d’icône ne garantit pas l’absence d’orage.", "Thunderstorm likely: cumulonimbus (top above −20 °C, CAPE ≥ 300 J/kg). No icon does not guarantee no storm.")}</span>
                </li>
                <li>
                    <span class="wpp-lg__icons"><StormIcon level={3} size={14} /></span>
                    <span>{tr("Orage violent possible : orage probable dans un air très instable (LI ≤ −6), ou instable avec un vent fort en altitude qui organise l’orage, ou avec des rafales d’au moins 70 km/h au modèle. Un bandeau au-dessus des onglets résume l’orage du jour : heure, déplacement, rafales.", "Severe thunderstorm possible: thunderstorm likely in very unstable air (LI ≤ −6), or unstable air with strong winds aloft that organise the storm, or with model gusts of 70 km/h or more. A banner above the tabs sums up the day’s storm: time, motion, gusts.")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="4" y="5" width="8" height="9" rx="1.5" fill="#5aa8ff" /><rect x="14" y="2" width="8" height="12" rx="1.5" fill="#e4dcff" /></svg
                    >
                    <span>{tr("Précipitations de l’heure qui suit (mm) : pluie en bleu, neige en violet pâle", "Precipitation over the following hour (mm): rain in blue, snow in pale violet")}</span>
                </li>
            </ul>
            <div class="wpp-lg__subtitle">
                {tr('Bandeau « Therm. » : facilité d’exploitation des thermiques', '“Therm.” strip: how easy thermals are to work')}
            </div>
            <svg width="0" height="0" style="position:absolute" aria-hidden="true"
                ><pattern id="wpp-lg-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"
                    ><rect width="1.6" height="4" fill="#111" fill-opacity="0.5" /></pattern
                ></svg
            >
            <ul class="wpp-lg__list">
                {#each easeItems as e}
                    <li>
                        <svg width="26" height="14"
                            ><rect x="3" y="3" width="20" height="9" rx="2" fill={e.color} />{#if e.hatch}<rect
                                    x="3"
                                    y="3"
                                    width="20"
                                    height="9"
                                    rx="2"
                                    fill="url(#wpp-lg-hatch)"
                                />{/if}</svg
                        >
                        <span><b>{e.label}</b> — {e.text}</span>
                    </li>
                {/each}
            </ul>
            <div class="wpp-lg__subtitle">{tr('Bandeau « CAPE LI » : instabilité de chaque heure, CAPE à gauche de la case, LI à droite', '“CAPE LI” strip: instability of each hour, CAPE on the left of the cell, LI on the right')}</div>
            {#each instability as ix}
                <p class="wpp-lg__ix"><b>{ix.name}</b> <small>{ix.unit}</small> — {ix.text}</p>
                <ul class="wpp-lg__levels">
                    {#each ix.levels as lv}<li><i style="background:{lv.color}"></i><b>{lv.range}</b><span>{lv.text}</span></li>{/each}
                </ul>
            {/each}
            <p class="wpp-lg__note">{instabilityNote}</p>
            <p class="wpp-lg__note">
                {@html tr(
                    "Couleurs des thermiques : <b>montée au vario</b> (ascendance moins ~1,1 m/s de taux de chute en spirale).",
                    "Thermal colours: <b>vario climb</b> (updraft minus ~1.1 m/s of circling sink).",
                )}
            </p>
            <p class="wpp-lg__note">
                {@html tr(
                    "Plafond, cumulus et ascendance sont <b>estimés</b> : une inversion fine peut échapper au modèle et le plafond être surestimé.",
                    "Ceiling, cumulus and climb rates are <b>estimated</b>: the model can miss a thin inversion and overestimate the ceiling.",
                )}
            </p>
            <p class="wpp-lg__note">
                {tr(
                    "Survolez pour lire les valeurs, cliquez sur une heure pour ouvrir son émagramme.",
                    "Hover to read values, click an hour to open its sounding.",
                )}
            </p>
        {:else if kind === 'xc'}
            <div class="wpp-lg__title">{tr('Meilleur départ pour un cross', 'Best take-off for cross-country')}</div>
            <div class="wpp-lg__chips">
                <span style="background:{KM_NONE_COLOR};color:#fff">0</span>
                {#each KM_LEGEND as km, k}
                    <span style="background:{kmColor(km)};color:{km >= 100 ? '#fff' : '#111'}"
                        >{km}{k === KM_LEGEND.length - 1 ? '+' : ''}</span
                    >
                {/each}
            </div>
            <p class="wpp-lg__note">
                {tr(
                    "Distance en km. En gris : zone calculée où aucun cross n'est possible ce jour-là (thermiques trop faibles, plafond trop bas, pluie ou vent trop fort).",
                    'Distance in km. Grey: computed area where no cross-country is possible that day (thermals too weak, ceiling too low, rain or too much wind).',
                )}
            </p>
            <p class="wpp-lg__note">
                {@html tr(
                    "La couleur donne la distance qu'un bon pilote pourrait faire <b>en décollant de ce point</b>, en ligne droite. Pour chaque point, le plugin simule un vol : décollage dès que les thermiques le permettent, puis progression heure par heure à la vitesse de cross (spirales dans les thermiques et transitions à 35 km/h), poussée ou freinée par le vent de la couche thermique. Le vol s'arrête quand les thermiques s'éteignent (fin de journée, pluie, mer, plafond trop bas, vent trop fort ou haché), après une dernière transition depuis la hauteur exploitable, dérive du vent comprise. 16 directions sont essayées et la plus longue est retenue.",
                    "The colour gives the distance a good pilot could fly <b>taking off from that point</b>, in a straight line. For each point the plugin simulates a flight: take-off as soon as thermals allow, then progress hour by hour at cross-country speed (circling in thermals and gliding at 35 km/h), pushed or slowed by the wind in the thermal layer. The flight ends when thermals die (end of day, rain, sea, low ceiling, strong or choppy wind), after a final glide from the usable height, drifted by the wind. 16 directions are tried and the longest is kept.",
                )}
            </p>
            <p class="wpp-lg__note">
                {@html tr(
                    "En <b>aller-retour</b>, le vol part tout droit dans une direction, fait demi-tour au meilleur moment puis revient vers le décollage. Seule compte la partie volée dans les deux sens : le double de l'aller si la boucle est bouclée, moins si le retour s'arrête en route. Un bon aller-retour se fait plutôt en travers du vent ; face au vent fort il est vite impossible.",
                    "In <b>out & return</b> mode, the flight goes straight in one direction, turns at the best moment and flies back towards take-off. Only the part flown both ways counts: twice the outbound leg if the loop is closed, less if the return ends early. A good out & return is usually flown across the wind; into a strong wind it quickly becomes impossible.",
                )}
            </p>
            <ul class="wpp-lg__list">
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" stroke="#2563eb" stroke-width="2.5" stroke-dasharray="4 3" /></svg
                    >
                    <span>{tr("Vol estimé depuis le site choisi (touchez la carte pour en changer), avec sa distance au bout de la trajectoire", "Estimated flight from the chosen site (tap the map to change it), with its distance at the end of the track")}</span>
                </li>
            </ul>
            <p class="wpp-lg__note">
                {@html tr(
                    "Seule la carte visible est chargée : un vol qui en sort est arrêté au bord (sa distance réelle pourrait être plus grande), dézoomez pour voir les plus longs vols. Ce sont des <b>estimations</b> à partir du modèle : relief fin, brises, espaces aériens et choix de route ne sont pas pris en compte.",
                    "Only the visible map is loaded: a flight that leaves it is stopped at the edge (its real distance could be longer); zoom out to see longer flights. These are <b>estimates</b> from the model: fine terrain, local breezes, airspace and route choice are not taken into account.",
                )}
            </p>
        {:else if kind === 'bulletin'}
            <div class="wpp-lg__title">{tr('Bulletin de vol', 'Flying bulletin')}</div>
            <p class="wpp-lg__note">
                {tr(
                    'Rédigé à partir de la prévision du modèle choisi, heure par heure, pour les heures de jour du site.',
                    'Written from the chosen model’s forecast, hour by hour, for the daylight hours of the site.',
                )}
            </p>
            <div class="wpp-lg__subtitle">{tr('Conditions de chaque heure', 'Conditions of each hour')}</div>
            <ul class="wpp-lg__list">
                {#each flyLevels as lv, k}
                    <li>
                        <svg width="26" height="14"><rect x="3" y="3" width="20" height="9" rx="2" fill={LEVEL_COLORS[k]} /></svg>
                        <span><b>{LEVEL_LABELS[k]}</b> — {lv}</span>
                    </li>
                {/each}
            </ul>
            <p class="wpp-lg__note">
                {tr(
                    'Une heure prend le niveau de son critère le plus marqué ; passez sur une case du bandeau pour le lire. Un créneau dure au moins 2 heures.',
                    'An hour takes the level of its most marked criterion; hover a cell of the strip to read it. A window lasts at least 2 hours.',
                )}
            </p>
            <div class="wpp-lg__subtitle">{tr('Passages de front', 'Front passages')}</div>
            <p class="wpp-lg__note">
                {tr(
                    'Un front se repère au changement de masse d’air : la température entre 1 500 et 3 000 m au-dessus du sol varie d’au moins 3 °C en 6 h, avec la pluie, le ciel couvert ou la rotation du vent qui l’accompagnent. Le bulletin ne voit que la prévision du point choisi, pas la carte : un front peu actif, ou qui passe à côté, peut lui échapper.',
                    'A front shows as a change of air mass: the temperature between 1,500 and 3,000 m above the ground changes by at least 3 °C in 6 h, with the rain, overcast sky or wind shift that come with it. The bulletin only sees the forecast of the chosen point, not the map: a weak front, or one passing nearby, can be missed.',
                )}
            </p>
            <p class="wpp-lg__note">
                {@html tr(
                    'Ces seuils <b>décrivent des conditions</b>, pas l’aptitude d’un pilote à voler : cette décision lui appartient. Le modèle lisse le relief : le vent au décollage, les brises et le foehn peuvent être très différents de ce qu’il prévoit.',
                    'These thresholds <b>describe conditions</b>, not a pilot’s ability to fly: that decision is the pilot’s. The model smooths out the terrain: wind at take-off, breezes and foehn can differ widely from what it forecasts.',
                )}
            </p>
        {:else}
            <div class="wpp-lg__title">{tr('Émagramme redressé', 'Skewed emagram')}</div>
            <p class="wpp-lg__note">
                {tr(
                    "Altitude en mètres. L'axe des températures est « redressé » : les adiabatiques sèches sont verticales et les isothermes obliques. Une courbe qui penche vers la gauche se refroidit plus vite qu'une adiabatique sèche.",
                    'Altitude in metres. The temperature axis is skewed so that dry adiabats are vertical and isotherms slanted. A curve leaning left cools faster than a dry adiabat.',
                )}
            </p>
            <div class="wpp-lg__subtitle">{tr("Courbe d'état (température de l'air)", 'Temperature curve (air temperature)')}</div>
            <ul class="wpp-lg__list">
                {#each stabilityItems as s}
                    <li>
                        <svg width="26" height="14"
                            ><line x1="2" y1="7" x2="24" y2="7" style="stroke: {s.color}" stroke-width="3" /></svg
                        >
                        <span><b style="color:{s.color}">{s.label}</b> — {s.text}</span>
                    </li>
                {/each}
            </ul>
            <div class="wpp-lg__subtitle">{tr('Autres courbes', 'Other lines')}</div>
            <ul class="wpp-lg__list">
                <li>
                    <svg width="26" height="14"><line x1="2" y1="7" x2="24" y2="7" stroke="#4ea3ff" stroke-width="2.4" /></svg>
                    <span>{tr("Point de rosée : plus il est loin de la courbe d'état, plus l'air est sec ; quand les deux se touchent, il y a condensation (nuage)", "Dew point: the further from the temperature curve, the drier the air; where they touch, there is condensation (cloud)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-parcel)" stroke-width="1.6" stroke-dasharray="6 4" /></svg
                    >
                    <span>{tr("Particule : trajet d'un thermique parti du sol", "Parcel: path of a thermal rising from the ground")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-parcel)" stroke-width="2.6" /></svg
                    >
                    <span
                        >{tr(
                            "Ascension de la particule (option en bas de page) : trait plein du sol jusqu'où le thermique s'arrête, sommet des thermiques ou du cumulus ; zone teintée : elle est plus chaude que l'air",
                            "Parcel ascent (option at the bottom of the page): solid line from the ground to where the thermal stops, thermal top or cumulus top; tinted area: it is warmer than the air",
                        )}</span
                    >
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-dew)" stroke-width="2" stroke-dasharray="7 5" /></svg
                    >
                    <span
                        >{tr(
                            "Point de rosée de la particule : il la rejoint au niveau de condensation (point jaune, creux si le thermique s'arrête avant)",
                            "Dew point of the parcel: it meets the parcel at the condensation level (yellow dot, hollow if the thermal stops below it)",
                        )}</span
                    >
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-parcel)" stroke-width="2.6" /><line
                            x1="2"
                            y1="7"
                            x2="24"
                            y2="7"
                            style="stroke: var(--wpp-dew)"
                            stroke-width="2.6"
                            stroke-dasharray="6 6"
                        /></svg
                    >
                    <span
                        >{tr(
                            "Passage de l'adiabatique sèche à la saturée : la particule est en jaune jusqu'au niveau de condensation, en jaune et bleu au-dessus",
                            "Switch from the dry adiabat to the moist one: the parcel is yellow up to the condensation level, yellow and blue above it",
                        )}</span
                    >
                </li>
                <li>
                    <svg width="26" height="14"><line x1="13" y1="0" x2="13" y2="14" stroke="#4caf50" stroke-opacity="0.8" /></svg>
                    <span>{tr("Adiabatique sèche : refroidissement de l'air sec qui monte (~10 °C/km)", "Dry adiabat: cooling of rising dry air (~10 °C/km)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="10" y1="14" x2="15" y2="0" stroke="#4caf50" stroke-opacity="0.8" stroke-dasharray="4 3" /></svg
                    >
                    <span>{tr("Adiabatique saturée : refroidissement de l'air saturé, dans un nuage", "Moist adiabat: cooling of saturated air, inside a cloud")}</span>
                </li>
                <li>
                    <svg width="26" height="14"><line x1="4" y1="14" x2="22" y2="0" stroke="#c9d1db" stroke-opacity="0.6" /></svg>
                    <span>{tr("Isotherme (0 °C en bleu), valeurs en haut du cadre", "Isotherm (0 °C in blue), values at the top of the frame")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="9" y1="14" x2="17" y2="0" stroke="#f0b13a" stroke-dasharray="1.5 3" /></svg
                    >
                    <span>{tr("Rapport de mélange (g/kg) : quantité de vapeur d'eau", "Mixing ratio (g/kg): amount of water vapour")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-fg)" stroke-width="1.3" stroke-dasharray="6 3" /></svg
                    >
                    <span>{tr("Base et sommet des cumulus, ou plafond thermique", "Cumulus base and top, or thermal ceiling")}</span>
                </li>
                <li>
                    <svg width="26" height="14" class="wpp-lg__cloud"
                        ><rect x="1" y="0" width="24" height="14" rx="2" /><path d={emaCloud.fill} /><path d={emaCloud.edge} /></svg
                    >
                    <span
                        >{tr(
                            "Zone de formation du nuage : le cumulus des thermiques, de sa base (niveau de condensation) à son sommet, où le thermique cesse d'être plus léger que l'air",
                            "Cloud formation zone: the cumulus fed by the thermals, from its base (condensation level) to its top, where the thermal stops being lighter than the air",
                        )}</span
                    >
                </li>
            </ul>
            <div class="wpp-lg__subtitle">{tr('Colonne de droite', 'Right column')}</div>
            <ul class="wpp-lg__list">
                <li>
                    <svg width="26" height="14"
                        ><path d={arrow} transform="translate(13,7) rotate(90)" fill={windColor(35, light)} /></svg
                    >
                    <span>{tr("Vent en km/h : taille et couleur selon la force", "Wind in km/h: size and colour by strength")}</span>
                </li>
                <li>
                    <svg width="26" height="14"><rect x="3" y="1" width="20" height="12" rx="2" fill="#ffe14a" opacity="0.4" /></svg>
                    <span>{tr("Couche convective (zone des thermiques)", "Convective layer (thermal zone)")}</span>
                </li>
            </ul>
            <div class="wpp-lg__subtitle">{tr("CAPE et LI (au-dessus de l'émagramme)", 'CAPE and LI (above the sounding)')}</div>
            {#each instability as ix}
                <p class="wpp-lg__ix"><b>{ix.name}</b> <small>{ix.unit}</small> — {ix.text}</p>
                <ul class="wpp-lg__levels">
                    {#each ix.levels as lv}<li><i style="background:{lv.color}"></i><b>{lv.range}</b><span>{lv.text}</span></li>{/each}
                </ul>
            {/each}
            <p class="wpp-lg__note">{instabilityNote}</p>
            <p class="wpp-lg__note">
                {tr(
                    "« max » : CAPE de l'air le plus instable, quand il se trouve plus haut que les 1 000 premiers mètres. C'est lui qui nourrit un orage venu d'ailleurs, même si l'air près du sol est stable (soir, nuit).",
                    '“max”: CAPE of the most unstable air, when it lies above the lowest 1,000 m. It is what feeds a storm arriving from elsewhere, even when the air near the ground is stable (evening, night).',
                )}
            </p>
            <p class="wpp-lg__note">
                {tr(
                    "Sous ces valeurs : le risque d'orage de l'heure affichée, et l'orage attendu dans les 3 heures qui suivent.",
                    'Below these values: the storm risk of the hour shown, and any storm expected within the next 3 hours.',
                )}
            </p>
        {/if}
    </div>
{/if}

<script lang="ts">
    import { LEVEL_COLORS, LEVEL_LABELS } from './Bulletin.svelte';
    import { CLIMB_LIMITS, GUST_LIMITS, LOW_WIND_LIMITS, WIND_LIMITS } from './bulletin';
    import { EASE } from './Chart.svelte';
    import { STABILITY } from './Emagram.svelte';
    import { INSTABILITY_COLORS, thermalColor, windColor } from './physics';
    import { arrowPath, cloudBand, cumulusPuffs } from './svg';
    import { KM_LEGEND, KM_NONE_COLOR, kmColor } from './cross';
    import { tr } from './i18n';
    import StormIcon from './StormIcon.svelte';

    export let kind: 'chart' | 'emagram' | 'xc' | 'bulletin';
    /** Thème clair : couleurs du vent plus soutenues à côté de l'émagramme (le graphique ne change pas) */
    export let light = false;

    let open = false;

    const range = (from: number, to: number, step: number) => {
        const out: number[] = [];
        for (let v = from; v <= to + 1e-6; v += step) out.push(v);
        return out;
    };

    const gradientCss = (color: (v: number) => string, max: number) =>
        `linear-gradient(to right, ${range(0, max, max / 20)
            .map(v => `${color(v)} ${((v / max) * 100).toFixed(1)}%`)
            .join(', ')})`;

    $: scales = [
        {
            label: tr('Vent', 'Wind'),
            unit: 'km/h',
            max: 55,
            ticks: [0, 10, 20, 30, 40, 55],
            gradient: gradientCss(v => windColor(v), 55),
        },
        {
            label: tr('Montée au vario', 'Vario climb'),
            unit: 'm/s',
            max: 3.5,
            ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3.5],
            gradient: gradientCss(thermalColor, 3.5),
        },
    ];

    const arrow = arrowPath(16, 5.5, 4, 1.2);
    const cu = cumulusPuffs(13, 12.5, 20, 12);
    const showerCu = cumulusPuffs(13, 9, 15, 8.5);
    const emaCloud = cloudBand(1, 25, 12, 3);

    // Bandeau des thermiques, du plus facile au plus difficile à exploiter
    const easeItems = [
        {
            ...EASE.easy,
            text: tr(
                'au moins +0,5 m/s au vario et 300 m de hauteur exploitable, sans vent fort',
                'at least +0.5 m/s on the vario and 300 m of usable height, without strong wind',
            ),
        },
        {
            ...EASE.weak,
            label: tr('faibles ou plafond bas', 'weak or low ceiling'),
            text: tr(
                'moins de +0,5 m/s au vario, ou moins de 300 m au-dessus du sol : difficiles à tenir',
                'under +0.5 m/s on the vario, or less than 300 m above the ground: hard to stay in',
            ),
        },
        {
            ...EASE.choppy,
            text: tr(
                'plus de 25 km/h de vent dans la couche thermique, ou vent au sol fort pour des thermiques faibles : difficiles à centrer',
                'over 25 km/h of wind in the thermal layer, or strong surface wind for weak thermals: hard to centre',
            ),
        },
        {
            ...EASE.rough,
            text: tr(
                'plus de 40 km/h dans la couche, ou vent au sol très fort pour la force des thermiques : inexploitables',
                'over 40 km/h in the layer, or very strong surface wind for the thermal strength: unusable',
            ),
        },
    ];

    const stabilityItems = [
        { ...STABILITY.absolute, text: tr(
                "l'air se refroidit plus vite que l'adiabatique sèche : les thermiques accélèrent",
                'air cools faster than the dry adiabat: thermals accelerate',
            ),
        },
        {
            ...STABILITY.conditional,
            text: tr(
                "entre l'adiabatique saturée et la sèche : les thermiques peuvent accélérer dans certaines conditions",
                'between the moist and dry adiabats: thermals can accelerate under some conditions',
            ),
        },
        { ...STABILITY.stable, color: 'var(--wpp-stable)', text: tr("l'air se refroidit lentement : les thermiques sont freinés", 'air cools slowly: thermals are damped'),
        },
    ];

    // Conditions du bulletin : critères des conditions calmes, modérées et fortes (limites de
    // bulletin.ts), puis des conditions défavorables
    const climb = (v: number) => tr(String(v).replace('.', ','), String(v));
    const flyLevels = [
        tr(
            `vent de moins de ${WIND_LIMITS[0]} km/h au sol et ${LOW_WIND_LIMITS[0]} km/h dans les 1 000 premiers mètres, rafales de moins de ${GUST_LIMITS[0]} km/h, thermiques de moins de +${climb(CLIMB_LIMITS[0])} m/s au vario et non hachés, ni pluie ni surdéveloppement, pas d’orage probable à moins de 4 h`,
            `wind under ${WIND_LIMITS[0]} km/h at the surface and ${LOW_WIND_LIMITS[0]} km/h in the lowest 1,000 m, gusts under ${GUST_LIMITS[0]} km/h, thermals under +${climb(CLIMB_LIMITS[0])} m/s on the vario and not choppy, no rain or overdevelopment, no thunderstorm likely within 4 h`,
        ),
        tr(
            `vent de moins de ${WIND_LIMITS[1]} km/h au sol et ${LOW_WIND_LIMITS[1]} km/h dans les 1 000 premiers mètres, rafales de moins de ${GUST_LIMITS[1]} km/h, thermiques de moins de +${climb(CLIMB_LIMITS[1])} m/s, hachés ou non`,
            `wind under ${WIND_LIMITS[1]} km/h at the surface and ${LOW_WIND_LIMITS[1]} km/h in the lowest 1,000 m, gusts under ${GUST_LIMITS[1]} km/h, thermals under +${climb(CLIMB_LIMITS[1])} m/s, choppy or not`,
        ),
        tr(
            `vent de moins de ${WIND_LIMITS[2]} km/h au sol et ${LOW_WIND_LIMITS[2]} km/h dans les 1 000 premiers mètres, rafales de moins de ${GUST_LIMITS[2]} km/h, thermiques plus forts ou très hachés, surdéveloppement possible`,
            `wind under ${WIND_LIMITS[2]} km/h at the surface and ${LOW_WIND_LIMITS[2]} km/h in the lowest 1,000 m, gusts under ${GUST_LIMITS[2]} km/h, stronger or very choppy thermals, overdevelopment possible`,
        ),
        tr(
            'vent ou rafales plus forts, pluie ou neige, orage probable à moins de 2 h',
            'stronger wind or gusts, rain or snow, thunderstorm likely within 2 h',
        ),
    ];

    // Seuils usuels de la CAPE et de l'indice de soulèvement, du plus calme au plus orageux
    const levels = (items: [string, string][]) => items.map(([range, text], k) => ({ range, text, color: INSTABILITY_COLORS[k] }));

    const instability = [
        {
            name: 'CAPE',
            unit: 'J/kg',
            text: tr(
                "énergie d'une bulle d'air qui monte : le « carburant » des orages.",
                'energy of a rising air bubble: the “fuel” of thunderstorms.',
            ),
            levels: levels([
                ['< 300', tr('faible : convection peu profonde', 'weak: shallow convection')],
                [tr('300 – 1 000', '300 – 1,000'), tr('modérée : cumulus bourgeonnants, averses possibles', 'moderate: towering cumulus, showers possible')],
                [tr('1 000 – 2 500', '1,000 – 2,500'), tr('forte : orages si la convection se déclenche', 'strong: thunderstorms if convection triggers')],
                [tr('> 2 500', '> 2,500'), tr('très forte : orages violents possibles', 'very strong: severe storms possible')],
            ]),
        },
        {
            name: 'LI',
            unit: '°C',
            text: tr(
                "indice de soulèvement : négatif, la bulle est encore plus chaude que l'air vers 5 500 m et continue de monter.",
                'lifted index: when negative, the bubble is still warmer than the air around 5,500 m and keeps rising.',
            ),
            levels: levels([
                ['> 0', tr('stable : convection peu profonde', 'stable: shallow convection')],
                [tr('0 à −3', '0 to −3'), tr('faiblement instable : averses possibles', 'slightly unstable: showers possible')],
                [tr('−3 à −6', '−3 to −6'), tr('instable : orages possibles', 'unstable: thunderstorms possible')],
                [tr('< −6', '< −6'), tr('très instable : orages violents possibles', 'very unstable: severe storms possible')],
            ]),
        },
    ];

    const instabilityNote = tr(
        "Valeurs standard (air des 1 000 premiers mètres, sans chauffage du sol), à la couleur de leur palier. Un potentiel seulement : il faut un déclencheur, et une couche stable peut tout bloquer.",
        'Standard values (air of the lowest 1,000 m, no ground heating), in the colour of their level. A potential only: it takes a trigger, and a stable layer can block everything.',
    );
</script>

<style lang="less">
    // Bouton ⓘ carré, à la hauteur des onglets
    .wpp-lg-btn {
        flex: none;
        display: grid;
        place-items: center;
        width: 38px;
        min-height: 34px;
        padding: 0;
        border: 1px solid var(--wpp-border);
        border-radius: 10px;
        background: var(--wpp-surface);
        color: var(--wpp-fg-dim);
        cursor: pointer;
        transition:
            background 0.15s,
            color 0.15s;

        &:hover {
            background: var(--wpp-surface-hover);
            color: var(--wpp-fg);
        }
        &--open,
        &--open:hover {
            background: #ffd24a;
            border-color: #ffd24a;
            color: #111;
        }
    }

    .wpp-lg {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 8;
        width: min(360px, 100%);
        max-height: 580px;
        overflow-y: auto;
        padding: 12px 14px;
        border-radius: 10px;
        background: var(--wpp-popup-bg);
        border: 1px solid var(--wpp-popup-border);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
        font-size: 11.5px;
        line-height: 1.45;
        color: var(--wpp-fg-dim);

        &__title {
            font-size: 13px;
            font-weight: bold;
            color: var(--wpp-fg);
            margin-bottom: 8px;
        }
        &__subtitle {
            margin: 10px 0 4px;
            font-weight: bold;
            color: var(--wpp-fg);
        }
        &__scale {
            margin-bottom: 8px;
        }
        &__label {
            margin-bottom: 3px;
            color: var(--wpp-fg);
            font-weight: bold;
            small {
                font-weight: normal;
                color: var(--wpp-fg-faint);
            }
        }
        &__bar {
            height: 8px;
            border-radius: 4px;
        }
        &__ticks {
            position: relative;
            height: 14px;
            margin-top: 2px;
            span {
                position: absolute;
                top: 0;
                transform: translateX(-50%);
                font-size: 10px;
                color: var(--wpp-fg-faint);
                &.wpp-lg-first {
                    transform: none;
                }
                &.wpp-lg-last {
                    transform: translateX(-100%);
                }
            }
        }
        &__chips {
            display: flex;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 6px;
            span {
                flex: 1;
                padding: 2px 0;
                text-align: center;
                font-size: 10.5px;
                font-weight: bold;
                color: #111;
            }
        }
        &__icons {
            flex: none;
            display: inline-flex;
            justify-content: center;
            width: 26px;
        }
        &__list {
            list-style: none;
            margin: 0;
            padding: 0;
            li {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin: 5px 0;
            }
            svg {
                flex: none;
                margin-top: 1px;
            }
        }
        // Nuage de l'émagramme, sur un morceau de son fond
        &__cloud {
            rect {
                fill: var(--wpp-sky-top);
            }
            path {
                fill: var(--wpp-cloud);
            }
            path + path {
                fill: none;
                stroke: var(--wpp-line);
                stroke-opacity: 0.4;
            }
        }
        &__ix {
            margin: 6px 0 3px;
            b {
                color: var(--wpp-fg);
            }
            small {
                color: var(--wpp-fg-faint);
            }
        }
        // Seuils : pastille, plage de valeurs, signification
        &__levels {
            display: grid;
            grid-template-columns: auto auto 1fr;
            gap: 2px 6px;
            align-items: start;
            list-style: none;
            margin: 0 0 4px;
            padding: 0;
            li {
                display: contents;
            }
            i {
                width: 8px;
                height: 8px;
                margin-top: 4px;
                border-radius: 50%;
            }
            b {
                color: var(--wpp-fg);
                font-weight: 600;
                white-space: nowrap;
            }
        }
        &__note {
            margin: 8px 0 0;
            font-size: 11px;
            opacity: 0.8;
        }
    }
</style>
