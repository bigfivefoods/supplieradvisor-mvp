/**
 * NSNP annual feeding calendar PDF for DBE, schools, and SPs.
 * Page 1: year summary (terms + months). Pages 2–4: monthly mini-calendars.
 * Pure pdfkit — Vercel serverless safe.
 */
import PDFDocument from 'pdfkit';
import {
  isoWeekday,
  parseIso,
  summarizeMonths,
  summarizeTerms,
  yearFeedingTotal,
  type FeedingCalendarDay,
  type FeedingTerm,
} from '@/lib/schools/feeding-calendar';

export type FeedingCalendarPdfInput = {
  year: number;
  name: string;
  agencyName?: string | null;
  schoolName?: string | null;
  roleLabel?: string | null;
  status?: string | null;
  notes?: string | null;
  terms: FeedingTerm[];
  days: FeedingCalendarDay[];
  generatedAt?: Date;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 36;
const CONTENT_W = PAGE_W - MX * 2;

const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const FEED = '#0284c7';
const HOLIDAY = '#e11d48';
const CLOSED = '#94a3b8';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type PdfDoc = InstanceType<typeof PDFDocument>;

function withOpenMargins(doc: PdfDoc, fn: () => void) {
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

function drawFooter(doc: PdfDoc, pageNum: number, total: number) {
  withOpenMargins(doc, () => {
    const y = PAGE_H - 24;
    doc
      .moveTo(MX, y - 4)
      .lineTo(PAGE_W - MX, y - 4)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        'SupplierAdvisor® · NSNP feeding calendar · Programme days for meals, MPS & claims',
        MX,
        y,
        { width: CONTENT_W * 0.72 }
      );
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(`Page ${pageNum} of ${total}`, MX, y, {
        width: CONTENT_W,
        align: 'right',
      });
  });
}

function drawHeader(
  doc: PdfDoc,
  input: FeedingCalendarPdfInput,
  subtitle?: string
) {
  withOpenMargins(doc, () => {
    doc.rect(0, 0, PAGE_W, 58).fill(BRAND_DEEP);
    doc.rect(0, 54, PAGE_W, 4).fill(BRAND);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#bae6fd')
      .text('NSNP  ·  FEEDING CALENDAR  ·  ANNUAL', MX, 12, {
        characterSpacing: 1,
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor('#ffffff')
      .text(input.name || `NSNP feeding calendar ${input.year}`, MX, 26, {
        width: CONTENT_W * 0.62,
      });
    const meta = [
      `Year ${input.year}`,
      input.agencyName ? `Department: ${input.agencyName}` : null,
      input.schoolName ? `School: ${input.schoolName}` : null,
      input.roleLabel ? input.roleLabel : null,
      input.status ? `Status: ${input.status}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#e0f2fe')
      .text(meta, MX + CONTENT_W * 0.55, 18, {
        width: CONTENT_W * 0.45,
        align: 'right',
      });
  });
  if (subtitle) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(subtitle, MX, 68, { width: CONTENT_W });
  }
}

function daysForMonth(
  days: FeedingCalendarDay[],
  year: number,
  month: number
): FeedingCalendarDay[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return days.filter((d) => d.feed_date.startsWith(prefix));
}

function drawMiniMonth(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  year: number,
  month: number,
  days: FeedingCalendarDay[]
) {
  const byDate = new Map(days.map((d) => [d.feed_date, d]));
  doc.roundedRect(x, y, w, h, 5).fillAndStroke(SOFT, LINE);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(BRAND_DEEP)
    .text(MONTH_LABELS[month - 1], x + 4, y + 4, { width: w - 8 });

  const feedN = days.filter((d) => d.is_feeding).length;
  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor(MUTED)
    .text(`${feedN} feed day(s)`, x + 4, y + 14, { width: w - 8 });

  const cellW = (w - 8) / 7;
  const startY = y + 26;
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  labels.forEach((lb, i) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(5.5)
      .fillColor(MUTED)
      .text(lb, x + 4 + i * cellW, startY, {
        width: cellW,
        align: 'center',
      });
  });

  const first = new Date(year, month - 1, 1, 12, 0, 0);
  const startWd = isoWeekday(first); // 1 Mon
  const daysInMonth = new Date(year, month, 0).getDate();
  const cellH = Math.min(11, (h - 40) / 6);
  let col = startWd - 1;
  let row = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const info = byDate.get(iso);
    const cx = x + 4 + col * cellW;
    const cy = startY + 10 + row * cellH;
    let bg = '#f1f5f9';
    let fg = MUTED;
    if (info?.is_feeding) {
      bg = FEED;
      fg = '#ffffff';
    } else if (info?.day_type === 'public_holiday') {
      bg = '#ffe4e6';
      fg = HOLIDAY;
    } else if (info?.day_type === 'school_holiday') {
      bg = '#fef3c7';
      fg = '#92400e';
    } else if (info?.day_type === 'weekend') {
      bg = '#f8fafc';
      fg = CLOSED;
    }
    doc.roundedRect(cx + 0.5, cy, cellW - 1, cellH - 1, 1.5).fill(bg);
    doc
      .font('Helvetica-Bold')
      .fontSize(5.5)
      .fillColor(fg)
      .text(String(day), cx, cy + 1.5, { width: cellW - 1, align: 'center' });
    col += 1;
    if (col > 6) {
      col = 0;
      row += 1;
    }
  }
}

/**
 * Build multi-page A4 feeding calendar PDF.
 */
export async function buildFeedingCalendarPdf(
  input: FeedingCalendarPdfInput
): Promise<Buffer> {
  const generated = input.generatedAt || new Date();
  const days = input.days || [];
  const terms = input.terms || [];
  const yearTotal = yearFeedingTotal(days);
  const monthSum = summarizeMonths(days);
  const termSum = summarizeTerms(terms, days);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      bufferPages: true,
      autoFirstPage: true,
      margins: { top: 0, bottom: 32, left: MX, right: MX },
      info: {
        Title: `NSNP Feeding Calendar ${input.year}`,
        Author: 'SupplierAdvisor® · NSNP',
        Subject: 'Annual NSNP feeding days',
        CreationDate: generated,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── PAGE 1: Summary ──────────────────────────────────────────────
    drawHeader(
      doc,
      input,
      input.notes ||
        'Feeding days drive meal counts, kitchen planning, SP volumes and claims.'
    );
    let y = 82;

    // Big total
    doc.roundedRect(MX, y, CONTENT_W, 48, 8).fillAndStroke('#e0f2fe', '#7dd3fc');
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(BRAND_DEEP)
      .text('YEAR FEEDING DAYS', MX + 14, y + 10);
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(INK)
      .text(String(yearTotal), MX + 14, y + 22);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `Printed ${generated.toISOString().slice(0, 10)} · Schools & SPs use the published calendar only`,
        MX + CONTENT_W * 0.35,
        y + 18,
        { width: CONTENT_W * 0.6 }
      );
    y += 60;

    // Legend
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text('LEGEND', MX, y);
    y += 12;
    const legend = [
      { c: FEED, t: 'Feeding day' },
      { c: '#fda4af', t: 'Public holiday' },
      { c: '#fcd34d', t: 'School holiday' },
      { c: '#cbd5e1', t: 'Weekend / closed' },
    ];
    legend.forEach((L, i) => {
      const x = MX + i * 120;
      doc.roundedRect(x, y, 10, 10, 2).fill(L.c);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(INK)
        .text(L.t, x + 14, y + 1);
    });
    y += 22;

    // Terms table
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('TERMS', MX, y);
    y += 12;
    const termCols = [40, 100, 70, 70, 70, 80];
    const termHeaders = ['#', 'Name', 'From', 'To', 'Feed days', 'Calendar days'];
    let tx = MX;
    termHeaders.forEach((h, i) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(MUTED)
        .text(h, tx, y, { width: termCols[i] });
      tx += termCols[i];
    });
    y += 12;
    doc
      .moveTo(MX, y)
      .lineTo(PAGE_W - MX, y)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    y += 6;
    for (const t of termSum) {
      tx = MX;
      const vals = [
        String(t.term),
        t.name,
        t.from,
        t.to,
        String(t.feeding_days),
        String(t.calendar_days),
      ];
      vals.forEach((v, i) => {
        doc
          .font(i === 0 || i === 4 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(8)
          .fillColor(INK)
          .text(v, tx, y, { width: termCols[i] });
        tx += termCols[i];
      });
      y += 14;
    }

    y += 10;
    // Months table
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('MONTHLY FEEDING DAYS', MX, y);
    y += 12;
    const mCols = 4;
    const boxW = (CONTENT_W - 12) / mCols;
    const boxH = 36;
    monthSum.forEach((m, i) => {
      const col = i % mCols;
      const row = Math.floor(i / mCols);
      const x = MX + col * (boxW + 4);
      const by = y + row * (boxH + 4);
      doc.roundedRect(x, by, boxW, boxH, 5).fillAndStroke(SOFT, LINE);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(INK)
        .text(m.label, x + 6, by + 6, { width: boxW - 12 });
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(FEED)
        .text(String(m.feeding_days), x + 6, by + 18);
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(MUTED)
        .text('feed days', x + 28, by + 22);
    });

    // ── PAGES 2–4: month grids (4 months per page) ───────────────────
    for (let pageStart = 1; pageStart <= 12; pageStart += 4) {
      doc.addPage();
      drawHeader(
        doc,
        input,
        `Monthly grids · ${MONTH_LABELS[pageStart - 1]} – ${MONTH_LABELS[Math.min(pageStart + 2, 11)]}`
      );
      let gy = 78;
      const gap = 10;
      const gridW = (CONTENT_W - gap) / 2;
      const gridH = 160;
      for (let i = 0; i < 4; i++) {
        const month = pageStart + i;
        if (month > 12) break;
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = MX + col * (gridW + gap);
        const my = gy + row * (gridH + gap);
        const mdays = daysForMonth(days, input.year, month);
        drawMiniMonth(doc, x, my, gridW, gridH, input.year, month, mdays);
      }

      // Public holidays list for these months (compact)
      gy = 78 + 2 * (gridH + gap) + 8;
      const hol = days.filter(
        (d) =>
          d.day_type === 'public_holiday' &&
          Number(d.feed_date.slice(5, 7)) >= pageStart &&
          Number(d.feed_date.slice(5, 7)) < pageStart + 4
      );
      if (hol.length) {
        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(MUTED)
          .text('PUBLIC HOLIDAYS IN THIS PERIOD', MX, gy);
        gy += 11;
        const holText = hol
          .map((h) => `${h.feed_date}: ${h.label || 'Public holiday'}`)
          .join('  ·  ');
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(INK)
          .text(holText, MX, gy, { width: CONTENT_W });
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, i + 1, range.count);
    }
    doc.end();
  });
}

export function feedingCalendarPdfFilename(
  year: number,
  d = new Date()
): string {
  return `NSNP-Feeding-Calendar-${year}-${d.toISOString().slice(0, 10)}.pdf`;
}
