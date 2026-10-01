/** Bouchon de @windy/store pour les tests : interface en français */
export default {
    get: (key: string) => (key === 'usedLang' ? 'fr' : undefined),
};
