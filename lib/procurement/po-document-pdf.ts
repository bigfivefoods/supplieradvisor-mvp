/**
 * A4 purchase-order PDF (buyer → supplier). Not a tax invoice.
 * Pure pdfkit — Vercel serverless safe. Does not query Supabase.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { formatMoney } from '@/lib/customers/documents';
import type { PoLineItem } from '@/lib/procurement/types';
import { formatPurchaseOrderNumber } from '@/lib/procurement/po-email';
import { absoluteLogoUrl } from '@/lib/customers/commercial-doc-links';

export type PoPdfParty = {
  name: string;
  legal_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  website?: string | null;
  vat_number?: string | null;
  registration_number?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  logo_url?: string | null;
};

export type PoPdfLot = {
  batch_number: string;
  manufactured_at?: string | null;
  expiry_date?: string | null;
  best_before?: string | null;
  qty?: number | null;
  uom?: string | null;
  item_name?: string | null;
};

export type PoPdfInput = {
  number: string;
  status?: string | null;
  issuedAt?: string | null;
  promisedDate?: string | null;
  requestedDate?: string | null;
  actualDeliveryDate?: string | null;
  paymentTerms?: string | null;
  currency?: string | null;
  notes?: string | null;
  items: PoLineItem[];
  lots?: PoPdfLot[];
  totalAmount: number;
  buyer: PoPdfParty;
  supplier: PoPdfParty;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 40;
const CONTENT_W = PAGE_W - MX * 2;
const FOOTER_H = 40;
const LOGO_PT = 72;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

export function partyDetailLines(p: PoPdfParty): string[] {
  const lines: string[] = [];
  const name = String(p.name || '').trim();
  const legal = String(p.legal_name || '').trim();
  if (name) lines.push(name);
  if (legal && legal !== name) lines.push(legal);
  if (p.contact_name) lines.push(String(p.contact_name));
  if (p.email) lines.push(String(p.email));
  if (p.phone) lines.push(String(p.phone));
  if (p.website) lines.push(String(p.website));
  const street = String(p.address || '').trim();
  if (street) lines.push(street);
  const loc = [p.city, p.country].filter(Boolean).join(', ');
  if (loc) lines.push(loc);
  if (p.vat_number) lines.push(`VAT ${p.vat_number}`);
  if (p.registration_number) lines.push(`Reg ${p.registration_number}`);
  return lines;
}

async function fetchLogoBuffer(
  logoUrl: string | null | undefined
): Promise<Buffer | null> {
  const abs = absoluteLogoUrl(logoUrl);
  if (!abs) return null;
  if (abs.startsWith('data:image/')) {
    try {
      const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(abs);
      if (m?.[2]) return Buffer.from(m[2], 'base64');
    } catch {
      /* soft */
    }
    return null;
  }
  try {
    const res = await fetch(abs, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'image/png,image/jpeg,image/*' },
    });
    if (!res.ok) return null;
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('svg')) return null;
    const ab = await res.arrayBuffer();
    if (!ab.byteLength || ab.byteLength > 2_500_000) return null;
    const buf = Buffer.from(ab);
    const isPng =
      buf.length > 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47;
    const isJpg = buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8;
    const isWebp =
      buf.length > 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50;
    if (!isPng && !isJpg && !isWebp) return null;
    if (isWebp) return null;
    return buf;
  } catch {
    return null;
  }
}

export function saMarkBuffer(): Buffer | null {
  for (const name of ['sa-logo.png', 'sa-logo.jpg', 'sa-updated-logo.jpg']) {
    const p = join(process.cwd(), 'public', name);
    if (!existsSync(p)) continue;
    try {
      return readFileSync(p);
    } catch {
      /* soft */
    }
  }
  return null;
}

function drawFooter(doc: PDFKit.PDFDocument, mark: Buffer | null) {
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  try {
    doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H).fill('#0f172a');
    let x = MX;
    if (mark) {
      try {
        doc.image(mark, x, PAGE_H - FOOTER_H + 8, { height: 22 });
        x += 78;
      } catch {
        /* print words only */
      }
    }
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Powered by SupplierAdvisor®', x, PAGE_H - 24, {
        lineBreak: false,
        continued: false,
      });
    doc
      .fillColor(BRAND)
      .font('Helvetica')
      .fontSize(8)
      .text('www.supplieradvisor.com', MX, PAGE_H - 24, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });
  } finally {
    doc.restore();
    doc.page.margins.bottom = savedBottom;
  }
}

export async function buildPurchaseOrderPdf(input: PoPdfInput): Promise<Buffer> {
  const ccy = String(input.currency || 'ZAR').toUpperCase();
  const number =
    String(input.number || '').trim() || formatPurchaseOrderNumber({});
  const items = Array.isArray(input.items) ? input.items : [];
  const [buyerLogo, supplierLogo, saMark] = await Promise.all([
    fetchLogoBuffer(input.buyer.logo_url),
    fetchLogoBuffer(input.supplier.logo_url),
    Promise.resolve(saMarkBuffer()),
  ]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      compress: false,
      margins: { top: 56, bottom: FOOTER_H + 12, left: MX, right: MX },
      info: {
        Title: `Purchase order ${number}`,
        Author: input.buyer.name || 'SupplierAdvisor®',
        Subject: 'Purchase order — order to supply, not a tax invoice',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    let paintingFooter = false;
    doc.on('pageAdded', () => {
      if (paintingFooter) return;
      paintingFooter = true;
      try {
        drawFooter(doc, saMark);
      } finally {
        paintingFooter = false;
      }
    });

    doc.rect(0, 0, PAGE_W, 58).fill(BRAND_DEEP);
    doc.rect(0, 54, PAGE_W, 4).fill(BRAND);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('PURCHASE ORDER', MX, 16, { lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#bae6fd')
      .text('This is an order to supply — not a tax invoice', MX, 36, {
        lineBreak: false,
      });
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(number, MX, 18, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });

    let y = 78;
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    doc.text(`Date: ${String(input.issuedAt || '').slice(0, 10) || '—'}`, MX, y);
    const requested = input.requestedDate
      ? String(input.requestedDate).slice(0, 10)
      : '';
    const confirmed = input.promisedDate
      ? String(input.promisedDate).slice(0, 10)
      : '';
    if (requested && confirmed && requested !== confirmed) {
      doc.text(`Requested: ${requested}`, MX + 130, y);
      doc.text(`Confirmed: ${confirmed}`, MX + 280, y);
    } else if (confirmed) {
      doc.text(`Confirmed: ${confirmed}`, MX + 150, y);
    }
    if (input.paymentTerms) {
      doc.text(`Terms: ${String(input.paymentTerms)}`, MX + 400, y, {
        width: CONTENT_W - 360,
      });
    }
    doc.text(`Currency: ${ccy}`, MX, y + 12);
    if (input.actualDeliveryDate) {
      doc.text(
        `Dispatched: ${String(input.actualDeliveryDate).slice(0, 10)}`,
        MX + 150,
        y + 12
      );
    }
    y += 28;

    const colW = (CONTENT_W - 12) / 2;
    const drawParty = (
      x: number,
      title: string,
      party: PoPdfParty,
      logo: Buffer | null
    ): number => {
      const lines = partyDetailLines(party);
      const logoH = logo ? LOGO_PT : 0;
      let textH = 16;
      doc.font('Helvetica').fontSize(8);
      for (const line of lines) {
        textH +=
          doc.heightOfString(line, { width: colW - 20 }) + 3;
      }
      const h = Math.max(72, 14 + logoH + 8 + textH);
      doc.save();
      doc.roundedRect(x, y, colW, h, 6).fill('#f8fafc');
      doc
        .roundedRect(x, y, colW, h, 6)
        .strokeColor(LINE)
        .lineWidth(0.7)
        .stroke();
      doc
        .fillColor(MUTED)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(title.toUpperCase(), x + 10, y + 8, { characterSpacing: 0.4 });
      let ty = y + 20;
      if (logo) {
        try {
          doc.image(logo, x + 10, ty, { fit: [LOGO_PT, LOGO_PT] });
        } catch {
          /* text still prints */
        }
        ty += LOGO_PT + 8;
      }
      lines.forEach((line, i) => {
        doc
          .fillColor(i === 0 ? INK : MUTED)
          .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(i === 0 ? 10 : 8)
          .text(line, x + 10, ty, { width: colW - 20 });
        ty += doc.heightOfString(line, { width: colW - 20 }) + 3;
      });
      doc.restore();
      return h;
    };
    const leftH = drawParty(MX, 'From / Buyer', input.buyer, buyerLogo);
    const rightH = drawParty(
      MX + colW + 12,
      'To / Supplier',
      input.supplier,
      supplierLogo
    );
    y += Math.max(leftH, rightH) + 16;

    const ensureSpace = (need: number) => {
      if (y > PAGE_H - FOOTER_H - need) {
        doc.addPage();
        y = 56;
      }
    };

    ensureSpace(40);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('SKU', MX, y, { width: 70 })
      .text('Item', MX + 70, y, { width: 180 })
      .text('Qty', MX + 250, y, { width: 60, align: 'right' })
      .text('Unit', MX + 310, y, { width: 90, align: 'right' })
      .text('Amount', MX + 410, y, {
        width: CONTENT_W - 410,
        align: 'right',
      });
    y += 12;
    doc.moveTo(MX, y).lineTo(PAGE_W - MX, y).strokeColor(LINE).stroke();
    y += 8;

    if (!items.length) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('No line items', MX, y);
      y += 16;
    }

    let running = 0;
    for (const row of items) {
      const qty = Number(row.quantity) || 0;
      const unit = Number(row.unit_price) || 0;
      const line =
        Number(row.line_total) || Math.round(qty * unit * 100) / 100;
      running += line;
      const sku = String(row.sku || '').trim();
      const name = String(row.item_name || 'Item');
      const uom = row.uom ? ` ${row.uom}` : '';
      ensureSpace(28);
      doc.font('Helvetica').fontSize(8).fillColor(MUTED);
      doc.text(sku || '—', MX, y, { width: 70 });
      doc.font('Helvetica').fontSize(9).fillColor(INK);
      doc.text(name, MX + 70, y, { width: 180 });
      doc.text(`${qty}${uom}`, MX + 250, y, { width: 60, align: 'right' });
      doc.text(formatMoney(unit, ccy), MX + 310, y, {
        width: 90,
        align: 'right',
      });
      doc.text(formatMoney(line, ccy), MX + 410, y, {
        width: CONTENT_W - 410,
        align: 'right',
      });
      const nameH = doc.heightOfString(name, { width: 180 });
      y += Math.max(16, nameH + 6);
    }

    y += 6;
    doc.moveTo(MX, y).lineTo(PAGE_W - MX, y).strokeColor(LINE).stroke();
    y += 12;
    const total = Number(input.totalAmount) || running;
    ensureSpace(36);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(INK)
      .text('Order total', MX + 250, y, { width: 150, align: 'right' })
      .text(formatMoney(total, ccy), MX + 410, y, {
        width: CONTENT_W - 410,
        align: 'right',
      });
    y += 28;

    const lots = Array.isArray(input.lots) ? input.lots : [];
    if (lots.length) {
      ensureSpace(36);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(MUTED)
        .text('Traceability  ·  lot / manufacture / expiry', MX, y);
      y += 12;
      for (const lot of lots) {
        const bits = [
          String(lot.batch_number || '').trim(),
          lot.item_name ? String(lot.item_name) : '',
          lot.manufactured_at
            ? `manufactured ${String(lot.manufactured_at).slice(0, 10)}`
            : '',
          lot.expiry_date ? `expiry ${String(lot.expiry_date).slice(0, 10)}` : '',
          lot.best_before
            ? `best before ${String(lot.best_before).slice(0, 10)}`
            : '',
          lot.qty != null
            ? `qty ${lot.qty}${lot.uom ? ` ${lot.uom}` : ''}`
            : '',
        ].filter(Boolean);
        if (!bits.length) continue;
        const line = bits.join(' · ');
        ensureSpace(16);
        doc.font('Helvetica').fontSize(8).fillColor(INK).text(line, MX, y, {
          width: CONTENT_W,
        });
        y += doc.heightOfString(line, { width: CONTENT_W }) + 4;
      }
      y += 8;
    }

    if (input.notes) {
      ensureSpace(48);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('Notes', MX, y);
      y += 12;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(INK)
        .text(String(input.notes), MX, y, { width: CONTENT_W });
      y += doc.heightOfString(String(input.notes), { width: CONTENT_W }) + 12;
    }

    ensureSpace(48);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        'Please confirm this purchase order and raise your invoice quoting the PO number above. Do not treat this document as a tax invoice or a request for payment from the buyer.',
        MX,
        y,
        { width: CONTENT_W }
      );

    drawFooter(doc, saMark);
    doc.end();
  });
}
