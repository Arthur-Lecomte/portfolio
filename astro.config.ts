import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { siteUrl } from './src/data/site';

// NOTE: fonts are declared manually in src/styles/tokens.css instead of
// Astro's Fonts API — the <Font> component injects an inline <style>,
// which the strict style-src 'self' CSP (no 'unsafe-inline') forbids.

export default defineConfig({
  site: siteUrl,

  integrations: [
    sitemap({
      // The sitemap's i18n block is independent from Astro's own i18n
      // config — keep both in sync. Keys match path prefixes.
      i18n: {
        defaultLocale: 'fr',
        locales: { fr: 'fr-FR', en: 'en-US' },
      },
      filter: (page) => !page.includes('/404'),
    }),
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
    plugins: [
      {
        // Dev server only: resolve /demos/<slug>/ to its index.html.
        // In production Cloudflare's html_handling does this; Astro's
        // dev server does not resolve directory indexes under public/,
        // so demo links 404ed in dev while working once deployed.
        name: 'demo-directory-index',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            const [path, query] = (req.url ?? '').split('?');
            if (path.startsWith('/demos/') && path.endsWith('/')) {
              req.url = `${path}index.html${query ? `?${query}` : ''}`;
            }
            next();
          });
        },
      },
    ],
  },
});
