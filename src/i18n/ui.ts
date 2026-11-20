/**
 * UI strings for both languages and the few routing helpers the pages
 * need. Routes keep the same (French) names in both languages: the
 * English version of /projets/ is /en/projets/.
 */

export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];

export function altLocale(locale: Locale): Locale {
  return locale === 'fr' ? 'en' : 'fr';
}

/** Prefix a root-relative path for the given locale. */
export function localizePath(locale: Locale, path: string): string {
  return locale === 'fr' ? path : `/en${path === '/' ? '/' : path}`;
}

/** The same page in the other language. */
export function switchPath(path: string, to: Locale): string {
  const bare = path.replace(/^\/en(?=\/|$)/, '') || '/';
  return to === 'fr' ? bare : `/en${bare === '/' ? '/' : bare}`;
}

const dateFormats: Record<Locale, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long' }),
  en: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }),
};

export function formatDate(locale: Locale, date: Date): string {
  return dateFormats[locale].format(date);
}

export const ui = {
  fr: {
    skipLink: 'Aller au contenu',
    navLabel: 'Navigation principale',
    navProjects: 'Projets',
    navAbout: 'À propos',
    navCv: 'CV',
    langSwitch: 'English version',
    writeMe: 'M’écrire',
    downloadCv: 'Télécharger le CV',
    cvFrenchOnly: '',
    footerLegal: 'Mentions légales',
    footerPrivacy: 'Confidentialité',
    footerColophon: 'Site réalisé avec Astro,',
    footerSource: 'code source sur GitHub',
    projectsTitle: 'Projets',
    projectsEmpty: 'Aucun projet publié pour le moment.',
    allProjects: 'Tous les projets',
    backToProjects: '← Tous les projets',
    openDemo: 'Essayer la démo',
    sourceCode: 'Code source',
    download: 'Téléchargement',
    prevProject: 'Projet précédent',
    nextProject: 'Projet suivant',
    draftBadge: 'brouillon — invisible en production',
    aiMention: 'Projet développé avec assistance IA.',
    thirdPartyTitle: 'Crédits tiers',
    statusWip: 'en cours',
    statusDone: 'terminé',
    statusArchived: 'archivé',
    notFoundTitle: 'Page introuvable',
    notFoundText: 'Cette page n’existe pas, ou plus.',
    notFoundHome: 'Retour à l’accueil',
  },
  en: {
    skipLink: 'Skip to content',
    navLabel: 'Main navigation',
    navProjects: 'Projects',
    navAbout: 'About',
    navCv: 'CV',
    langSwitch: 'Version française',
    writeMe: 'Email me',
    downloadCv: 'Download the CV',
    cvFrenchOnly: '(in French)',
    footerLegal: 'Legal notice',
    footerPrivacy: 'Privacy',
    footerColophon: 'Built with Astro,',
    footerSource: 'source code on GitHub',
    projectsTitle: 'Projects',
    projectsEmpty: 'No project published yet.',
    allProjects: 'All projects',
    backToProjects: '← All projects',
    openDemo: 'Try the demo',
    sourceCode: 'Source code',
    download: 'Download',
    prevProject: 'Previous project',
    nextProject: 'Next project',
    draftBadge: 'draft — invisible in production',
    aiMention: 'Project developed with AI assistance.',
    thirdPartyTitle: 'Third-party credits',
    statusWip: 'in progress',
    statusDone: 'done',
    statusArchived: 'archived',
    notFoundTitle: 'Page not found',
    notFoundText: 'This page does not exist, or not anymore.',
    notFoundHome: 'Back to the home page',
  },
} as const;

export type UiStrings = (typeof ui)[Locale];

export function t(locale: Locale): UiStrings {
  return ui[locale];
}
