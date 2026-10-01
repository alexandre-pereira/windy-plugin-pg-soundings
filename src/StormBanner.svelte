<!--
    Alerte d'orage de la journée affichée, au-dessus des onglets : ce qui peut surprendre un pilote
    (heure d'arrivée, violence, vitesse de déplacement, rafales, absence de signe avant-coureur).
-->
<div class="wpp-sb" style="--wpp-sb-color:{STORM_COLORS[watch.level]}" role="status">
    <div class="wpp-sb__title"><StormIcon level={watch.level} size={16} /> {title}</div>
    {#if facts}<p>{facts}</p>{/if}
    <p class="wpp-sb__note">
        {tr(
            'L’heure et le lieu d’un orage sont mal prévus (± 2 h, plusieurs dizaines de km), et son front de rafales le précède de plusieurs kilomètres : gardez une large marge.',
            'Storm timing and location are poorly forecast (± 2 h, tens of km), and the gust front runs several kilometres ahead of it: keep a wide margin.',
        )}
    </p>
</div>

<script lang="ts">
    import { hourText, tr } from './i18n';
    import { FAST_STORM, STORM_COLORS, type StormWatch, cardinal, toKmh } from './physics';
    import StormIcon from './StormIcon.svelte';

    export let watch: StormWatch;

    /** Indice de soulèvement d'un air « très instable » (comme dans la légende) et cisaillement fort (m/s) */
    const VERY_UNSTABLE_LI = -6;
    const STRONG_SHEAR = 15;
    /** Rafales (km/h) et vitesse de déplacement (km/h) à partir desquelles on les mentionne */
    const NOTABLE_GUST = 40;
    const NOTABLE_SPEED = 20;

    const signed = (v: number) => String(Math.round(v)).replace('-', '−');
    const round5 = (v: number) => Math.round(v / 5) * 5;

    $: hour = hourText(watch.from.hour);
    $: title =
        watch.level === 3
            ? tr(`Orage violent possible dès ${hour}`, `Severe thunderstorm possible from ${hour}`)
            : watch.level === 2
              ? tr(`Orage probable dès ${hour}`, `Thunderstorm likely from ${hour}`)
              : tr(`Air propice aux orages violents dès ${hour}`, `Air primed for severe storms from ${hour}`);

    /** Pourquoi l'orage serait violent : instabilité, vent en altitude, ou rafales du modèle */
    const cause = (w: StormWatch) => {
        if (!w.severeEnv) {
            return w.level === 3 ? tr('Le modèle prévoit de fortes rafales sous l’orage.', 'The model forecasts strong gusts under the storm.') : '';
        }
        const li = w.liftedIndex;
        const very = li != null && li <= VERY_UNSTABLE_LI;
        const value = li == null ? '' : ` (LI ${signed(li)})`;
        const unstable = tr(
            `Air ${very ? 'très instable' : 'instable'}${value}`,
            `${very ? 'Very unstable' : 'Unstable'} air${value}`,
        );
        // Très instable sans vent fort en altitude : l'instabilité suffit à elle seule
        if (very && w.shear < STRONG_SHEAR) {
            return tr(`${unstable} : grêle et fortes rafales possibles.`, `${unstable}: hail and strong gusts possible.`);
        }
        // Sinon, c'est le vent en altitude qui organise l'orage dans un air instable
        const strong = w.shear >= STRONG_SHEAR;
        const kmh = round5(toKmh(w.shear));
        return tr(
            `${unstable} et vent ${strong ? 'fort' : 'soutenu'} en altitude (${kmh} km/h d’écart entre le sol et 6 km) : orages organisés, grêle et fortes rafales possibles.`,
            `${unstable} and ${strong ? 'strong' : 'brisk'} winds aloft (${kmh} km/h difference between the ground and 6 km): organised storms, hail and strong gusts possible.`,
        );
    };

    /** Déplacement de l'orage : mentionné dès 20 km/h, souligné quand il arrive vite */
    const motion = (w: StormWatch) => {
        const kmh = round5(toKmh(w.speed));
        if (kmh < NOTABLE_SPEED) return '';
        const from = cardinal(w.dir);
        if (w.speed < FAST_STORM) {
            return tr(`Déplacement : ~${kmh} km/h, de secteur ${from}.`, `Motion: ~${kmh} km/h from the ${from}.`);
        }
        const minutes = Math.round(600 / kmh);
        return tr(
            `Déplacement rapide : ~${kmh} km/h, de secteur ${from} (10 km en ${minutes} min).`,
            `Fast-moving: ~${kmh} km/h from the ${from} (10 km in ${minutes} min).`,
        );
    };

    $: facts = [
        watch.level === 1
            ? tr(
                  'Le modèle ne prévoit que du surdéveloppement, mais s’il tourne à l’orage, il sera violent.',
                  'The model only forecasts overdevelopment, but if it turns into a storm, it will be severe.',
              )
            : '',
        cause(watch),
        watch.gust != null && toKmh(watch.gust) >= NOTABLE_GUST
            ? tr(
                  `Rafales prévues jusqu’à ${round5(toKmh(watch.gust))} km/h.`,
                  `Gusts forecast up to ${round5(toKmh(watch.gust))} km/h.`,
              )
            : '',
        motion(watch),
        watch.calmBefore
            ? tr(
                  `À ${hourText(watch.calmBefore.hour)}, le modèle ne montre encore aucun signe.`,
                  `At ${hourText(watch.calmBefore.hour)}, the model still shows no sign of it.`,
              )
            : '',
        watch.hidden
            ? tr('Ciel déjà couvert avant : il peut arriver sans qu’on le voie.', 'Sky already overcast before: it may arrive unseen.')
            : '',
    ]
        .filter(Boolean)
        .join(' ');
</script>

<style lang="less">
    .wpp-sb {
        margin: 0 0 10px;
        padding: 8px 10px;
        border: 1px solid var(--wpp-sb-color);
        border-left-width: 4px;
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
