import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId } from '@/lib/accounting/server';
import { postBalancedJournal } from '@/lib/accounting/post-journal';
import { listPeriodLocks, setPeriodLock } from '@/lib/accounting/period-lock';
import {
  legacyPrivyFrom,
  requireCompanyAccess,
  requireCompanyRoles,
  ROLES_FINANCE_CRITICAL,
} from '@/lib/auth/api-auth';
import { vat201IsvSubmit } from '@/lib/accounting/vat201-isv';
import { composeVat201 } from '@/lib/accounting/vat201-service';
import {
  buildVatSettlementLines,
  SARS_EFILING_URL,
  type VatBasis,
  type VatFilingChannel,
  type VatPeriodCategory,
  type VatVendorSettings,
} from '@/lib/accounting/vat201-model';
import {
  readVatSettings,
  saveVatSettings,
  writeVatReturn,
} from '@/lib/accounting/vat201-store';

export const dynamic = 'force-dynamic';

function monthsIn(start: string, end: string): string[] {
  const keys: string[] = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const last = end.slice(0, 7);
  while (keys.length < 14) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    keys.push(key);
    if (key >= last) break;
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

async function accountId(profileId: number, code: string): Promise<number | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, is_header')
    .eq('profile_id', profileId)
    .eq('code', code)
    .maybeSingle();
  if (!data?.id || data.is_header) return null;
  return Number(data.id);
}

async function ensureClearingAccount(profileId: number): Promise<number> {
  const existing = await accountId(profileId, '2125');
  if (existing) return existing;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      profile_id: profileId,
      code: '2125',
      name: 'VAT payable / receivable (SARS)',
      account_type: 'liability',
      subtype: 'tax',
      is_active: true,
      is_system: true,
      is_header: false,
      normal_balance: 'credit',
      currency: 'ZAR',
      description:
        'Clears 1150 and 2120 when a VAT201 payment is recorded. The account nets to zero when the bank is in the same journal.',
    })
    .select('id')
    .single();
  if (error || !data?.id) throw new Error(error?.message || 'Could not add VAT clearing account 2125');
  return Number(data.id);
}

export async function GET(request: NextRequest) {
  const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
  if (!Number.isFinite(companyId)) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }
  const gate = await requireCompanyAccess(request, companyId, {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
  if (!gate.ok) return gate.response;
  const view = await composeVat201(companyId, request.nextUrl.searchParams.get('periodEnd'));
  return NextResponse.json({
    success: true,
    ...view,
    efilingUrl: SARS_EFILING_URL,
    isv: vat201IsvSubmit(),
  });
}

function settingsFrom(body: Record<string, unknown>, current: VatVendorSettings): VatVendorSettings {
  return {
    vatNumber: String(body.vatNumber ?? current.vatNumber),
    basis: String(body.basis ?? current.basis) as VatBasis,
    category: String(body.category ?? current.category) as VatPeriodCategory,
    effectiveFrom: String(body.effectiveFrom ?? current.effectiveFrom).slice(0, 10),
    firstPeriodEnd: String(body.firstPeriodEnd ?? current.firstPeriodEnd).slice(0, 10),
    filingChannel: String(body.filingChannel ?? current.filingChannel) as VatFilingChannel,
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.sarsPassword || body.sarsUsername || body.sars_password || body.password) {
    return NextResponse.json(
      { error: 'SupplierAdvisor® does not accept a SARS username or password.' },
      { status: 400 }
    );
  }
  const companyId = parseCompanyId(body.companyId);
  if (!Number.isFinite(companyId)) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }
  const action = String(body.action || '');
  if (action === 'save_settings') {
    const gate = await requireCompanyRoles(request, companyId, ROLES_FINANCE_CRITICAL, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    const current = await readVatSettings(companyId);
    const saved = await saveVatSettings(companyId, settingsFrom(body, current));
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error, migration: saved.migration }, { status: saved.migration ? 409 : 400 });
    }
    return NextResponse.json({ success: true, settings: saved.settings });
  }

  const gate = await requireCompanyAccess(request, companyId, {
    legacyPrivyUserId: legacyPrivyFrom(request, body),
  });
  if (!gate.ok) return gate.response;
  const write = await assertAccountingAccess(gate.userId, companyId, 'write');
  if (!write.ok) return NextResponse.json({ error: write.error }, { status: write.status });

  if (action === 'isv_submit') {
    return NextResponse.json({ success: false, isv: vat201IsvSubmit() }, { status: 409 });
  }

  const view = await composeVat201(companyId, body.periodEnd != null ? String(body.periodEnd) : null);
  if (!view.period || !view.report || !view.stored) {
    return NextResponse.json({ error: 'Set the VAT period before filing.' }, { status: 400 });
  }
  const { period, report, stored } = view;

  if (action === 'review') {
    if (stored.status === 'submitted' || stored.status === 'paid') {
      return NextResponse.json({ error: 'This return is already submitted.' }, { status: 400 });
    }
    const months = monthsIn(period.start, period.end);
    const written = await writeVatReturn(companyId, {
      periodStart: period.start,
      periodEnd: period.end,
      status: 'reviewed',
      locked: true,
      snapshot: { ...report, status: 'reviewed' },
      lockedMonths: months,
      actor: gate.userId,
    });
    if (!written.ok) {
      return NextResponse.json({ error: written.error, migration: written.migration }, { status: written.migration ? 409 : 400 });
    }
    const locks = await listPeriodLocks(companyId);
    for (const key of months) {
      const existing = locks.find((lock) => lock.period_key === key && lock.locked);
      if (existing?.note && !existing.note.includes('VAT201')) continue;
      await setPeriodLock({
        profileId: companyId,
        period_key: key,
        locked: true,
        userId: gate.userId,
        note: `Locked by VAT201 review ${period.end}`,
      });
    }
    return NextResponse.json({
      success: true,
      status: 'reviewed',
      efilingUrl: SARS_EFILING_URL,
      report: { ...report, status: 'reviewed' },
      isv: vat201IsvSubmit(),
    });
  }

  if (action === 'reopen') {
    if (stored.status !== 'reviewed') {
      return NextResponse.json({ error: 'Only a reviewed return can be reopened.' }, { status: 400 });
    }
    for (const key of stored.lockedMonths) {
      await setPeriodLock({
        profileId: companyId,
        period_key: key,
        locked: false,
        userId: gate.userId,
        note: `Reopened VAT201 ${period.end}`,
      });
    }
    const written = await writeVatReturn(companyId, {
      periodStart: period.start,
      periodEnd: period.end,
      status: 'draft',
      locked: false,
      lockedMonths: [],
      actor: gate.userId,
    });
    if (!written.ok) return NextResponse.json({ error: written.error }, { status: 400 });
    return NextResponse.json({ success: true, status: 'draft' });
  }

  if (action === 'record_submission') {
    if (stored.status !== 'reviewed' && stored.status !== 'submitted') {
      return NextResponse.json({ error: 'Review the return before recording the SARS reference.' }, { status: 400 });
    }
    const reference = String(body.submissionReference || '').trim();
    const submittedOn = String(body.submittedOn || '').slice(0, 10);
    if (!reference || !/^\d{4}-\d{2}-\d{2}$/.test(submittedOn)) {
      return NextResponse.json({ error: 'Enter the eFiling reference and the submission date.' }, { status: 400 });
    }
    const written = await writeVatReturn(companyId, {
      periodStart: period.start,
      periodEnd: period.end,
      status: 'submitted',
      locked: true,
      submissionReference: reference,
      submittedOn,
      actor: gate.userId,
    });
    if (!written.ok) return NextResponse.json({ error: written.error }, { status: 400 });
    return NextResponse.json({ success: true, status: 'submitted', row: written.row });
  }

  if (action === 'record_payment') {
    if (stored.status !== 'submitted' && stored.status !== 'paid') {
      return NextResponse.json({ error: 'Record the SARS submission before the payment.' }, { status: 400 });
    }
    if (body.confirmPayment !== true) {
      return NextResponse.json({ error: 'Confirm the payment before SupplierAdvisor® posts the journal.' }, { status: 400 });
    }
    if (stored.settlementJournalId) {
      return NextResponse.json({ error: 'This return already has a settlement journal.', journalId: stored.settlementJournalId }, { status: 400 });
    }
    const paidOn = String(body.paidOn || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
      return NextResponse.json({ error: 'Enter the payment date.' }, { status: 400 });
    }
    const lines = buildVatSettlementLines({
      outputTax: report.totals.outputTax,
      inputTax: report.totals.inputTax,
    });
    if (!lines.ok) return NextResponse.json({ error: lines.error }, { status: 400 });
    const bankCode = String(body.bankAccountCode || '1110');
    const ids: Record<string, number> = {};
    for (const code of ['1150', '2120', bankCode]) {
      const id = await accountId(companyId, code);
      if (!id) return NextResponse.json({ error: `Chart of accounts is missing ${code}.` }, { status: 400 });
      ids[code] = id;
    }
    ids['2125'] = await ensureClearingAccount(companyId);
    const posted = await postBalancedJournal({
      profileId: companyId,
      entryDate: paidOn,
      memo: `VAT201 settlement ${period.label}`,
      source: 'vat201_settlement',
      sourceId: `${companyId}:${period.end}`,
      createdBy: gate.userId,
      metadata: {
        period_start: period.start,
        period_end: period.end,
        field13: report.totals.outputTax,
        field19: report.totals.inputTax,
        field20: report.totals.payable - report.totals.refundable,
      },
      lines: lines.lines.map((line) => ({
        accountId: ids[line.accountCode === '1110' ? bankCode : line.accountCode],
        debit: line.debit,
        credit: line.credit,
        memo: line.memo,
      })),
    });
    if (!posted.ok) return NextResponse.json({ error: posted.error }, { status: 400 });
    const amount = body.paymentAmount != null ? Number(body.paymentAmount) : lines.bankAmount;
    const written = await writeVatReturn(companyId, {
      periodStart: period.start,
      periodEnd: period.end,
      status: 'paid',
      locked: true,
      paymentReference: String(body.paymentReference || ''),
      paidOn,
      paymentAmount: amount,
      settlementJournalId: posted.journalId,
      actor: gate.userId,
    });
    if (!written.ok) {
      return NextResponse.json(
        { error: written.error, journalId: posted.journalId },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, status: 'paid', journalId: posted.journalId, entryNumber: posted.entryNumber });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
