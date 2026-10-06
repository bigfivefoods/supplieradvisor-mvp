import type { CreditStatus } from '@/lib/credit/types';

const CUSTOMER_TRANSITIONS: Record<CreditStatus, CreditStatus[]> = {
  draft: ['submitted'],
  submitted: [],
  under_review: [],
  more_info_needed: ['submitted'],
  approved: [],
  declined: [],
};

const SUPPLIER_TRANSITIONS: Record<CreditStatus, CreditStatus[]> = {
  draft: [],
  submitted: ['under_review', 'more_info_needed', 'approved', 'declined'],
  under_review: ['more_info_needed', 'approved', 'declined'],
  more_info_needed: [],
  approved: [],
  declined: [],
};

export function canTransitionCreditStatus(opts: {
  actor: 'customer' | 'supplier';
  from: CreditStatus;
  to: CreditStatus;
}): boolean {
  const map = opts.actor === 'customer' ? CUSTOMER_TRANSITIONS : SUPPLIER_TRANSITIONS;
  return map[opts.from].includes(opts.to);
}

export function assertCreditStatusTransition(opts: {
  actor: 'customer' | 'supplier';
  from: CreditStatus;
  to: CreditStatus;
}): { ok: true } | { ok: false; status: 409; error: string } {
  if (canTransitionCreditStatus(opts)) return { ok: true };
  return {
    ok: false,
    status: 409,
    error: `Invalid transition (${opts.actor}): ${opts.from} -> ${opts.to}`,
  };
}
