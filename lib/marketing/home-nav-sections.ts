/**
 * Homepage navbar targets that live in the lazy below-fold island.
 * Keep this list aligned with LandingNav section hrefs.
 */
export const LAZY_HOME_SECTION_IDS = [
  'video',
  'member-app',
  'why-join',
  'modules',
  'packaging',
  'pricing',
  'roi',
  'industries',
] as const;

export type LazyHomeSectionId = (typeof LAZY_HOME_SECTION_IDS)[number];

/** Marks a stand-in node so scroll waits for the real section. */
export const HOME_ANCHOR_PLACEHOLDER_ATTR = 'data-sa-anchor-placeholder';

/** Wraps the lazy island so scroll can watch it grow. */
export const HOME_BELOW_FOLD_ATTR = 'data-home-below-fold';

const revealers = new Set<() => void>();
let revealRequested = false;

export function isLazyHomeSection(id: string): id is LazyHomeSectionId {
  return (LAZY_HOME_SECTION_IDS as readonly string[]).includes(id);
}

/** Ask the below-fold island to mount. Safe to call before it subscribes. */
export function requestHomeBelowFold() {
  if (typeof window === 'undefined') return;
  revealRequested = true;
  for (const reveal of revealers) reveal();
}

export function subscribeHomeBelowFold(reveal: () => void) {
  revealers.add(reveal);
  if (revealRequested) reveal();
  return () => {
    revealers.delete(reveal);
  };
}

export function isHomeSectionId(id: string) {
  return /^[A-Za-z][\w-]*$/.test(id);
}
