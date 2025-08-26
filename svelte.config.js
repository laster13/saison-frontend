// svelte.config.js
import { mdsvex } from 'mdsvex';
import sveltePreprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-node';
import path from 'path';

const PROD = process.env.NODE_ENV === 'production';

const config = {
  extensions: ['.svelte', '.svx'],
  kit: {
    adapter: adapter({ precompress: true }),
    paths: {
      base: PROD ? '/season' : ''
    },
    alias: {
      $lib: path.resolve('./src/lib'),
      $components: path.resolve('./src/lib/components')
    }
  },
  preprocess: [
    sveltePreprocess(),
    mdsvex({
      extensions: ['.svx', '.md']
    })
  ]
};

export default config;
