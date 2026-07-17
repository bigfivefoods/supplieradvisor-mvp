/**
 * Beautiful commercial document HTML (invoice / quote / order).
 * Includes payment terms, legal disclaimers, Powered by SupplierAdvisor®,
 * and public feedback links/QR (rate OTIFEF + claim/RIAD).
 */
import { formatMoney, type DocLineItem } from '@/lib/customers/documents';
import { normalizeProfileRow, type CompanyProfile } from '@/lib/business/types';
import {
  absoluteLogoUrl,
  invoiceRateClaimUrls,
  qrPngUrl,
  rateSellerPublicUrl,
  registerBusinessUrl,
} from '@/lib/customers/commercial-doc-links';

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
  bank_verification_status?: string | null;
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
        <p>Bank details are not on file for this seller. Please contact them for payment instructions or complete Banking on the company profile.</p>
      </div>`;
  }
  const bankVerified =
    String(s.bank_verification_status || '').toLowerCase() === 'verified';
  const cipcLine = s.is_verified
    ? `<p class="hint trust">✓ Seller CIPC-verified on SupplierAdvisor${
        s.registration_number
          ? ` · Reg ${esc(String(s.registration_number))}`
          : ''
      }</p>`
    : '';
  const bankLine = bankVerified
    ? `<p class="hint trust">✓ Bank account verified via VerifyNow AVS</p>`
    : '';
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
      ${cipcLine}
      ${bankLine}
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

  const bankingMeta =
    meta.banking && typeof meta.banking === 'object' && !Array.isArray(meta.banking)
      ? (meta.banking as Record<string, unknown>)
      : {};
  const pickBank = (...keys: string[]) => {
    for (const k of keys) {
      const v =
        (p as Record<string, unknown>)[k] ??
        row[k] ??
        bankingMeta[k] ??
        meta[k] ??
        settings[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return null;
  };

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
    bank_name: pickBank('bank_name', 'bank'),
    account_name: pickBank('account_name', 'bank_account_name'),
    account_number: pickBank('account_number', 'bank_account_number'),
    iban: pickBank('iban'),
    swift: pickBank('swift', 'bic', 'swift_code'),
    branch_code: pickBank('branch_code', 'branch', 'sort_code'),
    account_type: pickBank('account_type'),
    primary_currency: pick('primary_currency') || 'ZAR',
    logo_url: pick('logo_url', 'company_logo', 'logo'),
    is_verified: verified,
    verification_status: p.verification_status || (verified ? 'verified' : null),
    bank_verification_status:
      pick('bank_verification_status') ||
      (meta.bank_verification &&
      typeof meta.bank_verification === 'object'
        ? String(
            (meta.bank_verification as { status?: string }).status || ''
          ) || null
        : null),
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
  const logoSrc = absoluteLogoUrl(doc.seller.logo_url);
  const logo = logoSrc
    ? `<img class="logo" src="${esc(logoSrc)}" alt="${esc(sellerName)} logo" />`
    : `<div class="logo-fallback">${esc(sellerName.slice(0, 1).toUpperCase())}</div>`;
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

  // Network CTA + QR (quotes: register + rate seller; invoices: rate + claim)
  let feedbackBlock = '';
  const companyIdNum = Number(doc.companyId);
  const documentIdNum = Number(doc.documentId);
  if (Number.isFinite(companyIdNum) && companyIdNum > 0) {
    if (doc.kind === 'quote' || doc.kind === 'order') {
      const registerUrl = registerBusinessUrl({
        referrerProfileId: companyIdNum,
      });
      const rateUrl = rateSellerPublicUrl(companyIdNum);
      const qrRegister = qrPngUrl(registerUrl, 96);
      const qrRate = qrPngUrl(rateUrl, 96);
      const who = esc(sellerName);
      feedbackBlock = `
    <div class="feedback">
      <div class="feedback-head">
        <div class="feedback-kicker">SupplierAdvisor network</div>
        <h2>Join free · rate ${who}</h2>
        <p>Scan a QR — register your business on SupplierAdvisor, or open our public profile to rate and connect.</p>
      </div>
      <div class="feedback-grid">
        <a class="feedback-card" href="${esc(registerUrl)}">
          <img src="${esc(qrRegister)}" alt="Register QR" width="64" height="64" />
          <div>
            <div class="fc-title">Register your business</div>
            <div class="fc-body">Free company profile on supplieradvisor.com — trade with verified partners.</div>
            <div class="fc-link">Open registration →</div>
          </div>
        </a>
        <a class="feedback-card" href="${esc(rateUrl)}">
          <img src="${esc(qrRate)}" alt="Rate QR" width="64" height="64" />
          <div>
            <div class="fc-title">Rate ${who}</div>
            <div class="fc-body">View trust, connect, and leave feedback on this supplier.</div>
            <div class="fc-link">Open public profile →</div>
          </div>
        </a>
      </div>
    </div>`;
    } else if (
      doc.kind === 'invoice' &&
      Number.isFinite(documentIdNum) &&
      documentIdNum > 0
    ) {
      const urls = invoiceRateClaimUrls({
        companyId: companyIdNum,
        documentId: documentIdNum,
        number: doc.number,
      });
      if (urls) {
        const qrRate = qrPngUrl(urls.rateUrl, 96);
        const qrClaim = qrPngUrl(urls.claimUrl, 96);
        feedbackBlock = `
    <div class="feedback">
      <div class="feedback-head">
        <div class="feedback-kicker">After delivery</div>
        <h2>Rate us · log an issue</h2>
        <p>Scan a QR or open a link — OTIFEF score &amp; claims keep the network honest.</p>
      </div>
      <div class="feedback-grid">
        <a class="feedback-card" href="${esc(urls.rateUrl)}">
          <img src="${esc(qrRate)}" alt="Rate QR" width="64" height="64" />
          <div>
            <div class="fc-title">Rate performance (OTIFEF)</div>
            <div class="fc-body">On-time, in-full, quality &amp; communication.</div>
            <div class="fc-link">Open rating form →</div>
          </div>
        </a>
        <a class="feedback-card" href="${esc(urls.claimUrl)}">
          <img src="${esc(qrClaim)}" alt="Claim QR" width="64" height="64" />
          <div>
            <div class="fc-title">Log a claim / RIAD</div>
            <div class="fc-body">Risk, issue, action or decision on this invoice.</div>
            <div class="fc-link">Open claim form →</div>
          </div>
        </a>
      </div>
    </div>`;
      }
    }
  }

  const paySection = doc.kind === 'invoice' ? bankBlock(doc.seller) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} ${esc(doc.number)} · ${esc(sellerName)}</title>
  <style>
    /* Standard ISO A4 — screen preview matches printable page */
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    :root {
      --brand: #00b4d8;
      --brand-deep: #0077b6;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --soft: #f8fafc;
      --ok: #047857;
      --a4-w: 210mm;
      --a4-h: 297mm;
    }
    * { box-sizing: border-box; }
    html { background: #eef2f7; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
      color: var(--ink);
      margin: 0;
      padding: 16px 12px 32px;
      background: #eef2f7;
      -webkit-font-smoothing: antialiased;
    }
    /* Physical A4 sheet on screen (WYSIWYG before print) */
    .sheet {
      width: var(--a4-w);
      min-height: var(--a4-h);
      max-width: 100%;
      margin: 0 auto;
      background: #fff;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
      border: 1px solid #e8eef5;
      display: flex;
      flex-direction: column;
    }
    .sheet-body {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
    }
    .topbar {
      height: 5px;
      flex-shrink: 0;
      background: linear-gradient(90deg, var(--brand), var(--brand-deep), #48cae4);
    }
    .pad {
      padding: 14mm 14mm 8mm;
      flex: 1 1 auto;
    }
    .hero {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .logo {
      max-height: 56px;
      max-width: 180px;
      object-fit: contain;
      display: block;
      margin-bottom: 10px;
      border-radius: 6px;
    }
    .logo-fallback {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(145deg, #00b4d8, #0077b6);
      color: #fff;
      font-weight: 900;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
      letter-spacing: -0.02em;
    }
    .doc-type {
      font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--brand-deep); margin-bottom: 4px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 4px;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }
    /* Quotation emphasis */
    body.kind-quote .doc-type { color: #0e7490; }
    body.kind-quote .topbar {
      background: linear-gradient(90deg, #0e7490, #00b4d8, #67e8f9);
    }
    body.kind-quote .totals {
      background: linear-gradient(160deg, #ecfeff, #fff);
      border-color: #67e8f9;
    }
    .quote-banner {
      background: linear-gradient(90deg, #e0f7fc, #f0f9ff);
      border: 1px solid #bae6fd;
      border-radius: 10px;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 11px;
      color: #0e7490;
      font-weight: 600;
    }
    .verified {
      display: inline-block; font-size: 9px; font-weight: 700; color: var(--ok);
      background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 999px;
      padding: 2px 8px; margin-left: 6px; vertical-align: middle;
    }
    .muted { color: var(--muted); font-size: 11px; line-height: 1.4; }
    .seller-block { text-align: right; min-width: 180px; max-width: 48%; }
    .seller-block .name { font-weight: 800; font-size: 13px; margin-bottom: 2px; }
    .parties {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    @media (max-width: 640px) {
      body { padding: 8px; }
      .sheet { width: 100%; min-height: 0; }
      .parties { grid-template-columns: 1fr; }
      .pad { padding: 18px 14px; }
      .seller-block { text-align: left; max-width: none; }
    }
    .card {
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
    }
    .card-label {
      font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--muted); margin-bottom: 6px;
    }
    .card .who { font-weight: 800; font-size: 13px; margin-bottom: 2px; }
    table.meta { width: 100%; font-size: 11.5px; border-collapse: collapse; }
    table.meta td { padding: 2px 0; vertical-align: top; }
    table.meta td:first-child { color: var(--muted); width: 40%; }
    table.lines {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0 12px;
      font-size: 11.5px;
    }
    table.lines th {
      text-align: left; border-bottom: 1.5px solid var(--ink); padding: 6px 6px;
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);
    }
    table.lines td {
      border-bottom: 1px solid var(--line);
      padding: 7px 6px;
      vertical-align: top;
    }
    table.lines tr:last-child td { border-bottom: none; }
    .idx { color: var(--muted); width: 22px; }
    .item-name { font-weight: 600; }
    .sku, .uom { font-size: 10px; color: var(--muted); }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .strong { font-weight: 700; }
    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 4px; }
    .totals {
      width: 240px; background: linear-gradient(160deg, #f0f9ff, #fff);
      border: 1px solid #bae6fd; border-radius: 12px; padding: 10px 12px; font-size: 11.5px;
    }
    .totals .line { display: flex; justify-content: space-between; padding: 3px 0; color: #334155; }
    .totals .grand {
      display: flex; justify-content: space-between; font-size: 14px; font-weight: 900;
      border-top: 2px solid var(--brand-deep); margin-top: 6px; padding-top: 8px; color: var(--brand-deep);
    }
    .pay-box {
      background: linear-gradient(145deg, #ecfeff, #f0f9ff);
      border: 1px solid #7dd3fc; border-radius: 12px; padding: 10px 12px; margin: 10px 0;
    }
    .pay-box.warn { background: #fffbeb; border-color: #fcd34d; }
    .pay-title {
      font-weight: 800; font-size: 11px; color: var(--brand-deep);
      margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .pay-box .hint { font-size: 10px; color: #0369a1; margin: 6px 0 0; }
    .section {
      margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line);
    }
    .section h3 {
      margin: 0 0 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--brand-deep);
    }
    .section p, .section .body {
      font-size: 10.5px; line-height: 1.45; color: #334155; margin: 0;
    }
    .feedback {
      margin-top: 12px;
      background: linear-gradient(145deg, #0c4a6e 0%, #0077b6 55%, #00b4d8 100%);
      color: #fff; border-radius: 12px; padding: 12px 12px;
      page-break-inside: avoid;
    }
    .feedback-kicker {
      font-size: 9px; font-weight: 800; letter-spacing: 0.14em;
      text-transform: uppercase; opacity: 0.85;
    }
    .feedback h2 { margin: 4px 0 4px; font-size: 14px; letter-spacing: -0.02em; }
    .feedback > .feedback-head p {
      margin: 0 0 10px; font-size: 11px; line-height: 1.4; opacity: 0.92;
    }
    .feedback-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    @media (max-width: 640px) { .feedback-grid { grid-template-columns: 1fr; } }
    a.feedback-card {
      display: flex; gap: 8px; align-items: center; text-decoration: none; color: inherit;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25);
      border-radius: 10px; padding: 8px;
    }
    a.feedback-card img {
      width: 64px; height: 64px; border-radius: 8px; background: #fff; padding: 4px; flex-shrink: 0;
    }
    .fc-title { font-weight: 800; font-size: 11px; margin-bottom: 2px; }
    .fc-body { font-size: 10px; line-height: 1.35; opacity: 0.9; }
    .fc-link { font-size: 10px; font-weight: 700; margin-top: 4px; color: #e0f2fe; }
    .powered {
      flex-shrink: 0;
      margin-top: 0;
      padding: 10px 14mm 12px;
      background: #0f172a;
      color: #94a3b8;
      text-align: center;
      font-size: 10px;
      line-height: 1.4;
    }
    .powered strong { color: #fff; font-weight: 800; letter-spacing: -0.01em; }
    .powered .reg { color: var(--brand); font-weight: 800; }
    .powered a { color: #7dd3fc; text-decoration: none; }

    /* —— Print / PDF: true A4, same design, tighter fit —— */
    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      .sheet {
        width: 100%;
        min-height: 0;
        max-width: none;
        margin: 0;
        box-shadow: none;
        border: none;
        border-radius: 0;
        overflow: visible;
      }
      .pad { padding: 0 0 4mm; }
      .topbar { height: 4px; }
      .hero { margin-bottom: 8px; gap: 10px; }
      .logo { max-height: 48px; max-width: 160px; margin-bottom: 6px; }
      .logo-fallback { width: 40px; height: 40px; font-size: 16px; margin-bottom: 6px; }
      h1 { font-size: 18px; }
      .parties { gap: 8px; margin-bottom: 8px; }
      .card { padding: 8px 10px; border-radius: 8px; }
      table.lines { margin: 2px 0 8px; font-size: 10.5px; }
      table.lines th { padding: 4px 4px; }
      table.lines td { padding: 5px 4px; }
      .totals { width: 220px; padding: 8px 10px; font-size: 11px; border-radius: 8px; }
      .totals .grand { font-size: 13px; margin-top: 4px; padding-top: 6px; }
      .pay-box { margin: 6px 0; padding: 8px 10px; border-radius: 8px; }
      .section { margin-top: 6px; padding-top: 6px; }
      .section .body { font-size: 9.5px; line-height: 1.35; }
      .feedback {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .feedback h2 { font-size: 12px; }
      .feedback > .feedback-head p { font-size: 9.5px; margin-bottom: 6px; }
      a.feedback-card img { width: 48px; height: 48px; }
      .fc-title { font-size: 10px; }
      .fc-body { font-size: 9px; }
      .powered {
        padding: 8px 0 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .topbar, .card, .totals, .pay-box {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      /* Keep key blocks together when possible */
      .hero, .parties, .totals-wrap, .pay-box, .feedback, .powered {
        page-break-inside: avoid;
      }
      table.lines thead { display: table-header-group; }
      table.lines tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body class="kind-${esc(doc.kind)}">
  <div class="sheet">
    <div class="sheet-body">
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

        ${
          doc.kind === 'quote'
            ? `<div class="quote-banner">${
                doc.validUntil
                  ? `This quotation is valid until <strong>${esc(
                      String(doc.validUntil).slice(0, 10)
                    )}</strong>. Prices subject to stock availability and order confirmation.`
                  : 'This quotation is provided for commercial discussion. Prices subject to stock availability and order confirmation.'
              }</div>`
            : ''
        }

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
              ${doc.validUntil ? `<tr><td>Valid until</td><td><strong>${esc(String(doc.validUntil).slice(0, 10))}</strong></td></tr>` : ''}
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
            <div class="grand"><span>${doc.kind === 'quote' ? 'Total' : 'Total due'}</span><span>${esc(formatMoney(doc.totalAmount, ccy))}</span></div>
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
        <div style="margin-top:4px"><a href="https://www.supplieradvisor.com">www.supplieradvisor.com</a></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
