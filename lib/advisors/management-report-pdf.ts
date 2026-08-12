/**
 * One-page A4 landscape owner management report PDF (all Advisors).
 * Polished visual design aligned with the web Insights pack —
 * brand hero, KPI tiles, charts, data table, insight strips.
 * Pure pdfkit (Vercel serverless safe). Do not import from client.
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
const MX = 20;
const CONTENT_W = PAGE_W - MX * 2;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const BRAND_MID = '#0891b2';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SURFACE = '#f8fafc';
const RISK = '#be123c';
const OK = '#047857';
const FOOTER_Y = PAGE_H - 12;

const PALETTE = [
  '#0077b6',
  '#00b4d8',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#e11d48',
  '#0d9488',
  '#4f46e5',
];

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
  return Math.max(
    1,
    ...series.map((s) => (Number.isFinite(s.value) ? s.value : 0))
  );
}

function card(
  pdf: PdfDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { fill?: string; stroke?: string; radius?: number; accent?: string }
) {
  const fill = opts?.fill ?? '#ffffff';
  const stroke = opts?.stroke ?? LINE;
  const r = opts?.radius ?? 6;
  // soft shadow underlay
  pdf.roundedRect(x + 0.8, y + 1.2, w, h, r).fill('#e2e8f0');
  pdf.roundedRect(x, y, w, h, r).fillAndStroke(fill, stroke);
  if (opts?.accent) {
    pdf.roundedRect(x, y, 3.2, h, r).fill(opts.accent);
    // clean right edge of accent
    pdf.rect(x + 2.4, y, 1.2, h).fill(opts.accent);
  }
}

function chartTitleBar(
  pdf: PdfDoc,
  title: string,
  x: number,
  y: number,
  w: number
) {
  pdf.rect(x, y, w, 14).fill(SURFACE);
  pdf
    .moveTo(x, y + 14)
    .lineTo(x + w, y + 14)
    .strokeColor(LINE)
    .lineWidth(0.5)
    .stroke();
  // accent chip
  pdf.roundedRect(x + 6, y + 4.5, 3, 5, 1).fill(BRAND);
  pdf.font('Helvetica-Bold').fontSize(7).fillColor(INK);
  t(pdf, title, x + 12, y + 3.5, w - 18, 9);
}

function drawBarChart(
  pdf: PdfDoc,
  chart: ManagementChart,
  x: number,
  y: number,
  w: number,
  h: number
) {
  card(pdf, x, y, w, h, { radius: 6 });
  chartTitleBar(pdf, chart.title, x, y, w);

  const padL = 26;
  const padB = 20;
  const padT = 22;
  const padR = 10;
  const plotX = x + padL;
  const plotY = y + padT;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const series = chart.series.slice(0, 8);
  const maxV = maxSeries(series);
  const n = Math.max(1, series.length);
  const gap = 5;
  const barW = Math.max(10, (plotW - gap * (n - 1)) / n);

  // grid lines
  for (let g = 0; g <= 3; g++) {
    const gy = plotY + (plotH * g) / 3;
    pdf
      .moveTo(plotX, gy)
      .lineTo(plotX + plotW, gy)
      .strokeColor(g === 3 ? LINE : '#f1f5f9')
      .lineWidth(0.5)
      .stroke();
  }

  series.forEach((p, i) => {
    const bh = Math.max(2, (Math.max(0, p.value) / maxV) * (plotH - 4));
    const bx = plotX + i * (barW + gap);
    const by = plotY + plotH - bh;
    const color = p.color || PALETTE[i % PALETTE.length];
    // bar body
    pdf.roundedRect(bx, by, barW, bh, 2.5).fill(color);
    // top highlight
    if (bh > 6) {
      pdf.rect(bx + 1, by + 1, barW - 2, Math.min(3, bh / 4)).fillOpacity(0.25);
      pdf.rect(bx + 1, by + 1, barW - 2, Math.min(3, bh / 4)).fill('#ffffff');
      pdf.fillOpacity(1);
    }
    pdf.font('Helvetica').fontSize(5).fillColor(MUTED);
    t(
      pdf,
      String(p.label).slice(0, 11),
      bx - 2,
      plotY + plotH + 3,
      barW + 6,
      10,
      'center'
    );
    if (bh > 14) {
      pdf.font('Helvetica-Bold').fontSize(5.5).fillColor('#ffffff');
      t(pdf, str(Math.round(p.value)), bx, by + 3, barW, 8, 'center');
    } else {
      pdf.font('Helvetica-Bold').fontSize(5).fillColor(INK);
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
  card(pdf, x, y, w, h, { radius: 6 });
  chartTitleBar(pdf, chart.title, x, y, w);

  const padL = 72;
  const padB = 8;
  const padT = 22;
  const padR = 30;
  const plotX = x + padL;
  const plotY = y + padT;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const series = chart.series.slice(0, 7);
  const maxV = maxSeries(series);
  const n = Math.max(1, series.length);
  const gap = 3.5;
  const barH = Math.max(9, (plotH - gap * (n - 1)) / n);

  series.forEach((p, i) => {
    const bw = Math.max(3, (Math.max(0, p.value) / maxV) * plotW);
    const by = plotY + i * (barH + gap);
    const color = p.color || PALETTE[i % PALETTE.length];
    // track
    pdf.roundedRect(plotX, by + 1, plotW, barH - 2, 2).fill('#f1f5f9');
    pdf.roundedRect(plotX, by + 1, bw, barH - 2, 2).fill(color);
    pdf.font('Helvetica').fontSize(5.5).fillColor(MUTED);
    t(pdf, String(p.label).slice(0, 14), x + 6, by + 1.5, padL - 10, barH);
    pdf.font('Helvetica-Bold').fontSize(5.5).fillColor(INK);
    t(pdf, str(Math.round(p.value)), plotX + bw + 3, by + 1.5, padR - 6, barH);
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
  card(pdf, x, y, w, h, { radius: 6 });
  chartTitleBar(pdf, chart.title, x, y, w);

  const series = chart.series.filter((s) => s.value > 0).slice(0, 6);
  const total = series.reduce((a, b) => a + Math.max(0, b.value), 0) || 1;
  const cx = x + w * 0.3;
  const cy = y + h * 0.56;
  const r = Math.min(w * 0.2, h * 0.3);
  const rInner = r * 0.58;

  // soft outer ring
  pdf.circle(cx, cy, r + 3).fill('#f1f5f9');

  let angle = -Math.PI / 2;
  series.forEach((p, idx) => {
    const slice = (Math.max(0, p.value) / total) * Math.PI * 2;
    const start = angle;
    const color = p.color || PALETTE[idx % PALETTE.length];
    const steps = Math.max(8, Math.ceil(slice / 0.12));
    pdf.save();
    pdf.moveTo(cx, cy);
    for (let i = 0; i <= steps; i++) {
      const a = start + (slice * i) / steps;
      pdf.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    pdf.closePath().fill(color);
    pdf.restore();
    angle = start + slice;
  });
  pdf.circle(cx, cy, rInner).fill('#ffffff');
  pdf.font('Helvetica-Bold').fontSize(9).fillColor(INK);
  t(pdf, str(Math.round(total)), cx - 18, cy - 7, 36, 12, 'center');
  pdf.font('Helvetica').fontSize(5).fillColor(MUTED);
  t(pdf, chart.unit || 'total', cx - 18, cy + 4, 36, 8, 'center');

  let ly = y + 22;
  const lx = x + w * 0.55;
  series.forEach((p, idx) => {
    const color = p.color || PALETTE[idx % PALETTE.length];
    pdf.roundedRect(lx, ly + 1, 8, 8, 2).fill(color);
    pdf.font('Helvetica').fontSize(5.5).fillColor(INK);
    const pct = Math.round((p.value / total) * 100);
    t(
      pdf,
      `${p.label.slice(0, 16)}  ${Math.round(p.value)} · ${pct}%`,
      lx + 11,
      ly,
      w * 0.4,
      10
    );
    ly += 12;
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
  card(pdf, x, y, w, h, { radius: 6 });
  chartTitleBar(pdf, chart.title, x, y, w);

  const padL = 28;
  const padB = 18;
  const padT = 22;
  const padR = 10;
  const plotX = x + padL;
  const plotY = y + padT;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const series = chart.series.slice(0, 12);
  const maxV = maxSeries(series);
  const n = Math.max(1, series.length - 1);

  for (let g = 0; g <= 3; g++) {
    const gy = plotY + (plotH * g) / 3;
    pdf
      .moveTo(plotX, gy)
      .lineTo(plotX + plotW, gy)
      .strokeColor(g === 3 ? LINE : '#f1f5f9')
      .lineWidth(0.5)
      .stroke();
  }

  if (series.length === 0) return;

  // area fill under line
  pdf.save();
  pdf.moveTo(plotX, plotY + plotH);
  series.forEach((p, i) => {
    const px = plotX + (i / n) * plotW;
    const py = plotY + plotH - (Math.max(0, p.value) / maxV) * (plotH - 2);
    pdf.lineTo(px, py);
  });
  pdf.lineTo(plotX + plotW, plotY + plotH);
  pdf.closePath().fillOpacity(0.12).fill(BRAND).fillOpacity(1);
  pdf.restore();

  pdf.save();
  series.forEach((p, i) => {
    const px = plotX + (i / n) * plotW;
    const py = plotY + plotH - (Math.max(0, p.value) / maxV) * (plotH - 2);
    if (i === 0) pdf.moveTo(px, py);
    else pdf.lineTo(px, py);
  });
  pdf.strokeColor(BRAND_DEEP).lineWidth(1.8).stroke();
  pdf.restore();

  series.forEach((p, i) => {
    const px = plotX + (i / n) * plotW;
    const py = plotY + plotH - (Math.max(0, p.value) / maxV) * (plotH - 2);
    pdf.circle(px, py, 2.4).fill(BRAND);
    pdf.circle(px, py, 1.1).fill('#ffffff');
    if (i % Math.ceil(series.length / 5) === 0 || i === series.length - 1) {
      pdf.font('Helvetica').fontSize(4.5).fillColor(MUTED);
      t(
        pdf,
        String(p.label).slice(0, 8),
        px - 12,
        plotY + plotH + 3,
        24,
        10,
        'center'
      );
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
        Title: `${doc.brand} management report (A4 landscape)`,
        Author: 'SupplierAdvisor®',
        Subject: `${doc.product} · Insights · ${doc.period.from} – ${doc.period.to}`,
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

    // Soft page wash
    pdf.rect(0, 0, PAGE_W, PAGE_H).fill('#f1f5f9');

    // ── Brand hero ────────────────────────────────────────────────────
    const heroH = 40;
    pdf.rect(0, 0, PAGE_W, heroH).fill(BRAND_DEEP);
    // gradient-like mid band
    pdf.rect(0, 0, PAGE_W * 0.55, heroH).fill(BRAND_MID);
    pdf.rect(0, 0, PAGE_W * 0.28, heroH).fill(BRAND_DEEP);
    pdf.rect(0, heroH - 3, PAGE_W, 3).fill(BRAND);
    // decorative dots
    pdf.circle(PAGE_W - 48, 12, 18).fillOpacity(0.08).fill('#ffffff').fillOpacity(1);
    pdf.circle(PAGE_W - 28, 28, 10).fillOpacity(0.1).fill('#ffffff').fillOpacity(1);

    pdf.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff');
    t(pdf, doc.brand, MX, 7, CONTENT_W * 0.5, 14);
    pdf.font('Helvetica').fontSize(7).fillColor('#e0f2fe');
    t(
      pdf,
      'Insights · management pack · key metrics · charts · one page',
      MX,
      23,
      CONTENT_W * 0.55,
      10
    );

    pdf.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    t(
      pdf,
      doc.companyName || `Company #${doc.companyId}`,
      MX,
      7,
      CONTENT_W,
      12,
      'right'
    );
    pdf.font('Helvetica').fontSize(6.5).fillColor('#bae6fd');
    t(
      pdf,
      `${doc.period.from} → ${doc.period.to}  ·  A4 landscape  ·  ${doc.sliceLabel}`,
      MX,
      22,
      CONTENT_W,
      10,
      'right'
    );

    let y = heroH + 8;

    // ── Headline card ─────────────────────────────────────────────────
    card(pdf, MX, y, CONTENT_W, 22, { fill: '#ffffff', radius: 5 });
    pdf.font('Helvetica-Bold').fontSize(9.5).fillColor(INK);
    t(pdf, doc.headline, MX + 8, y + 4, CONTENT_W * 0.62, 14);
    if (doc.filterSummary) {
      pdf.font('Helvetica').fontSize(6).fillColor(MUTED);
      t(
        pdf,
        doc.filterSummary,
        MX + CONTENT_W * 0.64,
        y + 6,
        CONTENT_W * 0.34,
        12,
        'right'
      );
    }
    y += 28;

    // ── KPI tiles ─────────────────────────────────────────────────────
    const kpis = doc.kpis.slice(0, 8);
    const cols = Math.min(8, Math.max(4, kpis.length || 4));
    const gap = 5;
    const tileW = (CONTENT_W - gap * (cols - 1)) / cols;
    const tileH = 34;
    kpis.forEach((k, i) => {
      const x = MX + i * (tileW + gap);
      const accent = PALETTE[i % PALETTE.length];
      card(pdf, x, y, tileW, tileH, {
        fill: '#ffffff',
        accent,
        radius: 5,
      });
      pdf.font('Helvetica').fontSize(5).fillColor(MUTED);
      t(pdf, k.label.toUpperCase(), x + 8, y + 5, tileW - 12, 7);
      pdf.font('Helvetica-Bold').fontSize(11).fillColor(INK);
      t(pdf, str(k.value), x + 8, y + 14, tileW - 12, 14);
      if (k.hint) {
        pdf.font('Helvetica').fontSize(4.5).fillColor(MUTED);
        t(pdf, k.hint.slice(0, 28), x + 8, y + 26, tileW - 12, 6);
      }
    });
    y += tileH + 8;

    // ── Charts row ────────────────────────────────────────────────────
    const chartCount = Math.min(2, Math.max(1, charts.length));
    const chartH = 124;
    const chartGap = 8;
    const chartW =
      chartCount <= 1 ? CONTENT_W : (CONTENT_W - chartGap) / chartCount;
    charts.slice(0, chartCount).forEach((chart, i) => {
      drawChart(pdf, chart, MX + i * (chartW + chartGap), y, chartW, chartH);
    });
    y += chartH + 8;

    // ── Bottom: table + insight columns ───────────────────────────────
    const bottomH = FOOTER_Y - y - 8;
    const leftW = CONTENT_W * 0.56;
    const rightW = CONTENT_W * 0.42;
    const rightX = MX + leftW + CONTENT_W * 0.02;

    const table = doc.tables[0];
    if (table && bottomH > 36) {
      card(pdf, MX, y, leftW, bottomH, { fill: '#ffffff', radius: 6 });
      // table header bar
      pdf.roundedRect(MX, y, leftW, 16, 6).fill(SURFACE);
      pdf.rect(MX, y + 10, leftW, 6).fill(SURFACE);
      pdf
        .moveTo(MX, y + 16)
        .lineTo(MX + leftW, y + 16)
        .strokeColor(LINE)
        .lineWidth(0.5)
        .stroke();
      pdf.roundedRect(MX + 6, y + 5, 3, 6, 1).fill(BRAND);
      pdf.font('Helvetica-Bold').fontSize(7).fillColor(INK);
      t(pdf, table.title, MX + 12, y + 4, leftW - 18, 10);

      let ty = y + 20;
      const headers = table.headers.slice(0, 5);
      const n = Math.max(1, headers.length);
      const cw = (leftW - 12) / n;
      pdf.rect(MX + 4, ty - 1, leftW - 8, 10).fill('#f1f5f9');
      pdf.font('Helvetica-Bold').fontSize(5).fillColor(MUTED);
      headers.forEach((h, i) => t(pdf, h, MX + 6 + i * cw, ty, cw - 2, 8));
      ty += 11;
      for (let ri = 0; ri < table.rows.slice(0, 7).length; ri++) {
        const row = table.rows[ri];
        if (ty > y + bottomH - 10) break;
        if (ri % 2 === 1) {
          pdf.rect(MX + 4, ty - 1, leftW - 8, 10).fill('#f8fafc');
        }
        pdf.font('Helvetica').fontSize(5.5).fillColor(INK);
        headers.forEach((_, i) =>
          t(pdf, str(row[i]), MX + 6 + i * cw, ty, cw - 2, 9)
        );
        ty += 10;
      }
    }

    if (bottomH > 36) {
      const blockGap = 4;
      const blockH = (bottomH - blockGap * 2) / 3;
      const blocks = [
        {
          title: 'HIGHLIGHTS',
          items: doc.highlights,
          color: OK,
          bg: '#ecfdf5',
          border: '#a7f3d0',
          accent: OK,
        },
        {
          title: 'RISKS / WATCH',
          items: doc.risks,
          color: RISK,
          bg: '#fff1f2',
          border: '#fecdd3',
          accent: RISK,
        },
        {
          title: 'OWNER ACTIONS',
          items: doc.actions,
          color: BRAND_DEEP,
          bg: '#e0f2fe',
          border: '#7dd3fc',
          accent: BRAND_DEEP,
        },
      ];
      blocks.forEach((sec, i) => {
        const by = y + i * (blockH + blockGap);
        card(pdf, rightX, by, rightW, blockH, {
          fill: sec.bg,
          stroke: sec.border,
          accent: sec.accent,
          radius: 5,
        });
        pdf.font('Helvetica-Bold').fontSize(6).fillColor(sec.color);
        t(pdf, sec.title, rightX + 8, by + 4, rightW - 14, 8);
        let hy = by + 13;
        pdf.font('Helvetica').fontSize(5.5).fillColor(INK);
        for (const item of (sec.items.length ? sec.items : ['—']).slice(
          0,
          3
        )) {
          if (hy > by + blockH - 8) break;
          t(pdf, `• ${item}`, rightX + 8, hy, rightW - 14, 9);
          hy += 9;
        }
      });
    }

    // ── Footer ────────────────────────────────────────────────────────
    pdf.rect(0, FOOTER_Y - 4, PAGE_W, PAGE_H - (FOOTER_Y - 4)).fill('#ffffff');
    pdf
      .moveTo(0, FOOTER_Y - 4)
      .lineTo(PAGE_W, FOOTER_Y - 4)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    pdf.font('Helvetica').fontSize(5).fillColor(MUTED);
    t(
      pdf,
      `${doc.brand} · SupplierAdvisor® · Insights pack · Generated ${doc.generatedAt.slice(0, 16).replace('T', ' ')} · Confidential`,
      MX,
      FOOTER_Y - 1,
      CONTENT_W * 0.72,
      8
    );
    t(
      pdf,
      'Page 1 of 1 · A4 landscape',
      MX,
      FOOTER_Y - 1,
      CONTENT_W,
      8,
      'right'
    );

    pdf.end();
  });
}

export { managementReportPdfFilename };
