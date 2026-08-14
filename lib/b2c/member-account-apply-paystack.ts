/**
 * Apply a verified Paystack charge to a member account ledger.
 */
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
} from '@/lib/b2c/load-company';
import {
  openChargesByIds,
  readMemberAccountStore,
  writeMemberAccountStore,
} from '@/lib/b2c/member-account';
import {
  confirmMemberAccountPayment,
  memberAccountMetaFromPaystack,
} from '@/lib/b2c/member-account-pay';

export async function applyMemberAccountPaystack(opts: {
  data: Record<string, unknown>;
  reference: string;
  amountCents?: number;
}): Promise<
  | { ok: true; companyId: number; paymentId: string }
  | { ok: false; error: string }
> {
  const parsed = memberAccountMetaFromPaystack(opts.data);
  if (!parsed.companyId) {
    return { ok: false, error: 'Missing company_id on payment' };
  }
  const company = await loadWalletCompany(parsed.companyId);
  if (!company) return { ok: false, error: 'Company not found' };
  let store = readMemberAccountStore(company.meta);
  if (
    store.payments.some(
      (p) =>
        p.paystack_ref === opts.reference && p.status === 'confirmed'
    )
  ) {
    return {
      ok: true,
      companyId: parsed.companyId,
      paymentId: store.payments.find((p) => p.paystack_ref === opts.reference)!
        .id,
    };
  }
  const pending = store.payments.find(
    (p) =>
      p.paystack_ref === opts.reference ||
      (parsed.paymentId && p.id === parsed.paymentId)
  );
  const chargeIds = pending?.charge_ids?.length
    ? pending.charge_ids
    : parsed.chargeIds;
  const charges = openChargesByIds(store, chargeIds);
  if (!charges.length) {
    return { ok: false, error: 'No open charges for this payment' };
  }
  const amountZar =
    opts.amountCents != null && Number.isFinite(opts.amountCents)
      ? opts.amountCents / 100
      : charges.reduce((n, c) => n + Number(c.amount_zar || 0), 0);
  const applied = await confirmMemberAccountPayment({
    companyId: parsed.companyId,
    store,
    charges,
    method: 'paystack',
    amountZar,
    reference: opts.reference,
    paystackRef: opts.reference,
    existingPaymentId: pending?.id || parsed.paymentId,
    memberName: pending?.member_name || charges[0]?.member_name,
    memberEmail: pending?.member_email || charges[0]?.member_email,
    memberUserId: pending?.member_user_id || charges[0]?.member_user_id,
    actorUserId: pending?.member_user_id || 'paystack:webhook',
  });
  await saveWalletCompanyMeta(
    parsed.companyId,
    writeMemberAccountStore(company.meta, applied.store)
  );
  return {
    ok: true,
    companyId: parsed.companyId,
    paymentId: applied.payment.id,
  };
}
