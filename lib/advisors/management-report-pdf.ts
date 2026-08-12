/**
 * One-page A4 landscape owner management report PDF (all Advisors).
 * Dense key-metrics pack + charts — pure pdfkit, Vercel serverless safe.
 * Do not import from client components.
 */
import PDFDocument from 'pdfkit';
import type {
  ManagementChart,
  ManagementChartPoint,
  ManagementReportDoc,
} from '@/lib/advisors/management-report';
import {
  ensureManagementCharts,
  managementReportPdfFilename,
} from '@/lib/advisors/management-report';

// A4 landscape points
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 24;
const CONTENT_W = PAGE_W - MX * 2;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const RISK = '#be123c';
const OK = '#047857';
const FOOTER_Y = PAGE_H - 14;

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

function maxSeries(series: ManagementChartPoint[]) {
  return Math.max(1, ...series.map((s) => (Number.isFinite(s.value) ? s.value : 0)));
}

function drawBarChart(
  pdf: PdfDoc,
  chart: ManagementChart,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const padL = 22;
  const padB = 22;
  const padT = 16;
  const padR = 8;
  const plotX = x + padL;
  const plotY = y + padT;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const series = chart.series.slice(0, 8);
  const maxV = maxSeries(series);
  const n = Math.max(1, series.length);
  const gap = 4;
  const barW = Math.max(8, (plotW - gap * (n - 1)) / n);

  pdf.roundedRect(x, y, w, h, 4).fillAndStroke('#ffffff', LINE);
  pdf.font('Helvetica-Bold').fontSize(7).fillColor(INK);
  t(pdf, chart.title, x + 6, y + 4, w - 12, 10);

  // axis
  pdf
    .moveTo(plotX, plotY + plotH)
    .lineTo(plotX + plotW, plotY + plotH)
    .strokeColor(LINE)
    .lineWidth(0.6)
    .stroke();

  series.forEach((p, i) => {
    const bh = Math.max(1, (Math.max(0, p.value) / maxV) * (plotH - 2));
    const bx = plotX + i * (barW + gap);
    const by = plotY + plotH - bh;
    const color = p.color || BRAND;
    pdf.roundedRect(bx, by, barW, bh, 2).fill(color);
    pdf.font('Helvetica').fontSize(5).fillColor(MUTED);
    t(pdf, String(p.label).slice(0, 10), bx - 2, plotY + plotH + 2, barW + 6, 12, 'center');
    if (bh > 12) {
      pdf.font('Helvetica-Bold').fontSize(5.5).fillColor('#ffffff');
      t(pdf, str(Math.round(p.value)), bx, by + 2, barW, 8, 'center');
    } else {
      pdf.font('Helvetica').fontSize(5).fillColor(INK);
      t(pdf, str(Math.round(p.value)), bx, by - 9, barW, 8, 'center');
    }
  });
}

function drawHorizontalBarChart(
  pdf: PdfDoc,
  chart: ManagementChart,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const padL = 70;
  const padB = 8;
  const padT = 16;
  const padR = 28;
  const plotX = x + padL;
  const plotY = y + padT;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const series = chart.series.slice(0, 7);
  const maxV = maxSeries(series);
  const n = Math.max(1, series.length);
  const gap = 3;
  const barH = Math.max(8, (plotH - gap * (n - 1)) / n);

  pdf.roundedRect(x, y, w, h, 4).fillAndStroke('#ffffff', LINE);
  pdf.font('Helvetica-Bold').fontSize(7).fillColor(INK);
  t(pdf, chart.title, x + 6, y + 4, w - 12, 10);

  series.forEach((p, i) => {
    const bw = Math.max(2, (Math.max(0, p.value) / maxV) * plotW);
    const by = plotY + i * (barH + gap);
    const color = p.color || BRAND;
    pdf.font('Helvetica').fontSize(5.5).fillColor(MUTED);
    t(pdf, String(p.label).slice(0, 14), x + 4, by + 1, padL - 8, barH);
    pdf.roundedRect(plotX, by, bw, barH - 1, 2).fill(color);
    pdf.font('Helvetica-Bold').fontSize(5.5).fillColor(INK);
    t(pdf, str(Math.round(p.value)), plotX + bw + 2, by + 1, padR - 4, barH);
  });
}

function drawDonutChart(
  pdf: PdfDoc,
  chart: ManagementChart,
  x: number,
  y: number,
  w: number,
  h: number
) {
  pdf.roundedRect(x, y, w, h, 4).fillAndStroke('#ffffff', LINE);
  pdf.font('Helvetica-Bold').fontSize(7).fillColor(INK);
  t(pdf, chart.title, x + 6, y + 4, w - 12, 10);

  const series = chart.series.filter((s) => s.value > 0).slice(0, 6);
  const total = series.reduce((a, b) => a + Math.max(0, b.value), 0) || 1;
  const cx = x + w * 0.32;
  const cy = y + h * 0.55;
  const r = Math.min(w * 0.22, h * 0.32);
  const rInner = r * 0.55;

  let angle = -Math.PI / 2;
  series.forEach((p) => {
    const slice = (Math.max(0, p.value) / total) * Math.PI * 2;
    const start = angle;
    const end = angle + slice;
    const color = p.color || BRAND;
    // approximate pie slice with triangle fan
    const steps = Math.max(6, Math.ceil(slice / 0.15));
    pdf.save();
    pdf.moveTo(cx, cy);
    for (let i = 0; i <= steps; i++) {
      const a = start + (slice * i) / steps;
      pdf.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    pdf.closePath().fill(color);
    pdf.restore();
    angle = end;
  });
  // hole
  pdf.circle(cx, cy, rInner).fill('#ffffff');
  pdf.font('Helvetica-Bold').fontSize(8).fillColor(INK);
  t(pdf, str(Math.round(total)), cx - 16, cy - 6, 32, 12, 'center');
  pdf.font('Helvetica').fontSize(5).fillColor(MUTED);
  t(pdf, chart.unit || 'total', cx - 16, cy + 4, 32, 8, 'center');

  // legend
  let ly = y + 18;
  const lx = x + w * 0.58;
  series.forEach((p) => {
    const color = p.color || BRAND;
    pdf.roundedRect(lx, ly + 1, 7, 7, 1).fill(color);
    pdf.font('Helvetica').fontSize(5.5).fillColor(INK);
    const pct = Math.round((p.value / total) * 100);
    t(pdf, `${p.label.slice(0, 14)}  ${Math.round(p.value)} (${pct}%)`, lx + 10, ly, w * 0.38, 10);
    ly += 11;
  });
}

function drawLineChart(
  pdf: PdfDoc,
  chart: ManagementChart,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const padL = 24;
  const padB = 20;
  const padT = 16;
  const padR = 8;
  const plotX = x + padL;
  const plotY = y + padT;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const series = chart.series.slice(0, 12);
  const maxV = maxSeries(series);
  const n = Math.max(1, series.length - 1);

  pdf.roundedRect(x, y, w, h, 4).fillAndStroke('#ffffff', LINE);
  pdf.font('Helvetica-Bold').fontSize(7).fillColor(INK);
  t(pdf, chart.title, x + 6, y + 4, w - 12, 10);

  pdf
    .moveTo(plotX, plotY + plotH)
    .lineTo(plotX + plotW, plotY + plotH)
    .strokeColor(LINE)
    .lineWidth(0.5)
    .stroke();

  if (series.length === 0) return;

  pdf.save();
  series.forEach((p, i) => {
    const px = plotX + (i / n) * plotW;
    const py = plotY + plotH - (Math.max(0, p.value) / maxV) * (plotH - 2);
    if (i === 0) pdf.moveTo(px, py);
    else pdf.lineTo(px, py);
  });
  pdf.strokeColor(BRAND_DEEP).lineWidth(1.5).stroke();
  pdf.restore();

  series.forEach((p, i) => {
    const px = plotX + (i / n) * plotW;
    const py = plotY + plotH - (Math.max(0, p.value) / maxV) * (plotH - 2);
    pdf.circle(px, py, 2).fill(BRAND);
    if (i % Math.ceil(series.length / 5) === 0 || i === series.length - 1) {
      pdf.font('Helvetica').fontSize(4.5).fillColor(MUTED);
      t(pdf, String(p.label).slice(0, 8), px - 12, plotY + plotH + 2, 24, 10, 'center');
    }
  });
}

function drawChart(
  pdf: PdfDoc,
  chart: ManagementChart,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (chart.type === 'donut') drawDonutChart(pdf, chart, x, y, w, h);
  else if (chart.type === 'horizontal_bar')
    drawHorizontalBarChart(pdf, chart, x, y, w, h);
  else if (chart.type === 'line') drawLineChart(pdf, chart, x, y, w, h);
  else drawBarChart(pdf, chart, x, y, w, h);
}

export async function buildManagementReportPdf(
  doc: ManagementReportDoc
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      autoFirstPage: true,
      margins: { top: 0, bottom: PAGE_H - 2, left: MX, right: MX },
      info: {
        Title: `${doc.brand} owner management report (A4 landscape)`,
        Author: 'SupplierAdvisor®',
        Subject: `${doc.product} · key metrics · charts · ${doc.period.from} – ${doc.period.to}`,
        CreationDate: new Date(doc.generatedAt),
      },
    });
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const page = pdf.page;
    page.margins.top = 0;
    page.margins.bottom = 0;
    page.margins.left = 0;
    page.margins.right = 0;

    const charts = ensureManagementCharts(doc);

    // ── Header ────────────────────────────────────────────────────────
    const heroH = 36;
    pdf.rect(0, 0, PAGE_W, heroH).fill(BRAND_DEEP);
    pdf.rect(0, heroH - 2.5, PAGE_W, 2.5).fill(BRAND);

    pdf.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff');
    t(pdf, doc.brand, MX, 7, CONTENT_W * 0.48, 12);
    pdf.font('Helvetica').fontSize(7).fillColor('#bae6fd');
    t(
      pdf,
      'Management report pack · key metrics · charts · one page',
      MX,
      21,
      CONTENT_W * 0.5,
      10
    );

    pdf.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
    t(pdf, doc.companyName || `Company #${doc.companyId}`, MX, 7, CONTENT_W, 11, 'right');
    pdf.font('Helvetica').fontSize(6.5).fillColor('#bae6fd');
    t(
      pdf,
      `${doc.period.from} → ${doc.period.to}  ·  A4 landscape  ·  ${doc.sliceLabel}`,
      MX,
      21,
      CONTENT_W,
      10,
      'right'
    );

    let y = heroH + 6;

    // Headline
    pdf.font('Helvetica-Bold').fontSize(10).fillColor(INK);
    t(pdf, doc.headline, MX, y, CONTENT_W * 0.72, 12);
    if (doc.filterSummary) {
      pdf.font('Helvetica').fontSize(6).fillColor(MUTED);
      t(pdf, doc.filterSummary, MX + CONTENT_W * 0.72, y + 1, CONTENT_W * 0.28, 12, 'right');
    }
    y += 13;

    // ── KPI tiles (1 row of up to 8 for space) ────────────────────────
    const kpis = doc.kpis.slice(0, 8);
    const cols = Math.min(8, Math.max(4, kpis.length || 4));
    const gap = 4;
    const tileW = (CONTENT_W - gap * (cols - 1)) / cols;
    const tileH = 28;
    kpis.forEach((k, i) => {
      const x = MX + i * (tileW + gap);
      pdf.roundedRect(x, y, tileW, tileH, 3).fillAndStroke('#f8fafc', LINE);
      pdf.rect(x, y, 2.5, tileH).fill(BRAND);
      pdf.font('Helvetica').fontSize(5).fillColor(MUTED);
      t(pdf, k.label.toUpperCase(), x + 6, y + 3, tileW - 9, 7);
      pdf.font('Helvetica-Bold').fontSize(10).fillColor(INK);
      t(pdf, str(k.value), x + 6, y + 12, tileW - 9, 12);
    });
    y += tileH + 6;

    // ── Charts row (2 charts) ─────────────────────────────────────────
    const chartH = 118;
    const chartGap = 8;
    const chartW =
      charts.length <= 1 ? CONTENT_W : (CONTENT_W - chartGap) / Math.min(2, charts.length);
    charts.slice(0, 2).forEach((chart, i) => {
      drawChart(pdf, chart, MX + i * (chartW + chartGap), y, chartW, chartH);
    });
    y += chartH + 6;

    // ── Bottom: table (left) + highlights strip (right) ───────────────
    const bottomH = FOOTER_Y - y - 6;
    const leftW = CONTENT_W * 0.58;
    const rightW = CONTENT_W * 0.4;
    const rightX = MX + leftW + CONTENT_W * 0.02;

    // table
    const table = doc.tables[0];
    if (table && bottomH > 40) {
      pdf.roundedRect(MX, y, leftW, bottomH, 3).fillAndStroke('#ffffff', LINE);
      pdf.font('Helvetica-Bold').fontSize(7).fillColor(INK);
      t(pdf, table.title, MX + 5, y + 4, leftW - 10, 9);
      let ty = y + 14;
      const headers = table.headers.slice(0, 5);
      const n = Math.max(1, headers.length);
      const cw = (leftW - 10) / n;
      pdf.rect(MX + 4, ty - 1, leftW - 8, 9).fill('#f1f5f9');
      pdf.font('Helvetica-Bold').fontSize(5).fillColor(MUTED);
      headers.forEach((h, i) => t(pdf, h, MX + 5 + i * cw, ty, cw - 2, 8));
      ty += 10;
      pdf.font('Helvetica').fontSize(5.5).fillColor(INK);
      for (const row of table.rows.slice(0, 6)) {
        if (ty > y + bottomH - 10) break;
        headers.forEach((_, i) =>
          t(pdf, str(row[i]), MX + 5 + i * cw, ty, cw - 2, 8)
        );
        ty += 9;
      }
    }

    // highlights / risks / actions stacked
    if (bottomH > 40) {
      const blockH = (bottomH - 8) / 3;
      const blocks = [
        { title: 'HIGHLIGHTS', items: doc.highlights, color: OK, bg: '#ecfdf5', border: '#a7f3d0' },
        { title: 'RISKS / WATCH', items: doc.risks, color: RISK, bg: '#fff1f2', border: '#fecdd3' },
        { title: 'OWNER ACTIONS', items: doc.actions, color: BRAND_DEEP, bg: '#e0f2fe', border: '#7dd3fc' },
      ];
      blocks.forEach((sec, i) => {
        const by = y + i * (blockH + 4);
        pdf
          .roundedRect(rightX, by, rightW, blockH, 3)
          .fillAndStroke(sec.bg, sec.border);
        pdf.font('Helvetica-Bold').fontSize(6).fillColor(sec.color);
        t(pdf, sec.title, rightX + 5, by + 3, rightW - 10, 8);
        let hy = by + 12;
        pdf.font('Helvetica').fontSize(5.5).fillColor(INK);
        for (const item of (sec.items.length ? sec.items : ['—']).slice(0, 3)) {
          if (hy > by + blockH - 8) break;
          t(pdf, `• ${item}`, rightX + 5, hy, rightW - 10, 9);
          hy += 9;
        }
      });
    }

    // ── Footer ────────────────────────────────────────────────────────
    pdf
      .moveTo(MX, FOOTER_Y - 3)
      .lineTo(MX + CONTENT_W, FOOTER_Y - 3)
      .strokeColor(LINE)
      .lineWidth(0.4)
      .stroke();
    pdf.font('Helvetica').fontSize(5).fillColor(MUTED);
    t(
      pdf,
      `${doc.brand} · SupplierAdvisor® · Generated ${doc.generatedAt.slice(0, 16).replace('T', ' ')} · Confidential owner pack`,
      MX,
      FOOTER_Y - 1,
      CONTENT_W * 0.7,
      8
    );
    t(pdf, 'Page 1 of 1 · A4 landscape · charts', MX, FOOTER_Y - 1, CONTENT_W, 8, 'right');

    pdf.end();
  });
}

export { managementReportPdfFilename };
