/**
 * Taille du panneau : part de l'écran choisie par l'utilisateur, à la place de celle que Windy donne
 * au plugin (820 px de large sur ordinateur et tablette, plein écran sur téléphone). Le panneau ne
 * prend jamais tout l'écran : la carte reste visible à côté.
 *
 * Sur ordinateur et tablette, le panneau est à droite de la carte et le choix règle sa largeur ; sur
 * téléphone, il est en bas et le choix règle sa hauteur, la carte restant visible au-dessus. À
 * l'ouverture du plugin, Windy pose ses propres règles CSS (taille du panneau, décalage de la carte
 * et des boutons de droite) : la taille choisie les remplace par des règles plus précises, dans une
 * feuille de style ajoutée à la page.
 */

import config from './pluginConfig';

/** Parts de l'écran proposées (%) */
export const SHARES = [30, 50, 60, 70] as const;
export type Share = (typeof SHARES)[number];
/** Part de l'écran tant que l'utilisateur n'a rien choisi */
const DEFAULT_SHARE: Share = 60;
/** Côté réglé : largeur (panneau à droite) ou hauteur (panneau en bas, sur téléphone) */
export type PanelSide = 'width' | 'height';

const SIZE_KEY = 'wpp-size';
const STYLE_ID = 'wpp-size';
/** Largeur minimale (px) du panneau à droite, dans une petite fenêtre */
const MIN_WIDTH = 320;

export const savedSize = (): Share => {
    try {
        const saved = Number(localStorage.getItem(SIZE_KEY));
        return SHARES.find(s => s === saved) ?? DEFAULT_SHARE;
    } catch {
        return DEFAULT_SHARE;
    }
};

export const saveSize = (size: Share) => {
    try {
        localStorage.setItem(SIZE_KEY, String(size));
    } catch {
        /* stockage indisponible */
    }
};

/**
 * Côté que règle la taille, d'après la mise en page que Windy a donnée au panneau (`root`, l'élément
 * dans lequel Windy place le plugin) ; null si elle n'est pas connue : la taille ne se règle pas.
 */
export const panelSide = (root: Element | null): PanelSide | null => {
    if (!root?.id) return null;
    if (root.classList.contains('plugin-rhpane')) return 'width';
    if (root.classList.contains('plugin-mobile-bottom-slide')) return 'height';
    return null;
};

/**
 * Règles CSS d'un panneau (sélecteur `panel`) qui prend `share` % de l'écran. Comme celles de Windy,
 * elles décalent la carte de la moitié du panneau, pour que son centre reste au milieu de la partie
 * visible.
 */
export const sizeCss = (side: PanelSide, share: Share, panel: string): string => {
    // Classe que Windy pose sur la page tant que le plugin est ouvert
    const open = `body.on${config.name}`;
    if (side === 'width') {
        const w = `max(${share}vw, ${MIN_WIDTH}px)`;
        return `
body ${panel} { width: ${w}; }
${open} .right-border { right: ${w}; }
${open} #map-container { transform: translateX(calc(${w} / -2)); }`;
    }
    // Hauteur réelle de la fenêtre, que Windy tient à jour (barres du navigateur du téléphone)
    const vh = 'var(--vh, 1vh)';
    return `
body ${panel} { top: calc(${100 - share} * ${vh}); margin-top: 0; }
${open} #map-container { transform: translateY(calc(${-share / 2} * ${vh})); border-radius: 0; }`;
};

/** Retire la taille choisie : les règles de Windy s'appliquent de nouveau (fermeture du plugin) */
export const clearSize = () => document.getElementById(STYLE_ID)?.remove();

/** Donne au panneau `root` la taille choisie ; sans effet si sa mise en page n'est pas connue */
export const applySize = (root: Element | null, size: Share) => {
    clearSize();
    const side = panelSide(root);
    if (!root || !side) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = sizeCss(side, size, `#${root.id}`);
    document.head.appendChild(style);
};
