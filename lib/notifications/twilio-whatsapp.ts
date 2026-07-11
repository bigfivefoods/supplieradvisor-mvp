/**
 * Twilio WhatsApp alerts (optional).
 * Env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM  e.g. whatsapp:+14155238886 (sandbox) or approved sender
 *   TWILIO_WHATSAPP_TO_DEFAULT optional fallback whatsapp:+27…
 *
 * Soft-fail if not configured.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export function isTwilioWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
  );
}

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

function normalizeWhatsApp(to: string): string {
  const t = to.trim();
  if (t.startsWith('whatsapp:')) return t;
  // digits only E.164
  const digits = t.replace(/[^\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits : `+${digits}`;
  return `whatsapp:${e164}`;
}

async function companyPhones(profileId: number): Promise<string[]> {
  const supabase = getSupabaseServer();
  const phones = new Set<string>();

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, contact_phone, whatsapp, trading_name')
    .eq('id', profileId)
    .maybeSingle();

  for (const k of ['phone', 'contact_phone', 'whatsapp'] as const) {
    const v = profile?.[k];
    if (v && String(v).replace(/\D/g, '').length >= 9) phones.add(String(v));
  }

  const { data: members } = await supabase
    .from('business_users')
    .select('phone, role, status')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .limit(20);

  for (const m of members || []) {
    const role = String(m.role || '').toLowerCase();
    if (['owner', 'admin', 'finance', 'ops'].includes(role) || !role) {
      if (m.phone) phones.add(String(m.phone));
    }
  }

  const def = process.env.TWILIO_WHATSAPP_TO_DEFAULT;
  if (def) phones.add(def);

  return [...phones];
}

export async function sendWhatsApp(params: {
  to: string[];
  body: string;
}): Promise<{ ok: boolean; sent: number; error?: string }> {
  if (!isTwilioWhatsAppConfigured()) {
    return { ok: false, sent: 0, error: 'Twilio WhatsApp not configured' };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  let sent = 0;
  let lastError = '';
  for (const raw of params.to.slice(0, 5)) {
    try {
      const body = new URLSearchParams({
        From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
        To: normalizeWhatsApp(raw),
        Body: params.body.slice(0, 1500),
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      if (!res.ok) {
        lastError = await res.text();
        console.warn('[twilio-whatsapp]', res.status, lastError.slice(0, 200));
        continue;
      }
      sent += 1;
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : 'send failed';
      console.warn('[twilio-whatsapp]', lastError);
    }
  }
  return { ok: sent > 0, sent, error: sent ? undefined : lastError || 'No sends' };
}

export async function whatsappQaHold(params: {
  profileId: number;
  inspectionId: number;
  lotNumber?: string | null;
  status: string;
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) return;
  try {
    const phones = await companyPhones(params.profileId);
    if (!phones.length) return;
    const lot = params.lotNumber || '—';
    const href = `${appBase()}/dashboard/quality/inspections`;
    await sendWhatsApp({
      to: phones,
      body: `SupplierAdvisor QA ${params.status}: inspection #${params.inspectionId}, lot ${lot}. Shipping blocked until cleared. ${href}`,
    });
  } catch (e) {
    console.warn('whatsappQaHold', e);
  }
}

export async function whatsappEscrowFunded(params: {
  profileId: number;
  poId: number;
  onchainPoId?: string | null;
  asset?: string;
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) return;
  try {
    const phones = await companyPhones(params.profileId);
    if (!phones.length) return;
    const href = `${appBase()}/dashboard/suppliers/po`;
    const asset = params.asset === 'usdc' ? 'USDC' : 'on-chain';
    await sendWhatsApp({
      to: phones,
      body: `SupplierAdvisor: PO #${params.poId} ${asset} escrow funded${
        params.onchainPoId ? ` (chain #${params.onchainPoId})` : ''
      }. Supplier ship → buyer confirm. ${href}`,
    });
  } catch (e) {
    console.warn('whatsappEscrowFunded', e);
  }
}
