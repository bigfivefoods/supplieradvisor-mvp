/**
 * Generate a downloadable PDF of the Independent Sales Contractor Agreement.
 * Uses pdfkit (pure Node — works on Vercel serverless).
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

  // Tokenise by major block tags (non-greedy, case-insensitive)
  const re =
    /<(h[1-6]|p|li|div|table|tr)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
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

    if (tag === 'tr') {
      // Handled inside table
      continue;
    }

    const text = stripTags(inner);
    if (!text) continue;

    // Skip nested duplicates from outer wrappers when possible
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

    // Callout / highlight boxes (rose, amber, slate banners)
    if (
      tag === 'div' &&
      /rose|amber|border-2|font-black uppercase|Important/i.test(attrs + inner)
    ) {
      // Prefer inner paragraphs if present
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

    // Generic div with substantial text (title block etc.)
    if (tag === 'div' && text.length > 40 && !/<div\b/i.test(inner)) {
      blocks.push({ kind: 'p', text });
    }
  }

  // Fallback if parser found almost nothing
  if (blocks.length < 5) {
    const plain = stripTags(src);
    for (const para of plain.split(/\n{2,}/)) {
      const t = para.trim();
      if (t) blocks.push({ kind: 'p', text: t });
    }
  }

  return blocks;
}

function ensureSpace(
  doc: PDFKit.PDFDocument,
  need: number,
  marginBottom: number
) {
  if (doc.y + need > doc.page.height - marginBottom) {
    doc.addPage();
  }
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
      dateStyle: 'full',
      timeStyle: 'short',
    });

  const margin = 48;
  const pageWidth = 595.28; // A4
  const contentWidth = pageWidth - margin * 2;
  const marginBottom = 56;

  const blocks = htmlBodyToBlocks(bodyHtml);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: margin, bottom: marginBottom, left: margin, right: margin },
      info: {
        Title: SALES_CONTRACTOR_CONTRACT_TITLE,
        Author: 'SupplierAdvisor',
        Subject: `${meta.companyName} — ${version}`,
        Creator: 'SupplierAdvisor Sales Portal',
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Masthead ──────────────────────────────────────────────
    doc
      .fillColor('#0077b6')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('SUPPLIERADVISOR®  ·  SALES CONTRACTOR PORTAL', {
        characterSpacing: 1.2,
      });

    doc.moveDown(0.4);
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(SALES_CONTRACTOR_CONTRACT_TITLE, { width: contentWidth });

    doc.moveDown(0.35);
    doc
      .fillColor('#64748b')
      .font('Helvetica')
      .fontSize(9)
      .text(
        `${meta.companyName}  ·  Version ${version}  ·  Generated ${generated}`,
        { width: contentWidth }
      );

    doc.moveDown(0.45);
    const badge = isSigned
      ? 'SIGNED COPY'
      : 'DRAFT — FOR REVIEW BEFORE ACCEPTANCE';
    const badgeColor = isSigned ? '#065f46' : '#92400e';
    const badgeBg = isSigned ? '#ecfdf5' : '#fffbeb';
    const badgeW = doc.widthOfString(badge) + 16;
    const badgeH = 16;
    const bx = margin;
    const by = doc.y;
    doc.roundedRect(bx, by, badgeW, badgeH, 8).fill(badgeBg);
    doc
      .fillColor(badgeColor)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(badge, bx + 8, by + 4, { lineBreak: false });
    doc.y = by + badgeH + 10;

    doc
      .moveTo(margin, doc.y)
      .lineTo(pageWidth - margin, doc.y)
      .strokeColor('#0f172a')
      .lineWidth(1.5)
      .stroke();
    doc.moveDown(0.8);

    // ── Certificate / draft status ────────────────────────────
    ensureSpace(doc, 120, marginBottom);
    const certTop = doc.y;
    doc
      .roundedRect(margin, certTop, contentWidth, 8, 0)
      .fill(isSigned ? '#0f172a' : '#d97706');
    // We'll draw a box after content; first write content and measure
    doc.y = certTop + 12;

    if (isSigned) {
      doc
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Certificate of electronic acceptance (ECTA)', {
          width: contentWidth - 16,
        });
      doc.moveDown(0.35);
      const rows: [string, string][] = [
        ['Status', 'SIGNED / ACCEPTED'],
        [
          'Signatory name',
          meta.signatureName || meta.contractorName || '—',
        ],
        ['Signatory email', meta.signatureEmail || '—'],
        [
          'Signed at',
          meta.signedAt
            ? new Date(meta.signedAt).toLocaleString('en-ZA', {
                dateStyle: 'full',
                timeStyle: 'medium',
              })
            : '—',
        ],
        ['Contract version', version],
        [
          'Agreement ID',
          meta.agreementId != null ? String(meta.agreementId) : '—',
        ],
        ['Company', meta.companyName],
      ];
      doc.fontSize(9);
      for (const [k, v] of rows) {
        doc
          .font('Helvetica-Bold')
          .fillColor('#64748b')
          .text(`${k}: `, { continued: true, width: contentWidth - 16 })
          .font('Helvetica')
          .fillColor('#0f172a')
          .text(v);
      }
      doc.moveDown(0.3);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748b')
        .text(
          'This document was generated from SupplierAdvisor after electronic acceptance. The typed legal name and authentication records constitute the Contractor’s signature under the Electronic Communications and Transactions Act 25 of 2002 (ECTA).',
          { width: contentWidth - 16 }
        );
    } else {
      doc
        .fillColor('#92400e')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Document status: NOT YET SIGNED', { width: contentWidth - 16 });
      doc.moveDown(0.3);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#0f172a')
        .text(
          'This is a downloadable PDF copy for review before acceptance. It is not a completed contract until the Contractor accepts electronically in the SupplierAdvisor Sales Portal (checkbox + full legal name + secure sign-in).',
          { width: contentWidth - 16 }
        );
      doc.moveDown(0.35);
      doc.fontSize(9);
      for (const [k, v] of [
        ['Proposed contractor', meta.contractorName],
        ['Company', meta.companyName],
        ['Contract version', version],
        ['Generated', generated],
      ] as [string, string][]) {
        doc
          .font('Helvetica-Bold')
          .fillColor('#64748b')
          .text(`${k}: `, { continued: true })
          .font('Helvetica')
          .fillColor('#0f172a')
          .text(v);
      }
    }
    doc.moveDown(1);

    // ── Agreement body ────────────────────────────────────────
    for (const block of blocks) {
      if (block.kind === 'h') {
        ensureSpace(doc, 36, marginBottom);
        doc.moveDown(0.45);
        doc
          .fillColor('#0f172a')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(block.text, { width: contentWidth });
        doc
          .moveTo(margin, doc.y + 2)
          .lineTo(margin + contentWidth, doc.y + 2)
          .strokeColor('#e2e8f0')
          .lineWidth(0.6)
          .stroke();
        doc.moveDown(0.45);
        continue;
      }

      if (block.kind === 'callout') {
        ensureSpace(doc, 50, marginBottom);
        const pad = 8;
        const textH = doc.heightOfString(block.text, {
          width: contentWidth - pad * 2,
        });
        const boxH = textH + pad * 2;
        ensureSpace(doc, boxH + 8, marginBottom);
        const y0 = doc.y;
        doc
          .roundedRect(margin, y0, contentWidth, boxH, 6)
          .fillAndStroke('#fff1f2', '#fda4af');
        doc
          .fillColor('#881337')
          .font('Helvetica')
          .fontSize(9)
          .text(block.text, margin + pad, y0 + pad, {
            width: contentWidth - pad * 2,
          });
        doc.y = y0 + boxH + 8;
        doc.x = margin;
        continue;
      }

      if (block.kind === 'li') {
        ensureSpace(doc, 22, marginBottom);
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(9.5)
          .text(`•  ${block.text}`, {
            width: contentWidth,
            indent: 8,
            align: 'left',
          });
        doc.moveDown(0.2);
        continue;
      }

      if (block.kind === 'table') {
        const colCount = Math.max(...block.rows.map((r) => r.length), 1);
        const colW = contentWidth / colCount;
        for (let ri = 0; ri < block.rows.length; ri++) {
          const row = block.rows[ri];
          const heights = row.map((cell, ci) =>
            doc.heightOfString(cell || '', {
              width: colW - 8,
            })
          );
          // Use max cell height; measure with current font
          doc.font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
          const rowH =
            Math.max(
              ...row.map((cell) =>
                doc.heightOfString(cell || ' ', { width: colW - 8 })
              ),
              12
            ) + 8;
          ensureSpace(doc, rowH + 2, marginBottom);
          const y0 = doc.y;
          if (ri === 0) {
            doc.rect(margin, y0, contentWidth, rowH).fill('#f1f5f9');
          } else if (ri % 2 === 0) {
            doc.rect(margin, y0, contentWidth, rowH).fill('#f8fafc');
          }
          doc
            .rect(margin, y0, contentWidth, rowH)
            .strokeColor('#e2e8f0')
            .lineWidth(0.5)
            .stroke();
          for (let ci = 0; ci < colCount; ci++) {
            doc
              .fillColor('#0f172a')
              .font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(8.5)
              .text(row[ci] || '', margin + ci * colW + 4, y0 + 4, {
                width: colW - 8,
                height: rowH - 6,
              });
          }
          doc.y = y0 + rowH;
          doc.x = margin;
          void heights;
        }
        doc.moveDown(0.4);
        continue;
      }

      // paragraph
      ensureSpace(doc, 24, marginBottom);
      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(9.5)
        .text(block.text, { width: contentWidth, align: 'left' });
      doc.moveDown(0.35);
    }

    // ── Page numbers + footer on every page ───────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 36;
      doc
        .moveTo(margin, footerY - 8)
        .lineTo(pageWidth - margin, footerY - 8)
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#94a3b8')
        .text(
          'SupplierAdvisor® · Confidential · Sole agreement & NDA · Laws of the Republic of South Africa',
          margin,
          footerY - 2,
          { width: contentWidth - 60, lineBreak: false }
        );
      doc.text(`Page ${i + 1} of ${range.count}`, margin, footerY - 2, {
        width: contentWidth,
        align: 'right',
        lineBreak: false,
      });
    }

    doc.end();
  });
}
