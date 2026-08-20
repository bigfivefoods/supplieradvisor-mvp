/**
 * Advisor split-settlement bank — Paystack subaccount + 1% platform admin.
 * Card / Apple Pay already collects on SupplierAdvisor; this bank is where
 * split funds land. GET ?companyId=&banks=1
 * POST { action: resolve | save | disconnect, companyId, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  ADVISOR_PLATFORM_FEE_PCT,
  ADVISOR_PAYSTACK_BEARER,
  accountLast4,
  isAdvisorPayoutReady,
  normalizeAccountNumber,
  previewAdvisorPayoutSplit,
  publicAdvisorPayout,
  readAdvisorPayout,
  writeAdvisorPayout,
  type AdvisorPayoutRecord,
} from '@/lib/billing/advisor-payout';
import {
  listPaystackZaBanks,
  resolvePaystackAccount,
  upsertPaystackSubaccount,
} from '@/lib/billing/paystack-subaccounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadCompany(companyId: number) {
  const supabase = getSupabaseServer();
  const full = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, metadata, bank_name, account_number')
    .eq('id', companyId)
    .maybeSingle();
  const row = full.error
    ? await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, metadata')
        .eq('id', companyId)
        .maybeSingle()
    : full;
  if (row.error) throw new Error(row.error.message);
  const data = row.data;
  if (!data) return null;
  const meta =
    data.metadata && typeof data.metadata === 'object'
      ? { ...(data.metadata as Record<string, unknown>) }
      : {};
  const rec = data as Record<string, unknown>;
  return {
    supabase,
    meta,
    name: String(data.trading_name || data.legal_name || `Company #${companyId}`),
    bankName: rec.bank_name ? String(rec.bank_name) : '',
    accountNumber: rec.account_number ? String(rec.account_number) : '',
  };
}

function feePayload() {
  return {
    platform_fee_pct: ADVISOR_PLATFORM_FEE_PCT,
    bearer: ADVISOR_PAYSTACK_BEARER,
    preview: previewAdvisorPayoutSplit(1000),
  };
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const company = await loadCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    const payout = readAdvisorPayout(company.meta);
    const includeBanks = request.nextUrl.searchParams.get('banks') === '1';
    let banks: Array<{ name: string; code: string }> = [];
    if (includeBanks) {
      const listed = await listPaystackZaBanks();
      if (listed.ok) banks = listed.banks;
    }

    return NextResponse.json({
      success: true,
      payout: publicAdvisorPayout(payout),
      prefill: {
        business_name: payout?.business_name || company.name,
        bank_name: company.bankName || payout?.settlement_bank_name || '',
        account_last4:
          payout?.account_last4 ||
          (company.accountNumber ? accountLast4(company.accountNumber) : ''),
        account_number: payout ? '' : company.accountNumber || '',
      },
      banks,
      ...feePayload(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const company = await loadCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const action = String(body.action || 'save');
    const existing = readAdvisorPayout(company.meta);

    if (action === 'resolve') {
      const resolved = await resolvePaystackAccount({
        accountNumber: String(body.account_number || ''),
        bankCode: String(body.bank_code || ''),
      });
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, account: resolved.account });
    }

    if (action === 'disconnect') {
      if (!existing) {
        return NextResponse.json({
          success: true,
          payout: publicAdvisorPayout(null),
          message: 'No split bank saved',
          ...feePayload(),
        });
      }
      const next: AdvisorPayoutRecord = {
        ...existing,
        active: false,
        updated_at: new Date().toISOString(),
      };
      const { error } = await company.supabase
        .from('profiles')
        .update({
          metadata: writeAdvisorPayout(company.meta, next),
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);
      if (error) throw new Error(error.message);
      return NextResponse.json({
        success: true,
        payout: publicAdvisorPayout(next),
        message:
          'Split bank paused. Card / Apple Pay still works; funds stay on SupplierAdvisor until you add a bank.',
        ...feePayload(),
      });
    }

    if (action !== 'save' && action !== 'connect' && action !== 'update') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const businessName = String(body.business_name || company.name).trim();
    const bankCode = String(body.bank_code || '').trim();
    const accountNumber = normalizeAccountNumber(String(body.account_number || ''));
    if (!bankCode) {
      return NextResponse.json({ error: 'Select a bank' }, { status: 400 });
    }
    if (accountNumber.length < 6) {
      return NextResponse.json(
        { error: 'Enter a valid account number' },
        { status: 400 }
      );
    }

    const banks = await listPaystackZaBanks();
    const bankName = banks.ok
      ? banks.banks.find((b) => b.code === bankCode)?.name ||
        String(body.bank_name || '')
      : String(body.bank_name || '');

    let accountName =
      body.account_name != null ? String(body.account_name).trim() : '';
    const resolved = await resolvePaystackAccount({
      accountNumber,
      bankCode,
    });
    if (resolved.ok) {
      accountName = resolved.account.account_name;
    }

    const upserted = await upsertPaystackSubaccount({
      existingCode: existing?.subaccount_code || null,
      businessName,
      bankCode,
      accountNumber,
    });
    if (!upserted.ok) {
      return NextResponse.json({ error: upserted.error }, { status: 400 });
    }
    if (!upserted.subaccount.subaccount_code) {
      return NextResponse.json(
        { error: 'Paystack did not return a subaccount code' },
        { status: 502 }
      );
    }

    const now = new Date().toISOString();
    const next: AdvisorPayoutRecord = {
      subaccount_code: upserted.subaccount.subaccount_code,
      business_name: businessName,
      settlement_bank: bankCode,
      settlement_bank_name: bankName,
      account_last4: accountLast4(
        upserted.subaccount.account_number || accountNumber
      ),
      account_name: accountName || null,
      percentage_charge: ADVISOR_PLATFORM_FEE_PCT,
      bearer: ADVISOR_PAYSTACK_BEARER,
      active: true,
      connected_at: existing?.connected_at || now,
      updated_at: now,
    };

    const { error } = await company.supabase
      .from('profiles')
      .update({
        metadata: writeAdvisorPayout(company.meta, next),
        updated_at: now,
      })
      .eq('id', companyId);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      payout: publicAdvisorPayout(next),
      ready: isAdvisorPayoutReady(next),
      message: accountName
        ? `Split bank saved · ${accountName}`
        : 'Split bank saved',
      ...feePayload(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
