import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import MagicString from 'magic-string';

import rollupSvelte from 'rollup-plugin-svelte';
import rollupSwc from 'rollup-plugin-swc3';
import rollupCleanup from 'rollup-plugin-cleanup';

import { less } from 'svelte-preprocess-less';
import sveltePreprocess from 'svelte-preprocess';

import { transformCodeToESMPlugin, keyPEM, certificatePEM } from '@windycom/plugin-devtools';

import { devServer } from './scripts/dev-server.js';

const useSourceMaps = true;

/**
 * Mentions de licence en tête des deux fichiers compilés, plugin.js et plugin.min.js (les deux vont
 * dans l'archive envoyée à Windy), posées après la minification qui retire les commentaires : celle
 * du plugin, et celle de Svelte, dont le code compilé est inclus (la licence MIT demande d'en
 * reproduire le copyright et le texte, ici en entier, tel que dans node_modules/svelte/LICENSE.md).
 * Les commentaires `/*!` sont ceux que les minificateurs gardent.
 */
const LICENCES =
    '/*! PG Soundings | (c) 2026 WeSoar SASU | ISC | github.com/alexandre-pereira/ws-plugin-windy */\n' +
    `/*! Svelte (https://github.com/sveltejs/svelte), licence MIT :

Copyright (c) 2016-23 [these people](https://github.com/sveltejs/svelte/graphs/contributors)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
`;
// MagicString décale la carte des sources de plugin.js (en développement) des lignes ajoutées
const licences = () => ({
    name: 'licences',
    renderChunk: code => {
        const s = new MagicString(code).prepend(LICENCES);
        return { code: s.toString(), map: s.generateMap({ hires: true }) };
    },
});

const input = 'src/plugin.svelte';
const out = 'plugin';

export default {
    input,
    output: [
        {
            file: `dist/${out}.js`,
            format: 'module',
            // Carte des sources en développement seulement : dans la version finale, elle pèse à elle
            // seule plus de la moitié de l'archive envoyée à Windy, qui la refuse à partir de 3 Mo
            // (les sources sont publiées sur GitHub).
            sourcemap: process.env.SERVE !== 'false',
            plugins: [licences()],
        },
        {
            file: `dist/${out}.min.js`,
            format: 'module',
            plugins: [rollupCleanup({ comments: 'none', extensions: ['ts'] }), terser(), licences()],
        },
    ],

    onwarn: () => {
        /* We disable all warning messages */
    },
    external: id => id.startsWith('@windy/'),
    watch: {
        include: ['src/**'],
        exclude: 'node_modules/**',
        clearScreen: false,
    },
    plugins: [
        rollupSvelte({
            emitCss: false,
            preprocess: {
                style: less({
                    sourceMap: false,
                    math: 'always',
                }),
                script: data => {
                    const preprocessed = sveltePreprocess({ sourceMap: useSourceMaps });
                    return preprocessed.script(data);
                },
            },
        }),
        rollupSwc({
            include: ['**/*.ts', '**/*.svelte'],
            sourceMaps: useSourceMaps,
        }),
        resolve({
            browser: true,
            mainFields: ['module', 'jsnext:main', 'main'],
            preferBuiltins: false,
            dedupe: ['svelte'],
        }),
        commonjs(),
        transformCodeToESMPlugin(),
        process.env.SERVE !== 'false' && devServer({ dir: 'dist', port: 9999, key: keyPEM, cert: certificatePEM }),
    ],
};
