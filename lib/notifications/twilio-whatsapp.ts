/**
 * Twilio WhatsApp alerts (optional).
 * Env (any alias works):
 *   TWILIO_ACCOUNT_SID | TWILIO_SID
 *   TWILIO_AUTH_TOKEN | TWILIO_TOKEN
 *   TWILIO_WHATSAPP_FROM | TWILIO_FROM  e.g. whatsapp:+14155238886
 *   TWILIO_WHATSAPP_TO_DEFAULT optional fallback whatsapp:+27…
 *
 * Soft-fail if not configured.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export function getTwilioAccountSid(): string {
  return String(
    process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID || ''
  ).trim();
}

export function getTwilioAuthToken(): string {
  return String(
    process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN || ''
  ).trim();
}

/** Ensures whatsapp:+… form for Twilio From / To */
export function normalizeWhatsAppAddress(raw: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (t.startsWith('whatsapp:')) return t;
  const digits = t.replace(/[^\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits : `+${digits}`;
  return `whatsapp:${e164}`;
}

export function getTwilioWhatsAppFrom(): string {
  const raw = String(
    process.env.TWILIO_WHATSAPP_FROM ||
      process.env.TWILIO_FROM ||
      process.env.TWILIO_WHATSAPP_NUMBER ||
      ''
  ).trim();
  return raw ? normalizeWhatsAppAddress(raw) : '';
}

export function isTwilioWhatsAppConfigured(): boolean {
  return Boolean(
    getTwilioAccountSid() && getTwilioAuthToken() && getTwilioWhatsAppFrom()
  );
}

export function twilioConfigStatus(): {
  configured: boolean;
  accountSid: boolean;
  authToken: boolean;
  from: boolean;
  fromPreview: string | null;
  defaultTo: boolean;
} {
  const from = getTwilioWhatsAppFrom();
  return {
    configured: isTwilioWhatsAppConfigured(),
    accountSid: Boolean(getTwilioAccountSid()),
    authToken: Boolean(getTwilioAuthToken()),
    from: Boolean(from),
    fromPreview: from
      ? `${from.slice(0, 14)}…${from.slice(-4)}`
      : null,
    defaultTo: Boolean(process.env.TWILIO_WHATSAPP_TO_DEFAULT),
  };
}

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

function normalizeWhatsApp(to: string): string {
  return normalizeWhatsAppAddress(to);
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
    const role = String(m.role || '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (
      ['owner', 'admin', 'finance', 'ops', 'operations'].includes(role) ||
      !role
    ) {
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
  /**
   * Public HTTPS URL of a PDF (or image). Twilio fetches it and delivers as a
   * WhatsApp document attachment — not just a link in the chat.
   */
  mediaUrl?: string | null;
}): Promise<{ ok: boolean; sent: number; error?: string }> {
  if (!isTwilioWhatsAppConfigured()) {
    return { ok: false, sent: 0, error: 'Twilio WhatsApp not configured' };
  }
  const sid = getTwilioAccountSid();
  const token = getTwilioAuthToken();
  const from = getTwilioWhatsAppFrom();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const media =
    params.mediaUrl && String(params.mediaUrl).startsWith('https://')
      ? String(params.mediaUrl)
      : null;

  let sent = 0;
  let lastError = '';
  for (const raw of params.to.slice(0, 5)) {
    try {
      const body = new URLSearchParams({
        From: from,
        To: normalizeWhatsApp(raw),
        Body: params.body.slice(0, 1500),
      });
      // MediaUrl = actual WhatsApp document (PDF) attachment
      if (media) {
        body.append('MediaUrl', media);
      }
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

/**
 * Send a commercial document PDF as a real WhatsApp document (Twilio MediaUrl).
 * Requires public HTTPS PDF URL (signed token route).
 */
export async function sendWhatsAppDocument(params: {
  to: string;
  body: string;
  mediaUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const result = await sendWhatsApp({
    to: [params.to],
    body: params.body,
    mediaUrl: params.mediaUrl,
  });
  return {
    ok: result.ok,
    error: result.error,
  };
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

export async function whatsappPeriodLock(params: {
  profileId: number;
  periodKey: string;
  locked: boolean;
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) return;
  try {
    const phones = await companyPhones(params.profileId);
    if (!phones.length) return;
    const verb = params.locked ? 'locked' : 'unlocked';
    const href = `${appBase()}/dashboard/accounting/settings`;
    await sendWhatsApp({
      to: phones,
      body: `SupplierAdvisor: accounting period ${params.periodKey} ${verb}. ${href}`,
    });
  } catch (e) {
    console.warn('whatsappPeriodLock', e);
  }
}

export async function whatsappShipBlocked(params: {
  profileId: number;
  lots: string[];
  transferId?: number | string | null;
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) return;
  try {
    const phones = await companyPhones(params.profileId);
    if (!phones.length) return;
    const lots = params.lots.length ? params.lots.join(', ') : '—';
    const href = `${appBase()}/dashboard/quality/inspections`;
    await sendWhatsApp({
      to: phones,
      body: `SupplierAdvisor: ship blocked — QA hold on lot(s) ${lots}. Clear inspections. ${href}`,
    });
  } catch (e) {
    console.warn('whatsappShipBlocked', e);
  }
}

export async function whatsappRecallPack(params: {
  profileId: number;
  lotNumber?: string | null;
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) return;
  try {
    const phones = await companyPhones(params.profileId);
    if (!phones.length) return;
    const lot = params.lotNumber || '—';
    const href = `${appBase()}/dashboard/quality/recall-simulator`;
    await sendWhatsApp({
      to: phones,
      body: `SupplierAdvisor: recall/regulatory pack generated for lot ${lot}. ${href}`,
    });
  } catch (e) {
    console.warn('whatsappRecallPack', e);
  }
}

export async function whatsappBankSyncFailed(params: {
  profileId: number;
  error: string;
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) return;
  try {
    const phones = await companyPhones(params.profileId);
    if (!phones.length) return;
    const href = `${appBase()}/dashboard/accounting/bank-reconciliation`;
    await sendWhatsApp({
      to: phones,
      body: `SupplierAdvisor: bank sync failed — ${String(params.error).slice(0, 120)}. ${href}`,
    });
  } catch (e) {
    console.warn('whatsappBankSyncFailed', e);
  }
}

/** Seller: buyer submitted a payment claim — confirm on Money hub. */
export async function whatsappPaymentClaimToSeller(params: {
  sellerProfileId: number;
  invoiceId: number;
  invoiceNumber?: string | null;
  amount: number;
  currency?: string | null;
  reference?: string | null;
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) return;
  try {
    const phones = await companyPhones(params.sellerProfileId);
    if (!phones.length) return;
    const ccy = (params.currency || 'ZAR').toUpperCase();
    const amt = Number(params.amount).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    const inv = params.invoiceNumber || `#${params.invoiceId}`;
    const ref = params.reference ? ` ref ${params.reference}` : '';
    const href = `${appBase()}/dashboard/customers/money`;
    await sendWhatsApp({
      to: phones,
      body: `SupplierAdvisor: buyer claimed payment ${ccy} ${amt} on ${inv}${ref}. Confirm on Money hub: ${href}`,
    });
  } catch (e) {
    console.warn('whatsappPaymentClaimToSeller', e);
  }
}

/** Buyer: seller confirmed or rejected payment claim. */
export async function whatsappPaymentClaimResolvedToBuyer(params: {
  buyerProfileId: number;
  invoiceId: number;
  invoiceNumber?: string | null;
  amount: number;
  currency?: string | null;
  outcome: 'confirmed' | 'rejected';
  sellerName?: string | null;
  sellerProfileId?: number | null;
}): Promise<void> {
  if (!isTwilioWhatsAppConfigured()) return;
  try {
    const phones = await companyPhones(params.buyerProfileId);
    if (!phones.length) return;
    const ccy = (params.currency || 'ZAR').toUpperCase();
    const amt = Number(params.amount).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    const inv = params.invoiceNumber || `#${params.invoiceId}`;
    const seller = params.sellerName || 'Your supplier';
    const ok = params.outcome === 'confirmed';
    const moneyHref = `${appBase()}/dashboard/buyer/money`;
    const rateHref = params.sellerProfileId
      ? `${appBase()}/dashboard/suppliers/ratings?ratee=${params.sellerProfileId}`
      : `${appBase()}/dashboard?ratePrompt=open`;
    await sendWhatsApp({
      to: phones,
      body: ok
        ? `SupplierAdvisor: ${seller} confirmed your payment (${ccy} ${amt}) on ${inv}. Rate them: ${rateHref}`
        : `SupplierAdvisor: ${seller} did not accept your payment claim on ${inv} (${ccy} ${amt}). Check Money: ${moneyHref}`,
    });
  } catch (e) {
    console.warn('whatsappPaymentClaimResolvedToBuyer', e);
  }
}
