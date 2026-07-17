/**
 * Beautiful A4 commercial PDF (quotation / sales order / tax invoice).
 * Pure pdfkit — works on Vercel serverless (no Chromium).
 */
import PDFDocument from 'pdfkit';
import { formatMoney, type DocLineItem } from '@/lib/customers/documents';
import type { DocRenderInput, SellerProfile } from '@/lib/customers/invoice-document';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 40;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 52;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';

const KIND_LABEL: Record<DocRenderInput['kind'], string> = {
  quote: 'QUOTATION',
  order: 'SALES ORDER',
  invoice: 'TAX INVOICE',
};

function sellerAddress(s: SellerProfile): string {
  return [s.street || s.address, s.city, s.province, s.postal_code, s.country]
    .map((x) => (x ? String(x).trim() : ''))
    .filter(Boolean)
    .join(', ');
}

function money(n: number, ccy: string): string {
  return formatMoney(Number(n) || 0, ccy);
}

function ensureSpace(doc: PDFKit.PDFDocument, need: number) {
  if (doc.y + need > CONTENT_BOTTOM) {
    doc.addPage();
    doc.y = MARGIN_TOP + 18;
  }
}

function drawTopBar(doc: PDFKit.PDFDocument) {
  // Brand gradient strip
  doc.save();
  doc.rect(0, 0, PAGE_W, 6).fill(BRAND);
  doc.rect(0, 0, PAGE_W * 0.45, 6).fill(BRAND_DEEP);
  doc.restore();
}

function drawFooter(doc: PDFKit.PDFDocument, page: number, pages: number) {
  const y = PAGE_H - 36;
  doc.save();
  doc.rect(0, PAGE_H - 42, PAGE_W, 42).fill('#0f172a');
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('Powered by SupplierAdvisor®', MARGIN_X, y, {
      width: CONTENT_W * 0.55,
      lineBreak: false,
    });
  doc
    .fillColor('#94a3b8')
    .font('Helvetica')
    .fontSize(7)
    .text('Trade network · OTIFEF · quality & claims', MARGIN_X, y + 11, {
      width: CONTENT_W * 0.55,
      lineBreak: false,
    });
  doc
    .fillColor(BRAND)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(`Page ${page} of ${pages}`, MARGIN_X, y, {
      width: CONTENT_W,
      align: 'right',
      lineBreak: false,
    });
  doc
    .fillColor('#7dd3fc')
    .font('Helvetica')
    .fontSize(7)
    .text('www.supplieradvisor.com', MARGIN_X, y + 11, {
      width: CONTENT_W,
      align: 'right',
      lineBreak: false,
    });
  doc.restore();
}

function card(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  lines: string[]
) {
  doc.save();
  doc.roundedRect(x, y, w, h, 8).fill(SOFT);
  doc.roundedRect(x, y, w, h, 8).strokeColor(LINE).lineWidth(0.8).stroke();
  doc
    .fillColor(MUTED)
    .font('Helvetica-Bold')
    .fontSize(7)
    .text(title.toUpperCase(), x + 10, y + 8, {
      width: w - 20,
      characterSpacing: 0.6,
      lineBreak: false,
    });
  let ty = y + 22;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    if (!t) continue;
    const isFirst = i === 0;
    doc
      .fillColor(isFirst ? INK : MUTED)
      .font(isFirst ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isFirst ? 10 : 8.5)
      .text(t, x + 10, ty, { width: w - 20, lineBreak: false });
    ty += isFirst ? 14 : 12;
  }
  doc.restore();
}

/**
 * Render DocRenderInput to a PDF Buffer.
 */
export async function buildCommercialDocumentPdf(
  input: DocRenderInput
): Promise<Buffer> {
  const ccy = input.currency || input.seller.primary_currency || 'ZAR';
  const sellerName =
    input.seller.trading_name || input.seller.legal_name || 'Supplier';
  const kindLabel = KIND_LABEL[input.kind];
  const items = (input.items || []).filter((l) => l?.name);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: MARGIN_TOP,
        bottom: MARGIN_BOTTOM,
        left: MARGIN_X,
        right: MARGIN_X,
      },
      info: {
        Title: `${kindLabel} ${input.number}`,
        Author: sellerName,
        Subject: `${kindLabel} for ${input.customerName || 'customer'}`,
        Creator: 'SupplierAdvisor',
      },
      bufferPages: true,
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawTopBar(doc);
    doc.y = MARGIN_TOP + 10;

    // ── Hero ──────────────────────────────────────────────────────────
    const leftX = MARGIN_X;
    const rightX = MARGIN_X + CONTENT_W * 0.52;
    const rightW = CONTENT_W * 0.48;

    doc
      .fillColor(BRAND_DEEP)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(kindLabel, leftX, doc.y, {
        width: CONTENT_W * 0.5,
        characterSpacing: 1.2,
        lineBreak: false,
      });

    doc.y += 14;
    const numY = doc.y;
    doc.font('Helvetica-Bold').fontSize(20);
    const numStr = String(input.number);
    const numW = Math.min(doc.widthOfString(numStr) + 10, CONTENT_W * 0.42);
    doc.fillColor(INK).text(numStr, leftX, numY, {
      width: CONTENT_W * 0.48,
      lineBreak: false,
    });

    if (input.seller.is_verified) {
      const badge = 'Verified';
      doc.font('Helvetica-Bold').fontSize(7);
      const bw = doc.widthOfString(badge) + 14;
      const bx = leftX + numW;
      const by = numY + 5;
      doc.roundedRect(bx, by, bw, 13, 6).fill('#ecfdf5');
      doc
        .fillColor('#047857')
        .text(badge, bx + 7, by + 3, { lineBreak: false });
    }

    doc.y = numY + 28;
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8.5)
      .text(`Status: ${input.status || '—'}`, leftX, doc.y, { lineBreak: false });

    // Seller block (right)
    let sy = MARGIN_TOP + 10;
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(sellerName, rightX, sy, { width: rightW, align: 'right' });
    sy = doc.y + 2;
    if (input.seller.legal_name && input.seller.legal_name !== sellerName) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(input.seller.legal_name, rightX, sy, { width: rightW, align: 'right' });
      sy = doc.y + 1;
    }
    const addr = sellerAddress(input.seller);
    if (addr) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(addr, rightX, sy, { width: rightW, align: 'right' });
      sy = doc.y + 1;
    }
    const sellerContact = [
      input.seller.email || input.seller.contact_email,
      input.seller.contact_phone || input.seller.phone,
    ]
      .filter(Boolean)
      .join(' · ');
    if (sellerContact) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(sellerContact, rightX, sy, { width: rightW, align: 'right' });
      sy = doc.y + 1;
    }
    if (input.seller.vat_number) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(`VAT ${input.seller.vat_number}`, rightX, sy, {
          width: rightW,
          align: 'right',
        });
      sy = doc.y + 1;
    }
    if (input.seller.registration_number) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(`Reg ${input.seller.registration_number}`, rightX, sy, {
          width: rightW,
          align: 'right',
        });
    }

    doc.y = Math.max(doc.y, sy) + 16;

    // ── Party cards ───────────────────────────────────────────────────
    const cardH = 78;
    const cardW = (CONTENT_W - 12) / 2;
    const cardY = doc.y;

    const billLines = [
      input.customerName || 'Customer',
      input.contactName || '',
      input.contactEmail || '',
      input.contactPhone || '',
    ];
    card(doc, MARGIN_X, cardY, cardW, cardH, 'Bill to', billLines);

    const metaLines: string[] = [];
    if (input.issuedAt) {
      metaLines.push(`Date: ${String(input.issuedAt).slice(0, 10)}`);
    }
    if (input.kind === 'quote' && input.validUntil) {
      metaLines.push(`Valid until: ${String(input.validUntil).slice(0, 10)}`);
    }
    if (input.kind === 'invoice' && input.dueDate) {
      metaLines.push(`Due: ${String(input.dueDate).slice(0, 10)}`);
    }
    metaLines.push(`Currency: ${ccy}`);
    if (input.kind === 'quote') {
      metaLines.push('Subject to stock & confirmation');
    }
    card(doc, MARGIN_X + cardW + 12, cardY, cardW, cardH, 'Document', [
      metaLines[0] || `Currency: ${ccy}`,
      ...metaLines.slice(1),
    ]);

    doc.y = cardY + cardH + 16;

    // Quote callout
    if (input.kind === 'quote') {
      ensureSpace(doc, 28);
      const cy = doc.y;
      doc.save();
      doc.roundedRect(MARGIN_X, cy, CONTENT_W, 24, 6).fill('#e0f7fc');
      doc
        .fillColor(BRAND_DEEP)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(
          input.validUntil
            ? `This quotation is valid until ${String(input.validUntil).slice(0, 10)}. Prices subject to stock availability.`
            : 'This quotation is provided for commercial discussion. Prices subject to stock availability and order confirmation.',
          MARGIN_X + 10,
          cy + 7,
          { width: CONTENT_W - 20, lineBreak: false }
        );
      doc.restore();
      doc.y = cy + 32;
    }

    // ── Line table ────────────────────────────────────────────────────
    ensureSpace(doc, 40);
    const col = {
      idx: 22,
      desc: CONTENT_W - 22 - 50 - 78 - 78,
      qty: 50,
      unit: 78,
      amt: 78,
    };
    const headerY = doc.y;
    doc
      .moveTo(MARGIN_X, headerY + 14)
      .lineTo(MARGIN_X + CONTENT_W, headerY + 14)
      .strokeColor(INK)
      .lineWidth(1.2)
      .stroke();

    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5);
    let hx = MARGIN_X;
    doc.text('#', hx, headerY, { width: col.idx, lineBreak: false });
    hx += col.idx;
    doc.text('DESCRIPTION', hx, headerY, { width: col.desc, lineBreak: false });
    hx += col.desc;
    doc.text('QTY', hx, headerY, { width: col.qty, align: 'right', lineBreak: false });
    hx += col.qty;
    doc.text('UNIT PRICE', hx, headerY, {
      width: col.unit,
      align: 'right',
      lineBreak: false,
    });
    hx += col.unit;
    doc.text('AMOUNT', hx, headerY, { width: col.amt, align: 'right', lineBreak: false });

    doc.y = headerY + 20;

    items.forEach((line: DocLineItem, i: number) => {
      ensureSpace(doc, 28);
      const rowY = doc.y;
      const name = String(line.name || 'Line');
      const qty = `${Number(line.quantity || 0)}${line.uom ? ` ${line.uom}` : ''}`;
      const unit = money(Number(line.unit_price || 0), ccy);
      const amt = money(Number(line.line_total || 0), ccy);

      // Zebra
      if (i % 2 === 1) {
        doc.save();
        doc.rect(MARGIN_X, rowY - 2, CONTENT_W, 22).fill('#f8fafc');
        doc.restore();
      }

      let x = MARGIN_X;
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text(String(i + 1), x, rowY, { width: col.idx, lineBreak: false });
      x += col.idx;
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(name, x, rowY, { width: col.desc - 4, lineBreak: false });
      if (line.sku) {
        doc
          .fillColor(MUTED)
          .font('Helvetica')
          .fontSize(7)
          .text(String(line.sku), x, rowY + 11, {
            width: col.desc - 4,
            lineBreak: false,
          });
      }
      x += col.desc;
      doc
        .fillColor(INK)
        .font('Helvetica')
        .fontSize(9)
        .text(qty, x, rowY, { width: col.qty, align: 'right', lineBreak: false });
      x += col.qty;
      doc.text(unit, x, rowY, { width: col.unit, align: 'right', lineBreak: false });
      x += col.unit;
      doc
        .font('Helvetica-Bold')
        .text(amt, x, rowY, { width: col.amt, align: 'right', lineBreak: false });

      doc.y = rowY + (line.sku ? 26 : 20);
      doc
        .moveTo(MARGIN_X, doc.y)
        .lineTo(MARGIN_X + CONTENT_W, doc.y)
        .strokeColor(LINE)
        .lineWidth(0.5)
        .stroke();
      doc.y += 6;
    });

    if (!items.length) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text('No line items', MARGIN_X, doc.y);
      doc.y += 16;
    }

    // ── Totals ────────────────────────────────────────────────────────
    ensureSpace(doc, 90);
    const boxW = 200;
    const boxX = MARGIN_X + CONTENT_W - boxW;
    const boxY = doc.y + 4;
    doc.save();
    doc.roundedRect(boxX, boxY, boxW, 72, 10).fill('#f0f9ff');
    doc.roundedRect(boxX, boxY, boxW, 72, 10).strokeColor('#bae6fd').lineWidth(1).stroke();
    doc
      .fillColor('#334155')
      .font('Helvetica')
      .fontSize(9)
      .text('Subtotal', boxX + 12, boxY + 10, { width: 90, lineBreak: false });
    doc.text(money(input.subtotal, ccy), boxX + 12, boxY + 10, {
      width: boxW - 24,
      align: 'right',
      lineBreak: false,
    });
    doc.text(`Tax (${input.taxRate}%)`, boxX + 12, boxY + 26, {
      width: 90,
      lineBreak: false,
    });
    doc.text(money(input.taxAmount, ccy), boxX + 12, boxY + 26, {
      width: boxW - 24,
      align: 'right',
      lineBreak: false,
    });
    doc
      .moveTo(boxX + 12, boxY + 44)
      .lineTo(boxX + boxW - 12, boxY + 44)
      .strokeColor(BRAND_DEEP)
      .lineWidth(1.5)
      .stroke();
    doc
      .fillColor(BRAND_DEEP)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(input.kind === 'quote' ? 'Total' : 'Total due', boxX + 12, boxY + 50, {
        width: 90,
        lineBreak: false,
      });
    doc.text(money(input.totalAmount, ccy), boxX + 12, boxY + 50, {
      width: boxW - 24,
      align: 'right',
      lineBreak: false,
    });
    doc.restore();
    doc.y = boxY + 84;

    // ── Bank (invoices) ───────────────────────────────────────────────
    if (input.kind === 'invoice') {
      const s = input.seller;
      const bankRows: Array<[string, string]> = [
        ['Bank', s.bank_name || ''],
        ['Account name', s.account_name || ''],
        ['Account number', s.account_number || ''],
        ['Branch code', s.branch_code || ''],
        ['IBAN', s.iban || ''],
        ['SWIFT', s.swift || ''],
      ].filter(([, v]) => v && String(v).trim()) as Array<[string, string]>;

      ensureSpace(doc, 20 + bankRows.length * 12 + 20);
      const by = doc.y;
      const bh = Math.max(48, 28 + bankRows.length * 12);
      doc.save();
      doc.roundedRect(MARGIN_X, by, CONTENT_W, bh, 8).fill('#ecfeff');
      doc.roundedRect(MARGIN_X, by, CONTENT_W, bh, 8).strokeColor('#7dd3fc').lineWidth(1).stroke();
      doc
        .fillColor(BRAND_DEEP)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('BANK DETAILS FOR PAYMENT', MARGIN_X + 12, by + 8, {
          characterSpacing: 0.5,
          lineBreak: false,
        });
      let ty = by + 22;
      if (!bankRows.length) {
        doc
          .fillColor('#92400e')
          .font('Helvetica')
          .fontSize(8.5)
          .text(
            'Bank details not set — contact the seller for EFT instructions.',
            MARGIN_X + 12,
            ty,
            { width: CONTENT_W - 24 }
          );
      } else {
        for (const [k, v] of bankRows) {
          doc
            .fillColor(MUTED)
            .font('Helvetica')
            .fontSize(8)
            .text(k, MARGIN_X + 12, ty, { width: 100, lineBreak: false });
          doc
            .fillColor(INK)
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .text(v, MARGIN_X + 120, ty, { width: CONTENT_W - 140, lineBreak: false });
          ty += 12;
        }
        doc
          .fillColor('#0369a1')
          .font('Helvetica')
          .fontSize(7.5)
          .text(
            `Use invoice number ${input.number} as your payment reference.`,
            MARGIN_X + 12,
            ty + 2,
            { width: CONTENT_W - 24 }
          );
      }
      doc.restore();
      doc.y = by + bh + 12;
    }

    // ── Terms / notes ────────────────────────────────────────────────
    const terms =
      input.terms ||
      (input.kind === 'quote'
        ? 'Prices valid until the date shown (if any). Subject to stock availability and final order confirmation. Errors and omissions excepted (E&OE).'
        : input.kind === 'invoice'
          ? input.paymentTerms || null
          : null);

    if (terms) {
      ensureSpace(doc, 48);
      doc
        .fillColor(BRAND_DEEP)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(input.kind === 'invoice' ? 'PAYMENT TERMS' : 'TERMS', MARGIN_X, doc.y, {
          characterSpacing: 0.5,
          lineBreak: false,
        });
      doc.y += 12;
      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(8)
        .text(terms, MARGIN_X, doc.y, { width: CONTENT_W, lineGap: 2 });
      doc.y += 10;
    }

    if (input.notes) {
      ensureSpace(doc, 40);
      doc
        .fillColor(BRAND_DEEP)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('NOTES', MARGIN_X, doc.y, { characterSpacing: 0.5, lineBreak: false });
      doc.y += 12;
      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(8)
        .text(String(input.notes), MARGIN_X, doc.y, { width: CONTENT_W, lineGap: 2 });
      doc.y += 8;
    }

    // Closing line for quotes
    if (input.kind === 'quote') {
      ensureSpace(doc, 36);
      doc.y += 6;
      doc
        .fillColor(MUTED)
        .font('Helvetica-Oblique')
        .fontSize(8.5)
        .text(
          'Thank you for the opportunity to quote. We look forward to doing business with you.',
          MARGIN_X,
          doc.y,
          { width: CONTENT_W, align: 'center' }
        );
    }

    // Stamp page numbers on all buffered pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      // re-draw top bar on later pages
      if (i > 0) drawTopBar(doc);
      drawFooter(doc, i + 1, range.count);
    }

    doc.end();
  });
}

export function commercialPdfFilename(input: DocRenderInput): string {
  const safe = String(input.number || input.kind)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
  return `${input.kind}-${safe}.pdf`;
}
