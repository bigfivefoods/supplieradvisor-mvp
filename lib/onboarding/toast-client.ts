/**
 * Client-side golden path feedback (sonner).
 */
import { toast } from 'sonner';

const DESCRIPTIONS: Record<string, string> = {
  profile: 'Company profile counted on your 3-day setup path.',
  team: 'Team invite counted on your 3-day setup path.',
  invite_partners: 'Partner invite counted on your 3-day setup path.',
  first_trade: 'First trade counted on your 3-day setup path.',
  billing: 'Billing review counted on your 3-day setup path.',
  rate_partner: 'Partner rating counted on your 3-day setup path.',
};

/**
 * Toast for a known golden-path step (call after a successful action).
 * Safe to call even if the step was already complete — keep messaging light.
 */
export function toastGoldenPathStep(
  step: string,
  opts?: { onlyIfNew?: boolean; newlyMarked?: string[] }
): void {
  if (opts?.onlyIfNew && opts.newlyMarked && !opts.newlyMarked.includes(step)) {
    return;
  }
  const description = DESCRIPTIONS[step] || 'Setup progress updated on the dashboard.';
  toast.message('Golden path updated', {
    description,
    duration: 4800,
  });
}

/** Prefer server-reported newlyMarked list when available */
export function toastGoldenPathFromResponse(data: unknown): void {
  const gp = (data as { goldenPath?: { newlyMarked?: string[] } })?.goldenPath;
  const list = gp?.newlyMarked;
  if (!Array.isArray(list) || !list.length) return;
  // One toast covering first new step (avoid spam if multiple)
  toastGoldenPathStep(list[0]);
}
