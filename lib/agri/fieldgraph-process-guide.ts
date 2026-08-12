/**
 * CropAdvisor® end-to-end process guide content + PDF.
 * Fields → Estimates → Harvest → Ops → Trade → Outcome
 * Pure pdfkit — works on Vercel serverless.
 *
 * Do not import from client components (pulls pdfkit into the browser bundle).
 * Client UI should use `@/lib/agri/fieldgraph-process-guide-links` only.
 */
import PDFDocument from 'pdfkit';
import {
  drawProcessGuideHero,
  drawProcessGuidePageHeader,
  drawProcessPageWash,
} from '@/lib/pdf/process-guide-chrome';
import type { FieldgraphProcessGuideOrientation } from '@/lib/agri/fieldgraph-process-guide-links';
export type { FieldgraphProcessGuideOrientation } from '@/lib/agri/fieldgraph-process-guide-links';

// ── Content (single source for PDF; mirrors FieldgraphSystemFlow) ───────

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
  { label: 'Field & agronomic', sub: 'Shared master' },
  { label: 'Estimates', sub: 'Season yield · board' },
  { label: 'Harvest Planner', sub: 'Sequence · cut dates' },
  { label: 'Ops · regen', sub: 'Fleet · labour · samples' },
  { label: 'Messages', sub: 'Office · field · trade' },
  { label: 'Sold & proven', sub: 'Mill · buyer · insight' },
] as const;

export const ROLE_CARDS = [
  {
    title: 'Farm office',
    subtitle: 'Master data · estimates · plan',
    does: [
      'Maintain field & agronomic book',
      'Create and revise season estimates',
      'Submit mill / board estimate packs',
      'Set harvest sequence & daily allocation',
      'Review season scorecard & yield graphs',
      'Message field ops and trade partners in-app',
    ],
    doesNot: [
      'Does not invent mill board rules alone',
      'Does not replace statutory payroll (People)',
    ],
  },
  {
    title: 'Field ops',
    subtitle: 'Inputs · fleet · gangs',
    does: [
      'Log fertiliser / chem applications',
      'Register vehicles and log fuel/hours',
      'Register gangs with labour rates',
      'Log daily labour cost by field',
      'Capture regen samples (SOC, cover, water)',
      'Message farm office on ops and cut plan threads',
    ],
    doesNot: [
      'Does not change shared field codes casually',
      'Does not skip rate snapshot on labour logs',
    ],
  },
  {
    title: 'Trade & network',
    subtitle: 'Mill · silo · buyer · lots',
    does: [
      'Set harvest destinations (mill / silo / buyer)',
      'Hand lots into Inventory with field origin',
      'Trade on SupplierAdvisor network',
      'Carry OTIFEF / trust into settlement',
      'Show regen proof next to yield',
      'Message mill / buyer partners on company inbox',
    ],
    doesNot: [
      'Does not farm offline in a private island',
      'Does not drop origin when stock moves',
    ],
  },
] as const;

export const PROCESS_PHASES: ProcessPhase[] = [
  {
    title: '1 · Field & agronomic data (shared master)',
    subtitle: 'One field book feeds every module',
    steps: [
      {
        n: '1a',
        title: 'Register fields',
        who: 'Farm office',
        desc: 'Code, name, farm, crop, variety, hectares, irrigation, soil, geo.',
      },
      {
        n: '1b',
        title: 'Agronomic attributes',
        who: 'Farm office',
        desc: 'Plant date, row spacing, population, ratoon, mill group, district.',
      },
      {
        n: '1c',
        title: 'Yield analysis',
        who: 'Farm office',
        desc: 'Across-season estimate vs actual graphs per field and estate.',
      },
    ],
  },
  {
    title: '2 · Estimates (manager + mill board)',
    subtitle: 'Create · revise · submit · report',
    steps: [
      {
        n: '2a',
        title: 'Field estimates',
        who: 'Farm office',
        desc: 'Tonnes, quality (RV / moisture), t/ha, status draft → final.',
      },
      {
        n: '2b',
        title: 'Revisions',
        who: 'Farm office',
        desc: 'Auto snapshot history before each material update.',
      },
      {
        n: '2c',
        title: 'Board submission',
        who: 'Farm office',
        desc: 'Mill Group Board status, board refs, revision report CSV.',
      },
      {
        n: '2d',
        title: 'Actuals',
        who: 'Farm office',
        desc: 'Record delivered yield for across-season decision support.',
      },
    ],
  },
  {
    title: '3 · Harvest Planner',
    subtitle: 'Sequence + estimates + daily allocation → cut dates',
    steps: [
      {
        n: '3a',
        title: 'Cutting sequence',
        who: 'Farm office',
        desc: 'Order fields for the season; reorder as conditions change.',
      },
      {
        n: '3b',
        title: 'Daily allocation',
        who: 'Farm office',
        desc: 'Set tonnes per day the mill / harvest capacity can take.',
      },
      {
        n: '3c',
        title: 'Project cut dates',
        who: 'System',
        desc: 'Expected start/end date and days-to-cut per field from estimates.',
      },
      {
        n: '3d',
        title: 'Destinations',
        who: 'Trade',
        desc: 'Mill, silo or network buyer on each plan row.',
      },
    ],
  },
  {
    title: '4 · Season ops (inputs · vehicles · labour rates)',
    subtitle: 'Cost and utilisation against the same fields',
    steps: [
      {
        n: '4a',
        title: 'Inputs',
        who: 'Field ops',
        desc: 'Fertiliser, chem, seed with N-P-K / ha and cost.',
      },
      {
        n: '4b',
        title: 'Vehicle management',
        who: 'Field ops',
        desc: 'Registry, daily activity by field, fuel and utilisation reports.',
      },
      {
        n: '4c',
        title: 'Gangs & rates',
        who: 'Field ops',
        desc: 'Permanent / temporary / contractor rates; log cost by field.',
      },
    ],
  },
  {
    title: '5 · Regen & proof',
    subtitle: 'Soil · water · cover beside yield',
    steps: [
      {
        n: '5a',
        title: 'Regen samples',
        who: 'Field ops',
        desc: 'Soil organic carbon, moisture, cover, water use, biodiversity notes.',
      },
      {
        n: '5b',
        title: 'Buyer-ready metrics',
        who: 'Trade',
        desc: 'Same truth for farm office and ESG / buyer packs.',
      },
    ],
  },

  {
    title: '6 · Messages (internal & trade)',
    subtitle: 'Farm office · field ops · mill / buyer partners',
    steps: [
      {
        n: '6a',
        title: 'Office · field threads',
        who: 'Farm office / Field ops',
        desc: 'In-app colleague chat for cut plans, inputs and harvest hand-offs.',
      },
      {
        n: '6b',
        title: 'Trade partner messages',
        who: 'Trade',
        desc: 'Message mills, silos and buyers on the platform company inbox.',
      },
      {
        n: '6c',
        title: 'Close the loop',
        who: 'Team',
        desc: 'Keep operational decisions on threads next to the field book of truth.',
      },
    ],
  },
  {
    title: '7 · Trade · lots · insights',
    subtitle: 'Farm to mill / buyer on the network',
    steps: [
      {
        n: '7a',
        title: 'Trade destinations',
        who: 'Trade',
        desc: 'Hand harvest into mills, silos and buyers with trust and OTIF.',
      },
      {
        n: '7b',
        title: 'Origin lots',
        who: 'Trade',
        desc: 'Field origin into Inventory lots for chain of custody.',
      },
      {
        n: '7c',
        title: 'Season insights',
        who: 'Farm office',
        desc: 'Yield, nutrients, fleet, labour cost and regen on one scorecard.',
      },
    ],
  },
];

export const GUARDRAILS = [
  {
    title: 'Shared field master',
    desc: 'Estimates, harvest, inputs, fleet and labour all key off the same field codes and hectares.',
  },
  {
    title: 'Estimate revision trail',
    desc: 'Material changes snapshot prior tonnes, quality and status for board reports.',
  },
  {
    title: 'Cut dates from truth',
    desc: 'Projection uses non-draft estimates and daily allocation — not guesswork calendars.',
  },
  {
    title: 'Labour rate on the log',
    desc: 'Each labour day stores rate unit and computed cost for field profitability.',
  },
  {
    title: 'Fuel by vehicle',
    desc: 'Fleet logs link to the vehicle register for utilisation and L/hour.',
  },
  {
    title: 'Messages stay in-app',
    desc: 'Office, field and trade partners coordinate on OS threads — not a side WhatsApp as system of record.',
  },
  {
    title: 'Origin never drops',
    desc: 'Lots inherit field origin so mill / buyer traceability stays intact.',
  },
];

export const SYSTEM_BENEFITS = [
  {
    title: 'Multi-crop, not cane-only',
    desc: 'CropAdvisor® runs sugar cane, maize, citrus and more on one OS — estimates and harvest still work per crop.',
  },
  {
    title: 'CanePro-class cores, network-native',
    desc: 'CropAdvisor® field master, estimates, harvest planner and vehicles — plus trade on SupplierAdvisor®.',
  },
  {
    title: 'In-app messaging',
    desc: 'Internal office/field threads plus external mill and buyer partners on the company inbox.',
  },
  {
    title: 'One book of truth',
    desc: 'No re-typing field codes between estimate sheets, cut plans and fuel books.',
  },
  {
    title: 'Board-ready packs',
    desc: 'Mill Group Board style rows and CSV revision exports from live estimates.',
  },
  {
    title: 'Cost visibility',
    desc: 'Labour rates and fuel utilisation sit next to yield for real field economics.',
  },
  {
    title: 'Regen first-class',
    desc: 'Soil carbon and cover live beside tonnes — buyers and ESG see the same farm truth.',
  },
  {
    title: 'Farm-to-buyer',
    desc: 'Destinations and lots plug into network trade, trust and settlement.',
  },
  {
    title: 'Season scorecard',
    desc: 'One insights surface for yield, ops cost, fleet and regen.',
  },
];

export const ONE_SENTENCE =
  'Maintain the shared field master → build and revise season estimates → run the harvest planner → log inputs, fleet and labour → message office, field and trade partners in-app → hand lots to mill / buyer with origin and review season insights.';

// ── PDF geometry ────────────────────────────────────────────────────────

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

type Geo = {
  orientation: FieldgraphProcessGuideOrientation;
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

function geoFor(orientation: FieldgraphProcessGuideOrientation): Geo {
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

const BRAND = '#059669';
const BRAND_DEEP = '#065f46';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const SKY = '#0284c7';
const AMBER = '#d97706';
const ROSE = '#e11d48';
const VIOLET = '#7c3aed';

const CHAIN_COLORS = [BRAND_DEEP, SKY, AMBER, VIOLET, ROSE] as const;

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
        `SupplierAdvisor® · CropAdvisor® · ${orientLabel} · Primary production OS`,
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

function drawHero(doc: PdfDoc, g: Geo): number {
  const orientLabel = g.isLandscape ? 'A4 LANDSCAPE · 2 PAGES' : 'A4 PORTRAIT · 2 PAGES';
  return drawProcessGuideHero(doc, g, {
    eyebrow: 'CropAdvisor® · end-to-end process · ' + orientLabel,
    title: 'Fields → Estimates → Harvest → Fleet → Labour → Trade',
    subtitle: g.isLandscape ? undefined : 'Primary production OS — fields, yield, harvest planner, fleet, regen, trade.',
    sideNote: g.isLandscape ? 'End-to-end farm OS on SupplierAdvisor® — agronomy, harvest, mill board, trade lots.' : undefined,
    landscape: g.isLandscape,
  });
}

function drawChain(doc: PdfDoc, g: Geo, y: number): number {
  const gap = g.isLandscape ? 6 : 4;
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
      .fontSize(g.isLandscape ? 7.5 : 7)
      .fillColor(INK)
      .text(node.label, x + 8, y + 7, { width: boxW - 12 });
    doc
      .font('Helvetica')
      .fontSize(g.isLandscape ? 6.5 : 6)
      .fillColor(MUTED)
      .text(node.sub, x + 8, y + 20, { width: boxW - 12 });
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
  const tones = [BRAND_DEEP, AMBER, SKY];
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
    doc.roundedRect(x, by, boxW, boxH, 4).fillAndStroke('#ecfdf5', '#a7f3d0');
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
  const h = g.isLandscape ? 34 : 46;
  doc.roundedRect(g.mx, y, g.contentW, h, 6).fillAndStroke('#ecfdf5', '#6ee7b7');
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(BRAND_DEEP)
    .text('ONE SENTENCE — THE FULL LOOP', g.mx + 10, y + 5, {
      width: g.contentW - 20,
    });
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(INK)
    .text(ONE_SENTENCE, g.mx + 10, y + 16, { width: g.contentW - 20 });
  return y + h;
}

/**
 * 2-page A4 process design PDF (landscape or portrait).
 * Page 1: cover, chain, roles, phases 1–3
 * Page 2: phases 4–6, guardrails, benefits, outcome
 */
export async function buildFieldgraphProcessGuidePdf(opts?: {
  generatedAt?: Date;
  orientation?: FieldgraphProcessGuideOrientation;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();
  const orientation: FieldgraphProcessGuideOrientation =
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
          'CropAdvisor® Process Design — Fields → Estimates → Harvest → Ops → Trade',
        Author: 'SupplierAdvisor®',
        Subject: `CropAdvisor primary production end-to-end process (A4 ${orientation})`,
        Keywords: 'CropAdvisor, agri, harvest, estimates, farm OS, process guide',
        CreationDate: generated,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawProcessPageWash(doc, g);
    let y = drawHero(doc, g);
    y = drawChain(doc, g, y);
    y = drawRoleCards(doc, g, y);

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text('FULL PROCESS — PART A (FIELDS → ESTIMATES → HARVEST)', g.mx, y, {
        characterSpacing: 0.3,
      });
    y += 11;

    for (const phase of PROCESS_PHASES.slice(0, 3)) {
      y = drawPhase(doc, g, phase, y);
    }

    doc.addPage({ size: 'A4', layout });
    drawProcessPageWash(doc, g);
    y = drawProcessGuidePageHeader(doc, g, {
      eyebrow: 'CropAdvisor® · end-to-end process · continued',
      title: 'Process continued · Fleet · Labour · Trade · Guardrails',
      landscape: g.isLandscape,
    });

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

export function parseFieldgraphProcessGuideOrientation(
  raw: string | null | undefined
): FieldgraphProcessGuideOrientation {
  const v = String(raw || '').toLowerCase();
  if (v === 'portrait' || v === 'p') return 'portrait';
  return 'landscape';
}

export function fieldgraphProcessGuideFilename(
  orientation: FieldgraphProcessGuideOrientation
): string {
  return `CropAdvisor-Process-Design-A4-${orientation}.pdf`;
}
