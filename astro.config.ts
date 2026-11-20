import { defineConfig, fontProviders } from 'astro/config';
import { siteUrl } from './src/data/site';

export default defineConfig({
  site: siteUrl,

  // Inter is the single family of the chosen direction (B), self-hosted
  // woff2 (OFL license next to the files). The Fonts API handles
  // hashing, immutable caching, preload and metric-adjusted fallbacks.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      options: {
        variants: [
          { src: ['./src/assets/fonts/inter/inter-latin-400.woff2'], weight: 400, style: 'normal' },
          { src: ['./src/assets/fonts/inter/inter-latin-600.woff2'], weight: 600, style: 'normal' },
          { src: ['./src/assets/fonts/inter/inter-latin-700.woff2'], weight: 700, style: 'normal' },
        ],
      },
    },
  ],

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
