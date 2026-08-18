/**
 * Advisor desk — member accounts (charges, POP confirm, bill suggestions).
 * GET  ?companyId=&module=
 * POST { action, companyId, module, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
} from '@/lib/b2c/load-company';
import {
  addCharge,
  collectSuggestions,
  existingSourceIds,
  patchCharge,
  patchPayment,
  readMemberAccountStore,
  reopenCharges,
  suggestionToCharge,
  writeMemberAccountStore,
} from '@/lib/b2c/member-account';
import { attachInvoiceToCharge } from '@/lib/b2c/member-account-ar';
import { confirmMemberAccountPayment } from '@/lib/b2c/member-account-pay';
import {
  MODULE_TO_KIND,
  chargeBalance,
  isAdvisorAccountModule,
  type AdvisorAccountKind,
  type MemberAccountCharge,
} from '@/lib/b2c/member-account-types';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readHiregraphFromMetadata } from '@/lib/hire/hiregraph';
import { readRetailgraphFromMetadata } from '@/lib/retail/retailgraph';
import {
  publicAdvisorPayout,
  readAdvisorPayout,
} from '@/lib/billing/advisor-payout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MemberOpt = {
  ref_id: string;
  name: string;
  email?: string | null;
};

function listMembers(
  module: string,
  meta: Record<string, unknown>
): MemberOpt[] {
  if (module === 'fitgraph') {
    return (readFitgraphFromMetadata(meta).clients || []).map((c) => ({
      ref_id: c.id,
      name: c.name,
      email: c.email || null,
    }));
  }
  if (module === 'retailgraph') {
    return (readRetailgraphFromMetadata(meta).customers || []).map((c) => ({
      ref_id: c.id,
      name: c.name,
      email: c.email || null,
    }));
  }
  if (module === 'hiregraph') {
    const store = readHiregraphFromMetadata(meta);
    const seen = new Map<string, MemberOpt>();
    for (const b of store.bookings || []) {
      const id = String(b.crm_customer_id || b.customer_id || '');
      if (!id || seen.has(id)) continue;
      seen.set(id, {
        ref_id: id,
        name: b.customer_name || `Customer ${id}`,
        email: null,
      });
    }
    return [...seen.values()];
  }
  const store =
    module === 'physiograph'
      ? readPhysiographFromMetadata(meta)
      : module === 'dentalgraph'
        ? readDentalgraphFromMetadata(meta)
        : module === 'psychiatrygraph'
          ? readPsychiatrygraphFromMetadata(meta)
          : readMedicalgraphFromMetadata(meta);
  return (store.patients || []).map((p) => ({
    ref_id: p.id,
    name: p.name,
    email: p.email || null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const moduleRaw = request.nextUrl.searchParams.get('module');
    if (!Number.isFinite(companyId) || !isAdvisorAccountModule(moduleRaw)) {
      return NextResponse.json(
        { error: 'companyId and module required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const company = await loadWalletCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const store = readMemberAccountStore(company.meta);
    const kind = MODULE_TO_KIND[moduleRaw];
    const charges = store.charges.filter((c) => c.kind === kind);
    const chargeIds = new Set(charges.map((c) => c.id));
    const payments = store.payments.filter((p) =>
      (p.charge_ids || []).some((id) => chargeIds.has(id))
    );
    const billed = existingSourceIds(store);
    const suggestions = collectSuggestions(moduleRaw, company.meta).filter(
      (s) => !billed.has(s.source_id)
    );
    const members = listMembers(moduleRaw, company.meta);
    const openZar = charges.reduce((n, c) => n + chargeBalance(c), 0);
    const pendingZar = charges
      .filter((c) => c.status === 'pending_pop')
      .reduce((n, c) => n + (Number(c.amount_zar) || 0), 0);
    const paidZar = charges
      .filter((c) => c.status === 'paid')
      .reduce((n, c) => n + (Number(c.amount_zar) || 0), 0);

    return NextResponse.json({
      success: true,
      kind,
      charges,
      payments,
      suggestions,
      members,
      payout: publicAdvisorPayout(readAdvisorPayout(company.meta)),
      kpis: {
        open_zar: openZar,
        pending_zar: pendingZar,
        paid_zar: paidZar,
        pending_pops: payments.filter((p) => p.status === 'pending' && p.method === 'pop')
          .length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    const moduleRaw = body.module;
    if (!Number.isFinite(companyId) || !isAdvisorAccountModule(moduleRaw)) {
      return NextResponse.json(
        { error: 'companyId and module required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const company = await loadWalletCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    let store = readMemberAccountStore(company.meta);
    const kind = MODULE_TO_KIND[moduleRaw];
    const action = String(body.action || '');

    const persist = async () => {
      await saveWalletCompanyMeta(
        companyId,
        writeMemberAccountStore(company.meta, store)
      );
    };

    if (action === 'raise') {
      const refId = String(body.ref_id || '').trim();
      const amount = Number(body.amount_zar);
      const description = String(body.description || '').trim();
      if (!refId || !description || !(amount > 0)) {
        return NextResponse.json(
          { error: 'Member, description and amount required' },
          { status: 400 }
        );
      }
      const members = listMembers(moduleRaw, company.meta);
      const member = members.find((m) => m.ref_id === refId);
      const sourceRaw = String(body.source || 'desk');
      const source: MemberAccountCharge['source'] = (
        [
          'desk',
          'subscription',
          'visit',
          'hire',
          'pack',
          'till',
        ] as const
      ).includes(sourceRaw as MemberAccountCharge['source'])
        ? (sourceRaw as MemberAccountCharge['source'])
        : 'desk';
      let charge: MemberAccountCharge = {
        ...suggestionToCharge({
          source,
          source_id: body.source_id
            ? String(body.source_id)
            : `desk:${Date.now()}`,
          kind,
          ref_id: refId,
          member_name: String(body.member_name || member?.name || 'Member'),
          member_email: body.member_email
            ? String(body.member_email)
            : member?.email || null,
          description,
          amount_zar: amount,
          due_date: body.due_date ? String(body.due_date) : null,
        }),
        created_by: gate.userId,
      };
      charge = await attachInvoiceToCharge(companyId, charge);
      store = addCharge(store, charge);
      await persist();
      return NextResponse.json({
        success: true,
        charge,
        message: charge.invoice_number
          ? `Charged ${charge.member_name} · ${charge.invoice_number}`
          : `Charged ${charge.member_name}`,
      });
    }

    if (action === 'bill_suggestion') {
      const sourceId = String(body.source_id || '');
      const suggestions = collectSuggestions(moduleRaw, company.meta);
      const billed = existingSourceIds(store);
      const match = suggestions.find(
        (s) => s.source_id === sourceId && !billed.has(s.source_id)
      );
      if (!match) {
        return NextResponse.json(
          { error: 'Suggestion not found or already billed' },
          { status: 404 }
        );
      }
      let charge = {
        ...suggestionToCharge(match, gate.userId),
      };
      charge = await attachInvoiceToCharge(companyId, charge);
      store = addCharge(store, charge);
      await persist();
      return NextResponse.json({
        success: true,
        charge,
        message: `Added ${charge.description} to ${charge.member_name}`,
      });
    }

    if (action === 'bill_all_suggestions') {
      const billed = existingSourceIds(store);
      const suggestions = collectSuggestions(moduleRaw, company.meta).filter(
        (s) => !billed.has(s.source_id)
      );
      let n = 0;
      for (const s of suggestions) {
        let charge = suggestionToCharge(s, gate.userId);
        charge = await attachInvoiceToCharge(companyId, charge);
        store = addCharge(store, charge);
        n += 1;
      }
      await persist();
      return NextResponse.json({
        success: true,
        billed: n,
        message: n
          ? `Added ${n} charge${n === 1 ? '' : 's'} to member accounts`
          : 'Nothing new to bill',
      });
    }

    if (action === 'void') {
      const chargeId = String(body.charge_id || '');
      const charge = store.charges.find((c) => c.id === chargeId);
      if (!charge || charge.kind !== kind) {
        return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
      }
      if (charge.status === 'paid') {
        return NextResponse.json(
          { error: 'Cannot void a paid charge' },
          { status: 400 }
        );
      }
      store = patchCharge(store, chargeId, { status: 'void' });
      await persist();
      return NextResponse.json({ success: true, message: 'Charge voided' });
    }

    if (action === 'confirm_pop' || action === 'confirm_cash') {
      const paymentId = String(body.payment_id || '');
      const payment = store.payments.find((p) => p.id === paymentId);
      if (!payment || payment.status !== 'pending') {
        return NextResponse.json(
          { error: 'Pending payment not found' },
          { status: 404 }
        );
      }
      const charges = store.charges.filter((c) =>
        payment.charge_ids.includes(c.id)
      );
      if (!charges.length) {
        return NextResponse.json({ error: 'Charges missing' }, { status: 404 });
      }
      const applied = await confirmMemberAccountPayment({
        companyId,
        store,
        charges,
        method: action === 'confirm_cash' ? 'cash' : payment.method,
        amountZar: payment.amount_zar,
        reference: payment.reference,
        paystackRef: payment.paystack_ref,
        proofUrl: payment.proof_url,
        notes: payment.notes,
        actorUserId: gate.userId,
        existingPaymentId: payment.id,
        memberName: payment.member_name,
        memberEmail: payment.member_email,
        memberUserId: payment.member_user_id,
      });
      store = applied.store;
      await persist();
      return NextResponse.json({
        success: true,
        message: 'Payment recorded on the account',
      });
    }

    if (action === 'reject_pop') {
      const paymentId = String(body.payment_id || '');
      const payment = store.payments.find((p) => p.id === paymentId);
      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }
      store = patchPayment(store, paymentId, {
        status: 'rejected',
        confirmed_at: new Date().toISOString(),
        confirmed_by: gate.userId,
      });
      store = reopenCharges(store, payment.charge_ids);
      await persist();
      return NextResponse.json({
        success: true,
        message: 'Proof rejected — charge is open again',
      });
    }

    if (action === 'record_cash') {
      const chargeId = String(body.charge_id || '');
      const charge = store.charges.find((c) => c.id === chargeId);
      if (!charge || charge.kind !== (kind as AdvisorAccountKind)) {
        return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
      }
      if (charge.status === 'paid' || charge.status === 'void') {
        return NextResponse.json({ error: 'Charge is closed' }, { status: 400 });
      }
      const applied = await confirmMemberAccountPayment({
        companyId,
        store,
        charges: [charge],
        method: 'cash',
        amountZar: Number(charge.amount_zar),
        reference: body.reference ? String(body.reference) : 'cash',
        notes: body.notes ? String(body.notes) : 'Recorded at desk',
        actorUserId: gate.userId,
        memberName: charge.member_name,
        memberEmail: charge.member_email,
        memberUserId: charge.member_user_id,
      });
      store = applied.store;
      await persist();
      return NextResponse.json({
        success: true,
        message: 'Cash payment recorded',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
