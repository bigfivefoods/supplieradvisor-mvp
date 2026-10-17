/**
 * Last-active stamp for business_users.
 * The team page shows this as minutes ("5 min ago"), so the floor stays
 * five minutes. A coarser gap would make that minute readout lie.
 */
export const MEMBER_ACTIVITY_TOUCH_MS = 5 * 60 * 1000;

export type ActivityTouchDecision = {
  write: boolean;
  reason: 'invalid' | 'stored-recent' | 'memo' | 'due';
};

export function activityTouchDecision(opts: {
  memberId: number;
  lastActiveAt?: string | null;
  now: number;
  lastScheduledAt?: number;
  intervalMs?: number;
}): ActivityTouchDecision {
  const interval = opts.intervalMs ?? MEMBER_ACTIVITY_TOUCH_MS;
  if (!Number.isFinite(opts.memberId) || opts.memberId <= 0) {
    return { write: false, reason: 'invalid' };
  }
  const scheduledAt = opts.lastScheduledAt || 0;
  if (scheduledAt > 0 && opts.now - scheduledAt < interval) {
    return { write: false, reason: 'memo' };
  }
  if (opts.lastActiveAt) {
    const stored = Date.parse(opts.lastActiveAt);
    if (Number.isFinite(stored) && opts.now - stored < interval) {
      return { write: false, reason: 'stored-recent' };
    }
  }
  return { write: true, reason: 'due' };
}
