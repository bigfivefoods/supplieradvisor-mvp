/**
 * One-shot branded mail test. Requires BRAND_TEST_MAIL_TOKEN.
 * Sends PhysioAdvisor (Balance) samples to a fixed inbox.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { resolveCompanyLogoUrl } from '@/lib/business/company-logo';
import {
  sendAdvisorInvoiceEmail,
  sendAdvisorNoticeEmail,
  sendAdvisorSessionEmail,
} from '@/lib/services/advisor-branded-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TO = 'craig@bigfivefoods.com';
const BALANCE_ID = 5745;

export async function GET(req: NextRequest) {
  const expected = String(process.env.BRAND_TEST_MAIL_TOKEN || '').trim();
  const got = String(req.nextUrl.searchParams.get('t') || '').trim();
  if (!expected || got !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const { data: prof, error } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, logo_url')
    .eq('id', BALANCE_ID)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!prof) {
    return NextResponse.json({ error: 'Balance company not found' }, { status: 404 });
  }

  const brand =
    String(prof.trading_name || prof.legal_name || '').trim() || 'Balance';
  const logoUrl = resolveCompanyLogoUrl({
    profileLogoUrl: prof.logo_url,
    settings: null,
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);

  const reminder = await sendAdvisorSessionEmail(TO, {
    kind: 'pre',
    personName: 'Craig',
    brand,
    eventTitle: 'Physio assessment',
    date,
    start_time: '09:30',
    location: 'Room 1',
    practitionerName: 'Lee',
    logoUrl,
    ctaUrl: 'https://www.supplieradvisor.com/me',
    moduleKey: 'physiograph',
    moduleLabel: 'PhysioAdvisor®',
  });

  const invoice = await sendAdvisorInvoiceEmail(TO, {
    personName: 'Craig',
    brand,
    description: 'Physio consult · branding test',
    amountLabel: 'R850',
    invoiceNumber: 'TEST-BALANCE-1',
    dueDate: date,
    logoUrl,
    ctaUrl: 'https://www.supplieradvisor.com/me?tab=account',
    moduleKey: 'physiograph',
    moduleLabel: 'PhysioAdvisor®',
  });

  const notice = await sendAdvisorNoticeEmail(TO, {
    personName: 'Craig',
    brand,
    logoUrl,
    moduleKey: 'physiograph',
    moduleLabel: 'PhysioAdvisor®',
    subject: `${brand} · PhysioAdvisor branding test`,
    headline: 'Your PhysioAdvisor mail looks like this',
    leadHtml:
      'This is a <strong>test</strong> from Balance on PhysioAdvisor® so you can check the company logo, PhysioAdvisor teal header, and SupplierAdvisor footer.',
    ctaUrl: 'https://www.supplieradvisor.com/dashboard/physiograph',
    ctaLabel: 'Open PhysioAdvisor',
  });

  const ok = reminder.ok && invoice.ok && notice.ok;
  return NextResponse.json(
    {
      ok,
      brand,
      has_logo: Boolean(logoUrl),
      to: TO,
      reminder,
      invoice,
      notice,
    },
    { status: ok ? 200 : 502 }
  );
}
