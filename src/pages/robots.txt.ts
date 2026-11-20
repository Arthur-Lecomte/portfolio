import type { APIRoute } from 'astro';
import { siteUrl } from '../data/site';

/** Static robots.txt — generated so the domain stays in site.ts only. */
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap-index.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
