/**
 * Brief 118: what SubscriptionAccessBanner should show.
 * `none` is not expiry. The company has not been given a trial yet.
 */
import type { CompanySubscriptionInfo } from './company-subscription';

export type AccessBannerState =
  | 'hidden'
  | 'resolving'
  | 'start_trial'
  | 'locked'
  | 'ending_soon';

export function bannerState(
  sub: CompanySubscriptionInfo | null | undefined,
  opts: { startAttempted: boolean }
): AccessBannerState {
  if (!sub || sub.isLifetime) return 'hidden';
  if (sub.status === 'none' && !opts.startAttempted) return 'resolving';
  if (sub.status === 'none') return 'start_trial';
  if (!sub.hasAccess) return 'locked';
  if (sub.daysRemaining != null && sub.daysRemaining <= 7) return 'ending_soon';
  return 'hidden';
}
