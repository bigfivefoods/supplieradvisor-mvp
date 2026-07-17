/**
 * Paid CIPC verification SLA — money → trust timeline.
 * Target: badge (or clear mismatch/failed) within SLA_TARGET_HOURS of payment.
 */

export const CIPC_SLA_TARGET_HOURS = 24;
export const CIPC_SLA_WARN_HOURS = 4;
export const CIPC_SLA_CRITICAL_HOURS = 24;

export type VerificationSlaPhase =
  | 'unpaid'
  | 'paid_pending'
  | 'verified'
  | 'mismatch'
  | 'failed'
  | 'unknown';

export type VerificationSlaSnapshot = {
  phase: VerificationSlaPhase;
  verificationStatus: string;
  hasPayment: boolean;
  paystackReference: string | null;
  paidAt: string | null;
  checkedAt: string | null;
  verifiedAt: string | null;
  hoursSincePaid: number | null;
  slaTargetHours: number;
  /** true when paid and not terminal success/fail within target */
  slaBreached: boolean;
  /** true when paid, not verified, approaching/past warn threshold */
  slaAtRisk: boolean;
  customerMessage: string;
  nextActions: Array<{ id: string; label: string; href?: string }>;
  cipcName: string | null;
  nameMatch: string | null;
  lastError: string | null;
};

function parseIso(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v);
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function hoursBetween(fromIso: string | null, toMs = Date.now()): number | null {
  if (!fromIso) return null;
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return null;
  return Math.max(0, Math.round(((toMs - from) / 3600000) * 10) / 10);
}

/**
 * Build SLA snapshot from a profiles row (+ nested metadata.verification).
 */
export function buildVerificationSla(profile: {
  verification_status?: string | null;
  verification_payment_ref?: string | null;
  verified_at?: string | null;
  metadata?: unknown;
  updated_at?: string | null;
}): VerificationSlaSnapshot {
  const st = String(profile.verification_status || 'unverified').toLowerCase();
  const meta =
    profile.metadata && typeof profile.metadata === 'object'
      ? (profile.metadata as Record<string, unknown>)
      : {};
  const v =
    meta.verification && typeof meta.verification === 'object'
      ? (meta.verification as Record<string, unknown>)
      : {};

  const payRef =
    String(profile.verification_payment_ref || '').trim() ||
    String(v.paystack_reference || v.paystackReference || '').trim() ||
    null;
  const hasPayment = Boolean(payRef);

  const paidAt =
    parseIso(v.paid_at) ||
    parseIso(v.payment_at) ||
    (hasPayment
      ? parseIso(v.checked_at) || parseIso(profile.updated_at)
      : null);
  const checkedAt = parseIso(v.checked_at);
  const verifiedAt =
    parseIso(profile.verified_at) ||
    parseIso(v.verified_at) ||
    (st === 'verified' ? checkedAt : null);

  const hoursSincePaid = hoursBetween(paidAt);
  const cipcName =
    (v.company_name != null ? String(v.company_name) : null) ||
    (v.trade_name != null ? String(v.trade_name) : null);
  const nameMatch = v.name_match != null ? String(v.name_match) : null;
  const lastError = v.error != null ? String(v.error) : null;

  let phase: VerificationSlaPhase = 'unknown';
  if (st === 'verified') phase = 'verified';
  else if (st === 'mismatch') phase = 'mismatch';
  else if (st === 'failed') phase = 'failed';
  else if (hasPayment) phase = 'paid_pending';
  else if (!st || st === 'unverified' || st === 'pending')
    phase = hasPayment ? 'paid_pending' : 'unpaid';

  const terminal = phase === 'verified' || phase === 'mismatch' || phase === 'failed';
  const slaBreached =
    hasPayment &&
    !terminal &&
    hoursSincePaid != null &&
    hoursSincePaid >= CIPC_SLA_CRITICAL_HOURS;
  const slaAtRisk =
    hasPayment &&
    !terminal &&
    hoursSincePaid != null &&
    hoursSincePaid >= CIPC_SLA_WARN_HOURS;

  const nextActions: VerificationSlaSnapshot['nextActions'] = [];
  if (phase === 'unpaid') {
    nextActions.push({
      id: 'pay',
      label: 'Pay R69 CIPC verification',
      href: '/dashboard/my-business/profile#identity',
    });
  } else if (phase === 'paid_pending' || phase === 'failed') {
    nextActions.push({
      id: 'rerun',
      label: 'Re-run CIPC (no second charge)',
      href: '/dashboard/my-business/profile#identity',
    });
    nextActions.push({
      id: 'reg',
      label: 'Check registration / VAT number',
      href: '/dashboard/my-business/profile#identity',
    });
  } else if (phase === 'mismatch') {
    nextActions.push({
      id: 'apply_name',
      label: 'Apply CIPC name to profile',
      href: '/dashboard/my-business/profile#identity',
    });
  }

  let customerMessage = 'Complete paid CIPC verification to show a trust badge.';
  if (phase === 'verified') {
    customerMessage = 'Company verified — badge is live.';
  } else if (phase === 'mismatch') {
    customerMessage =
      'CIPC found a different legal name. Apply the CIPC name or re-check registration.';
  } else if (phase === 'failed') {
    customerMessage =
      lastError ||
      'CIPC check failed after payment. Re-run when registration/VAT is correct — no second charge.';
  } else if (phase === 'paid_pending') {
    if (slaBreached) {
      customerMessage = `Payment recorded ${hoursSincePaid}h ago — beyond our ${CIPC_SLA_TARGET_HOURS}h SLA. Re-run CIPC or open Profile → Identity; ops is alerted.`;
    } else if (slaAtRisk) {
      customerMessage = `Payment recorded ${hoursSincePaid}h ago. We aim for badge within ${CIPC_SLA_TARGET_HOURS}h — re-run CIPC if still pending.`;
    } else {
      customerMessage = `Payment received${hoursSincePaid != null ? ` ${hoursSincePaid}h ago` : ''}. CIPC is processing (target under ${CIPC_SLA_TARGET_HOURS}h).`;
    }
  }

  return {
    phase,
    verificationStatus: st || 'unverified',
    hasPayment,
    paystackReference: payRef,
    paidAt,
    checkedAt,
    verifiedAt,
    hoursSincePaid,
    slaTargetHours: CIPC_SLA_TARGET_HOURS,
    slaBreached,
    slaAtRisk,
    customerMessage,
    nextActions,
    cipcName,
    nameMatch,
    lastError,
  };
}
