/**
 * Commercial terms for contracted clinic practitioners.
 * Owner selects how the contractor is paid, the pay-in rate, and the
 * charge-out (patient / package) rate so the practice take is visible.
 */

export const CONTRACTOR_PAYMENT_METHODS = [
  'eft',
  'invoice',
  'cash',
  'card',
  'split',
  'medical_aid_split',
] as const;

export type ContractorPaymentMethod =
  (typeof CONTRACTOR_PAYMENT_METHODS)[number];

export const CONTRACTOR_PAYMENT_OPTIONS = [
  {
    id: 'per_session_eft',
    label: 'Per session · EFT',
    method: 'eft' as ContractorPaymentMethod,
    rate_basis: 'per_session',
    charge_out_basis: 'per_session',
    uses_share: false,
    description:
      'Pay the contractor a session rate by EFT after each consult. Charge patients and packages at your charge-out rate.',
  },
  {
    id: 'per_appointment_invoice',
    label: 'Per appointment · invoice',
    method: 'invoice' as ContractorPaymentMethod,
    rate_basis: 'per_appointment',
    charge_out_basis: 'per_appointment',
    uses_share: false,
    description:
      'Contractor invoices the practice per appointment. You bill the patient at charge-out.',
  },
  {
    id: 'weekly_invoice',
    label: 'Weekly invoice',
    method: 'invoice' as ContractorPaymentMethod,
    rate_basis: 'per_session',
    charge_out_basis: 'per_session',
    uses_share: false,
    description:
      'Contractor invoices weekly for sessions delivered that week.',
  },
  {
    id: 'monthly_invoice',
    label: 'Monthly invoice / retainer',
    method: 'invoice' as ContractorPaymentMethod,
    rate_basis: 'monthly',
    charge_out_basis: 'per_session',
    uses_share: false,
    description:
      'Monthly invoice (retainer or the month’s sessions). Charge-out stays per session or package.',
  },
  {
    id: 'locum_day_rate',
    label: 'Locum day rate',
    method: 'eft' as ContractorPaymentMethod,
    rate_basis: 'fixed',
    charge_out_basis: 'per_session',
    uses_share: false,
    description:
      'Fixed locum day rate paid by EFT. Charge-out remains per session or package.',
  },
  {
    id: 'hourly_locum',
    label: 'Hourly locum',
    method: 'eft' as ContractorPaymentMethod,
    rate_basis: 'hourly',
    charge_out_basis: 'hourly',
    uses_share: false,
    description: 'Hourly locum pay. Set a matching hourly charge-out.',
  },
  {
    id: 'package_block',
    label: 'Package / block rate',
    method: 'invoice' as ContractorPaymentMethod,
    rate_basis: 'package',
    charge_out_basis: 'package',
    uses_share: false,
    description:
      'Pay the contractor per care package or block of sessions. Charge-out is the package sell price.',
  },
  {
    id: 'revenue_share',
    label: 'Revenue share of charge-out',
    method: 'split' as ContractorPaymentMethod,
    rate_basis: 'per_session',
    charge_out_basis: 'per_session',
    uses_share: true,
    description:
      'Contractor takes an agreed % of what the patient is charged. The practice keeps the rest.',
  },
  {
    id: 'session_split',
    label: 'Session split (fee + share)',
    method: 'split' as ContractorPaymentMethod,
    rate_basis: 'per_session',
    charge_out_basis: 'per_session',
    uses_share: true,
    description:
      'Fixed contractor fee plus a % of charge-out. Practice keep is charge-out minus both.',
  },
  {
    id: 'retainer_plus_session',
    label: 'Retainer + per session',
    method: 'invoice' as ContractorPaymentMethod,
    rate_basis: 'monthly',
    charge_out_basis: 'per_session',
    uses_share: false,
    description:
      'Monthly retainer plus a per-session top-up. Put the session top-up in the pay rate and note the retainer.',
  },
] as const;

export type ContractorPaymentOptionId =
  (typeof CONTRACTOR_PAYMENT_OPTIONS)[number]['id'];

export type ContractorCommercialFields = {
  contractor_payment_option?: string | null;
  contractor_payment_method?: string | null;
  charge_out_zar?: number | null;
  charge_out_basis?: string | null;
  contractor_share_pct?: number | null;
};

export type ContractorCommercialDraft = {
  contractor_payment_option: string;
  contractor_payment_method: string;
  rate_zar: string;
  rate_basis: string;
  charge_out_zar: string;
  charge_out_basis: string;
  contractor_share_pct: string;
  rate_note: string;
};

const METHOD_LABELS: Record<string, string> = {
  eft: 'EFT / bank transfer',
  invoice: 'Contractor invoice',
  cash: 'Cash',
  card: 'Card',
  split: 'Split / revenue share',
  medical_aid_split: 'Medical-aid + patient split',
};

export function contractorPaymentMethodLabel(method?: string | null): string {
  const key = String(method || '').trim().toLowerCase();
  return METHOD_LABELS[key] || (key ? key.replace(/_/g, ' ') : '—');
}

export function contractorPaymentOptionById(id?: string | null) {
  const key = String(id || '').trim();
  return CONTRACTOR_PAYMENT_OPTIONS.find((o) => o.id === key) || null;
}

export function contractorPaymentOptionLabel(id?: string | null): string {
  return contractorPaymentOptionById(id)?.label || '';
}

export function optionUsesShare(id?: string | null): boolean {
  return contractorPaymentOptionById(id)?.uses_share === true;
}

export function formatClinicZar(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return `R${v.toLocaleString('en-ZA', {
    minimumFractionDigits: v % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatClinicRate(
  rateZar?: number | null,
  basis?: string | null
): string {
  if (rateZar == null || !Number.isFinite(Number(rateZar))) return '—';
  const b = String(basis || 'per_session').replace(/_/g, ' ');
  return `${formatClinicZar(Number(rateZar))} / ${b}`;
}

function finiteOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clampSharePct(n: number | null): number | null {
  if (n == null) return null;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export type ContractorTake = {
  contractorPay: number;
  chargeOut: number;
  practiceKeep: number;
  practiceKeepPct: number | null;
  comparable: boolean;
};

export function computeContractorTake(person: {
  rate_zar?: number | null;
  rate_basis?: string | null;
  charge_out_zar?: number | null;
  charge_out_basis?: string | null;
  contractor_share_pct?: number | null;
  contractor_payment_option?: string | null;
}): ContractorTake | null {
  const chargeOut = finiteOrNull(person.charge_out_zar);
  if (chargeOut == null || chargeOut < 0) return null;
  const option = contractorPaymentOptionById(person.contractor_payment_option);
  const sharePct = clampSharePct(finiteOrNull(person.contractor_share_pct));
  const payIn = finiteOrNull(person.rate_zar);
  let contractorPay = 0;
  if (option?.id === 'revenue_share') {
    if (sharePct == null) return null;
    contractorPay = (chargeOut * sharePct) / 100;
  } else if (option?.id === 'session_split') {
    contractorPay =
      (payIn || 0) + (sharePct != null ? (chargeOut * sharePct) / 100 : 0);
  } else {
    if (payIn == null) return null;
    contractorPay = payIn;
  }
  const practiceKeep = chargeOut - contractorPay;
  const practiceKeepPct =
    chargeOut > 0 ? (practiceKeep / chargeOut) * 100 : null;
  const payBasis = String(person.rate_basis || option?.rate_basis || '')
    .trim()
    .toLowerCase();
  const outBasis = String(
    person.charge_out_basis || option?.charge_out_basis || ''
  )
    .trim()
    .toLowerCase();
  const comparable =
    option?.id === 'revenue_share' ||
    option?.id === 'session_split' ||
    (!!payBasis && !!outBasis && payBasis === outBasis);
  return {
    contractorPay,
    chargeOut,
    practiceKeep,
    practiceKeepPct,
    comparable,
  };
}

export function formatContractorTake(take: ContractorTake | null): string {
  if (!take) return '';
  if (!take.comparable) {
    return `Pay ${formatClinicZar(take.contractorPay)} · Charge-out ${formatClinicZar(take.chargeOut)} · bases differ — unit take not comparable`;
  }
  const pct =
    take.practiceKeepPct != null
      ? ` (${take.practiceKeepPct.toFixed(take.practiceKeepPct % 1 ? 1 : 0)}%)`
      : '';
  return `Practice keeps ${formatClinicZar(take.practiceKeep)}${pct}`;
}

export function formatContractorCommercialLine(person: {
  rate_zar?: number | null;
  rate_basis?: string | null;
  rate_note?: string | null;
  contractor_payment_option?: string | null;
  contractor_payment_method?: string | null;
  charge_out_zar?: number | null;
  charge_out_basis?: string | null;
  contractor_share_pct?: number | null;
}): string {
  const option = contractorPaymentOptionLabel(person.contractor_payment_option);
  const method = contractorPaymentMethodLabel(
    person.contractor_payment_method
  );
  const pay = formatClinicRate(person.rate_zar, person.rate_basis);
  const out = formatClinicRate(person.charge_out_zar, person.charge_out_basis);
  const take = formatContractorTake(computeContractorTake(person));
  const share =
    optionUsesShare(person.contractor_payment_option) &&
    person.contractor_share_pct != null &&
    Number.isFinite(Number(person.contractor_share_pct))
      ? `${Number(person.contractor_share_pct)}% share`
      : '';
  const parts = [
    option || null,
    method !== '—' ? method : null,
    pay !== '—' ? `Pay ${pay}` : null,
    share || null,
    out !== '—' ? `Charge-out ${out}` : null,
    take || null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : pay;
}

export function emptyContractorCommercialDraft(
  defaults?: Partial<ContractorCommercialDraft>
): ContractorCommercialDraft {
  return {
    contractor_payment_option: '',
    contractor_payment_method: 'eft',
    rate_zar: '',
    rate_basis: 'per_session',
    charge_out_zar: '',
    charge_out_basis: 'per_session',
    contractor_share_pct: '',
    rate_note: '',
    ...defaults,
  };
}

export function draftFromContractorCommercial(person: {
  rate_zar?: number | null;
  rate_basis?: string | null;
  rate_note?: string | null;
  contractor_payment_option?: string | null;
  contractor_payment_method?: string | null;
  charge_out_zar?: number | null;
  charge_out_basis?: string | null;
  contractor_share_pct?: number | null;
}): ContractorCommercialDraft {
  return {
    contractor_payment_option: String(person.contractor_payment_option || ''),
    contractor_payment_method: String(
      person.contractor_payment_method || 'eft'
    ),
    rate_zar:
      person.rate_zar != null && Number.isFinite(Number(person.rate_zar))
        ? String(person.rate_zar)
        : '',
    rate_basis: String(person.rate_basis || 'per_session'),
    charge_out_zar:
      person.charge_out_zar != null &&
      Number.isFinite(Number(person.charge_out_zar))
        ? String(person.charge_out_zar)
        : '',
    charge_out_basis: String(person.charge_out_basis || 'per_session'),
    contractor_share_pct:
      person.contractor_share_pct != null &&
      Number.isFinite(Number(person.contractor_share_pct))
        ? String(person.contractor_share_pct)
        : '',
    rate_note: person.rate_note || '',
  };
}

export function applyContractorPaymentOption(
  draft: ContractorCommercialDraft,
  optionId: string
): ContractorCommercialDraft {
  const option = contractorPaymentOptionById(optionId);
  if (!option) {
    return { ...draft, contractor_payment_option: optionId };
  }
  return {
    ...draft,
    contractor_payment_option: option.id,
    contractor_payment_method: option.method,
    rate_basis: option.rate_basis,
    charge_out_basis: option.charge_out_basis,
  };
}

export function recordFromContractorCommercialDraft(
  draft: ContractorCommercialDraft
): ContractorCommercialFields & {
  rate_zar: number | null;
  rate_basis: string;
  rate_note: string;
} {
  return {
    contractor_payment_option: draft.contractor_payment_option || null,
    contractor_payment_method: draft.contractor_payment_method || null,
    rate_zar: draft.rate_zar === '' ? null : Number(draft.rate_zar),
    rate_basis: draft.rate_basis || 'per_session',
    charge_out_zar:
      draft.charge_out_zar === '' ? null : Number(draft.charge_out_zar),
    charge_out_basis: draft.charge_out_basis || 'per_session',
    contractor_share_pct:
      draft.contractor_share_pct === ''
        ? null
        : Number(draft.contractor_share_pct),
    rate_note: draft.rate_note || '',
  };
}

export function validateContractorCommercialDraft(
  draft: ContractorCommercialDraft
): string | null {
  if (draft.rate_zar !== '' && Number.isNaN(Number(draft.rate_zar))) {
    return 'Contractor rate must be a number (ZAR)';
  }
  if (
    draft.charge_out_zar !== '' &&
    Number.isNaN(Number(draft.charge_out_zar))
  ) {
    return 'Charge-out must be a number (ZAR)';
  }
  if (
    draft.contractor_share_pct !== '' &&
    Number.isNaN(Number(draft.contractor_share_pct))
  ) {
    return 'Contractor share must be a number';
  }
  if (draft.contractor_share_pct !== '') {
    const n = Number(draft.contractor_share_pct);
    if (n < 0 || n > 100) return 'Contractor share must be between 0 and 100';
  }
  return null;
}

function mergeOptionalString(
  rec: Record<string, unknown>,
  prev: ContractorCommercialFields | null | undefined,
  key: keyof ContractorCommercialFields
): string | null | undefined {
  if (rec[key] !== undefined) {
    const v = rec[key];
    if (v == null || v === '') return null;
    return String(v);
  }
  return prev?.[key] ?? null;
}

export function mergeContractorCommercialFromRecord(
  prev: ContractorCommercialFields | null | undefined,
  rec: Record<string, unknown>
): ContractorCommercialFields {
  return {
    contractor_payment_option: mergeOptionalString(
      rec,
      prev,
      'contractor_payment_option'
    ),
    contractor_payment_method: mergeOptionalString(
      rec,
      prev,
      'contractor_payment_method'
    ),
    charge_out_zar:
      rec.charge_out_zar !== undefined
        ? finiteOrNull(rec.charge_out_zar)
        : prev?.charge_out_zar ?? null,
    charge_out_basis: mergeOptionalString(rec, prev, 'charge_out_basis'),
    contractor_share_pct:
      rec.contractor_share_pct !== undefined
        ? clampSharePct(finiteOrNull(rec.contractor_share_pct))
        : prev?.contractor_share_pct ?? null,
  };
}

export function snapshotContractorCommercial(person: {
  rate_zar?: number | null;
  rate_basis?: string | null;
} & ContractorCommercialFields): ContractorCommercialFields & {
  rate_zar?: number | null;
  rate_basis?: string;
} {
  return {
    rate_zar:
      person.rate_zar != null && Number.isFinite(Number(person.rate_zar))
        ? Number(person.rate_zar)
        : null,
    rate_basis: person.rate_basis || undefined,
    contractor_payment_option: person.contractor_payment_option || undefined,
    contractor_payment_method: person.contractor_payment_method || undefined,
    charge_out_zar:
      person.charge_out_zar != null &&
      Number.isFinite(Number(person.charge_out_zar))
        ? Number(person.charge_out_zar)
        : null,
    charge_out_basis: person.charge_out_basis || undefined,
    contractor_share_pct:
      person.contractor_share_pct != null &&
      Number.isFinite(Number(person.contractor_share_pct))
        ? Number(person.contractor_share_pct)
        : null,
  };
}

export function summariseContractorCommercial(
  people: Array<
    {
      engagement?: string | null;
      active?: boolean;
      end_date?: string | null;
      rate_zar?: number | null;
      rate_basis?: string | null;
    } & ContractorCommercialFields
  >
): { contractors: number; withTake: number; avgKeep: number | null } {
  const contractors = people.filter((p) => {
    const raw = String(p.engagement || 'contractor').toLowerCase();
    const isContractor = raw !== 'employed' && raw !== 'permanent';
    return isContractor && p.active !== false && !p.end_date;
  });
  const takes = contractors
    .map((p) => computeContractorTake(p))
    .filter((t): t is ContractorTake => !!t && t.comparable);
  const avgKeep =
    takes.length > 0
      ? takes.reduce((s, t) => s + t.practiceKeep, 0) / takes.length
      : null;
  return {
    contractors: contractors.length,
    withTake: takes.length,
    avgKeep,
  };
}
