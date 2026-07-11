/**
 * HTML invoice / quote / order document for print-PDF and email.
 * Pulls seller bank details from company profile when present.
 */
import { formatMoney, type DocLineItem } from '@/lib/customers/documents';

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
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  iban?: string | null;
  swift?: string | null;
  branch_code?: string | null;
  account_type?: string | null;
  primary_currency?: string | null;
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
  items: DocLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  seller: SellerProfile;
};

const KIND_LABEL: Record<DocRenderInput['kind'], string> = {
  quote: 'Quotation',
  order: 'Sales order',
  invoice: 'Tax invoice',
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sellerAddress(s: SellerProfile): string {
  return [s.street || s.address, s.city, s.province, s.country]
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
        <strong>Payment details not configured</strong>
        <p>Add bank details under <em>Company → Profile</em> (bank name, account name, account number)
        so customers know how to pay.</p>
      </div>`;
  }
  return `
    <div class="pay-box">
      <strong>Pay by EFT / bank transfer</strong>
      <table class="meta">${filled
        .map(
          ([k, v]) =>
            `<tr><td>${esc(k)}</td><td><code>${esc(v)}</code></td></tr>`
        )
        .join('')}</table>
      <p class="hint">Use invoice number as payment reference.</p>
    </div>`;
}

export function renderCommercialDocumentHtml(doc: DocRenderInput): string {
  const ccy = doc.currency || doc.seller.primary_currency || 'ZAR';
  const title = KIND_LABEL[doc.kind];
  const sellerName =
    doc.seller.trading_name || doc.seller.legal_name || 'Supplier';
  const lines = (doc.items || [])
    .map(
      (l, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(l.name)}${l.sku ? ` <span class="muted">(${esc(l.sku)})</span>` : ''}</td>
        <td class="num">${esc(l.quantity)} ${esc(l.uom || '')}</td>
        <td class="num">${esc(formatMoney(Number(l.unit_price || 0), ccy))}</td>
        <td class="num">${esc(formatMoney(Number(l.line_total || 0), ccy))}</td>
      </tr>`
    )
    .join('');

  const paySection =
    doc.kind === 'invoice'
      ? bankBlock(doc.seller)
      : doc.kind === 'quote'
        ? `<p class="muted">This quotation is not a tax invoice. Banking details appear on the invoice when issued.</p>`
        : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} ${esc(doc.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #fff; }
    h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .brand { color: #0077b6; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; }
    .row { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; margin-bottom: 28px; }
    .muted { color: #64748b; font-size: 12px; }
    table.lines { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    table.lines th { text-align: left; border-bottom: 2px solid #e2e8f0; padding: 8px 6px; font-size: 11px; text-transform: uppercase; color: #64748b; }
    table.lines td { border-bottom: 1px solid #f1f5f9; padding: 10px 6px; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    table.meta { font-size: 13px; }
    table.meta td { padding: 3px 12px 3px 0; }
    table.meta td:first-child { color: #64748b; }
    .totals { margin-left: auto; width: 260px; font-size: 13px; }
    .totals .line { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .grand { font-size: 16px; font-weight: 800; border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 8px; color: #0077b6; }
    .pay-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 14px 16px; margin-top: 24px; }
    .pay-box.warn { background: #fffbeb; border-color: #fde68a; }
    .pay-box .hint { font-size: 11px; color: #0369a1; margin: 8px 0 0; }
    .footer { margin-top: 36px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print {
      body { padding: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="brand">SupplierAdvisor</div>
  <div class="row">
    <div>
      <h1>${esc(title)}</h1>
      <div class="muted"># ${esc(doc.number)} · Status: ${esc(doc.status || '—')}</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">${esc(sellerName)}</div>
      <div class="muted">${esc(sellerAddress(doc.seller))}</div>
      <div class="muted">${esc(doc.seller.email || doc.seller.contact_email || '')}</div>
      <div class="muted">${esc(doc.seller.contact_phone || doc.seller.phone || '')}</div>
      ${doc.seller.vat_number ? `<div class="muted">VAT: ${esc(doc.seller.vat_number)}</div>` : ''}
      ${doc.seller.registration_number ? `<div class="muted">Reg: ${esc(doc.seller.registration_number)}</div>` : ''}
    </div>
  </div>

  <div class="row">
    <div>
      <div class="muted" style="text-transform:uppercase;font-weight:700;font-size:10px;letter-spacing:0.06em">Bill to</div>
      <div style="font-weight:700">${esc(doc.customerName || 'Customer')}</div>
      <div class="muted">${esc(doc.contactName || '')}</div>
      <div class="muted">${esc(doc.contactEmail || '')}</div>
      <div class="muted">${esc(doc.contactPhone || '')}</div>
    </div>
    <div>
      <table class="meta">
        ${doc.issuedAt ? `<tr><td>Date</td><td>${esc(String(doc.issuedAt).slice(0, 10))}</td></tr>` : ''}
        ${doc.dueDate ? `<tr><td>Due</td><td>${esc(String(doc.dueDate).slice(0, 10))}</td></tr>` : ''}
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
        <th class="num">Unit</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${lines || '<tr><td colspan="5" class="muted">No lines</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div class="line"><span>Subtotal</span><span>${esc(formatMoney(doc.subtotal, ccy))}</span></div>
    <div class="line"><span>Tax (${esc(doc.taxRate)}%)</span><span>${esc(formatMoney(doc.taxAmount, ccy))}</span></div>
    <div class="line grand"><span>Total due</span><span>${esc(formatMoney(doc.totalAmount, ccy))}</span></div>
  </div>

  ${paySection}

  ${doc.notes ? `<p style="margin-top:20px;font-size:13px"><strong>Notes</strong><br/>${esc(doc.notes)}</p>` : ''}

  <div class="footer">
    Generated via SupplierAdvisor · ${esc(sellerName)} · Please retain for your records.
  </div>
</body>
</html>`;
}

export function extractBankFromProfile(row: Record<string, unknown>): SellerProfile {
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
      const v = row[k] ?? meta[k] ?? settings[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return null;
  };

  return {
    trading_name: pick('trading_name'),
    legal_name: pick('legal_name'),
    email: pick('email', 'contact_email'),
    contact_email: pick('contact_email', 'email'),
    contact_phone: pick('contact_phone', 'phone'),
    phone: pick('phone', 'contact_phone'),
    vat_number: pick('vat_number', 'vat_no'),
    registration_number: pick('registration_number', 'company_registration'),
    address: pick('address', 'street'),
    street: pick('street', 'address'),
    city: pick('city'),
    province: pick('province', 'state'),
    country: pick('country'),
    bank_name: pick('bank_name', 'bank'),
    account_name: pick('account_name', 'bank_account_name'),
    account_number: pick('account_number', 'bank_account_number'),
    iban: pick('iban'),
    swift: pick('swift', 'bic', 'swift_code'),
    branch_code: pick('branch_code', 'branch', 'sort_code'),
    account_type: pick('account_type'),
    primary_currency: pick('primary_currency') || 'ZAR',
  };
}
