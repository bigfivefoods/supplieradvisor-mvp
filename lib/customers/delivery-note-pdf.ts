/**
 * A4 delivery-note PDF. Same brand bar and footer as commercial invoices.
 * Quantities and units only — no prices, totals, VAT or bank details.
 */
import PDFDocument from 'pdfkit';
import { formatQty, type PublicDeliveryNote } from '@/lib/customers/delivery-note';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 40;
const MARGIN_TOP = 28;
const FOOTER_H = 40;
const MARGIN_BOTTOM = FOOTER_H + 8;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';

function withOpenMargins(doc: PDFKit.PDFDocument, fn: () => void) {
  const page = doc.page;
  const saved = {
    top: page.margins.top,
    bottom: page.margins.bottom,
    left: page.margins.left,
    right: page.margins.right,
  };
  page.margins.top = 0;
  page.margins.bottom = 0;
  page.margins.left = 0;
  page.margins.right = 0;
  try {
    fn();
  } finally {
    page.margins.top = saved.top;
    page.margins.bottom = saved.bottom;
    page.margins.left = saved.left;
    page.margins.right = saved.right;
  }
}

function drawTopBar(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rect(0, 0, PAGE_W, 5).fill(BRAND);
  doc.rect(0, 0, PAGE_W * 0.42, 5).fill(BRAND_DEEP);
  doc.restore();
}

function drawFooter(doc: PDFKit.PDFDocument, page: number, pages: number) {
  withOpenMargins(doc, () => {
    const barY = PAGE_H - FOOTER_H;
    doc.save();
    doc.rect(0, barY, PAGE_W, FOOTER_H).fill('#0f172a');
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Powered by SupplierAdvisor®', MARGIN_X, barY + 10, {
        width: CONTENT_W * 0.62,
        lineBreak: false,
      });
    doc
      .fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(7)
      .text('Delivery note · quantities only', MARGIN_X, barY + 22, {
        width: CONTENT_W * 0.62,
        lineBreak: false,
      });
    doc
      .fillColor(BRAND)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(pages > 1 ? `Page ${page} of ${pages}` : 'www.supplieradvisor.com', MARGIN_X, barY + 14, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });
    doc.restore();
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, need: number) {
  if (doc.y + need > CONTENT_BOTTOM - 2) {
    doc.addPage();
    doc.x = MARGIN_X;
    doc.y = MARGIN_TOP + 8;
    withOpenMargins(doc, () => drawTopBar(doc));
  }
}

export function deliveryNotePdfFilename(number: string): string {
  const safe = String(number || 'delivery-note')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72);
  return `delivery-note-${safe}.pdf`;
}

export async function buildDeliveryNotePdf(note: PublicDeliveryNote): Promise<Buffer> {
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
        Title: `Delivery note ${note.number}`,
        Author: note.sellerName || 'SupplierAdvisor®',
        Subject: `Delivery note for ${note.customerName}`,
        Creator: 'SupplierAdvisor®',
      },
      bufferPages: true,
      autoFirstPage: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    withOpenMargins(doc, () => drawTopBar(doc));
    doc.x = MARGIN_X;
    doc.y = MARGIN_TOP + 10;

    const initial = (note.sellerName || 'S').trim().charAt(0).toUpperCase() || 'S';
    doc.save();
    doc.roundedRect(MARGIN_X, doc.y, 28, 28, 6).fill(BRAND);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text(initial, MARGIN_X, doc.y + 7, {
      width: 28,
      align: 'center',
      lineBreak: false,
    });
    doc.restore();

    doc.fillColor(BRAND_DEEP).font('Helvetica-Bold').fontSize(8).text('DELIVERY NOTE', MARGIN_X + 36, doc.y, {
      characterSpacing: 0.6,
      lineBreak: false,
    });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(note.number, MARGIN_X + 36, doc.y + 12, {
      width: 250,
      lineBreak: false,
    });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(
      note.partial ? 'Partial delivery · quantities only' : 'Quantities and units only · not a tax invoice',
      MARGIN_X + 36,
      doc.y + 32,
      { width: 260, lineBreak: false }
    );

    const sellerX = MARGIN_X + CONTENT_W * 0.55;
    const sellerW = CONTENT_W * 0.45;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(note.sellerName || 'Seller', sellerX, MARGIN_TOP + 10, {
      width: sellerW,
      align: 'right',
      lineBreak: false,
    });
    let sy = MARGIN_TOP + 24;
    for (const line of [note.sellerAddress, note.sellerEmail, note.sellerPhone]) {
      if (!line) continue;
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(line, sellerX, sy, {
        width: sellerW,
        align: 'right',
        lineBreak: false,
      });
      sy += 11;
    }

    doc.y = Math.max(MARGIN_TOP + 58, sy + 8);
    doc.save();
    doc.roundedRect(MARGIN_X, doc.y, CONTENT_W, 22, 6).fill('#f0f9ff');
    doc.fillColor('#0e7490').font('Helvetica-Bold').fontSize(8).text(
      'This delivery note is not a tax invoice. It shows goods delivered, with no prices.',
      MARGIN_X + 8,
      doc.y + 7,
      { width: CONTENT_W - 16, lineBreak: false }
    );
    doc.restore();
    doc.y += 32;

    const cardY = doc.y;
    const cardW = (CONTENT_W - 10) / 2;
    const cardH = 78;
    doc.save();
    doc.roundedRect(MARGIN_X, cardY, cardW, cardH, 8).fill('#f8fafc');
    doc.roundedRect(MARGIN_X + cardW + 10, cardY, cardW, cardH, 8).fill('#f8fafc');
    doc.restore();
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text('DELIVER TO', MARGIN_X + 8, cardY + 8, {
      lineBreak: false,
    });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(note.customerName, MARGIN_X + 8, cardY + 20, {
      width: cardW - 16,
      lineBreak: false,
    });
    const deliverBits = [note.contactName, note.deliveryAddress].filter(Boolean).join(' · ');
    if (deliverBits) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(deliverBits, MARGIN_X + 8, cardY + 36, {
        width: cardW - 16,
        height: 32,
        ellipsis: true,
      });
    }
    const metaX = MARGIN_X + cardW + 18;
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text('DELIVERY', metaX, cardY + 8, {
      lineBreak: false,
    });
    const meta: Array<[string, string]> = [
      ['Date', note.deliveryDate || '—'],
      ['Invoice', note.invoiceNumber || '—'],
      ['Driver', note.deliveredBy || '—'],
      ['Vehicle', note.vehicleReg || '—'],
    ];
    meta.forEach((row, i) => {
      const y = cardY + 22 + i * 13;
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(row[0], metaX, y, { width: 52, lineBreak: false });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(8).text(row[1], metaX + 54, y, {
        width: cardW - 78,
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc.y = cardY + cardH + 14;
    doc.x = MARGIN_X;

    const cols = { idx: 22, desc: CONTENT_W - 22 - 70 - 70 - 54, inv: 70, del: 70, unit: 54 };
    ensureSpace(doc, 28);
    const headerY = doc.y;
    doc.moveTo(MARGIN_X, headerY + 12).lineTo(MARGIN_X + CONTENT_W, headerY + 12).strokeColor(INK).lineWidth(1).stroke();
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5);
    let hx = MARGIN_X;
    doc.text('#', hx, headerY, { width: cols.idx, lineBreak: false });
    hx += cols.idx;
    doc.text('DESCRIPTION', hx, headerY, { width: cols.desc, lineBreak: false });
    hx += cols.desc;
    doc.text('INVOICED', hx, headerY, { width: cols.inv, align: 'right', lineBreak: false });
    hx += cols.inv;
    doc.text('DELIVERED', hx, headerY, { width: cols.del, align: 'right', lineBreak: false });
    hx += cols.del;
    doc.text('UNIT', hx, headerY, { width: cols.unit, align: 'right', lineBreak: false });
    doc.y = headerY + 18;

    note.lines.forEach((line, i) => {
      ensureSpace(doc, 18);
      const rowY = doc.y;
      if (i % 2 === 1) {
        doc.save();
        doc.rect(MARGIN_X, rowY - 2, CONTENT_W, 16).fill('#f8fafc');
        doc.restore();
      }
      let x = MARGIN_X;
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(String(i + 1), x, rowY, {
        width: cols.idx,
        lineBreak: false,
      });
      x += cols.idx;
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(line.name, x, rowY, {
        width: cols.desc - 4,
        lineBreak: false,
        ellipsis: true,
      });
      x += cols.desc;
      doc.font('Helvetica').text(formatQty(line.invoicedQty), x, rowY, {
        width: cols.inv,
        align: 'right',
        lineBreak: false,
      });
      x += cols.inv;
      doc.font('Helvetica-Bold').text(formatQty(line.deliveredQty), x, rowY, {
        width: cols.del,
        align: 'right',
        lineBreak: false,
      });
      x += cols.del;
      doc.font('Helvetica').fillColor(MUTED).text(line.uom || 'unit', x, rowY, {
        width: cols.unit,
        align: 'right',
        lineBreak: false,
      });
      doc.y = rowY + 16;
    });

    if (note.notes) {
      ensureSpace(doc, 36);
      doc.y += 8;
      doc.fillColor(BRAND_DEEP).font('Helvetica-Bold').fontSize(8).text('NOTES', MARGIN_X, doc.y, {
        lineBreak: false,
      });
      doc.y += 12;
      doc.fillColor(INK).font('Helvetica').fontSize(9).text(note.notes, MARGIN_X, doc.y, {
        width: CONTENT_W,
      });
      doc.y += 8;
    }

    ensureSpace(doc, 78);
    doc.y += 12;
    const boxW = (CONTENT_W - 16) / 3;
    const boxY = doc.y;
    const labels: Array<[string, string]> = [
      ['RECEIVED BY', note.receivedByName || ''],
      ['SIGNATURE', ''],
      ['DATE', note.receivedByDate || ''],
    ];
    labels.forEach((entry, i) => {
      const x = MARGIN_X + i * (boxW + 8);
      doc.save();
      doc.roundedRect(x, boxY, boxW, 58, 6).dash(2, { space: 2 }).strokeColor('#94a3b8').stroke();
      doc.undash();
      doc.restore();
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text(entry[0], x + 8, boxY + 8, {
        width: boxW - 16,
        lineBreak: false,
      });
      doc.fillColor(INK).font('Helvetica').fontSize(10).text(entry[1], x + 8, boxY + 32, {
        width: boxW - 16,
        lineBreak: false,
      });
      doc.moveTo(x + 8, boxY + 46).lineTo(x + boxW - 8, boxY + 46).strokeColor(INK).lineWidth(0.6).stroke();
    });
    doc.y = boxY + 70;

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      withOpenMargins(doc, () => drawTopBar(doc));
      drawFooter(doc, i + 1, range.count);
    }
    doc.end();
  });
}
