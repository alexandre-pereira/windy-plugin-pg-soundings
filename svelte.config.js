// Used by editors / svelte-check only; the build uses the preprocessors from rollup.config.js
import sveltePreprocess from 'svelte-preprocess';

export default {
    preprocess: sveltePreprocess(),
};
