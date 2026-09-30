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
                        ><path d={arrow} transform="translate(13,7) rotate(90)" fill={windColor(25, light)} /></svg
                    >
                    <span>{tr("Vent à cette altitude : la flèche va dans le sens du vent, chiffre en km/h", "Wind at this altitude: the arrow points downwind, value in km/h")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-ceiling)" stroke-width="2.4" /><circle
                            cx="13"
                            cy="7"
                            r="2.8"
                            style="fill: var(--wpp-ceiling)"
                            stroke="#0b1118"
                        /></svg
                    >
                    <span>{tr("Plafond exploitable : l'ascendance y compense encore le taux de chute d'une aile en spirale (~1,1 m/s)", "Usable ceiling: climb still beats a glider's circling sink (~1.1 m/s)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><clipPath id="wpp-lg-cu"><rect x="0" y="0" width="26" height="12.5" /></clipPath><g
                            clip-path="url(#wpp-lg-cu)"
                            >{#each cu as p}<circle cx={p.x} cy={p.y} r={p.r} fill="#eef2f7" />{/each}</g
                        ><line x1="4" x2="22" y1="12.5" y2="12.5" stroke="#aebccb" stroke-width="1.2" /></svg
                    >
                    <span>{tr("Cumulus, de la base au sommet estimé", "Cumulus, from base to estimated top")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" stroke="#5fd3ff" stroke-width="1.6" stroke-dasharray="6 4" /></svg
                    >
                    <span>{tr("Isotherme 0 °C", "Freezing level (0 °C)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"><rect x="3" y="2" width="20" height="10" rx="3" fill="#e8eef5" opacity="0.6" /></svg>
                    <span>{tr("Nuages prévus par le modèle", "Clouds forecast by the model")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="3" y="4" width="20" height="8" rx="1" fill="#1d3a5c" /><rect x="3" y="4" width="20" height="3" fill="#eef2f7" /></svg
                    >
                    <span>{tr("Bande blanche en haut : nuages au-dessus du graphique (souvent ceux qui donnent la pluie)", "White strip at the top: clouds above the chart (often the ones bringing rain)")}</span>
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
                    <span>{tr("Surdéveloppement possible : cumulus bourgeonnants — énergie convective (CAPE ≥ 300 J/kg) et cumulus de plus de 2 000 m d’épaisseur, confirmés par les nuages du modèle", "Overdevelopment possible: towering cumulus — convective energy (CAPE ≥ 300 J/kg) and cumulus over 2,000 m deep, confirmed by the model’s clouds")}</span>
                </li>
                <li>
                    <span class="wpp-lg__icons"><StormIcon level={2} size={14} /></span>
                    <span>{tr("Orage probable : cumulonimbus — CAPE ≥ 800 J/kg, air instable et cumulus de plus de 3 000 m, confirmés par le modèle", "Thunderstorm likely: cumulonimbus — CAPE ≥ 800 J/kg, unstable air and cumulus over 3,000 m, confirmed by the model")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="4" y="5" width="8" height="9" rx="1.5" fill="#5aa8ff" /><rect x="14" y="2" width="8" height="12" rx="1.5" fill="#e4dcff" /></svg
                    >
                    <span>{tr("Précipitations de l'heure en bas du graphique : pluie en bleu, neige en violet pâle (mm d'eau)", "Hourly precipitation under the chart: rain in blue, snow in pale violet (mm of water)")}</span>
                </li>
            </ul>
            <p class="wpp-lg__note">
                {@html tr(
                    "Survolez le graphique pour lire les valeurs, cliquez sur une heure pour ouvrir son émagramme.",
                    "Hover over the chart to read values, click an hour to show its sounding.",
                )}
            </p>
            <p class="wpp-lg__note">
                {@html tr(
                    "Plafond, cumulus et ascendance sont <b>estimés</b> à partir du modèle : l'air des 500 premiers mètres, un peu réchauffé selon l'ensoleillement, monte jusqu'à ne plus être plus léger que l'air autour. La force des thermiques dépend du soleil, des nuages et de la pluie des dernières 24 h (sol mouillé). À interpréter avec prudence, rien ne remplace l'observation sur place.",
                    "Ceiling, cumulus and climb rates are <b>estimated</b> from the model: air from the lowest 500 m, slightly warmed according to sunshine, rises until it is no longer lighter than its surroundings. Thermal strength depends on sun, clouds and rain over the last 24 h (wet ground). Use with care, nothing replaces on-site observation.",
                )}
            </p>
        {:else if kind === 'xc'}
            <div class="wpp-lg__title">{tr('Meilleur départ pour un cross', 'Best take-off for cross-country')}</div>
            <div class="wpp-lg__chips">
                {#each KM_LEGEND as km, k}
                    <span style="background:{kmColor(km)};color:{km >= 100 ? '#fff' : '#111'}"
                        >{km}{k === KM_LEGEND.length - 1 ? '+' : ''}</span
                    >
                {/each}
            </div>
            <p class="wpp-lg__note">
                {@html tr(
                    "La couleur donne la distance qu'un bon pilote pourrait faire <b>en décollant de ce point</b>, en ligne droite. Pour chaque point, le plugin simule un vol : décollage dès que les thermiques le permettent, puis progression heure par heure à la vitesse de cross (spirales dans les thermiques et transitions à 35 km/h), poussée ou freinée par le vent de la couche thermique. Le vol s'arrête quand les thermiques s'éteignent (fin de journée, pluie, mer, plafond trop bas, vent trop fort), après une dernière transition. 16 directions sont essayées et la plus longue est retenue.",
                    "The colour gives the distance a good pilot could fly <b>taking off from that point</b>, in a straight line. For each point the plugin simulates a flight: take-off as soon as thermals allow, then progress hour by hour at cross-country speed (circling in thermals and gliding at 35 km/h), pushed or slowed by the wind in the thermal layer. The flight ends when thermals die (end of day, rain, sea, low ceiling, strong wind), after a final glide. 16 directions are tried and the longest is kept.",
                )}
            </p>
            <p class="wpp-lg__note">
                {@html tr(
                    "En <b>aller-retour</b>, le vol part tout droit dans une direction, fait demi-tour au meilleur moment puis revient vers le décollage. Seule compte la partie volée dans les deux sens : le double de l'aller si la boucle est bouclée, moins si le retour s'arrête en route. Un bon aller-retour se fait plutôt en travers du vent ; face au vent fort il est vite impossible.",
                    "In <b>out & return</b> mode, the flight goes straight in one direction, turns at the best moment and flies back towards take-off. Only the part flown both ways counts: twice the outbound leg if the loop is closed, less if the return ends early. A good out & return is usually flown across the wind; into a strong wind it quickly becomes impossible.",
                )}
            </p>
            <p class="wpp-lg__note">
                {@html tr(
                    "Les 3 meilleurs départs sont cherchés <b>dans la zone visible</b> de la carte seulement : ils sont mis à jour quand vous déplacez la carte.",
                    "The 3 best take-offs are searched <b>on the visible map only</b>, and updated when you move the map.",
                )}
            </p>
            <ul class="wpp-lg__list">
                <li>
                    <svg width="26" height="14"
                        ><circle cx="13" cy="7" r="6" fill="#1f2933" stroke="#fff" stroke-width="1.5" /><text
                            x="13"
                            y="10"
                            text-anchor="middle"
                            font-size="8"
                            font-weight="700"
                            fill="#fff">1</text
                        ></svg
                    >
                    <span>{tr("Les 3 meilleurs départs de la zone visible et leur trajectoire (liste cliquable sous le bouton)", "The 3 best take-offs on the visible map and their track (clickable list under the button)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" stroke="#2563eb" stroke-width="2.5" stroke-dasharray="4 3" /></svg
                    >
                    <span>{tr("Vol estimé depuis le site choisi dans le panneau", "Estimated flight from the site chosen in the panel")}</span>
                </li>
            </ul>
            <p class="wpp-lg__note">
                {@html tr(
                    "Seule la carte visible est chargée : un vol qui en sort est arrêté au bord (sa distance réelle pourrait être plus grande), dézoomez pour voir les plus longs vols. Ce sont des <b>estimations</b> à partir du modèle : relief fin, brises, espaces aériens et choix de route ne sont pas pris en compte.",
                    "Only the visible map is loaded: a flight that leaves it is stopped at the edge (its real distance could be longer); zoom out to see longer flights. These are <b>estimates</b> from the model: fine terrain, local breezes, airspace and route choice are not taken into account.",
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
        {/if}
    </div>
{/if}

<script lang="ts">
    import { STABILITY } from './Emagram.svelte';
    import { thermalColor, windColor } from './physics';
    import { arrowPath, cumulusPuffs } from './svg';
    import { KM_LEGEND, kmColor } from './cross';
    import { tr } from './i18n';
    import StormIcon from './StormIcon.svelte';

    export let kind: 'chart' | 'emagram' | 'xc';
    /** Thème clair (couleurs du vent plus soutenues) */
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
            gradient: gradientCss(v => windColor(v, light), 55),
        },
        { label: tr('Ascendance', 'Climb'), unit: 'm/s', max: 4, ticks: [0, 1, 2, 3, 4], gradient: gradientCss(thermalColor, 4) },
    ];

    const arrow = arrowPath(16, 5.5, 4, 1.2);
    const cu = cumulusPuffs(13, 12.5, 20, 12);

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
        &__note {
            margin: 8px 0 0;
            font-size: 11px;
            opacity: 0.8;
        }
    }
</style>
