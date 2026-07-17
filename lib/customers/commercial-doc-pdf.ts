/**
 * Beautiful A4 commercial PDF (quotation / sales order / tax invoice).
 * Pure pdfkit — works on Vercel serverless.
 *
 * IMPORTANT: Never write text inside bottom/top margin zones while margins are
 * active — PDFKit auto-adds blank pages (classic doubled-length bug). Footer
 * and top bar always use withOpenMargins().
 */
import PDFDocument from 'pdfkit';
import { formatMoney, type DocLineItem } from '@/lib/customers/documents';
import type { DocRenderInput, SellerProfile } from '@/lib/customers/invoice-document';
import {
  fetchQrPngBuffer,
  invoiceRateClaimUrls,
  rateSellerPublicUrl,
  registerBusinessUrl,
} from '@/lib/customers/commercial-doc-links';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 40;
/** Body starts below brand strip */
const MARGIN_TOP = 28;
/** Reserve strip for footer — body must stop above this */
const FOOTER_H = 40;
const MARGIN_BOTTOM = FOOTER_H + 8;
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

/**
 * Draw in margin zones without PDFKit creating a new page.
 */
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
  if (doc.y + need > CONTENT_BOTTOM - 2) {
    doc.addPage();
    doc.x = MARGIN_X;
    doc.y = MARGIN_TOP + 8;
    withOpenMargins(doc, () => drawTopBar(doc));
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
        width: CONTENT_W * 0.55,
        lineBreak: false,
      });
    doc
      .fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(7)
      .text('Trade network · OTIFEF · quality & claims', MARGIN_X, barY + 22, {
        width: CONTENT_W * 0.55,
        lineBreak: false,
      });
    const pageLabel = pages > 1 ? `Page ${page} of ${pages}` : 'www.supplieradvisor.com';
    doc
      .fillColor(BRAND)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(pageLabel, MARGIN_X, barY + 10, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });
    if (pages > 1) {
      doc
        .fillColor('#7dd3fc')
        .font('Helvetica')
        .fontSize(7)
        .text('www.supplieradvisor.com', MARGIN_X, barY + 22, {
          width: CONTENT_W,
          align: 'right',
          lineBreak: false,
        });
    }
    doc.restore();
  });
}

/** Fixed-height card using absolute text (no flow side-effects). */
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
  doc.roundedRect(x, y, w, h, 7).fill(SOFT);
  doc.roundedRect(x, y, w, h, 7).strokeColor(LINE).lineWidth(0.7).stroke();
  doc
    .fillColor(MUTED)
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .text(title.toUpperCase(), x + 9, y + 7, {
      width: w - 18,
      characterSpacing: 0.5,
      lineBreak: false,
    });
  let ty = y + 20;
  const maxLines = 4;
  let drawn = 0;
  for (let i = 0; i < lines.length && drawn < maxLines; i++) {
    const t = String(lines[i] || '').trim();
    if (!t) continue;
    const isFirst = drawn === 0;
    doc
      .fillColor(isFirst ? INK : MUTED)
      .font(isFirst ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isFirst ? 9.5 : 8)
      .text(t.slice(0, 80), x + 9, ty, {
        width: w - 18,
        lineBreak: false,
        ellipsis: true,
      });
    ty += isFirst ? 13 : 11;
    drawn += 1;
  }
  doc.restore();
}

type QrPair = {
  left: { title: string; body: string; url: string; buf: Buffer | null };
  right: { title: string; body: string; url: string; buf: Buffer | null };
  kicker: string;
  headline: string;
};

async function loadNetworkQrs(input: DocRenderInput): Promise<QrPair | null> {
  const companyId = Number(input.companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  const sellerName =
    input.seller.trading_name || input.seller.legal_name || 'this supplier';

  if (input.kind === 'quote' || input.kind === 'order') {
    const registerUrl = registerBusinessUrl({ referrerProfileId: companyId });
    const rateUrl = rateSellerPublicUrl(companyId);
    const [regBuf, rateBuf] = await Promise.all([
      fetchQrPngBuffer(registerUrl, 120),
      fetchQrPngBuffer(rateUrl, 120),
    ]);
    return {
      kicker: 'SUPPLIERADVISOR NETWORK',
      headline: 'Join free · rate this supplier',
      left: {
        title: 'Register your business',
        body: 'Free profile on supplieradvisor.com',
        url: registerUrl,
        buf: regBuf,
      },
      right: {
        title: `Rate ${String(sellerName).slice(0, 28)}`,
        body: 'Trust · connect · public profile',
        url: rateUrl,
        buf: rateBuf,
      },
    };
  }

  if (input.kind === 'invoice') {
    const urls = invoiceRateClaimUrls({
      companyId,
      documentId: Number(input.documentId),
      number: input.number,
    });
    if (!urls) return null;
    const [rateBuf, claimBuf] = await Promise.all([
      fetchQrPngBuffer(urls.rateUrl, 120),
      fetchQrPngBuffer(urls.claimUrl, 120),
    ]);
    return {
      kicker: 'AFTER DELIVERY',
      headline: 'Rate us · log an issue',
      left: {
        title: 'Rate performance (OTIFEF)',
        body: 'On-time · in-full · quality',
        url: urls.rateUrl,
        buf: rateBuf,
      },
      right: {
        title: 'Log a claim / RIAD',
        body: 'Risk, issue, action, decision',
        url: urls.claimUrl,
        buf: claimBuf,
      },
    };
  }

  return null;
}

function drawNetworkPanel(
  doc: PDFKit.PDFDocument,
  y: number,
  pair: QrPair
): number {
  const h = 92;
  const pad = 8;
  const qrSize = 48;
  const half = (CONTENT_W - 8) / 2;

  doc.save();
  // Brand panel matching HTML feedback block
  doc.roundedRect(MARGIN_X, y, CONTENT_W, h, 8).fill('#0c4a6e');
  doc
    .fillColor('#7dd3fc')
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .text(pair.kicker, MARGIN_X + pad, y + 6, {
      characterSpacing: 0.6,
      lineBreak: false,
    });
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(pair.headline, MARGIN_X + pad, y + 16, {
      width: CONTENT_W - pad * 2,
      lineBreak: false,
    });

  const cardY = y + 30;
  const cardH = h - 36;
  const cards = [pair.left, pair.right];
  cards.forEach((c, i) => {
    const cx = MARGIN_X + pad + i * (half + 8);
    doc.roundedRect(cx, cardY, half - pad, cardH, 6).fill('#075985');

    // White plate behind QR for scanner contrast
    doc.roundedRect(cx + 5, cardY + 5, qrSize + 4, qrSize + 4, 4).fill('#ffffff');
    if (c.buf) {
      try {
        doc.image(c.buf, cx + 7, cardY + 7, {
          width: qrSize,
          height: qrSize,
        });
      } catch {
        doc
          .fillColor(MUTED)
          .font('Helvetica')
          .fontSize(6)
          .text('QR', cx + 7, cardY + 26, {
            width: qrSize,
            align: 'center',
            lineBreak: false,
          });
      }
    } else {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(6)
        .text('QR', cx + 7, cardY + 26, {
          width: qrSize,
          align: 'center',
          lineBreak: false,
        });
    }

    const tx = cx + 7 + qrSize + 8;
    const tw = half - pad - qrSize - 22;
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(c.title, tx, cardY + 10, { width: tw, lineBreak: false });
    doc
      .fillColor('#bae6fd')
      .font('Helvetica')
      .fontSize(6.5)
      .text(c.body, tx, cardY + 22, { width: tw, lineBreak: false });
    doc
      .fillColor('#e0f2fe')
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text('Scan QR →', tx, cardY + 36, {
        width: tw,
        lineBreak: false,
      });
  });
  doc.restore();
  return y + h;
}

/**
 * Render DocRenderInput to a PDF Buffer — one page when content fits.
 */
export async function buildCommercialDocumentPdf(
  input: DocRenderInput
): Promise<Buffer> {
  const ccy = input.currency || input.seller.primary_currency || 'ZAR';
  const sellerName =
    input.seller.trading_name || input.seller.legal_name || 'Supplier';
  const kindLabel = KIND_LABEL[input.kind];
  const items = (input.items || []).filter((l) => l?.name);

  // Compact terms for quotes so typical docs stay single-page
  const quoteTermsShort =
    'Prices valid until the date shown (if any). Subject to stock availability and order confirmation. E&OE.';

  // Prefetch QR PNGs before opening the PDF stream
  const networkQrs = await loadNetworkQrs(input);

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

    withOpenMargins(doc, () => drawTopBar(doc));
    doc.x = MARGIN_X;
    doc.y = MARGIN_TOP + 6;

    // ── Hero (two columns, absolute Y tracking) ───────────────────────
    const leftX = MARGIN_X;
    const rightX = MARGIN_X + CONTENT_W * 0.54;
    const rightW = CONTENT_W * 0.46;
    const heroTop = doc.y;

    doc
      .fillColor(BRAND_DEEP)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(kindLabel, leftX, heroTop, {
        width: CONTENT_W * 0.5,
        characterSpacing: 1.1,
        lineBreak: false,
      });

    const numY = heroTop + 12;
    doc.font('Helvetica-Bold').fontSize(18);
    const numStr = String(input.number);
    const numW = Math.min(doc.widthOfString(numStr) + 8, CONTENT_W * 0.4);
    doc.fillColor(INK).text(numStr, leftX, numY, {
      width: CONTENT_W * 0.48,
      lineBreak: false,
    });

    if (input.seller.is_verified) {
      const badge = 'Verified';
      doc.font('Helvetica-Bold').fontSize(6.5);
      const bw = doc.widthOfString(badge) + 12;
      doc.roundedRect(leftX + numW, numY + 4, bw, 11, 5).fill('#ecfdf5');
      doc
        .fillColor('#047857')
        .text(badge, leftX + numW + 6, numY + 5.5, { lineBreak: false });
    }

    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text(`Status: ${input.status || '—'}`, leftX, numY + 22, {
        lineBreak: false,
      });

    // Seller (right) — fixed lines, no free-flow wrap that blows doc.y
    let sy = heroTop;
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(sellerName.slice(0, 48), rightX, sy, {
        width: rightW,
        align: 'right',
        lineBreak: false,
        ellipsis: true,
      });
    sy += 13;
    if (input.seller.legal_name && input.seller.legal_name !== sellerName) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text(String(input.seller.legal_name).slice(0, 50), rightX, sy, {
          width: rightW,
          align: 'right',
          lineBreak: false,
          ellipsis: true,
        });
      sy += 11;
    }
    const addr = sellerAddress(input.seller);
    if (addr) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text(addr.slice(0, 70), rightX, sy, {
          width: rightW,
          align: 'right',
          lineBreak: false,
          ellipsis: true,
        });
      sy += 11;
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
        .fontSize(7.5)
        .text(sellerContact.slice(0, 55), rightX, sy, {
          width: rightW,
          align: 'right',
          lineBreak: false,
          ellipsis: true,
        });
      sy += 11;
    }
    if (input.seller.vat_number) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text(`VAT ${input.seller.vat_number}`, rightX, sy, {
          width: rightW,
          align: 'right',
          lineBreak: false,
        });
      sy += 11;
    }
    if (input.seller.registration_number) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text(`Reg ${input.seller.registration_number}`, rightX, sy, {
          width: rightW,
          align: 'right',
          lineBreak: false,
        });
      sy += 11;
    }

    doc.y = Math.max(numY + 36, sy) + 10;
    doc.x = MARGIN_X;

    // ── Party cards ───────────────────────────────────────────────────
    const cardH = 68;
    const cardW = (CONTENT_W - 10) / 2;
    const cardY = doc.y;

    card(doc, MARGIN_X, cardY, cardW, cardH, 'Bill to', [
      input.customerName || 'Customer',
      input.contactName || '',
      input.contactEmail || '',
      input.contactPhone || '',
    ]);

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
    card(doc, MARGIN_X + cardW + 10, cardY, cardW, cardH, 'Document', metaLines);

    // card() uses absolute coords — pin y after cards
    doc.y = cardY + cardH + 10;
    doc.x = MARGIN_X;

    // Quote validity strip
    if (input.kind === 'quote') {
      const cy = doc.y;
      doc.save();
      doc.roundedRect(MARGIN_X, cy, CONTENT_W, 20, 5).fill('#e0f7fc');
      doc
        .fillColor(BRAND_DEEP)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(
          input.validUntil
            ? `Valid until ${String(input.validUntil).slice(0, 10)} · Prices subject to stock availability`
            : 'Prices subject to stock availability and order confirmation',
          MARGIN_X + 10,
          cy + 6,
          { width: CONTENT_W - 20, lineBreak: false }
        );
      doc.restore();
      doc.y = cy + 26;
    }

    // ── Line table ────────────────────────────────────────────────────
    const col = {
      idx: 20,
      desc: CONTENT_W - 20 - 48 - 72 - 72,
      qty: 48,
      unit: 72,
      amt: 72,
    };
    const headerY = doc.y;
    doc
      .moveTo(MARGIN_X, headerY + 12)
      .lineTo(MARGIN_X + CONTENT_W, headerY + 12)
      .strokeColor(INK)
      .lineWidth(1)
      .stroke();

    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7);
    let hx = MARGIN_X;
    doc.text('#', hx, headerY, { width: col.idx, lineBreak: false });
    hx += col.idx;
    doc.text('DESCRIPTION', hx, headerY, { width: col.desc, lineBreak: false });
    hx += col.desc;
    doc.text('QTY', hx, headerY, {
      width: col.qty,
      align: 'right',
      lineBreak: false,
    });
    hx += col.qty;
    doc.text('UNIT', hx, headerY, {
      width: col.unit,
      align: 'right',
      lineBreak: false,
    });
    hx += col.unit;
    doc.text('AMOUNT', hx, headerY, {
      width: col.amt,
      align: 'right',
      lineBreak: false,
    });

    doc.y = headerY + 16;

    items.forEach((line: DocLineItem, i: number) => {
      ensureSpace(doc, 18);
      const rowY = doc.y;
      const name = String(line.name || 'Line').slice(0, 60);
      const qty = `${Number(line.quantity || 0)}${line.uom ? ` ${line.uom}` : ''}`;
      const unit = money(Number(line.unit_price || 0), ccy);
      const amt = money(Number(line.line_total || 0), ccy);

      if (i % 2 === 1) {
        doc.save();
        doc.rect(MARGIN_X, rowY - 1, CONTENT_W, 16).fill('#f8fafc');
        doc.restore();
      }

      let x = MARGIN_X;
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8.5)
        .text(String(i + 1), x, rowY, { width: col.idx, lineBreak: false });
      x += col.idx;
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(name, x, rowY, {
          width: col.desc - 2,
          lineBreak: false,
          ellipsis: true,
        });
      x += col.desc;
      doc
        .fillColor(INK)
        .font('Helvetica')
        .fontSize(8.5)
        .text(qty, x, rowY, { width: col.qty, align: 'right', lineBreak: false });
      x += col.qty;
      doc.text(unit, x, rowY, {
        width: col.unit,
        align: 'right',
        lineBreak: false,
      });
      x += col.unit;
      doc
        .font('Helvetica-Bold')
        .text(amt, x, rowY, {
          width: col.amt,
          align: 'right',
          lineBreak: false,
        });

      doc.y = rowY + 17;
    });

    if (!items.length) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8.5)
        .text('No line items', MARGIN_X, doc.y, { lineBreak: false });
      doc.y += 14;
    }

    // ── Totals (absolute box — does not rely on flowing text height) ──
    ensureSpace(doc, 78);
    const boxW = 190;
    const boxX = MARGIN_X + CONTENT_W - boxW;
    const boxY = doc.y + 2;
    doc.save();
    doc.roundedRect(boxX, boxY, boxW, 64, 8).fill('#f0f9ff');
    doc
      .roundedRect(boxX, boxY, boxW, 64, 8)
      .strokeColor('#bae6fd')
      .lineWidth(0.9)
      .stroke();
    doc
      .fillColor('#334155')
      .font('Helvetica')
      .fontSize(8.5)
      .text('Subtotal', boxX + 10, boxY + 8, { width: 80, lineBreak: false });
    doc.text(money(input.subtotal, ccy), boxX + 10, boxY + 8, {
      width: boxW - 20,
      align: 'right',
      lineBreak: false,
    });
    doc.text(`Tax (${input.taxRate}%)`, boxX + 10, boxY + 22, {
      width: 80,
      lineBreak: false,
    });
    doc.text(money(input.taxAmount, ccy), boxX + 10, boxY + 22, {
      width: boxW - 20,
      align: 'right',
      lineBreak: false,
    });
    doc
      .moveTo(boxX + 10, boxY + 38)
      .lineTo(boxX + boxW - 10, boxY + 38)
      .strokeColor(BRAND_DEEP)
      .lineWidth(1.2)
      .stroke();
    doc
      .fillColor(BRAND_DEEP)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(input.kind === 'quote' ? 'Total' : 'Total due', boxX + 10, boxY + 44, {
        width: 80,
        lineBreak: false,
      });
    doc.text(money(input.totalAmount, ccy), boxX + 10, boxY + 44, {
      width: boxW - 20,
      align: 'right',
      lineBreak: false,
    });
    doc.restore();
    doc.y = boxY + 72;
    doc.x = MARGIN_X;

    // ── Bank (invoices only) ──────────────────────────────────────────
    if (input.kind === 'invoice') {
      const s = input.seller;
      const bankRows: Array<[string, string]> = (
        [
          ['Bank', s.bank_name || ''],
          ['Account name', s.account_name || ''],
          ['Account number', s.account_number || ''],
          ['Branch code', s.branch_code || ''],
          ['IBAN', s.iban || ''],
          ['SWIFT', s.swift || ''],
        ] as Array<[string, string]>
      ).filter(([, v]) => v && String(v).trim());

      const bh = Math.max(40, 24 + bankRows.length * 11 + (bankRows.length ? 12 : 0));
      ensureSpace(doc, bh + 8);
      const by = doc.y;
      doc.save();
      doc.roundedRect(MARGIN_X, by, CONTENT_W, bh, 7).fill('#ecfeff');
      doc
        .roundedRect(MARGIN_X, by, CONTENT_W, bh, 7)
        .strokeColor('#7dd3fc')
        .lineWidth(0.9)
        .stroke();
      doc
        .fillColor(BRAND_DEEP)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('BANK DETAILS FOR PAYMENT', MARGIN_X + 10, by + 7, {
          characterSpacing: 0.4,
          lineBreak: false,
        });
      let ty = by + 20;
      if (!bankRows.length) {
        doc
          .fillColor('#92400e')
          .font('Helvetica')
          .fontSize(8)
          .text(
            'Bank details not set — contact the seller for EFT instructions.',
            MARGIN_X + 10,
            ty,
            { width: CONTENT_W - 20, lineBreak: false }
          );
      } else {
        for (const [k, v] of bankRows) {
          doc
            .fillColor(MUTED)
            .font('Helvetica')
            .fontSize(7.5)
            .text(k, MARGIN_X + 10, ty, { width: 95, lineBreak: false });
          doc
            .fillColor(INK)
            .font('Helvetica-Bold')
            .fontSize(8)
            .text(v, MARGIN_X + 110, ty, {
              width: CONTENT_W - 130,
              lineBreak: false,
            });
          ty += 11;
        }
        doc
          .fillColor('#0369a1')
          .font('Helvetica')
          .fontSize(7)
          .text(
            `Use invoice number ${input.number} as your payment reference.`,
            MARGIN_X + 10,
            ty + 1,
            { width: CONTENT_W - 20, lineBreak: false }
          );
      }
      doc.restore();
      doc.y = by + bh + 8;
    }

    // ── Terms / notes (height-checked, never overflow margin) ─────────
    const terms =
      input.terms ||
      (input.kind === 'quote'
        ? quoteTermsShort
        : input.kind === 'invoice'
          ? input.paymentTerms
            ? String(input.paymentTerms).slice(0, 420)
            : null
          : null);

    if (terms) {
      const label =
        input.kind === 'invoice' ? 'PAYMENT TERMS' : 'TERMS';
      doc.font('Helvetica').fontSize(7.5);
      const th = Math.min(
        doc.heightOfString(String(terms), { width: CONTENT_W, lineGap: 1 }),
        48
      );
      ensureSpace(doc, 14 + th + 6);
      doc
        .fillColor(BRAND_DEEP)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(label, MARGIN_X, doc.y, {
          characterSpacing: 0.4,
          lineBreak: false,
        });
      doc.y += 11;
      // Clamp so we never write past CONTENT_BOTTOM
      const maxH = Math.max(8, CONTENT_BOTTOM - doc.y - 4);
      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(7.5)
        .text(String(terms), MARGIN_X, doc.y, {
          width: CONTENT_W,
          lineGap: 1,
          height: maxH,
          ellipsis: true,
        });
      doc.y += Math.min(th, maxH) + 4;
    }

    if (input.notes) {
      const note = String(input.notes).slice(0, 280);
      doc.font('Helvetica').fontSize(7.5);
      const nh = Math.min(
        doc.heightOfString(note, { width: CONTENT_W, lineGap: 1 }),
        36
      );
      if (doc.y + 14 + nh < CONTENT_BOTTOM - 2) {
        doc
          .fillColor(BRAND_DEEP)
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .text('NOTES', MARGIN_X, doc.y, {
            characterSpacing: 0.4,
            lineBreak: false,
          });
        doc.y += 11;
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(7.5)
          .text(note, MARGIN_X, doc.y, {
            width: CONTENT_W,
            lineGap: 1,
            height: nh + 2,
            ellipsis: true,
          });
        doc.y += nh + 4;
      }
    }

    // Closing — only if room (no new page for a thank-you)
    if (input.kind === 'quote' && doc.y + 14 < CONTENT_BOTTOM - 100) {
      doc.y += 2;
      doc
        .fillColor(MUTED)
        .font('Helvetica-Oblique')
        .fontSize(7.5)
        .text(
          'Thank you for the opportunity to quote. We look forward to doing business with you.',
          MARGIN_X,
          doc.y,
          { width: CONTENT_W, align: 'center', lineBreak: false }
        );
      doc.y += 12;
    }

    // Network QR panel (register + rate on quotes; rate + claim on invoices)
    // Prefer same page when it fits; otherwise last page with ensureSpace.
    if (networkQrs) {
      const panelH = 92;
      if (doc.y + panelH + 4 > CONTENT_BOTTOM) {
        // Only add a page if content already filled this one
        if (doc.y > MARGIN_TOP + 120) {
          ensureSpace(doc, panelH + 4);
        } else {
          // Squeeze: shrink by skipping thank-you space already used
          doc.y = Math.min(doc.y, CONTENT_BOTTOM - panelH - 2);
        }
      }
      if (doc.y + panelH <= CONTENT_BOTTOM + 1) {
        const endY = drawNetworkPanel(doc, doc.y, networkQrs);
        doc.y = endY + 2;
      }
    }

    // Stamp chrome on every real page (footer uses open margins — no blanks)
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      withOpenMargins(doc, () => drawTopBar(doc));
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
