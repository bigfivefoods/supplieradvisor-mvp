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
  /** Optional deep link (portal or print page) */
  link?: string | null;
}): string {
  const label = DOC_LABEL[params.kind] || 'Document';
  const first =
    (params.contactName || params.customerName || '')
      .trim()
      .split(/\s+/)[0] || 'there';
  const seller = (params.sellerName || '').trim() || 'us';
  const lines: string[] = [
    `Hi ${first}! 👋`,
    ``,
    `Please find *${label} ${params.number}* from *${seller}*.`,
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

  if (params.link?.trim()) {
    lines.push(``, `📄 Download PDF ${label.toLowerCase()}:`, params.link.trim());
  } else {
    lines.push(
      ``,
      `Reply on WhatsApp if you have questions — we can resend the formal PDF anytime.`
    );
  }

  if (params.kind === 'invoice') {
    lines.push(``, `Thank you — payment details are on the invoice PDF.`);
  } else if (params.kind === 'quote') {
    lines.push(
      ``,
      `Open the PDF for the full formal quotation. Happy to adjust quantities or lead times — just reply here.`
    );
  } else {
    lines.push(``, `We'll keep you updated on fulfilment.`);
  }

  return lines.join('\n');
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
