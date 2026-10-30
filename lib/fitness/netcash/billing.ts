import { addDays, daysInMonth, periodFor } from '@/lib/fitness/netcash/calendar';
import { addVatExclusive, applyDiscountBps, splitVatInclusive } from '@/lib/fitness/netcash/money';
import type {
  BillableMember,
  BillingLine,
  InvoiceLineDraft,
  Mandate,
  NetcashSettings,
} from '@/lib/fitness/netcash/types';

export type PricedMember = {
  member: BillableMember;
  planCents: number;
  addonCents: number;
  discountCents: number;
  prorataCents: number;
  feeCents: number;
  grossCents: number;
  netCents: number;
  vatCents: number;
  items: InvoiceLineDraft[];
  description: string;
};

function cadenceMatches(planBilling: string, cadence: NetcashSettings['cadence']): boolean {
  if (planBilling === 'pack' || planBilling === 'drop_in' || planBilling === 'annual') return false;
  if (cadence === 'monthly') return planBilling === 'monthly';
  if (cadence === 'weekly') return planBilling === 'weekly';
  return planBilling === 'monthly' || planBilling === 'weekly';
}

function prorataFactor(startDate: string | null, periodStart: string, periodEnd: string, alreadyBilled: boolean): number {
  if (alreadyBilled || !startDate || startDate <= periodStart || startDate > periodEnd) return 1;
  const [ys, ms] = periodStart.split('-').map(Number);
  const length = daysInMonth(ys, ms);
  const startDay = Number(startDate.slice(8, 10));
  const remaining = length - startDay + 1;
  if (remaining <= 0 || remaining >= length) return 1;
  return remaining / length;
}

export function priceMember(input: {
  member: BillableMember;
  settings: NetcashSettings;
  periodStart: string;
  periodEnd: string;
  alreadyBilled: boolean;
  lateFeeCents: number;
}): PricedMember | null {
  const plans = input.member.plans.filter((plan) => plan.cents > 0 && cadenceMatches(plan.billing, input.settings.cadence));
  const core = plans.filter((plan) => !plan.addon);
  const addons = plans.filter((plan) => plan.addon);
  if (!core.length && !addons.length) return null;
  const factor = prorataFactor(input.member.startDate, input.periodStart, input.periodEnd, input.alreadyBilled);
  const fullPlan = core.reduce((sum, plan) => sum + plan.cents, 0);
  const fullAddon = addons.reduce((sum, plan) => sum + plan.cents, 0);
  const planCents = Math.round(fullPlan * factor);
  const addonCents = Math.round(fullAddon * factor);
  const prorataCents = planCents + addonCents - fullPlan - fullAddon;
  const beforeDiscount = planCents + addonCents;
  const discounted = applyDiscountBps(beforeDiscount, input.member.discountBps);
  const discountCents = beforeDiscount - discounted;
  const feeCents = Math.max(0, input.lateFeeCents);
  const gross = discounted + feeCents;
  const vat = input.settings.pricesIncludeVat
    ? splitVatInclusive(gross, input.settings.vatBps)
    : addVatExclusive(gross, input.settings.vatBps);
  const grossCents = input.settings.pricesIncludeVat ? gross : vat.netCents + vat.vatCents;
  const items: InvoiceLineDraft[] = [];
  for (const plan of core) {
    const amount = Math.round(plan.cents * factor);
    items.push({
      description: factor < 1 ? `${plan.name} · pro-rata first month` : plan.name,
      quantity: 1,
      unitCents: amount,
      amountCents: amount,
      taxBps: input.settings.vatBps,
      accountCode: input.settings.glRevenueCode,
      kind: factor < 1 ? 'prorata' : 'plan',
    });
  }
  for (const plan of addons) {
    const amount = Math.round(plan.cents * factor);
    items.push({
      description: plan.name,
      quantity: 1,
      unitCents: amount,
      amountCents: amount,
      taxBps: input.settings.vatBps,
      accountCode: input.settings.glRevenueCode,
      kind: 'addon',
    });
  }
  if (discountCents > 0) {
    items.push({
      description: 'Discount',
      quantity: 1,
      unitCents: -discountCents,
      amountCents: -discountCents,
      taxBps: input.settings.vatBps,
      accountCode: input.settings.glRevenueCode,
      kind: 'discount',
    });
  }
  if (feeCents > 0) {
    items.push({
      description: 'Failed debit fee',
      quantity: 1,
      unitCents: feeCents,
      amountCents: feeCents,
      taxBps: input.settings.vatBps,
      accountCode: input.settings.glFeeCode,
      kind: 'late_fee',
    });
  }
  const names = [...core, ...addons].map((plan) => plan.name).join(', ');
  return {
    member: input.member,
    planCents,
    addonCents,
    discountCents,
    prorataCents,
    feeCents,
    grossCents,
    netCents: vat.netCents,
    vatCents: vat.vatCents,
    items,
    description: names || 'Membership',
  };
}

export function buildPreviewLines(input: {
  companyId: number;
  runId: string;
  settings: NetcashSettings;
  members: BillableMember[];
  mandates: Mandate[];
  periodStart: string;
  periodEnd: string;
  billedMemberIds: Set<string>;
  pendingFees: Map<string, number>;
  nowIso: string;
  id: () => string;
}): BillingLine[] {
  const activeMandates = new Map<string, Mandate>();
  for (const mandate of input.mandates) {
    if (mandate.status === 'active') activeMandates.set(mandate.memberId, mandate);
  }
  const lines: BillingLine[] = [];
  for (const member of input.members) {
    if (member.active === false) continue;
    const priced = priceMember({
      member,
      settings: input.settings,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      alreadyBilled: input.billedMemberIds.has(member.memberId),
      lateFeeCents: input.pendingFees.get(member.memberId) || 0,
    });
    if (!priced || priced.grossCents <= 0) continue;
    const mandate = activeMandates.get(member.memberId) || null;
    const variance =
      mandate != null &&
      !input.settings.allowAmountVariance &&
      Math.abs(mandate.amountCents - priced.grossCents) > 100;
    let status: BillingLine['collectionStatus'] = mandate ? 'scheduled' : 'skipped';
    let skipReason = mandate ? '' : 'No active debit order mandate.';
    if (variance) {
      status = 'review';
      skipReason = 'Invoice total differs from the signed mandate amount.';
    }
    lines.push({
      id: input.id(),
      companyId: input.companyId,
      runId: input.runId,
      mandateId: mandate?.id || null,
      memberId: member.memberId,
      memberName: member.name,
      memberEmail: member.email,
      memberPhone: member.phone,
      crmCustomerId: member.crmCustomerId,
      description: priced.description,
      planCents: priced.planCents,
      addonCents: priced.addonCents,
      discountCents: priced.discountCents,
      prorataCents: priced.prorataCents,
      feeCents: priced.feeCents,
      netCents: priced.netCents,
      vatCents: priced.vatCents,
      totalCents: priced.grossCents,
      items: priced.items,
      invoiceId: null,
      invoiceNumber: '',
      creditNoteId: null,
      creditNoteNumber: '',
      collectionStatus: status,
      skipReason,
      netcashReasonCode: '',
      netcashReasonText: '',
      retryOfLineId: null,
      attempt: 1,
      accessSuspended: false,
      notifiedAt: null,
      whatsappPath: '',
      idempotencyKey: `${input.runId}:${member.memberId}:1`,
      financeStatus: '',
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    });
  }
  return lines;
}

export function periodWindow(settings: NetcashSettings, sastDate: string) {
  return periodFor(settings.cadence, sastDate, settings.debitDay);
}

export function firstMonthProRataDays(startDate: string, periodStart: string): number {
  if (startDate <= periodStart) return daysInMonth(Number(periodStart.slice(0, 4)), Number(periodStart.slice(5, 7)));
  return Math.max(0, daysInMonth(Number(periodStart.slice(0, 4)), Number(periodStart.slice(5, 7))) - Number(startDate.slice(8, 10)) + 1);
}

export function dayAfter(iso: string): string {
  return addDays(iso, 1);
}
