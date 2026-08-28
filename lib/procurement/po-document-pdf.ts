/**
 * A4 purchase-order PDF (buyer → supplier). Not an invoice.
 * Pure pdfkit — Vercel serverless safe.
 */
import PDFDocument from 'pdfkit';
import { formatMoney } from '@/lib/customers/documents';
import type { PoLineItem } from '@/lib/procurement/types';
import { formatPurchaseOrderNumber } from '@/lib/procurement/po-email';

export type PoPdfParty = {
  name: string;
  legal_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  vat_number?: string | null;
  registration_number?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

export type PoPdfInput = {
  number: string;
  status?: string | null;
  issuedAt?: string | null;
  promisedDate?: string | null;
  paymentTerms?: string | null;
  currency?: string | null;
  notes?: string | null;
  items: PoLineItem[];
  totalAmount: number;
  buyer: PoPdfParty;
  supplier: PoPdfParty;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 40;
const CONTENT_W = PAGE_W - MX * 2;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

function partyLines(p: PoPdfParty): string[] {
  const lines: string[] = [];
  const name = String(p.name || '').trim();
  const legal = String(p.legal_name || '').trim();
  if (name) lines.push(name);
  if (legal && legal !== name) lines.push(legal);
  if (p.contact_name) lines.push(String(p.contact_name));
  if (p.email) lines.push(String(p.email));
  if (p.phone) lines.push(String(p.phone));
  const loc = [p.address, p.city, p.country].filter(Boolean).join(', ');
  if (loc) lines.push(loc);
  if (p.vat_number) lines.push(`VAT ${p.vat_number}`);
  if (p.registration_number) lines.push(`Reg ${p.registration_number}`);
  return lines.slice(0, 7);
}

export function buildPurchaseOrderPdf(input: PoPdfInput): Promise<Buffer> {
  const ccy = String(input.currency || 'ZAR').toUpperCase();
  const number =
    String(input.number || '').trim() || formatPurchaseOrderNumber({});
  const items = Array.isArray(input.items) ? input.items : [];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 52, left: MX, right: MX },
      info: {
        Title: `Purchase order ${number}`,
        Author: input.buyer.name || 'SupplierAdvisor®',
        Subject: 'Purchase order — not an invoice',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

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
      .text('This is an order to supply — not an invoice', MX, 36, {
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
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text(`Date: ${String(input.issuedAt || '').slice(0, 10) || '—'}`, MX, y);
    if (input.promisedDate) {
      doc.text(`Promised: ${String(input.promisedDate).slice(0, 10)}`, MX + 160, y);
    }
    if (input.paymentTerms) {
      doc.text(`Terms: ${String(input.paymentTerms).slice(0, 32)}`, MX + 320, y, {
        width: 190,
      });
    }
    y += 22;

    const colW = (CONTENT_W - 12) / 2;
    const drawCard = (x: number, title: string, lines: string[]) => {
      doc.save();
      doc.roundedRect(x, y, colW, 92, 6).fill('#f8fafc');
      doc
        .roundedRect(x, y, colW, 92, 6)
        .strokeColor(LINE)
        .lineWidth(0.7)
        .stroke();
      doc
        .fillColor(MUTED)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(title.toUpperCase(), x + 10, y + 8, { characterSpacing: 0.4 });
      let ty = y + 22;
      lines.forEach((line, i) => {
        doc
          .fillColor(i === 0 ? INK : MUTED)
          .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(i === 0 ? 10 : 8)
          .text(line.slice(0, 64), x + 10, ty, {
            width: colW - 20,
            lineBreak: false,
            ellipsis: true,
          });
        ty += i === 0 ? 14 : 11;
      });
      doc.restore();
    };
    drawCard(MX, 'From (buyer)', partyLines(input.buyer));
    drawCard(MX + colW + 12, 'To (supplier)', partyLines(input.supplier));
    y += 108;

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('Item', MX, y, { width: 240 })
      .text('Qty', MX + 250, y, { width: 50, align: 'right' })
      .text('Unit', MX + 310, y, { width: 90, align: 'right' })
      .text('Amount', MX + 410, y, { width: CONTENT_W - 410, align: 'right' });
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
      const name = String(row.item_name || 'Item').slice(0, 80);
      const uom = row.uom ? ` ${row.uom}` : '';
      if (y > PAGE_H - 120) {
        doc.addPage();
        y = 56;
      }
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(INK)
        .text(name, MX, y, { width: 240 });
      doc.text(`${qty}${uom}`, MX + 250, y, { width: 50, align: 'right' });
      doc.text(formatMoney(unit, ccy), MX + 310, y, {
        width: 90,
        align: 'right',
      });
      doc.text(formatMoney(line, ccy), MX + 410, y, {
        width: CONTENT_W - 410,
        align: 'right',
      });
      y += 16;
    }

    y += 6;
    doc.moveTo(MX, y).lineTo(PAGE_W - MX, y).strokeColor(LINE).stroke();
    y += 12;
    const total = Number(input.totalAmount) || running;
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

    if (input.notes) {
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(MUTED)
        .text('Notes', MX, y);
      y += 12;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(INK)
        .text(String(input.notes).slice(0, 800), MX, y, { width: CONTENT_W });
      y += 28;
    }

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        'Please confirm this purchase order and raise your invoice quoting the PO number above. Do not treat this document as a tax invoice or a request for payment from the buyer.',
        MX,
        Math.min(y, PAGE_H - 70),
        { width: CONTENT_W }
      );

    doc
      .rect(0, PAGE_H - 36, PAGE_W, 36)
      .fill('#0f172a');
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Powered by SupplierAdvisor®', MX, PAGE_H - 24, {
        lineBreak: false,
      });
    doc
      .fillColor(BRAND)
      .text('www.supplieradvisor.com', MX, PAGE_H - 24, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });

    doc.end();
  });
}
