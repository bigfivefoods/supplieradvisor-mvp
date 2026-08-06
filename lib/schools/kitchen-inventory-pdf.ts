/**
 * School kitchen inventory levels PDF + CSV.
 * Landscape A4, grouped by category — pure pdfkit, Vercel serverless safe.
 */
import PDFDocument from 'pdfkit';
import type {
  KitchenInventoryRow,
  KitchenInventorySnapshot,
} from '@/lib/schools/kitchen-inventory';

export type KitchenInventoryPdfInput = {
  snapshot: KitchenInventorySnapshot;
  /** When true, only low / reorder / critical rows */
  lowOnly?: boolean;
  generatedAt?: Date;
};

// A4 landscape
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 28;
const CONTENT_W = PAGE_W - MX * 2;
const FOOTER_Y = PAGE_H - 24;

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

function num(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
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
        'SupplierAdvisor® · NSNP kitchen inventory · Approved brands only in stock',
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
  rows: KitchenInventoryRow[]
): Array<{ category: string; items: KitchenInventoryRow[] }> {
  const map = new Map<string, KitchenInventoryRow[]>();
  for (const r of rows) {
    const cat = String(r.category || 'Uncategorised').trim() || 'Uncategorised';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(r);
  }
  return [...map.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export async function buildKitchenInventoryPdf(
  input: KitchenInventoryPdfInput
): Promise<Buffer> {
  const generated = input.generatedAt || new Date();
  const snap = input.snapshot;
  let rows = snap.stock || [];
  if (input.lowOnly) {
    rows = rows.filter(
      (r) =>
        r.low_stock ||
        r.cover_status === 'reorder' ||
        r.cover_status === 'critical'
    );
  }
  const groups = groupByCategory(rows);
  const policy = snap.cover_policy;
  const planSum = snap.stock_plan?.summary;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      bufferPages: true,
      autoFirstPage: true,
      margins: {
        top: 72,
        bottom: 36,
        left: MX,
        right: MX,
      },
      info: {
        Title: 'Kitchen inventory levels',
        Author: 'SupplierAdvisor® · NSNP',
        Subject: snap.schoolName,
        CreationDate: generated,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const drawPageHeader = (first: boolean) => {
      withOpenMargins(doc, () => {
        doc.rect(0, 0, PAGE_W, 52).fill(BRAND_DEEP);
        doc.rect(0, 48, PAGE_W, 4).fill(BRAND);
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#bae6fd')
          .text('NSNP  ·  KITCHEN INVENTORY LEVELS', MX, 10, {
            characterSpacing: 1,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor('#ffffff')
          .text(snap.schoolName || 'School kitchen stock', MX, 24, {
            width: CONTENT_W * 0.55,
          });
        const meta = [
          input.lowOnly ? 'Filter: low / reorder only' : 'Full inventory',
          `${rows.length} product(s)`,
          `${snap.learners.toLocaleString('en-ZA')} learners`,
          `Cover ${policy.cover_days}d · reorder ≤ ${policy.reorder_cover_days}d · lead ${policy.lead_time_days}d`,
          `Printed ${generated.toISOString().slice(0, 10)}`,
        ].join('\n');
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#e0f2fe')
          .text(meta, MX + CONTENT_W * 0.55, 12, {
            width: CONTENT_W * 0.45,
            align: 'right',
          });
      });
      if (first) {
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(MUTED)
          .text(
            'On-hand quantities for the school kitchen. Days on hand and suggested orders use DBE menu demand × learners. Low stock (reorder / critical) is highlighted for the next SP order.',
            MX,
            60,
            { width: CONTENT_W }
          );
      }
    };

    drawPageHeader(true);
    let y = 78;

    // Summary cards
    const cards = [
      { label: 'Lines', value: String(rows.length) },
      { label: 'Low stock', value: String(snap.low_count) },
      {
        label: 'On menu',
        value: String(planSum?.products_with_demand ?? '—'),
      },
      {
        label: 'Reorder',
        value: String(planSum?.reorder_count ?? '—'),
      },
      {
        label: 'Critical',
        value: String(planSum?.critical_count ?? '—'),
      },
      {
        label: 'Recipes',
        value: String(snap.recipes_count),
      },
    ];
    const cardW = (CONTENT_W - 10 * 5) / 6;
    for (let i = 0; i < cards.length; i++) {
      const x = MX + i * (cardW + 10);
      doc.roundedRect(x, y, cardW, 34, 4).fill(SOFT);
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(MUTED)
        .text(cards[i].label.toUpperCase(), x + 6, y + 6, {
          width: cardW - 12,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(INK)
        .text(cards[i].value, x + 6, y + 16, { width: cardW - 12 });
    }
    y += 46;

    const col = {
      brand: MX,
      brandW: 90,
      name: MX + 90,
      nameW: 150,
      onHand: MX + 240,
      onHandW: 55,
      uom: MX + 295,
      uomW: 36,
      days: MX + 331,
      daysW: 48,
      daily: MX + 379,
      dailyW: 48,
      reorder: MX + 427,
      reorderW: 52,
      target: MX + 479,
      targetW: 52,
      suggest: MX + 531,
      suggestW: 52,
      status: MX + 583,
      statusW: CONTENT_W - 583,
    };

    const drawTableHeader = () => {
      doc.rect(MX, y, CONTENT_W, 16).fill(SOFT);
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(MUTED)
        .text('Brand', col.brand + 2, y + 4, { width: col.brandW })
        .text('Product', col.name + 2, y + 4, { width: col.nameW })
        .text('On hand', col.onHand + 2, y + 4, {
          width: col.onHandW - 4,
          align: 'right',
        })
        .text('UOM', col.uom + 2, y + 4, { width: col.uomW })
        .text('Days', col.days + 2, y + 4, {
          width: col.daysW - 4,
          align: 'right',
        })
        .text('Daily', col.daily + 2, y + 4, {
          width: col.dailyW - 4,
          align: 'right',
        })
        .text('Reorder', col.reorder + 2, y + 4, {
          width: col.reorderW - 4,
          align: 'right',
        })
        .text('Target', col.target + 2, y + 4, {
          width: col.targetW - 4,
          align: 'right',
        })
        .text('Suggest', col.suggest + 2, y + 4, {
          width: col.suggestW - 4,
          align: 'right',
        })
        .text('Status', col.status + 2, y + 4, { width: col.statusW });
      y += 18;
    };

    const ensureSpace = (need: number) => {
      if (y + need > FOOTER_Y - 8) {
        doc.addPage();
        drawPageHeader(false);
        y = 64;
        drawTableHeader();
      }
    };

    drawTableHeader();

    if (!rows.length) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(MUTED)
        .text(
          input.lowOnly
            ? 'No low-stock lines right now.'
            : 'No kitchen stock recorded yet. Receive GRNs from SP deliveries to build levels.',
          MX,
          y + 16,
          { width: CONTENT_W, align: 'center' }
        );
    } else {
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

        for (const r of group.items) {
          ensureSpace(16);
          const rowY = y;
          if (r.low_stock || r.cover_status === 'critical') {
            doc
              .rect(MX, rowY - 1, CONTENT_W, 14)
              .fill(
                r.cover_status === 'critical' ? '#fff1f2' : '#fffbeb'
              );
          } else if (Math.floor(y) % 2 === 0) {
            doc.rect(MX, rowY - 1, CONTENT_W, 14).fill('#fafafa');
          }
          doc
            .font('Helvetica-Bold')
            .fontSize(7)
            .fillColor(INK)
            .text(String(r.brand_name || '—'), col.brand + 2, rowY, {
              width: col.brandW - 2,
              ellipsis: true,
            });
          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor(INK)
            .text(String(r.product_name || '—'), col.name + 2, rowY, {
              width: col.nameW - 2,
              ellipsis: true,
            });
          doc
            .font('Helvetica-Bold')
            .fontSize(7.5)
            .fillColor(r.low_stock ? '#b45309' : INK)
            .text(num(r.qty_on_hand), col.onHand + 2, rowY, {
              width: col.onHandW - 4,
              align: 'right',
            });
          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor(MUTED)
            .text(String(r.uom || '—'), col.uom + 2, rowY, {
              width: col.uomW - 2,
            })
            .text(
              r.days_on_hand != null ? num(r.days_on_hand, 1) : '—',
              col.days + 2,
              rowY,
              { width: col.daysW - 4, align: 'right' }
            )
            .text(num(r.daily_usage, 3), col.daily + 2, rowY, {
              width: col.dailyW - 4,
              align: 'right',
            })
            .text(num(r.reorder_level), col.reorder + 2, rowY, {
              width: col.reorderW - 4,
              align: 'right',
            })
            .text(num(r.target_level), col.target + 2, rowY, {
              width: col.targetW - 4,
              align: 'right',
            })
            .text(num(r.suggested_order_qty), col.suggest + 2, rowY, {
              width: col.suggestW - 4,
              align: 'right',
            })
            .fillColor(
              r.cover_status === 'critical'
                ? '#be123c'
                : r.cover_status === 'reorder'
                  ? '#b45309'
                  : MUTED
            )
            .text(String(r.cover_status || '—'), col.status + 2, rowY, {
              width: col.statusW - 4,
              ellipsis: true,
            });
          y += 14;
        }
        y += 4;
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

export function kitchenInventoryPdfFilename(
  schoolName?: string | null,
  d = new Date(),
  lowOnly = false
): string {
  const day = d.toISOString().slice(0, 10);
  const safe = String(schoolName || 'School')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const tag = lowOnly ? 'LowStock' : 'Inventory';
  return `NSNP-Kitchen-${tag}-${safe || 'School'}-${day}.pdf`;
}

export function buildKitchenInventoryCsv(
  rows: KitchenInventoryRow[],
  meta?: {
    schoolName?: string;
    learners?: number;
    cover_days?: number;
    reorder_cover_days?: number;
    lead_time_days?: number;
  }
): string {
  const header = [
    'school_name',
    'learners',
    'cover_days',
    'reorder_cover_days',
    'lead_time_days',
    'category',
    'brand_name',
    'product_name',
    'approved_product_id',
    'qty_on_hand',
    'uom',
    'days_on_hand',
    'daily_usage',
    'reorder_level',
    'target_level',
    'min_level',
    'suggested_order_qty',
    'low_stock',
    'cover_status',
    'cover_message',
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map((r) =>
    [
      meta?.schoolName || '',
      meta?.learners ?? '',
      meta?.cover_days ?? '',
      meta?.reorder_cover_days ?? '',
      meta?.lead_time_days ?? '',
      r.category,
      r.brand_name,
      r.product_name,
      r.approved_product_id,
      r.qty_on_hand,
      r.uom,
      r.days_on_hand,
      r.daily_usage,
      r.reorder_level,
      r.target_level,
      r.min_level,
      r.suggested_order_qty,
      r.low_stock ? 'yes' : 'no',
      r.cover_status,
      r.cover_message,
    ]
      .map(escape)
      .join(',')
  );
  return `\uFEFF${header.join(',')}\n${lines.join('\n')}\n`;
}

export function kitchenInventoryCsvFilename(
  schoolName?: string | null,
  d = new Date(),
  lowOnly = false
): string {
  const day = d.toISOString().slice(0, 10);
  const safe = String(schoolName || 'School')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const tag = lowOnly ? 'LowStock' : 'Inventory';
  return `NSNP-Kitchen-${tag}-${safe || 'School'}-${day}.csv`;
}
