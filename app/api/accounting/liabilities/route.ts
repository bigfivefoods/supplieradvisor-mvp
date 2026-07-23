import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { parseCompanyId, round2 } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

/**
 * Liability register — loans, deposits, accruals allocated to BS + cost objects.
 * GET ?companyId=
 * POST create | action=capitalize | action=capitalize_all
 * PATCH update
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(
      request.nextUrl.searchParams.get('companyId')
    );
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('accounting_liabilities')
      .select('*')
      .eq('profile_id', companyId)
      .order('name');

    if (error) {
      return NextResponse.json({
        success: true,
        liabilities: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260723_balance_sheet_allocation.sql',
      });
    }
    return NextResponse.json({ success: true, liabilities: data || [] });
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
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    if (body.action === 'capitalize' || body.action === 'post_to_bs') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const { capitalizeLiability } = await import(
        '@/lib/accounting/balance-sheet-allocate'
      );
      const result = await capitalizeLiability({
        companyId,
        liabilityId: id,
        createdBy: gate.userId || null,
        debitSide:
          body.debitSide === 'expense' || body.debitSide === 'equity'
            ? body.debitSide
            : 'bank',
        force: body.force === true,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Failed' },
          { status: 400 }
        );
      }
      const supabase = getSupabaseServer();
      const { data } = await supabase
        .from('accounting_liabilities')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return NextResponse.json({
        success: true,
        liability: data,
        journal: result.journalId
          ? { id: result.journalId, entryNumber: result.entryNumber }
          : null,
        skipped: result.skipped,
      });
    }

    if (body.action === 'capitalize_all') {
      const supabase = getSupabaseServer();
      const { data: rows } = await supabase
        .from('accounting_liabilities')
        .select('id, capitalization_journal_id, outstanding, principal')
        .eq('profile_id', companyId)
        .eq('status', 'active');
      const { capitalizeLiability } = await import(
        '@/lib/accounting/balance-sheet-allocate'
      );
      let capitalised = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const r of rows || []) {
        if (r.capitalization_journal_id) {
          skipped++;
          continue;
        }
        const res = await capitalizeLiability({
          companyId,
          liabilityId: Number(r.id),
          createdBy: gate.userId || null,
        });
        if (res.ok && !res.skipped) capitalised++;
        else if (res.skipped) skipped++;
        else {
          failed++;
          if (res.error) errors.push(res.error);
        }
      }
      return NextResponse.json({
        success: true,
        capitalised,
        skipped,
        failed,
        errors,
      });
    }

    if (!body.name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const principal = round2(Number(body.principal ?? body.outstanding ?? 0));
    const outstanding = round2(Number(body.outstanding ?? principal));
    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      code: body.code ? String(body.code).trim() : null,
      name: String(body.name).trim(),
      liability_type: body.liability_type || 'other',
      is_current: body.is_current !== false,
      principal,
      outstanding,
      currency: body.currency || 'ZAR',
      counterparty: body.counterparty || null,
      start_date: body.start_date || null,
      maturity_date: body.maturity_date || null,
      interest_rate_pct:
        body.interest_rate_pct != null ? Number(body.interest_rate_pct) : null,
      gl_liability_account_id: body.gl_liability_account_id
        ? Number(body.gl_liability_account_id)
        : null,
      business_unit_id: body.business_unit_id
        ? Number(body.business_unit_id)
        : null,
      work_center_id: body.work_center_id ? Number(body.work_center_id) : null,
      work_station_id: body.work_station_id
        ? Number(body.work_station_id)
        : null,
      status: body.status || 'active',
      notes: body.notes || null,
      metadata: body.metadata || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('accounting_liabilities')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260723_balance_sheet_allocation.sql',
        },
        { status: 400 }
      );
    }

    let journal: { id: number; entryNumber?: string } | null = null;
    let journalWarning: string | undefined;
    if (body.capitalize !== false && outstanding > 0 && data?.id) {
      try {
        const { capitalizeLiability } = await import(
          '@/lib/accounting/balance-sheet-allocate'
        );
        const cap = await capitalizeLiability({
          companyId,
          liabilityId: Number(data.id),
          createdBy: gate.userId || null,
          debitSide:
            body.debitSide === 'expense' || body.debitSide === 'equity'
              ? body.debitSide
              : 'bank',
        });
        if (cap.ok && cap.journalId) {
          journal = { id: cap.journalId, entryNumber: cap.entryNumber };
          const { data: refreshed } = await supabase
            .from('accounting_liabilities')
            .select('*')
            .eq('id', data.id)
            .maybeSingle();
          return NextResponse.json({
            success: true,
            liability: refreshed || data,
            journal,
          });
        }
        if (!cap.ok) journalWarning = cap.error;
      } catch (e: unknown) {
        journalWarning =
          e instanceof Error ? e.message : 'Capitalise failed';
      }
    }

    return NextResponse.json({
      success: true,
      liability: data,
      journal,
      journalWarning,
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
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const allowed = [
      'code',
      'name',
      'liability_type',
      'is_current',
      'principal',
      'outstanding',
      'currency',
      'counterparty',
      'start_date',
      'maturity_date',
      'interest_rate_pct',
      'gl_liability_account_id',
      'business_unit_id',
      'work_center_id',
      'work_station_id',
      'status',
      'notes',
    ];
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('accounting_liabilities')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, liability: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
