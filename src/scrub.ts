/**
 * Lecture au doigt des graphiques : après un appui maintenu, le glissé suit le doigt et lit les
 * valeurs en continu, au lieu de faire défiler la page ou le graphique. Sans appui maintenu, rien
 * ne change : un glissé fait défiler, un toucher lit un point (clic).
 */

/** Durée (ms) de l'appui qui lance la lecture, et déplacement (px) qui l'annule avant ce délai */
const HOLD_MS = 250;
const SLOP_PX = 8;

export interface ScrubPoint {
    clientX: number;
    clientY: number;
}

/**
 * Action Svelte : `use:scrub={lire}`. `onMove` reçoit la position du doigt dès que l'appui est
 * reconnu, puis à chaque déplacement jusqu'à ce qu'il se lève.
 */
export const scrub = (node: Element, onMove: (point: ScrubPoint) => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: ScrubPoint | null = null;
    let active = false;

    const reset = () => {
        clearTimeout(timer);
        timer = undefined;
        start = null;
        active = false;
    };

    const onStart = (e: Event) => {
        reset();
        const { touches } = e as TouchEvent;
        if (touches.length !== 1) return;
        const point = { clientX: touches[0].clientX, clientY: touches[0].clientY };
        start = point;
        timer = setTimeout(() => {
            active = true;
            onMove(point);
        }, HOLD_MS);
    };

    const onTouchMove = (e: Event) => {
        const touch = (e as TouchEvent).touches[0];
        if (!touch || !start) return;
        if (active) {
            // La page ne défile pas tant que le doigt lit le graphique
            if (e.cancelable) e.preventDefault();
            onMove({ clientX: touch.clientX, clientY: touch.clientY });
        } else if (
            Math.hypot(touch.clientX - start.clientX, touch.clientY - start.clientY) > SLOP_PX
        ) {
            // Le doigt est parti avant le délai : c'est un défilement
            reset();
        }
    };

    /** Pas de menu contextuel au bout d'un appui long */
    const onContextMenu = (e: Event) => {
        if (active || timer !== undefined) e.preventDefault();
    };

    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', reset);
    node.addEventListener('touchcancel', reset);
    node.addEventListener('contextmenu', onContextMenu);

    return {
        update(next: (point: ScrubPoint) => void) {
            onMove = next;
        },
        destroy() {
            reset();
            node.removeEventListener('touchstart', onStart);
            node.removeEventListener('touchmove', onTouchMove);
            node.removeEventListener('touchend', reset);
            node.removeEventListener('touchcancel', reset);
            node.removeEventListener('contextmenu', onContextMenu);
        },
    };
};
