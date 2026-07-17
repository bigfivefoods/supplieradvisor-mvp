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

/** Supplier receives a new inbound PO from a buyer (SRM or portal). */
export async function notifyInboundPo(params: {
  supplierProfileId: number;
  buyerProfileId: number;
  buyerName?: string | null;
  poId: number;
  totalAmount?: number | null;
  currency?: string | null;
  lineCount?: number;
  source?: string | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.supplierProfileId);
    const href = `${appBase()}/dashboard/customers/orders?tab=inbound`;
    const buyer = params.buyerName || `Company #${params.buyerProfileId}`;
    const ccy = (params.currency || 'ZAR').toUpperCase();
    const total =
      params.totalAmount != null && Number.isFinite(Number(params.totalAmount))
        ? `${ccy} ${Number(params.totalAmount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}`
        : '—';
    const lines =
      params.lineCount != null ? `${params.lineCount} line(s)` : 'lines attached';
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] New purchase order #${params.poId} from ${buyer}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#0077b6">Inbound purchase order</h2>
          <p><strong>${buyer}</strong> raised <strong>PO #${params.poId}</strong> against your company.</p>
          <p>Total: <strong>${total}</strong> · ${lines}
          ${params.source ? ` · source <code>${params.source}</code>` : ''}</p>
          <p>Accept or decline from your inbound orders inbox to keep the trade loop moving.</p>
          <p><a href="${href}" style="display:inline-block;background:#00b4d8;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Open inbound POs →</a></p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyInboundPo', e);
  }
}

/**
 * Soft nudge: a connected buyer tried to raise a PO but your sellable
 * catalogue / price list is empty. Rate-limit client-side (session).
 */
export async function notifyPublishCatalogue(params: {
  supplierProfileId: number;
  buyerProfileId: number;
  buyerName?: string | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.supplierProfileId);
    const href = `${appBase()}/dashboard/inventory/products?type=finished_good`;
    const pricing = `${appBase()}/dashboard/connections/pricing`;
    const buyer = params.buyerName || `Company #${params.buyerProfileId}`;
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] ${buyer} wants to order — publish your catalogue`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#0077b6">Share what you sell</h2>
          <p><strong>${buyer}</strong> is connected and ready to raise a purchase order, but your sellable catalogue (finished goods / services) and agreed price list look empty.</p>
          <p>Publish inventory as sellable finished goods/services, or share a pricing agreement, so they can pick lines instead of free-text only.</p>
          <p>
            <a href="${href}" style="display:inline-block;background:#00b4d8;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;margin-right:8px">Add finished goods →</a>
            <a href="${pricing}" style="color:#0077b6;font-weight:600">Pricing agreements →</a>
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyPublishCatalogue', e);
  }
}

/** Peer was accepted into the network (notify the original requester). */
export async function notifyConnectionAccepted(params: {
  requesterProfileId: number;
  peerName?: string | null;
  peerProfileId?: number | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.requesterProfileId);
    const peer = params.peerName || 'Your partner';
    const href =
      params.peerProfileId != null
        ? `${appBase()}/dashboard/connections/${params.peerProfileId}`
        : `${appBase()}/dashboard/connections`;
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] ${peer} accepted your connection`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#047857">Connection accepted</h2>
          <p><strong>${peer}</strong> is now in your network.</p>
          <p>Next: raise a purchase order, share pricing, or rate the partnership after delivery.</p>
          <p><a href="${href}" style="display:inline-block;background:#00b4d8;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Open connection workspace →</a></p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyConnectionAccepted', e);
  }
}

/** Customer / buyer notified when a commercial invoice is emailed. */
export async function notifyInvoiceSent(params: {
  /** Seller company that sent the invoice */
  sellerProfileId: number;
  customerEmail: string;
  invoiceNumber: string;
  sellerName?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  resend?: boolean;
}): Promise<void> {
  try {
    // Customer already receives the document via docs/send; this is a seller-side audit email
    const to = await companyEmails(params.sellerProfileId);
    const href = `${appBase()}/dashboard/customers/invoices`;
    const seller = params.sellerName || 'Your company';
    const ccy = (params.currency || 'ZAR').toUpperCase();
    const total =
      params.totalAmount != null && Number.isFinite(Number(params.totalAmount))
        ? `${ccy} ${Number(params.totalAmount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}`
        : '';
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] Invoice ${params.invoiceNumber} ${
        params.resend ? 're-sent' : 'sent'
      } to ${params.customerEmail}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#0077b6">Invoice ${params.resend ? 're-sent' : 'sent'}</h2>
          <p><strong>${seller}</strong> ${
            params.resend ? 're-sent' : 'sent'
          } invoice <strong>${params.invoiceNumber}</strong> to <code>${params.customerEmail}</code>.</p>
          ${total ? `<p>Total: <strong>${total}</strong></p>` : ''}
          <p><a href="${href}" style="color:#00b4d8">Open invoices →</a></p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyInvoiceSent', e);
  }
}

/** Buyer notified when supplier accepts their PO. */
export async function notifyPoAccepted(params: {
  buyerProfileId: number;
  supplierName?: string | null;
  poId: number;
}): Promise<void> {
  try {
    const to = await companyEmails(params.buyerProfileId);
    const href = `${appBase()}/dashboard/suppliers/po`;
    const supplier = params.supplierName || 'Your supplier';
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] PO #${params.poId} accepted by ${supplier}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#047857">Purchase order accepted</h2>
          <p><strong>${supplier}</strong> accepted <strong>PO #${params.poId}</strong>.</p>
          <p>Next: track delivery and capture OTIFEF when goods arrive, then rate the partner.</p>
          <p><a href="${href}" style="color:#00b4d8">Open purchase orders →</a></p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyPoAccepted', e);
  }
}

/** Buyer notified when supplier raises an invoice from their PO. */
export async function notifyPoInvoiced(params: {
  buyerProfileId: number;
  supplierName?: string | null;
  poId: number;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.buyerProfileId);
    const invQ =
      params.invoiceId && Number(params.invoiceId) > 0
        ? `?invoiceId=${params.invoiceId}`
        : '';
    const docsHref = `${appBase()}/dashboard/buyer/documents${invQ}`;
    const poHref = `${appBase()}/dashboard/suppliers/po`;
    const supplier = params.supplierName || 'Your supplier';
    const invLabel =
      params.invoiceNumber ||
      (params.invoiceId ? `#${params.invoiceId}` : 'an invoice');
    const ccy = (params.currency || 'ZAR').toUpperCase();
    const total =
      params.totalAmount != null && Number.isFinite(Number(params.totalAmount))
        ? `${ccy} ${Number(params.totalAmount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}`
        : '';
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] Invoice raised for PO #${params.poId} by ${supplier}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#b45309">Supplier invoiced your PO</h2>
          <p><strong>${supplier}</strong> raised invoice <strong>${invLabel}</strong>
          against <strong>PO #${params.poId}</strong>.</p>
          ${total ? `<p>Total: <strong>${total}</strong></p>` : ''}
          <p>Next: open the invoice when shared, receive goods (OTIFEF), then rate the partner.</p>
          <p>
            <a href="${docsHref}" style="color:#00b4d8">Open documents →</a>
            &nbsp;·&nbsp;
            <a href="${poHref}" style="color:#00b4d8">Open purchase orders →</a>
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyPoInvoiced', e);
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

/**
 * Ops alert when a company self-registers.
 * Default recipient: connect@supplieradvisor.com (override via NEW_COMPANY_NOTIFY_EMAIL).
 */
export async function notifyNewCompanyRegistered(params: {
  profileId: number;
  tradingName?: string | null;
  legalName?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  country?: string | null;
  city?: string | null;
  industry?: string | null;
  businessType?: string | null;
  website?: string | null;
  ownerUserId?: string | null;
  lifetimePlan?: string | null;
  trialEndsAt?: string | null;
  referralSource?: string | null;
  referredByProfileId?: number | null;
}): Promise<void> {
  try {
    const toRaw =
      process.env.NEW_COMPANY_NOTIFY_EMAIL ||
      process.env.PLATFORM_OPS_EMAIL ||
      'connect@supplieradvisor.com';
    const to = toRaw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes('@'));
    if (!to.length) return;

    const name =
      params.tradingName || params.legalName || `Company #${params.profileId}`;
    const href = `${appBase()}/c/${params.profileId}`;
    const adminHint = `${appBase()}/dashboard`; // ops start from dashboard
    const rows: Array<[string, string]> = [
      ['Profile ID', String(params.profileId)],
      ['Trading name', name],
      ['Legal name', params.legalName || '—'],
      ['Contact', params.contactName || '—'],
      ['Email', params.contactEmail || '—'],
      ['Phone', params.contactPhone || '—'],
      [
        'Location',
        [params.city, params.country].filter(Boolean).join(', ') || '—',
      ],
      ['Industry', params.industry || '—'],
      ['Type', params.businessType || '—'],
      ['Website', params.website || '—'],
      [
        'Access',
        params.lifetimePlan
          ? `Lifetime (${params.lifetimePlan})`
          : params.trialEndsAt
            ? `Trial until ${params.trialEndsAt.slice(0, 10)}`
            : 'Trial / standard',
      ],
      [
        'Referral',
        params.referredByProfileId
          ? `#${params.referredByProfileId}${
              params.referralSource ? ` (${params.referralSource})` : ''
            }`
          : params.referralSource || '—',
      ],
      ['Owner user', params.ownerUserId || '—'],
    ];
    const table = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">${k}</td><td style="padding:4px 0;font-weight:600;color:#0f172a">${escapeHtml(
            v
          )}</td></tr>`
      )
      .join('');

    await sendAlert({
      to,
      subject: `[SupplierAdvisor] New company registered: ${name}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#0077b6;margin-bottom:8px">New company registration</h2>
          <p style="color:#475569;margin-top:0">A business just completed self-serve onboarding on SupplierAdvisor.</p>
          <table style="border-collapse:collapse;font-size:14px;margin:16px 0">${table}</table>
          <p>
            <a href="${href}" style="display:inline-block;background:#00b4d8;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;margin-right:8px">Public profile →</a>
            <a href="${adminHint}" style="color:#0077b6;font-weight:600">Open app</a>
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyNewCompanyRegistered', e);
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Peer requested a network connection. */
export async function notifyConnectionRequest(params: {
  requesteeProfileId: number;
  requesterName?: string | null;
  requesterProfileId?: number | null;
  message?: string | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.requesteeProfileId);
    // Deep-link opens Connections with pending inbox focused
    const href = `${appBase()}/dashboard/connections?focus=incoming`;
    const who = params.requesterName || 'A company';
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] Connection request from ${who}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#0077b6">New connection request</h2>
          <p><strong>${who}</strong> wants to connect on SupplierAdvisor.</p>
          ${
            params.message
              ? `<p style="color:#475569;font-style:italic">“${String(params.message).slice(0, 400)}”</p>`
              : ''
          }
          <p><a href="${href}" style="display:inline-block;background:#00b4d8;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Open pending inbox →</a></p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyConnectionRequest', e);
  }
}

/** Invoice overdue follow-up. */
export async function notifyInvoiceOverdue(params: {
  profileId: number;
  invoiceId: number;
  invoiceNumber?: string | null;
  customerName?: string | null;
  amount?: number | null;
  currency?: string | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.profileId);
    const href = `${appBase()}/dashboard/customers/invoices`;
    const num = params.invoiceNumber || `#${params.invoiceId}`;
    const ccy = (params.currency || 'ZAR').toUpperCase();
    const total =
      params.amount != null
        ? `${ccy} ${Number(params.amount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}`
        : '';
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] Invoice ${num} overdue`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#b45309">Invoice overdue</h2>
          <p>Invoice <strong>${num}</strong>${
            params.customerName ? ` for ${params.customerName}` : ''
          } is overdue${total ? ` (${total})` : ''}.</p>
          <p>Follow up with the customer or resend the invoice from AR.</p>
          <p><a href="${href}" style="color:#00b4d8">Open invoices →</a></p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyInvoiceOverdue', e);
  }
}

/**
 * CIPC verification outcome — company + ops (connect@).
 * Covers verified, mismatch, failed after payment.
 */
export async function notifyCipcVerificationOutcome(params: {
  profileId: number;
  tradingName?: string | null;
  status: 'verified' | 'mismatch' | 'failed' | 'pending' | string;
  companyNameCipc?: string | null;
  nameMatch?: string | null;
  paystackReference?: string | null;
  reusedPayment?: boolean;
  detail?: string | null;
  registrationNumber?: string | null;
  recovered?: boolean;
}): Promise<void> {
  try {
    const status = String(params.status || '').toLowerCase();
    const name =
      params.tradingName || `Company #${params.profileId}`;
    const href = `${appBase()}/dashboard/my-business/profile`;
    const opsRaw =
      process.env.NEW_COMPANY_NOTIFY_EMAIL ||
      process.env.PLATFORM_OPS_EMAIL ||
      'connect@supplieradvisor.com';
    const ops = opsRaw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes('@'));

    const companyTo = await companyEmails(params.profileId);
    const badge =
      status === 'verified'
        ? 'VERIFIED'
        : status === 'mismatch'
          ? 'NAME MISMATCH'
          : status === 'failed'
            ? 'FAILED'
            : status.toUpperCase();

    const color =
      status === 'verified'
        ? '#047857'
        : status === 'mismatch'
          ? '#b45309'
          : '#b91c1c';

    const rows: Array<[string, string]> = [
      ['Company', name],
      ['Profile ID', String(params.profileId)],
      ['Result', badge],
      ['CIPC name', params.companyNameCipc || '—'],
      ['Name match', params.nameMatch || '—'],
      ['Registration', params.registrationNumber || '—'],
      [
        'Payment',
        params.paystackReference
          ? `${params.paystackReference}${
              params.reusedPayment ? ' (reused)' : ''
            }`
          : '—',
      ],
      ['Recovered', params.recovered ? 'yes' : 'no'],
      ['Detail', params.detail || '—'],
    ];
    const table = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td style="padding:4px 0;font-weight:600">${String(
            v
          )
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')}</td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:${color}">CIPC verification: ${badge}</h2>
        <p style="color:#475569">
          ${
            status === 'verified'
              ? 'Company verification badge is active on SupplierAdvisor.'
              : status === 'mismatch'
                ? 'Payment was received, but the CIPC company name may not match the profile. Update trading/legal name, then re-run CIPC (reuse payment).'
                : 'Payment may have been taken for the check, but the verified badge was not set. See details below.'
          }
        </p>
        <table style="border-collapse:collapse;font-size:14px;margin:16px 0">${table}</table>
        <p><a href="${href}" style="display:inline-block;background:#00b4d8;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Open company profile →</a></p>
      </div>
    `;

    const subject =
      status === 'verified'
        ? `[SupplierAdvisor] Verified: ${name}`
        : `[SupplierAdvisor] CIPC ${badge}: ${name} (paid check)`;

    if (companyTo.length) {
      await sendAlert({ to: companyTo, subject, html });
    }
    if (ops.length) {
      await sendAlert({
        to: ops,
        subject: `[Ops] ${subject}`,
        html,
      });
    }
  } catch (e) {
    console.warn('notifyCipcVerificationOutcome', e);
  }
}

/** CIPC / bank / people verification failed. */
export async function notifyVerificationFailed(params: {
  profileId: number;
  kind: 'cipc' | 'bank' | 'identity' | string;
  detail?: string | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.profileId);
    const href = `${appBase()}/dashboard/my-business/profile`;
    const label =
      params.kind === 'bank'
        ? 'Bank AVS'
        : params.kind === 'cipc'
          ? 'CIPC company'
          : params.kind === 'identity'
            ? 'Identity'
            : String(params.kind);
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] ${label} verification failed`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#b91c1c">Verification failed</h2>
          <p>Your <strong>${label}</strong> check did not pass.</p>
          ${
            params.detail
              ? `<p style="color:#64748b;font-size:13px">${String(params.detail).slice(0, 500)}</p>`
              : ''
          }
          <p>Update details on your profile and try again.</p>
          <p><a href="${href}" style="color:#00b4d8">Open profile →</a></p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyVerificationFailed', e);
  }
}

/** VerifyNow credits running low. */
export async function notifyVerifynowLowCredits(params: {
  profileId: number;
  remainingCredits?: number | null;
}): Promise<void> {
  try {
    const to = await companyEmails(params.profileId);
    const rem =
      params.remainingCredits != null
        ? String(params.remainingCredits)
        : 'low';
    await sendAlert({
      to,
      subject: `[SupplierAdvisor] VerifyNow credits ${rem}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#b45309">VerifyNow credits running low</h2>
          <p>Remaining credits: <strong>${rem}</strong>.</p>
          <p>Top up at <a href="https://verifynow.co.za">verifynow.co.za</a> so CIPC and bank AVS keep working.</p>
        </div>
      `,
    });
  } catch (e) {
    console.warn('notifyVerifynowLowCredits', e);
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
