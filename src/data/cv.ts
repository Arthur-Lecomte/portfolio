/**
 * Career and skills data, shown on the About page. The CV in _prive/ is
 * the single source of truth: labels, dates and titles below must match
 * it exactly — never add anything the CV does not say.
 * (HTML/CSS are deliberately absent from the skills: site rule.)
 */

import type { Locale } from '../i18n/ui';

type Localized = Record<Locale, string>;

export interface ExperienceEntry {
  period: Localized;
  title: Localized;
  org: string;
  kind: Localized;
  description: Localized;
  tech: string[];
}

export const experience: ExperienceEntry[] = [
  {
    period: { fr: 'février – juillet 2026', en: 'February – July 2026' },
    title: { fr: 'Développeur serious game', en: 'Serious game developer' },
    org: 'AIME (Toulouse)',
    kind: { fr: 'stage', en: 'internship' },
    description: {
      fr: 'Conception et développement d’un serious game en VR destiné à la formation d’étudiants ingénieurs INSA. Livraison d’un logiciel évolutif finalisé.',
      en: 'Design and development of a VR serious game used to train INSA engineering students. Delivered a finished, maintainable piece of software.',
    },
    tech: ['Unity', 'Blender', 'C#'],
  },
  {
    period: { fr: '2023 – 2024', en: '2023 – 2024' },
    title: { fr: 'Développeur logiciel', en: 'Software developer' },
    org: 'Coralis (Aix-en-Provence)',
    kind: { fr: 'alternance', en: 'work-study' },
    description: {
      fr: 'Développement d’applications scientifiques métier pour l’aménagement des sols et sous-sols et la gestion de ressources minières, en équipe de six développeurs sur une base de code existante.',
      en: 'Development of scientific business applications for land and subsoil planning and mining resource management, in a team of six developers on an existing codebase.',
    },
    tech: ['.NET', 'WPF', 'C#', 'MVVM'],
  },
  {
    period: { fr: 'avril – juin 2023', en: 'April – June 2023' },
    title: { fr: 'Développeur mobile', en: 'Mobile developer' },
    org: 'Ecocem Global (Aix-en-Provence)',
    kind: { fr: 'stage', en: 'internship' },
    description: {
      fr: 'Évolutions et mise à jour d’une application mobile de sécurité des employés en production.',
      en: 'Evolutions and updates of a mobile application for the safety of production employees.',
    },
    tech: ['Android Studio', 'Java', 'XML'],
  },
];

export interface EducationEntry {
  period: string;
  title: Localized;
  place: string;
  note?: Localized;
}

export const education: EducationEntry[] = [
  {
    period: '2024 – 2026',
    title: {
      fr: 'Master 2 Numérique (AMINJ)',
      en: 'Master’s programme in digital studies (AMINJ)',
    },
    place: 'Albi',
    note: {
      fr: 'cursus suivi sans validation du diplôme',
      en: 'programme followed, degree not validated',
    },
  },
  {
    period: '2021 – 2024',
    title: { fr: 'BUT Informatique', en: 'BUT in computer science (three-year degree)' },
    place: 'Aix-Marseille',
  },
  {
    period: '2020',
    title: {
      fr: 'Bac STI2D SIN, mention très bien',
      en: 'STI2D SIN baccalaureate, with highest honours',
    },
    place: 'Hyères',
  },
];

export interface StackCategory {
  category: Localized;
  items: Record<Locale, string[]>;
}

export const stack: StackCategory[] = [
  {
    category: { fr: 'Langages', en: 'Languages' },
    items: {
      fr: ['C#', 'Java', 'Python', 'SQL'],
      en: ['C#', 'Java', 'Python', 'SQL'],
    },
  },
  {
    category: { fr: 'Frameworks et concepts', en: 'Frameworks and concepts' },
    items: {
      fr: ['.NET', 'WPF', 'MVVM', 'Architecture logicielle'],
      en: ['.NET', 'WPF', 'MVVM', 'Software architecture'],
    },
  },
  {
    category: { fr: 'Outils', en: 'Tools' },
    items: {
      fr: ['Git', 'Visual Studio', 'Visual Studio Code'],
      en: ['Git', 'Visual Studio', 'Visual Studio Code'],
    },
  },
];
