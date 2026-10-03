<!--
    Orage d'un point voisin qui se dirige vers le lieu, alors que le modèle n'en prévoit pas sur le
    lieu : affiché sous l'alerte d'orage, visible sur tous les onglets.
-->
<div class="wpp-sn" style="--wpp-sn-color:{STORM_COLORS[storm.level]}" role="status">
    <div class="wpp-sn__title"><StormIcon level={storm.level} size={16} /> {title}</div>
    <p>{facts}</p>
    {#if note}
        <p class="wpp-sn__note">
            {tr(
                'L’heure et le lieu d’un orage sont mal prévus (± 2 h, plusieurs dizaines de km), et son front de rafales le précède de plusieurs kilomètres : gardez une large marge.',
                'Storm timing and location are poorly forecast (± 2 h, tens of km), and the gust front runs several kilometres ahead of it: keep a wide margin.',
            )}
        </p>
    {/if}
</div>

<script lang="ts">
    import { hourText, tr } from './i18n';
    import type { NearbyStorm } from './nearby';
    import { STORM_COLORS, toKmh } from './physics';
    import StormIcon from './StormIcon.svelte';
    import { localHour } from './time';

    export let storm: NearbyStorm;
    /** Rappel des limites de la prévision : inutile sous l'alerte d'orage du lieu, qui le porte déjà */
    export let note = true;

    const round5 = (v: number) => Math.round(v / 5) * 5;

    /** Côté où se trouve le point voisin : nord, est, sud ou ouest */
    const SIDES = [
        tr('au nord', 'to the north'),
        tr('à l’est', 'to the east'),
        tr('au sud', 'to the south'),
        tr('à l’ouest', 'to the west'),
    ];
    $: side = SIDES[Math.round(storm.bearing / 90) % 4];
    $: km = round5(storm.distance);
    $: hour = hourText(storm.at.hour);
    $: title =
        storm.level === 3
            ? tr(`Orage violent possible à ${km} km ${side} vers ${hour}`, `Severe thunderstorm possible ${km} km ${side} around ${hour}`)
            : tr(`Orage probable à ${km} km ${side} vers ${hour}`, `Thunderstorm likely ${km} km ${side} around ${hour}`);
    $: arrival = hourText(localHour(storm.arrival, storm.at.utcOffset));
    $: facts = tr(
        `Sur le lieu, le modèle n’en prévoit pas à ces heures, mais le vent pousse celui-ci vers lui à ~${round5(toKmh(storm.speed))} km/h : il peut l’atteindre vers ${arrival}, et son front de rafales avant lui.`,
        `Over the place the model forecasts none at these hours, but the wind pushes this one towards it at ~${round5(toKmh(storm.speed))} km/h: it may reach it around ${arrival}, and its gust front before that.`,
    );
</script>

<style lang="less">
    .wpp-sn {
        margin: 0 0 10px;
        padding: 8px 10px;
        border: 1px dashed var(--wpp-sn-color);
        border-left: 4px solid var(--wpp-sn-color);
        border-radius: 8px;
        background: var(--wpp-surface);
        font-size: 12px;
        line-height: 1.4;
        color: var(--wpp-fg-dim);

        &__title {
            font-size: 13px;
            font-weight: bold;
            color: var(--wpp-fg);
        }
        p {
            margin: 3px 0 0;
        }
        &__note {
            font-size: 11px;
            color: var(--wpp-fg-faint);
        }
    }
</style>
