import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { bankDetailsWhatsAppText } from '@/lib/invites/whatsapp';

/**
 * GET ?companyId=&peerName=&invoiceNumber=&amount=&currency=
 * Returns bank fields + ready WhatsApp text for EFT share (pending connect OK).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let profile: Record<string, unknown> | null = null;
    {
      const full = await supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, bank_name, account_name, account_number, branch_code, account_type, contact_phone, phone, whatsapp, metadata'
        )
        .eq('id', companyId)
        .maybeSingle();
      if (!full.error && full.data) {
        profile = full.data as Record<string, unknown>;
      } else {
        const min = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name, metadata, contact_phone, phone')
          .eq('id', companyId)
          .maybeSingle();
        profile = (min.data as Record<string, unknown>) || null;
      }
    }

    if (!profile) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const meta =
      profile.metadata && typeof profile.metadata === 'object'
        ? (profile.metadata as Record<string, unknown>)
        : {};
    const banking =
      meta.banking && typeof meta.banking === 'object'
        ? (meta.banking as Record<string, unknown>)
        : {};

    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const a = profile![k];
        if (a != null && String(a).trim()) return String(a).trim();
        const b = banking[k];
        if (b != null && String(b).trim()) return String(b).trim();
      }
      return null;
    };

    const bank = {
      bankName: pick('bank_name', 'bank'),
      accountName: pick('account_name', 'bank_account_name'),
      accountNumber: pick('account_number', 'bank_account_number'),
      branchCode: pick('branch_code', 'branch'),
      accountType: pick('account_type'),
    };

    const sellerName =
      String(profile.trading_name || profile.legal_name || 'Supplier').trim();
    const peerName = sp.get('peerName') || null;
    const invoiceNumber = sp.get('invoiceNumber') || null;
    const amountRaw = sp.get('amount');
    const amount =
      amountRaw != null && amountRaw !== '' ? Number(amountRaw) : null;
    const currency = sp.get('currency') || 'ZAR';
    const siteLink = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://www.supplieradvisor.com'
    ).replace(/\/$/, '');

    const text = bankDetailsWhatsAppText({
      sellerName,
      peerName,
      bankName: bank.bankName,
      accountName: bank.accountName,
      accountNumber: bank.accountNumber,
      branchCode: bank.branchCode,
      accountType: bank.accountType,
      invoiceNumber,
      amount: Number.isFinite(amount as number) ? amount : null,
      currency,
      siteLink,
    });

    const hasBank = Boolean(bank.bankName || bank.accountNumber);
    const contactPhone = pick('whatsapp', 'contact_phone', 'phone');

    return NextResponse.json({
      success: true,
      hasBank,
      sellerName,
      bank,
      contactPhone,
      text,
      hint: hasBank
        ? 'Share via WhatsApp — works even while connection is pending'
        : 'Add bank details under My business → Profile before sharing',
      setupBankHref: '/dashboard/my-business/profile#banking',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
