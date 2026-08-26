/**
 * SchoolAdvisor system overview PDF — A4 landscape or portrait, 1 page.
 * Pure pdfkit. Do not import from client components.
 */
import PDFDocument from 'pdfkit';
import {
  drawProcessGuideHero,
  drawProcessPageWash,
  drawSectionLabel,
  drawSoftCard,
  PROCESS_PDF,
  withOpenMargins,
  type ProcessGuideGeo,
} from '@/lib/pdf/process-guide-chrome';
import type { ProcessGuideOrientation } from '@/lib/schools/process-guide-links';
import { NSNP_SYSTEM_OVERVIEW } from '@/lib/schools/nsnp-system-overview';

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

const BRAND = PROCESS_PDF.brand;
const BRAND_DEEP = PROCESS_PDF.brandDeep;
const INK = PROCESS_PDF.ink;
const MUTED = PROCESS_PDF.muted;
const ACCENTS = ['#0077b6', '#059669', '#d97706', '#e11d48'] as const;
const FILLS = ['#f0f9ff', '#ecfdf5', '#fffbeb', '#fff1f2'] as const;
const STROKES = ['#7dd3fc', '#6ee7b7', '#fcd34d', '#fda4af'] as const;

type PdfDoc = InstanceType<typeof PDFDocument>;

function pdfSafe(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2192/g, 'to')
    .replace(/\u00A0/g, ' ')
    .replace(/®/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

type Geo = ProcessGuideGeo & { contentBottom: number };

function geoFor(orientation: ProcessGuideOrientation): Geo {
  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? A4_PORTRAIT_H : A4_PORTRAIT_W;
  const pageH = isLandscape ? A4_PORTRAIT_W : A4_PORTRAIT_H;
  const mx = isLandscape ? 22 : 28;
  const footerY = pageH - 16;
  return {
    pageW,
    pageH,
    mx,
    contentW: pageW - mx * 2,
    footerY,
    isLandscape,
    contentBottom: footerY - 8,
  };
}

function fitText(
  doc: PdfDoc,
  text: string,
  x: number,
  y: number,
  opts: { width: number; height?: number; align?: 'left' | 'center' | 'right' }
) {
  doc.text(pdfSafe(text), x, y, {
    width: opts.width,
    height: opts.height,
    align: opts.align,
    lineBreak: opts.height != null,
    ellipsis: true,
  });
}

export async function buildNsnpSystemOverviewPdf(opts?: {
  generatedAt?: Date;
  orientation?: ProcessGuideOrientation;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();
  const orientation: ProcessGuideOrientation =
    opts?.orientation === 'portrait' ? 'portrait' : 'landscape';
  const g = geoFor(orientation);
  const copy = NSNP_SYSTEM_OVERVIEW;
  const layout = orientation;
  const pageMargins = {
    top: 0,
    bottom: 18,
    left: g.mx,
    right: g.mx,
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout,
      bufferPages: true,
      autoFirstPage: true,
      margins: pageMargins,
      info: {
        Title: 'SchoolAdvisor system overview — benefits for DBE, schools, SPs and children',
        Author: 'SupplierAdvisor',
        Subject: `NSNP system overview (A4 ${orientation})`,
        Keywords: 'NSNP, SchoolAdvisor, DBE, PEU, system overview',
        CreationDate: generated,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = drawProcessGuideHero(doc, g, {
      eyebrow: `SchoolAdvisor · system overview · ${
        g.isLandscape ? 'A4 LANDSCAPE' : 'A4 PORTRAIT'
      } · 1 PAGE`,
      title: pdfSafe(copy.headline),
      subtitle: g.isLandscape ? undefined : pdfSafe(copy.promise),
      sideNote: g.isLandscape ? pdfSafe(copy.promise) : undefined,
      landscape: g.isLandscape,
    });
    drawProcessPageWash(doc, g, Math.max(0, y - 8));

    y = drawSectionLabel(
      doc,
      'Who benefits',
      g.mx,
      y,
      g.contentW,
      BRAND_DEEP
    );

    const audiences = copy.audiences;
    const cols = g.isLandscape ? 4 : 2;
    const gap = g.isLandscape ? 8 : 10;
    const colW = (g.contentW - gap * (cols - 1)) / cols;
    const bottomReserve = 52;
    const cardH = Math.max(180, g.contentBottom - bottomReserve - y);
    const rows = Math.ceil(audiences.length / cols);

    audiences.forEach((a, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = g.mx + col * (colW + gap);
      const cy = y + row * (cardH / rows + (rows > 1 ? 8 : 0));
      const h = rows > 1 ? (cardH - 8) / rows : cardH;
      const accent = ACCENTS[i] || BRAND;
      drawSoftCard(doc, x, cy, colW, h, {
        fill: FILLS[i] || '#f8fafc',
        stroke: STROKES[i] || '#e2e8f0',
        accent,
        radius: 6,
      });
      doc.font('Helvetica-Bold').fontSize(6).fillColor(accent);
      fitText(doc, a.kicker.toUpperCase(), x + 10, cy + 8, {
        width: colW - 16,
      });
      doc.font('Helvetica-Bold').fontSize(g.isLandscape ? 10 : 11).fillColor(INK);
      fitText(doc, a.title, x + 10, cy + 17, {
        width: colW - 16,
        height: 14,
      });
      doc.font('Helvetica').fontSize(7).fillColor(MUTED);
      fitText(doc, a.promise, x + 10, cy + 32, {
        width: colW - 16,
        height: g.isLandscape ? 22 : 28,
      });
      let by = cy + (g.isLandscape ? 56 : 64);
      const bulletH = g.isLandscape ? 22 : 26;
      for (const b of a.benefits) {
        if (by + bulletH > cy + h - 8) break;
        doc.font('Helvetica-Bold').fontSize(7).fillColor(INK);
        fitText(doc, b.title, x + 10, by, {
          width: colW - 16,
          height: 9,
        });
        doc.font('Helvetica').fontSize(6.5).fillColor(MUTED);
        fitText(doc, b.body, x + 10, by + 9, {
          width: colW - 16,
          height: bulletH - 10,
        });
        by += bulletH;
      }
    });

    const closeY = g.contentBottom - 38;
    drawSoftCard(doc, g.mx, closeY, g.contentW, 32, {
      fill: '#e0f2fe',
      stroke: '#7dd3fc',
      accent: BRAND_DEEP,
      radius: 5,
    });
    doc.font('Helvetica-Bold').fontSize(6).fillColor(BRAND_DEEP);
    fitText(doc, 'SYSTEM OF RECORD', g.mx + 10, closeY + 5, {
      width: g.contentW - 18,
    });
    doc.font('Helvetica').fontSize(7).fillColor(INK);
    fitText(doc, copy.closer, g.mx + 10, closeY + 14, {
      width: g.contentW - 18,
      height: 14,
    });

    withOpenMargins(doc, () => {
      const fy = g.footerY - 5;
      doc
        .moveTo(g.mx, fy)
        .lineTo((doc.page.width || g.pageW) - g.mx, fy)
        .strokeColor(PROCESS_PDF.line)
        .lineWidth(0.5)
        .stroke();
      const orientLabel = g.isLandscape ? 'A4 landscape' : 'A4 portrait';
      doc.font('Helvetica').fontSize(6).fillColor(PROCESS_PDF.muted);
      doc.text(
        `SupplierAdvisor · SchoolAdvisor NSNP · ${orientLabel} · system overview`,
        g.mx,
        fy + 3,
        { width: g.contentW * 0.72, lineBreak: false, ellipsis: true }
      );
      doc.text('Page 1 of 1', g.mx, fy + 3, {
        width: g.contentW,
        align: 'right',
      });
    });

    doc.end();
  });
}
