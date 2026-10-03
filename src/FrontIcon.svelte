<!--
    Pictogramme d'un passage de front, aux symboles des cartes météo : trait à triangles (front
    froid), à demi-cercles (front chaud) ou aux deux (occlusion), cerné de blanc comme sur le
    graphique. `size` : sa largeur ; sa hauteur en vaut la moitié.
-->
<svg class="wpp-fi" width={size} height={size / 2} viewBox="0 0 24 12" role="img" aria-label={label}>
    <title>{label}</title>
    <line x1="1.5" y1="9.5" x2="22.5" y2="9.5" class="wpp-fi__halo" />
    <path d="{PIPS[kind === 'warm' ? 'warm' : 'cold']}{PIPS[kind === 'cold' ? 'cold' : 'warm'].replace('M3', 'M12')}" fill={color} class="wpp-fi__pips" />
    <line x1="1.5" y1="9.5" x2="22.5" y2="9.5" stroke={color} class="wpp-fi__line" />
</svg>

<script context="module" lang="ts">
    /** Un symbole de 9 de large posé sur le trait, à partir de x = 3 : triangle ou demi-cercle */
    const PIPS = { cold: 'M3 9.5l4.5-7.5l4.5 7.5z', warm: 'M3 9.5a4.5 4.5 0 0 1 9 0z' };
</script>

<script lang="ts">
    import { FRONT } from './Chart.svelte';

    import type { Front } from './fronts';

    export let kind: Front['kind'] = 'cold';
    export let size = 20;

    $: ({ color, label } = FRONT[kind]);
</script>

<style lang="less">
    .wpp-fi {
        display: inline-block;
        vertical-align: -1px;
        overflow: visible;
        &__halo {
            stroke: #ffffff;
            stroke-width: 4.4;
            stroke-linecap: round;
        }
        &__pips {
            stroke: #ffffff;
            stroke-width: 1.4;
            stroke-linejoin: round;
        }
        &__line {
            stroke-width: 2.2;
            stroke-linecap: round;
        }
    }
</style>
