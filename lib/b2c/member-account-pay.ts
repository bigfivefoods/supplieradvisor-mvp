/**
 * Confirm a member-account payment (Paystack or desk-approved POP).
 */
import {
  applyConfirmedPayment,
  newMemberAccountId,
} from '@/lib/b2c/member-account';
import type { MemberAccountStore } from '@/lib/b2c/member-account-types';
import { applyInvoicePayment } from '@/lib/b2c/member-account-ar';
import { notifyAdvisorOfMemberPayment } from '@/lib/b2c/member-account-notify';
import {
  KIND_TO_MODULE,
  type MemberAccountCharge,
  type MemberAccountPayment,
  type MemberPaymentMethod,
} from '@/lib/b2c/member-account-types';
import { formatZar } from '@/lib/b2c/member-account-types';

export function deskPathForKind(kind: string): string {
  const module = KIND_TO_MODULE[kind as keyof typeof KIND_TO_MODULE];
  if (module) return `/dashboard/${module}/accounts`;
  return '/dashboard/customers/money';
}

export async function confirmMemberAccountPayment(opts: {
  companyId: number;
  store: MemberAccountStore;
  charges: MemberAccountCharge[];
  method: MemberPaymentMethod;
  amountZar: number;
  reference?: string | null;
  paystackRef?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  actorUserId?: string | null;
  memberName?: string | null;
  memberEmail?: string | null;
  memberUserId?: string | null;
  existingPaymentId?: string | null;
}): Promise<{ store: MemberAccountStore; payment: MemberAccountPayment }> {
  const now = new Date().toISOString();
  const first = opts.charges[0];
  const payment: MemberAccountPayment = {
    id: opts.existingPaymentId || newMemberAccountId('map'),
    charge_ids: opts.charges.map((c) => c.id),
    amount_zar: Math.round(opts.amountZar * 100) / 100,
    method: opts.method,
    status: 'confirmed',
    reference: opts.reference || opts.paystackRef || null,
    paystack_ref: opts.paystackRef || null,
    proof_url: opts.proofUrl || null,
    notes: opts.notes || null,
    paid_at: now,
    confirmed_at: now,
    confirmed_by: opts.actorUserId || null,
    member_name: opts.memberName || first?.member_name || null,
    member_email: opts.memberEmail || first?.member_email || null,
    member_user_id: opts.memberUserId || first?.member_user_id || null,
    kind: first?.kind,
    ref_id: first?.ref_id || null,
  };

  for (const charge of opts.charges) {
    if (!charge.invoice_id) continue;
    const share =
      opts.charges.length === 1
        ? payment.amount_zar
        : Number(charge.amount_zar) || 0;
    await applyInvoicePayment({
      companyId: opts.companyId,
      invoiceId: charge.invoice_id,
      amount: share,
      method: opts.method,
      reference: payment.reference,
      proofUrl: payment.proof_url,
      notes: `Member account ${charge.id}`,
      actorUserId: opts.actorUserId,
      customerId: charge.customer_id,
    });
  }

  const next = applyConfirmedPayment(opts.store, payment);
  const name = payment.member_name || 'Member';
  await notifyAdvisorOfMemberPayment({
    companyId: opts.companyId,
    title:
      opts.method === 'pop'
        ? 'Proof of payment confirmed'
        : 'Member payment received',
    body: `${name} paid ${formatZar(payment.amount_zar)} on their Advisor account${
      payment.reference ? ` (${payment.reference})` : ''
    }.`,
    amountZar: payment.amount_zar,
    memberName: name,
    method: opts.method,
    reference: payment.reference,
    deskPath: deskPathForKind(first?.kind || 'gym'),
    actorUserId: opts.actorUserId,
  });

  return { store: next, payment };
}

export function isMemberAccountPaystack(data: Record<string, unknown>): boolean {
  const ref = String(data.reference || '');
  if (ref.startsWith('sa-memacc-')) return true;
  const meta = data.metadata;
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  const product = String(m.product || '').toLowerCase();
  if (product === 'member_account') return true;
  if (Array.isArray(m.custom_fields)) {
    for (const f of m.custom_fields as Array<Record<string, unknown>>) {
      if (
        String(f.variable_name || '') === 'product' &&
        String(f.value || '').toLowerCase() === 'member_account'
      ) {
        return true;
      }
    }
  }
  return false;
}

export function memberAccountMetaFromPaystack(data: Record<string, unknown>): {
  companyId: number | null;
  paymentId: string | null;
  chargeIds: string[];
} {
  const meta =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : {};
  let companyId =
    meta.company_id != null && Number.isFinite(Number(meta.company_id))
      ? Number(meta.company_id)
      : null;
  let paymentId = meta.payment_id ? String(meta.payment_id) : null;
  let chargeIds = String(meta.charge_ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (Array.isArray(meta.custom_fields)) {
    for (const f of meta.custom_fields as Array<Record<string, unknown>>) {
      const vn = String(f.variable_name || '');
      if (vn === 'company_id' && !companyId) {
        const n = Number(f.value);
        if (Number.isFinite(n)) companyId = n;
      }
      if (vn === 'payment_id' && !paymentId) paymentId = String(f.value || '');
      if (vn === 'charge_ids' && !chargeIds.length) {
        chargeIds = String(f.value || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }
  return { companyId, paymentId, chargeIds };
}
