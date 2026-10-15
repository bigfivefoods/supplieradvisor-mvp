/**
 * RecoverAdvisor® brand colours.
 * Cyan is the button fill only, with navy label text on it.
 * Deep cyan is for text or links on white. Never use the accent as small text on white.
 */
export const RECOVER_BRAND = {
  accent: '#00b4d8',
  accentDeep: '#0077b6',
  ink: '#0f172a',
  surface: '#f8fafc',
  line: '#e2e8f0',
  /** Hover keeps the same cyan. Darken with brightness, not a second hex. */
  accentHover: '#00b4d8',
} as const;

export const RECOVER_PRODUCT_NAME = 'RecoverAdvisor®';

export const RECOVER_DEMO_BANNER =
  'RecoverAdvisor® is in demo-data mode until data-location and operator-agreement sign-off is complete.';

export const RECOVER_PENDING_BANNER =
  'Database setup is pending. The RecoverAdvisor® migration is awaiting approval.';

export const RECOVER_UNAVAILABLE_BANNER = 'RecoverAdvisor® is not available yet.';
