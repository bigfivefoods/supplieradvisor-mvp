/**
 * Beautiful commercial document HTML (invoice / quote / order).
 * Includes payment terms, legal disclaimers, Powered by SupplierAdvisor®,
 * and public feedback links/QR (rate OTIFEF + claim/RIAD).
 */
import { formatMoney, type DocLineItem } from '@/lib/customers/documents';
import { normalizeProfileRow, type CompanyProfile } from '@/lib/business/types';
import {
  buildInvoiceFeedbackToken,
  invoiceFeedbackUrl,
  qrImageUrl,
} from '@/lib/customers/invoice-feedback-token';

export type SellerProfile = {
  trading_name?: string | null;
  legal_name?: string | null;
  email?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  phone?: string | null;
  vat_number?: string | null;
  registration_number?: string | null;
  address?: string | null;
  street?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  postal_code?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  iban?: string | null;
  swift?: string | null;
  branch_code?: string | null;
  account_type?: string | null;
  primary_currency?: string | null;
  logo_url?: string | null;
  is_verified?: boolean;
  verification_status?: string | null;
  payment_terms?: string | null;
  default_payment_terms?: string | null;
};

export type DocRenderInput = {
  kind: 'quote' | 'order' | 'invoice';
  number: string;
  status?: string | null;
  currency?: string | null;
  issuedAt?: string | null;
  dueDate?: string | null;
  validUntil?: string | null;
  customerName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  terms?: string | null;
  paymentTerms?: string | null;
  items: DocLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  seller: SellerProfile;
  /** For feedback QR — required on invoices */
  companyId?: number;
  documentId?: number;
};

const KIND_LABEL: Record<DocRenderInput['kind'], string> = {
  quote: 'Quotation',
  order: 'Sales order',
  invoice: 'Tax invoice',
};

const DEFAULT_PAYMENT_TERMS = `Payment is due by the due date shown on this invoice (or within 30 days of the invoice date if no due date is stated), unless otherwise agreed in writing.

Please pay by electronic funds transfer (EFT) using the banking details below. Use the invoice number as your payment reference so we can allocate your payment correctly.

Goods remain the property of the seller until payment is received in full. Interest may be charged on overdue amounts at the legally permissible rate.`;

const DEFAULT_LEGAL = `This document is issued via SupplierAdvisor®. All amounts are in the currency stated. VAT (where applicable) is charged at the rate shown.

Errors and omissions excepted (E&OE). Prices and availability of goods or services are subject to the parties' commercial agreement, applicable Incoterms (if any), and the laws of the seller's place of business unless otherwise agreed.

By accepting goods or services and/or making payment you acknowledge the commercial terms of this transaction. Nothing in this document limits any non-excludable rights under consumer protection or other mandatory law.`;

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br/>');
}

function sellerAddress(s: SellerProfile): string {
  return [s.street || s.address, s.city, s.province, s.postal_code, s.country]
    .map((x) => (x ? String(x).trim() : ''))
    .filter(Boolean)
    .join(', ');
}

function bankBlock(s: SellerProfile): string {
  const rows: Array<[string, string | null | undefined]> = [
    ['Bank', s.bank_name],
    ['Account name', s.account_name],
    ['Account number', s.account_number],
    ['Branch code', s.branch_code],
    ['Account type', s.account_type],
    ['IBAN', s.iban],
    ['SWIFT / BIC', s.swift],
  ];
  const filled = rows.filter(([, v]) => v && String(v).trim());
  if (!filled.length) {
    return `
      <div class="pay-box warn">
        <div class="pay-title">Payment details</div>
        <p>Bank details are not on file for this seller. Please contact them for payment instructions.</p>
      </div>`;
  }
  return `
    <div class="pay-box">
      <div class="pay-title">Pay by EFT / bank transfer</div>
      <table class="meta">${filled
        .map(
          ([k, v]) =>
            `<tr><td>${esc(k)}</td><td><code>${esc(v)}</code></td></tr>`
        )
        .join('')}</table>
      <p class="hint">Use the invoice number as your payment reference.</p>
    </div>`;
}

export function extractBankFromProfile(row: Record<string, unknown>): SellerProfile {
  const p = normalizeProfileRow(row) as CompanyProfile;
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const settings =
    row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
      ? (row.settings as Record<string, unknown>)
      : {};

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v =
        (p as Record<string, unknown>)[k] ?? row[k] ?? meta[k] ?? settings[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return null;
  };

  const verified =
    p.is_verified === true ||
    String(p.verification_status || '').toLowerCase() === 'verified';

  return {
    trading_name: pick('trading_name'),
    legal_name: pick('legal_name'),
    email: pick('email', 'contact_email'),
    contact_email: pick('contact_email', 'email'),
    contact_phone: pick('contact_phone', 'phone', 'contact_number'),
    phone: pick('phone', 'contact_phone', 'contact_number'),
    vat_number: pick('vat_number', 'vat_no', 'tax_number'),
    registration_number: pick(
      'registration_number',
      'company_registration',
      'cipc_number'
    ),
    address: pick('address', 'street'),
    street: pick('street', 'address'),
    city: pick('city'),
    province: pick('province', 'region', 'state'),
    country: pick('country'),
    postal_code: pick('postal_code', 'zip'),
    bank_name: pick('bank_name', 'bank'),
    account_name: pick('account_name', 'bank_account_name'),
    account_number: pick('account_number', 'bank_account_number'),
    iban: pick('iban'),
    swift: pick('swift', 'bic', 'swift_code'),
    branch_code: pick('branch_code', 'branch', 'sort_code'),
    account_type: pick('account_type'),
    primary_currency: pick('primary_currency') || 'ZAR',
    logo_url: pick('logo_url', 'company_logo', 'logo'),
    is_verified: verified,
    verification_status: p.verification_status || (verified ? 'verified' : null),
    payment_terms: pick('payment_terms', 'default_payment_terms'),
    default_payment_terms: pick('default_payment_terms', 'payment_terms'),
  };
}

export function resolveCustomerContact(
  customer: Record<string, unknown> | null | undefined,
  doc: Record<string, unknown>
): {
  customerName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
} {
  const c = customer || {};
  const pick = (...vals: unknown[]) => {
    for (const v of vals) {
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return null;
  };
  return {
    customerName: pick(
      doc.customer_name,
      c.trading_name,
      c.legal_name,
      c.company_name,
      c.name
    ),
    contactName: pick(doc.contact_name, c.contact_name, c.primary_contact, c.name),
    contactEmail: pick(
      doc.contact_email,
      c.email,
      c.contact_email,
      c.billing_email,
      c.invited_email
    ),
    contactPhone: pick(
      doc.contact_phone,
      c.phone,
      c.contact_phone,
      c.contact_number,
      c.mobile
    ),
  };
}

export function renderCommercialDocumentHtml(doc: DocRenderInput): string {
  const ccy = doc.currency || doc.seller.primary_currency || 'ZAR';
  const title = KIND_LABEL[doc.kind];
  const sellerName =
    doc.seller.trading_name || doc.seller.legal_name || 'Supplier';
  const logo = doc.seller.logo_url
    ? `<img class="logo" src="${esc(doc.seller.logo_url)}" alt="${esc(sellerName)}" />`
    : '';
  const verifiedBadge = doc.seller.is_verified
    ? `<span class="verified">✓ Verified on SupplierAdvisor</span>`
    : '';

  const paymentTermsText =
    doc.paymentTerms ||
    doc.seller.payment_terms ||
    doc.seller.default_payment_terms ||
    DEFAULT_PAYMENT_TERMS;

  const commercialTerms =
    doc.terms ||
    (doc.kind === 'quote'
      ? 'Prices valid until the date shown (if any). Subject to stock availability and final order confirmation.'
      : null);

  const lines = (doc.items || [])
    .map(
      (l, i) => `
      <tr>
        <td class="idx">${i + 1}</td>
        <td><div class="item-name">${esc(l.name)}</div>${
          l.sku ? `<div class="muted sku">${esc(l.sku)}</div>` : ''
        }</td>
        <td class="num">${esc(l.quantity)} <span class="uom">${esc(l.uom || '')}</span></td>
        <td class="num">${esc(formatMoney(Number(l.unit_price || 0), ccy))}</td>
        <td class="num strong">${esc(formatMoney(Number(l.line_total || 0), ccy))}</td>
      </tr>`
    )
    .join('');

  // Public feedback links + QR (invoices primarily)
  let feedbackBlock = '';
  if (
    doc.kind === 'invoice' &&
    doc.companyId &&
    doc.documentId &&
    Number.isFinite(doc.companyId) &&
    Number.isFinite(doc.documentId)
  ) {
    const token = buildInvoiceFeedbackToken({
      companyId: doc.companyId,
      invoiceId: doc.documentId,
      invoiceNumber: doc.number,
    });
    const feedbackUrl = invoiceFeedbackUrl(token);
    const rateUrl = `${feedbackUrl}?tab=rate`;
    const claimUrl = `${feedbackUrl}?tab=claim`;
    const qrRate = qrImageUrl(rateUrl, 128);
    const qrClaim = qrImageUrl(claimUrl, 128);
    feedbackBlock = `
    <div class="feedback">
      <div class="feedback-head">
        <div class="feedback-kicker">After delivery</div>
        <h2>Rate us · log an issue</h2>
        <p>Your OTIFEF score and claims help keep the SupplierAdvisor® network honest. Scan a QR or open a link — no app install required.</p>
      </div>
      <div class="feedback-grid">
        <a class="feedback-card" href="${esc(rateUrl)}">
          <img src="${esc(qrRate)}" alt="Rate QR" width="112" height="112" />
          <div>
            <div class="fc-title">Rate performance (OTIFEF)</div>
            <div class="fc-body">Score on-time, in-full, quality &amp; communication for this invoice.</div>
            <div class="fc-link">Open rating form →</div>
          </div>
        </a>
        <a class="feedback-card" href="${esc(claimUrl)}">
          <img src="${esc(qrClaim)}" alt="Claim QR" width="112" height="112" />
          <div>
            <div class="fc-title">Log a claim / RIAD</div>
            <div class="fc-body">Raise a risk, issue, action or decision linked to this invoice.</div>
            <div class="fc-link">Open claim form →</div>
          </div>
        </a>
      </div>
    </div>`;
  }

  const paySection = doc.kind === 'invoice' ? bankBlock(doc.seller) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} ${esc(doc.number)} · ${esc(sellerName)}</title>
  <style>
    :root {
      --brand: #00b4d8;
      --brand-deep: #0077b6;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --soft: #f8fafc;
      --ok: #047857;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
      color: var(--ink);
      margin: 0;
      padding: 0;
      background: #eef2f7;
    }
    .sheet {
      max-width: 820px;
      margin: 24px auto;
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
      border: 1px solid #e8eef5;
    }
    .topbar {
      height: 6px;
      background: linear-gradient(90deg, var(--brand), var(--brand-deep), #48cae4);
    }
    .pad { padding: 36px 40px 28px; }
    .hero {
      display: flex;
      justify-content: space-between;
      gap: 28px;
      flex-wrap: wrap;
      align-items: flex-start;
      margin-bottom: 28px;
    }
    .logo { max-height: 64px; max-width: 200px; object-fit: contain; display: block; margin-bottom: 12px; }
    .doc-type {
      font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--brand-deep); margin-bottom: 6px;
    }
    h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -0.03em; line-height: 1.15; }
    .verified {
      display: inline-block; font-size: 10px; font-weight: 700; color: var(--ok);
      background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 999px;
      padding: 3px 10px; margin-left: 8px; vertical-align: middle;
    }
    .muted { color: var(--muted); font-size: 12.5px; line-height: 1.45; }
    .seller-block { text-align: right; min-width: 200px; }
    .seller-block .name { font-weight: 800; font-size: 15px; margin-bottom: 4px; }
    .parties {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    @media (max-width: 640px) {
      .parties { grid-template-columns: 1fr; }
      .pad { padding: 24px 18px; }
      .seller-block { text-align: left; }
    }
    .card {
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px 18px;
    }
    .card-label {
      font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--muted); margin-bottom: 8px;
    }
    .card .who { font-weight: 800; font-size: 15px; margin-bottom: 2px; }
    table.meta { width: 100%; font-size: 13px; border-collapse: collapse; }
    table.meta td { padding: 4px 0; vertical-align: top; }
    table.meta td:first-child { color: var(--muted); width: 42%; }
    table.lines { width: 100%; border-collapse: collapse; margin: 8px 0 20px; font-size: 13px; }
    table.lines th {
      text-align: left; border-bottom: 2px solid var(--ink); padding: 10px 8px;
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);
    }
    table.lines td { border-bottom: 1px solid var(--line); padding: 12px 8px; vertical-align: top; }
    table.lines tr:last-child td { border-bottom: none; }
    .idx { color: var(--muted); width: 28px; }
    .item-name { font-weight: 600; }
    .sku, .uom { font-size: 11px; color: var(--muted); }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .strong { font-weight: 700; }
    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 8px; }
    .totals {
      width: 280px; background: linear-gradient(160deg, #f0f9ff, #fff);
      border: 1px solid #bae6fd; border-radius: 16px; padding: 14px 16px; font-size: 13px;
    }
    .totals .line { display: flex; justify-content: space-between; padding: 5px 0; color: #334155; }
    .totals .grand {
      display: flex; justify-content: space-between; font-size: 17px; font-weight: 900;
      border-top: 2px solid var(--brand-deep); margin-top: 8px; padding-top: 10px; color: var(--brand-deep);
    }
    .pay-box {
      background: linear-gradient(145deg, #ecfeff, #f0f9ff);
      border: 1px solid #7dd3fc; border-radius: 16px; padding: 16px 18px; margin: 20px 0;
    }
    .pay-box.warn { background: #fffbeb; border-color: #fcd34d; }
    .pay-title { font-weight: 800; font-size: 13px; color: var(--brand-deep); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
    .pay-box .hint { font-size: 11px; color: #0369a1; margin: 10px 0 0; }
    .section {
      margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line);
    }
    .section h3 {
      margin: 0 0 8px; font-size: 12px; font-weight: 800; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--brand-deep);
    }
    .section p, .section .body { font-size: 12.5px; line-height: 1.55; color: #334155; margin: 0; }
    .feedback {
      margin-top: 28px;
      background: linear-gradient(145deg, #0c4a6e 0%, #0077b6 55%, #00b4d8 100%);
      color: #fff; border-radius: 18px; padding: 22px 20px;
    }
    .feedback-kicker { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.85; }
    .feedback h2 { margin: 6px 0 8px; font-size: 18px; letter-spacing: -0.02em; }
    .feedback > .feedback-head p { margin: 0 0 16px; font-size: 13px; line-height: 1.5; opacity: 0.92; }
    .feedback-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 640px) { .feedback-grid { grid-template-columns: 1fr; } }
    a.feedback-card {
      display: flex; gap: 12px; align-items: center; text-decoration: none; color: inherit;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25);
      border-radius: 14px; padding: 12px; backdrop-filter: blur(6px);
    }
    a.feedback-card img {
      width: 96px; height: 96px; border-radius: 10px; background: #fff; padding: 6px; flex-shrink: 0;
    }
    .fc-title { font-weight: 800; font-size: 13px; margin-bottom: 4px; }
    .fc-body { font-size: 11.5px; line-height: 1.4; opacity: 0.9; }
    .fc-link { font-size: 11px; font-weight: 700; margin-top: 6px; color: #e0f2fe; }
    .powered {
      margin-top: 28px; padding: 18px 40px 22px; background: #0f172a; color: #94a3b8;
      text-align: center; font-size: 11px; line-height: 1.5;
    }
    .powered strong { color: #fff; font-weight: 800; letter-spacing: -0.01em; }
    .powered .reg { color: var(--brand); font-weight: 800; }
    .powered a { color: #7dd3fc; text-decoration: none; }
    @media print {
      body { background: #fff; }
      .sheet { margin: 0; box-shadow: none; border: none; border-radius: 0; max-width: none; }
      .powered { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .feedback { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topbar"></div>
    <div class="pad">
      <div class="hero">
        <div>
          ${logo}
          <div class="doc-type">${esc(title)}</div>
          <h1>${esc(doc.number)}${verifiedBadge}</h1>
          <div class="muted">Status: ${esc(doc.status || '—')}</div>
        </div>
        <div class="seller-block">
          <div class="name">${esc(sellerName)}</div>
          ${
            doc.seller.legal_name && doc.seller.legal_name !== sellerName
              ? `<div class="muted">${esc(doc.seller.legal_name)}</div>`
              : ''
          }
          <div class="muted">${esc(sellerAddress(doc.seller))}</div>
          <div class="muted">${esc(doc.seller.email || doc.seller.contact_email || '')}</div>
          <div class="muted">${esc(doc.seller.contact_phone || doc.seller.phone || '')}</div>
          ${doc.seller.vat_number ? `<div class="muted"><strong>VAT</strong> ${esc(doc.seller.vat_number)}</div>` : ''}
          ${doc.seller.registration_number ? `<div class="muted"><strong>Reg</strong> ${esc(doc.seller.registration_number)}</div>` : ''}
        </div>
      </div>

      <div class="parties">
        <div class="card">
          <div class="card-label">Bill to</div>
          <div class="who">${esc(doc.customerName || 'Customer')}</div>
          <div class="muted">${esc(doc.contactName || '')}</div>
          <div class="muted">${esc(doc.contactEmail || '')}</div>
          <div class="muted">${esc(doc.contactPhone || '')}</div>
        </div>
        <div class="card">
          <div class="card-label">Document</div>
          <table class="meta">
            ${doc.issuedAt ? `<tr><td>Date</td><td>${esc(String(doc.issuedAt).slice(0, 10))}</td></tr>` : ''}
            ${doc.dueDate ? `<tr><td>Due date</td><td><strong>${esc(String(doc.dueDate).slice(0, 10))}</strong></td></tr>` : ''}
            ${doc.validUntil ? `<tr><td>Valid until</td><td>${esc(String(doc.validUntil).slice(0, 10))}</td></tr>` : ''}
            <tr><td>Currency</td><td>${esc(ccy)}</td></tr>
          </table>
        </div>
      </div>

      <table class="lines">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th class="num">Qty</th>
            <th class="num">Unit price</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>${lines || '<tr><td colspan="5" class="muted">No lines</td></tr>'}</tbody>
      </table>

      <div class="totals-wrap">
        <div class="totals">
          <div class="line"><span>Subtotal</span><span>${esc(formatMoney(doc.subtotal, ccy))}</span></div>
          <div class="line"><span>Tax (${esc(doc.taxRate)}%)</span><span>${esc(formatMoney(doc.taxAmount, ccy))}</span></div>
          <div class="grand"><span>Total due</span><span>${esc(formatMoney(doc.totalAmount, ccy))}</span></div>
        </div>
      </div>

      ${paySection}

      ${
        doc.kind === 'invoice'
          ? `<div class="section">
        <h3>Payment terms</h3>
        <div class="body">${nl2br(paymentTermsText)}</div>
      </div>`
          : commercialTerms
            ? `<div class="section"><h3>Terms</h3><div class="body">${nl2br(commercialTerms)}</div></div>`
            : ''
      }

      <div class="section">
        <h3>Legal &amp; disclaimers</h3>
        <div class="body">${nl2br(DEFAULT_LEGAL)}</div>
      </div>

      ${doc.notes ? `<div class="section"><h3>Notes</h3><div class="body">${nl2br(String(doc.notes))}</div></div>` : ''}

      ${feedbackBlock}
    </div>

    <div class="powered">
      <div><strong>Powered by <span class="reg">SupplierAdvisor®</span></strong></div>
      <div>Trade network · OTIFEF performance · quality &amp; claims</div>
      <div style="margin-top:6px"><a href="https://www.supplieradvisor.com">www.supplieradvisor.com</a></div>
    </div>
  </div>
</body>
</html>`;
}
