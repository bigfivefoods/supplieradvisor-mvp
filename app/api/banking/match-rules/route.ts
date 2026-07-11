import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import { seedDefaultMatchRules } from '@/lib/banking/match-engine';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/** GET ?companyId= — list match rules */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const seed = request.nextUrl.searchParams.get('seed') === '1';

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    let seeded = 0;
    if (seed) {
      try {
        seeded = await seedDefaultMatchRules(companyId);
      } catch {
        seeded = 0;
      }
    }

    const { data: rules, error } = await supabase
      .from('bank_match_rules')
      .select('*')
      .eq('profile_id', companyId)
      .order('priority', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({
        success: true,
        rules: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260711_bank_middleware.sql',
        seeded,
      });
    }

    return NextResponse.json({ success: true, rules: rules || [], seeded });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST — create rule or seed defaults
 * action?: 'create' | 'seed'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const action = String(body.action || 'create');

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    if (action === 'seed') {
      const seeded = await seedDefaultMatchRules(companyId);
      return NextResponse.json({ success: true, seeded });
    }

    if (!body.name || !body.pattern) {
      return NextResponse.json({ error: 'name and pattern required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const row = {
      profile_id: companyId,
      name: String(body.name).slice(0, 120),
      match_type: String(body.match_type || 'description_contains'),
      pattern: String(body.pattern).slice(0, 500),
      target_type: String(body.target_type || 'gl_account'),
      target_id: body.target_id != null ? Number(body.target_id) : null,
      target_value: body.target_value ? String(body.target_value) : null,
      priority: Number(body.priority) || 100,
      is_active: body.is_active !== false,
    };

    if (row.target_type === 'gl_account' && !row.target_id) {
      return NextResponse.json(
        { error: 'target_id (GL account) required for gl_account rules' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('bank_match_rules')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260711_bank_middleware.sql',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, rule: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** PATCH — update rule */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const id = Number(body.id);

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const key of [
      'name',
      'match_type',
      'pattern',
      'target_type',
      'target_value',
      'priority',
      'is_active',
    ] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (body.target_id !== undefined) {
      patch.target_id = body.target_id == null ? null : Number(body.target_id);
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('bank_match_rules')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, rule: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** DELETE body: companyId, id */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;
    const id = Number(body.id);

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('bank_match_rules')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
