/**
 * HireAdvisor® end-to-end process guide PDF — rental marketplace.
 * Supplier list → customer rent (free) → requirements → out → return → 2.5% on the business.
 * Pure pdfkit — do not import from client.
 */
import PDFDocument from 'pdfkit';
import {
  drawProcessFooter,
  drawProcessGuideHero,
  drawProcessGuidePageHeader,
  drawProcessPageWash,
  drawSectionLabel,
  drawSoftCard,
  PROCESS_PDF,
} from '@/lib/pdf/process-guide-chrome';
import type { HiregraphProcessGuideOrientation } from '@/lib/hire/hiregraph-process-guide-links';
import {
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_PLATFORM_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

type PdfDoc = InstanceType<typeof PDFDocument>;

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

type Geo = {
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

function geoFor(orientation: HiregraphProcessGuideOrientation): Geo {
  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? A4_PORTRAIT_H : A4_PORTRAIT_W;
  const pageH = isLandscape ? A4_PORTRAIT_W : A4_PORTRAIT_H;
  const mx = 20;
  return {
    pageW,
    pageH,
    mx,
    contentW: pageW - mx * 2,
    footerY: pageH - 16,
    isLandscape,
  };
}

const CHAIN = [
  { label: 'Supplier', sub: 'Core SRM · SKUs' },
  { label: 'Catalogue', sub: 'Inventory link' },
  { label: 'Customer', sub: 'CRM 360' },
  { label: 'Requirements', sub: 'ID · licence · deposit' },
  { label: 'Handover', sub: 'Out · return' },
  { label: 'Settle · One OS', sub: '2.5% · Finance' },
] as const;

const ROLES = [
  {
    title: 'Supplier (lister)',
    does: [
      'List hire items by category (incl. kids party)',
      'Jumping castles, plant, tools, events…',
      'Approve bookings & hand over gear',
      'Pays 2.5% platform commission on rental',
    ],
    doesNot: [
      'Does not set customer commission',
      'Does not hold platform fees',
    ],
  },
  {
    title: 'Customer (person renting)',
    does: [
      'Browse catalogue & request hire',
      'Complete category requirements',
      'Pay rental + deposit (no platform fee)',
      'Return gear in agreed condition',
    ],
    doesNot: [
      'Does not list items as supplier',
      'Does not skip category KYC',
    ],
  },
  {
    title: 'HireAdvisor® platform',
    does: [
      'Category requirement rules',
      'Dual commission ledger',
      'Booking & handover trail',
      'Earns 5% total on hire GMV',
    ],
    doesNot: [
      'Does not own the hire assets',
      'Does not commission deposits',
    ],
  },
] as const;

const PHASES = [
  {
    title: '1 · Core suppliers & catalogue',
    steps: [
      'Add gear owners in Core Suppliers (SRM) — not a hire-only address book',
      'Choose categories (plant, vehicles, tools, kids party…)',
      'List catalogue items linked to srm_suppliers and Core Inventory SKUs (rate, deposit, stock)',
    ],
  },
  {
    title: '2 · Core customers & hire request (B2C)',
    steps: [
      'Renters live in Core Customers 360 — hire bookings, invoices, identity on one row',
      'Book against crm_customers + catalogue item; dual fee quote',
      'Clear category requirements (licence, ID, castle safety…)',
    ],
  },
  {
    title: '3 · Approve · pay · hand out',
    steps: [
      'Supplier approves; customer pays rental + refundable deposit (no platform fee)',
      'Supplier commission 2.5% reserved on rental value',
      'Handover OUT with condition notes / photos',
    ],
  },
  {
    title: '4 · Return · settle · release deposit',
    steps: [
      'Handover RETURN; damage against deposit if any',
      'Booking completed; 2.5% on the listing business; rental posts AR + VAT on Finance',
      'Refundable deposit released (not commissionable); week shows on company calendar',
    ],
  },
] as const;

function drawHero(doc: PdfDoc, g: Geo): number {
  const orientLabel = g.isLandscape
    ? 'A4 LANDSCAPE · 2 PAGES'
    : 'A4 PORTRAIT · 2 PAGES';
  return drawProcessGuideHero(doc, g, {
    eyebrow: `HireAdvisor® · rental marketplace · ${orientLabel}`,
    title: 'Supplier lists → Customer 360 → 2.5% on One OS',
    subtitle: g.isLandscape
      ? undefined
      : `Members rent free on SA Member. The listing business pays ${HIRE_SUPPLIER_COMMISSION_PCT}%. Categories enforce different hire requirements.`,
    sideNote: g.isLandscape
      ? `Commercial model: ${HIRE_SUPPLIER_COMMISSION_PCT}% on the listing business. Members pay no platform fee. Deposits are not commissionable.`
      : undefined,
    landscape: g.isLandscape,
  });
}

function drawChain(doc: PdfDoc, g: Geo, y: number): number {
  y = drawSectionLabel(
    doc,
    'Process chain',
    g.mx,
    y,
    g.contentW,
    PROCESS_PDF.violet
  );
  const gap = 5;
  const n = CHAIN.length;
  const boxW = (g.contentW - gap * (n - 1)) / n;
  const boxH = g.isLandscape ? 28 : 34;
  CHAIN.forEach((node, i) => {
    const x = g.mx + i * (boxW + gap);
    drawSoftCard(doc, x, y, boxW, boxH, {
      accent: i % 2 === 0 ? PROCESS_PDF.violet : PROCESS_PDF.brand,
      radius: 5,
    });
    doc.font('Helvetica-Bold').fontSize(7).fillColor(PROCESS_PDF.ink);
    doc.text(node.label, x + 6, y + 5, {
      width: boxW - 12,
      lineBreak: false,
      ellipsis: true,
    });
    doc.font('Helvetica').fontSize(5.5).fillColor(PROCESS_PDF.muted);
    doc.text(node.sub, x + 6, y + 16, {
      width: boxW - 12,
      lineBreak: false,
      ellipsis: true,
    });
  });
  return y + boxH + 10;
}

function drawCommercial(doc: PdfDoc, g: Geo, y: number): number {
  y = drawSectionLabel(
    doc,
    'Commercial model (distinct from other Advisors)',
    g.mx,
    y,
    g.contentW,
    PROCESS_PDF.emerald
  );
  const h = g.isLandscape ? 48 : 56;
  drawSoftCard(doc, g.mx, y, g.contentW, h, {
    accent: PROCESS_PDF.emerald,
    radius: 5,
  });
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PROCESS_PDF.ink);
  doc.text(
    `Supplier ${HIRE_SUPPLIER_COMMISSION_PCT}% on the listing business · Customer ${HIRE_CUSTOMER_COMMISSION_PCT}% (members free)`,
    g.mx + 10,
    y + 8,
    { width: g.contentW - 20 }
  );
  doc.font('Helvetica').fontSize(7).fillColor(PROCESS_PDF.muted);
  doc.text(
    'Other Advisors bill a company subscription (and optional industry pack). HireAdvisor® is primarily transaction-commissioned on completed hire GMV. Refundable deposits / damage bonds are held and released — never commissionable.',
    g.mx + 10,
    y + 22,
    { width: g.contentW - 20, height: 28 }
  );
  return y + h + 10;
}

function drawRoles(doc: PdfDoc, g: Geo, y: number): number {
  y = drawSectionLabel(doc, 'Who does what', g.mx, y, g.contentW, PROCESS_PDF.violet);
  const gap = 8;
  const n = ROLES.length;
  const boxW = (g.contentW - gap * (n - 1)) / n;
  const boxH = g.isLandscape ? 88 : 108;
  ROLES.forEach((role, i) => {
    const x = g.mx + i * (boxW + gap);
    drawSoftCard(doc, x, y, boxW, boxH, {
      accent: i === 2 ? PROCESS_PDF.emerald : PROCESS_PDF.violet,
      radius: 5,
    });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PROCESS_PDF.ink);
    doc.text(role.title, x + 8, y + 6, { width: boxW - 14 });
    let ty = y + 18;
    doc.font('Helvetica-Bold').fontSize(6).fillColor(PROCESS_PDF.emerald);
    doc.text('Does', x + 8, ty, { width: boxW - 14 });
    ty += 9;
    doc.font('Helvetica').fontSize(6).fillColor(PROCESS_PDF.ink);
    for (const d of role.does.slice(0, 4)) {
      doc.text(`• ${d}`, x + 8, ty, {
        width: boxW - 14,
        lineBreak: false,
        ellipsis: true,
      });
      ty += 8;
    }
    doc.font('Helvetica-Bold').fontSize(6).fillColor(PROCESS_PDF.rose);
    doc.text('Does not', x + 8, ty, { width: boxW - 14 });
    ty += 9;
    doc.font('Helvetica').fontSize(6).fillColor(PROCESS_PDF.muted);
    for (const d of role.doesNot.slice(0, 2)) {
      doc.text(`• ${d}`, x + 8, ty, {
        width: boxW - 14,
        lineBreak: false,
        ellipsis: true,
      });
      ty += 8;
    }
  });
  return y + boxH + 10;
}

function drawPhases(
  doc: PdfDoc,
  g: Geo,
  y: number,
  phases: typeof PHASES
): number {
  for (const phase of phases) {
    if (y > g.footerY - 56) break;
    drawSoftCard(doc, g.mx, y, g.contentW, g.isLandscape ? 40 : 50, {
      accent: PROCESS_PDF.brandDeep,
      radius: 5,
    });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PROCESS_PDF.ink);
    doc.text(phase.title, g.mx + 10, y + 6, { width: g.contentW - 20 });
    doc.font('Helvetica').fontSize(6.5).fillColor(PROCESS_PDF.muted);
    doc.text(
      phase.steps.map((s, i) => `${i + 1}. ${s}`).join('   ·   '),
      g.mx + 10,
      y + 18,
      { width: g.contentW - 20, height: g.isLandscape ? 18 : 26 }
    );
    y += g.isLandscape ? 48 : 58;
  }
  return y;
}

export async function buildHiregraphProcessGuidePdf(opts?: {
  generatedAt?: Date;
  orientation?: HiregraphProcessGuideOrientation;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();
  const orientation: HiregraphProcessGuideOrientation =
    opts?.orientation === 'portrait' ? 'portrait' : 'landscape';
  const g = geoFor(orientation);
  const layout = orientation;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout,
      bufferPages: true,
      autoFirstPage: true,
      margins: { top: 0, bottom: 28, left: g.mx, right: g.mx },
      info: {
        Title:
          'HireAdvisor® Process Design — Supplier list → Customer rent free → 2.5% on the business',
        Author: 'SupplierAdvisor®',
        Subject: `HireAdvisor rental marketplace end-to-end (A4 ${orientation})`,
        Keywords:
          'HireAdvisor, hire, rental, marketplace, commission, B2C, supplier',
        CreationDate: generated,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = drawHero(doc, g);
    drawProcessPageWash(doc, g, Math.max(0, y - 8));
    y = drawChain(doc, g, y);
    y = drawCommercial(doc, g, y);
    y = drawRoles(doc, g, y);
    y = drawSectionLabel(
      doc,
      'Full process — Part A',
      g.mx,
      y,
      g.contentW,
      PROCESS_PDF.violet
    );
    y = drawPhases(doc, g, y, PHASES.slice(0, 2) as unknown as typeof PHASES);

    doc.addPage({ size: 'A4', layout });
    y = drawProcessGuidePageHeader(doc, g, {
      eyebrow: 'HireAdvisor® · rental marketplace · continued',
      title: 'Pay rental · hand out · return · settle supplier commission',
      landscape: g.isLandscape,
    });
    drawProcessPageWash(doc, g, Math.max(0, y - 8));
    y = drawSectionLabel(
      doc,
      'Full process — Part B',
      g.mx,
      y,
      g.contentW,
      PROCESS_PDF.violet
    );
    y = drawPhases(doc, g, y, PHASES.slice(2) as unknown as typeof PHASES);

    drawSoftCard(doc, g.mx, y, g.contentW, 40, {
      accent: PROCESS_PDF.emerald,
      radius: 5,
    });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PROCESS_PDF.ink);
    doc.text('One sentence outcome', g.mx + 10, y + 6, {
      width: g.contentW - 20,
    });
    doc.font('Helvetica').fontSize(7).fillColor(PROCESS_PDF.muted);
    doc.text(
      `Core Suppliers (SRM) own gear → catalogue lists items by category → Core Customers (CRM) book dates and clear hire KYC on a free SA Member wallet → OUT/RETURN → listing business pays ${HIRE_SUPPLIER_COMMISSION_PCT}% (deposits stay refundable).`,
      g.mx + 10,
      y + 16,
      { width: g.contentW - 20, height: 20 }
    );

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawProcessFooter(doc, g, {
        productLine: `SupplierAdvisor® · HireAdvisor® · ${HIRE_SUPPLIER_COMMISSION_PCT}% on the business · members free`,
        pageNum: i + 1,
        total: range.count,
      });
    }

    doc.end();
  });
}

export function hiregraphProcessGuideFilename(
  orientation: HiregraphProcessGuideOrientation = 'landscape'
) {
  return `HireAdvisor-Process-Design-A4-${orientation}.pdf`;
}
