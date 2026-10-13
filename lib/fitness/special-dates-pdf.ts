/**
 * A4 landscape birthday and anniversary report.
 * Pure pdfkit — do not import this file from a client component.
 */
import PDFDocument from 'pdfkit';
import {
  BRAND_HERO_STOPS,
  BRAND_SAFE_TOP,
  fillBrandHGradient,
  paintBrandHeroBand,
} from '@/lib/pdf/brand-gradient';
import {
  formatSpecialDate,
  specialDateKindLabel,
  specialDateMonthLabel,
  specialDateWhen,
  type MemberSpecialDate,
  type MemberSpecialDateKind,
  type SpecialDatePlace,
} from '@/lib/fitness/member-special-dates';

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 28;
const CONTENT_W = PAGE_W - MX * 2;
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const ROW_H = 15;
const FOOTER_TOP = PAGE_H - 26;

export type SpecialDatesPdfRow = {
  name: string;
  kind: MemberSpecialDateKind;
  on: string;
  years: number | null;
  days_until: number;
  assignee?: string | null;
};

export type SpecialDatesPdfInput = {
  place: SpecialDatePlace;
  windowLabel: string;
  from: string;
  assigneeHeader: string;
  missingBirthdays: number;
  rows: SpecialDatesPdfRow[];
};

type PdfDoc = InstanceType<typeof PDFDocument>;

const COLS = [
  { key: 'when', label: 'When', w: 78 },
  { key: 'name', label: 'Name', w: 246 },
  { key: 'occasion', label: 'Occasion', w: 128 },
  { key: 'date', label: 'Date', w: 96 },
  { key: 'years', label: 'Years', w: 78 },
  { key: 'assignee', label: 'Coach', w: 160 },
] as const;

function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function yearsCopy(row: SpecialDatesPdfRow): string {
  if (row.years == null) return '—';
  if (row.kind === 'birthday') return `Turns ${row.years}`;
  if (row.kind === 'membership_anniversary') {
    return `${row.years} year${row.years === 1 ? '' : 's'}`;
  }
  return '—';
}

function whenCopy(row: SpecialDatesPdfRow): string {
  return specialDateWhen({
    kind: row.kind,
    days_until: row.days_until,
  } as MemberSpecialDate);
}

function cellText(
  row: SpecialDatesPdfRow,
  key: (typeof COLS)[number]['key'],
  place: SpecialDatePlace
): string {
  if (key === 'when') return whenCopy(row);
  if (key === 'name') return row.name;
  if (key === 'occasion') return specialDateKindLabel(row.kind, place);
  if (key === 'date') return formatSpecialDate(row.on);
  if (key === 'years') return yearsCopy(row);
  return row.assignee || '—';
}

function drawText(
  pdf: PdfDoc,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: {
    align?: 'left' | 'center' | 'right';
    font?: string;
    size?: number;
    color?: string;
  }
) {
  pdf
    .font(opts?.font || 'Helvetica')
    .fontSize(opts?.size || 8)
    .fillColor(opts?.color || INK);
  pdf.text(value, x, y, {
    width: w,
    height: h,
    align: opts?.align || 'left',
    lineBreak: false,
    ellipsis: true,
  });
}

function zeroMargins(pdf: PdfDoc) {
  const page = pdf.page;
  page.margins.top = 0;
  page.margins.bottom = 0;
  page.margins.left = 0;
  page.margins.right = 0;
}

function drawColumns(
  pdf: PdfDoc,
  y: number,
  assigneeHeader: string
): number {
  pdf.rect(MX, y, CONTENT_W, 14).fill('#f8fafc');
  pdf.moveTo(MX, y + 14).lineTo(MX + CONTENT_W, y + 14).strokeColor(LINE).stroke();
  let x = MX;
  for (const col of COLS) {
    const label = col.key === 'assignee' ? assigneeHeader : col.label;
    drawText(pdf, label.toUpperCase(), x + 4, y + 3, col.w - 8, 10, {
      font: 'Helvetica-Bold',
      size: 7,
      color: MUTED,
    });
    x += col.w;
  }
  return y + 16;
}

function drawContinuation(pdf: PdfDoc, assigneeHeader: string): number {
  zeroMargins(pdf);
  fillBrandHGradient(pdf, 0, 0, PAGE_W, 26, BRAND_HERO_STOPS, 80);
  drawText(pdf, 'Birthdays and anniversaries', MX, 8, 360, 12, {
    font: 'Helvetica-Bold',
    size: 10,
    color: '#ffffff',
  });
  return drawColumns(pdf, 34, assigneeHeader);
}

export function parseSpecialDatesPdfBody(
  body: unknown
): { ok: true; value: SpecialDatesPdfInput; windowId: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Report details are required' };
  }
  const src = body as Record<string, unknown>;
  const place = src.place === 'practice' ? 'practice' : src.place === 'gym' ? 'gym' : null;
  if (!place) return { ok: false, error: 'Choose GymAdvisor or MedicalAdvisor' };
  const from = String(src.from || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return { ok: false, error: 'A report date is required' };
  }
  const windowLabel = clean(src.windowLabel, 40) || 'Next 30 days';
  const windowId = clean(src.windowId, 12).toLowerCase().replace(/[^a-z0-9]/g, '') || '30';
  const assigneeHeader =
    clean(src.assigneeHeader, 24) || (place === 'practice' ? 'Clinician' : 'Coach');
  const missingRaw = Number(src.missingBirthdays);
  const missingBirthdays =
    Number.isFinite(missingRaw) && missingRaw >= 0 && missingRaw <= 100000
      ? Math.round(missingRaw)
      : 0;
  if (!Array.isArray(src.rows) || src.rows.length === 0 || src.rows.length > 1500) {
    return { ok: false, error: 'Choose a window that has people on the report' };
  }
  const rows: SpecialDatesPdfRow[] = [];
  for (const item of src.rows) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'A report row could not be read' };
    }
    const row = item as Record<string, unknown>;
    const name = clean(row.name, 180);
    const on = String(row.on || '').slice(0, 10);
    const kind = row.kind;
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(on)) {
      return { ok: false, error: 'A report row could not be read' };
    }
    if (
      kind !== 'birthday' &&
      kind !== 'membership_anniversary' &&
      kind !== 'joined'
    ) {
      return { ok: false, error: 'A report row could not be read' };
    }
    const years =
      row.years == null || row.years === ''
        ? null
        : Number(row.years);
    if (years != null && (!Number.isFinite(years) || years < 0 || years > 130)) {
      return { ok: false, error: 'A report row could not be read' };
    }
    const days = Number(row.days_until);
    if (!Number.isFinite(days) || days < -4000 || days > 4000) {
      return { ok: false, error: 'A report row could not be read' };
    }
    rows.push({
      name,
      kind,
      on,
      years: years == null ? null : Math.round(years),
      days_until: Math.round(days),
      assignee: clean(row.assignee, 120) || null,
    });
  }
  return {
    ok: true,
    windowId,
    value: {
      place,
      windowLabel,
      from,
      assigneeHeader,
      missingBirthdays,
      rows,
    },
  };
}

export function specialDatesPdfFilename(
  place: SpecialDatePlace,
  from: string,
  windowId: string
): string {
  const slug = place === 'practice' ? 'medicaladvisor' : 'gymadvisor';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : 'report';
  const win = clean(windowId, 12).toLowerCase().replace(/[^a-z0-9]/g, '') || 'window';
  return `${slug}-birthdays-${day}-${win}.pdf`;
}

export async function buildSpecialDatesPdf(
  input: SpecialDatesPdfInput,
  opts?: { compress?: boolean }
): Promise<Buffer> {
  const place = input.place;
  const brand = place === 'practice' ? 'MedicalAdvisor' : 'GymAdvisor';
  const birthdays = input.rows.filter((row) => row.kind === 'birthday').length;
  const anniversaries = input.rows.filter(
    (row) => row.kind === 'membership_anniversary'
  ).length;
  const household = input.rows.filter((row) => row.name.includes(' · ')).length;

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      compress: opts?.compress !== false,
      bufferPages: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `${brand} birthdays and anniversaries`,
        Author: 'SupplierAdvisor',
        Subject: input.windowLabel,
      },
    });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    zeroMargins(pdf);

    const heroH = paintBrandHeroBand(pdf, { innerH: 36, mx: MX, glass: true });
    const heroTextY = BRAND_SAFE_TOP + 4;
    drawText(pdf, 'SupplierAdvisor', MX + 10, heroTextY, 280, 14, {
      font: 'Helvetica-Bold',
      size: 13,
      color: '#ffffff',
    });
    drawText(pdf, 'Birthdays and anniversaries', MX + 10, heroTextY + 16, 320, 12, {
      size: 8,
      color: '#ecfeff',
    });
    drawText(pdf, brand, MX, heroTextY + 2, CONTENT_W, 14, {
      font: 'Helvetica-Bold',
      size: 11,
      color: '#ffffff',
      align: 'right',
    });
    drawText(pdf, input.windowLabel, MX, heroTextY + 16, CONTENT_W, 11, {
      size: 8,
      color: '#f0fdfa',
      align: 'right',
    });

    let y = heroH + 12;
    const summary = [
      `From ${formatSpecialDate(input.from)}`,
      `${birthdays} birthday${birthdays === 1 ? '' : 's'}`,
      `${anniversaries} anniversar${anniversaries === 1 ? 'y' : 'ies'}`,
      `${household} household`,
      input.missingBirthdays > 0
        ? `${input.missingBirthdays} with no birthday on file`
        : null,
    ]
      .filter(Boolean)
      .join('   ·   ');
    drawText(pdf, summary, MX, y, CONTENT_W, 12, {
      size: 9,
      color: MUTED,
    });
    y += 16;
    y = drawColumns(pdf, y, input.assigneeHeader);

    let month = '';
    for (const row of input.rows) {
      const nextMonth = row.on.slice(0, 7);
      const need = (nextMonth !== month ? 16 : 0) + ROW_H;
      if (y + need > FOOTER_TOP) {
        pdf.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
        zeroMargins(pdf);
        y = drawContinuation(pdf, input.assigneeHeader);
        month = '';
      }
      if (nextMonth !== month) {
        month = nextMonth;
        pdf.rect(MX, y, CONTENT_W, 14).fill('#e0f2fe');
        drawText(pdf, specialDateMonthLabel(row.on), MX + 4, y + 3, CONTENT_W - 8, 10, {
          font: 'Helvetica-Bold',
          size: 8,
          color: '#0c4a6e',
        });
        y += 16;
      }
      let x = MX;
      for (const col of COLS) {
        drawText(
          pdf,
          cellText(row, col.key, place),
          x + 4,
          y + 3,
          col.w - 8,
          11,
          {
            font: col.key === 'name' ? 'Helvetica-Bold' : 'Helvetica',
            size: 8,
            color: col.key === 'name' ? INK : '#334155',
          }
        );
        x += col.w;
      }
      pdf
        .moveTo(MX, y + ROW_H - 1)
        .lineTo(MX + CONTENT_W, y + ROW_H - 1)
        .strokeColor(LINE)
        .lineWidth(0.4)
        .stroke();
      y += ROW_H;
    }

    const range = pdf.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      pdf.switchToPage(range.start + i);
      zeroMargins(pdf);
      drawText(
        pdf,
        `SupplierAdvisor · ${brand} · Page ${i + 1} of ${range.count}`,
        MX,
        PAGE_H - 18,
        CONTENT_W,
        10,
        { size: 7, color: MUTED, align: 'right' }
      );
    }
    pdf.end();
  });
}
