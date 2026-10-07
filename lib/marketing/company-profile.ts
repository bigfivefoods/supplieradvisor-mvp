/**
 * Downloadable A4 company profile (static file in /public).
 * Rebuild with `npm run profile:pdf` (scripts/company-profile/build.mjs).
 *
 * Linked only from server-rendered marketing pages (/pricing, /industries),
 * never from the home page `/` bundle.
 */
export const COMPANY_PROFILE_PDF = {
  href: '/supplieradvisor-company-profile.pdf',
  label: 'Download company profile (PDF)',
  /** Shown next to the link so visitors know what they are getting. */
  meta: 'A4 · 15 pages · 0.9 MB',
} as const;
