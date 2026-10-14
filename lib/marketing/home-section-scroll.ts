import {
  HOME_ANCHOR_PLACEHOLDER_ATTR,
  HOME_BELOW_FOLD_ATTR,
  isHomeSectionId,
  requestHomeBelowFold,
} from '@/lib/marketing/home-nav-sections';

const ALIGN_PX = 8;
const STABLE_MS = 450;
const MAX_WAIT_MS = 30_000;

type ScrollMode = 'auto' | 'smooth' | 'instant';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Sticky marketing header height, including the safe-area padding. */
export function navOffsetPx() {
  const header = document.querySelector<HTMLElement>('[data-landing-nav]');
  if (header) return header.getBoundingClientRect().height;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--sa-nav-offset').trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 68;
}

/** The real section, skipping the stable placeholder that shares its id. */
export function realSection(id: string): HTMLElement | null {
  if (!isHomeSectionId(id)) return null;
  const nodes = document.querySelectorAll<HTMLElement>(`[id="${id}"]`);
  for (const el of nodes) {
    if (!el.hasAttribute(HOME_ANCHOR_PLACEHOLDER_ATTR)) return el;
  }
  return null;
}

function sectionDelta(el: HTMLElement) {
  return el.getBoundingClientRect().top - navOffsetPx();
}

/**
 * Put the section's top edge just under the sticky header.
 * `instant` ignores html.sa-smooth-scroll so a correction does not
 * animate across a document that is still growing.
 */
export function scrollToSection(id: string, behavior: ScrollMode = 'instant'): boolean {
  const motion: ScrollMode = prefersReducedMotion() ? 'instant' : behavior;
  if (id === 'platform') {
    window.scrollTo({ top: 0, behavior: motion as ScrollBehavior });
    return true;
  }
  const el = realSection(id);
  if (!el) return false;
  const top = Math.max(0, window.scrollY + el.getBoundingClientRect().top - navOffsetPx());
  window.scrollTo({ top, behavior: motion as ScrollBehavior });
  return true;
}

let cancelActiveScroll: (() => void) | null = null;

/**
 * Mount the lazy island when the target is not in the DOM yet, then keep
 * the section under the sticky header until layout settles.
 */
export function revealAndScroll(id: string, behavior: ScrollMode = 'instant') {
  if (!isHomeSectionId(id)) return;
  cancelActiveScroll?.();

  if (!realSection(id)) requestHomeBelowFold();

  let finished = false;
  let aligned = false;
  let userMoved = false;
  let armed = false;
  let quiet = 0;
  let cap = 0;

  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(quiet);
    window.clearTimeout(cap);
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener('wheel', onUser);
    window.removeEventListener('touchmove', onUser);
    window.removeEventListener('keydown', onUser);
    if (cancelActiveScroll === finish) cancelActiveScroll = null;
  };

  const onUser = () => {
    userMoved = true;
    finish();
  };

  const isSettled = (el: HTMLElement) =>
    Math.abs(sectionDelta(el)) <= ALIGN_PX && el.getBoundingClientRect().height > 24;

  const align = (nextBehavior: ScrollMode) => {
    if (finished || userMoved) return false;
    const el = realSection(id);
    if (!el) return false;
    if (isSettled(el)) return true;
    scrollToSection(id, aligned ? 'instant' : nextBehavior);
    aligned = true;
    return isSettled(el);
  };

  const scheduleQuiet = () => {
    window.clearTimeout(quiet);
    quiet = window.setTimeout(() => {
      if (align('instant')) finish();
    }, STABLE_MS);
  };

  const onLayout = () => {
    if (!armed || finished || userMoved) return;
    align(aligned ? 'instant' : behavior);
    if (realSection(id)) scheduleQuiet();
  };

  window.addEventListener('wheel', onUser, { passive: true });
  window.addEventListener('touchmove', onUser, { passive: true });
  window.addEventListener('keydown', onUser);

  const root =
    document.querySelector<HTMLElement>(`[${HOME_BELOW_FOLD_ATTR}]`) ?? document.body;
  const resizeObserver = new ResizeObserver(onLayout);
  resizeObserver.observe(root);
  const mutationObserver = new MutationObserver(onLayout);
  mutationObserver.observe(root, { childList: true, subtree: true });

  const present = Boolean(realSection(id));
  align(present ? behavior : 'instant');
  if (present) scheduleQuiet();

  window.requestAnimationFrame(() => {
    armed = true;
    onLayout();
  });

  cap = window.setTimeout(() => {
    align('instant');
    finish();
  }, MAX_WAIT_MS);

  cancelActiveScroll = finish;
}
