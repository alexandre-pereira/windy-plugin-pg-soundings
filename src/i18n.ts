/**
 * Langue de l'interface : français pour les utilisateurs de Windy en français, anglais sinon.
 * Les textes sont écrits dans le code sous la forme `tr('français', 'English')`.
 */

import store from '@windy/store';

export type Lang = 'fr' | 'en';

const detect = (): Lang => {
    try {
        const used = String(store.get('usedLang') || '');
        if (used) return used.toLowerCase().startsWith('fr') ? 'fr' : 'en';
    } catch {
        /* store indisponible : langue du navigateur */
    }
    try {
        return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
    } catch {
        return 'en';
    }
};

export const lang: Lang = detect();

/** Locale pour le formatage des dates */
export const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

/** Texte dans la langue de l'interface */
export const tr = (fr: string, en: string) => (lang === 'fr' ? fr : en);

/** Heure entière : « 14h » en français, « 14:00 » en anglais */
export const hourText = (h: number) => (lang === 'fr' ? `${h}h` : `${String(h).padStart(2, '0')}:00`);

/** Heure sur un axe, au plus court : « 14h » / « 14 » */
export const hourShort = (h: number) => (lang === 'fr' ? `${h}h` : `${h}`);

/** Heure et minutes : « 6h42 » en français, « 06:42 » en anglais */
export const clockText = (h: number, m: number) =>
    lang === 'fr' ? `${h}h${String(m).padStart(2, '0')}` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Points cardinaux (16 directions) */
export const CARDINALS =
    lang === 'fr'
        ? ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
        : ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
