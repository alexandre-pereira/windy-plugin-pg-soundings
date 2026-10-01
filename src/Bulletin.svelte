<!--
    Bulletin météo de la journée affichée : un seul texte suivi, rédigé à partir de la prévision du
    modèle, tourné vers le vol libre (ciel et précipitations, fronts et orage, vent au sol et en
    altitude, thermiques, cumulus et températures). L'onglet ne montre rien d'autre que ce texte.

    Le bulletin décrit le temps prévu. Il n'évalue pas les conditions de vol : ni niveau de
    conditions, ni créneau, ni appréciation de la journée, ni couleur, ni niveau de pilotage.
-->
{#if b}
    <div class="wpp-bl">
        {#each paragraphs as p}
            <p>{p}</p>
        {/each}
    </div>
{:else}
    <div class="wpp-bl wpp-bl--empty">
        {tr('Pas assez de données pour rédiger le bulletin de ce jour.', 'Not enough data to write this day’s bulletin.')}
    </div>
{/if}

<script lang="ts">
    import {
        bulletinOf,
        type CloudDeck,
        type CumulusSummary,
        type DayBulletin,
        type Front,
        frontsOf,
        type RainEpisode,
        type Sky,
        type SkyPart,
        type WindHalves,
        type WindPart,
    } from './bulletin';
    import { hourText, lang, locale, tr } from './i18n';
    import { type Column, toCelsius, toKmh } from './physics';

    /** Jours de la prévision (ceux du panneau) et jour affiché */
    export let days: { key: string; label: string; columns: Column[]; outOfRange: boolean }[];
    export let dayIndex: number;
    /** Toutes les heures de la prévision : un front se repère sur plusieurs jours */
    export let columns: Column[];
    export let lat: number;
    export let lon: number;

    const HOUR_MS = 3600e3;
    /** Rafales (km/h) à partir desquelles on les mentionne, et écart de vent (km/h) qui vaut d'être signalé */
    const NOTABLE_GUST = 20;
    const NOTABLE_CHANGE = 10;

    $: fronts = frontsOf(columns, lat);
    $: day = days[dayIndex];
    $: b = day && !day.outOfRange ? bulletinOf(day.columns, lat, lon, fronts) : null;

    // --- Mise en forme
    const round5 = (v: number) => Math.round(v / 5) * 5;
    const r50 = (z: number) => Math.round(z / 50) * 50;
    const r100 = (z: number) => Math.round(z / 100) * 100;
    const kmh = (ms: number) => round5(toKmh(ms));
    const dec = (v: number) => tr(v.toFixed(1).replace('.', ','), v.toFixed(1));
    const hr = (h: number) => (h === 24 ? tr('minuit', 'midnight') : hourText(h % 24));
    const span = (s: { from: number; to: number }) => tr(`de ${hr(s.from)} à ${hr(s.to)}`, `from ${hr(s.from)} to ${hr(s.to)}`);
    const list = (items: string[]) =>
        items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${tr('et', 'and')} ${items[items.length - 1]}`;
    /** « A, puis B » : ce qui se suit dans la journée */
    const then = (items: string[]) =>
        items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')}${tr(', puis ', ', then ')}${items[items.length - 1]}`;
    const mm = (v: number) => (v < 1 ? tr('moins de 1 mm', 'under 1 mm') : `${Math.round(v)} mm`);

    // --- Vent : secteur en toutes lettres, sur huit directions
    const SECTORS =
        lang === 'fr'
            ? ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest']
            : ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
    const sector = (dir: number) => SECTORS[Math.round((((dir % 360) + 360) % 360) / 45) % 8];
    /** Le nom du secteur commence par une voyelle : « d’est », « de l’ouest », « à l’est » */
    const vowel = (s: string) => /^[eo]/.test(s);
    /** « de sud-ouest », « d’est » : d'où souffle le vent */
    const fromSector = (dir: number) => {
        const s = sector(dir);
        return tr(vowel(s) ? `d’${s}` : `de ${s}`, `from the ${s}`);
    };
    /** « du sud-ouest à l’ouest » : rotation du vent */
    const swing = (a: number, b: number) => {
        const [s, e] = [sector(a), sector(b)];
        return tr(`${vowel(s) ? `de l’${s}` : `du ${s}`} ${vowel(e) ? `à l’${e}` : `au ${e}`}`, `from the ${s} to the ${e}`);
    };

    /** Sous 10 km/h (arrondi à 5), le vent est « faible » et sa direction ne compte pas */
    const light = (w: WindPart) => kmh(w.speed) < 10;
    const blows = (w: WindPart) =>
        tr(`souffle ${fromSector(w.dir)} à ${kmh(w.speed)} km/h`, `blows ${fromSector(w.dir)} at ${kmh(w.speed)} km/h`);

    /** Vent d'une journée en une proposition de sujet `s` (« le vent », « il ») : une seule valeur s'il ne change pas, sinon matin puis après-midi */
    const windClause = (s: string, w: WindHalves) => {
        const { am, pm } = w;
        if (!am || !pm) {
            const one = (am ?? pm) as WindPart;
            return `${s} ${light(one) ? tr('est faible', 'is light') : blows(one)}`;
        }
        if (light(am) && light(pm)) return `${s} ${tr('reste faible', 'stays light')}`;
        if (light(am)) {
            return tr(`${s} est faible le matin, puis ${blows(pm)} l’après-midi`, `${s} is light in the morning, then ${blows(pm)} in the afternoon`);
        }
        if (light(pm)) {
            return tr(`${s} ${blows(am)} le matin, puis faiblit l’après-midi`, `${s} ${blows(am)} in the morning, then drops off in the afternoon`);
        }
        // Même secteur : la direction n'est donnée qu'une fois
        if (sector(am.dir) === sector(pm.dir)) {
            return kmh(am.speed) === kmh(pm.speed)
                ? `${s} ${blows(pm)}`
                : tr(
                      `${s} souffle ${fromSector(pm.dir)}, à ${kmh(am.speed)} km/h le matin puis ${kmh(pm.speed)} km/h l’après-midi`,
                      `${s} blows ${fromSector(pm.dir)}, at ${kmh(am.speed)} km/h in the morning then ${kmh(pm.speed)} km/h in the afternoon`,
                  );
        }
        return tr(
            `${s} ${blows(am)} le matin, puis ${fromSector(pm.dir)} à ${kmh(pm.speed)} km/h l’après-midi`,
            `${s} ${blows(am)} in the morning, then ${fromSector(pm.dir)} at ${kmh(pm.speed)} km/h in the afternoon`,
        );
    };

    /** Vent au sol et rafales, puis vent aux deux altitudes */
    const windText = (d: DayBulletin) => {
        const w = d.wind;
        const out = [tr(`Au sol, ${windClause('le vent', w.surface)}.`, `At the surface, ${windClause('the wind', w.surface)}.`)];
        if (w.gust && toKmh(w.gust.speed) >= NOTABLE_GUST) {
            out.push(
                tr(
                    `Les rafales atteignent ${kmh(w.gust.speed)} km/h vers ${hourText(w.gust.hour)}.`,
                    `Gusts reach ${kmh(w.gust.speed)} km/h around ${hourText(w.gust.hour)}.`,
                ),
            );
        }
        const clauses = w.levels.map(l => windClause(tr('il', 'it'), l));
        if (clauses.length === 2 && clauses[0] === clauses[1]) {
            const [lo, hi] = w.levels;
            out.push(tr(`À ${lo.z} m comme à ${hi.z} m, ${clauses[0]}.`, `At ${lo.z} m as at ${hi.z} m, ${clauses[0]}.`));
        } else {
            w.levels.forEach((l, k) => out.push(tr(`À ${l.z} m, ${clauses[k]}.`, `At ${l.z} m, ${clauses[k]}.`)));
        }
        return out.join(' ');
    };

    // --- Ciel
    const SKY: Record<Sky, string> = {
        clear: tr('dégagé', 'clear'),
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
    /** Écart de couverture (0–1) entre le matin et l'après-midi à partir duquel le ciel « se charge » ou « se dégage » */
    const SKY_TREND = 0.3;

    /** « des nuages bas et moyens (les plus bas vers 700 m) » ; rien par ciel dégagé ou voilé */
    const decksOf = (p: SkyPart) => {
        if (p.sky === 'clear' || p.sky === 'veil' || !p.decks.length) return '';
        const names = list(p.decks.map(k => DECKS[k]));
        const base =
            p.base != null && p.decks[0] !== 'high'
                ? tr(` (les plus bas vers ${r100(p.base)} m)`, ` (the lowest around ${r100(p.base)} m)`)
                : '';
        return tr(`des nuages ${names}${base}`, `${names} cloud${base}`);
    };
    const withDecks = (p: SkyPart) => (decksOf(p) ? tr(`, avec ${decksOf(p)}`, `, with ${decksOf(p)}`) : '');

    /** Ciel de la journée, en une phrase qui commence par `intro` (« Ce dimanche 27 septembre, ») */
    const skyText = (d: DayBulletin, intro: string) => {
        const { am, pm } = d.sky;
        if (!am || !pm) {
            const one = (am ?? pm) as SkyPart;
            return tr(`${intro}le ciel est ${SKY[one.sky]}${withDecks(one)}.`, `${intro}the sky is ${SKY[one.sky]}${withDecks(one)}.`);
        }
        if (am.sky === pm.sky) {
            const [a, p] = [decksOf(am), decksOf(pm)];
            const decks =
                a === p || !a || !p
                    ? withDecks(am)
                    : tr(`, avec ${a} le matin, puis ${p} l’après-midi`, `, with ${a} in the morning, then ${p} in the afternoon`);
            return tr(
                `${intro}le ciel reste ${SKY[am.sky]} toute la journée${decks}.`,
                `${intro}the sky stays ${SKY[am.sky]} all day${decks}.`,
            );
        }
        // Le ciel change : dit par un verbe quand la couverture varie nettement
        const P = SKY[pm.sky];
        let after = tr(`${P} l’après-midi`, `${P} in the afternoon`);
        if (pm.sky !== 'veil' && pm.cover - am.cover >= SKY_TREND) {
            after = tr(`se charge et devient ${P} l’après-midi`, `clouds over and becomes ${P} in the afternoon`);
        } else if (pm.sky === 'clear' && am.cover - pm.cover >= SKY_TREND) {
            after = tr('se dégage l’après-midi', 'clears in the afternoon');
        } else if (pm.sky !== 'veil' && am.cover - pm.cover >= SKY_TREND) {
            after = tr(`se dégage et devient ${P} l’après-midi`, `clears and becomes ${P} in the afternoon`);
        }
        return tr(
            `${intro}le ciel est ${SKY[am.sky]} le matin${withDecks(am)}, puis ${after}${withDecks(pm)}.`,
            `${intro}the sky is ${SKY[am.sky]} in the morning${withDecks(am)}, then ${after}${withDecks(pm)}.`,
        );
    };

    // --- Précipitations : nature et intensité (heure la plus arrosée : moins de 1 mm/h, moins de 4 mm/h, au-delà)
    const PRECIP = {
        rain: [tr('une pluie faible', 'light rain'), tr('une pluie modérée', 'moderate rain'), tr('une forte pluie', 'heavy rain')],
        showers: [tr('des averses faibles', 'light showers'), tr('des averses modérées', 'moderate showers'), tr('de fortes averses', 'heavy showers')],
        snow: [tr('une neige faible', 'light snow'), tr('une neige modérée', 'moderate snow'), tr('de fortes chutes de neige', 'heavy snow')],
    };
    const precipName = (e: RainEpisode) => PRECIP[e.snow ? 'snow' : e.showers ? 'showers' : 'rain'][e.peak < 1 ? 0 : e.peak < 4 ? 1 : 2];

    const episodeText = (e: RainEpisode) => {
        // Heure la plus arrosée : citée pour un épisode d'au moins 3 h qui n'est pas faible
        const peak =
            e.hours >= 3 && e.peak >= 1 ? tr(`, au plus fort vers ${hr(e.peakHour)}`, `, heaviest around ${hr(e.peakHour)}`) : '';
        return `${precipName(e)} ${span(e)} (${mm(e.total)}${peak})`;
    };

    /** Au-delà de la hauteur (m au-dessus du sol) où la limite pluie-neige n'est plus citée */
    const SNOW_LINE_REACH = 2500;

    const rainText = (d: DayBulletin) => {
        const r = d.rain;
        const out: string[] = [];
        if (!r) {
            out.push(tr('Aucune précipitation n’est prévue.', 'No precipitation is forecast.'));
        } else if (r.episodes.length <= 3) {
            const total = r.episodes.length > 1 ? tr(`, soit ${mm(r.total)} sur la journée`, `, ${mm(r.total)} in total over the day`) : '';
            out.push(tr(`On attend ${then(r.episodes.map(episodeText))}${total}.`, `Expect ${then(r.episodes.map(episodeText))}${total}.`));
        } else {
            out.push(
                tr(
                    `On attend ${precipName(r)} par moments entre ${hr(r.from)} et ${hr(r.to)} (${mm(r.total)}).`,
                    `Expect ${precipName(r)} at times between ${hr(r.from)} and ${hr(r.to)} (${mm(r.total)}).`,
                ),
            );
        }
        if (r && !r.snow && r.snowLine != null && r.snowLine <= d.ground + SNOW_LINE_REACH) {
            out.push(tr(`La limite pluie-neige se situe vers ${r100(r.snowLine)} m.`, `The snow line sits around ${r100(r.snowLine)} m.`));
        }
        if (d.wetGround != null) {
            out.push(
                tr(
                    `Le sol est mouillé au lever du jour (${mm(d.wetGround)} tombés dans les 24 h précédentes).`,
                    `The ground is wet at sunrise (${mm(d.wetGround)} fell in the previous 24 h).`,
                ),
            );
        }
        return out.join(' ');
    };

    // --- Fronts
    const frontText = (f: Front) => {
        const at = hr(f.at.hour);
        const deg = dec(Math.abs(f.tempChange));
        const { before, after } = f;
        let wind = '';
        if (before && after) {
            const z = r50(f.windZ);
            if (f.turns && sector(before.dir) !== sector(after.dir)) {
                wind = tr(
                    ` et le vent tourne ${swing(before.dir, after.dir)} vers ${z} m (${kmh(before.speed)} puis ${kmh(after.speed)} km/h)`,
                    ` and the wind swings ${swing(before.dir, after.dir)} around ${z} m (${kmh(before.speed)} then ${kmh(after.speed)} km/h)`,
                );
            } else if (Math.abs(kmh(after.speed) - kmh(before.speed)) >= NOTABLE_CHANGE) {
                wind = tr(
                    ` et le vent passe de ${kmh(before.speed)} à ${kmh(after.speed)} km/h vers ${z} m`,
                    ` and the wind goes from ${kmh(before.speed)} to ${kmh(after.speed)} km/h around ${z} m`,
                );
            }
        }
        const rain = f.rain >= 1 ? tr(`${mm(f.rain)} de pluie`, `${mm(f.rain)} of rain`) : tr('peu ou pas de pluie', 'little or no rain');
        const gust =
            f.gust != null && toKmh(f.gust) >= 40
                ? tr(` et des rafales jusqu’à ${kmh(f.gust)} km/h`, ` and gusts up to ${kmh(f.gust)} km/h`)
                : '';
        return f.kind === 'cold'
            ? tr(
                  `Un front froid passe vers ${at} : en altitude, l’air se refroidit de ${deg} °C en 6 h${wind}. Il apporte ${rain}${gust}. À son approche, le vent se renforce et peut tourner brutalement ; derrière lui, l’air est plus froid, instable et souvent venté.`,
                  `A cold front passes around ${at}: aloft, the air cools by ${deg} °C in 6 h${wind}. It brings ${rain}${gust}. As it approaches, the wind picks up and can swing abruptly; behind it, the air is colder, unstable and often windy.`,
              )
            : tr(
                  `Un front chaud passe vers ${at} : en altitude, l’air se réchauffe de ${deg} °C en 6 h${wind}. Il apporte ${rain}${gust}. Le plafond nuageux s’abaisse à son approche et la pluie dure ; l’air qui suit est plus stable.`,
                  `A warm front passes around ${at}: aloft, the air warms by ${deg} °C in 6 h${wind}. It brings ${rain}${gust}. The cloud base lowers as it approaches and the rain lasts; the air behind is more stable.`,
              );
    };

    /** Fronts de la journée, front froid de la veille, front de la nuit suivante, puis orage */
    const frontsText = (d: DayBulletin) => {
        const out = d.fronts.map(frontText);
        if (d.frontBefore) {
            out.push(
                tr(
                    `Un front froid est passé la veille vers ${hr(d.frontBefore.at.hour)} : derrière lui, l’air est plus froid et instable, avec des averses et du vent possibles.`,
                    `A cold front went through the day before around ${hr(d.frontBefore.at.hour)}: behind it, the air is colder and unstable, with showers and wind possible.`,
                ),
            );
        }
        const after = d.frontAfter;
        if (after) {
            out.push(
                after.kind === 'cold'
                    ? tr(
                          `Un front froid arrive la nuit suivante, vers ${hr(after.at.hour)} : le vent peut se renforcer dès la fin de journée.`,
                          `A cold front arrives the following night, around ${hr(after.at.hour)}: the wind may pick up from late in the day.`,
                      )
                    : tr(
                          `Un front chaud arrive la nuit suivante, vers ${hr(after.at.hour)} : le ciel se couvre en fin de journée.`,
                          `A warm front arrives the following night, around ${hr(after.at.hour)}: the sky clouds over late in the day.`,
                      ),
            );
        }
        if (d.storm) {
            const at = hourText(d.storm.from.hour);
            out.push(
                d.storm.level === 3
                    ? tr(`Un orage violent est possible dès ${at}.`, `A severe thunderstorm is possible from ${at}.`)
                    : d.storm.level === 2
                      ? tr(`Un orage est probable dès ${at}.`, `A thunderstorm is likely from ${at}.`)
                      : tr(`L’air est propice aux orages violents dès ${at}.`, `The air is primed for severe storms from ${at}.`),
                tr(
                    'L’heure et le lieu d’un orage sont mal prévus (± 2 h, plusieurs dizaines de km).',
                    'Storm timing and location are poorly forecast (± 2 h, tens of km).',
                ),
            );
        }
        return out.join(' ');
    };

    // --- Thermiques et cumulus
    /** Épaisseur (m) à partir de laquelle des cumulus peuvent s'étaler ou donner des averses */
    const THICK_CUMULUS = 2000;

    const cumulusText = (d: DayBulletin, cu: CumulusSummary) => {
        const base =
            r50(cu.baseMin) === r50(cu.baseMax)
                ? tr(`vers ${r50(cu.baseMin)} m`, `around ${r50(cu.baseMin)} m`)
                : tr(`de ${r50(cu.baseMin)} à ${r50(cu.baseMax)} m`, `from ${r50(cu.baseMin)} to ${r50(cu.baseMax)} m`);
        const top = `${r50(cu.top)} m${cu.capped ? tr(' ou plus', ' or higher') : ''}`;
        const forms = tr(`Des cumulus se forment ${span(cu)}, avec une base ${base}`, `Cumulus form ${span(cu)}, with a base ${base}`);
        if (cu.depth < THICK_CUMULUS) return tr(`${forms} et des sommets vers ${top}.`, `${forms} and tops around ${top}.`);
        // Le sommet est celui que l'instabilité permet : le modèle ne développe pas toujours ces nuages
        return d.overdevFrom != null || d.storm
            ? tr(
                  `${forms} et des sommets jusqu’à ${top} : épais de ${r100(cu.depth)} m, ils peuvent s’étaler et donner des averses.`,
                  `${forms} and tops up to ${top}: ${r100(cu.depth)} m deep, they can spread out and give showers.`,
              )
            : tr(
                  `${forms}. L’air instable leur permettrait de monter jusqu’à ${top}, mais le modèle ne prévoit ni nuages épais ni averses.`,
                  `${forms}. The unstable air would let them grow up to ${top}, but the model forecasts neither deep cloud nor showers.`,
              );
    };

    /** Écart (m) de l'isotherme 0 °C entre le matin et l'après-midi qui vaut d'être dit */
    const FREEZING_CHANGE = 300;

    /** Thermiques, cumulus et surdéveloppements, puis températures et isotherme 0 °C */
    const airText = (d: DayBulletin) => {
        const t = d.thermals;
        const out: string[] = [];
        if (!t) {
            out.push(tr('Le modèle ne prévoit pas de thermique exploitable.', 'The model forecasts no usable thermals.'));
        } else {
            out.push(
                tr(
                    `Les thermiques s’installent ${span(t)} : la montée au vario atteint +${dec(t.climb)} m/s vers ${hourText(t.bestHour)} et le plafond monte jusqu’à ${r50(t.ceiling)} m (${r50(t.ceiling - d.ground)} m au-dessus du sol).`,
                    `Thermals set in ${span(t)}: the vario climb reaches +${dec(t.climb)} m/s around ${hourText(t.bestHour)} and the ceiling rises to ${r50(t.ceiling)} m (${r50(t.ceiling - d.ground)} m above the ground).`,
                ),
            );
            if (d.cumulus) {
                out.push(cumulusText(d, d.cumulus));
            } else {
                // « Thermiques bleus » seulement sous un ciel qui le montre
                const open = [d.sky.am, d.sky.pm].every(p => !p || p.sky === 'clear' || p.sky === 'partly' || p.sky === 'veil');
                out.push(
                    open
                        ? tr(
                              'Ils s’arrêtent avant de condenser : pas de cumulus pour les marquer (thermiques bleus).',
                              'They stop before condensing: no cumulus to mark them (blue thermals).',
                          )
                        : tr('Ils s’arrêtent avant de condenser : pas de cumulus.', 'They stop before condensing: no cumulus.'),
                );
            }
        }
        if (d.overdevFrom != null) {
            out.push(
                tr(
                    `Des surdéveloppements sont possibles dès ${hourText(d.overdevFrom)}.`,
                    `Overdevelopment is possible from ${hourText(d.overdevFrom)}.`,
                ),
            );
        }
        const temps = tr(
            `Les températures vont de ${Math.round(toCelsius(d.tMin))} à ${Math.round(toCelsius(d.tMax))} °C au sol`,
            `Temperatures range from ${Math.round(toCelsius(d.tMin))} to ${Math.round(toCelsius(d.tMax))} °C at the surface`,
        );
        const { freezingAm: am, freezing: pm } = d;
        if (am != null && pm != null && Math.abs(pm - am) >= FREEZING_CHANGE) {
            out.push(
                tr(
                    `${temps}. L’isotherme 0 °C passe de ${r100(am)} m le matin à ${r100(pm)} m l’après-midi.`,
                    `${temps}. The freezing level goes from ${r100(am)} m in the morning to ${r100(pm)} m in the afternoon.`,
                ),
            );
        } else if ((pm ?? am) != null) {
            out.push(
                tr(
                    `${temps}, et l’isotherme 0 °C se tient vers ${r100((pm ?? am) as number)} m.`,
                    `${temps}, and the freezing level sits around ${r100((pm ?? am) as number)} m.`,
                ),
            );
        } else {
            out.push(`${temps}.`);
        }
        return out.join(' ');
    };

    // --- Le texte : ciel et précipitations, fronts et orage, vent, thermiques et températures
    /** Jour affiché, en toutes lettres : « dimanche 27 septembre » */
    const dateOf = (c: Column) =>
        new Date(c.ts + c.utcOffset * HOUR_MS).toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
        });

    const paragraphsOf = (d: DayBulletin, first: Column) => {
        const intro = tr(`Ce ${dateOf(first)}, `, `On ${dateOf(first)}, `);
        const sky = [skyText(d, intro)];
        if (d.fog) {
            sky.push(tr('De la brume ou du brouillard sont possibles en début de matinée.', 'Mist or fog is possible early in the morning.'));
        }
        sky.push(rainText(d));
        return [sky.join(' '), frontsText(d), windText(d), airText(d)].filter(Boolean).map(unbreakable);
    };

    /** Espaces insécables : avant « ; » et « : », et entre un nombre et son unité, pour qu'une ligne ne commence pas par eux */
    const unbreakable = (text: string) =>
        text.replace(/ ([;:])/g, ' $1').replace(/(\d) (km\/h|m\/s|mm|m|°C|h)(?![\w/])/g, '$1 $2');

    $: paragraphs = b && day ? paragraphsOf(b, day.columns[0]) : [];
</script>

<style lang="less">
    .wpp-bl {
        font-size: 13px;
        line-height: 1.6;
        color: var(--wpp-fg-dim);

        &--empty {
            padding: 60px 0;
            text-align: center;
            opacity: 0.8;
        }
        p {
            margin: 0 0 10px;

            &:last-child {
                margin-bottom: 0;
            }
        }
    }
</style>
