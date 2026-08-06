/**
 * SP SLA · OTIFEF scorecard PDF + CSV for the selected cover period.
 * Landscape A4 table — DBE, schools, and SPs.
 * Pure pdfkit — Vercel serverless safe.
 */
import PDFDocument from 'pdfkit';
import type { IspSlaRow, IspSlaSummary } from '@/lib/schools/isp-sla-scorecard';

export type IspSlaPdfInput = {
  periodFrom: string;
  periodTo: string;
  /** PeriodSlicer label e.g. "YTD" or "Mar + Apr 2026" */
  periodLabel?: string | null;
  roleLabel?: string | null;
  schoolName?: string | null;
  agencyName?: string | null;
  viewerName?: string | null;
  isps: IspSlaRow[];
  summary: IspSlaSummary;
  legend?: {
    on_time?: string;
    in_full?: string;
    error_free?: string;
    composite?: string;
  } | null;
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

function pct(v: number | null | undefined): string {
  return v != null && Number.isFinite(Number(v)) ? `${Number(v)}%` : '—';
}

function money(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `R ${Number(v).toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
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
        'SupplierAdvisor® · SP SLA · OTIFEF = On-Time · In-Full · Error-Free',
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

/**
 * Multi-page landscape scorecard for the selected slicer cover period.
 */
export async function buildIspSlaPdf(input: IspSlaPdfInput): Promise<Buffer> {
  const generated = input.generatedAt || new Date();
  const isps = input.isps || [];
  const summary = input.summary || {
    deliveries: 0,
    otifef_pct: null,
    compliance_pct: null,
    isp_count: 0,
    preferred: 0,
    probation: 0,
  };

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
        Title: 'SP SLA · OTIFEF scorecard',
        Author: 'SupplierAdvisor® · NSNP',
        Subject: `OTIFEF ${input.periodFrom} → ${input.periodTo}`,
        CreationDate: generated,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const periodBit =
      input.periodLabel ||
      `${input.periodFrom} → ${input.periodTo}`;

    const drawPageHeader = (first: boolean) => {
      withOpenMargins(doc, () => {
        doc.rect(0, 0, PAGE_W, 52).fill(BRAND_DEEP);
        doc.rect(0, 48, PAGE_W, 4).fill(BRAND);
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#bae6fd')
          .text('NSNP  ·  SP SLA  ·  OTIFEF METRICS', MX, 10, {
            characterSpacing: 1,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor('#ffffff')
          .text('Service provider scorecard', MX, 24, {
            width: CONTENT_W * 0.55,
          });
        const meta = [
          `Cover period: ${periodBit}`,
          `${input.periodFrom} → ${input.periodTo}`,
          input.roleLabel || null,
          input.schoolName ? `School: ${input.schoolName}` : null,
          input.agencyName ? `Agency: ${input.agencyName}` : null,
          input.viewerName ? `Viewer: ${input.viewerName}` : null,
          `Printed ${generated.toISOString().slice(0, 10)}`,
        ]
          .filter(Boolean)
          .join('\n');
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
        const leg = input.legend;
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(MUTED)
          .text(
            leg
              ? `On-time = ${leg.on_time || '—'}. In-full = ${leg.in_full || '—'}. Error-free = ${leg.error_free || '—'}. Composite = ${leg.composite || '—'}.`
              : 'Objective delivery performance from POs, delivery notes, and kitchen GRNs for the selected slicer period.',
            MX,
            60,
            { width: CONTENT_W }
          );
      }
    };

    drawPageHeader(true);
    let y = firstContentY(true);

    // Summary strip
    const cards: Array<{ label: string; value: string }> = [
      { label: 'Deliveries', value: String(summary.deliveries || 0) },
      { label: 'OTIFEF', value: pct(summary.otifef_pct) },
      { label: 'On-catalogue', value: pct(summary.compliance_pct) },
      { label: 'SPs', value: String(summary.isp_count || 0) },
      { label: 'Preferred', value: String(summary.preferred || 0) },
      { label: 'Probation', value: String(summary.probation || 0) },
    ];
    const cardW = (CONTENT_W - 10 * 5) / 6;
    for (let i = 0; i < cards.length; i++) {
      const x = MX + i * (cardW + 10);
      doc.roundedRect(x, y, cardW, 36, 4).fill(SOFT);
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
    y += 48;

    const col = {
      rank: MX,
      rankW: 28,
      name: MX + 28,
      nameW: 160,
      otif: MX + 188,
      otifW: 52,
      onTime: MX + 240,
      onTimeW: 52,
      inFull: MX + 292,
      inFullW: 52,
      err: MX + 344,
      errW: 52,
      del: MX + 396,
      delW: 48,
      rating: MX + 444,
      ratingW: 52,
      spend: MX + 496,
      spendW: 70,
      badge: MX + 566,
      badgeW: CONTENT_W - 566 + MX - MX,
    };

    const drawTableHeader = () => {
      doc.rect(MX, y, CONTENT_W, 16).fill(SOFT);
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(MUTED)
        .text('#', col.rank + 2, y + 4, { width: col.rankW })
        .text('Service provider', col.name + 2, y + 4, { width: col.nameW })
        .text('OTIFEF', col.otif + 2, y + 4, {
          width: col.otifW - 4,
          align: 'right',
        })
        .text('On-time', col.onTime + 2, y + 4, {
          width: col.onTimeW - 4,
          align: 'right',
        })
        .text('In-full', col.inFull + 2, y + 4, {
          width: col.inFullW - 4,
          align: 'right',
        })
        .text('Error-free', col.err + 2, y + 4, {
          width: col.errW - 4,
          align: 'right',
        })
        .text('Deliv.', col.del + 2, y + 4, {
          width: col.delW - 4,
          align: 'right',
        })
        .text('School ★', col.rating + 2, y + 4, {
          width: col.ratingW - 4,
          align: 'right',
        })
        .text('Spend', col.spend + 2, y + 4, {
          width: col.spendW - 4,
          align: 'right',
        })
        .text('Badge', col.badge + 2, y + 4, { width: col.badgeW });
      y += 18;
    };

    const ensureSpace = (need: number) => {
      if (y + need > FOOTER_Y - 8) {
        doc.addPage();
        drawPageHeader(false);
        y = firstContentY(false);
        drawTableHeader();
      }
    };

    drawTableHeader();

    if (!isps.length) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(MUTED)
        .text(
          'No SP delivery activity in this cover period. Link SPs and receive GRNs to build OTIFEF.',
          MX,
          y + 16,
          { width: CONTENT_W, align: 'center' }
        );
    } else {
      isps.forEach((r, idx) => {
        ensureSpace(16);
        const rowY = y;
        if (idx % 2 === 0) {
          doc.rect(MX, rowY - 1, CONTENT_W, 14).fill('#fafafa');
        }
        if (r.preferred) {
          doc.rect(MX, rowY - 1, 3, 14).fill('#10b981');
        }
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(MUTED)
          .text(String(idx + 1), col.rank + 2, rowY, { width: col.rankW });
        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(INK)
          .text(String(r.name || '—'), col.name + 2, rowY, {
            width: col.nameW - 4,
            ellipsis: true,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(BRAND_DEEP)
          .text(pct(r.otifef_pct), col.otif + 2, rowY, {
            width: col.otifW - 4,
            align: 'right',
          });
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(INK)
          .text(pct(r.on_time_pct), col.onTime + 2, rowY, {
            width: col.onTimeW - 4,
            align: 'right',
          })
          .text(pct(r.in_full_pct), col.inFull + 2, rowY, {
            width: col.inFullW - 4,
            align: 'right',
          })
          .text(pct(r.error_free_pct), col.err + 2, rowY, {
            width: col.errW - 4,
            align: 'right',
          })
          .text(String(r.deliveries || 0), col.del + 2, rowY, {
            width: col.delW - 4,
            align: 'right',
          })
          .text(
            r.avg_school_rating != null
              ? `${r.avg_school_rating}★`
              : '—',
            col.rating + 2,
            rowY,
            { width: col.ratingW - 4, align: 'right' }
          )
          .text(money(r.spend), col.spend + 2, rowY, {
            width: col.spendW - 4,
            align: 'right',
          })
          .text(String(r.badge || r.status || '—'), col.badge + 2, rowY, {
            width: col.badgeW - 4,
            ellipsis: true,
          });
        y += 14;
      });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, i + 1, range.count);
    }
    doc.end();
  });
}

function firstContentY(first: boolean): number {
  return first ? 78 : 64;
}

export function ispSlaPdfFilename(
  from: string,
  to: string,
  d = new Date()
): string {
  const day = d.toISOString().slice(0, 10);
  const safeFrom = String(from || '').slice(0, 10);
  const safeTo = String(to || '').slice(0, 10);
  return `NSNP-SP-SLA-OTIFEF-${safeFrom}_to_${safeTo}-${day}.pdf`;
}

/** CSV export (UTF-8 BOM for Excel) for the selected cover period */
export function buildIspSlaCsv(
  isps: IspSlaRow[],
  period: { from: string; to: string; label?: string | null }
): string {
  const header = [
    'rank',
    'isp_profile_id',
    'name',
    'otifef_pct',
    'otifef_label',
    'on_time_pct',
    'in_full_pct',
    'error_free_pct',
    'deliveries',
    'approved_ok',
    'wrong_brand',
    'compliance_pct',
    'avg_school_rating',
    'rating_count',
    'spend',
    'badge',
    'status',
    'preferred',
    'incentive_score',
    'period_from',
    'period_to',
    'period_label',
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = isps.map((r, idx) =>
    [
      idx + 1,
      r.isp_profile_id,
      r.name,
      r.otifef_pct,
      r.otifef_label,
      r.on_time_pct,
      r.in_full_pct,
      r.error_free_pct,
      r.deliveries,
      r.approved_ok,
      r.wrong_brand,
      r.compliance_pct,
      r.avg_school_rating,
      r.rating_count,
      r.spend,
      r.badge,
      r.status,
      r.preferred ? 'yes' : 'no',
      r.incentive_score,
      period.from,
      period.to,
      period.label || '',
    ]
      .map(escape)
      .join(',')
  );
  return `\uFEFF${header.join(',')}\n${rows.join('\n')}\n`;
}

export function ispSlaCsvFilename(
  from: string,
  to: string,
  d = new Date()
): string {
  const day = d.toISOString().slice(0, 10);
  const safeFrom = String(from || '').slice(0, 10);
  const safeTo = String(to || '').slice(0, 10);
  return `NSNP-SP-SLA-OTIFEF-${safeFrom}_to_${safeTo}-${day}.csv`;
}
