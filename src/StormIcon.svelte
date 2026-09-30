<!--
    Pictogramme du risque convectif :
    - niveau 1 : cumulus bourgeonnant (« TCU » en aéronautique), surdéveloppement possible ;
    - niveau 2 : cumulonimbus avec éclair (« CB »), orage probable.
    SVG autonome : utilisable dans du HTML comme dans un autre SVG (x, y).
-->
<svg class="wpp-si" {x} {y} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
    <title>{label}</title>
    {#if level === 2}
        <path
            d="M5.5 14.5h12.2a3.6 3.6 0 0 0 .4-7.2 5.6 5.6 0 0 0-10.7-1.1A4.2 4.2 0 0 0 5.5 14.5z"
            fill="#ef4444"
            stroke="var(--wpp-halo, #0f1822)"
            stroke-width="1.2"
            stroke-linejoin="round"
        />
        <path
            d="M12.9 12.2 9.4 18.1h3l-1.3 4.6 4.9-6.9h-3.1l2-3.6z"
            fill="#fde047"
            stroke="var(--wpp-halo, #0f1822)"
            stroke-width="1"
            stroke-linejoin="round"
        />
    {:else}
        <path
            d="M4.6 21.2h14.8a3.1 3.1 0 0 0 .6-6.1 3.5 3.5 0 0 0-2-4.7 3.9 3.9 0 0 0-1.6-5.3 3.9 3.9 0 0 0-6.4 1.4 3.7 3.7 0 0 0-2.5 5.6 3.3 3.3 0 0 0-2.9 5.2 3.1 3.1 0 0 0 0 3.9z"
            fill="#f59e0b"
            stroke="var(--wpp-halo, #0f1822)"
            stroke-width="1.2"
            stroke-linejoin="round"
        />
    {/if}
</svg>

<script lang="ts">
    import { tr } from './i18n';

    /** 1 : surdéveloppement possible ; 2 : orage probable */
    export let level: 1 | 2 = 1;
    export let size = 14;
    export let x: number | undefined = undefined;
    export let y: number | undefined = undefined;

    $: label =
        level === 2
            ? tr('Orage probable (cumulonimbus)', 'Thunderstorm likely (cumulonimbus)')
            : tr('Surdéveloppement possible (cumulus bourgeonnants)', 'Overdevelopment possible (towering cumulus)');
</script>

<style>
    .wpp-si {
        display: inline-block;
        vertical-align: -2px;
        overflow: visible;
    }
</style>
