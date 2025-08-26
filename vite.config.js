// vite.config.js
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss(),
    devtoolsJson()
  ],
  define: {
    'import.meta.env.PUBLIC_API_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'
    )
  },
  server: {
    host: '0.0.0.0', // écoute sur toutes les IP
    port: 8001,      // port fixe pour ton frontend
    proxy: {
      '/api': {
        target: 'http://localhost:8080', // backend FastAPI
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8080', // backend WS
        ws: true,
        changeOrigin: true
      }
    }
  },
  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: './vite.config.js',
        test: {
          name: 'client',
          environment: 'browser',
          browser: {
            enabled: true,
            provider: 'playwright',
            instances: [{ browser: 'chromium' }]
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**'],
          setupFiles: ['./vitest-setup-client.js']
        }
      },
      {
        extends: './vite.config.js',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
        }
      }
    ]
  }
});
