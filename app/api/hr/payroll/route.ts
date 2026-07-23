import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  computePayslipLine,
  monthlyBasicFromEmployee,
} from '@/lib/hr/types';
import { postBalancedJournal, resolveCoaAccountIdByCode } from '@/lib/accounting/post-journal';

const HINT = 'Run supabase/migrations/20260723_hr_people_module.sql';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const runId = Number(sp.get('runId') || 0);
    const supabase = getSupabaseServer();

    if (runId > 0) {
      const { data: run, error } = await supabase
        .from('hr_payroll_runs')
        .select('*')
        .eq('id', runId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !run) {
        return NextResponse.json(
          { error: error?.message || 'Run not found', hint: HINT },
          { status: 404 }
        );
      }
      const { data: lines } = await supabase
        .from('hr_payroll_lines')
        .select('*')
        .eq('payroll_run_id', runId)
        .eq('profile_id', companyId)
        .order('employee_name');
      return NextResponse.json({
        success: true,
        run,
        lines: lines || [],
      });
    }

    const { data: runs, error } = await supabase
      .from('hr_payroll_runs')
      .select('*')
      .eq('profile_id', companyId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(36);

    if (error) {
      return NextResponse.json({
        success: true,
        runs: [],
        warning: error.message,
        hint: HINT,
      });
    }
    return NextResponse.json({ success: true, runs: runs || [] });
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
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'create').toLowerCase();
    const supabase = getSupabaseServer();

    // ── Create + calculate run ──────────────────────────────────────────────
    if (action === 'create' || action === 'calculate') {
      const year = Number(body.period_year || new Date().getFullYear());
      const month = Number(body.period_month || new Date().getMonth() + 1);
      if (month < 1 || month > 12) {
        return NextResponse.json({ error: 'Invalid period_month' }, { status: 400 });
      }
      const label =
        body.period_label ||
        `${year}-${String(month).padStart(2, '0')}`;

      // Upsert run
      let runId = body.id ? Number(body.id) : null;
      if (!runId) {
        const { data: existing } = await supabase
          .from('hr_payroll_runs')
          .select('id, status')
          .eq('profile_id', companyId)
          .eq('period_year', year)
          .eq('period_month', month)
          .maybeSingle();
        if (existing) {
          if (['paid', 'void'].includes(String(existing.status))) {
            return NextResponse.json(
              { error: `Payroll ${label} is already ${existing.status}` },
              { status: 409 }
            );
          }
          runId = Number(existing.id);
        } else {
          const { data: created, error: cErr } = await supabase
            .from('hr_payroll_runs')
            .insert({
              profile_id: companyId,
              period_year: year,
              period_month: month,
              period_label: label,
              pay_date:
                body.pay_date ||
                new Date(year, month, 0).toISOString().slice(0, 10),
              status: 'draft',
              currency: body.currency || 'ZAR',
              created_by: gate.userId || null,
              notes: body.notes || null,
              updated_at: new Date().toISOString(),
            })
            .select('*')
            .single();
          if (cErr || !created) {
            return NextResponse.json(
              { error: cErr?.message || 'Failed to create run', hint: HINT },
              { status: 400 }
            );
          }
          runId = Number(created.id);
        }
      }

      // Clear previous lines and recalculate
      await supabase
        .from('hr_payroll_lines')
        .delete()
        .eq('payroll_run_id', runId)
        .eq('profile_id', companyId);

      const { data: employees, error: eErr } = await supabase
        .from('employees')
        .select('*')
        .eq('profile_id', companyId)
        .in('status', ['active', 'probation', 'on_leave']);

      if (eErr) {
        return NextResponse.json(
          { error: eErr.message, hint: HINT },
          { status: 400 }
        );
      }

      const lines: Record<string, unknown>[] = [];
      let totalGross = 0;
      let totalDed = 0;
      let totalNet = 0;
      let totalEmployer = 0;

      for (const emp of employees || []) {
        const basic = monthlyBasicFromEmployee(emp);
        if (basic <= 0 && Number(emp.hourly_rate || 0) <= 0) continue;
        const slip = computePayslipLine({
          basic,
          allowances: Number(body.default_allowances || 0),
          overtime: 0,
          otherDeductions: 0,
        });
        totalGross += slip.gross_pay;
        totalDed += slip.total_deductions;
        totalNet += slip.net_pay;
        totalEmployer += slip.employer_cost;
        lines.push({
          profile_id: companyId,
          payroll_run_id: runId,
          employee_id: emp.id,
          employee_name: emp.full_name,
          employee_number: emp.employee_number || null,
          business_unit_id: emp.business_unit_id || null,
          work_center_id: emp.work_center_id || null,
          basic_pay: basic,
          allowances: Number(body.default_allowances || 0),
          overtime: 0,
          gross_pay: slip.gross_pay,
          paye: slip.paye,
          uif_employee: slip.uif_employee,
          uif_employer: slip.uif_employer,
          other_deductions: 0,
          total_deductions: slip.total_deductions,
          net_pay: slip.net_pay,
          employer_cost: slip.employer_cost,
          currency: emp.salary_currency || 'ZAR',
        });
      }

      if (lines.length) {
        const { error: lErr } = await supabase
          .from('hr_payroll_lines')
          .insert(lines);
        if (lErr) {
          return NextResponse.json({ error: lErr.message }, { status: 400 });
        }
      }

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const { data: run, error: uErr } = await supabase
        .from('hr_payroll_runs')
        .update({
          status: 'calculated',
          employee_count: lines.length,
          total_gross: round2(totalGross),
          total_deductions: round2(totalDed),
          total_net: round2(totalNet),
          total_employer_cost: round2(totalEmployer),
          period_label: label,
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId)
        .eq('profile_id', companyId)
        .select('*')
        .single();

      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 400 });
      }

      const { data: savedLines } = await supabase
        .from('hr_payroll_lines')
        .select('*')
        .eq('payroll_run_id', runId);

      return NextResponse.json({
        success: true,
        run,
        lines: savedLines || [],
      });
    }

    // ── Approve ─────────────────────────────────────────────────────────────
    if (action === 'approve') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('hr_payroll_runs')
        .update({
          status: 'approved',
          approved_by: gate.userId || null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, run: data });
    }

    // ── Mark paid + optional GL ─────────────────────────────────────────────
    if (action === 'pay' || action === 'post_gl') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const { data: run, error: rErr } = await supabase
        .from('hr_payroll_runs')
        .select('*')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (rErr || !run) {
        return NextResponse.json(
          { error: rErr?.message || 'Run not found' },
          { status: 404 }
        );
      }

      let journalId: number | undefined;
      let entryNumber: string | undefined;
      const gross = Number(run.total_gross || 0);
      const net = Number(run.total_net || 0);
      const ded = Number(run.total_deductions || 0);

      if (body.post_gl !== false && gross > 0) {
        const labour =
          (await resolveCoaAccountIdByCode(companyId, '6100')) ||
          (await resolveCoaAccountIdByCode(companyId, '5200'));
        const bank = await resolveCoaAccountIdByCode(companyId, '1110');
        const payeLiab =
          (await resolveCoaAccountIdByCode(companyId, '2120')) ||
          (await resolveCoaAccountIdByCode(companyId, '2130'));
        if (labour && bank && labour !== bank) {
          const lines = [
            {
              accountId: labour,
              debit: gross,
              credit: 0,
              memo: `Payroll ${run.period_label} labour`,
            },
            {
              accountId: bank,
              debit: 0,
              credit: net,
              memo: `Payroll ${run.period_label} net pay`,
            },
          ];
          if (ded > 0.005 && payeLiab && payeLiab !== labour && payeLiab !== bank) {
            lines.push({
              accountId: payeLiab,
              debit: 0,
              credit: ded,
              memo: `Payroll ${run.period_label} PAYE/UIF`,
            });
          } else if (ded > 0.005) {
            // fold deductions into bank credit reduction already handled by net
            lines[1].credit = gross;
          }
          const posted = await postBalancedJournal({
            profileId: companyId,
            entryDate:
              String(run.pay_date || new Date().toISOString()).slice(0, 10),
            memo: `Payroll ${run.period_label}`,
            source: 'hr_payroll',
            sourceId: String(run.id),
            currency: run.currency || 'ZAR',
            createdBy: gate.userId || null,
            metadata: { payroll_run_id: run.id },
            lines,
          });
          if (posted.ok) {
            journalId = posted.journalId;
            entryNumber = posted.entryNumber;
          }
        }
      }

      const { data: updated, error: uErr } = await supabase
        .from('hr_payroll_runs')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          journal_entry_id: journalId || run.journal_entry_id || null,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(typeof run.metadata === 'object' && run.metadata
              ? (run.metadata as object)
              : {}),
            journal_entry_number: entryNumber,
          },
        })
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();

      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 400 });
      }

      // Soft: post labour cost entries to manufacturing by BU
      if (body.post_cost_entries !== false) {
        try {
          const { data: payLines } = await supabase
            .from('hr_payroll_lines')
            .select('*')
            .eq('payroll_run_id', id)
            .eq('profile_id', companyId);
          for (const pl of payLines || []) {
            if (
              !pl.business_unit_id &&
              !pl.work_center_id &&
              Number(pl.gross_pay || 0) <= 0
            ) {
              continue;
            }
            if (!pl.business_unit_id && !pl.work_center_id) continue;
            await supabase.from('manufacturing_cost_entries').insert({
              profile_id: companyId,
              entry_date:
                String(run.pay_date || new Date().toISOString()).slice(0, 10),
              amount: Number(pl.employer_cost || pl.gross_pay || 0),
              currency: pl.currency || 'ZAR',
              category: 'labour',
              description: `Payroll ${run.period_label} · ${pl.employee_name}`,
              reference: `PAY-${run.id}-${pl.employee_id}`,
              business_unit_id: pl.business_unit_id || null,
              work_center_id: pl.work_center_id || null,
              metadata: {
                source: 'hr_payroll',
                payroll_run_id: run.id,
                employee_id: pl.employee_id,
              },
              updated_at: new Date().toISOString(),
            });
          }
        } catch {
          /* soft if mfg tables missing */
        }
      }

      return NextResponse.json({
        success: true,
        run: updated,
        journal: journalId
          ? { id: journalId, entryNumber }
          : null,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
