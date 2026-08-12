/**
 * One-page A4 owner management report PDF (all Advisors).
 * Pure pdfkit — Vercel serverless safe. Do not import from client components.
 */
import PDFDocument from 'pdfkit';
import type { ManagementReportDoc } from '@/lib/advisors/management-report';
import { managementReportPdfFilename } from '@/lib/advisors/management-report';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 36;
const CONTENT_W = PAGE_W - MX * 2;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const RISK = '#be123c';
const OK = '#047857';

function str(v: string | number | null | undefined) {
  if (v == null) return '—';
  return String(v);
}

export async function buildManagementReportPdf(
  doc: ManagementReportDoc
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 28, left: MX, right: MX },
      info: {
        Title: `${doc.brand} owner management report`,
        Author: 'SupplierAdvisor®',
        Subject: `${doc.product} · ${doc.period.from} – ${doc.period.to}`,
        CreationDate: new Date(doc.generatedAt),
      },
    });
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    // Header
    pdf.rect(0, 0, PAGE_W, 54).fill(BRAND_DEEP);
    pdf.rect(0, 50, PAGE_W, 3).fill(BRAND);
    pdf
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(doc.brand, MX, 14, { width: CONTENT_W * 0.62 });
    pdf
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#bae6fd')
      .text('Owner management report · one page', MX, 32, {
        width: CONTENT_W * 0.62,
      });
    pdf
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(doc.companyName || `Company #${doc.companyId}`, MX, 14, {
        width: CONTENT_W,
        align: 'right',
      });
    pdf
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#bae6fd')
      .text(`${doc.period.from} → ${doc.period.to}`, MX, 28, {
        width: CONTENT_W,
        align: 'right',
      });
    pdf.text(`Slice: ${doc.sliceLabel}`, MX, 38, {
      width: CONTENT_W,
      align: 'right',
    });

    let y = 64;

    pdf
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(doc.headline, MX, y, { width: CONTENT_W });
    y += 18;

    if (doc.filterSummary) {
      pdf
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(doc.filterSummary, MX, y, { width: CONTENT_W });
      y += 12;
    }

    // KPI tiles (up to 8)
    const kpis = doc.kpis.slice(0, 8);
    const cols = Math.min(4, Math.max(2, kpis.length));
    const gap = 6;
    const tileW = (CONTENT_W - gap * (cols - 1)) / cols;
    const tileH = 36;
    kpis.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = MX + col * (tileW + gap);
      const ty = y + row * (tileH + gap);
      pdf.roundedRect(x, ty, tileW, tileH, 4).fillAndStroke('#f8fafc', LINE);
      pdf
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(6)
        .text(k.label.toUpperCase(), x + 6, ty + 6, { width: tileW - 12 });
      pdf
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(str(k.value), x + 6, ty + 16, { width: tileW - 12 });
    });
    const kpiRows = Math.ceil(kpis.length / cols) || 1;
    y += kpiRows * (tileH + gap) + 6;

    // Highlights / risks / actions in 3 columns
    const colW = (CONTENT_W - 12) / 3;
    const sections: Array<{
      title: string;
      items: string[];
      color: string;
    }> = [
      { title: 'Highlights', items: doc.highlights.slice(0, 5), color: OK },
      { title: 'Risks / watch', items: doc.risks.slice(0, 5), color: RISK },
      { title: 'Owner actions', items: doc.actions.slice(0, 5), color: BRAND_DEEP },
    ];
    const boxTop = y;
    let maxBoxH = 0;
    sections.forEach((sec, i) => {
      const x = MX + i * (colW + 6);
      const items = sec.items.length
        ? sec.items
        : ['—'];
      let hy = boxTop;
      pdf
        .fillColor(sec.color)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(sec.title, x, hy, { width: colW });
      hy += 12;
      pdf.fillColor(INK).font('Helvetica').fontSize(7);
      for (const item of items) {
        const h = pdf.heightOfString(`• ${item}`, { width: colW });
        if (hy + h > boxTop + 72) break;
        pdf.text(`• ${item}`, x, hy, { width: colW });
        hy += h + 2;
      }
      maxBoxH = Math.max(maxBoxH, hy - boxTop);
    });
    y = boxTop + maxBoxH + 8;

    // Tables
    for (const table of doc.tables.slice(0, 2)) {
      if (y > PAGE_H - 120) break;
      pdf
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(table.title, MX, y, { width: CONTENT_W });
      y += 12;

      const headers = table.headers.slice(0, 6);
      const colCount = headers.length || 1;
      const cw = CONTENT_W / colCount;
      pdf.rect(MX, y - 2, CONTENT_W, 12).fill('#f1f5f9');
      pdf.fillColor(MUTED).font('Helvetica-Bold').fontSize(6);
      headers.forEach((h, i) => {
        pdf.text(h, MX + i * cw + 2, y, { width: cw - 4, ellipsis: true });
      });
      y += 12;
      pdf.fillColor(INK).font('Helvetica').fontSize(7);
      for (const row of table.rows.slice(0, 8)) {
        if (y > PAGE_H - 48) break;
        headers.forEach((_, i) => {
          pdf.text(str(row[i]), MX + i * cw + 2, y, {
            width: cw - 4,
            ellipsis: true,
          });
        });
        y += 10;
        pdf
          .moveTo(MX, y - 1)
          .lineTo(MX + CONTENT_W, y - 1)
          .strokeColor(LINE)
          .lineWidth(0.4)
          .stroke();
      }
      y += 8;
    }

    // Footer
    const footerY = PAGE_H - 22;
    pdf
      .moveTo(MX, footerY - 6)
      .lineTo(MX + CONTENT_W, footerY - 6)
      .strokeColor(LINE)
      .lineWidth(0.6)
      .stroke();
    pdf
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(6.5)
      .text(
        `${doc.brand} · SupplierAdvisor® · Generated ${doc.generatedAt.slice(0, 16).replace('T', ' ')} · Confidential owner pack`,
        MX,
        footerY,
        { width: CONTENT_W * 0.7 }
      );
    pdf.text('Page 1 of 1 · A4', MX, footerY, {
      width: CONTENT_W,
      align: 'right',
    });

    pdf.end();
  });
}

export { managementReportPdfFilename };
