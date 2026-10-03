import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests des calculs (physique, interpolation, heure locale, cross) hors de Windy : les modules
// @windy/* n'existent que dans l'application, on les remplace par des bouchons
export default defineConfig({
    resolve: {
        alias: {
            '@windy/store': fileURLToPath(new URL('./tests/stubs/windy-store.ts', import.meta.url)),
            '@windy/fetch': fileURLToPath(new URL('./tests/stubs/windy-fetch.ts', import.meta.url)),
        },
    },
    test: {
        include: ['tests/**/*.test.ts'],
    },
});
