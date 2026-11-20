import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * A project is a folder under src/content/projects/<slug>/ containing:
 *   fr.md  — French text + ALL shared metadata (date, stack, links…)
 *   en.md  — English text only (title, summary, coverAlt, aiNote…)
 *   cover.*— the cover image, referenced from fr.md
 * French is the source language, so shared data lives in fr.md and is
 * never duplicated. Cross-file rules (en.md present, demo folder
 * exists…) are enforced by scripts/verify-content.mjs at build time.
 */

const httpsUrl = z.string().regex(/^https:\/\/\S+$/, 'must be an https:// URL');

/** Textual fields that exist in BOTH languages. */
const textFields = {
  /** ≤ 60 chars. */
  title: z.string().min(1).max(60),
  /** One jargon-free sentence, ≤ 160 chars — also the meta description. */
  summary: z.string().min(1).max(160),
  /** Alt text of the cover image. */
  coverAlt: z.string().min(1),
  /** When set, the page shows a sober AI-assistance mention with this note. */
  aiNote: z.string().optional(),
  /** For mods or fan projects: "unofficial, not affiliated with…". */
  disclaimer: z.string().optional(),
};

const projects = defineCollection({
  loader: glob({ pattern: '*/fr.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z
      .object({
        ...textFields,
        date: z.coerce.date(),
        status: z.enum(['wip', 'done', 'archived']),
        kind: z.enum(['web', 'game', 'desktop', 'mod', 'tool']),
        /** 1 to 8 technologies, free text. */
        stack: z.array(z.string().min(1)).min(1).max(8),
        /** 'internal' = served from demos/<slug>/, or an external https URL. */
        demo: z.union([z.literal('internal'), httpsUrl]).optional(),
        links: z
          .object({
            repo: httpsUrl.optional(),
            download: httpsUrl.optional(),
          })
          .default({}),
        cover: image(),
        featured: z.boolean().default(false),
        /**
         * Absent = draft. Only Arthur flips this to false: publishing is
         * his call, never the assistant's.
         */
        draft: z.boolean().default(true),
        /** Everything that is not Arthur's own work. Required, may be empty. */
        thirdParty: z.array(
          z.object({
            name: z.string().min(1),
            license: z.string().min(1),
            url: httpsUrl,
          }),
        ),
      })
      .superRefine((data, ctx) => {
        if (!data.demo && !data.links.repo && !data.links.download) {
          ctx.addIssue({
            code: 'custom',
            message: 'a project needs at least a demo, a repo link or a download link',
          });
        }
      }),
});

const projectsEn = defineCollection({
  loader: glob({ pattern: '*/en.md', base: './src/content/projects' }),
  schema: z.object(textFields),
});

export const collections = { projects, projectsEn };
