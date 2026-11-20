/**
 * Single source of configuration for everything that can change in
 * Arthur's life. Components read from here — never hardcode these
 * values anywhere else (especially the domain).
 */

/** 'open' shows the availability line everywhere; 'closed' and 'hidden' remove it. */
export type Availability = 'open' | 'closed' | 'hidden';

export const site = {
  /** Site title and owner name. */
  name: 'Arthur Lecomte',

  /** Job title, exactly as written on the CV. */
  role: {
    fr: 'Développeur logiciel junior',
    en: 'Junior software developer',
  },

  /** Displayed area — never a town or an address. */
  location: {
    fr: 'Var, autour de Toulon',
    en: 'Var, near Toulon (South of France)',
  },

  availability: 'open' as Availability,

  /** Shown on the home page and in meta descriptions when availability is 'open'. */
  availabilityText: {
    fr: 'Disponible immédiatement, dans le Var ou en télétravail.',
    en: 'Available now, in the Var or remotely.',
  },

  /** The only email address that appears on the site. */
  email: 'contact@arthurlecomte.fr',

  links: {
    linkedin: 'https://www.linkedin.com/in/arthur-lecomte-7baa8522b/',
    /** Set to null to remove every GitHub profile link from the site. */
    github: 'https://github.com/Arthur-Lecomte' as string | null,
    /** Public repository of this site — shown in the footer. */
    repo: 'https://github.com/Arthur-Lecomte/portfolio',
  },

  /**
   * CV files, served from public/. null = the link is hidden everywhere
   * (no dead link). Required before go-live: a "web" CV without phone,
   * postal address or photo. If `en` stays null, the English pages link
   * to the French CV and say so.
   */
  cv: {
    fr: null as string | null,
    en: null as string | null,
  },

  /** The one and only place where the domain is written. */
  domain: 'arthurlecomte.fr',

  /**
   * Plausible Analytics site id. null = no analytics at all (current
   * choice). Setting the domain here is step one of enabling it later;
   * see docs/decisions.md before doing so (CNIL assessment).
   */
  plausibleDomain: null as string | null,
} as const;

/** Canonical origin, derived from the domain — used for astro.config `site`. */
export const siteUrl = `https://${site.domain}`;
