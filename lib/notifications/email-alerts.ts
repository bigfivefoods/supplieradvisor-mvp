/**
 * Transactional email alerts (Resend) for critical ops events.
 * Fails soft — never blocks the primary API action.
 */
import { getResend, getResendFrom } from '@/lib/resend';
import { getSupabaseServer } from '@/lib/supabase/server-client';

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

async function companyEmails(profileId: number): Promise<string[]> {
  const supabase = getSupabaseServer();
  const emails = new Set<string>();

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, contact_email, trading_name')
    .eq('id', profileId)
    .maybeSingle();

  if (profile?.email) emails.add(String(profile.email).toLowerCase());
  if (profile?.contact_email) emails.add(String(profile.contact_email).toLowerCase());

  const { data: members } = await supabase
    .from('business_users')
    .select('email, invited_email, role, status')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .limit(20);

  for (const m of members || []) {
    const role = String(m.role || '').toLowerCase();
    if (['owner', 'admin', 'finance', 'ops'].includes(role) || !role) {
      if (m.email) emails.add(String(m.email).toLowerCase());
      if (m.invited_email) emails.add(String(m.invited_email).toLowerCase());
    }
  }

  return [...emails].filter((e) => e.includes('@'));
}

async function sendAlert(params: {
  to: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!params.to.length) return { ok: false, error: 'No recipients' };
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email-alerts] RESEND_API_KEY not set — skip');
    return { ok: false, error: 'RESEND_API_KEY not set' };
  }
  try {
    const resend = getResend();
    const from = getResendFrom();
    const { error } = await resend.emails.send({
      from,
      to: params.to.slice(0, 10),
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.warn('[email-alerts]', error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'send failed';
    console.warn('[email-alerts]', msg);
    return { ok: false, error: msg };
  }
}

export async function notifyQaHold(params: {
  profileId: number;
  inspectionId: number;
  lotNumber?: string | null;
  status: string;
}): Promise<void> {
  try {
    const to = await companyEmails(params.profileId);
    const lot = params.lotNumber || '—';
    const href = `${appBase()}/dashboard/quality/inspections`;
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] QA ${params.status} — lot ${lot}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#b45309">Quality hold</h2>
          <p>Inspection <strong>#${params.inspectionId}</strong> is <strong>${params.status}</strong>.</p>
          <p>Lot: <code>${lot}</code></p>
          <p>Shipping for this lot is blocked until the inspection is cleared.</p>
          <p><a href="${href}" style="color:#00b4d8">Open inspections →</a></p>
          <p style="color:#64748b;font-size:12px">SupplierAdvisor quality control</p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyQaHold', e);
  }
}

export async function notifyEscrowFunded(params: {
  profileId: number;
  poId: number;
  onchainPoId?: string | null;
  txHash?: string | null;
  asset?: string;
}): Promise<void> {
  try {
    const to = await companyEmails(params.profileId);
    const href = `${appBase()}/dashboard/suppliers/po`;
    const chainNote = params.asset === 'usdc' ? 'USDC escrow' : 'on-chain escrow';
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] Escrow funded — PO #${params.poId}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#0077b6">Escrow funded</h2>
          <p>Purchase order <strong>#${params.poId}</strong> has ${chainNote} funds locked.</p>
          ${params.onchainPoId ? `<p>Chain PO id: <code>${params.onchainPoId}</code></p>` : ''}
          ${params.txHash ? `<p>Tx: <code style="font-size:11px">${params.txHash}</code></p>` : ''}
          <p>Next: supplier marks shipped, then buyer confirms delivery to release funds.</p>
          <p><a href="${href}" style="color:#00b4d8">Open purchase orders →</a></p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyEscrowFunded', e);
  }
}
