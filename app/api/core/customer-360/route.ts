import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  loadCustomer360Bundle,
  loadCompanyMeta,
  advisorStoresFromMeta,
} from '@/lib/core-os/server';
import { recurringInvoiceDrafts } from '@/lib/core-os/finance';
import { attachInvoiceToCharge } from '@/lib/b2c/member-account-ar';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const customerId = Number(request.nextUrl.searchParams.get('customerId') || 0);
    const kind = request.nextUrl.searchParams.get('kind') || undefined;
    const bundle = await loadCustomer360Bundle(companyId, {
      customerId: customerId > 0 ? customerId : undefined,
      kind,
    });
    return NextResponse.json({ success: true, ...bundle });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST action=recurring — raise this period's membership invoices. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const { meta } = await loadCompanyMeta(companyId);
    const stores = advisorStoresFromMeta(meta);
    const supabase = getSupabaseServer();
    const { data: existing } = await supabase
      .from('customer_invoices')
      .select('notes')
      .eq('profile_id', companyId)
      .limit(200);
    const drafts = recurringInvoiceDrafts({
      members: stores.gym.clients || [],
      subscriptions: stores.gym.subscriptions || [],
      plans: stores.gym.membership_plans || [],
      existingInvoiceNotes: (existing || []).map((r) => String(r.notes || '')),
    }).filter((d) => !d.already_invoiced);

    const created: Array<{ member_id: string; invoice_id?: number }> = [];
    for (const d of drafts) {
      const charge = await attachInvoiceToCharge(companyId, {
        id: `chg_${d.period_key}`,
        kind: 'gym',
        ref_id: d.member_id,
        member_name: d.member_name,
        member_email: d.member_email,
        amount_zar: d.amount_incl,
        description: d.description,
        due_date: new Date().toISOString().slice(0, 10),
        status: 'open',
        source: 'subscription',
        created_at: new Date().toISOString(),
      });
      created.push({
        member_id: d.member_id,
        invoice_id: charge.invoice_id,
      });
    }
    return NextResponse.json({
      success: true,
      created: created.length,
      invoices: created,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
