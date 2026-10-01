<!--
    Pictogramme du risque convectif :
    - niveau 1 : cumulus bourgeonnant (« TCU » en aéronautique), surdéveloppement possible ;
    - niveau 2 : cumulonimbus avec éclair (« CB »), orage probable ;
    - niveau 3 : cumulonimbus violet à deux éclairs, orage violent possible.
    SVG autonome : utilisable dans du HTML comme dans un autre SVG (x, y).
-->
<svg class="wpp-si" {x} {y} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
    <title>{label}</title>
    {#if level >= 2}
        <path
            d="M5.5 14.5h12.2a3.6 3.6 0 0 0 .4-7.2 5.6 5.6 0 0 0-10.7-1.1A4.2 4.2 0 0 0 5.5 14.5z"
            fill={STORM_COLORS[level]}
            stroke="var(--wpp-halo, #0f1822)"
            stroke-width="1.2"
            stroke-linejoin="round"
        />
        <path
            d="M12.9 12.2 9.4 18.1h3l-1.3 4.6 4.9-6.9h-3.1l2-3.6z"
            transform={level === 3 ? 'translate(-3.4 0)' : undefined}
            fill="#fde047"
            stroke="var(--wpp-halo, #0f1822)"
            stroke-width="1"
            stroke-linejoin="round"
        />
        {#if level === 3}
            <path
                d="M12.9 12.2 9.4 18.1h3l-1.3 4.6 4.9-6.9h-3.1l2-3.6z"
                transform="translate(4 0)"
                fill="#fde047"
                stroke="var(--wpp-halo, #0f1822)"
                stroke-width="1"
                stroke-linejoin="round"
            />
        {/if}
    {:else}
        <path
            d="M4.6 21.2h14.8a3.1 3.1 0 0 0 .6-6.1 3.5 3.5 0 0 0-2-4.7 3.9 3.9 0 0 0-1.6-5.3 3.9 3.9 0 0 0-6.4 1.4 3.7 3.7 0 0 0-2.5 5.6 3.3 3.3 0 0 0-2.9 5.2 3.1 3.1 0 0 0 0 3.9z"
            fill={STORM_COLORS[1]}
            stroke="var(--wpp-halo, #0f1822)"
            stroke-width="1.2"
            stroke-linejoin="round"
        />
    {/if}
</svg>

<script context="module" lang="ts">
    import { tr } from './i18n';

    /** Libellé de chaque niveau de risque d'orage (0 : aucun signal) */
    export const STORM_LABELS = [
        tr('Pas de signal d’orage', 'No thunderstorm signal'),
        tr('Surdéveloppement possible', 'Overdevelopment possible'),
        tr('Orage probable', 'Thunderstorm likely'),
        tr('Orage violent possible', 'Severe thunderstorm possible'),
    ] as const;
</script>

<script lang="ts">
    import { STORM_COLORS } from './physics';

    /** 1 : surdéveloppement possible ; 2 : orage probable ; 3 : orage violent possible */
    export let level: 1 | 2 | 3 = 1;
    export let size = 14;
    export let x: number | undefined = undefined;
    export let y: number | undefined = undefined;

    $: label = `${STORM_LABELS[level]} (${level === 1 ? tr('cumulus bourgeonnants', 'towering cumulus') : 'cumulonimbus'})`;
</script>

<style>
    .wpp-si {
        display: inline-block;
        vertical-align: -2px;
        overflow: visible;
    }
</style>
