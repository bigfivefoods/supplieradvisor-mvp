/**
 * One-page A4 landscape owner management report PDF (all Advisors).
 * Dense key-metrics pack — pure pdfkit, Vercel serverless safe.
 * Do not import from client components.
 */
import PDFDocument from 'pdfkit';
import type { ManagementReportDoc } from '@/lib/advisors/management-report';
import { managementReportPdfFilename } from '@/lib/advisors/management-report';

// A4 landscape points
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 26;
const CONTENT_W = PAGE_W - MX * 2;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const RISK = '#be123c';
const OK = '#047857';
const FOOTER_Y = PAGE_H - 16;

type PdfDoc = InstanceType<typeof PDFDocument>;

function str(v: string | number | null | undefined) {
  if (v == null) return '—';
  return String(v);
}

/** Always pass height so pdfkit cannot auto-create pages */
function t(
  pdf: PdfDoc,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  align?: 'left' | 'center' | 'right'
) {
  if (y >= PAGE_H - 2 || h <= 0) return;
  pdf.text(text, x, y, {
    width: w,
    height: Math.min(h, PAGE_H - y - 1),
    align: align || 'left',
    lineBreak: true,
    ellipsis: true,
  });
}

export async function buildManagementReportPdf(
  doc: ManagementReportDoc
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      autoFirstPage: true,
      // bottom margin = almost full page: zero usable flow height → no auto pages
      margins: { top: 0, bottom: PAGE_H - 2, left: MX, right: MX },
      info: {
        Title: `${doc.brand} owner management report (A4 landscape)`,
        Author: 'SupplierAdvisor®',
        Subject: `${doc.product} · key metrics · ${doc.period.from} – ${doc.period.to}`,
        CreationDate: new Date(doc.generatedAt),
      },
    });
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    // Temporarily open margins for absolute drawing
    const page = pdf.page;
    page.margins.top = 0;
    page.margins.bottom = 0;
    page.margins.left = 0;
    page.margins.right = 0;

    // ── Header ────────────────────────────────────────────────────────
    const heroH = 40;
    pdf.rect(0, 0, PAGE_W, heroH).fill(BRAND_DEEP);
    pdf.rect(0, heroH - 2.5, PAGE_W, 2.5).fill(BRAND);

    pdf.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff');
    t(pdf, doc.brand, MX, 8, CONTENT_W * 0.48, 14);
    pdf.font('Helvetica').fontSize(7.5).fillColor('#bae6fd');
    t(
      pdf,
      'Owner management report · all key metrics · one page',
      MX,
      24,
      CONTENT_W * 0.48,
      10
    );

    pdf.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    t(pdf, doc.companyName || `Company #${doc.companyId}`, MX, 8, CONTENT_W, 12, 'right');
    pdf.font('Helvetica').fontSize(7).fillColor('#bae6fd');
    t(
      pdf,
      `${doc.period.from} → ${doc.period.to}  ·  A4 landscape  ·  ${doc.sliceLabel}`,
      MX,
      24,
      CONTENT_W,
      10,
      'right'
    );

    let y = heroH + 8;

    // Headline
    pdf.font('Helvetica-Bold').fontSize(11).fillColor(INK);
    t(pdf, doc.headline, MX, y, CONTENT_W, 13);
    y += 14;
    if (doc.filterSummary) {
      pdf.font('Helvetica').fontSize(6.5).fillColor(MUTED);
      t(pdf, doc.filterSummary, MX, y, CONTENT_W, 9);
      y += 10;
    }

    // ── KPI tiles (max 12, 6 columns) ─────────────────────────────────
    const kpis = doc.kpis.slice(0, 12);
    const cols = 6;
    const gap = 5;
    const tileW = (CONTENT_W - gap * (cols - 1)) / cols;
    const tileH = 32;
    kpis.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = MX + col * (tileW + gap);
      const ty = y + row * (tileH + gap);
      pdf.roundedRect(x, ty, tileW, tileH, 3).fillAndStroke('#f8fafc', LINE);
      pdf.rect(x, ty, 2.5, tileH).fill(BRAND);
      pdf.font('Helvetica').fontSize(5.5).fillColor(MUTED);
      t(pdf, k.label.toUpperCase(), x + 7, ty + 4, tileW - 10, 8);
      pdf.font('Helvetica-Bold').fontSize(11).fillColor(INK);
      t(pdf, str(k.value), x + 7, ty + 14, tileW - 10, 14);
    });
    const kpiRows = Math.max(1, Math.ceil(kpis.length / cols));
    y += kpiRows * (tileH + gap) + 5;

    // ── Highlights / risks / actions ──────────────────────────────────
    const colW = (CONTENT_W - 10) / 3;
    const secH = 52;
    const sections = [
      {
        title: 'HIGHLIGHTS',
        items: doc.highlights.slice(0, 4),
        color: OK,
        bg: '#ecfdf5',
        border: '#a7f3d0',
      },
      {
        title: 'RISKS / WATCH',
        items: doc.risks.slice(0, 4),
        color: RISK,
        bg: '#fff1f2',
        border: '#fecdd3',
      },
      {
        title: 'OWNER ACTIONS',
        items: doc.actions.slice(0, 4),
        color: BRAND_DEEP,
        bg: '#e0f2fe',
        border: '#7dd3fc',
      },
    ];
    sections.forEach((sec, i) => {
      const x = MX + i * (colW + 5);
      pdf.roundedRect(x, y, colW, secH, 3).fillAndStroke(sec.bg, sec.border);
      pdf.font('Helvetica-Bold').fontSize(6.5).fillColor(sec.color);
      t(pdf, sec.title, x + 5, y + 4, colW - 10, 8);
      let hy = y + 14;
      pdf.font('Helvetica').fontSize(6).fillColor(INK);
      const items = sec.items.length ? sec.items : ['—'];
      for (const item of items) {
        if (hy > y + secH - 9) break;
        t(pdf, `• ${item}`, x + 5, hy, colW - 10, 9);
        hy += 9;
      }
    });
    y += secH + 6;

    // ── Two tables side-by-side ───────────────────────────────────────
    const tables = doc.tables.slice(0, 2);
    const tableGap = 8;
    const tableW =
      tables.length <= 1 ? CONTENT_W : (CONTENT_W - tableGap) / 2;
    const maxTableY = FOOTER_Y - 10;

    tables.forEach((table, ti) => {
      const x0 = MX + ti * (tableW + tableGap);
      let ty = y;
      if (ty > maxTableY - 30) return;

      pdf.font('Helvetica-Bold').fontSize(7.5).fillColor(INK);
      t(pdf, table.title, x0, ty, tableW, 10);
      ty += 11;

      const headers = table.headers.slice(0, 6);
      const n = Math.max(1, headers.length);
      const cw = tableW / n;
      pdf.rect(x0, ty - 1, tableW, 10).fill('#f1f5f9');
      pdf.font('Helvetica-Bold').fontSize(5.5).fillColor(MUTED);
      headers.forEach((h, i) => {
        t(pdf, h, x0 + i * cw + 2, ty, cw - 4, 8);
      });
      ty += 11;
      pdf.font('Helvetica').fontSize(6).fillColor(INK);
      for (const row of table.rows.slice(0, 6)) {
        if (ty > maxTableY - 10) break;
        headers.forEach((_, i) => {
          t(pdf, str(row[i]), x0 + i * cw + 2, ty, cw - 4, 8);
        });
        ty += 9;
        pdf
          .moveTo(x0, ty - 1)
          .lineTo(x0 + tableW, ty - 1)
          .strokeColor(LINE)
          .lineWidth(0.3)
          .stroke();
      }
    });

    // ── Footer ────────────────────────────────────────────────────────
    pdf
      .moveTo(MX, FOOTER_Y - 4)
      .lineTo(MX + CONTENT_W, FOOTER_Y - 4)
      .strokeColor(LINE)
      .lineWidth(0.4)
      .stroke();
    pdf.font('Helvetica').fontSize(5.5).fillColor(MUTED);
    t(
      pdf,
      `${doc.brand} · SupplierAdvisor® · Generated ${doc.generatedAt.slice(0, 16).replace('T', ' ')} · Confidential owner pack`,
      MX,
      FOOTER_Y - 1,
      CONTENT_W * 0.7,
      8
    );
    t(pdf, 'Page 1 of 1 · A4 landscape', MX, FOOTER_Y - 1, CONTENT_W, 8, 'right');

    pdf.end();
  });
}

export { managementReportPdfFilename };
