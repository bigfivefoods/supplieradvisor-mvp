/**
 * Purchase-order email helpers (not invoices).
 * Buyer emails a PO to the supplier and is copied by default.
 */

export function isEmailAddress(raw: unknown): boolean {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  return s.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function normalizeEmail(raw: unknown): string | null {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  return isEmailAddress(s) ? s : null;
}

/** Matches the canonical PO number shape: PO-YYYYMMDD-XXXX */
export const REAL_PO_NUMBER_RE = /^PO-\d{8}-[A-Z0-9]{4}$/i;

/** Returns true for a real docNumber-style PO number (not a legacy/raw value). */
export function isRealPoNumber(n: string | null | undefined): boolean {
  return REAL_PO_NUMBER_RE.test(String(n || '').trim());
}

/** Returns true for values that should be treated as unset legacy PO numbers. */
export function isLegacyPoNumber(n: string | null | undefined): boolean {
  const s = String(n || '').trim();
  if (!s) return true;
  if (/^\d+$/.test(s)) return true;       // raw id: "1", "42"
  if (/^PO-\d+$/i.test(s)) return true;   // PO-1, PO-9, PO-42
  return false;
}

export function formatPurchaseOrderNumber(po: {
  id?: number | null;
  po_number?: string | null;
  order_number?: string | null;
}): string {
  const n =
    String(po.po_number || '').trim() ||
    String(po.order_number || '').trim();
  if (n && !isLegacyPoNumber(n)) return n;
  const id = Number(po.id);
  return Number.isFinite(id) && id > 0 ? `PO-${id}` : 'PO';
}

export function purchaseOrderPdfFilename(number: string): string {
  const slug = String(number || 'PO')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return `${slug || 'PO'}.pdf`;
}

export function purchaseOrderEmailSubject(opts: {
  number: string;
  buyerName: string;
  resend?: boolean;
}): string {
  const who = String(opts.buyerName || 'Buyer').trim() || 'Buyer';
  const num = String(opts.number || 'PO').trim() || 'PO';
  return opts.resend
    ? `Reminder: Purchase order ${num} from ${who}`
    : `Purchase order ${num} from ${who}`;
}

/** Sender CC — never the same address as the supplier To. */
export function purchaseOrderCcList(opts: {
  to: string;
  ccMe?: boolean;
  senderEmail?: string | null;
}): string[] {
  if (opts.ccMe === false) return [];
  const to = normalizeEmail(opts.to);
  const me = normalizeEmail(opts.senderEmail);
  if (!me || me === to) return [];
  return [me];
}

export function srmIdFromPo(po: {
  supplier_id?: unknown;
  metadata?: unknown;
}): number | null {
  const meta =
    po.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
      ? (po.metadata as Record<string, unknown>)
      : {};
  const fromMeta = Number(meta.srm_supplier_id);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
  const fromCol = Number(po.supplier_id);
  if (Number.isFinite(fromCol) && fromCol > 0) return fromCol;
  return null;
}

export function purchaseOrderEmailHtml(opts: {
  supplierName: string;
  contactName?: string | null;
  buyerName: string;
  number: string;
  totalLabel: string;
  promisedDate?: string | null;
  message?: string | null;
  senderCopied: boolean;
}): string {
  const first = String(opts.contactName || '')
    .trim()
    .split(/\s+/)[0];
  const hi = first ? `Hi ${first}` : 'Hello';
  const extra = String(opts.message || '').trim();
  const extraBlock = extra
    ? `<p style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;white-space:pre-wrap">${escapeHtml(
        extra
      )}</p>`
    : '';
  const promised = opts.promisedDate
    ? ` Promised delivery: <strong>${escapeHtml(opts.promisedDate)}</strong>.`
    : '';
  const ccNote = opts.senderCopied
    ? `<p style="font-size:12px;color:#64748b">The buyer who raised this order has been copied.</p>`
    : '';
  return `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
      <p style="line-height:1.55">${hi},</p>
      ${extraBlock}
      <p style="line-height:1.55">
        Please find <strong>purchase order ${escapeHtml(opts.number)}</strong>
        from <strong>${escapeHtml(opts.buyerName)}</strong> attached as a PDF.
        This is an <strong>order</strong>, not an invoice — please confirm
        supply and invoice against this PO number.${promised}
      </p>
      <p style="line-height:1.55">
        Order total: <strong>${escapeHtml(opts.totalLabel)}</strong>
        for <strong>${escapeHtml(opts.supplierName)}</strong>.
      </p>
      ${ccNote}
      <p style="font-size:13px;color:#64748b">The formal purchase order PDF is attached for your records.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="font-size:12px;color:#94a3b8">Sent via SupplierAdvisor® · ${escapeHtml(
        opts.buyerName
      )}</p>
    </div>
  `.trim();
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
