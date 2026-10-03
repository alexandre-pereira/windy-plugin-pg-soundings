<div class="plugin__mobile-header wpp-title">
    {title}
</div>
<section class="plugin__content wpp" class:wpp--light={lightTheme}>
    <div
        class="plugin__title plugin__title--chevron-back wpp-title"
        on:click={() => bcast.emit('rqstOpen', 'menu')}
    >
        {title}
    </div>

    <!-- Nouvelle version publiée : un plugin installé par lien ne se met pas à jour tout seul -->
    {#if newVersion && newVersion !== dismissedVersion}
        <div class="wpp__update">
            <div class="wpp__update-text">
                <b>🆕 {tr('Nouvelle version', 'New version')} {newVersion}</b>
                {tr(
                    'Pour l’installer : windy.com/plugins → « Load plugin directly from URL » → colle le lien.',
                    'To install it: windy.com/plugins → “Load plugin directly from URL” → paste the link.',
                )}
            </div>
            <div class="wpp__update-actions">
                <button class="wpp__update-copy" on:click={copyUpdateLink}
                    >{copied ? tr('Lien copié ✓', 'Link copied ✓') : tr('Copier le lien', 'Copy link')}</button
                >
                <button
                    class="wpp__update-close"
                    title={tr('Masquer', 'Dismiss')}
                    on:click={() => newVersion && dismissUpdate(newVersion)}>✕</button
                >
            </div>
        </div>
    {/if}

    {#if !loc}
        <p class="wpp__hint">{tr('Cliquez sur la carte pour choisir un site de vol.', 'Click on the map to choose a flying site.')}</p>
    {:else}
        <!-- Lieu choisi et modèle, sur une même ligne -->
        <div class="wpp__head">
            <ModelPicker models={MODELS} bind:value={model} />
            <div class="wpp__name" title={`${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`}>
                {placeName || `${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)}`}
            </div>
        </div>

        {#if days.length}
            <div class="wpp__days">
                {#each days as d, i}
                    <button
                        class="wpp__day"
                        class:selected={i === dayIndex}
                        disabled={d.outOfRange || !visibleColumns(d, fullDay).length}
                        on:click={() => chooseDay(d.key)}
                    >
                        <b
                            >{d.label}{#if d.storm}<span class="wpp__daystorm"
                                    ><StormIcon level={d.storm || 1} size={12} /></span
                                >{/if}{#each frontKinds.get(d.key) ?? [] as kind}<span class="wpp__dayfront"
                                    ><FrontIcon {kind} size={18} /></span
                                >{/each}</b
                        >
                        {#if d.outOfRange}
                            <small
                                title={tr(
                                    `Le modèle ${modelLabel} ne fournit pas de données en altitude pour ce jour`,
                                    `${modelLabel} has no upper-air data for this day`,
                                )}>{tr('Hors échéance', 'Out of range')}</small
                            >
                        {:else}
                            <div class="wpp__day-stats">
                                {#if d.bestCeiling != null}
                                    <small title={tr('Plafond thermique le plus haut de la journée', 'Highest thermal ceiling of the day')}
                                        >{tr('Plafond', 'Ceiling')} {d.bestCeiling} m</small
                                    >
                                {:else}
                                    <small>{tr('Pas de thermique', 'No thermals')}</small>
                                {/if}
                                {#if d.bestClimb >= 0.2}
                                    <small
                                        class="wpp__w"
                                        style="background:{thermalColor(d.bestClimb)};color:{thermalTextColor(d.bestClimb)}"
                                        title={tr(
                                            'Meilleure montée au vario estimée dans la journée (taux de chute en spirale déduit)',
                                            'Best estimated vario climb of the day (circling sink deducted)',
                                        )}
                                        >+{d.bestClimb.toFixed(1)} m/s</small
                                    >
                                {/if}
                            </div>
                        {/if}
                    </button>
                {/each}
            </div>
        {/if}

        <!-- Alerte d'orage du jour affiché, visible sur tous les onglets -->
        {#if stormWatch}
            <StormBanner watch={stormWatch} />
        {/if}

        <!-- Onglets des deux fonctions, légende de l'onglet affiché à droite -->
        <div class="wpp__tabbar">
            <div class="wpp__tabs" role="tablist">
                {#each TABS as t}
                    <button
                        role="tab"
                        class="wpp__tab"
                        class:selected={tab === t.id}
                        aria-selected={tab === t.id}
                        on:click={() => (tab = t.id)}
                    >
                        <svg class="wpp__tab-icon" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"
                            ><path d={t.icon} /></svg
                        >
                        <span class="wpp__tab-long">{t.label}</span>
                        <span class="wpp__tab-short">{t.short}</span>
                    </button>
                {/each}
            </div>
            {#key tab}<Legend kind={tab} light={lightTheme} />{/key}
        </div>

        <div class="wpp__block" bind:clientWidth={chartWidth}>
        <div class="wpp__chart">
            {#if loading}
                <div class="wpp__status"><span class="wpp__spinner"></span>{tr('Chargement des prévisions…', 'Loading forecast…')}</div>
            {:else if error}
                <div class="wpp__status wpp__status--error">
                    {error}
                    {#if suggestModel}
                        <button class="wpp__switch" on:click={() => suggestModel && (model = suggestModel)}>
                            {tr('Passer à', 'Switch to')} {MODELS.find(m => m.id === suggestModel)?.name}
                        </button>
                    {/if}
                </div>
            {:else if tab === 'chart' && dayColumns.length}
                <Chart
                    light={lightTheme}
                    columns={dayColumns}
                    {fronts}
                    {crest}
                    width={chartWidth}
                    {yMin}
                    {yMax}
                    {nowTs}
                    selectedTs={selected?.ts ?? null}
                    sunrise={days[dayIndex]?.sunrise ?? null}
                    sunset={days[dayIndex]?.sunset ?? null}
                    utcOffset={dayColumns[Math.floor(dayColumns.length / 2)].utcOffset}
                    on:select={e => chooseTime(e.detail)}
                    on:open={e => {
                        chooseTime(e.detail);
                        tab = 'emagram';
                    }}
                />
            {:else if tab === 'emagram' && selected}
            <!-- Curseur de l'heure, à 5 min près ; flèches : heure pleine précédente / suivante -->
            {@const t0 = dayColumns[0].ts}
            {@const t1 = dayColumns[dayColumns.length - 1].ts}
            <div class="wpp__timebar">
                <div class="wpp__timehead">
                    <button
                        class="wpp__step"
                        title={tr('Heure précédente', 'Previous hour')}
                        disabled={selected.ts <= t0}
                        on:click={() => stepHour(-1)}>‹</button
                    >
                    <span class="wpp__time">{localClock(selected.ts)}</span>
                    <button
                        class="wpp__step"
                        title={tr('Heure suivante', 'Next hour')}
                        disabled={selected.ts >= t1}
                        on:click={() => stepHour(1)}>›</button
                    >
                    <button
                        class="wpp__step wpp__play"
                        class:on={playing}
                        title={playing ? tr('Pause', 'Pause') : tr('Faire défiler la journée', 'Play the day')}
                        on:click={togglePlay}>{playing ? '❚❚' : '▶'}</button
                    >
                </div>
                <!-- Piste colorée selon la force des thermiques (nuit assombrie) : les bonnes heures
                     se voient d'un coup d'œil. Graduations cliquables. -->
                <div class="wpp__slider">
                    <input
                        class="wpp__range"
                        type="range"
                        min={t0}
                        max={t1}
                        step={SLIDER_STEP}
                        value={selected.ts}
                        style="--wpp-track:{trackGradient}"
                        aria-label={tr('Heure de l’émagramme', 'Sounding time')}
                        aria-valuetext={localClock(selected.ts)}
                        on:input={e => {
                            stopPlay();
                            chooseTime(Number(e.currentTarget.value));
                        }}
                    />
                    <div class="wpp__ticks">
                        {#each dayColumns as c}
                            <span
                                class="wpp__tick"
                                class:major={c.hour % 3 === 0}
                                style="left:calc(10px + (100% - 20px) * {(c.ts - t0) / Math.max(1, t1 - t0)})"
                            ></span>
                        {/each}
                        {#if nowTs >= t0 && nowTs <= t1}
                            <span
                                class="wpp__nowtick"
                                title={tr('Maintenant', 'Now')}
                                style="left:calc(10px + (100% - 20px) * {(nowTs - t0) / Math.max(1, t1 - t0)})"
                            ></span>
                        {/if}
                    </div>
                    <div class="wpp__ticklabels">
                        {#each dayColumns.filter(c => c.hour % 3 === 0) as c}
                            <button
                                style="left:calc(10px + (100% - 20px) * {(c.ts - t0) / Math.max(1, t1 - t0)})"
                                on:click={() => {
                                    stopPlay();
                                    chooseTime(c.ts);
                                }}>{hourShort(c.hour)}</button
                            >
                        {/each}
                    </div>
                </div>
            </div>
            <Emagram
                column={selected}
                width={chartWidth}
                {yMin}
                {yMax}
                light={lightTheme}
                xRange={emaRange}
                {showAscent}
                {dawn}
                {deck}
            />
            <!-- Grille fixe : les valeurs changent sur place, rien ne bouge en faisant défiler l'heure -->
            <div class="wpp__summary">
                <!-- Par paires : sur téléphone, deux valeurs par ligne -->
                <div class="wpp__pair">
                    <span
                        title={tr(
                            'Altitude où l’ascendance compense encore le taux de chute d’une aile en spirale',
                            'Height where the climb still beats a glider’s circling sink rate',
                        )}
                        >{tr('Plafond', 'Ceiling')} <b>{selected.ceiling != null ? `${r50(selected.ceiling)} m` : '—'}</b></span
                    >
                    <span title={tr('Fin de la flottabilité de la bulle d’air', 'Where the rising air stops being buoyant')}
                        >{tr('Sommet thermique', 'Thermal top')}
                        <b>{selected.thermalTop != null ? `${r50(selected.thermalTop)} m` : '—'}</b></span
                    >
                </div>
                <div class="wpp__pair">
                    <span
                        title={tr(
                            'Montée nette lue au vario au cœur des thermiques (taux de chute en spirale déduit) ; entre parenthèses, vitesse de l’air qui monte (w*)',
                            'Net climb read on the vario in thermal cores (circling sink deducted); in brackets, speed of the rising air (w*)',
                        )}
                        >{tr('Vario', 'Vario')}
                        <b>{selected.climb >= 0.1 ? `+${selected.climb.toFixed(1)} m/s` : '—'}</b
                        >{#if selected.wStar >= 0.2}<small>({tr('air', 'air')} {selected.wStar.toFixed(1)})</small
                            >{/if}{#if selected.choppy > 0}<small
                                class="wpp__choppy"
                                title={tr(
                                    'Thermiques hachés par le vent : plus de ~25 km/h en moyenne dans la couche des thermiques, plus de ~20 km/h d’écart entre le vent au sol et le vent au plafond, ou vent au sol fort pour des thermiques faibles',
                                    'Thermals broken up by the wind: more than ~25 km/h on average in the thermal layer, more than ~20 km/h of difference between the surface wind and the wind at the ceiling, or strong surface wind for weak thermals',
                                )}>{selected.choppy === 2 ? tr('très haché', 'very choppy') : tr('haché', 'choppy')}</small
                            >{/if}</span
                    >
                    <span>0 °C <b>{selected.freezing != null ? `${r50(selected.freezing)} m` : '—'}</b></span>
                </div>
                <div class="wpp__pair">
                    <span
                        >Cumulus <b
                            >{selected.cuBase != null
                                ? `${r50(selected.cuBase)}–${r50(selected.cuTop ?? selected.cuBase)}${selected.cuTopCapped ? '+' : ''} m`
                                : '—'}</b
                        ></span
                    >
                    <span
                        >{tr('T° / rosée sol', 'Ground T° / dew')}
                        <b
                            >{(selected.t2m - 273.15).toFixed(0)}°{selected.td2m != null
                                ? ` / ${(selected.td2m - 273.15).toFixed(0)}°`
                                : ''}</b
                        ></span
                    >
                </div>
                <!-- Instabilité, sur toute la largeur : CAPE et LI standard avec la pastille de leur palier
                     (voir la légende ; « max » : particule la plus instable, quand de l'air d'altitude a
                     nettement plus d'énergie), puis risque d'orage de l'heure et orage attendu dans les 3 h
                     qui suivent -->
                <div class="wpp__instab">
                    <span title={instabilityTitle(selected)}
                        >CAPE <i class="wpp__dot" style="background:{capeColor(selected.cape)}"></i><b
                            >{selected.cape} J/kg</b
                        >{#if selected.muCape >= selected.cape + 100}<small>(max {selected.muCape})</small>{/if}</span
                    >
                    <span title={instabilityTitle(selected)}
                        >LI {#if selected.liftedIndex != null}<i
                                class="wpp__dot"
                                style="background:{liftedIndexColor(selected.liftedIndex)}"
                            ></i><b>{selected.liftedIndex > 0 ? '+' : ''}{selected.liftedIndex}</b>{:else}<b>—</b>{/if}</span
                    >
                    <span class="wpp__storm wpp__storm--{selected.stormRisk}"
                        >{#if selected.stormRisk > 0}<StormIcon level={selected.stormRisk || 1} size={14} />
                        {/if}{#if selected.stormRisk > 0 || !stormAhead}{STORM_LABELS[selected.stormRisk]}{/if}{#if stormAhead}<span
                                class="wpp__storm-ahead"
                                style="color:{STORM_COLORS[stormAhead.level]}"
                                ><StormIcon level={stormAhead.level} size={14} />
                                {stormAhead.level === 3
                                    ? tr(`Orage violent possible dès ${stormAhead.at}`, `Severe thunderstorm possible from ${stormAhead.at}`)
                                    : tr(`Orage probable dès ${stormAhead.at}`, `Thunderstorm likely from ${stormAhead.at}`)}</span
                            >{/if}</span
                    >
                </div>
            </div>
            {:else if payload}
                <div class="wpp__status">
                    {tr('Pas de données en altitude pour ce jour avec ce modèle.', 'No upper-air data for this day with this model.')}
                </div>
            {/if}
        </div>
        </div>

        <!-- Réglages d'affichage secondaires, en bas de page -->
        <div class="wpp__footer">
            <label>
                {tr('Altitude max', 'Max altitude')}
                <select bind:value={altChoice}>
                    <option value="auto">Auto</option>
                    {#each [2500, 3000, 3500, 4000, 5000, 6000, 7000, 8000] as a}
                        <option value={a}>{a} m</option>
                    {/each}
                </select>
            </label>
            <label class="wpp__check">
                <input type="checkbox" bind:checked={fullDay} />
                {tr('Afficher 24 h', 'Show 24 h')}
            </label>
            {#if tab === 'emagram'}
                <label
                    class="wpp__check"
                    title={tr(
                        'Trajet du thermique du sol à son sommet, son point de rosée (tirets bleus), le niveau de condensation où il passe de l’adiabatique sèche (jaune) à la saturée (jaune et bleu), et les zones où il est plus chaud que l’air',
                        'Path of the thermal from the ground to its top, its dew point (blue dashes), the condensation level where it switches from the dry adiabat (yellow) to the moist one (yellow and blue), and where it is warmer than the air',
                    )}
                >
                    <input type="checkbox" bind:checked={showAscent} />
                    {tr('Ascension de la particule', 'Parcel ascent')}
                </label>
                <label
                    class="wpp__check"
                    title={tr(
                        'Courbe d’état de l’heure du lever du soleil, en trait pâle : l’écart avec la courbe de l’heure affichée montre ce que la journée a changé',
                        'Temperature curve of the sunrise hour, as a pale line: the gap with the curve of the hour shown tells what the day has changed',
                    )}
                >
                    <input type="checkbox" bind:checked={showDawn} />
                    {tr('Courbe du lever du jour', 'Sunrise curve')}
                </label>
            {/if}
            <label class="wpp__check">
                <input type="checkbox" bind:checked={lightTheme} />
                {tr('Thème clair', 'Light theme')}
            </label>
        </div>

        <!-- Informations sur les données, en bas de page -->
        {#if payload}
            <dl class="wpp__info">
                <div>
                    <dt>{tr('Altitude du site', 'Site elevation')}</dt>
                    <dd>{Math.round(payload.header.elevation)} m</dd>
                </div>
                <div>
                    <dt>{tr('Altitude du sol dans le modèle', 'Model ground elevation')}</dt>
                    <dd>{groundModel} m</dd>
                </div>
                {#if crest != null}
                    <div>
                        <dt>{tr('Crêtes voisines (à 10 km)', 'Nearby ridges (within 10 km)')}</dt>
                        <dd>~{Math.round(crest / 50) * 50} m</dd>
                    </div>
                {/if}
                {#if payload.header.refTime}
                    <div>
                        <dt>{tr(`Prévision ${modelLabel} calculée le`, `${modelLabel} run`)}</dt>
                        <dd>{formatRun(payload.header.refTime)}</dd>
                    </div>
                {/if}
            </dl>
        {/if}
    {/if}
</section>

<script lang="ts">
    import bcast from '@windy/broadcast';
    import { loadForecast, loadSurroundings } from './forecast';
    import { crestOf, loadRelief } from './relief';
    import { map, markers } from '@windy/map';
    import { singleclick } from '@windy/singleclick';
    import { setUrl } from '@windy/location';
    import { getGPSlocation } from '@windy/geolocation';
    import * as reverse from '@windy/reverseName';
    import store from '@windy/store';
    import products from '@windy/products';

    import { onDestroy, onMount, tick } from 'svelte';

    import config from './pluginConfig';
    import { clockText, hourShort, hourText, lang, locale, tr } from './i18n';
    import Chart from './Chart.svelte';
    import Emagram, { emagramRange } from './Emagram.svelte';
    import Legend from './Legend.svelte';
    import ModelPicker from './ModelPicker.svelte';
    import FrontIcon from './FrontIcon.svelte';
    import StormBanner from './StormBanner.svelte';
    import StormIcon, { STORM_LABELS } from './StormIcon.svelte';
    import { checkForUpdate, installUrl } from './update';
    import { type AirMass, airMassOf, frontDays, frontsOf, mapFronts } from './fronts';
    import { payloadAt } from './interpolate';
    import {
        buildColumns,
        capeColor,
        cloudDecksOf,
        liftedIndexColor,
        STORM_COLORS,
        stormWatchOf,
        sunElevation,
        thermalColor,
        thermalTextColor,
        type Column,
        type ForecastPayload,
        type StormRisk,
    } from './physics';
    import { dayKey, makeOffsetAt } from './time';

    import type { LatLon } from '@windy/interfaces';

    const { title, name } = config;

    /**
     * Durée de prévision habituelle d'un modèle (heures), telle que Windy la déclare pour ce modèle ;
     * valeur usuelle du modèle si Windy ne la fournit pas
     */
    const forecastHours = (id: string, usual: number) => {
        try {
            const h = (products as unknown as Record<string, { forecastSize?: number } | undefined>)[id]?.forecastSize;
            return typeof h === 'number' && h > 0 ? h : usual;
        } catch {
            return usual;
        }
    };
    const lengthLabel = (h: number) => {
        // Au demi-jour près : 180 h → 7,5 j
        const half = Math.round(h / 12) / 2;
        const d = tr(String(half).replace('.', ','), String(half));
        return h >= 72 ? tr(`${d} j de prévision`, `${d}-day forecast`) : tr(`${h} h de prévision`, `${h}-hour forecast`);
    };
    const modelEntry = (id: string, name: string, res: string, area: string, usualHours: number) => ({
        id,
        name,
        res,
        area,
        len: lengthLabel(forecastHours(id, usualHours)),
    });

    const MODELS = [
        modelEntry('ecmwf', 'ECMWF', '9 km', tr('Monde', 'World'), 240),
        modelEntry('icon', 'ICON', '13 km', tr('Monde', 'World'), 180),
        modelEntry('gfs', 'GFS', '22 km', tr('Monde', 'World'), 384),
        modelEntry('iconEu', 'ICON-EU', '7 km', 'Europe', 120),
        modelEntry('iconD2', 'ICON-D2', '2 km', tr('Alpes, Allemagne', 'Alps, Germany'), 48),
        modelEntry('aromeFrance', 'AROME FR', tr('2,5 km', '2.5 km'), 'France', 48),
        modelEntry('ukv', 'UKV', '2 km', tr('Royaume-Uni', 'United Kingdom'), 120),
    ];
    type ModelId = 'ecmwf' | 'icon' | 'gfs' | 'iconEu' | 'iconD2' | 'aromeFrance' | 'ukv';

    /** Onglets : graphique vent & thermiques, émagramme */
    type Tab = 'chart' | 'emagram';
    /** label : texte complet ; short : texte court, sur téléphone */
    const TABS: { id: Tab; label: string; short: string; icon: string }[] = [
        {
            id: 'chart',
            label: tr('Vent & thermiques', 'Wind & thermals'),
            short: tr('Vent', 'Wind'),
            // Lignes de vent
            icon: 'M3 8h9.5a2.5 2.5 0 1 0-2.5-2.5M3 12h14.5a2.5 2.5 0 1 1-2.5 2.5M3 16h7',
        },
        {
            id: 'emagram',
            label: tr('Émagramme', 'Sounding'),
            short: tr('Émagramme', 'Sounding'),
            // Axes et courbe de sondage
            icon: 'M4 3v17h17M8 16.5c3-2.5 4-6 5.5-9S17 4 20 3.5',
        },
    ];
    const TAB_KEY = 'wpp-tab';
    let tab: Tab = 'chart';
    try {
        const saved = localStorage.getItem(TAB_KEY);
        if (TABS.some(t => t.id === saved)) tab = saved as Tab;
    } catch {
        /* stockage indisponible */
    }
    const saveTab = (t: Tab) => {
        try {
            localStorage.setItem(TAB_KEY, t);
        } catch {
            /* stockage indisponible */
        }
    };
    $: saveTab(tab);

    // La carte des cross est retirée : le cache qu'elle gardait dans le navigateur (jusqu'à plusieurs
    // Mo, pris sur la place que Windy partage avec le plugin) est effacé. À retirer si elle revient.
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith('wpp-xc-'))
            .forEach(k => localStorage.removeItem(k));
    } catch {
        /* stockage indisponible */
    }

    const WEEKDAYS =
        lang === 'fr' ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // AROME HD n'est publié qu'au sol (ni vent en altitude, ni émagramme) : on part sur AROME FR
    const asModel = (p: unknown) => (p === 'arome' ? 'aromeFrance' : p);
    const currentProduct = asModel(store.get('product'));
    // Modèle : celui affiché dans Windy, sinon le dernier choisi dans le plugin, sinon ECMWF
    const MODEL_KEY = 'wpp-model';
    const isModel = (id: unknown): id is ModelId => MODELS.some(m => m.id === id);
    const savedModel = (() => {
        try {
            return localStorage.getItem(MODEL_KEY);
        } catch {
            return null;
        }
    })();
    let model: ModelId = isModel(currentProduct) ? currentProduct : isModel(savedModel) ? savedModel : 'ecmwf';
    const saveModel = (m: ModelId) => {
        try {
            localStorage.setItem(MODEL_KEY, m);
        } catch {
            /* stockage indisponible */
        }
    };
    $: saveModel(model);

    // Modèle synchronisé avec la carte, dans les deux sens (AROME HD sur la carte vaut AROME FR ici)
    const syncMapProduct = (m: ModelId) => {
        if (asModel(store.get('product')) === m) return;
        try {
            store.set('product', m);
        } catch (e) {
            console.error(e);
        }
    };
    $: syncMapProduct(model);
    const onMapProduct = (p: unknown) => {
        const m = asModel(p);
        if (isModel(m) && m !== model) model = m;
    };
    let productListener: number | null = null;

    let loc: LatLon | null = null;
    let placeName = '';
    let payload: ForecastPayload | null = null;
    let columns: Column[] = [];
    let loading = false;
    let error = '';
    let fullDay = true;

    // --- Nouvelle version : vérifiée à l'ouverture, bandeau masquable (mémorisé par version)
    const DISMISS_KEY = 'wpp-update-dismissed';
    let newVersion: string | null = null;
    let dismissedVersion: string | null = null;
    let copied = false;
    try {
        dismissedVersion = localStorage.getItem(DISMISS_KEY);
    } catch {
        /* stockage indisponible */
    }
    checkForUpdate()
        .then(v => (newVersion = v))
        .catch(() => {});

    const dismissUpdate = (v: string) => {
        dismissedVersion = v;
        try {
            localStorage.setItem(DISMISS_KEY, v);
        } catch {
            /* stockage indisponible */
        }
    };

    const copyUpdateLink = async () => {
        if (!newVersion) return;
        const url = installUrl(newVersion);
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // Presse-papiers refusé : on affiche le lien pour le copier à la main
            window.prompt(tr('Lien d’installation :', 'Install link:'), url);
            return;
        }
        copied = true;
        setTimeout(() => (copied = false), 2500);
    };

    // Thème clair ou sombre, mémorisé dans le navigateur
    const THEME_KEY = 'wpp-theme';
    let lightTheme = false;
    try {
        lightTheme = localStorage.getItem(THEME_KEY) === 'light';
    } catch {
        /* stockage indisponible : thème sombre */
    }
    const saveTheme = (light: boolean) => {
        try {
            localStorage.setItem(THEME_KEY, light ? 'light' : 'dark');
        } catch {
            /* stockage indisponible */
        }
    };
    $: saveTheme(lightTheme);

    // Ascension de la particule sur l'émagramme : option, mémorisée dans le navigateur
    const ASCENT_KEY = 'wpp-ascent';
    let showAscent = false;
    try {
        showAscent = localStorage.getItem(ASCENT_KEY) === 'on';
    } catch {
        /* stockage indisponible : option décochée */
    }
    const saveAscent = (on: boolean) => {
        try {
            localStorage.setItem(ASCENT_KEY, on ? 'on' : 'off');
        } catch {
            /* stockage indisponible */
        }
    };
    $: saveAscent(showAscent);

    // Courbe d'état du lever du jour sur l'émagramme : option, mémorisée dans le navigateur
    const DAWN_KEY = 'wpp-dawn';
    let showDawn = false;
    try {
        showDawn = localStorage.getItem(DAWN_KEY) === 'on';
    } catch {
        /* stockage indisponible : option décochée */
    }
    const saveDawn = (on: boolean) => {
        try {
            localStorage.setItem(DAWN_KEY, on ? 'on' : 'off');
        } catch {
            /* stockage indisponible */
        }
    };
    $: saveDawn(showDawn);
    let altChoice: 'auto' | number = 'auto';
    let chartWidth = 760;
    let marker: L.Marker | null = null;
    let requestId = 0;
    /** Modèle proposé quand celui choisi n'a pas de données en altitude */
    let suggestModel: ModelId | null = null;

    $: modelLabel = MODELS.find(m => m.id === model)?.name ?? model;
    $: groundModel = columns[0]?.ground ?? Math.round(payload?.header.modelElevation ?? 0);

    // --- Relief autour du lieu : altitude des crêtes voisines, lue une fois par lieu
    let relief: { for: LatLon; elevations: (number | null)[] } | null = null;
    const readRelief = (where: LatLon) =>
        loadRelief(where.lat, where.lon).then(elevations => {
            if (loc === where) relief = { for: where, elevations };
        });
    $: if (loc && relief?.for !== loc) readRelief(loc);
    $: crest = relief && relief.for === loc && payload ? crestOf(relief.elevations, groundModel) : null;

    /** Heure de calcul du modèle, en heure locale du navigateur (ex. « lun. 29/09 à 02:00 ») */
    const formatRun = (iso: string) => {
        const d = new Date(iso);
        const day = d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
        const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        return `${day} ${tr('à', 'at')} ${time}`;
    };

    // --- Découpage par jour (heure locale du lieu)
    $: days = buildDays(payload, columns, loc);

    /**
     * Masse d'air des points voisins du lieu, pour lire sur la carte les fronts qui le traversent :
     * chargée après la prévision du lieu (`for`), qui s'affiche sans l'attendre
     */
    let surroundings: { for: ForecastPayload; fields: AirMass[] } | null = null;
    const readSurroundings = (center: ForecastPayload, where: LatLon, forModel: ModelId) => {
        loadSurroundings(forModel, where.lat, where.lon, center.header.model).then(fields => {
            if (payload === center) surroundings = { for: center, fields };
        });
    };
    /** Voisins nécessaires pour lire la carte : en dessous, les fronts sont repérés sur le lieu seul */
    const MAP_MIN_POINTS = 3;

    /**
     * Passages de front de toute la prévision : ceux de la carte autour du lieu, dès que les points
     * voisins sont chargés (rien avant, plutôt que des fronts qui changeraient)
     */
    $: fronts = (() => {
        if (!loc || !payload || surroundings?.for !== payload) return [];
        const { fields } = surroundings;
        const map =
            fields.length >= MAP_MIN_POINTS
                ? mapFronts(airMassOf(payload, loc.lat, loc.lon), fields, groundModel)
                : null;
        return frontsOf(columns, loc.lat, map);
    })();
    /** Sortes de front qui passent chaque jour : leur symbole suit le nom du jour */
    $: frontKinds = frontDays(fronts);

    /**
     * Lever et coucher du soleil (timestamps) pour la journée locale commençant à `midnight`,
     * au niveau du soleil apparent (−0,833°). null si le soleil ne se lève ou ne se couche pas.
     */
    const sunTimes = (midnight: number, where: LatLon) => {
        const H0 = -0.833;
        const STEP = 5 * 60e3;
        let rise: number | null = null;
        let set: number | null = null;
        let prev = sunElevation(midnight, where.lat, where.lon);
        for (let t = midnight + STEP; t <= midnight + 24 * 3600e3; t += STEP) {
            const e = sunElevation(t, where.lat, where.lon);
            // Instant du passage interpolé entre deux pas de 5 min
            const cross = t - STEP + (STEP * (prev - H0)) / (prev - e);
            if (rise == null && prev < H0 && e >= H0) rise = cross;
            if (rise != null && prev >= H0 && e < H0) set = cross;
            prev = e;
        }
        return { rise, set };
    };

    const buildDays = (p: ForecastPayload | null, cols: Column[], where: LatLon | null) => {
        if (!p || !where) return [];
        // Décalage horaire de chaque instant : un changement d'heure peut tomber dans la prévision
        const offsetAt = makeOffsetAt(p, where.lat, where.lon);
        const keyOf = (ts: number) => dayKey(ts, offsetAt(ts));
        // Jours de la prévision au sol, pour afficher aussi (grisés) les jours où le modèle n'a plus
        // de données en altitude : modèles à courte échéance comme AROME ou ICON-D2
        const byDay = new Map<string, { firstTs: number; steps: number; columns: Column[] }>();
        for (const ts of (p.data.ts || []) as number[]) {
            const key = keyOf(ts);
            const day = byDay.get(key) ?? { firstTs: ts, steps: 0, columns: [] };
            day.steps++;
            byDay.set(key, day);
        }
        for (const c of cols) byDay.get(keyOf(c.ts))?.columns.push(c);

        return [...byDay.entries()]
            .filter(([, day]) => day.columns.length >= 3 || day.steps >= 3)
            .map(([key, { firstTs, columns: list }]) => {
                const offset = offsetAt(firstTs) * 3600e3;
                const d = new Date(firstTs + offset);
                const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - offset;
                const { rise, set } = sunTimes(midnight, where);
                const ceilings = list
                    .filter(c => c.ceiling != null)
                    .map(c => (c.ceiling as number) - c.ground);
                return {
                    key,
                    label: `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`,
                    columns: list,
                    sunrise: rise,
                    sunset: set,
                    /** Plus (assez) de données en altitude ce jour-là : au-delà de l'échéance du modèle */
                    outOfRange: list.length < 3,
                    /** Meilleure montée au vario de la journée (m/s) */
                    bestClimb: Math.max(0, ...list.map(c => c.climb)),
                    /** Risque d'orage le plus fort de la journée (heures de vol) */
                    storm: Math.max(0, ...list.filter(c => c.hour >= 9 && c.hour <= 20).map(c => c.stormRisk)) as StormRisk,
                    bestCeiling: ceilings.length
                        ? Math.round((Math.max(...ceilings) + list[0].ground) / 50) * 50
                        : null,
                };
            });
    };

    // Jour affiché (clé de date locale) : celui de l'heure de la carte, ou celui choisi dans le
    // panneau, conservé quand on change de lieu ou de modèle. S'il n'existe pas ici : premier jour
    // qui a des données à afficher.
    let pinnedDay: string | null = null;

    type Day = ReturnType<typeof buildDays>[number];

    /**
     * Heures affichées : de l'heure qui précède le lever du soleil jusqu'à l'heure qui suit le coucher
     * (ex. lever 6h40, coucher 21h10 : de 6h à 22h), ou toute la journée avec « 24 h ».
     */
    const visibleColumns = (day: Day | undefined, full: boolean) => {
        if (!day) return [];
        if (full) return day.columns;
        const { sunrise, sunset } = day;
        return day.columns.filter(
            c => (sunrise == null || c.ts > sunrise - 3600e3) && (sunset == null || c.ts < sunset + 3600e3),
        );
    };

    const pickDay = (list: Day[], pinned: string | null, full: boolean) => {
        const hasData = (d: Day) => !d.outOfRange && visibleColumns(d, full).length > 0;
        const pinnedIdx = list.findIndex(d => d.key === pinned && hasData(d));
        if (pinnedIdx >= 0) return pinnedIdx;
        const first = list.findIndex(hasData);
        return first >= 0 ? first : 0;
    };

    $: dayIndex = pickDay(days, pinnedDay, fullDay);
    $: dayColumns = visibleColumns(days[dayIndex], fullDay);

    // --- Instant affiché, à 5 min près (curseur de l'émagramme, repère du graphique) : l'heure de la
    // carte, sinon l'heure actuelle si elle fait partie du jour affiché, sinon 14 h. En changeant de
    // jour, on garde la même heure de la journée.
    const HOUR_MS = 3600e3;
    const DAY_MS = 24 * HOUR_MS;
    /** Pas du curseur : 5 min */
    const SLIDER_STEP = 5 * 60e3;

    // Heure synchronisée avec la carte, dans les deux sens : déplacer l'heure de la carte change le
    // jour et l'heure du panneau, choisir un jour ou une heure dans le panneau déplace la carte
    const mapTime = (ts: unknown = store.get('timestamp')) =>
        typeof ts === 'number' && Number.isFinite(ts) ? Math.round(ts / SLIDER_STEP) * SLIDER_STEP : null;
    let selectedTs: number | null = mapTime();
    /** Heure de la carte dont le jour reste à afficher : il faut l'heure locale du lieu, donc sa prévision */
    let mapTs: number | null = selectedTs;
    $: if (mapTs != null && payload && loc) {
        pinnedDay = dayKey(mapTs, makeOffsetAt(payload, loc.lat, loc.lon)(mapTs));
        mapTs = null;
    }
    const onMapTime = (ts: unknown, from?: string) => {
        // Changement venu du panneau lui-même
        if (from === name) return;
        const t = mapTime(ts);
        if (t == null || t === selectedTs) return;
        stopPlay();
        selectedTs = mapTs = t;
    };
    let timeListener: number | null = null;

    /** Heure choisie dans le panneau : la carte la prend aussi */
    const chooseTime = (ts: number) => {
        selectedTs = ts;
        if (store.get('timestamp') === ts) return;
        try {
            store.set('timestamp', ts, { UIident: name });
        } catch (e) {
            console.error(e);
        }
    };

    /** Jour choisi dans le panneau : la carte passe à ce jour, à la même heure */
    const chooseDay = async (key: string) => {
        pinnedDay = key;
        await tick();
        if (selected) chooseTime(selected.ts);
    };

    $: selected = pickSelected(dayColumns, selectedTs, payload, loc);

    const nearestColumn = (cols: Column[], t: number) =>
        cols.length ? cols.reduce((best, c) => (Math.abs(c.ts - t) < Math.abs(best.ts - t) ? c : best)) : null;

    const pickSelected = (
        cols: Column[],
        ts: number | null,
        p: ForecastPayload | null,
        where: LatLon | null,
    ): Column | null => {
        if (!cols.length) return null;
        const first = cols[0].ts;
        const last = cols[cols.length - 1].ts;
        const offsetAt = p && where ? makeOffsetAt(p, where.lat, where.lon) : () => 0;
        const localTime = (t: number) => (((t + offsetAt(t) * HOUR_MS) % DAY_MS) + DAY_MS) % DAY_MS;
        let t = ts;
        if (t != null && (t < first || t > last)) {
            // Autre jour : même heure locale dans le jour affiché
            t = Math.min(last, Math.max(first, first - localTime(first) + localTime(t)));
        }
        if (t == null) {
            const now = Date.now();
            t =
                now >= first && now <= last
                    ? Math.round(now / SLIDER_STEP) * SLIDER_STEP
                    : cols.reduce((best, c) => (Math.abs(c.hour - 14) < Math.abs(best.hour - 14) ? c : best)).ts;
        }
        const exact = cols.find(c => c.ts === t);
        if (exact) return exact;
        // Entre deux heures : prévision interpolée à cet instant, puis calcul complet (soleil compris).
        // Sa pluie est celle de l'heure qui le contient : elle en garde la nature (averses ou non),
        // décidée avec les heures voisines
        if (p && where) {
            const at = payloadAt(p, t, where.lat, where.lon);
            const hour = cols.filter(c => c.ts <= (t as number)).pop();
            const col = at ? buildColumns(at, where.lat, where.lon, { shower: hour?.showerBase != null })[0] : undefined;
            if (col) return col;
        }
        return nearestColumn(cols, t);
    };

    /** Décalage horaire du lieu à chaque instant (changement d'heure compris) */
    $: offsetAt = payload && loc ? makeOffsetAt(payload, loc.lat, loc.lon) : () => payload?.header.utcOffset || 0;

    /** Heure locale du lieu (« 14h35 » / « 14:35 ») */
    $: localClock = (t: number) => {
        const d = new Date(t + offsetAt(t) * HOUR_MS);
        return clockText(d.getUTCHours(), d.getUTCMinutes());
    };

    /**
     * Plafond nuageux de l'heure de l'émagramme, décidé comme sur le graphique avec les heures de la
     * journée (une couche se prolonge d'heure en heure) : l'instant choisi y prend sa place
     */
    const deckAt = (cols: Column[], col: Column) => {
        const list = cols.some(c => c.ts === col.ts) ? cols : [...cols, col].sort((a, b) => a.ts - b.ts);
        const decks = cloudDecksOf(
            list.map(c => c.profile),
            list.map(c => c.precip >= 0.1 && c.showerBase == null),
            list.map(c => (c.ceiling != null ? c.thermalTop : null)),
        );
        return decks[list.findIndex(c => c.ts === col.ts)] ?? null;
    };
    $: deck = selected && tab === 'emagram' ? deckAt(dayColumns, selected) : null;

    /** Plage de l'axe des températures de l'émagramme, commune à la journée affichée */
    $: emaRange = emagramRange(dayColumns, yMin, yMax, showAscent);

    /** Heure du jour affiché la plus proche du lever du soleil : sa courbe d'état sert de repère (option) */
    $: dawn = showDawn && days[dayIndex]?.sunrise != null ? nearestColumn(days[dayIndex].columns, days[dayIndex].sunrise as number) : null;

    // --- Heure actuelle, relue chaque minute et au retour sur l'onglet du navigateur : le repère
    // « maintenant » et l'alerte d'orage la suivent quand le panneau reste ouvert. Une prévision
    // affichée depuis plus d'une heure est rechargée, sans quitter l'écran.
    let nowTs = Date.now();
    const RELOAD_MS = 60 * 60e3;
    /** Heure du dernier chargement demandé */
    let loadedAt = 0;
    const refreshNow = () => {
        if (document.visibilityState !== 'visible') return;
        nowTs = Date.now();
        if (loc && payload && !loading && nowTs - loadedAt > RELOAD_MS) load(loc, model, true);
    };
    let nowTimer: ReturnType<typeof setInterval> | null = null;

    // --- Orages : alerte du jour affiché (heures à venir), et orage attendu dans les 3 h qui
    // suivent l'heure de l'émagramme quand elle n'en a pas elle-même
    $: stormWatch = days[dayIndex] && !days[dayIndex].outOfRange ? stormWatchOf(days[dayIndex].columns, nowTs) : null;
    $: stormAhead = selected && selected.stormRisk < 2 ? nextStorm(columns, selected.ts) : null;

    const nextStorm = (cols: Column[], t: number) => {
        const storms = cols.filter(c => c.ts > t && c.ts <= t + 3 * HOUR_MS && c.stormRisk >= 2);
        if (!storms.length) return null;
        const level: 2 | 3 = storms.some(c => c.stormRisk === 3) ? 3 : 2;
        return { level, at: hourText(storms[0].hour) };
    };

    /** Infobulle de la CAPE et du LI de l'émagramme */
    const instabilityTitle = (c: Column) =>
        tr(
            'Énergie disponible pour la convection et indice de soulèvement (négatif = instable), valeurs standard (air mélangé des 1 000 premiers mètres). La CAPE publiée par certains modèles, calculée avec l’air le plus instable, est souvent nettement plus forte.',
            'Convective available energy and lifted index (negative = unstable), standard values (mixed air of the lowest 1,000 m). The CAPE published by some models, computed with the most unstable air, is often much higher.',
        ) +
        (c.muCape >= c.cape + 100
            ? tr(
                  ` Ici, de l’air plus haut a plus d’énergie (max) : CAPE ${c.muCape} J/kg${c.muLiftedIndex != null ? `, LI ${c.muLiftedIndex}` : ''}. C’est lui qui nourrit un orage venu d’ailleurs.`,
                  ` Here, air higher up has more energy (max): CAPE ${c.muCape} J/kg${c.muLiftedIndex != null ? `, LI ${c.muLiftedIndex}` : ''}. It is what feeds a storm arriving from elsewhere.`,
              )
            : '');

    /**
     * Fond de la piste du curseur : couleur de la force des thermiques heure par heure, gris la nuit.
     * Aligné sur la course du bouton du curseur (demi-bouton de 10 px à chaque bout).
     */
    $: trackGradient = (() => {
        const n = dayColumns.length;
        if (n < 2) return 'var(--wpp-surface-hover)';
        const stops = dayColumns.map((c, k) => {
            const color =
                c.sunElev <= 0 ? 'var(--wpp-track-night)' : c.climb >= 0.2 ? thermalColor(c.climb) : 'var(--wpp-track-day)';
            return `${color} calc(10px + (100% - 20px) * ${k / (n - 1)})`;
        });
        return `linear-gradient(to right, ${stops.join(', ')})`;
    })();

    // Lecture automatique : la journée défile par pas de 10 min
    let playing = false;
    let playTimer: ReturnType<typeof setInterval> | null = null;
    const stopPlay = () => {
        playing = false;
        if (playTimer) clearInterval(playTimer);
        playTimer = null;
    };
    const togglePlay = () => {
        if (playing) return stopPlay();
        if (!selected || !dayColumns.length) return;
        const end = dayColumns[dayColumns.length - 1].ts;
        if (selected.ts >= end) chooseTime(dayColumns[0].ts);
        playing = true;
        playTimer = setInterval(() => {
            const cur = selected?.ts ?? end;
            if (cur >= end) return stopPlay();
            chooseTime(Math.min(end, cur + 2 * SLIDER_STEP));
        }, 160);
    };
    // Changement d'onglet, de jour ou de lieu : on arrête la lecture (elle court jusqu'à la fin de
    // la journée où elle a été lancée)
    const stopPlayOn = (..._changed: unknown[]) => stopPlay();
    $: stopPlayOn(tab, days[dayIndex]?.key, loc);

    /** Heure pleine précédente ou suivante */
    const stepHour = (dir: -1 | 1) => {
        stopPlay();
        if (!selected || !dayColumns.length) return;
        const t = dir > 0 ? Math.floor(selected.ts / HOUR_MS + 1e-9) * HOUR_MS + HOUR_MS : Math.ceil(selected.ts / HOUR_MS - 1e-9) * HOUR_MS - HOUR_MS;
        chooseTime(Math.min(dayColumns[dayColumns.length - 1].ts, Math.max(dayColumns[0].ts, t)));
    };

    const r50 = (z: number) => Math.round(z / 50) * 50;

    // --- Échelle verticale
    $: yMin = Math.max(0, Math.floor((groundModel - 100) / 500) * 500);
    $: yMax =
        altChoice === 'auto'
            ? Math.max(
                  yMin + 2000,
                  Math.ceil(
                      (Math.max(groundModel + 2500, ...dayColumns.map(c => (c.thermalTop ?? 0) + 500))) /
                          500,
                  ) * 500,
              )
            : Math.max(Number(altChoice), yMin + 1000);

    // --- Chargement. `quiet` : rechargement d'une prévision déjà affichée, qui reste à l'écran en
    // attendant la nouvelle, et en cas d'échec
    const load = async (where: LatLon, forModel: ModelId, quiet = false) => {
        const id = ++requestId;
        loadedAt = Date.now();
        if (!quiet) {
            loading = true;
            error = '';
            suggestModel = null;
        }
        try {
            const loaded = await loadForecast(forModel, where.lat, where.lon, {
                header: true,
                summary: true,
                sounding: true,
                airgram: true,
                meteogram: true,
            });
            if (id !== requestId) return;
            payload = loaded.payload;
            columns = loaded.columns;
            if (columns.length) readSurroundings(loaded.payload, where, forModel);
            if (!columns.length) {
                suggestModel = forModel === 'ecmwf' ? 'icon' : 'ecmwf';
                error = tr(
                    `Le modèle ${modelLabel} ne fournit pas de données en altitude ici.`,
                    `${modelLabel} has no upper-air data here.`,
                );
            }
        } catch (e) {
            if (id !== requestId) return;
            console.error(e);
            if (quiet) return;
            payload = null;
            columns = [];
            error = tr(
                `Impossible de charger ${modelLabel} pour ce lieu (hors couverture du modèle ?).`,
                `Could not load ${modelLabel} for this place (outside the model's coverage?).`,
            );
        } finally {
            if (id === requestId) loading = false;
        }
    };

    $: if (loc) load(loc, model);

    const removeMarker = () => {
        marker?.remove();
        marker = null;
    };

    const setLocation = (latLon: LatLon) => {
        const lat = Number(latLon.lat);
        const lon = Number(latLon.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        loc = { lat, lon };
        placeName = '';
        saveLastLocation(lat, lon);

        removeMarker();
        marker = new L.Marker({ lat, lng: lon }, { icon: markers.pulsatingIcon }).addTo(map);
        setUrl(name, { lat, lon });

        reverse
            .get({ lat, lon })
            .then(r => {
                if (loc?.lat === lat && loc?.lon === lon) placeName = r?.name ?? '';
            })
            .catch(() => {});
    };

    // Dernier point choisi, mémorisé dans le navigateur : rouvert quand le plugin s'ouvre sans point
    const LAST_LOC_KEY = 'wpp-last-location';

    const saveLastLocation = (lat: number, lon: number) => {
        try {
            localStorage.setItem(LAST_LOC_KEY, JSON.stringify({ lat, lon }));
        } catch {
            /* stockage indisponible */
        }
    };

    const lastLocation = (): LatLon | null => {
        try {
            const saved = JSON.parse(localStorage.getItem(LAST_LOC_KEY) || 'null');
            return saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon) ? saved : null;
        } catch {
            return null;
        }
    };

    export const onopen = (params?: LatLon) => {
        const last = lastLocation();
        if (params && params.lat != null && params.lon != null) {
            setLocation(params);
        } else if (loc) {
            // Déjà un point choisi dans cette session : on le garde
        } else if (last) {
            setLocation(last);
        } else {
            getGPSlocation()
                .then(pos => setLocation(pos))
                .catch(() => {
                    const c = map.getCenter();
                    setLocation({ lat: c.lat, lon: c.lng });
                });
        }
    };

    onMount(() => {
        singleclick.on(name, setLocation);
        productListener = store.on('product', onMapProduct);
        timeListener = store.on('timestamp', onMapTime);
        nowTimer = setInterval(refreshNow, 60e3);
        document.addEventListener('visibilitychange', refreshNow);
    });

    onDestroy(() => {
        stopPlay();
        if (nowTimer) clearInterval(nowTimer);
        document.removeEventListener('visibilitychange', refreshNow);
        singleclick.off(name, setLocation);
        if (productListener !== null) store.off(productListener);
        if (timeListener !== null) store.off(timeListener);
        removeMarker();
    });
</script>

<style lang="less">
    @keyframes wpp-spin {
        to {
            transform: rotate(360deg);
        }
    }

    // Couleurs du thème, partagées par tous les composants du plugin (variables CSS héritées)
    .wpp {
        --wpp-fg: #e6e9ed;
        --wpp-fg-dim: #b5bcc6;
        --wpp-fg-faint: #8b939e;
        --wpp-line: #ffffff;
        --wpp-halo: #0f1822;
        // Contour des chiffres sur les graphiques (couleur et facteur d'épaisseur)
        --wpp-text-halo: #0f1822;
        --wpp-text-halo-k: 1;
        --wpp-surface: rgba(255, 255, 255, 0.05);
        --wpp-surface-hover: rgba(255, 255, 255, 0.12);
        --wpp-border: rgba(255, 255, 255, 0.2);
        --wpp-border-strong: rgba(255, 255, 255, 0.32);
        --wpp-popup-bg: rgba(18, 24, 32, 0.97);
        --wpp-popup-border: rgba(255, 255, 255, 0.15);
        --wpp-sky-top: #22364a;
        --wpp-sky-bottom: #1a2531;
        --wpp-stable: #e9edf2;
        --wpp-parcel: #ffd24a;
        --wpp-accent: #ffd24a;
        --wpp-accent-fg: #111111;
        // Nuage de l'émagramme, à sa base (il s'éclaircit vers le sommet)
        --wpp-cloud: rgba(238, 242, 247, 0.3);
        // Nuages du modèle dans la bande de l'émagramme, à 100 % de couverture
        --wpp-cloud-layer: #ced6e1;
        --wpp-freezing: #5fd3ff;
        --wpp-rain: #8fc3ff;
        --wpp-snow: #e4dcff;
        --wpp-dew: #7dbaff;
        --wpp-tab-active: rgba(255, 255, 255, 0.14);
        --wpp-track-night: #1b2430;
        --wpp-track-day: #3a4757;

        // Le panneau occupe toute la largeur disponible, quelle que soit la mise en page de Windy
        width: 100%;
        align-self: stretch;
        box-sizing: border-box;
        color: var(--wpp-fg);

        &--light {
            --wpp-fg: #1f2933;
            --wpp-fg-dim: #4b5563;
            --wpp-fg-faint: #6b7280;
            --wpp-line: #1f2933;
            --wpp-halo: #ffffff;
            // Sur fond clair, un contour blanc franc « vibre » autour des chiffres : voile léger et fin
            --wpp-text-halo: rgba(246, 250, 253, 0.55);
            --wpp-text-halo-k: 0.7;
            --wpp-surface: rgba(15, 23, 42, 0.04);
            --wpp-surface-hover: rgba(15, 23, 42, 0.09);
            --wpp-border: rgba(15, 23, 42, 0.18);
            --wpp-border-strong: rgba(15, 23, 42, 0.32);
            --wpp-popup-bg: rgba(255, 255, 255, 0.98);
            --wpp-popup-border: rgba(15, 23, 42, 0.15);
            --wpp-sky-top: #e8f0f8;
            --wpp-sky-bottom: #d9e4ee;
            --wpp-stable: #1f2933;
            --wpp-parcel: #c98a00;
            --wpp-accent: #e0a800;
            --wpp-accent-fg: #111111;
            --wpp-cloud: rgba(255, 255, 255, 0.9);
            --wpp-cloud-layer: #7f8ba0;
            --wpp-freezing: #0284c7;
            --wpp-rain: #2563eb;
            --wpp-snow: #8b7cf0;
            --wpp-dew: #1d4ed8;
            --wpp-tab-active: #ffffff;
            --wpp-track-night: #9aa5b4;
            --wpp-track-day: #d5dce5;
            background: #f6f8fb;
        }

        &__hint {
            margin: 20px 0;
            font-size: 14px;
        }
        &__head {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 10px;
            margin: 6px 0 12px;
        }
        &__name {
            flex: 1;
            min-width: 0;
            font-size: 17px;
            font-weight: bold;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        &__info {
            margin: 14px auto 4px;
            max-width: 420px;
            font-size: 12px;
            color: var(--wpp-fg-dim);

            div {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                padding: 3px 0;
                border-bottom: 1px dashed var(--wpp-border);
            }
            dt {
                margin: 0;
            }
            dd {
                margin: 0;
                color: var(--wpp-fg);
                font-weight: bold;
                white-space: nowrap;
            }
        }
        &__footer {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px 20px;
            align-items: center;
            margin: 24px 0 8px;
            padding-top: 12px;
            border-top: 1px solid var(--wpp-border);
            font-size: 12px;
            opacity: 0.85;

            select {
                margin-left: 4px;
                background: var(--wpp-surface);
                color: var(--wpp-fg);
                border: 1px solid var(--wpp-border);
                border-radius: 4px;
                padding: 2px 4px;
                font-size: 12px;
            }
        }
        &__check {
            cursor: pointer;
            input {
                vertical-align: middle;
            }
        }
        &__days {
            display: flex;
            gap: 4px;
            overflow-x: auto;
            margin-bottom: 10px;
            padding-bottom: 2px;
        }
        &__day {
            flex: 0 0 auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 62px;
            padding: 4px 8px;
            border: 1px solid var(--wpp-border);
            border-radius: 6px;
            background: var(--wpp-surface);
            color: var(--wpp-fg);
            cursor: pointer;
            font-size: 12px;

            small {
                font-size: 10px;
                opacity: 0.75;
            }
            &.selected {
                background: #f5a623;
                border-color: #f5a623;
                color: #111;
            }
            &:disabled {
                opacity: 0.35;
                cursor: default;
            }
            &:hover:not(.selected) {
                border-color: var(--wpp-border-strong);
            }
        }
        &__chart {
            width: 100%;
            min-width: 0;
            min-height: 200px;
        }
        &__day-stats {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 2px;
        }
        &__w {
            padding: 0 4px;
            border-radius: 3px;
            color: #111;
            font-weight: bold;
            opacity: 1 !important;
        }
        &__spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            margin-right: 8px;
            vertical-align: -2px;
            border: 2px solid var(--wpp-border);
            border-top-color: #ffd24a;
            border-radius: 50%;
            animation: wpp-spin 0.8s linear infinite;
        }
        &__switch {
            display: block;
            margin: 12px auto 0;
            padding: 7px 16px;
            border: 2px solid #ffd24a;
            border-radius: 18px;
            background: rgba(255, 210, 74, 0.12);
            color: var(--wpp-fg);
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
        }
        &__status {
            padding: 60px 0;
            text-align: center;
            opacity: 0.8;
            &--error {
                color: #ff8a80;
            }
        }
        &__daystorm {
            margin-left: 3px;
        }
        &__dayfront {
            margin-left: 4px;
        }
        &__update {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
            margin: 0 0 10px;
            padding: 8px 10px;
            border: 1px solid #f5a623;
            border-radius: 8px;
            background: rgba(245, 166, 35, 0.12);
            font-size: 12px;
            line-height: 1.4;
            color: var(--wpp-fg-dim);

            b {
                display: block;
                color: var(--wpp-fg);
                font-size: 13px;
            }
        }
        &__update-actions {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        &__update-copy {
            padding: 6px 12px;
            border: none;
            border-radius: 6px;
            background: #f5a623;
            color: #111;
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
        }
        &__update-close {
            padding: 4px 6px;
            border: none;
            background: none;
            color: var(--wpp-fg-dim);
            font-size: 14px;
            cursor: pointer;
        }
        // Onglets : contrôle segmenté pleine largeur, bouton de légende à droite
        &__tabbar {
            position: relative;
            display: flex;
            align-items: stretch;
            gap: 8px;
            margin: 4px 0 14px;
        }
        &__tabs {
            flex: 1;
            display: flex;
            min-width: 0;
            gap: 3px;
            padding: 3px;
            border: 1px solid var(--wpp-border);
            border-radius: 10px;
            background: var(--wpp-surface);
        }
        &__tab {
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 1 1 0;
            gap: 7px;
            min-width: 0;
            padding: 6px 8px;
            border: none;
            border-radius: 7px;
            background: none;
            color: var(--wpp-fg-dim);
            font: inherit;
            // Même graisse actif ou non : le texte ne bouge pas au clic
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition:
                background 0.15s,
                color 0.15s,
                box-shadow 0.15s;

            span {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            &:hover {
                color: var(--wpp-fg);
                background: var(--wpp-surface);
            }
            &.selected {
                color: var(--wpp-fg);
                background: var(--wpp-tab-active);
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);

                .wpp__tab-icon {
                    color: var(--wpp-accent);
                }
            }
            // Sur téléphone : pictogramme au-dessus du nom court, qui n'est jamais coupé. La largeur
            // de chaque onglet suit son texte, le reste de la place est partagé.
            @media (max-width: 560px) {
                flex: 1 1 auto;
                flex-direction: column;
                gap: 3px;
                padding: 6px 2px 5px;
                font-size: 11px;
                line-height: 1.2;

                span {
                    overflow: visible;
                }
            }
        }
        &__tab-short {
            display: none;
        }
        @media (max-width: 560px) {
            &__tab-long {
                display: none;
            }
            &__tab-short {
                display: inline;
            }
            &__tab-icon {
                width: 19px;
                height: 19px;
            }
            &__tabbar {
                gap: 6px;
            }
            &__tabs {
                gap: 1px;
            }
        }
        &__tab-icon {
            flex: none;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
        }
        &__block {
            position: relative;
            // Toute la largeur du panneau, même si Windy ne l'étire pas (sinon le graphique
            // reste bloqué à sa largeur par défaut)
            width: 100%;
            align-self: stretch;
            box-sizing: border-box;
        }
        // Curseur de l'heure de l'émagramme
        &__timebar {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 2px 0 10px;
        }
        &__timehead {
            flex: none;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        &__time {
            min-width: 58px;
            text-align: center;
            font-size: 20px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            color: var(--wpp-fg);
        }
        &__step {
            width: 30px;
            height: 30px;
            padding: 0;
            border: 1px solid var(--wpp-border);
            border-radius: 8px;
            background: var(--wpp-surface);
            color: var(--wpp-fg);
            font-size: 18px;
            line-height: 1;
            cursor: pointer;

            &:hover:not(:disabled) {
                background: var(--wpp-surface-hover);
            }
            &:disabled {
                opacity: 0.35;
                cursor: default;
            }
        }
        &__slider {
            flex: 1;
            min-width: 0;
        }
        // Curseur : piste épaisse colorée, gros bouton blanc cerclé d'orange (bouton de 20 px)
        &__range {
            -webkit-appearance: none;
            appearance: none;
            display: block;
            width: 100%;
            height: 22px;
            margin: 0;
            background: transparent;
            cursor: pointer;

            &::-webkit-slider-runnable-track {
                height: 10px;
                border-radius: 5px;
                background: var(--wpp-track);
                box-shadow: inset 0 0 0 1px var(--wpp-border);
            }
            &::-moz-range-track {
                height: 10px;
                border-radius: 5px;
                background: var(--wpp-track);
                box-shadow: inset 0 0 0 1px var(--wpp-border);
            }
            &::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 20px;
                height: 20px;
                margin-top: -5px;
                border-radius: 50%;
                background: #fff;
                border: 3px solid #f5a623;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
            }
            &::-moz-range-thumb {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #fff;
                border: 3px solid #f5a623;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
            }
            &:focus-visible {
                outline: none;
                &::-webkit-slider-thumb {
                    box-shadow: 0 0 0 4px rgba(245, 166, 35, 0.35);
                }
            }
        }
        // Graduations (toutes les heures, plus longues toutes les 3 h) et repère « maintenant »
        &__ticks {
            position: relative;
            height: 6px;
        }
        &__tick {
            position: absolute;
            top: 0;
            width: 1px;
            height: 3px;
            background: var(--wpp-fg-faint);
            opacity: 0.6;

            &.major {
                height: 6px;
                opacity: 1;
            }
        }
        &__nowtick {
            position: absolute;
            top: -16px;
            width: 2px;
            height: 22px;
            margin-left: -1px;
            background: #ff5a5a;
            border-radius: 1px;
            pointer-events: none;
        }
        &__ticklabels {
            position: relative;
            height: 16px;

            button {
                position: absolute;
                transform: translateX(-50%);
                padding: 0 3px;
                border: none;
                background: none;
                color: var(--wpp-fg-faint);
                font-size: 10.5px;
                cursor: pointer;
                white-space: nowrap;

                &:hover {
                    color: var(--wpp-fg);
                }
            }
        }
        &__play {
            font-size: 11px;

            &.on {
                background: #f5a623;
                border-color: #f5a623;
                color: #111;
            }
        }
        // Instabilité (CAPE, LI, risque d'orage) : une ligne sur toute la largeur, sous les autres valeurs
        &__instab {
            grid-column: ~'1 / -1';
            display: flex;
            gap: 3px 14px;
        }
        // Le risque d'orage prend la place qui reste
        &__storm {
            flex: 1;
            min-width: 0;
            font-weight: 600;

            &--0 {
                color: var(--wpp-fg-faint);
                font-weight: 400;
            }
            &--1 {
                color: #f59e0b;
            }
            &--2 {
                color: #ef4444;
            }
            &--3 {
                color: #d946ef;
            }
        }
        // Orage attendu dans les heures qui suivent
        &__storm-ahead {
            font-weight: 600;

            &:not(:first-child) {
                margin-left: 12px;
            }
        }
        // Pastille du palier de la CAPE et du LI, aux couleurs de la légende
        &__dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            margin-right: 4px;
            border-radius: 50%;
        }
        &__summary {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 3px 14px;
            font-size: 12px;
            margin-top: 8px;
            color: var(--wpp-fg-dim);
            font-variant-numeric: tabular-nums;

            span {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            b {
                color: var(--wpp-fg);
            }

            small {
                margin-left: 4px;
                color: var(--wpp-fg-faint);

                // Thermiques hachés par le vent : mention en orange
                &.wpp__choppy {
                    color: #f59e0b;
                }
            }
        }
        // Sur grand écran, les paires ne comptent pas : chaque valeur est une case de la grille
        &__pair {
            display: contents;
        }
    }

    // --- Smartphone / écrans tactiles
    @media (max-width: 600px) {
        .wpp {
            &__footer {
                gap: 8px 16px;
                select {
                    // < 16 px, iOS zoome sur la page au moment de choisir
                    font-size: 16px;
                    padding: 4px 6px;
                }
            }
            // Curseur de l'heure : heure et flèches sur une ligne, curseur pleine largeur dessous
            &__timebar {
                flex-wrap: wrap;
                gap: 4px 10px;
            }
            &__slider {
                flex-basis: 100%;
            }
            // Valeurs sous l'émagramme : deux par ligne, la première à gauche, la seconde calée à
            // droite. Chaque ligne partage sa largeur à sa façon (le vario peut être long).
            &__summary {
                grid-template-columns: minmax(0, 1fr);
                gap: 2px;
            }
            &__pair {
                display: flex;
                justify-content: space-between;
                gap: 12px;

                span:last-child {
                    flex: none;
                }
            }
            // Risque d'orage sur sa propre ligne, sous la CAPE et le LI : jamais coupé, et la hauteur
            // ne change pas d'une heure à l'autre
            &__instab {
                flex-wrap: wrap;
                column-gap: 12px;
            }
            &__storm {
                flex-basis: 100%;
            }
        }
    }

    @media (pointer: coarse) {
        .wpp {
            &__day {
                padding: 6px 10px;
            }
            // Au doigt : curseur et flèches plus faciles à attraper
            &__range {
                height: 28px;
            }
            &__step {
                width: 36px;
                height: 36px;
            }
            &__check input {
                width: 18px;
                height: 18px;
            }
        }
    }
    // Sur téléphone, la barre de titre de Windy prend trop de place : on la masque
    .plugin__mobile-header.wpp-title {
        display: none !important;
    }

    // Titre du plugin discret (les styles Windy l'affichent en très grand, et avec leur propre
    // couleur de thème : il faut forcer les deux pour que le thème clair du plugin soit respecté)
    .plugin__title.wpp-title,
    .plugin__mobile-header.wpp-title {
        color: var(--wpp-fg-dim) !important;
        font-size: 13px !important;
        font-weight: normal !important;
        line-height: 1.4;
        opacity: 0.75;
    }
    .plugin__title.wpp-title {
        margin: 0 !important;
        padding: 0 !important;
    }
</style>
