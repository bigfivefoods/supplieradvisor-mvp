/**
 * NSNP approved foods catalogue PDF — DBE, schools, SPs.
 * Grouped by category; A4 portrait multi-page.
 * Pure pdfkit — Vercel serverless safe.
 */
import PDFDocument from 'pdfkit';

export type ApprovedFoodsPdfProduct = {
  id: number | string;
  name: string;
  brand_name?: string | null;
  category?: string | null;
  uom?: string | null;
  province?: string | null;
  for_breakfast?: boolean | null;
  for_lunch?: boolean | null;
  active?: boolean | null;
  barcode?: string | null;
  sku?: string | null;
};

export type ApprovedFoodsPdfInput = {
  agencyName?: string | null;
  schoolName?: string | null;
  roleLabel?: string | null;
  products: ApprovedFoodsPdfProduct[];
  generatedAt?: Date;
  /** When true, include inactive products (DBE full list) */
  includeInactive?: boolean;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 36;
const CONTENT_W = PAGE_W - MX * 2;
const FOOTER_Y = PAGE_H - 28;

const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';

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
    const y = FOOTER_Y;
    doc
      .moveTo(MX, y - 6)
      .lineTo(PAGE_W - MX, y - 6)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        'SupplierAdvisor® · NSNP approved foods · Only listed brands may enter kitchen stock',
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

function groupByCategory(
  products: ApprovedFoodsPdfProduct[]
): Array<{ category: string; items: ApprovedFoodsPdfProduct[] }> {
  const map = new Map<string, ApprovedFoodsPdfProduct[]>();
  for (const p of products) {
    const cat = String(p.category || 'Uncategorised').trim() || 'Uncategorised';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(p);
  }
  for (const items of map.values()) {
    items.sort((a, b) => {
      const ba = String(a.brand_name || '').localeCompare(
        String(b.brand_name || '')
      );
      if (ba !== 0) return ba;
      return String(a.name).localeCompare(String(b.name));
    });
  }
  return [...map.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

/**
 * Multi-page A4 catalogue PDF grouped by category.
 */
export async function buildApprovedFoodsPdf(
  input: ApprovedFoodsPdfInput
): Promise<Buffer> {
  const generated = input.generatedAt || new Date();
  let products = input.products || [];
  if (!input.includeInactive) {
    products = products.filter((p) => p.active !== false);
  }
  const groups = groupByCategory(products);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      autoFirstPage: true,
      margins: {
        top: 72,
        bottom: 40,
        left: MX,
        right: MX,
      },
      info: {
        Title: 'NSNP Approved Foods Catalogue',
        Author: 'SupplierAdvisor® · NSNP',
        Subject: 'Department approved foods list',
        CreationDate: generated,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const drawPageHeader = (first: boolean) => {
      withOpenMargins(doc, () => {
        doc.rect(0, 0, PAGE_W, 56).fill(BRAND_DEEP);
        doc.rect(0, 52, PAGE_W, 4).fill(BRAND);
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#bae6fd')
          .text('NSNP  ·  APPROVED FOODS CATALOGUE', MX, 12, {
            characterSpacing: 1,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor('#ffffff')
          .text(
            input.agencyName
              ? `${input.agencyName} — approved list`
              : 'Department approved foods',
            MX,
            26,
            { width: CONTENT_W * 0.65 }
          );
        const meta = [
          input.schoolName ? `School: ${input.schoolName}` : null,
          input.roleLabel || null,
          `${products.length} product(s)`,
          `Printed ${generated.toISOString().slice(0, 10)}`,
        ]
          .filter(Boolean)
          .join('\n');
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#e0f2fe')
          .text(meta, MX + CONTENT_W * 0.62, 18, {
            width: CONTENT_W * 0.38,
            align: 'right',
          });
      });
      if (first) {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text(
            'Schools may only order and GRN products on this list. SPs supply these brands (or declared same-category approved substitutes). Commercial extras on a DN score 0 and do not enter kitchen stock.',
            MX,
            64,
            { width: CONTENT_W }
          );
      }
    };

    drawPageHeader(true);
    let y = 92;

    // Column headers
    const col = {
      brand: MX,
      brandW: 100,
      name: MX + 100,
      nameW: 200,
      cat: MX + 300,
      catW: 80,
      meal: MX + 380,
      mealW: 55,
      uom: MX + 435,
      uomW: 40,
      prov: MX + 475,
      provW: 84,
    };

    const ensureSpace = (need: number) => {
      if (y + need > FOOTER_Y - 8) {
        doc.addPage();
        drawPageHeader(false);
        y = 72;
        drawTableHeader();
      }
    };

    const drawTableHeader = () => {
      doc.rect(MX, y, CONTENT_W, 16).fill(SOFT);
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(MUTED)
        .text('Brand', col.brand + 2, y + 4, { width: col.brandW })
        .text('Product', col.name + 2, y + 4, { width: col.nameW })
        .text('Category', col.cat + 2, y + 4, { width: col.catW })
        .text('Meal', col.meal + 2, y + 4, { width: col.mealW })
        .text('UOM', col.uom + 2, y + 4, { width: col.uomW })
        .text('Province', col.prov + 2, y + 4, { width: col.provW });
      y += 18;
    };

    drawTableHeader();

    for (const group of groups) {
      ensureSpace(28);
      doc.roundedRect(MX, y, CONTENT_W, 16, 3).fill('#e0f2fe');
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(BRAND_DEEP)
        .text(
          `${group.category}  ·  ${group.items.length} item(s)`,
          MX + 6,
          y + 4,
          { width: CONTENT_W - 12 }
        );
      y += 20;

      for (const p of group.items) {
        ensureSpace(18);
        const meal = [
          p.for_breakfast ? 'B' : null,
          p.for_lunch ? 'L' : null,
        ]
          .filter(Boolean)
          .join('+') || '—';
        const rowY = y;
        // zebra
        if (Math.floor(y) % 2 === 0) {
          doc.rect(MX, rowY - 1, CONTENT_W, 14).fill('#fafafa');
        }
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(INK)
          .text(String(p.brand_name || '—'), col.brand + 2, rowY, {
            width: col.brandW - 2,
            ellipsis: true,
          });
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(INK)
          .text(String(p.name || '—'), col.name + 2, rowY, {
            width: col.nameW - 2,
            ellipsis: true,
          });
        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor(MUTED)
          .text(String(p.category || '—'), col.cat + 2, rowY, {
            width: col.catW - 2,
            ellipsis: true,
          })
          .text(meal, col.meal + 2, rowY, { width: col.mealW - 2 })
          .text(String(p.uom || '—'), col.uom + 2, rowY, {
            width: col.uomW - 2,
          })
          .text(String(p.province || '—'), col.prov + 2, rowY, {
            width: col.provW - 2,
            ellipsis: true,
          });
        if (p.active === false) {
          doc
            .font('Helvetica')
            .fontSize(6)
            .fillColor('#dc2626')
            .text('inactive', col.prov + 2, rowY + 7, {
              width: col.provW - 2,
            });
        }
        y += 14;
      }
      y += 6;
    }

    if (!products.length) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(MUTED)
        .text(
          'No approved products on this catalogue yet. DBE should import or add products on Approved foods.',
          MX,
          y + 20,
          { width: CONTENT_W, align: 'center' }
        );
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, i + 1, range.count);
    }
    doc.end();
  });
}

export function approvedFoodsPdfFilename(
  agencyName?: string | null,
  d = new Date()
): string {
  const day = d.toISOString().slice(0, 10);
  const safe = String(agencyName || 'NSNP')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `NSNP-Approved-Foods-${safe || 'Catalogue'}-${day}.pdf`;
}

/** CSV export (UTF-8 BOM for Excel) */
export function buildApprovedFoodsCsv(
  products: ApprovedFoodsPdfProduct[]
): string {
  const header = [
    'id',
    'brand_name',
    'name',
    'category',
    'uom',
    'province',
    'for_breakfast',
    'for_lunch',
    'active',
    'sku',
    'barcode',
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = products.map((p) =>
    [
      p.id,
      p.brand_name,
      p.name,
      p.category,
      p.uom,
      p.province,
      p.for_breakfast ? 'yes' : 'no',
      p.for_lunch ? 'yes' : 'no',
      p.active === false ? 'no' : 'yes',
      p.sku,
      p.barcode,
    ]
      .map(escape)
      .join(',')
  );
  return `\uFEFF${header.join(',')}\n${rows.join('\n')}\n`;
}

export function approvedFoodsCsvFilename(
  agencyName?: string | null,
  d = new Date()
): string {
  const day = d.toISOString().slice(0, 10);
  const safe = String(agencyName || 'NSNP')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `NSNP-Approved-Foods-${safe || 'Catalogue'}-${day}.csv`;
}
