import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;
export type ProjectEn = CollectionEntry<'projectsEn'>;

/** Folder name = URL slug (entry ids look like "<slug>/fr"). */
export function projectSlug(entry: Project | ProjectEn): string {
  return entry.id.split('/')[0]!;
}

/**
 * Published projects, newest first. Drafts are only visible in dev —
 * production and host preview builds never include them.
 */
export async function getPublishedProjects(): Promise<Project[]> {
  // TEST_NO_PROJECTS=1 simulates the launch state (zero published
  // projects) for scripts/test-states.mjs — never set it elsewhere.
  if (process.env.TEST_NO_PROJECTS === '1') return [];
  const all = await getCollection('projects', ({ data }) =>
    import.meta.env.PROD ? data.draft === false : true,
  );
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** English text of a project; verify-content.mjs guarantees it exists. */
export async function getEnglishText(slug: string): Promise<ProjectEn> {
  const entry = await getEntry('projectsEn', `${slug}/en`);
  if (!entry) throw new Error(`Missing en.md for project "${slug}"`);
  return entry;
}

/** The public URL of a project's demo, or null. */
export function demoUrl(entry: Project): string | null {
  if (!entry.data.demo) return null;
  return entry.data.demo === 'internal' ? `/demos/${projectSlug(entry)}/` : entry.data.demo;
}
