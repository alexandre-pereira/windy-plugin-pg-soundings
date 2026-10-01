<!--
    Bulletin de vol de la journée affichée, rédigé à partir de la prévision du modèle : appréciation,
    force des conditions heure par heure, créneaux (conditions calmes, calmes à modérées, thermiques),
    passages de front et orage, vent, thermiques, ciel et précipitations, puis un aperçu des jours
    suivants.

    Le bulletin décrit des conditions. Il ne dit jamais à quel pilote elles conviennent, ni qu'une
    heure est « volable » : pas de niveau de pilotage dans ses textes.
-->
{#if b}
    <div class="wpp-bl">
        <div class="wpp-bl__head" style="--wpp-bl-tone:{toneOf(b)}">
            <div class="wpp-bl__date">{title}</div>
            <div class="wpp-bl__verdict">{headline(b)}</div>
            <p class="wpp-bl__lead">{leadOf(b)}</p>
        </div>

        <!-- Force des conditions de chaque heure de jour -->
        <div class="wpp-bl__strip" role="img" aria-label={tr('Conditions heure par heure', 'Conditions hour by hour')}>
            {#each strip as h}
                <span
                    class="wpp-bl__cell"
                    class:past={h.col.ts + HOUR_MS <= nowTs}
                    style="background:{LEVEL_COLORS[h.level]}"
                    title={cellTitle(h)}
                ></span>
            {/each}
            {#if nowAt != null}
                <span class="wpp-bl__now" title={tr('Maintenant', 'Now')} style="left:{nowAt * 100}%"></span>
            {/if}
        </div>
        <div class="wpp-bl__hours" aria-hidden="true">
            {#each strip as h}
                <span>{h.col.hour % 3 === 0 ? hourShort(h.col.hour) : ''}</span>
            {/each}
        </div>
        <div class="wpp-bl__levels">
            {#each LEVEL_LABELS as label, k}
                <span><i style="background:{LEVEL_COLORS[k]}"></i>{label}</span>
            {/each}
        </div>

        {#each sections as s}
            <section class="wpp-bl__section">
                <h3>{s.title}</h3>
                {#each s.items as it}
                    <p>
                        {#if it.label}<b
                                >{#if it.level != null}<i style="background:{LEVEL_COLORS[it.level]}"></i>{/if}{it.label}</b
                            >{' '}{/if}{it.text}
                    </p>
                {/each}
            </section>
        {/each}

        {#if next.length}
            <section class="wpp-bl__section">
                <h3>{tr('Jours suivants', 'Following days')}</h3>
                <div class="wpp-bl__next">
                    {#each next as n}
                        <button on:click={() => dispatch('day', n.key)} title={tr('Afficher ce jour', 'Show this day')}>
                            <b>{n.label}</b>
                            <span><i style="background:{n.tone}"></i>{n.headline}{n.facts ? ` — ${n.facts}` : ''}</span>
                        </button>
                    {/each}
                </div>
            </section>
        {/if}

        <p class="wpp-bl__note">
            {tr(
                `Bulletin rédigé automatiquement à partir de la prévision ${model}. Il décrit les conditions prévues par le modèle, pas l’aptitude de quiconque à voler : la décision de décoller appartient au pilote. Le modèle lisse le relief : le vent au décollage, les brises de vallée, le foehn et les effets de site ne sont pas décrits. Le bulletin ne remplace ni l’observation sur place ni l’avis des pilotes locaux.`,
                `Bulletin written automatically from the ${model} forecast. It describes the conditions the model forecasts, not anyone’s ability to fly: the decision to take off is the pilot’s. The model smooths out the terrain: wind at take-off, valley breezes, foehn and local effects are not described. The bulletin replaces neither observation on site nor the advice of local pilots.`,
            )}
        </p>
    </div>
{:else}
    <div class="wpp-bl wpp-bl--empty">
        {tr('Pas assez de données pour rédiger le bulletin de ce jour.', 'Not enough data to write this day’s bulletin.')}
    </div>
{/if}

<script context="module" lang="ts">
    import { tr } from './i18n';

    /** Couleur et libellé des conditions d'une heure, des plus calmes aux défavorables */
    export const LEVEL_COLORS = ['#4caf50', '#f5c542', '#f59e0b', '#ef4444'] as const;
    export const LEVEL_LABELS = [
        tr('conditions calmes', 'calm conditions'),
        tr('conditions modérées', 'moderate conditions'),
        tr('conditions fortes', 'strong conditions'),
        tr('conditions défavorables', 'adverse conditions'),
    ] as const;
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    import {
        bulletinOf,
        type CloudDeck,
        type DayBulletin,
        type Front,
        frontsOf,
        type HourRating,
        type Limit,
        type RainEpisode,
        type Sky,
        type SkyPart,
        type Slot,
        type Verdict,
        type WindHalves,
        type WindPart,
    } from './bulletin';
    import { hourShort, hourText, locale } from './i18n';
    import { cardinal, type Column, STORM_COLORS, toCelsius, toKmh } from './physics';

    /** Jours de la prévision (ceux du panneau) et jour affiché */
    export let days: { key: string; label: string; columns: Column[]; outOfRange: boolean }[];
    export let dayIndex: number;
    /** Toutes les heures de la prévision : un front se repère sur plusieurs jours */
    export let columns: Column[];
    export let lat: number;
    export let lon: number;
    /** Nom du modèle */
    export let model: string;
    export let nowTs = 0;

    const dispatch = createEventDispatcher<{ day: string }>();

    const HOUR_MS = 3600e3;
    /** Rafales (km/h) à partir desquelles on les mentionne, et écart de vent (km/h) qui vaut d'être signalé */
    const NOTABLE_GUST = 20;
    const NOTABLE_CHANGE = 10;

    $: fronts = frontsOf(columns, lat);
    $: bulletins = days.map(d => (d.outOfRange ? null : bulletinOf(d.columns, lat, lon, fronts)));
    $: b = bulletins[dayIndex] ?? null;

    // --- Mise en forme
    const round5 = (v: number) => Math.round(v / 5) * 5;
    const r50 = (z: number) => Math.round(z / 50) * 50;
    const r100 = (z: number) => Math.round(z / 100) * 100;
    const kmh = (ms: number) => round5(toKmh(ms));
    const dec = (v: number) => tr(v.toFixed(1).replace('.', ','), v.toFixed(1));
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const hr = (h: number) => (h === 24 ? tr('minuit', 'midnight') : hourText(h % 24));
    const span = (s: { from: number; to: number }) => tr(`de ${hr(s.from)} à ${hr(s.to)}`, `${hr(s.from)}–${hr(s.to)}`);
    const list = (items: string[]) =>
        items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${tr('et', 'and')} ${items[items.length - 1]}`;
    const mm = (v: number) => (v < 1 ? tr('moins de 1 mm', 'under 1 mm') : `${Math.round(v)} mm`);

    const daylightOf = (d: DayBulletin) => d.hours.filter(h => h.daylight);

    /** « de 8h à 11h et de 17h à 19h », ou « toute la journée » quand un créneau couvre les heures de jour */
    const slotsText = (d: DayBulletin, slots: Slot[]) =>
        slots.length === 1 && slots[0].hours === daylightOf(d).length
            ? tr(`toute la journée (${span(slots[0])})`, `all day (${span(slots[0])})`)
            : list(slots.map(span));

    // --- Ce qui limite une heure : nommé sans le juger (ni « trop fort », ni « pour tel pilote »)
    const LIMITS: Record<Limit, string> = {
        storm: tr('orage', 'thunderstorm'),
        wind: tr('vent', 'wind'),
        gust: tr('rafales', 'gusts'),
        rain: tr('pluie', 'rain'),
        thermal: tr('force des thermiques', 'thermal strength'),
        choppy: tr('thermiques hachés par le vent', 'thermals broken up by the wind'),
        overdev: tr('surdéveloppements', 'overdevelopment'),
    };

    const limitText = (d: DayBulletin, limit: Limit | null) => {
        if (!limit) return '';
        if (limit === 'rain' && d.rain?.snow) return tr('neige', 'snow');
        return LIMITS[limit];
    };

    /** Infobulle d'une heure du bandeau : ses conditions et ce qui les impose, chiffré */
    const cellTitle = (h: HourRating) => {
        const c = h.col;
        const why: Record<Limit, string> = {
            storm: h.level === 3 ? tr('orage probable à moins de 2 h', 'thunderstorm likely within 2 h') : tr('orage probable à moins de 4 h', 'thunderstorm likely within 4 h'),
            rain: `${c.snow >= c.precip / 2 ? tr('neige', 'snow') : tr('pluie', 'rain')} ${dec(c.precip)} mm`,
            wind: tr(
                `vent ${kmh(c.windSurf)} km/h au sol, jusqu’à ${kmh(h.lowWind)} km/h dans les 1 000 premiers mètres`,
                `wind ${kmh(c.windSurf)} km/h at the surface, up to ${kmh(h.lowWind)} km/h in the lowest 1,000 m`,
            ),
            gust: tr(`rafales ${kmh(c.gust ?? 0)} km/h`, `gusts ${kmh(c.gust ?? 0)} km/h`),
            thermal: tr(`thermiques +${dec(c.climb)} m/s au vario`, `thermals +${dec(c.climb)} m/s on the vario`),
            choppy: LIMITS.choppy,
            overdev: tr('surdéveloppement possible', 'overdevelopment possible'),
        };
        return `${hourText(c.hour)} — ${LEVEL_LABELS[h.level]}${h.limit ? ` : ${why[h.limit]}` : ''}`;
    };

    // --- Appréciation de la journée
    const TONES: Record<Verdict, string> = {
        adverse: LEVEL_COLORS[3],
        strong: LEVEL_COLORS[2],
        storm: STORM_COLORS[2],
        windows: LEVEL_COLORS[1],
        great: LEVEL_COLORS[0],
        thermal: LEVEL_COLORS[0],
        calm: LEVEL_COLORS[0],
        moderate: LEVEL_COLORS[1],
    };
    const toneOf = (d: DayBulletin) => (d.verdict === 'storm' && d.storm ? STORM_COLORS[d.storm.level] : TONES[d.verdict]);

    const stormTitle = (d: DayBulletin) => {
        if (!d.storm) return '';
        const at = hourText(d.storm.from.hour);
        return d.storm.level === 3
            ? tr(`Orage violent possible dès ${at}`, `Severe thunderstorm possible from ${at}`)
            : d.storm.level === 2
              ? tr(`Orage probable dès ${at}`, `Thunderstorm likely from ${at}`)
              : tr(`Air propice aux orages violents dès ${at}`, `Air primed for severe storms from ${at}`);
    };

    const headline = (d: DayBulletin) => {
        switch (d.verdict) {
            case 'adverse':
                return tr('Conditions défavorables', 'Adverse conditions');
            case 'strong':
                return tr('Conditions fortes', 'Strong conditions');
            case 'storm':
                return stormTitle(d);
            case 'windows':
                return tr('Créneaux calmes à modérés', 'Calm to moderate windows');
            case 'great':
                return tr('Belle journée thermique', 'Great thermal day');
            case 'thermal':
                return tr('Bonne journée thermique', 'Good thermal day');
            case 'calm':
                return tr('Journée calme', 'Calm day');
            default:
                return tr('Conditions modérées', 'Moderate conditions');
        }
    };

    const frontName = (f: Front) => (f.kind === 'cold' ? tr('front froid', 'cold front') : tr('front chaud', 'warm front'));

    /** Une ou deux phrases sous l'appréciation : l'essentiel de la journée */
    const leadOf = (d: DayBulletin) => {
        const t = d.thermals;
        const slots = slotsText(d, d.moderate);
        const strong = limitText(d, d.strongLimit);
        const out: string[] = [];
        switch (d.verdict) {
            case 'adverse':
                if (strong) out.push(tr(`Principale raison : ${strong}.`, `Main reason: ${strong}.`));
                break;
            case 'strong':
                out.push(
                    tr(
                        `Pas de créneau calme ou modéré${strong ? ` : ${strong}` : ''}.`,
                        `No calm or moderate window${strong ? `: ${strong}` : ''}.`,
                    ),
                );
                break;
            case 'storm':
                out.push(
                    tr(
                        `Conditions calmes à modérées ${slots}. Un orage est mal daté : gardez une large marge.`,
                        `Calm to moderate conditions ${slots}. Storm timing is uncertain: keep a wide margin.`,
                    ),
                );
                break;
            case 'windows':
                out.push(tr(`Conditions calmes à modérées ${slots}.`, `Calm to moderate conditions ${slots}.`));
                if (strong) out.push(tr(`Le reste de la journée : ${strong}.`, `The rest of the day: ${strong}.`));
                break;
            case 'great':
            case 'thermal':
                if (t) {
                    out.push(
                        tr(
                            `Thermiques ${span(t)}, jusqu’à +${dec(t.climb)} m/s au vario et ${r50(t.ceiling)} m de plafond.`,
                            `Thermals ${span(t)}, up to +${dec(t.climb)} m/s on the vario and a ${r50(t.ceiling)} m ceiling.`,
                        ),
                    );
                }
                break;
            case 'calm':
                out.push(
                    t
                        ? tr(
                              `Conditions calmes, thermiques faibles (au mieux +${dec(t.climb)} m/s au vario).`,
                              `Calm conditions, weak thermals (+${dec(t.climb)} m/s on the vario at best).`,
                          )
                        : tr('Conditions calmes, pas de thermique exploitable.', 'Calm conditions, no usable thermals.'),
                );
                break;
            default:
                out.push(tr(`Conditions calmes à modérées ${slots}.`, `Calm to moderate conditions ${slots}.`));
        }
        for (const f of d.fronts) {
            out.push(tr(`${cap(frontName(f))} vers ${hr(f.at.hour)}.`, `${cap(frontName(f))} around ${hr(f.at.hour)}.`));
        }
        return out.join(' ');
    };

    // --- Vent
    /** Sous 10 km/h (arrondi à 5), le vent est « faible » et sa direction ne compte pas */
    const light = (w: WindPart) => kmh(w.speed) < 10;
    const windText = (w: WindPart) => (light(w) ? tr('faible', 'light') : `${cardinal(w.dir)} ${kmh(w.speed)} km/h`);
    /** Écart entre deux directions (°), de 0 à 180 */
    const turn = (a: number, b: number) => Math.abs(((b - a + 540) % 360) - 180);

    /** Vent d'une journée : une seule valeur s'il ne change pas, sinon matin puis après-midi */
    const halvesText = (w: WindHalves) => {
        const { am, pm } = w;
        if (!am || !pm) return windText((am ?? pm) as WindPart);
        const a = windText(am);
        const p = windText(pm);
        if (a === p) return a;
        // Même secteur (à 30° près) : la direction n'est donnée qu'une fois
        if (!light(am) && !light(pm) && turn(am.dir, pm.dir) <= 30) {
            const dir = cardinal(pm.dir);
            return kmh(am.speed) === kmh(pm.speed)
                ? `${dir} ${kmh(pm.speed)} km/h`
                : tr(
                      `${dir} ${kmh(am.speed)} km/h le matin, ${kmh(pm.speed)} km/h l’après-midi`,
                      `${dir} ${kmh(am.speed)} km/h in the morning, ${kmh(pm.speed)} km/h in the afternoon`,
                  );
        }
        return tr(`${a} le matin, ${p} l’après-midi`, `${a} in the morning, ${p} in the afternoon`);
    };

    // --- Ciel
    const SKY: Record<Sky, string> = {
        clear: tr('ciel dégagé', 'clear sky'),
        partly: tr('peu nuageux', 'partly cloudy'),
        cloudy: tr('nuageux', 'cloudy'),
        overcast: tr('couvert', 'overcast'),
        veil: tr('voilé par des nuages élevés', 'veiled by high cloud'),
    };
    const DECKS: Record<CloudDeck, string> = {
        low: tr('bas', 'low'),
        mid: tr('moyens', 'mid-level'),
        high: tr('élevés', 'high'),
    };
    /** « nuages bas et moyens » */
    const decksText = (decks: CloudDeck[]) => {
        const names = list(decks.map(k => DECKS[k]));
        return tr(`nuages ${names}`, `${names} cloud`);
    };
    /** Écart de couverture (0–1) entre le matin et l'après-midi qui vaut d'être dit */
    const SKY_TREND = 0.3;

    /** Ciel d'une demi-journée : son état, puis les étages de nuages et l'altitude des plus bas */
    const partText = (p: SkyPart) => {
        if (p.sky === 'clear' || p.sky === 'veil' || !p.decks.length) return SKY[p.sky];
        const base =
            p.base != null && p.decks[0] !== 'high'
                ? tr(`, les plus bas vers ${r100(p.base)} m`, `, the lowest around ${r100(p.base)} m`)
                : '';
        return `${SKY[p.sky]} (${decksText(p.decks)}${base})`;
    };

    const skyText = (d: DayBulletin) => {
        const { am, pm } = d.sky;
        const out: string[] = [];
        if (!am || !pm) {
            out.push(`${partText((am ?? pm) as SkyPart)}.`);
        } else if (partText(am) === partText(pm)) {
            out.push(tr(`${partText(am)} toute la journée.`, `${partText(am)} all day.`));
        } else {
            out.push(
                tr(
                    `${partText(am)} le matin, ${partText(pm)} l’après-midi.`,
                    `${partText(am)} in the morning, ${partText(pm)} in the afternoon.`,
                ),
            );
            if (pm.cover - am.cover >= SKY_TREND) {
                out.push(tr('Le ciel se charge au fil de la journée.', 'The sky clouds over through the day.'));
            } else if (am.cover - pm.cover >= SKY_TREND) {
                out.push(tr('Le ciel se dégage au fil de la journée.', 'The sky clears through the day.'));
            }
        }
        if (d.fog) {
            out.push(tr('Brume ou brouillard possible en début de matinée.', 'Mist or fog possible early in the morning.'));
        }
        return out.join(' ');
    };

    /** Épaisseur (m) à partir de laquelle des cumulus peuvent s'étaler ou donner des averses */
    const THICK_CUMULUS = 2000;

    const cumulusText = (d: DayBulletin) => {
        const cu = d.cumulus;
        if (!cu) {
            // « Thermiques bleus » seulement sous un ciel qui le montre
            const open = [d.sky.am, d.sky.pm].every(p => !p || p.sky === 'clear' || p.sky === 'partly' || p.sky === 'veil');
            return open
                ? tr('aucun, les thermiques s’arrêtent avant de condenser (thermiques bleus).', 'none, thermals stop before condensing (blue thermals).')
                : tr('aucun, les thermiques s’arrêtent avant de condenser.', 'none, thermals stop before condensing.');
        }
        const base =
            r50(cu.baseMin) === r50(cu.baseMax)
                ? tr(`base vers ${r50(cu.baseMin)} m`, `base around ${r50(cu.baseMin)} m`)
                : tr(`base de ${r50(cu.baseMin)} à ${r50(cu.baseMax)} m`, `base from ${r50(cu.baseMin)} to ${r50(cu.baseMax)} m`);
        const top = `${r50(cu.top)} m${cu.capped ? tr(' ou plus', ' or higher') : ''}`;
        if (cu.depth < THICK_CUMULUS) {
            return tr(
                `${span(cu)}, ${base}, sommets vers ${top} (${r100(cu.depth)} m d’épaisseur au plus).`,
                `${span(cu)}, ${base}, tops around ${top} (${r100(cu.depth)} m deep at most).`,
            );
        }
        // Le sommet est celui que l'instabilité permet : le modèle ne développe pas toujours ces nuages
        return d.overdevFrom != null || d.storm
            ? tr(
                  `${span(cu)}, ${base}, sommets jusqu’à ${top} : épais de ${r100(cu.depth)} m, ils peuvent s’étaler et donner des averses.`,
                  `${span(cu)}, ${base}, tops up to ${top}: ${r100(cu.depth)} m deep, they can spread out and give showers.`,
              )
            : tr(
                  `${span(cu)}, ${base}. L’air instable leur permettrait de monter jusqu’à ${top}, mais le modèle ne prévoit ni nuages épais ni averses.`,
                  `${span(cu)}, ${base}. The unstable air would let them grow up to ${top}, but the model forecasts neither deep cloud nor showers.`,
              );
    };

    // Précipitations : nature et intensité (heure la plus arrosée : moins de 1 mm/h, moins de 4 mm/h, au-delà)
    const PRECIP = {
        rain: [tr('pluie faible', 'light rain'), tr('pluie modérée', 'moderate rain'), tr('forte pluie', 'heavy rain')],
        showers: [tr('averses faibles', 'light showers'), tr('averses modérées', 'moderate showers'), tr('fortes averses', 'heavy showers')],
        snow: [tr('neige faible', 'light snow'), tr('neige modérée', 'moderate snow'), tr('forte neige', 'heavy snow')],
    };
    const precipName = (e: RainEpisode) => PRECIP[e.snow ? 'snow' : e.showers ? 'showers' : 'rain'][e.peak < 1 ? 0 : e.peak < 4 ? 1 : 2];

    const episodeText = (e: RainEpisode) => {
        // Heure la plus arrosée : citée pour un épisode d'au moins 3 h qui n'est pas faible
        const peak =
            e.hours >= 3 && e.peak >= 1 ? tr(`, au plus fort vers ${hr(e.peakHour)}`, `, heaviest around ${hr(e.peakHour)}`) : '';
        return `${precipName(e)} ${span(e)} (${mm(e.total)}${peak})`;
    };

    /** Au-delà de la hauteur (m au-dessus du sol) où la limite pluie-neige concerne encore le vol */
    const SNOW_LINE_REACH = 2500;

    const rainText = (d: DayBulletin) => {
        const r = d.rain;
        const out: string[] = [];
        if (!r) {
            out.push(tr('aucune.', 'none.'));
        } else if (r.episodes.length <= 3) {
            out.push(`${list(r.episodes.map(episodeText))}.`);
            if (r.episodes.length > 1) out.push(tr(`Cumul de la journée : ${mm(r.total)}.`, `Total for the day: ${mm(r.total)}.`));
        } else {
            out.push(
                tr(
                    `${precipName(r)} par moments entre ${hr(r.from)} et ${hr(r.to)} (${mm(r.total)} au total).`,
                    `${precipName(r)} at times between ${hr(r.from)} and ${hr(r.to)} (${mm(r.total)} in total).`,
                ),
            );
        }
        if (r && !r.snow && r.snowLine != null && r.snowLine <= d.hours[0].col.ground + SNOW_LINE_REACH) {
            out.push(tr(`Limite pluie-neige vers ${r100(r.snowLine)} m.`, `Snow line around ${r100(r.snowLine)} m.`));
        }
        if (d.wetGround != null) {
            out.push(
                tr(
                    `Sol mouillé au lever du jour (${mm(d.wetGround)} dans les 24 h précédentes) : il chauffe moins l’air et les thermiques tardent.`,
                    `Wet ground at sunrise (${mm(d.wetGround)} in the previous 24 h): it heats the air less and thermals start later.`,
                ),
            );
        }
        return out.join(' ');
    };

    /** Écart (m) de l'isotherme 0 °C entre le matin et l'après-midi qui vaut d'être dit */
    const FREEZING_CHANGE = 300;

    const tempText = (d: DayBulletin) => {
        const out = [
            tr(
                `de ${Math.round(toCelsius(d.tMin))} à ${Math.round(toCelsius(d.tMax))} °C au sol.`,
                `${Math.round(toCelsius(d.tMin))} to ${Math.round(toCelsius(d.tMax))} °C at the surface.`,
            ),
        ];
        const { freezingAm: am, freezing: pm } = d;
        if (am != null && pm != null && Math.abs(pm - am) >= FREEZING_CHANGE) {
            out.push(
                tr(
                    `Isotherme 0 °C de ${r100(am)} m le matin à ${r100(pm)} m l’après-midi.`,
                    `Freezing level from ${r100(am)} m in the morning to ${r100(pm)} m in the afternoon.`,
                ),
            );
        } else if ((pm ?? am) != null) {
            out.push(tr(`Isotherme 0 °C vers ${r100((pm ?? am) as number)} m.`, `Freezing level around ${r100((pm ?? am) as number)} m.`));
        }
        return out.join(' ');
    };

    // --- Fronts
    const frontText = (f: Front) => {
        const at = hr(f.at.hour);
        const deg = dec(Math.abs(f.tempChange));
        const parts: string[] = [];
        const { before, after } = f;
        if (before && after) {
            const z = r50(f.windZ);
            if (f.turns) {
                parts.push(
                    tr(
                        `le vent tourne du ${cardinal(before.dir)} au ${cardinal(after.dir)} vers ${z} m (${kmh(before.speed)} puis ${kmh(after.speed)} km/h)`,
                        `the wind swings from ${cardinal(before.dir)} to ${cardinal(after.dir)} around ${z} m (${kmh(before.speed)} then ${kmh(after.speed)} km/h)`,
                    ),
                );
            } else if (Math.abs(kmh(after.speed) - kmh(before.speed)) >= NOTABLE_CHANGE) {
                parts.push(
                    tr(
                        `le vent passe de ${kmh(before.speed)} à ${kmh(after.speed)} km/h vers ${z} m`,
                        `the wind goes from ${kmh(before.speed)} to ${kmh(after.speed)} km/h around ${z} m`,
                    ),
                );
            }
        }
        parts.push(f.rain >= 1 ? tr(`${mm(f.rain)} de pluie`, `${mm(f.rain)} of rain`) : tr('peu ou pas de pluie', 'little or no rain'));
        if (f.gust != null && toKmh(f.gust) >= 40) {
            parts.push(tr(`rafales jusqu’à ${kmh(f.gust)} km/h`, `gusts up to ${kmh(f.gust)} km/h`));
        }
        return f.kind === 'cold'
            ? tr(
                  `Vers ${at}, l’air se refroidit de ${deg} °C en 6 h en altitude : ${list(parts)}. À son approche, le vent se renforce et peut tourner brutalement ; derrière, l’air est plus froid, instable et souvent venté.`,
                  `Around ${at}, the air aloft cools by ${deg} °C in 6 h: ${list(parts)}. As it approaches, the wind picks up and can swing abruptly; behind it, the air is colder, unstable and often windy.`,
              )
            : tr(
                  `Vers ${at}, l’air se réchauffe de ${deg} °C en 6 h en altitude : ${list(parts)}. Le plafond nuageux s’abaisse à son approche et la pluie dure ; l’air qui suit est plus stable.`,
                  `Around ${at}, the air aloft warms by ${deg} °C in 6 h: ${list(parts)}. The cloud base lowers as it approaches and the rain lasts; the air behind is more stable.`,
              );
    };

    // --- Rubriques
    interface Item {
        label?: string;
        level?: number;
        text: string;
    }

    const windowsOf = (d: DayBulletin): Item[] => {
        const n = daylightOf(d).length;
        const allDay = (slots: Slot[]) => slots.reduce((s, x) => s + x.hours, 0) >= n;
        /** Créneaux d'un niveau de conditions, et ce qui limite le reste de la journée */
        const text = (slots: Slot[], limit: Limit | null) => {
            const why = limitText(d, limit);
            if (!slots.length) return tr(`aucun créneau${why ? ` (${why})` : ''}.`, `no window${why ? ` (${why})` : ''}.`);
            const rest = !allDay(slots) && why ? tr(` En dehors : ${why}.`, ` Outside these hours: ${why}.`) : '';
            return `${slotsText(d, slots)}.${rest}`;
        };
        const t = d.thermals;
        return [
            { label: tr('Conditions calmes :', 'Calm conditions:'), level: 0, text: text(d.calm, d.calmLimit) },
            { label: tr('Calmes à modérées :', 'Calm to moderate:'), level: 1, text: text(d.moderate, d.strongLimit) },
            {
                label: tr('Thermiques exploitables :', 'Usable thermals:'),
                text: !t
                    ? tr('aucun.', 'none.')
                    : t.easy
                      ? tr(`${span(t)}, faciles ${span(t.easy)}.`, `${span(t)}, easy ${span(t.easy)}.`)
                      : tr(`${span(t)}, sans créneau de thermiques faciles.`, `${span(t)}, with no window of easy thermals.`),
            },
        ];
    };

    const windOf = (d: DayBulletin): Item[] => {
        const w = d.wind;
        const gust =
            w.gust && toKmh(w.gust.speed) >= NOTABLE_GUST
                ? tr(
                      ` Rafales jusqu’à ${kmh(w.gust.speed)} km/h (vers ${hourText(w.gust.hour)}).`,
                      ` Gusts up to ${kmh(w.gust.speed)} km/h (around ${hourText(w.gust.hour)}).`,
                  )
                : '';
        return [
            { label: tr('Au sol :', 'Surface:'), text: `${halvesText(w.surface)}.${gust}` },
            ...w.levels.map(l => ({ label: tr(`À ${l.z} m :`, `At ${l.z} m:`), text: `${halvesText(l)}.` })),
        ];
    };

    const thermalsOf = (d: DayBulletin): Item[] => {
        const t = d.thermals;
        if (!t) return [{ text: tr('Pas de thermique exploitable.', 'No usable thermals.') }];
        const out = [
            tr(
                `${cap(span(t))}, au mieux vers ${hourText(t.bestHour)} : +${dec(t.climb)} m/s au vario, plafond ${r50(t.ceiling)} m (${r50(t.depth)} m au-dessus du sol).`,
                `${cap(span(t))}, best around ${hourText(t.bestHour)}: +${dec(t.climb)} m/s on the vario, ceiling ${r50(t.ceiling)} m (${r50(t.depth)} m above the ground).`,
            ),
        ];
        const chopped = t.ease.choppy + t.ease.rough;
        if (chopped >= t.hours / 2) {
            out.push(tr('Hachés par le vent une bonne partie de la journée.', 'Broken up by the wind for much of the day.'));
        } else if (chopped) {
            out.push(tr('Hachés par le vent par moments.', 'Broken up by the wind at times.'));
        } else if (!t.easy) {
            out.push(tr('Faibles ou plafond bas : difficiles à tenir.', 'Weak or low ceiling: hard to stay in.'));
        }
        if (d.overdevFrom != null) {
            out.push(
                tr(
                    `Surdéveloppements possibles dès ${hourText(d.overdevFrom)}.`,
                    `Overdevelopment possible from ${hourText(d.overdevFrom)}.`,
                ),
            );
        }
        return [{ text: out.join(' ') }];
    };

    const skyOf = (d: DayBulletin): Item[] => [
        { label: tr('Ciel :', 'Sky:'), text: skyText(d) },
        ...(d.thermals ? [{ label: tr('Cumulus :', 'Cumulus:'), text: cumulusText(d) }] : []),
        { label: tr('Précipitations :', 'Precipitation:'), text: rainText(d) },
        { label: tr('Températures :', 'Temperatures:'), text: tempText(d) },
    ];

    const frontsItems = (d: DayBulletin): Item[] => {
        const items: Item[] = d.fronts.map(f => ({ label: `${cap(frontName(f))}.`, text: frontText(f) }));
        if (d.frontBefore) {
            items.push({
                text: tr(
                    `Un front froid est passé la veille vers ${hr(d.frontBefore.at.hour)} : air plus froid et instable, averses et vent possibles derrière lui.`,
                    `A cold front went through the day before around ${hr(d.frontBefore.at.hour)}: colder, unstable air, with showers and wind possible behind it.`,
                ),
            });
        }
        const after = d.frontAfter;
        if (after) {
            items.push({
                text:
                    after.kind === 'cold'
                        ? tr(
                              `Un front froid arrive la nuit suivante (vers ${hr(after.at.hour)}) : le vent peut se renforcer dès la fin de journée.`,
                              `A cold front arrives the following night (around ${hr(after.at.hour)}): the wind may pick up from late in the day.`,
                          )
                        : tr(
                              `Un front chaud arrive la nuit suivante (vers ${hr(after.at.hour)}) : le ciel se couvre en fin de journée.`,
                              `A warm front arrives the following night (around ${hr(after.at.hour)}): the sky clouds over late in the day.`,
                          ),
            });
        }
        return items;
    };

    const stormItems = (d: DayBulletin): Item[] =>
        d.storm
            ? [
                  {
                      text: tr(
                          `${stormTitle(d)}. L’heure et le lieu d’un orage sont mal prévus : le bulletin tient pour défavorables les 2 h qui le précèdent et qui le suivent, et ne compte plus comme calmes les heures à moins de 4 h.`,
                          `${stormTitle(d)}. Storm timing and location are poorly forecast: the bulletin treats the 2 h before and after it as adverse, and no longer counts hours within 4 h as calm.`,
                      ),
                  },
              ]
            : [];

    const sectionsOf = (d: DayBulletin) =>
        [
            { title: tr('Créneaux', 'Windows'), items: windowsOf(d) },
            { title: tr('Fronts', 'Fronts'), items: frontsItems(d) },
            { title: tr('Orage', 'Thunderstorm'), items: stormItems(d) },
            { title: tr('Vent', 'Wind'), items: windOf(d) },
            { title: tr('Thermiques', 'Thermals'), items: thermalsOf(d) },
            { title: tr('Ciel et précipitations', 'Sky and precipitation'), items: skyOf(d) },
        ].filter(s => s.items.length);

    $: sections = b ? sectionsOf(b) : [];

    // --- Titre : jour affiché, en toutes lettres
    $: title = (() => {
        const c = days[dayIndex]?.columns[0];
        if (!c) return '';
        const date = new Date(c.ts + c.utcOffset * HOUR_MS).toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
        });
        return tr(`Bulletin du ${date}`, `Bulletin for ${date}`);
    })();

    // --- Bandeau des heures de jour et repère « maintenant »
    $: strip = b ? daylightOf(b) : [];
    $: nowAt = (() => {
        if (!strip.length) return null;
        const t0 = strip[0].col.ts;
        const t1 = strip[strip.length - 1].col.ts + HOUR_MS;
        return nowTs > t0 && nowTs < t1 ? (nowTs - t0) / (t1 - t0) : null;
    })();

    // --- Jours suivants : appréciation et un ou deux faits
    const factsOf = (d: DayBulletin) => {
        const out = d.fronts.map(f => tr(`${frontName(f)} vers ${hr(f.at.hour)}`, `${frontName(f)} around ${hr(f.at.hour)}`));
        const t = d.thermals;
        if (d.verdict === 'windows') {
            out.push(slotsText(d, d.moderate));
        } else if (d.verdict === 'storm') {
            out.push(tr(`calme à modéré ${slotsText(d, d.moderate)}`, `calm to moderate ${slotsText(d, d.moderate)}`));
        } else if (d.verdict === 'adverse' || d.verdict === 'strong') {
            if (d.strongLimit) out.push(limitText(d, d.strongLimit));
        } else if (t) {
            out.push(tr(`+${dec(t.climb)} m/s, plafond ${r50(t.ceiling)} m`, `+${dec(t.climb)} m/s, ceiling ${r50(t.ceiling)} m`));
        }
        return out.join(', ');
    };

    $: next = days
        .map((d, i) => ({ d, bulletin: bulletins[i], i }))
        .filter((x): x is { d: (typeof days)[number]; bulletin: DayBulletin; i: number } => x.i > dayIndex && !!x.bulletin)
        .map(({ d, bulletin }) => ({
            key: d.key,
            label: d.label,
            tone: toneOf(bulletin),
            headline: headline(bulletin),
            facts: factsOf(bulletin),
        }));
</script>

<style lang="less">
    .wpp-bl {
        font-size: 12.5px;
        line-height: 1.5;
        color: var(--wpp-fg-dim);

        &--empty {
            padding: 60px 0;
            text-align: center;
            opacity: 0.8;
        }
        // Appréciation de la journée, bordée de sa couleur
        &__head {
            margin-bottom: 12px;
            padding: 8px 12px;
            border: 1px solid var(--wpp-border);
            border-left: 4px solid var(--wpp-bl-tone);
            border-radius: 8px;
            background: var(--wpp-surface);
        }
        &__date {
            font-size: 11px;
            color: var(--wpp-fg-faint);
        }
        &__verdict {
            font-size: 16px;
            font-weight: bold;
            line-height: 1.3;
            color: var(--wpp-fg);
        }
        &__lead {
            margin: 3px 0 0;
        }
        // Bandeau : une case par heure de jour, à la couleur de son niveau
        &__strip {
            position: relative;
            display: flex;
            gap: 2px;
        }
        &__cell {
            flex: 1 1 0;
            height: 14px;
            border-radius: 3px;

            &.past {
                opacity: 0.4;
            }
        }
        &__now {
            position: absolute;
            top: -3px;
            bottom: -3px;
            width: 2px;
            margin-left: -1px;
            border-radius: 1px;
            background: #ff5a5a;
            pointer-events: none;
        }
        &__hours {
            display: flex;
            gap: 2px;
            margin-top: 2px;
            font-size: 10.5px;
            color: var(--wpp-fg-faint);

            span {
                flex: 1 1 0;
                min-width: 0;
                text-align: center;
                white-space: nowrap;
            }
        }
        &__levels {
            display: flex;
            flex-wrap: wrap;
            gap: 2px 12px;
            margin: 4px 0 2px;
            font-size: 11px;
        }
        i {
            display: inline-block;
            width: 9px;
            height: 9px;
            margin-right: 5px;
            border-radius: 2px;
        }
        &__section {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid var(--wpp-border);

            h3 {
                margin: 0 0 3px;
                font-size: 13px;
                font-weight: bold;
                color: var(--wpp-fg);
            }
            p {
                margin: 2px 0;
            }
            b {
                color: var(--wpp-fg);
                font-weight: 600;
            }
        }
        // Jours suivants : une ligne par jour, cliquable
        &__next {
            display: flex;
            flex-direction: column;
            gap: 2px;

            button {
                display: flex;
                align-items: baseline;
                gap: 8px;
                padding: 3px 6px;
                border: none;
                border-radius: 6px;
                background: none;
                color: inherit;
                font: inherit;
                text-align: left;
                cursor: pointer;

                &:hover {
                    background: var(--wpp-surface-hover);
                }
            }
            b {
                flex: none;
                min-width: 46px;
            }
        }
        &__note {
            margin: 14px 0 0;
            font-size: 11px;
            color: var(--wpp-fg-faint);
        }
    }
</style>
