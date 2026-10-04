<!-- Lieu affiché : son nom ouvre la liste des favoris, le cœur ajoute le lieu aux favoris ou l'en retire -->
<svelte:window on:pointerdown={onWindowPointer} on:keydown={e => e.key === 'Escape' && (open = false)} />

<div class="wpp-pp" bind:this={rootEl}>
    <button
        class="wpp-pp__btn"
        class:wpp-pp__btn--open={open}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`${tr('Lieux favoris', 'Favourite places')} · ${coords}`}
        on:click={() => (open = !open)}
    >
        <span class="wpp-pp__name">{name}</span>
        <svg class="wpp-pp__caret" width="12" height="12" viewBox="0 0 12 12"
            ><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
        >
    </button>
    <button
        class="wpp-pp__fav"
        class:wpp-pp__fav--on={!!current}
        aria-pressed={!!current}
        title={current ? tr('Retirer des favoris', 'Remove from favourites') : tr('Ajouter aux favoris', 'Add to favourites')}
        on:click={() => dispatch('toggle')}
    >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
            ><path
                d="M12 20.5C7 16.6 3.5 13.4 3.5 9.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.5 1.8c0 4-3.5 7.2-8.5 11.1z"
            /></svg
        >
    </button>

    {#if open}
        <ul class="wpp-pp__list" role="listbox" aria-label={tr('Lieux favoris', 'Favourite places')}>
            {#each favorites as f (f.id)}
                <li>
                    <button
                        role="option"
                        aria-selected={f.id === current?.id}
                        class="wpp-pp__opt"
                        class:wpp-pp__opt--on={f.id === current?.id}
                        on:click={() => choose(f)}
                    >
                        <span class="wpp-pp__opt-name">{f.title}</span>
                        {#if f.id === current?.id}<span class="wpp-pp__check">✓</span>{/if}
                    </button>
                </li>
            {:else}
                <li class="wpp-pp__empty">
                    {tr(
                        'Aucun favori. Le cœur ajoute le lieu affiché à vos favoris Windy.',
                        'No favourites yet. The heart adds the place shown to your Windy favourites.',
                    )}
                </li>
            {/each}
        </ul>
    {/if}
</div>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    import type { Favorite } from './favorites';
    import { tr } from './i18n';

    /** Nom du lieu affiché */
    export let name: string;
    /** Ses coordonnées, en infobulle */
    export let coords: string;
    export let favorites: Favorite[];
    /** Favori posé sur le lieu affiché ; null s'il n'y en a pas */
    export let current: Favorite | null;

    const dispatch = createEventDispatcher<{ choose: Favorite; toggle: void }>();

    let open = false;
    let rootEl: HTMLDivElement;

    const choose = (f: Favorite) => {
        open = false;
        dispatch('choose', f);
    };

    const onWindowPointer = (e: PointerEvent) => {
        if (open && rootEl && !rootEl.contains(e.target as Node)) open = false;
    };
</script>

<style lang="less">
    .wpp-pp {
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
        gap: 2px;
        min-width: 0;

        // Panneau étroit : la liste se place par rapport à la ligne du lieu (`.wpp__head`, en
        // position relative), pour disposer de toute sa largeur
        @container wpp (max-width: 560px) {
            position: static;
        }

        &__btn {
            display: flex;
            align-items: center;
            gap: 5px;
            min-width: 0;
            padding: 3px 4px;
            border: none;
            border-radius: 7px;
            background: none;
            color: var(--wpp-fg);
            font: inherit;
            cursor: pointer;

            &:hover,
            &--open {
                background: var(--wpp-surface-hover);
            }
        }
        &__name {
            min-width: 0;
            font-size: 17px;
            font-weight: bold;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;

            @container wpp (max-width: 560px) {
                font-size: 15px;
            }
        }
        &__caret {
            flex: none;
            color: var(--wpp-fg-faint);
            transition: transform 0.15s;
        }
        &__btn--open &__caret {
            transform: rotate(180deg);
        }
        &__fav {
            flex: none;
            display: grid;
            place-items: center;
            width: 28px;
            height: 28px;
            padding: 0;
            border: none;
            border-radius: 7px;
            background: none;
            color: var(--wpp-fg-dim);
            cursor: pointer;

            svg {
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linejoin: round;
            }
            &:hover {
                background: var(--wpp-surface-hover);
                color: var(--wpp-fg);
            }
            &--on,
            &--on:hover {
                color: #ff5a7a;

                svg {
                    fill: currentColor;
                }
            }
        }

        // Liste des favoris : sous le nom (calée à droite de la ligne dans un panneau étroit),
        // défile quand elle est longue
        &__list {
            position: absolute;
            z-index: 20;
            top: calc(100% + 4px);
            left: 0;

            @container wpp (max-width: 560px) {
                left: auto;
                right: 0;
            }
            width: 280px;
            max-width: 100%;
            max-height: 240px;
            overflow-y: auto;
            margin: 0;
            padding: 6px;
            list-style: none;
            border-radius: 8px;
            background: var(--wpp-popup-bg);
            border: 1px solid var(--wpp-popup-border);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);
            scrollbar-width: thin;
            scrollbar-color: var(--wpp-border-strong) transparent;
        }
        &__opt {
            position: relative;
            display: block;
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

            &:hover,
            &--on {
                background: var(--wpp-surface-hover);
            }
        }
        &__opt-name {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        &__check {
            position: absolute;
            top: 8px;
            right: 10px;
            color: var(--wpp-fg-dim);
            font-weight: bold;
        }
        &__empty {
            padding: 8px 12px;
            font-size: 12px;
            line-height: 1.4;
            color: var(--wpp-fg-dim);
        }
    }

    @media (pointer: coarse) {
        .wpp-pp__opt {
            padding-top: 11px;
            padding-bottom: 11px;
        }
        .wpp-pp__check {
            top: 11px;
        }
    }
</style>
