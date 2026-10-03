<svelte:window on:pointerdown={onWindowPointer} on:keydown={e => e.key === 'Escape' && (open = false)} />

<div class="wpp-mp" bind:this={rootEl}>
    <button
        class="wpp-mp__btn"
        class:wpp-mp__btn--open={open}
        aria-haspopup="listbox"
        title={tr('Modèle météo', 'Weather model')}
        aria-expanded={open}
        on:click={() => (open = !open)}
    >
        <span class="wpp-mp__name">{current?.name ?? value}</span>
        <span class="wpp-mp__res">{current?.res ?? ''}</span>
        <svg class="wpp-mp__caret" width="12" height="12" viewBox="0 0 12 12"
            ><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
        >
    </button>

    {#if open}
        <ul class="wpp-mp__list" role="listbox" aria-label={tr('Modèle météo', 'Weather model')}>
            {#each models as m}
                <li>
                    <button
                        role="option"
                        aria-selected={m.id === value}
                        class="wpp-mp__opt"
                        class:wpp-mp__opt--on={m.id === value}
                        on:click={() => choose(m.id)}
                    >
                        <span class="wpp-mp__opt-main">
                            <b>{m.name}</b>
                            <span class="wpp-mp__opt-res">{m.res}</span>
                        </span>
                        <span class="wpp-mp__opt-area">{m.area}{#if m.len}<span class="wpp-mp__opt-len">&nbsp;·&nbsp;{m.len}</span>{/if}</span>
                        {#if m.id === value}<span class="wpp-mp__check">✓</span>{/if}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<script lang="ts">
    import { tr } from './i18n';

    export let models: readonly { id: string; name: string; res: string; area: string; len?: string }[];
    export let value: string;

    let open = false;
    let rootEl: HTMLDivElement;

    $: current = models.find(m => m.id === value);

    const choose = (id: string) => {
        value = id;
        open = false;
    };

    const onWindowPointer = (e: PointerEvent) => {
        if (open && rootEl && !rootEl.contains(e.target as Node)) open = false;
    };
</script>

<style lang="less">
    .wpp-mp {
        position: relative;
        display: inline-block;

        &__btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 8px 4px 9px;
            border: 1px solid var(--wpp-border);
            border-radius: 7px;
            background: var(--wpp-surface);
            color: var(--wpp-fg);
            font: inherit;
            cursor: pointer;
            transition:
                background 0.15s,
                border-color 0.15s;

            &:hover,
            &--open {
                background: var(--wpp-surface-hover);
                border-color: var(--wpp-border-strong);
            }
        }
        &__name {
            font-size: 13px;
            font-weight: 600;
        }
        &__res {
            font-size: 11px;
            color: var(--wpp-fg-faint);
        }
        &__caret {
            color: var(--wpp-fg-faint);
            transition: transform 0.15s;
        }
        &__btn--open &__caret {
            transform: rotate(180deg);
        }

        &__list {
            position: absolute;
            z-index: 20;
            top: calc(100% + 4px);
            left: 0;
            width: 250px;
            max-width: calc(100vw - 24px);
            margin: 0;
            padding: 6px;
            list-style: none;
            border-radius: 8px;
            background: var(--wpp-popup-bg);
            border: 1px solid var(--wpp-popup-border);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);
        }
        &__opt {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 1px;
            width: 100%;
            padding: 8px 30px 8px 12px;
            border: none;
            border-radius: 8px;
            background: transparent;
            color: var(--wpp-fg);
            font: inherit;
            font-size: 13px;
            text-align: left;
            cursor: pointer;

            &:hover {
                background: var(--wpp-surface-hover);
            }
            &--on {
                background: var(--wpp-surface-hover);
                color: var(--wpp-fg);
            }
        }
        &__opt-main {
            display: flex;
            align-items: baseline;
            gap: 6px;
        }
        &__opt-res {
            font-size: 11px;
            color: var(--wpp-fg-faint);
        }
        &__opt-area {
            font-size: 11px;
            color: var(--wpp-fg-faint);
            white-space: nowrap;
        }
        &__opt-len {
            color: var(--wpp-fg-dim);
        }
        &__check {
            position: absolute;
            right: 10px;
            color: var(--wpp-fg-dim);
            font-weight: bold;
        }
    }

    @media (pointer: coarse) {
        .wpp-mp__opt {
            padding-top: 11px;
            padding-bottom: 11px;
        }
    }
</style>
