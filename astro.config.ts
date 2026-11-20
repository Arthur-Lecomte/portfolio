import { defineConfig } from 'astro/config';
import { siteUrl } from './src/data/site';

export default defineConfig({
  site: siteUrl,

  i18n: {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    // French at the domain root (no /fr prefix), English under /en/.
    // No redirect, no language detection.
    routing: {
      prefixDefaultLocale: false,
    },
  },

  build: {
    // Never inline stylesheets: the strict Content-Security-Policy
    // (phase 7) has no 'unsafe-inline', so every style must be an
    // external file.
    inlineStylesheets: 'never',
  },

  vite: {
    build: {
      // Same reason: prevent small scripts/assets from being inlined.
      assetsInlineLimit: 0,
    },
  },
});
