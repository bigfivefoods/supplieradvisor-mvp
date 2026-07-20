/**
 * Client-safe WhatsApp share helpers (wa.me deep links).
 * No Twilio required — opens WhatsApp with pre-filled invite text.
 */

/** Digits-only E.164 (no +) for https://wa.me/<digits>?text=… */
export function toWhatsAppE164Digits(
  phone: string | null | undefined,
  defaultCountry = '27'
): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  // SA local: 082… → 2782…
  if (d.startsWith('0') && d.length === 10) {
    d = `${defaultCountry}${d.slice(1)}`;
  }
  // 9-digit mobile without leading 0 (82… / 71…)
  if (d.length === 9 && /^[6-8]/.test(d)) {
    d = `${defaultCountry}${d}`;
  }
  // Already country-coded (e.g. 27…)
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  const d = toWhatsAppE164Digits(phone);
  if (!d) return String(phone || '').trim();
  if (d.startsWith('27') && d.length === 11) {
    return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  return `+${d}`;
}

export function buildWhatsAppShareUrl(opts: {
  phone?: string | null;
  text: string;
}): string {
  const digits = toWhatsAppE164Digits(opts.phone);
  const q = encodeURIComponent(opts.text);
  if (digits) return `https://wa.me/${digits}?text=${q}`;
  // No number → WhatsApp contact picker / share sheet
  return `https://wa.me/?text=${q}`;
}

export function resellerInviteWhatsAppText(params: {
  resellerName?: string | null;
  companyName?: string | null;
  inviteLink: string;
}): string {
  const first =
    (params.resellerName || '').trim().split(/\s+/)[0] || 'there';
  const company =
    (params.companyName || '').trim() || 'your network operator';
  return [
    `Hi ${first}! 👋`,
    ``,
    `You've been invited as a *container network reseller* for *${company}* on SupplierAdvisor.`,
    ``,
    `Tap the link to confirm and open your portal:`,
    params.inviteLink,
    ``,
    `In the portal you can see stock, record sales, earn commission, log customer feedback, and report field issues (RIAD).`,
  ].join('\n');
}

/** Format amount for WhatsApp plain text (no HTML). */
export function formatWhatsAppMoney(
  amount: number | null | undefined,
  currency = 'ZAR'
): string {
  const n = Number(amount || 0);
  const cur = (currency || 'ZAR').toUpperCase();
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${cur} ${n.toFixed(2)}`;
  }
}

export type CommercialDocShareKind = 'quote' | 'order' | 'invoice';

const DOC_LABEL: Record<CommercialDocShareKind, string> = {
  quote: 'Quote',
  order: 'Sales order',
  invoice: 'Invoice',
};

/**
 * Pre-filled WhatsApp body for sharing a quote / sales order / invoice
 * with a customer (or internal contact).
 */
export function commercialDocWhatsAppText(params: {
  kind: CommercialDocShareKind;
  number: string;
  customerName?: string | null;
  contactName?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  dueDate?: string | null;
  validUntil?: string | null;
  promisedDate?: string | null;
  sellerName?: string | null;
  notes?: string | null;
  lineSummary?: string[] | null;
  /** Public PDF URL (opens formal PDF document) */
  link?: string | null;
  /**
   * When true, message assumes the PDF is already attached as a WhatsApp
   * document (Twilio MediaUrl or native file share) — no "download" wording.
   */
  pdfAttached?: boolean;
  /** SupplierAdvisor marketing / trust link */
  siteLink?: string | null;
}): string {
  const label = DOC_LABEL[params.kind] || 'Document';
  const first =
    (params.contactName || params.customerName || '')
      .trim()
      .split(/\s+/)[0] || 'there';
  const seller = (params.sellerName || '').trim() || 'us';
  const site =
    (params.siteLink || '').trim() || 'https://www.supplieradvisor.com';
  const lines: string[] = [
    `Hi ${first}! 👋`,
    ``,
    params.pdfAttached
      ? `Please find *${label} ${params.number}* from *${seller}* — the formal *PDF is attached* to this chat.`
      : `Please find *${label} ${params.number}* from *${seller}*.`,
  ];

  if (params.customerName?.trim()) {
    lines.push(`Customer: ${params.customerName.trim()}`);
  }
  if (params.amount != null && Number.isFinite(Number(params.amount))) {
    lines.push(
      `Amount: *${formatWhatsAppMoney(params.amount, params.currency || 'ZAR')}*`
    );
  }
  if (params.status?.trim()) {
    lines.push(`Status: ${params.status.trim()}`);
  }
  if (params.kind === 'quote' && params.validUntil) {
    lines.push(`Valid until: ${String(params.validUntil).slice(0, 10)}`);
  }
  if (params.kind === 'order' && params.promisedDate) {
    lines.push(`Promised: ${String(params.promisedDate).slice(0, 10)}`);
  }
  if (params.kind === 'invoice' && params.dueDate) {
    lines.push(`Due: ${String(params.dueDate).slice(0, 10)}`);
  }

  const summary = (params.lineSummary || []).filter(Boolean).slice(0, 8);
  if (summary.length) {
    lines.push(``, `Lines:`);
    for (const row of summary) lines.push(`• ${row}`);
  }

  if (params.notes?.trim()) {
    lines.push(``, `Note: ${params.notes.trim().slice(0, 280)}`);
  }

  if (params.pdfAttached) {
    lines.push(
      ``,
      `Tap the PDF above to open the full formal ${label.toLowerCase()}.`
    );
  } else if (params.link?.trim()) {
    // Link still points to the live PDF document (inline Content-Type: application/pdf)
    lines.push(
      ``,
      `📄 Open formal PDF ${label.toLowerCase()} (document):`,
      params.link.trim()
    );
  } else {
    lines.push(
      ``,
      `Reply here if you need the formal PDF resent as a document.`
    );
  }

  if (params.kind === 'invoice') {
    lines.push(``, `Thank you — payment details are on the invoice PDF.`);
  } else if (params.kind === 'quote') {
    lines.push(
      ``,
      `Happy to adjust quantities or lead times — just reply here.`
    );
  } else {
    lines.push(``, `We'll keep you updated on fulfilment.`);
  }

  lines.push(
    ``,
    `—`,
    `Sent via *SupplierAdvisor®*`,
    site,
    `Verified trade network · quotes, POs, invoices & trust`
  );

  return lines.join('\n');
}

/**
 * Share a PDF File via the Web Share API (mobile Chrome/Safari).
 * Opens the system sheet so the user can pick WhatsApp — attaches the real PDF.
 */
export async function sharePdfFileViaNavigator(opts: {
  blob: Blob;
  filename: string;
  title: string;
  text: string;
}): Promise<{ ok: boolean; method: 'files' | 'text' | 'none'; error?: string }> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ok: false, method: 'none', error: 'Not in browser' };
  }
  try {
    const file = new File([opts.blob], opts.filename, {
      type: 'application/pdf',
    });
    const payload: ShareData = {
      files: [file],
      title: opts.title,
      text: opts.text,
    };
    if (
      typeof navigator.canShare === 'function' &&
      navigator.canShare(payload) &&
      typeof navigator.share === 'function'
    ) {
      await navigator.share(payload);
      return { ok: true, method: 'files' };
    }
    // Some browsers only allow text
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: opts.title, text: opts.text });
      return { ok: true, method: 'text' };
    }
    return { ok: false, method: 'none', error: 'Web Share not supported' };
  } catch (e: unknown) {
    // User cancelled share sheet
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, method: 'none', error: 'cancelled' };
    }
    return {
      ok: false,
      method: 'none',
      error: e instanceof Error ? e.message : 'share failed',
    };
  }
}

/**
 * Pre-filled WhatsApp body for sharing a purchase order with a supplier.
 */
export function purchaseOrderWhatsAppText(params: {
  poId: number | string;
  poNumber?: string | null;
  supplierName?: string | null;
  contactName?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  promisedDate?: string | null;
  buyerName?: string | null;
  description?: string | null;
  lineSummary?: string[] | null;
  link?: string | null;
}): string {
  const num =
    (params.poNumber || '').trim() || `PO #${params.poId}`;
  const first =
    (params.contactName || params.supplierName || '')
      .trim()
      .split(/\s+/)[0] || 'there';
  const buyer = (params.buyerName || '').trim() || 'your customer';
  const lines: string[] = [
    `Hi ${first}! 👋`,
    ``,
    `Please find *${num}* from *${buyer}*.`,
  ];

  if (params.supplierName?.trim()) {
    lines.push(`Supplier: ${params.supplierName.trim()}`);
  }
  if (params.amount != null && Number.isFinite(Number(params.amount))) {
    lines.push(
      `Amount: *${formatWhatsAppMoney(params.amount, params.currency || 'ZAR')}*`
    );
  }
  if (params.status?.trim()) {
    lines.push(`Status: ${params.status.trim()}`);
  }
  if (params.promisedDate) {
    lines.push(`Promised delivery: ${String(params.promisedDate).slice(0, 10)}`);
  }

  const summary = (params.lineSummary || []).filter(Boolean).slice(0, 10);
  if (summary.length) {
    lines.push(``, `Lines:`);
    for (const row of summary) lines.push(`• ${row}`);
  }

  if (params.description?.trim()) {
    lines.push(``, `Note: ${params.description.trim().slice(0, 280)}`);
  }

  if (params.link?.trim()) {
    lines.push(``, `Details:`, params.link.trim());
  } else {
    lines.push(
      ``,
      `Please confirm receipt and expected ship date. Reply here or via your SupplierAdvisor portal.`
    );
  }

  return lines.join('\n');
}

/** Open WhatsApp (app or web) with optional phone + prefilled text. */
export function openWhatsAppShare(opts: {
  phone?: string | null;
  text: string;
}): void {
  if (typeof window === 'undefined') return;
  window.open(
    buildWhatsAppShareUrl(opts),
    '_blank',
    'noopener,noreferrer'
  );
}

/**
 * Bank details for EFT after a quote/invoice (or while connection is pending).
 * Use from Connections "Sent" decision desk or invoice follow-up.
 */
export function bankDetailsWhatsAppText(params: {
  sellerName?: string | null;
  contactName?: string | null;
  peerName?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  branchCode?: string | null;
  accountType?: string | null;
  referenceHint?: string | null;
  invoiceNumber?: string | null;
  amount?: number | null;
  currency?: string | null;
  siteLink?: string | null;
}): string {
  const first =
    (params.contactName || params.peerName || '')
      .trim()
      .split(/\s+/)[0] || 'there';
  const seller = (params.sellerName || '').trim() || 'us';
  const site =
    (params.siteLink || '').trim() || 'https://www.supplieradvisor.com';
  const lines: string[] = [
    `Hi ${first}! 👋`,
    ``,
    `Banking details from *${seller}* for EFT payment:`,
  ];
  if (params.bankName?.trim()) lines.push(`Bank: *${params.bankName.trim()}*`);
  if (params.accountName?.trim())
    lines.push(`Account name: ${params.accountName.trim()}`);
  if (params.accountNumber?.trim())
    lines.push(`Account number: *${params.accountNumber.trim()}*`);
  if (params.branchCode?.trim())
    lines.push(`Branch: ${params.branchCode.trim()}`);
  if (params.accountType?.trim())
    lines.push(`Type: ${params.accountType.trim()}`);
  if (params.amount != null && Number.isFinite(Number(params.amount))) {
    lines.push(
      `Amount: *${formatWhatsAppMoney(params.amount, params.currency || 'ZAR')}*`
    );
  }
  const ref =
    params.invoiceNumber?.trim() ||
    params.referenceHint?.trim() ||
    null;
  if (ref) {
    lines.push(``, `Please use reference: *${ref}*`);
  } else {
    lines.push(``, `Please use your company name as payment reference.`);
  }
  lines.push(
    ``,
    `After payment, claim POP on SupplierAdvisor so we can confirm to the ledger.`,
    ``,
    `—`,
    `Sent via *SupplierAdvisor®*`,
    site
  );
  return lines.join('\n');
}

/** Short nudge after claim is confirmed (seller → buyer optional). */
export function claimConfirmedWhatsAppText(params: {
  contactName?: string | null;
  invoiceNumber?: string | null;
  amount?: number | null;
  currency?: string | null;
  sellerName?: string | null;
}): string {
  const first =
    (params.contactName || '').trim().split(/\s+/)[0] || 'there';
  const inv = params.invoiceNumber || 'your invoice';
  const seller = (params.sellerName || '').trim() || 'your supplier';
  const amt =
    params.amount != null
      ? formatWhatsAppMoney(params.amount, params.currency || 'ZAR')
      : null;
  return [
    `Hi ${first}!`,
    ``,
    `We've confirmed payment${amt ? ` of *${amt}*` : ''} on *${inv}* for *${seller}*.`,
    `Thank you — it is posted to our ledger.`,
    ``,
    `— SupplierAdvisor®`,
  ].join('\n');
}
