import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { getOrCreateSettings, parseCompanyId } from '@/lib/accounting/server';

export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'view');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const settings = await getOrCreateSettings(companyId);

    const supabase = getSupabaseServer();
    const { data: periods } = await supabase
      .from('accounting_periods')
      .select('*')
      .eq('profile_id', companyId)
      .order('start_date', { ascending: false })
      .limit(24);

    return NextResponse.json({
      success: true,
      settings,
      periods: periods || [],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    await getOrCreateSettings(companyId);

    const allowed = [
      'base_currency',
      'fiscal_year_start_month',
      'default_tax_rate',
      'invoice_prefix_ar',
      'invoice_prefix_ap',
      'journal_prefix',
      'next_ar_number',
      'next_ap_number',
      'next_journal_number',
      'lock_date',
      'require_balanced_journals',
      'metadata',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('accounting_settings')
      .update(patch)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, settings: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST — create accounting period */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !body.name || !body.start_date || !body.end_date) {
      return NextResponse.json(
        { error: 'companyId, name, start_date, end_date required' },
        { status: 400 }
      );
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('accounting_periods')
      .insert({
        profile_id: companyId,
        entity_id: body.entity_id || null,
        name: body.name,
        start_date: body.start_date,
        end_date: body.end_date,
        status: body.status || 'open',
        fiscal_year: body.fiscal_year || new Date(body.start_date).getFullYear(),
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, period: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
