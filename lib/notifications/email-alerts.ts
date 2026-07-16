/**
 * Transactional email alerts (Resend) for critical ops events.
 * Fails soft — never blocks the primary API action.
 */
import { getResend, getResendFrom } from '@/lib/resend';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

async function companyEmails(profileId: number): Promise<string[]> {
  const { emails } = await resolveCompanyEmails(profileId, {
    roleAllowlist: ['owner', 'admin', 'finance', 'ops', 'operations'],
    limit: 10,
  });
  return emails;
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
    // Parallel WhatsApp (soft)
    void import('@/lib/notifications/twilio-whatsapp').then(({ whatsappQaHold }) =>
      whatsappQaHold(params)
    );
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
    void import('@/lib/notifications/twilio-whatsapp').then(({ whatsappEscrowFunded }) =>
      whatsappEscrowFunded(params)
    );
  } catch (e) {
    console.warn('notifyEscrowFunded', e);
  }
}

export async function notifyPeriodLock(params: {
  profileId: number;
  periodKey: string;
  locked: boolean;
  actorUserId?: string | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.profileId);
    const href = `${appBase()}/dashboard/accounting/settings`;
    const verb = params.locked ? 'locked' : 'unlocked';
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] Accounting period ${verb} — ${params.periodKey}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:${params.locked ? '#b45309' : '#047857'}">Period ${verb}</h2>
          <p>Accounting period <strong>${params.periodKey}</strong> was <strong>${verb}</strong>.</p>
          ${
            params.locked
              ? '<p>New journals into this period are blocked until unlocked by finance/admin.</p>'
              : '<p>Posting into this period is allowed again.</p>'
          }
          <p><a href="${href}" style="color:#00b4d8">Open accounting settings →</a></p>
        </div>
      `,
    });
    void import('@/lib/notifications/twilio-whatsapp').then(({ whatsappPeriodLock }) =>
      whatsappPeriodLock(params)
    );
  } catch (e) {
    console.warn('notifyPeriodLock', e);
  }
}

export async function notifyShipBlockedByQa(params: {
  profileId: number;
  lots: string[];
  transferId?: number | string | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.profileId);
    const lots = params.lots.length ? params.lots.join(', ') : '—';
    const href = `${appBase()}/dashboard/quality/inspections`;
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] Ship blocked — QA hold on lot(s) ${lots}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#b91c1c">Shipment blocked</h2>
          <p>A warehouse ship was blocked because lot(s) <code>${lots}</code> have open or failed inspections.</p>
          ${
            params.transferId != null
              ? `<p>Transfer / order: <strong>#${params.transferId}</strong></p>`
              : ''
          }
          <p>Clear holds under Quality → Inspections, then retry ship.</p>
          <p><a href="${href}" style="color:#00b4d8">Open inspections →</a></p>
        </div>
      `,
    });
    void import('@/lib/notifications/twilio-whatsapp').then(({ whatsappShipBlocked }) =>
      whatsappShipBlocked(params)
    );
  } catch (e) {
    console.warn('notifyShipBlockedByQa', e);
  }
}

export async function notifyRecallPack(params: {
  profileId: number;
  lotNumber?: string | null;
  productName?: string | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.profileId);
    const lot = params.lotNumber || '—';
    const href = `${appBase()}/dashboard/quality/recall-simulator`;
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] Recall / regulatory pack generated — lot ${lot}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#7c3aed">Recall pack generated</h2>
          <p>A regulatory / recall pack was generated for lot <code>${lot}</code>${
            params.productName ? ` (${params.productName})` : ''
          }.</p>
          <p><a href="${href}" style="color:#00b4d8">Open recall tools →</a></p>
        </div>
      `,
    });
    void import('@/lib/notifications/twilio-whatsapp').then(({ whatsappRecallPack }) =>
      whatsappRecallPack(params)
    );
  } catch (e) {
    console.warn('notifyRecallPack', e);
  }
}

export async function notifyBankSyncFailed(params: {
  profileId: number;
  connectionId?: string | number | null;
  error: string;
}): Promise<void> {
  try {
    const to = await companyEmails(params.profileId);
    const href = `${appBase()}/dashboard/accounting/bank-reconciliation`;
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] Bank sync failed`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#b91c1c">Bank feed error</h2>
          <p>A bank connection sync failed${
            params.connectionId != null ? ` (connection #${params.connectionId})` : ''
          }.</p>
          <p style="color:#64748b;font-size:13px"><code>${String(params.error).slice(0, 400)}</code></p>
          <p><a href="${href}" style="color:#00b4d8">Open bank reconciliation →</a></p>
        </div>
      `,
    });
    void import('@/lib/notifications/twilio-whatsapp').then(({ whatsappBankSyncFailed }) =>
      whatsappBankSyncFailed(params)
    );
  } catch (e) {
    console.warn('notifyBankSyncFailed', e);
  }
}
