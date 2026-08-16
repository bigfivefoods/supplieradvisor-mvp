/**
 * One-page landscape management accounts PDF for review meetings.
 * Pure pdfkit — Vercel serverless safe. Never calls addPage.
 */
import PDFDocument from 'pdfkit';
import type { ManagementPack, MgmtPackLine } from '@/lib/accounting/management-pack';
import { GAAP_DISCLAIMER_PDF_FOOTER } from '@/lib/accounting/gaap-disclaimer';

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 22;
const MY = 16;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const EMERALD = '#047857';
const AMBER = '#b45309';
const SKY = '#0369a1';
const SLATE = '#334155';

type PdfDoc = InstanceType<typeof PDFDocument>;

function money(n: number, currency = 'ZAR'): string {
  const abs = Math.abs(Number(n) || 0);
  const sign = n < 0 ? '-' : '';
  try {
    return `${sign}${new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(abs)}`;
  } catch {
    return `${sign}${currency} ${abs.toFixed(0)}`;
  }
}

function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}k`;
  return `${sign}${Math.round(abs).toLocaleString('en-ZA')}`;
}

function hex(doc: PdfDoc, color: string): void {
  doc.fillColor(color);
}

export async function buildManagementAccountsPdf(
  pack: ManagementPack
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
      info: {
        Title: `Management accounts — ${pack.companyName} — ${pack.label}`,
        Author: 'SupplierAdvisor',
        Subject: 'Management review one-pager',
        CreationDate: new Date(),
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, pack);
    drawKpis(doc, pack, 46);
    drawWaterfall(doc, pack, MX, 118, 390, 168);
    drawTrend(doc, pack, MX + 402, 118, 406, 168);
    drawMix(doc, pack, MX, 300, 390, 248);
    drawRightBottom(doc, pack, MX + 402, 300, 406, 248);
    drawFooter(doc, pack);

    doc.end();
  });
}

function drawHeader(doc: PdfDoc, pack: ManagementPack) {
  doc.rect(0, 0, PAGE_W, 38).fill(BRAND_DEEP);
  doc.rect(0, 38, PAGE_W, 3).fill(BRAND);
  hex(doc, '#ffffff');
  doc.font('Helvetica-Bold').fontSize(13);
  doc.text(pack.companyName, MX, 10, { width: 360, ellipsis: true });
  doc.font('Helvetica').fontSize(8).fillColor('#bae6fd');
  doc.text('MANAGEMENT ACCOUNTS  ·  IFRS / SA GAAP  ·  Unaudited', MX, 24);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff');
  doc.text(pack.label, PAGE_W - MX - 280, 10, { width: 280, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor('#bae6fd');
  doc.text(`${pack.from}  to  ${pack.to}`, PAGE_W - MX - 280, 24, {
    width: 280,
    align: 'right',
  });
}

function drawKpis(doc: PdfDoc, pack: ManagementPack, y: number) {
  const s = pack.summary;
  const items = [
    { label: 'Revenue', value: s.revenue, tone: 'good' as const },
    { label: 'Gross profit', value: s.grossProfit, tone: 'neutral' as const },
    { label: 'Operating expenses', value: s.expenses, tone: 'neutral' as const },
    {
      label: 'Operating profit',
      value: s.operatingProfit,
      tone: s.operatingProfit >= 0 ? ('good' as const) : ('bad' as const),
    },
    {
      label: 'Bank net',
      value: s.bankNet,
      tone: s.bankNet >= 0 ? ('good' as const) : ('bad' as const),
    },
  ];
  const gap = 8;
  const w = (PAGE_W - MX * 2 - gap * 4) / 5;
  items.forEach((it, i) => {
    const x = MX + i * (w + gap);
    doc.roundedRect(x, y, w, 60, 6).fill('#f8fafc');
    doc.roundedRect(x, y, w, 60, 6).strokeColor(LINE).lineWidth(0.6).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(MUTED);
    doc.text(it.label.toUpperCase(), x + 8, y + 8, { width: w - 16 });
    const color =
      it.tone === 'good' ? EMERALD : it.tone === 'bad' ? AMBER : INK;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(color);
    doc.text(money(it.value, pack.currency), x + 8, y + 24, {
      width: w - 16,
    });
    if (it.label === 'Gross profit' && s.revenue) {
      const pct = Math.round((s.grossProfit / s.revenue) * 100);
      doc.font('Helvetica').fontSize(7).fillColor(MUTED);
      doc.text(`${pct}% margin`, x + 8, y + 42, { width: w - 16 });
    }
    if (it.label === 'Operating profit' && s.revenue) {
      const pct = Math.round((s.operatingProfit / s.revenue) * 100);
      doc.font('Helvetica').fontSize(7).fillColor(MUTED);
      doc.text(`${pct}% of revenue`, x + 8, y + 42, { width: w - 16 });
    }
    if (it.label === 'Bank net') {
      doc.font('Helvetica').fontSize(7).fillColor(MUTED);
      doc.text(
        `In ${compact(s.bankIn)} · Out ${compact(s.bankOut)}`,
        x + 8,
        y + 42,
        { width: w - 16 }
      );
    }
  });
}

function panel(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string
) {
  doc.roundedRect(x, y, w, h, 6).fill('#ffffff');
  doc.roundedRect(x, y, w, h, 6).strokeColor(LINE).lineWidth(0.7).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
  doc.text(title, x + 10, y + 8, { width: w - 20 });
}

function drawWaterfall(
  doc: PdfDoc,
  pack: ManagementPack,
  x: number,
  y: number,
  w: number,
  h: number
) {
  panel(doc, x, y, w, h, 'Period P&L bridge');
  const s = pack.summary;
  const steps = [
    { label: 'Revenue', from: 0, to: s.revenue, fill: SKY },
    { label: 'COGS', from: s.revenue, to: s.grossProfit, fill: AMBER },
    { label: 'Gross', from: 0, to: s.grossProfit, fill: BRAND_DEEP },
    { label: 'Opex', from: s.grossProfit, to: s.operatingProfit, fill: AMBER },
    { label: 'Profit', from: 0, to: s.operatingProfit, fill: EMERALD },
  ];
  const chartX = x + 16;
  const chartY = y + 28;
  const chartW = w - 28;
  const chartH = h - 52;
  const n = steps.length;
  const gap = 10;
  const barW = (chartW - gap * (n - 1)) / n;
  const minV = Math.min(0, s.operatingProfit, s.grossProfit);
  const maxV = Math.max(s.revenue, 1);
  const span = Math.max(1, maxV - minV);
  const yAt = (v: number) => chartY + chartH - ((v - minV) / span) * chartH;
  doc.strokeColor(LINE).lineWidth(0.4);
  doc.moveTo(chartX - 4, yAt(0)).lineTo(chartX + chartW + 4, yAt(0)).stroke();
  steps.forEach((st, i) => {
    const bx = chartX + i * (barW + gap);
    const topV = Math.max(st.from, st.to);
    const botV = Math.min(st.from, st.to);
    const topY = yAt(topV);
    const botY = yAt(botV);
    const bh = Math.max(2, botY - topY);
    doc.rect(bx, topY, barW, bh).fill(st.fill);
    if (i > 0) {
      const prev = steps[i - 1];
      const prevRight = chartX + (i - 1) * (barW + gap) + barW;
      const connectorY = yAt(prev.to);
      doc
        .moveTo(prevRight, connectorY)
        .lineTo(bx, connectorY)
        .strokeColor('#94a3b8')
        .lineWidth(0.5)
        .stroke();
    }
    doc.font('Helvetica').fontSize(6.5).fillColor(SLATE);
    doc.text(st.label, bx - 2, y + h - 20, { width: barW + 4, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(INK);
    doc.text(compact(st.to - st.from === 0 ? st.to : Math.abs(st.to - st.from)), bx - 2, y + h - 11, {
      width: barW + 4,
      align: 'center',
    });
  });
}

function drawTrend(
  doc: PdfDoc,
  pack: ManagementPack,
  x: number,
  y: number,
  w: number,
  h: number
) {
  panel(doc, x, y, w, h, 'Revenue vs expenses (monthly)');
  const months = pack.months;
  if (!months.length) {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text('No monthly history in range', x + 12, y + 40);
    return;
  }
  const chartX = x + 36;
  const chartY = y + 26;
  const chartW = w - 48;
  const chartH = h - 50;
  const max = Math.max(
    1,
    ...months.map((m) => Math.max(m.revenue, m.expenses, Math.abs(m.net)))
  );
  const n = months.length;
  const slot = chartW / n;
  const group = Math.min(18, slot * 0.72);
  const barW = group / 2 - 1;

  // axis
  doc.strokeColor(LINE).lineWidth(0.5);
  doc.moveTo(chartX, chartY + chartH).lineTo(chartX + chartW, chartY + chartH).stroke();
  doc.font('Helvetica').fontSize(6).fillColor(MUTED);
  doc.text(compact(max), x + 8, chartY - 2, { width: 26, align: 'right' });
  doc.text('0', x + 8, chartY + chartH - 6, { width: 26, align: 'right' });

  months.forEach((m, i) => {
    const cx = chartX + i * slot + (slot - group) / 2;
    const hRev = (m.revenue / max) * chartH;
    const hExp = (m.expenses / max) * chartH;
    doc.rect(cx, chartY + chartH - hRev, barW, Math.max(1, hRev)).fill(SKY);
    doc
      .rect(cx + barW + 2, chartY + chartH - hExp, barW, Math.max(1, hExp))
      .fill('#fda4af');
    doc.font('Helvetica').fontSize(6).fillColor(SLATE);
    const short = m.label.split(' ')[0] || m.label;
    doc.text(short, chartX + i * slot, y + h - 16, {
      width: slot,
      align: 'center',
    });
  });

  doc.circle(x + w - 118, y + 12, 3).fill(SKY);
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED);
  doc.text('Revenue', x + w - 112, y + 8);
  doc.circle(x + w - 62, y + 12, 3).fill('#fda4af');
  doc.text('Expenses', x + w - 56, y + 8);
}

function drawMix(
  doc: PdfDoc,
  pack: ManagementPack,
  x: number,
  y: number,
  w: number,
  h: number
) {
  panel(doc, x, y, w, h, 'Largest income and expense lines');
  const rows: Array<MgmtPackLine & { kind: 'in' | 'ex' }> = [
    ...pack.income.slice(0, 4).map((r) => ({ ...r, kind: 'in' as const })),
    ...pack.expenses.slice(0, 5).map((r) => ({ ...r, kind: 'ex' as const })),
  ];
  if (!rows.length) {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text('No posted P&L lines in this period.', x + 12, y + 36);
    return;
  }
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
  const rowH = 20;
  const labelW = 132;
  const amtW = 78;
  const barX = x + 10 + labelW;
  const barMax = Math.max(40, w - 24 - labelW - amtW);
  rows.forEach((r, i) => {
    const ry = y + 28 + i * rowH;
    if (ry + rowH > y + h - 8) return;
    doc.font('Helvetica').fontSize(7).fillColor(SLATE);
    doc.text(`${r.code}  ${r.name}`.slice(0, 36), x + 10, ry + 4, {
      width: labelW - 4,
      ellipsis: true,
    });
    const bw = (Math.abs(r.amount) / max) * barMax;
    doc
      .roundedRect(barX, ry + 4, Math.max(2, bw), 10, 2)
      .fill(r.kind === 'in' ? '#67e8f9' : '#fecdd3');
    doc.font('Helvetica-Bold').fontSize(7).fillColor(INK);
    doc.text(money(r.amount, pack.currency), x + w - 10 - amtW, ry + 4, {
      width: amtW,
      align: 'right',
    });
  });
}

function drawRightBottom(
  doc: PdfDoc,
  pack: ManagementPack,
  x: number,
  y: number,
  w: number,
  h: number
) {
  panel(doc, x, y, w, h, 'Plan vs actual  ·  Cash  ·  Completeness');
  const col = (w - 24) / 2;
  const left = x + 10;
  const right = x + 12 + col;
  const top = y + 26;

  doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED);
  doc.text('BUDGET (PLAN)', left, top);
  const b = pack.budget;
  if (b?.hasBudget) {
    drawCompare(
      doc,
      left,
      top + 14,
      col - 8,
      'Revenue',
      b.budgetRevenue,
      b.actualRevenue,
      pack.currency,
      true
    );
    drawCompare(
      doc,
      left,
      top + 72,
      col - 8,
      'Expenses',
      b.budgetExpenses,
      b.actualExpenses,
      pack.currency,
      false
    );
    drawCompare(
      doc,
      left,
      top + 130,
      col - 8,
      'Net',
      b.budgetNet,
      b.actualNet,
      pack.currency,
      true
    );
  } else {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text(
      'No 12-month COA budget for this period. Enter a plan in Finance → Budget to unlock variance here.',
      left,
      top + 16,
      { width: col - 8 }
    );
  }

  doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED);
  doc.text('CASH & BOOKS', right, top);
  const s = pack.summary;
  const facts: Array<[string, string]> = [
    ['Bank in', money(s.bankIn, pack.currency)],
    ['Bank out', money(s.bankOut, pack.currency)],
    ['Bank net', money(s.bankNet, pack.currency)],
    ['Journals posted', String(s.journalCount)],
    ['Bank lines allocated', String(s.allocatedCount)],
    [
      'Unallocated bank lines',
      s.unallocated ? String(s.unallocated) : 'None',
    ],
  ];
  facts.forEach((f, i) => {
    const fy = top + 16 + i * 18;
    doc.font('Helvetica').fontSize(8).fillColor(SLATE);
    doc.text(f[0], right, fy, { width: col * 0.55 });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
    doc.text(f[1], right + col * 0.5, fy, {
      width: col * 0.45,
      align: 'right',
    });
  });

  if (s.unallocated > 0) {
    const by = y + h - 36;
    doc.roundedRect(right, by, col - 6, 26, 4).fill('#fffbeb');
    doc.font('Helvetica').fontSize(7).fillColor(AMBER);
    doc.text(
      `${s.unallocated} unallocated bank line(s) — P&L may be incomplete.`,
      right + 6,
      by + 7,
      { width: col - 18 }
    );
  }
}

function drawCompare(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  label: string,
  budget: number,
  actual: number,
  currency: string,
  higherIsGood: boolean
) {
  const varn = actual - budget;
  const good = higherIsGood ? varn >= 0 : varn <= 0;
  doc.font('Helvetica').fontSize(7).fillColor(MUTED);
  doc.text(label, x, y);
  doc.font('Helvetica').fontSize(7).fillColor(SLATE);
  doc.text(`Plan ${compact(budget)}`, x, y + 11);
  doc.text(`Act ${compact(actual)}`, x + w * 0.38, y + 11);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(good ? EMERALD : AMBER);
  doc.text(`${varn >= 0 ? '+' : ''}${compact(varn)}`, x + w * 0.68, y + 11, {
    width: w * 0.32,
    align: 'right',
  });
  const max = Math.max(Math.abs(budget), Math.abs(actual), 1);
  doc.roundedRect(x, y + 24, w, 6, 2).fill('#f1f5f9');
  doc
    .roundedRect(x, y + 24, Math.max(2, (Math.abs(budget) / max) * w), 6, 2)
    .fill('#cbd5e1');
  doc
    .roundedRect(x, y + 32, Math.max(2, (Math.abs(actual) / max) * w), 6, 2)
    .fill(good ? '#6ee7b7' : '#fdba74');
  void currency;
}

function drawFooter(doc: PdfDoc, pack: ManagementPack) {
  const y = PAGE_H - 26;
  doc.moveTo(MX, y - 4).lineTo(PAGE_W - MX, y - 4).strokeColor(LINE).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(6).fillColor(MUTED);
  doc.text(
    `${GAAP_DISCLAIMER_PDF_FOOTER} Compiled ${new Date().toISOString().slice(0, 10)}. ${pack.currency}. SupplierAdvisor Finance.`,
    MX,
    y,
    { width: PAGE_W - MX * 2, align: 'left' }
  );
}
