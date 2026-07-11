import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('accounting_entities')
      .select('*')
      .eq('profile_id', companyId)
      .order('is_primary', { ascending: false })
      .order('name');

    if (error) {
      return NextResponse.json({
        success: true,
        entities: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260710_accounting_module.sql',
      });
    }
    return NextResponse.json({ success: true, entities: data || [] });
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

    if (!Number.isFinite(companyId) || !body.code || !body.name) {
      return NextResponse.json(
        { error: 'companyId, code, and name required' },
        { status: 400 }
      );
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    if (body.is_primary) {
      await supabase
        .from('accounting_entities')
        .update({ is_primary: false })
        .eq('profile_id', companyId);
    }

    const { data, error } = await supabase
      .from('accounting_entities')
      .insert({
        profile_id: companyId,
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        legal_name: body.legal_name || null,
        country: body.country || 'ZA',
        currency: body.currency || 'ZAR',
        tax_number: body.tax_number || null,
        registration_number: body.registration_number || null,
        is_primary: !!body.is_primary,
        status: body.status || 'active',
        address: body.address || null,
        metadata: body.metadata || {},
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, entity: data });
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
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    if (body.is_primary) {
      await supabase
        .from('accounting_entities')
        .update({ is_primary: false })
        .eq('profile_id', companyId);
    }

    const allowed = [
      'code',
      'name',
      'legal_name',
      'country',
      'currency',
      'tax_number',
      'registration_number',
      'is_primary',
      'status',
      'address',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const { data, error } = await supabase
      .from('accounting_entities')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, entity: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
