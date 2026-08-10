/**
 * Self-serve reschedule / cancel rules for Advisor bookings.
 */

export type ReschedulePolicy = {
  /** Hours before start when free cancel/reschedule is allowed */
  free_change_hours: number;
  /** Allow member/patient portal reschedule */
  allow_self_serve: boolean;
  /** Fee in ZAR when outside free window (0 = blocked) */
  late_change_fee_zar: number;
  /** Block reschedule entirely when soft-blocked */
  block_if_soft_blocked?: boolean;
};

export const DEFAULT_RESCHEDULE_POLICY: ReschedulePolicy = {
  free_change_hours: 24,
  allow_self_serve: true,
  late_change_fee_zar: 0,
  block_if_soft_blocked: false,
};

export function normalizeReschedulePolicy(
  raw?: Partial<ReschedulePolicy> | null
): ReschedulePolicy {
  return {
    ...DEFAULT_RESCHEDULE_POLICY,
    ...(raw || {}),
    free_change_hours: Math.max(
      0,
      Number(raw?.free_change_hours ?? DEFAULT_RESCHEDULE_POLICY.free_change_hours) || 0
    ),
    late_change_fee_zar: Math.max(
      0,
      Number(raw?.late_change_fee_zar ?? 0) || 0
    ),
  };
}

export type RescheduleDecision = {
  allowed: boolean;
  free: boolean;
  fee_zar: number;
  hours_until_start: number | null;
  reason?: string;
};

export function evaluateReschedule(opts: {
  policy?: Partial<ReschedulePolicy> | null;
  eventDate: string;
  eventTime: string;
  personSoftBlocked?: boolean;
  now?: Date;
}): RescheduleDecision {
  const policy = normalizeReschedulePolicy(opts.policy);
  if (!policy.allow_self_serve) {
    return {
      allowed: false,
      free: false,
      fee_zar: 0,
      hours_until_start: null,
      reason: 'Self-serve reschedule is disabled by the practice',
    };
  }
  if (opts.personSoftBlocked && policy.block_if_soft_blocked) {
    return {
      allowed: false,
      free: false,
      fee_zar: 0,
      hours_until_start: null,
      reason: 'Account is restricted after repeated no-shows — contact the desk',
    };
  }
  const start = new Date(
    `${opts.eventDate}T${(opts.eventTime || '09:00').slice(0, 5)}:00`
  );
  if (Number.isNaN(start.getTime())) {
    return {
      allowed: false,
      free: false,
      fee_zar: 0,
      hours_until_start: null,
      reason: 'Invalid appointment time',
    };
  }
  const now = opts.now || new Date();
  const ms = start.getTime() - now.getTime();
  const hours = ms / 3600000;
  if (hours < 0) {
    return {
      allowed: false,
      free: false,
      fee_zar: 0,
      hours_until_start: hours,
      reason: 'Appointment is in the past',
    };
  }
  if (hours >= policy.free_change_hours) {
    return {
      allowed: true,
      free: true,
      fee_zar: 0,
      hours_until_start: Math.round(hours * 10) / 10,
    };
  }
  if (policy.late_change_fee_zar > 0) {
    return {
      allowed: true,
      free: false,
      fee_zar: policy.late_change_fee_zar,
      hours_until_start: Math.round(hours * 10) / 10,
      reason: `Late change fee of R${policy.late_change_fee_zar} applies`,
    };
  }
  return {
    allowed: false,
    free: false,
    fee_zar: 0,
    hours_until_start: Math.round(hours * 10) / 10,
    reason: `Changes must be made at least ${policy.free_change_hours}h before the appointment`,
  };
}
