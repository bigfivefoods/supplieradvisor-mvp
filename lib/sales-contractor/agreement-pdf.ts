/**
 * Generate a clean multi-page A4 PDF of the Independent Sales Contractor Agreement.
 * Uses pdfkit (pure Node — works on Vercel serverless).
 *
 * Header/footer are drawn on the *same* pages as body content. We never write
 * text inside the bottom margin while margins are active (that creates blank
 * extra pages — the classic PDFKit "doubled length" bug).
 */
import PDFDocument from 'pdfkit';
import {
  SALES_CONTRACTOR_CONTRACT_TITLE,
  SALES_CONTRACTOR_CONTRACT_VERSION,
  type AgreementDownloadMeta,
} from './agreement';

type Block =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string }
  | { kind: 'callout'; text: string }
  | { kind: 'table'; rows: string[][] };

// A4 points: 595.28 × 841.89
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 50;
/** Top of body area (below running header on page 2+) */
const MARGIN_TOP = 54;
/** Reserved bottom strip for footer — body must stop above this */
const MARGIN_BOTTOM = 48;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
/** Last Y body content may use */
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM;
/** Footer baseline (inside the reserved bottom strip) */
const FOOTER_Y = PAGE_H - 28;
const HEADER_Y = 28;

function decodeEntities(s: string): string {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Parse agreement body HTML into linear blocks for PDF layout. */
export function htmlBodyToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const src = String(html || '');

  const re = /<(h[1-6]|p|li|div|table|tr)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((m = re.exec(src)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const inner = m[3] || '';

    if (tag === 'table') {
      const rows: string[][] = [];
      const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let tr: RegExpExecArray | null;
      while ((tr = trRe.exec(inner)) !== null) {
        const cells: string[] = [];
        const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
        let c: RegExpExecArray | null;
        while ((c = cellRe.exec(tr[1])) !== null) {
          cells.push(stripTags(c[1]));
        }
        if (cells.length) rows.push(cells);
      }
      if (rows.length) {
        const key = `table:${rows.map((r) => r.join('|')).join(';')}`;
        if (!seen.has(key)) {
          seen.add(key);
          blocks.push({ kind: 'table', rows });
        }
      }
      continue;
    }

    if (tag === 'tr') continue;

    const text = stripTags(inner);
    if (!text) continue;

    const key = `${tag}:${text.slice(0, 120)}`;
    if (seen.has(key) && tag !== 'li') continue;
    seen.add(key);

    if (/^h[1-6]$/.test(tag)) {
      blocks.push({ kind: 'h', text });
      continue;
    }
    if (tag === 'li') {
      blocks.push({ kind: 'li', text });
      continue;
    }
    if (
      tag === 'div' &&
      /rose|amber|border-2|font-black uppercase|Important|anti.?mlm|not multi-level/i.test(
        attrs + inner
      )
    ) {
      const innerPs = [...inner.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(
        (x) => stripTags(x[1])
      );
      const calloutText = innerPs.filter(Boolean).join(' ') || text;
      if (calloutText) blocks.push({ kind: 'callout', text: calloutText });
      continue;
    }
    if (tag === 'p') {
      blocks.push({ kind: 'p', text });
      continue;
    }
    if (tag === 'div' && text.length > 40 && !/<div\b/i.test(inner)) {
      blocks.push({ kind: 'p', text });
    }
  }

  if (blocks.length < 5) {
    const plain = stripTags(src);
    for (const para of plain.split(/\n{2,}/)) {
      const t = para.trim();
      if (t) blocks.push({ kind: 'p', text: t });
    }
  }

  return blocks;
}

/**
 * Draw in the header/footer zone without PDFKit creating a new page.
 * Writing inside bottom margin with margins active is what doubles page count.
 */
function withOpenMargins(
  doc: PDFKit.PDFDocument,
  fn: () => void
) {
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

function drawRunningHeader(
  doc: PDFKit.PDFDocument,
  companyName: string,
  version: string
) {
  withOpenMargins(doc, () => {
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#64748b')
      .text('SupplierAdvisor® · Sales contractor agreement', MARGIN_X, HEADER_Y, {
        width: CONTENT_W * 0.62,
        lineBreak: false,
      });
    doc.text(
      `${companyName} · ${version}`.slice(0, 60),
      MARGIN_X,
      HEADER_Y,
      {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      }
    );
    doc
      .moveTo(MARGIN_X, HEADER_Y + 12)
      .lineTo(MARGIN_X + CONTENT_W, HEADER_Y + 12)
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();
  });
}

function drawRunningFooter(
  doc: PDFKit.PDFDocument,
  pageNum: number,
  pageCount: number | null
) {
  withOpenMargins(doc, () => {
    doc
      .moveTo(MARGIN_X, FOOTER_Y - 10)
      .lineTo(MARGIN_X + CONTENT_W, FOOTER_Y - 10)
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#94a3b8')
      .text(
        'Confidential · Sole agreement & NDA · Laws of the Republic of South Africa',
        MARGIN_X,
        FOOTER_Y - 4,
        { width: CONTENT_W - 80, lineBreak: false }
      );
    const label =
      pageCount != null
        ? `Page ${pageNum} of ${pageCount}`
        : `Page ${pageNum}`;
    doc.text(label, MARGIN_X, FOOTER_Y - 4, {
      width: CONTENT_W,
      align: 'right',
      lineBreak: false,
    });
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, need: number) {
  if (doc.y + need > CONTENT_BOTTOM - 4) {
    doc.addPage();
  }
}

function resetX(doc: PDFKit.PDFDocument) {
  doc.x = MARGIN_X;
}

function writeWrapped(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: {
    font?: string;
    size?: number;
    color?: string;
    width?: number;
    align?: 'left' | 'center' | 'justify';
    lineGap?: number;
    indent?: number;
  } = {}
) {
  const width = opts.width ?? CONTENT_W;
  doc
    .font(opts.font || 'Helvetica')
    .fontSize(opts.size ?? 9)
    .fillColor(opts.color || '#334155');

  // Estimate height and break page first so PDFKit doesn't auto-add mid-write
  const h = doc.heightOfString(text, {
    width,
    lineGap: opts.lineGap ?? 1.5,
  });
  ensureSpace(doc, Math.min(h, 40) + 4);
  resetX(doc);
  doc.text(text, MARGIN_X, doc.y, {
    width,
    align: opts.align || 'left',
    lineGap: opts.lineGap ?? 1.5,
    indent: opts.indent || 0,
  });
  resetX(doc);
}

/**
 * Build a multi-page A4 PDF buffer of the full agreement (draft or signed).
 */
export async function buildSalesAgreementPdf(params: {
  bodyHtml: string;
  meta: AgreementDownloadMeta;
}): Promise<Buffer> {
  const { bodyHtml, meta } = params;
  const version = meta.contractVersion || SALES_CONTRACTOR_CONTRACT_VERSION;
  const isSigned = meta.status === 'signed';
  const generated =
    meta.generatedAt ||
    new Date().toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const blocks = htmlBodyToBlocks(bodyHtml);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      // Body stays inside these margins; header/footer drawn with margins zeroed
      margins: {
        top: MARGIN_TOP,
        bottom: MARGIN_BOTTOM,
        left: MARGIN_X,
        right: MARGIN_X,
      },
      info: {
        Title: SALES_CONTRACTOR_CONTRACT_TITLE,
        Author: 'SupplierAdvisor',
        Subject: `${meta.companyName} — ${version}`,
        Creator: 'SupplierAdvisor Sales Portal',
      },
      bufferPages: true,
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Running chrome on every NEW page (pageAdded does not fire for page 1)
    doc.on('pageAdded', () => {
      drawRunningHeader(doc, meta.companyName, version);
      // Temporary page label; final "of N" stamped at end
      drawRunningFooter(doc, doc.bufferedPageRange().count, null);
      // Resume body below header
      doc.x = MARGIN_X;
      doc.y = MARGIN_TOP;
    });

    // ── Page 1 masthead (replaces running header on first page) ──
    // Draw first-page footer now so it's on the same page as content
    drawRunningFooter(doc, 1, null);

    doc.y = MARGIN_TOP;
    resetX(doc);

    doc
      .fillColor('#0077b6')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('SUPPLIERADVISOR®  ·  SALES CONTRACTOR PORTAL', MARGIN_X, doc.y, {
        width: CONTENT_W,
        characterSpacing: 0.8,
        lineBreak: false,
      });
    doc.y += 12;

    writeWrapped(doc, SALES_CONTRACTOR_CONTRACT_TITLE, {
      font: 'Helvetica-Bold',
      size: 11.5,
      color: '#0f172a',
      lineGap: 2,
    });

    doc.y += 2;
    writeWrapped(
      doc,
      `${meta.companyName}  ·  Version ${version}  ·  ${generated}`,
      { size: 8, color: '#64748b', lineGap: 1 }
    );

    // Status badge
    doc.y += 4;
    const badge = isSigned
      ? 'SIGNED COPY'
      : 'DRAFT — FOR REVIEW BEFORE ACCEPTANCE';
    const badgeColor = isSigned ? '#065f46' : '#92400e';
    const badgeBg = isSigned ? '#d1fae5' : '#fef3c7';
    doc.font('Helvetica-Bold').fontSize(7.5);
    const badgeW = Math.min(doc.widthOfString(badge) + 14, CONTENT_W);
    const badgeH = 14;
    ensureSpace(doc, badgeH + 12);
    const by = doc.y;
    doc.roundedRect(MARGIN_X, by, badgeW, badgeH, 4).fill(badgeBg);
    withOpenMargins(doc, () => {
      doc
        .fillColor(badgeColor)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(badge, MARGIN_X + 7, by + 3.5, {
          width: badgeW - 14,
          lineBreak: false,
        });
    });
    doc.y = by + badgeH + 8;
    resetX(doc);

    doc
      .moveTo(MARGIN_X, doc.y)
      .lineTo(MARGIN_X + CONTENT_W, doc.y)
      .strokeColor('#0f172a')
      .lineWidth(1.25)
      .stroke();
    doc.y += 10;
    resetX(doc);

    // ── Certificate / draft status box ────────────────────────
    const certLines: string[] = isSigned
      ? [
          'Certificate of electronic acceptance (ECTA)',
          `Status: SIGNED / ACCEPTED`,
          `Signatory: ${meta.signatureName || meta.contractorName || '—'}`,
          `Email: ${meta.signatureEmail || '—'}`,
          `Signed at: ${
            meta.signedAt
              ? new Date(meta.signedAt).toLocaleString('en-ZA', {
                  dateStyle: 'full',
                  timeStyle: 'medium',
                })
              : '—'
          }`,
          `Version: ${version}  ·  Agreement ID: ${
            meta.agreementId != null ? String(meta.agreementId) : '—'
          }`,
          `Company: ${meta.companyName}`,
          'Typed legal name + authentication records constitute the Contractor’s signature under ECTA 25 of 2002.',
        ]
      : [
          'Document status: NOT YET SIGNED',
          'This PDF is for review only. It is not a completed contract until the Contractor accepts electronically in the Sales Portal (checkbox + full legal name + secure sign-in).',
          `Proposed contractor: ${meta.contractorName}`,
          `Company: ${meta.companyName}`,
          `Version: ${version}  ·  Generated: ${generated}`,
        ];

    doc.font('Helvetica').fontSize(8);
    const certPad = 8;
    let certTextH = 0;
    for (let i = 0; i < certLines.length; i++) {
      const f = i === 0 ? 'Helvetica-Bold' : 'Helvetica';
      const sz = i === 0 ? 9.5 : 8;
      doc.font(f).fontSize(sz);
      certTextH +=
        doc.heightOfString(certLines[i], {
          width: CONTENT_W - certPad * 2 - 4,
        }) + (i === 0 ? 4 : 2);
    }
    const certBoxH = certTextH + certPad * 2;
    ensureSpace(doc, certBoxH + 10);
    const certY = doc.y;
    doc
      .roundedRect(MARGIN_X, certY, CONTENT_W, certBoxH, 5)
      .fillAndStroke(
        isSigned ? '#f8fafc' : '#fffbeb',
        isSigned ? '#0f172a' : '#d97706'
      );
    doc
      .rect(MARGIN_X, certY, 4, certBoxH)
      .fill(isSigned ? '#0f172a' : '#d97706');

    let cy = certY + certPad;
    for (let i = 0; i < certLines.length; i++) {
      const f = i === 0 ? 'Helvetica-Bold' : 'Helvetica';
      const sz = i === 0 ? 9.5 : 8;
      const col =
        i === 0
          ? isSigned
            ? '#0f172a'
            : '#92400e'
          : i === certLines.length - 1 && isSigned
            ? '#64748b'
            : '#334155';
      doc.font(f).fontSize(sz).fillColor(col);
      const lineH = doc.heightOfString(certLines[i], {
        width: CONTENT_W - certPad * 2 - 4,
      });
      doc.text(certLines[i], MARGIN_X + certPad + 4, cy, {
        width: CONTENT_W - certPad * 2 - 4,
        lineBreak: true,
      });
      cy += lineH + (i === 0 ? 4 : 2);
    }
    doc.y = certY + certBoxH + 12;
    resetX(doc);

    // ── Agreement body ────────────────────────────────────────
    for (const block of blocks) {
      if (block.kind === 'h') {
        ensureSpace(doc, 28);
        doc.y += 6;
        writeWrapped(doc, block.text.toUpperCase(), {
          font: 'Helvetica-Bold',
          size: 9.5,
          color: '#0f172a',
          lineGap: 1,
        });
        const lineY = doc.y + 1;
        if (lineY < CONTENT_BOTTOM) {
          doc
            .moveTo(MARGIN_X, lineY)
            .lineTo(MARGIN_X + CONTENT_W, lineY)
            .strokeColor('#cbd5e1')
            .lineWidth(0.5)
            .stroke();
        }
        doc.y = lineY + 6;
        resetX(doc);
        continue;
      }

      if (block.kind === 'callout') {
        const pad = 7;
        doc.font('Helvetica').fontSize(8);
        const textH = doc.heightOfString(block.text, {
          width: CONTENT_W - pad * 2,
        });
        const boxH = textH + pad * 2;
        ensureSpace(doc, boxH + 8);
        const y0 = doc.y;
        doc
          .roundedRect(MARGIN_X, y0, CONTENT_W, boxH, 4)
          .fillAndStroke('#fff1f2', '#fda4af');
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#9f1239')
          .text(block.text, MARGIN_X + pad, y0 + pad, {
            width: CONTENT_W - pad * 2,
            lineGap: 1.5,
          });
        doc.y = y0 + boxH + 8;
        resetX(doc);
        continue;
      }

      if (block.kind === 'li') {
        ensureSpace(doc, 16);
        writeWrapped(doc, `•  ${block.text}`, {
          size: 8.5,
          color: '#334155',
          indent: 6,
          lineGap: 1.2,
        });
        doc.y += 2;
        continue;
      }

      if (block.kind === 'table') {
        const colCount = Math.max(...block.rows.map((r) => r.length), 1);
        const colWs: number[] = [];
        if (colCount === 3) {
          colWs.push(CONTENT_W * 0.32, CONTENT_W * 0.18, CONTENT_W * 0.5);
        } else if (colCount === 2) {
          colWs.push(CONTENT_W * 0.4, CONTENT_W * 0.6);
        } else {
          for (let i = 0; i < colCount; i++) colWs.push(CONTENT_W / colCount);
        }

        for (let ri = 0; ri < block.rows.length; ri++) {
          const row = block.rows[ri];
          doc.font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5);
          const cellHs = row.map((cell, ci) =>
            doc.heightOfString(cell || ' ', {
              width: Math.max(20, (colWs[ci] || CONTENT_W / colCount) - 8),
            })
          );
          const rowH = Math.max(...cellHs, 10) + 7;
          ensureSpace(doc, rowH + 1);
          const y0 = doc.y;
          if (ri === 0) {
            doc.rect(MARGIN_X, y0, CONTENT_W, rowH).fill('#e2e8f0');
          } else if (ri % 2 === 0) {
            doc.rect(MARGIN_X, y0, CONTENT_W, rowH).fill('#f8fafc');
          }
          doc
            .rect(MARGIN_X, y0, CONTENT_W, rowH)
            .strokeColor('#cbd5e1')
            .lineWidth(0.4)
            .stroke();

          let x = MARGIN_X;
          for (let ci = 0; ci < colCount; ci++) {
            const w = colWs[ci] || CONTENT_W / colCount;
            doc
              .font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(7.5)
              .fillColor('#0f172a')
              .text(row[ci] || '', x + 4, y0 + 3.5, {
                width: w - 8,
                height: rowH - 5,
                ellipsis: true,
                lineBreak: true,
              });
            x += w;
          }
          doc.y = y0 + rowH;
          resetX(doc);
        }
        doc.y += 6;
        resetX(doc);
        continue;
      }

      writeWrapped(doc, block.text, {
        size: 8.5,
        color: '#334155',
        lineGap: 1.5,
        align: 'justify',
      });
      doc.y += 3;
    }

    // ── Final pass: correct "Page X of Y" on every existing page ──
    // Zero margins so stamping never creates blank pages.
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(range.start + i);
      drawRunningFooter(doc, i + 1, total);
      // Page 2+ already have running headers from pageAdded; page 1 has masthead
      if (i > 0) {
        drawRunningHeader(doc, meta.companyName, version);
      }
    }

    doc.end();
  });
}
