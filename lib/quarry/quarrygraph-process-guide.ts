/**
 * Quarrygraph® end-to-end process guide content + PDF.
 * Locations → Sites → Reserves → Plant → Dispatch → Sold & compliant
 * Pure pdfkit — works on Vercel serverless.
 *
 * Do not import from client components (pulls pdfkit into the browser bundle).
 * Client UI should use `@/lib/quarry/quarrygraph-process-guide-links` only.
 */
import PDFDocument from 'pdfkit';
import type { QuarrygraphProcessGuideOrientation } from '@/lib/quarry/quarrygraph-process-guide-links';
export type { QuarrygraphProcessGuideOrientation } from '@/lib/quarry/quarrygraph-process-guide-links';

export type ProcessStep = {
  n: string;
  title: string;
  who: string;
  desc: string;
};

export type ProcessPhase = {
  title: string;
  subtitle: string;
  steps: ProcessStep[];
};

export const PROCESS_CHAIN = [
  { label: 'Locations', sub: 'Perm · temp · batch' },
  { label: 'Sites · products', sub: 'Pits · grades · GPS' },
  { label: 'Reserves · plan', sub: 'Blast · allocate' },
  { label: 'Plant · stock', sub: 'Crush · pads' },
  { label: 'Dispatch · ops', sub: 'Ticket · fleet · labour' },
  { label: 'Sold & compliant', sub: 'QA · permits · report' },
] as const;

export const ROLE_CARDS = [
  {
    title: 'Quarry office',
    subtitle: 'Master data · plan · compliance',
    does: [
      'Register permanent / temporary / batching ops',
      'Maintain sites, products, permits (rights · WUL · EMP)',
      'Survey reserves and production sequence',
      'Allocate fleet / crews to project locations',
      'Review management pack (t, fuel util, R/km)',
    ],
    doesNot: [
      'Does not invent pit codes mid-blast without master update',
      'Does not skip GPS when haul distance matters',
    ],
  },
  {
    title: 'Plant & pit ops',
    subtitle: 'Blast · crush · fleet · labour',
    does: [
      'Log blasts and plant runs against sites',
      'Keep stockpile balances current',
      'Log fleet hours, fuel, km (L/h · L/km · R/km)',
      'Cost labour gangs permanent / temp / contractor',
      'Feed hoppers and pads for dispatch',
    ],
    doesNot: [
      'Does not dispatch without a product / site link',
      'Does not ignore book fuel burn targets',
    ],
  },
  {
    title: 'Dispatch & trade',
    subtitle: 'Weighbridge · customer · QA',
    does: [
      'Issue weighbridge tickets (net t, destination)',
      'Deduct stock when ticketed',
      'Attach lab QA to product and site',
      'Serve permanent yards and project batch plants',
      'Export key reports for management',
    ],
    doesNot: [
      'Does not ship without valid / non-expired permits in view',
      'Does not drop site origin on tickets',
    ],
  },
] as const;

export const PROCESS_PHASES: ProcessPhase[] = [
  {
    title: '1 · Locations (permanent · temporary · batching)',
    subtitle: 'Multi-quarry estate + project plants with GPS',
    steps: [
      {
        n: '1a',
        title: 'Permanent quarries',
        who: 'Quarry office',
        desc: 'Register estates with district, rights, target t/day, lat/lng.',
      },
      {
        n: '1b',
        title: 'Temporary quarries',
        who: 'Quarry office',
        desc: 'Borrow pits / project quarries with start–end and project code.',
      },
      {
        n: '1c',
        title: 'Batching plants',
        who: 'Quarry office',
        desc: 'Project ready-mix / mobile plants; allocate resources to them.',
      },
      {
        n: '1d',
        title: 'Distance matrix',
        who: 'System',
        desc: 'Haversine + road estimate + Google Maps directions between GPS points.',
      },
    ],
  },
  {
    title: '2 · Sites, products & compliance',
    subtitle: 'Shared master under each operation',
    steps: [
      {
        n: '2a',
        title: 'Pits · faces · pads',
        who: 'Quarry office',
        desc: 'Site type (pit, temp, batch pad), material, hectares, GPS.',
      },
      {
        n: '2b',
        title: 'Products & grades',
        who: 'Quarry office',
        desc: 'G1–G7, concrete stone, crusher sand, density t/m³.',
      },
      {
        n: '2c',
        title: 'Permits',
        who: 'Quarry office',
        desc: 'Mining right, WUL, EMP/EA with expiry status flags.',
      },
    ],
  },
  {
    title: '3 · Reserves & production plan',
    subtitle: 'Survey → sequence → daily allocation → blast',
    steps: [
      {
        n: '3a',
        title: 'Reserve estimates',
        who: 'Quarry office',
        desc: 'Recoverable tonnes and quality by site / season / product.',
      },
      {
        n: '3b',
        title: 'Production sequence',
        who: 'Quarry office',
        desc: 'Order work; set daily t allocation to project cut dates.',
      },
      {
        n: '3c',
        title: 'Blast logs',
        who: 'Pit ops',
        desc: 'Holes, explosives, estimated vs measured broken tonnes.',
      },
    ],
  },
  {
    title: '4 · Plant, stockpiles & dispatch',
    subtitle: 'Crush → pad → weighbridge',
    steps: [
      {
        n: '4a',
        title: 'Plant runs',
        who: 'Plant ops',
        desc: 'Hours, feed t, output t by product and site.',
      },
      {
        n: '4b',
        title: 'Stockpiles',
        who: 'Plant ops',
        desc: 'Book balances by product pad; survey dates.',
      },
      {
        n: '4c',
        title: 'Weighbridge',
        who: 'Dispatch',
        desc: 'Tickets, customer, destination, net t; optional stock deduct.',
      },
    ],
  },
  {
    title: '5 · Fleet, labour & resource allocation',
    subtitle: 'Fuel util · R/km · project staffing',
    steps: [
      {
        n: '5a',
        title: 'Fleet metrics',
        who: 'Plant ops',
        desc: 'L/h, L/km, fuel util %, cost R/km, util % vs target hours.',
      },
      {
        n: '5b',
        title: 'Labour rates',
        who: 'Plant ops',
        desc: 'Permanent / temporary / contractor crews with costed day logs.',
      },
      {
        n: '5c',
        title: 'Allocate resources',
        who: 'Quarry office',
        desc: 'Vehicles, crews, mobile plant to temp quarry or batch plant.',
      },
    ],
  },
  {
    title: '6 · Quality, reports & outcome',
    subtitle: 'QA next to every tonne sold',
    steps: [
      {
        n: '6a',
        title: 'Lab QA',
        who: 'Dispatch',
        desc: 'CS / grading pass-fail linked to site and product.',
      },
      {
        n: '6b',
        title: 'Key reports',
        who: 'Quarry office',
        desc: 'By quarry, vehicle KPIs, product balance, labour cost pack.',
      },
      {
        n: '6c',
        title: 'Sold & compliant',
        who: 'Trade',
        desc: 'Dispatch with permits valid and QA on the ticket trail.',
      },
    ],
  },
];

export const GUARDRAILS = [
  {
    title: 'One site code',
    desc: 'Reserves, blasts, plant, stock and dispatch all key off the same site master.',
  },
  {
    title: 'GPS for haul truth',
    desc: 'Lat/lng enable distance matrix and Google Maps directions between ops.',
  },
  {
    title: 'Temp has an end date',
    desc: 'Temporary quarries and batch plants carry project window and status.',
  },
  {
    title: 'Fuel util is first-class',
    desc: 'L/h, L/km and R/km from shift logs — not spreadsheet afterthoughts.',
  },
  {
    title: 'Stock follows tickets',
    desc: 'Dispatch can deduct stockpile balance when weighbridge tickets post.',
  },
  {
    title: 'Permits auto-flag',
    desc: 'Expiring / expired rights and WUL visible next to production.',
  },
];

export const SYSTEM_BENEFITS = [
  {
    title: 'Multi-quarry native',
    desc: 'Run many estates under one company with roll-up reports.',
  },
  {
    title: 'Project plants included',
    desc: 'Temporary quarries and batching plants get the same OS as permanent pits.',
  },
  {
    title: 'Allocate mobile plant',
    desc: 'Put ADTs, loaders and crews on a job with start/end dates.',
  },
  {
    title: 'Fleet economics',
    desc: 'Fuel utilisation and cost per km beside tonnes moved.',
  },
  {
    title: 'Weighbridge-ready',
    desc: 'Tickets link product, site, customer and destination.',
  },
  {
    title: 'Compliance beside tonnes',
    desc: 'Mining right, WUL and EMP sit on the same process map.',
  },
  {
    title: 'Management pack',
    desc: 'One insights surface for quarry, fleet, labour and product balance.',
  },
  {
    title: 'Network-ready trade',
    desc: 'Dispatch and customers plug into SupplierAdvisor® trust and settlement.',
  },
];

export const ONE_SENTENCE =
  'Register permanent, temporary and batching locations with GPS → sites and products under each → survey reserves and plan blasts → crush to stockpiles → allocate fleet/labour → weighbridge dispatch with QA and valid permits → report fuel util, R/km and tonnes by quarry.';

// ── PDF (same structure as Fieldgraph; amber/stone brand) ───────────────

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

type Geo = {
  orientation: QuarrygraphProcessGuideOrientation;
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

function geoFor(orientation: QuarrygraphProcessGuideOrientation): Geo {
  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? A4_PORTRAIT_H : A4_PORTRAIT_W;
  const pageH = isLandscape ? A4_PORTRAIT_W : A4_PORTRAIT_H;
  const mx = isLandscape ? 28 : 34;
  return {
    orientation,
    pageW,
    pageH,
    mx,
    contentW: pageW - mx * 2,
    footerY: pageH - 22,
    isLandscape,
  };
}

const BRAND = '#d97706';
const BRAND_DEEP = '#78350f';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const SKY = '#0284c7';
const EMERALD = '#059669';
const ROSE = '#e11d48';
const VIOLET = '#7c3aed';
const CHAIN_COLORS = [BRAND_DEEP, SKY, BRAND, VIOLET, EMERALD, ROSE] as const;

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

function drawFooter(doc: PdfDoc, g: Geo, pageNum: number, total: number) {
  withOpenMargins(doc, () => {
    const y = g.footerY - 6;
    doc
      .moveTo(g.mx, y)
      .lineTo(g.pageW - g.mx, y)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    const orientLabel = g.isLandscape ? 'A4 landscape' : 'A4 portrait';
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        `SupplierAdvisor® · Quarrygraph® · ${orientLabel} · Quarrying & aggregates OS`,
        g.mx,
        y + 4,
        { width: g.contentW * 0.72, align: 'left' }
      );
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(`Page ${pageNum} of ${total}`, g.mx, y + 4, {
        width: g.contentW,
        align: 'right',
      });
  });
}

function drawHero(doc: PdfDoc, g: Geo) {
  withOpenMargins(doc, () => {
    const heroH = g.isLandscape ? 68 : 92;
    doc.rect(0, 0, g.pageW, heroH).fill(BRAND_DEEP);
    doc.rect(0, heroH - 4, g.pageW, 4).fill(BRAND);
    const orientLabel = g.isLandscape ? 'A4 LANDSCAPE' : 'A4 PORTRAIT';
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#fde68a')
      .text(
        `QUARRYGRAPH®  ·  PROCESS DESIGN  ·  ${orientLabel}`,
        g.mx,
        12,
        { width: g.contentW, characterSpacing: 1 }
      );
    const title =
      'Locations → Sites → Reserves → Plant → Dispatch → Sold & compliant';
    if (g.isLandscape) {
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#ffffff')
        .text(title, g.mx, 28, { width: g.contentW * 0.68 });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#fef3c7')
        .text(
          'End-to-end quarrying & aggregates on SupplierAdvisor® — permanent, temporary and batching plants.',
          g.mx + g.contentW * 0.68,
          28,
          { width: g.contentW * 0.32 }
        );
    } else {
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#ffffff')
        .text(title, g.mx, 30, { width: g.contentW });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#fef3c7')
        .text(
          'Primary-sector quarry OS — multi-site, project plants, fleet util and weighbridge.',
          g.mx,
          62,
          { width: g.contentW }
        );
    }
  });
}

function drawChain(doc: PdfDoc, g: Geo, y: number): number {
  const gap = g.isLandscape ? 4 : 3;
  const n = PROCESS_CHAIN.length;
  const boxW = (g.contentW - gap * (n - 1)) / n;
  const boxH = g.isLandscape ? 34 : 38;
  PROCESS_CHAIN.forEach((node, i) => {
    const x = g.mx + i * (boxW + gap);
    const color = CHAIN_COLORS[i] || BRAND;
    doc.roundedRect(x, y, boxW, boxH, 5).fillAndStroke('#ffffff', color);
    doc.rect(x, y, 3.5, boxH).fill(color);
    doc
      .font('Helvetica-Bold')
      .fontSize(g.isLandscape ? 6.5 : 6)
      .fillColor(INK)
      .text(node.label, x + 6, y + 7, { width: boxW - 10 });
    doc
      .font('Helvetica')
      .fontSize(g.isLandscape ? 5.8 : 5.5)
      .fillColor(MUTED)
      .text(node.sub, x + 6, y + 20, { width: boxW - 10 });
  });
  return y + boxH + 10;
}

function drawRoleCards(doc: PdfDoc, g: Geo, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('WHO DOES WHAT', g.mx, y, { characterSpacing: 0.8 });
  y += 11;

  const gap = 8;
  const colW = (g.contentW - gap * 2) / 3;
  const tones = [BRAND_DEEP, BRAND, SKY];
  const h = g.isLandscape ? 124 : 138;

  ROLE_CARDS.forEach((card, i) => {
    const x = g.mx + i * (colW + gap);
    const tone = tones[i];
    let cy = y + 7;

    doc.roundedRect(x, y, colW, h, 7).fillAndStroke(SOFT, LINE);
    doc.rect(x, y, colW, 3).fill(tone);
    doc
      .font('Helvetica-Bold')
      .fontSize(g.isLandscape ? 9.5 : 9)
      .fillColor(INK)
      .text(card.title, x + 8, cy, { width: colW - 16 });
    cy += 12;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(card.subtitle, x + 8, cy, { width: colW - 16 });
    cy += 11;
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(tone).text('DOES', x + 8, cy);
    cy += 9;
    card.does.forEach((line) => {
      doc
        .font('Helvetica')
        .fontSize(6.2)
        .fillColor(INK)
        .text(`• ${line}`, x + 8, cy, { width: colW - 16 });
      cy += g.isLandscape ? 9 : 10;
    });
    cy += 2;
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(MUTED)
      .text('DOES NOT', x + 8, cy);
    cy += 9;
    card.doesNot.forEach((line) => {
      doc
        .font('Helvetica')
        .fontSize(6.2)
        .fillColor(MUTED)
        .text(`• ${line}`, x + 8, cy, { width: colW - 16 });
      cy += 9;
    });
  });

  return y + h + 10;
}

function drawPhase(doc: PdfDoc, g: Geo, phase: ProcessPhase, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(g.isLandscape ? 8 : 8.5)
    .fillColor(BRAND_DEEP)
    .text(phase.title, g.mx, y, { width: g.contentW });
  y += 10;
  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor(MUTED)
    .text(phase.subtitle, g.mx, y, { width: g.contentW });
  y += 10;

  const steps = phase.steps;
  const gap = 5;
  const boxW = (g.contentW - gap * (steps.length - 1)) / steps.length;
  const boxH = g.isLandscape ? 48 : 54;

  steps.forEach((step, i) => {
    const x = g.mx + i * (boxW + gap);
    doc.roundedRect(x, y, boxW, boxH, 4).fillAndStroke(SOFT, LINE);
    doc.circle(x + 9, y + 10, 6).fill(BRAND_DEEP);
    doc
      .font('Helvetica-Bold')
      .fontSize(5.5)
      .fillColor('#ffffff')
      .text(step.n, x + 5, y + 7, { width: 10, align: 'center' });
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(INK)
      .text(step.title, x + 18, y + 5, { width: boxW - 22 });
    doc
      .font('Helvetica')
      .fontSize(5.5)
      .fillColor(BRAND)
      .text(step.who.toUpperCase(), x + 6, y + 18, { width: boxW - 12 });
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor(MUTED)
      .text(step.desc, x + 6, y + 28, { width: boxW - 12, height: boxH - 32 });
  });

  return y + boxH + 8;
}

function drawGuardrails(doc: PdfDoc, g: Geo, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('GUARDRAILS', g.mx, y, { characterSpacing: 0.6 });
  y += 10;
  const cols = g.isLandscape ? 3 : 2;
  const gap = 6;
  const boxW = (g.contentW - gap * (cols - 1)) / cols;
  const boxH = 34;
  GUARDRAILS.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = g.mx + col * (boxW + gap);
    const by = y + row * (boxH + gap);
    doc.roundedRect(x, by, boxW, boxH, 4).fillAndStroke('#fffbeb', '#fcd34d');
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(INK)
      .text(item.title, x + 6, by + 5, { width: boxW - 12 });
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor(MUTED)
      .text(item.desc, x + 6, by + 15, { width: boxW - 12, height: 16 });
  });
  const rows = Math.ceil(GUARDRAILS.length / cols);
  return y + rows * (boxH + gap) + 4;
}

function drawBenefits(doc: PdfDoc, g: Geo, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('WHY THIS OS', g.mx, y, { characterSpacing: 0.6 });
  y += 10;
  const cols = g.isLandscape ? 4 : 2;
  const gap = 5;
  const boxW = (g.contentW - gap * (cols - 1)) / cols;
  const boxH = 36;
  SYSTEM_BENEFITS.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = g.mx + col * (boxW + gap);
    const by = y + row * (boxH + gap);
    doc.roundedRect(x, by, boxW, boxH, 4).fillAndStroke(SOFT, LINE);
    doc.circle(x + 7, by + 9, 2).fill(BRAND);
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(INK)
      .text(b.title, x + 12, by + 5, { width: boxW - 16 });
    doc
      .font('Helvetica')
      .fontSize(5.8)
      .fillColor(MUTED)
      .text(b.desc, x + 6, by + 16, { width: boxW - 12, height: 18 });
  });
  const rows = Math.ceil(SYSTEM_BENEFITS.length / cols);
  return y + rows * (boxH + gap) + 4;
}

function drawOutcome(doc: PdfDoc, g: Geo, y: number): number {
  const h = g.isLandscape ? 38 : 50;
  doc.roundedRect(g.mx, y, g.contentW, h, 6).fillAndStroke('#fffbeb', '#fbbf24');
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(BRAND_DEEP)
    .text('ONE SENTENCE — THE FULL LOOP', g.mx + 10, y + 5, {
      width: g.contentW - 20,
    });
  doc
    .font('Helvetica')
    .fontSize(6.8)
    .fillColor(INK)
    .text(ONE_SENTENCE, g.mx + 10, y + 16, { width: g.contentW - 20 });
  return y + h;
}

export async function buildQuarrygraphProcessGuidePdf(opts?: {
  generatedAt?: Date;
  orientation?: QuarrygraphProcessGuideOrientation;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();
  const orientation: QuarrygraphProcessGuideOrientation =
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
          'Quarrygraph® Process Design — Locations → Dispatch → Sold & compliant',
        Author: 'SupplierAdvisor®',
        Subject: `Quarrygraph quarrying end-to-end process (A4 ${orientation})`,
        Keywords: 'Quarrygraph, aggregates, quarry, batching, fleet, process guide',
        CreationDate: generated,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHero(doc, g);
    let y = g.isLandscape ? 76 : 100;
    y = drawChain(doc, g, y);
    y = drawRoleCards(doc, g, y);

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text('FULL PROCESS — PART A (LOCATIONS → RESERVES → PLANT)', g.mx, y, {
        characterSpacing: 0.3,
      });
    y += 11;

    for (const phase of PROCESS_PHASES.slice(0, 3)) {
      y = drawPhase(doc, g, phase, y);
    }

    doc.addPage({ size: 'A4', layout });
    withOpenMargins(doc, () => {
      const headH = g.isLandscape ? 40 : 48;
      doc.rect(0, 0, g.pageW, headH).fill(BRAND_DEEP);
      doc.rect(0, headH - 4, g.pageW, 4).fill(BRAND);
      doc
        .font('Helvetica-Bold')
        .fontSize(g.isLandscape ? 11 : 10)
        .fillColor('#ffffff')
        .text(
          'Process continued · Dispatch · Fleet · QA · Guardrails',
          g.mx,
          g.isLandscape ? 12 : 14,
          { width: g.contentW }
        );
    });

    y = g.isLandscape ? 48 : 56;
    for (const phase of PROCESS_PHASES.slice(3)) {
      y = drawPhase(doc, g, phase, y);
    }
    y = drawGuardrails(doc, g, y);
    y = drawBenefits(doc, g, y);
    drawOutcome(doc, g, y);

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, g, i + 1, range.count);
    }

    doc.end();
  });
}

export function parseQuarrygraphProcessGuideOrientation(
  raw: string | null | undefined
): QuarrygraphProcessGuideOrientation {
  const v = String(raw || '').toLowerCase();
  if (v === 'portrait' || v === 'p') return 'portrait';
  return 'landscape';
}

export function quarrygraphProcessGuideFilename(
  orientation: QuarrygraphProcessGuideOrientation
): string {
  return `Quarrygraph-Process-Design-A4-${orientation}.pdf`;
}
