import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import { assertAccountingAccess } from '@/lib/accounting/access';
import {
  addReferralRedemption,
  assignReferralCustomers,
  deleteReferralRedemption,
  loadPartnerCommission,
  loadSellerCommission,
  parseReferralRate,
  ReferralSchemaError,
  saveReferralAgreement,
  searchReferralCompanies,
} from '@/lib/accounting/referral-commission-store';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

function fail(error: unknown, status = 500) {
  if (error instanceof ReferralSchemaError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Referral commission failed' },
    { status }
  );
}

function span(request: NextRequest): { from: string; to: string } | { error: string } {
  const from = request.nextUrl.searchParams.get('from') || '';
  const to = request.nextUrl.searchParams.get('to') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { error: 'from and to must be YYYY-MM-DD' };
  }
  if (from > to) return { error: 'from must be on or before to' };
  return { from, to };
}

/** Commission earned by partner companies, and what has been redeemed. */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const view = await assertAccountingAccess(gate.userId, companyId, 'view');
    const q = request.nextUrl.searchParams.get('q');
    if (q != null) {
      if (!view.ok) {
        return NextResponse.json({ error: view.error }, { status: view.status });
      }
      const companies = await searchReferralCompanies({ sellerId: companyId, q });
      return NextResponse.json({ success: true, companies });
    }
    const period = span(request);
    if ('error' in period) {
      return NextResponse.json({ error: period.error }, { status: 400 });
    }
    const outgoing = view.ok
      ? await loadSellerCommission({
          sellerId: companyId,
          from: period.from,
          to: period.to,
        })
      : null;
    const incoming = await loadPartnerCommission({
      partnerId: companyId,
      from: period.from,
      to: period.to,
    });
    if (!view.ok && incoming.length === 0) {
      return NextResponse.json({ error: view.error }, { status: view.status });
    }
    const write = view.ok
      ? await assertAccountingAccess(gate.userId, companyId, 'write')
      : null;
    return NextResponse.json({
      success: true,
      can_write: Boolean(write?.ok),
      outgoing,
      incoming,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const write = await assertAccountingAccess(gate.userId, companyId, 'write');
    if (!write.ok) {
      return NextResponse.json({ error: write.error }, { status: write.status });
    }
    const action = String(body.action || '');
    const partnerProfileId = Number(body.partner_profile_id);

    if (action === 'save_agreement') {
      const rate = parseReferralRate(body.rate_pct);
      if (!Number.isFinite(partnerProfileId) || partnerProfileId <= 0) {
        return NextResponse.json({ error: 'Choose the partner company.' }, { status: 400 });
      }
      if (rate == null) {
        return NextResponse.json(
          { error: 'Enter a commission rate above 0 and up to 100 percent.' },
          { status: 400 }
        );
      }
      await saveReferralAgreement({
        sellerId: companyId,
        partnerProfileId,
        ratePct: rate,
        basis: body.basis,
        earnOn: body.earn_on,
        status: body.status,
        notes: body.notes != null ? String(body.notes) : null,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'assign_customers') {
      if (!Number.isFinite(partnerProfileId) || partnerProfileId <= 0) {
        return NextResponse.json({ error: 'Choose the partner company.' }, { status: 400 });
      }
      const customerIds = Array.isArray(body.customer_ids)
        ? body.customer_ids.map((id: unknown) => Number(id)).filter((id: number) => id > 0)
        : [];
      await assignReferralCustomers({
        sellerId: companyId,
        partnerProfileId,
        customerIds,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'redeem') {
      if (!Number.isFinite(partnerProfileId) || partnerProfileId <= 0) {
        return NextResponse.json({ error: 'Choose the partner company.' }, { status: 400 });
      }
      await addReferralRedemption({
        sellerId: companyId,
        partnerProfileId,
        amount: Number(body.amount),
        redeemedOn: String(body.redeemed_on || '').slice(0, 10),
        method: body.method,
        reference: body.reference != null ? String(body.reference) : null,
        notes: body.notes != null ? String(body.notes) : null,
        createdBy: gate.userId,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_redemption') {
      const id = Number(body.id);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: 'Redemption id required' }, { status: 400 });
      }
      await deleteReferralRedemption({ sellerId: companyId, id });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = /choose|enter|save the commission|not on this|not found|cannot earn/i.test(
      message
    )
      ? 400
      : 500;
    return fail(error, error instanceof ReferralSchemaError ? 503 : status);
  }
}
