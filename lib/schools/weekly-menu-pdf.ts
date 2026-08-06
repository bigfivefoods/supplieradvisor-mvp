/**
 * NSNP weekly menu PDF (A4 landscape) — school kitchen / notice board printout.
 * Pure pdfkit — Vercel serverless safe.
 */
import PDFDocument from 'pdfkit';
import {
  SCHOOL_WEEK_DAYS,
  type MealTypeKey,
} from '@/lib/schools/meal-guide';
import type { MenuCycleItem } from '@/lib/schools/agency-menu';

export type WeeklyMenuPdfInput = {
  menuName: string;
  agencyName?: string | null;
  schoolName?: string | null;
  description?: string | null;
  items: MenuCycleItem[];
  /** product id → "Brand · Name" */
  productLabels: Record<number, string>;
  generatedAt?: Date;
};

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 28;
const CONTENT_W = PAGE_W - MX * 2;

const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const AMBER = '#d97706';
const SKY = '#0284c7';

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

function slotFor(
  items: MenuCycleItem[],
  day: number,
  meal: MealTypeKey
): MenuCycleItem | null {
  return (
    items.find(
      (it) =>
        Number(it.day) === day &&
        String(it.meal_type || 'lunch').toLowerCase() === meal
    ) || null
  );
}

function productsText(
  it: MenuCycleItem | null,
  labels: Record<number, string>
): string {
  if (!it) return '—';
  const dish = String(it.dish || '').trim();
  const ids = it.approved_product_ids || [];
  const prods = ids
    .map((id) => labels[id])
    .filter(Boolean) as string[];
  const parts: string[] = [];
  if (dish) parts.push(dish);
  if (prods.length) parts.push(prods.join('; '));
  else if (!dish) parts.push('No products listed');
  if (it.notes) parts.push(`Note: ${it.notes}`);
  return parts.join('\n') || '—';
}

/**
 * One-page A4 landscape weekly menu for kitchen / notice board.
 */
export async function buildWeeklyMenuPdf(
  input: WeeklyMenuPdfInput
): Promise<Buffer> {
  const generated = input.generatedAt || new Date();
  const dayCount = SCHOOL_WEEK_DAYS.length; // Mon–Fri

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      bufferPages: true,
      autoFirstPage: true,
      margins: { top: 0, bottom: 28, left: MX, right: MX },
      info: {
        Title: `NSNP Weekly Menu — ${input.menuName}`,
        Author: 'SupplierAdvisor® · NSNP',
        Subject: 'National School Nutrition Programme weekly menu',
        CreationDate: generated,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    withOpenMargins(doc, () => {
      // Header band
      doc.rect(0, 0, PAGE_W, 56).fill(BRAND_DEEP);
      doc.rect(0, 52, PAGE_W, 4).fill(BRAND);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#bae6fd')
        .text('NSNP  ·  WEEKLY MENU  ·  BREAKFAST + LUNCH', MX, 12, {
          width: CONTENT_W,
          characterSpacing: 1,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#ffffff')
        .text(input.menuName || 'Programme weekly menu', MX, 26, {
          width: CONTENT_W * 0.62,
        });
      const rightMeta = [
        input.agencyName ? `Department: ${input.agencyName}` : null,
        input.schoolName ? `School: ${input.schoolName}` : null,
        `Printed ${generated.toISOString().slice(0, 10)}`,
      ]
        .filter(Boolean)
        .join('\n');
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#e0f2fe')
        .text(rightMeta, MX + CONTENT_W * 0.62, 22, {
          width: CONTENT_W * 0.38,
          align: 'right',
        });
    });

    let y = 68;
    if (input.description) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED)
        .text(String(input.description), MX, y, { width: CONTENT_W });
      y = doc.y + 8;
    }

    // Legend
    doc.roundedRect(MX, y, 90, 14, 3).fill('#fef3c7');
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(AMBER)
      .text('BREAKFAST', MX + 6, y + 3.5);
    doc.roundedRect(MX + 98, y, 70, 14, 3).fill('#e0f2fe');
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(SKY)
      .text('LUNCH', MX + 104, y + 3.5);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        'Only DBE-approved catalogue products · Order from your service provider on SupplierAdvisor®',
        MX + 180,
        y + 3.5,
        { width: CONTENT_W - 180 }
      );
    y += 22;

    const gap = 6;
    const colW = (CONTENT_W - gap * (dayCount - 1)) / dayCount;
    const headerH = 22;
    const cellH = (PAGE_H - y - 36 - headerH - 8) / 2; // two meal rows

    // Day headers
    SCHOOL_WEEK_DAYS.forEach((d, i) => {
      const x = MX + i * (colW + gap);
      doc.roundedRect(x, y, colW, headerH, 4).fill(BRAND_DEEP);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#ffffff')
        .text(d.label, x + 4, y + 6, { width: colW - 8, align: 'center' });
    });
    y += headerH + 4;

    const drawMealRow = (meal: MealTypeKey, top: number, fill: string) => {
      SCHOOL_WEEK_DAYS.forEach((d, i) => {
        const x = MX + i * (colW + gap);
        const it = slotFor(input.items, d.day, meal);
        doc
          .roundedRect(x, top, colW, cellH, 4)
          .fillAndStroke(fill, LINE);
        // Meal chip
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor(meal === 'breakfast' ? AMBER : SKY)
          .text(meal === 'breakfast' ? 'BREAKFAST' : 'LUNCH', x + 5, top + 5, {
            width: colW - 10,
          });
        const body = productsText(it, input.productLabels);
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(INK)
          .text(body, x + 5, top + 16, {
            width: colW - 10,
            height: cellH - 22,
            ellipsis: true,
          });
      });
    };

    drawMealRow('breakfast', y, '#fffbeb');
    drawMealRow('lunch', y + cellH + 4, '#f0f9ff');

    // Footer
    withOpenMargins(doc, () => {
      const fy = PAGE_H - 22;
      doc
        .moveTo(MX, fy - 6)
        .lineTo(PAGE_W - MX, fy - 6)
        .strokeColor(LINE)
        .lineWidth(0.5)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(
          'SupplierAdvisor® · NSNP weekly menu · System of record for programme meals',
          MX,
          fy,
          { width: CONTENT_W * 0.7 }
        );
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text('A4 landscape · 1 page', MX, fy, {
          width: CONTENT_W,
          align: 'right',
        });
    });

    doc.end();
  });
}

export function weeklyMenuPdfFilename(
  menuName: string,
  d = new Date()
): string {
  const day = d.toISOString().slice(0, 10);
  const safe = String(menuName || 'NSNP-Menu')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `NSNP-Weekly-Menu-${safe || 'Menu'}-${day}.pdf`;
}
