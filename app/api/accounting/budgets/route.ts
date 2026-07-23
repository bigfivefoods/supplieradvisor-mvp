import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  getOrCreateSettings,
  parseCompanyId,
  round2,
} from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  MONTH_KEYS,
  budgetFyMeta,
  emptyMonths,
  fiscalYearStartYear,
  normalizeFyStartMonth,
  sumBudgetMonths,
} from '@/lib/accounting/budget';

const HINT = 'Run supabase/migrations/20260723_accounting_budgets.sql';

/**
 * GET ?companyId=&year=2026
 * year = calendar year when the financial year **starts**.
 * m01…m12 are FY periods (period 1 = FY start month).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = parseCompanyId(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const settings = await getOrCreateSettings(companyId);
    const fyStartMonth = normalizeFyStartMonth(
      settings.fiscal_year_start_month
    );
    const defaultYear = fiscalYearStartYear(new Date(), fyStartMonth);
    const year = Number(sp.get('year') || defaultYear);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const fy = budgetFyMeta(year, fyStartMonth);
    const supabase = getSupabaseServer();
    const { data: accounts, error: aErr } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type, is_header, is_active, subtype')
      .eq('profile_id', companyId)
      .order('code');

    if (aErr) {
      return NextResponse.json({
        success: true,
        year,
        ...fy,
        rows: [],
        warning: aErr.message,
        hint: 'Seed Chart of Accounts first',
      });
    }

    const { data: budgets, error: bErr } = await supabase
      .from('accounting_budgets')
      .select('*')
      .eq('profile_id', companyId)
      .eq('fiscal_year', year);

    if (bErr) {
      return NextResponse.json({
        success: true,
        year,
        ...fy,
        rows: [],
        warning: bErr.message,
        hint: HINT,
      });
    }

    const byAcct = new Map<number, Record<string, unknown>>();
    for (const b of budgets || []) {
      byAcct.set(Number(b.account_id), b as Record<string, unknown>);
    }

    const leaf = (accounts || []).filter(
      (a) => !a.is_header && a.is_active !== false
    );
    const rows = leaf.map((a) => {
      const b = byAcct.get(Number(a.id));
      const months = emptyMonths();
      if (b) {
        for (const k of MONTH_KEYS) {
          months[k] = round2(Number(b[k] || 0));
        }
      }
      return {
        account_id: Number(a.id),
        code: a.code,
        name: a.name,
        account_type: a.account_type,
        subtype: a.subtype,
        ...months,
        annual_total: sumBudgetMonths(months),
        budget_id: b?.id ? Number(b.id) : null,
        notes: b?.notes ? String(b.notes) : null,
      };
    });

    const totalsByType: Record<string, number> = {};
    for (const r of rows) {
      const t = String(r.account_type || 'other');
      totalsByType[t] = round2((totalsByType[t] || 0) + r.annual_total);
    }

    return NextResponse.json({
      success: true,
      year,
      ...fy,
      monthLabels: fy.columns.map((c) => c.shortLabel),
      monthColumns: fy.columns,
      rows,
      totalsByType,
      accountCount: rows.length,
      budgetedCount: rows.filter((r) => r.annual_total !== 0).length,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST body:
 *  companyId, year
 *  rows: [{ account_id, m01..m12, notes? }]  — upsert bulk
 *  action?: 'copy_year' + fromYear
 *  action?: 'spread' + account_id + annual (equal months)
 */
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

    const settings = await getOrCreateSettings(companyId);
    const fyStartMonth = normalizeFyStartMonth(
      settings.fiscal_year_start_month
    );
    const defaultYear = fiscalYearStartYear(new Date(), fyStartMonth);
    const year = Number(body.year || defaultYear);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const action = String(body.action || 'upsert').toLowerCase();

    // Set company financial year start month (1–12)
    if (action === 'set_fy_start') {
      const month = normalizeFyStartMonth(body.fiscalYearStartMonth ?? body.month);
      if (
        body.fiscalYearStartMonth != null &&
        (Number(body.fiscalYearStartMonth) < 1 ||
          Number(body.fiscalYearStartMonth) > 12)
      ) {
        return NextResponse.json(
          { error: 'fiscalYearStartMonth must be 1–12' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('accounting_settings')
        .update({
          fiscal_year_start_month: month,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        // ensure row exists
        await getOrCreateSettings(companyId);
        const retry = await supabase
          .from('accounting_settings')
          .update({
            fiscal_year_start_month: month,
            updated_at: new Date().toISOString(),
          })
          .eq('profile_id', companyId)
          .select('*')
          .single();
        if (retry.error) {
          return NextResponse.json({ error: retry.error.message }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          fiscalYearStartMonth: month,
          settings: retry.data,
          fy: budgetFyMeta(year, month),
        });
      }
      return NextResponse.json({
        success: true,
        fiscalYearStartMonth: month,
        settings: data,
        fy: budgetFyMeta(year, month),
      });
    }

    if (action === 'copy_year') {
      const fromYear = Number(body.fromYear);
      if (!Number.isFinite(fromYear)) {
        return NextResponse.json({ error: 'fromYear required' }, { status: 400 });
      }
      const { data: src, error } = await supabase
        .from('accounting_budgets')
        .select('*')
        .eq('profile_id', companyId)
        .eq('fiscal_year', fromYear);
      if (error) {
        return NextResponse.json(
          { error: error.message, hint: HINT },
          { status: 400 }
        );
      }
      let copied = 0;
      for (const r of src || []) {
        const payload: Record<string, unknown> = {
          profile_id: companyId,
          fiscal_year: year,
          account_id: r.account_id,
          notes: r.notes || null,
          updated_at: new Date().toISOString(),
        };
        for (const k of MONTH_KEYS) payload[k] = Number(r[k] || 0);
        const { error: uErr } = await supabase
          .from('accounting_budgets')
          .upsert(payload, { onConflict: 'profile_id,fiscal_year,account_id' });
        if (!uErr) copied++;
      }
      return NextResponse.json({ success: true, copied, year, fromYear });
    }

    const rawRows = Array.isArray(body.rows) ? body.rows : [];
    if (!rawRows.length) {
      return NextResponse.json({ error: 'rows[] required' }, { status: 400 });
    }

    let saved = 0;
    const errors: string[] = [];

    for (const raw of rawRows) {
      const accountId = Number(raw.account_id);
      if (!Number.isFinite(accountId) || accountId <= 0) continue;

      const months = emptyMonths();
      // Equal spread from annual if provided
      if (raw.annual != null && Number.isFinite(Number(raw.annual)) && !raw.m01) {
        const each = round2(Number(raw.annual) / 12);
        for (const k of MONTH_KEYS) months[k] = each;
        // fix rounding on last month
        const sum11 = MONTH_KEYS.slice(0, 11).reduce((s, k) => s + months[k], 0);
        months.m12 = round2(Number(raw.annual) - sum11);
      } else {
        for (const k of MONTH_KEYS) {
          if (raw[k] != null) months[k] = round2(Number(raw[k] || 0));
        }
      }

      const payload: Record<string, unknown> = {
        profile_id: companyId,
        fiscal_year: year,
        account_id: accountId,
        ...months,
        notes: raw.notes != null ? String(raw.notes) : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('accounting_budgets')
        .upsert(payload, { onConflict: 'profile_id,fiscal_year,account_id' });

      if (error) {
        // Soft: try without notes if column issues
        if (/column|schema cache|does not exist/i.test(error.message)) {
          errors.push(error.message);
          break;
        }
        errors.push(`Account ${accountId}: ${error.message}`);
      } else {
        saved++;
      }
    }

    if (saved === 0 && errors.length) {
      return NextResponse.json(
        { error: errors[0], hint: HINT },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      saved,
      year,
      warnings: errors.length ? errors.slice(0, 5) : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** DELETE ?companyId=&year=&accountId= — clear one or entire year */
export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = parseCompanyId(sp.get('companyId'));
    const year = Number(sp.get('year'));
    const accountId = Number(sp.get('accountId') || 0);
    if (!Number.isFinite(companyId) || !Number.isFinite(year)) {
      return NextResponse.json(
        { error: 'companyId and year required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let q = supabase
      .from('accounting_budgets')
      .delete()
      .eq('profile_id', companyId)
      .eq('fiscal_year', year);
    if (accountId > 0) q = q.eq('account_id', accountId);
    const { error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
