import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

import serve from 'rollup-plugin-serve';
import rollupSvelte from 'rollup-plugin-svelte';
import rollupSwc from 'rollup-plugin-swc3';
import rollupCleanup from 'rollup-plugin-cleanup';

import { less } from 'svelte-preprocess-less';
import sveltePreprocess from 'svelte-preprocess';

import { transformCodeToESMPlugin, keyPEM, certificatePEM } from '@windycom/plugin-devtools';

const useSourceMaps = true;

/**
 * Mentions de licence en tête de la version minifiée, posées après la minification qui retire les
 * commentaires : celle du plugin, et celle de Svelte, dont le code compilé est inclus (la licence
 * MIT demande de la reproduire)
 */
const LICENCES =
    '/*! PG Soundings | (c) Alexandre Pereira, diffusé par WeSoar | ISC | github.com/alexandre-pereira/windy-plugin-pg-soundings */\n' +
    '/*! Svelte | (c) 2016-23 Svelte contributors | MIT | github.com/sveltejs/svelte/blob/main/LICENSE.md */\n';
const licences = () => ({ name: 'licences', renderChunk: code => ({ code: LICENCES + code, map: null }) });

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
        process.env.SERVE !== 'false' &&
            serve({
                contentBase: 'dist',
                host: '0.0.0.0',
                port: 9999,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
                https: {
                    key: keyPEM,
                    cert: certificatePEM,
                },
            }),
    ],
};
