import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import { DEFAULT_TAX_RATES } from '@/lib/accounting/coa';

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

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('profile_id', companyId)
      .order('rate', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        rates: [],
        summary: null,
        warning: error.message,
        hint: 'Run supabase/migrations/20260710_accounting_module.sql',
      });
    }

    // VAT summary from invoices (output on AR, input estimate on AP)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('direction, status, tax_amount, total_amount, issue_date')
      .eq('profile_id', companyId)
      .not('status', 'in', '("void","cancelled","draft")');

    let outputVat = 0;
    let inputVat = 0;
    for (const inv of invoices || []) {
      const tax = Number(inv.tax_amount || 0);
      if (inv.direction === 'receivable') outputVat += tax;
      else if (inv.direction === 'payable') inputVat += tax;
    }

    return NextResponse.json({
      success: true,
      rates: data || [],
      summary: {
        outputVat,
        inputVat,
        netVat: outputVat - inputVat,
        invoiceCount: (invoices || []).length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const supabase = getSupabaseServer();

    if (body.seed) {
      const { data: existing } = await supabase
        .from('tax_rates')
        .select('id')
        .eq('profile_id', companyId)
        .limit(1);
      if (existing && existing.length > 0) {
        return NextResponse.json({ success: true, seeded: 0, message: 'Tax rates already exist' });
      }
      const { data, error } = await supabase
        .from('tax_rates')
        .insert(
          DEFAULT_TAX_RATES.map((t) => ({
            profile_id: companyId,
            code: t.code,
            name: t.name,
            rate: t.rate,
            tax_type: t.tax_type,
            is_default: t.is_default,
            country: t.country,
            status: 'active',
          }))
        )
        .select('id');
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, seeded: data?.length || 0 });
    }

    if (!body.code || !body.name || body.rate == null) {
      return NextResponse.json(
        { error: 'code, name, and rate required' },
        { status: 400 }
      );
    }

    if (body.is_default) {
      await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('profile_id', companyId);
    }

    const { data, error } = await supabase
      .from('tax_rates')
      .insert({
        profile_id: companyId,
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        rate: Number(body.rate),
        country: body.country || 'ZA',
        tax_type: body.tax_type || 'vat',
        is_default: !!body.is_default,
        is_recoverable: body.is_recoverable !== false,
        gl_account_id: body.gl_account_id || null,
        status: 'active',
        effective_from: body.effective_from || null,
        effective_to: body.effective_to || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, rate: data });
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
    const id = Number(body.id);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertAccountingAccess(privyUserId, companyId, 'write');
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    if (body.is_default) {
      await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('profile_id', companyId);
    }

    const allowed = [
      'code',
      'name',
      'rate',
      'country',
      'tax_type',
      'is_default',
      'is_recoverable',
      'gl_account_id',
      'status',
      'effective_from',
      'effective_to',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const { data, error } = await supabase
      .from('tax_rates')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, rate: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
