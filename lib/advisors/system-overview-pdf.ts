/**
 * Advisor system overview — single A4 portrait one-pager.
 * Pure pdfkit. Do not import from client components.
 */
import PDFDocument from 'pdfkit';
import {
  drawProcessGuideHero,
  drawProcessPageWash,
  withOpenMargins,
} from '@/lib/pdf/process-guide-chrome';
import {
  advisorSystemOverview,
  advisorSystemOverviewFilename,
  type AdvisorOverviewModule,
  type OverviewBullet,
} from '@/lib/advisors/system-overview';

const A4_W = 595.28;
const A4_H = 841.89;
const MX = 30;
const CONTENT_W = A4_W - MX * 2;
const FOOTER_Y = A4_H - 22;

const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const BRAND = '#0891b2';
const BRAND_DEEP = '#0f766e';
const SKY = '#0369a1';
const AMBER = '#b45309';

type PdfDoc = InstanceType<typeof PDFDocument>;

/** Helvetica is WinAnsi — curly quotes, arrows, marks and em-dashes break. */
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

type Geo = {
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

function drawFooter(doc: PdfDoc, brand: string) {
  withOpenMargins(doc, () => {
    const y = FOOTER_Y - 6;
    doc
      .moveTo(MX, y)
      .lineTo(A4_W - MX, y)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        `SupplierAdvisor · ${pdfSafe(brand)} · A4 one-pager · Why this OS`,
        MX,
        y + 4,
        { width: CONTENT_W * 0.72, align: 'left' }
      );
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text('Page 1 of 1', MX, y + 4, { width: CONTENT_W, align: 'right' });
  });
}

function drawPromise(doc: PdfDoc, text: string, y: number): number {
  const h = 42;
  doc.roundedRect(MX, y, CONTENT_W, h, 6).fillAndStroke('#ecfeff', '#67e8f9');
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(INK)
    .text(pdfSafe(text), MX + 10, y + 8, { width: CONTENT_W - 20, height: h - 12 });
  return y + h + 10;
}

function drawSectionHead(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  kicker: string,
  title: string,
  tone: string
): number {
  doc.rect(x, y, 3.5, 22).fill(tone);
  doc
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor(tone)
    .text(pdfSafe(kicker).toUpperCase(), x + 8, y, {
      width: w - 10,
      characterSpacing: 0.5,
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(INK)
    .text(pdfSafe(title), x + 8, y + 10, { width: w - 10 });
  return y + 26;
}

function drawBullets(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  items: OverviewBullet[],
  tone: string
): number {
  let cy = y;
  for (const item of items) {
    doc.circle(x + 4, cy + 4, 2).fill(tone);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(INK)
      .text(pdfSafe(item.title), x + 12, cy, { width: w - 14 });
    cy += 11;
    const body = pdfSafe(item.body);
    const h = doc.heightOfString(body, { width: w - 14 });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(body, x + 12, cy, { width: w - 14 });
    cy += Math.max(12, h) + 6;
  }
  return cy;
}

function drawEnhance(
  doc: PdfDoc,
  y: number,
  items: OverviewBullet[]
): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(MUTED)
    .text('HOW IT ENHANCES THE BUSINESS', MX, y, { characterSpacing: 0.5 });
  y += 12;
  const gap = 6;
  const cols = 4;
  const boxW = (CONTENT_W - gap * (cols - 1)) / cols;
  const boxH = 58;
  const tones = [BRAND_DEEP, SKY, AMBER, BRAND];
  items.slice(0, 4).forEach((item, i) => {
    const x = MX + i * (boxW + gap);
    doc.roundedRect(x, y, boxW, boxH, 5).fillAndStroke(SOFT, LINE);
    doc.rect(x, y, boxW, 3).fill(tones[i] || BRAND);
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(INK)
      .text(pdfSafe(item.title), x + 6, y + 8, { width: boxW - 12 });
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(MUTED)
      .text(pdfSafe(item.body), x + 6, y + 22, { width: boxW - 12, height: 30 });
  });
  return y + boxH + 8;
}

function drawCloser(doc: PdfDoc, text: string, y: number): number {
  const h = 36;
  doc.roundedRect(MX, y, CONTENT_W, h, 6).fillAndStroke('#ecfdf5', '#6ee7b7');
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(BRAND_DEEP)
    .text(pdfSafe('MONEY - WHO BILLS WHOM'), MX + 10, y + 6, {
      width: CONTENT_W - 20,
    });
  doc
    .font('Helvetica')
    .fontSize(7.2)
    .fillColor(INK)
    .text(pdfSafe(text), MX + 10, y + 16, { width: CONTENT_W - 20 });
  return y + h;
}

export async function buildAdvisorSystemOverviewPdf(
  module: AdvisorOverviewModule
): Promise<Buffer> {
  const copy = advisorSystemOverview(module);
  const g: Geo = {
    pageW: A4_W,
    pageH: A4_H,
    mx: MX,
    contentW: CONTENT_W,
    footerY: FOOTER_Y,
    isLandscape: false,
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      bufferPages: true,
      autoFirstPage: true,
      margins: { top: 0, bottom: 28, left: MX, right: MX },
      info: {
        Title: `${copy.brand} — system overview (A4 one-pager)`,
        Author: 'SupplierAdvisor®',
        Subject: `What ${copy.brand} does for the business and for ${copy.clientNoun}`,
        Keywords: `${copy.brand}, SupplierAdvisor, Core OS, SA Member, one-pager`,
        CreationDate: new Date(),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = drawProcessGuideHero(doc, g, {
      eyebrow: `${copy.brand} · system overview · A4 ONE-PAGER`,
      title: copy.headline,
      subtitle: `For the business (Core + ${copy.brand}) and for ${copy.clientNoun}.`,
      landscape: false,
    });
    drawProcessPageWash(doc, g, Math.max(0, y - 8));

    y = drawPromise(doc, copy.promise, y);

    const gap = 12;
    const colW = (CONTENT_W - gap) / 2;
    const leftX = MX;
    const rightX = MX + colW + gap;
    const colTop = y;

    let ly = drawSectionHead(
      doc,
      leftX,
      colTop,
      colW,
      '1 · Your business',
      'Core OS + this Advisor',
      BRAND_DEEP
    );
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(BRAND_DEEP)
      .text('CORE MODULES', leftX + 8, ly);
    ly += 11;
    ly = drawBullets(doc, leftX, ly, colW, copy.core, BRAND_DEEP);
    ly += 4;
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(BRAND)
      .text(pdfSafe(copy.brand).toUpperCase(), leftX + 8, ly);
    ly += 11;
    ly = drawBullets(doc, leftX, ly, colW, copy.advisor, BRAND);

    let ry = drawSectionHead(
      doc,
      rightX,
      colTop,
      colW,
      '2 · Your clients',
      `What ${copy.clientNoun} get`,
      SKY
    );
    ry = drawBullets(doc, rightX, ry, colW, copy.clients, SKY);

    y = Math.max(ly, ry) + 8;
    y = drawEnhance(doc, y, copy.enhance);
    drawCloser(doc, copy.closer, y);
    drawFooter(doc, copy.brand);

    doc.end();
  });
}

export { advisorSystemOverviewFilename };
