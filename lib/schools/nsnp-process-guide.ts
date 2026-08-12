/**
 * NSNP end-to-end process guide content + PDF.
 * DBE → Schools → Service providers → Children fed
 * Pure pdfkit — works on Vercel serverless.
 *
 * Do not import this module from client components (pulls pdfkit into the browser bundle).
 * Client UI should use `@/lib/schools/process-guide-links` only.
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
import type { ProcessGuideOrientation } from '@/lib/schools/process-guide-links';
export type { ProcessGuideOrientation } from '@/lib/schools/process-guide-links';

// ── Content (single source for PDF; mirrors NsnpSystemFlow) ─────────────

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
  { label: 'DBE / PEU', sub: 'Rules · CoA register · claims' },
  { label: 'Schools', sub: 'Stock · CoA · serve' },
  { label: 'Service providers', sub: 'Procure · POD · OTIFEF' },
  { label: 'Messages', sub: 'DBE · school · SP' },
  { label: 'Children fed', sub: 'Authorised safe meals' },
] as const;

export const ROLE_CARDS = [
  {
    title: 'DBE / PEU',
    subtitle: 'Sets rules · kitchen register · claims',
    does: [
      'Approve schools and service providers',
      'Publish catalogue, menu, recipes, calendar',
      'PEU visits with kitchen CoA / R638 verification',
      'Track Valid CoA % on kitchen safety register',
      'Set soft/hard claim gates (SP SLA + kitchen safety)',
      'Review claim packs and run prizes',
      'Message schools and SPs in-app on programme threads',
    ],
    doesNot: [
      'Does not raise school POs',
      'Does not receive or GRN deliveries',
      'Does not cook or serve meals',
    ],
  },
  {
    title: 'Schools',
    subtitle: 'Stock → safety → order → serve → claim',
    does: [
      'Join DBE and import learners',
      'Keep CoA (R638) passport + PIC + monthly self-audit',
      'Check kitchen stock against DBE menu',
      'Raise PO to SP when short · receive GRN',
      'Serve meals + R638 daily micro-log (desk or field PWA)',
      'Claim when match + SP SLA + kitchen safety are green',
      'Message SPs on order and delivery threads',
    ],
    doesNot: [
      'Does not invent the national menu',
      'Does not procure for other schools',
    ],
  },
  {
    title: 'Service providers',
    subtitle: 'PO in → procure → deliver · OTIFEF',
    does: [
      'Join DBE and link to schools',
      'Receive purchase orders from schools',
      'Procure approved catalogue items',
      'Deliver with DN + photo POD',
      'Keep OTIFEF green so schools can claim',
      'Earn preferred score and message schools in-app',
    ],
    doesNot: [
      'Does not set DBE menus',
      'Does not serve children in the kitchen',
    ],
  },
] as const;

export const PROCESS_PHASES: ProcessPhase[] = [
  {
    title: '1 · Join the programme',
    subtitle: 'Who is allowed to participate',
    steps: [
      {
        n: '1a',
        title: 'Schools join DBE',
        who: 'School',
        desc: 'Request association; DBE/PEU approves the school.',
      },
      {
        n: '1b',
        title: 'SPs join DBE',
        who: 'SP',
        desc: 'Register as service provider; DBE approves compliance.',
      },
      {
        n: '1c',
        title: 'DBE approves joins',
        who: 'DBE',
        desc: 'Approve or reject school and SP associations on the desk.',
      },
    ],
  },
  {
    title: '2 · DBE sets the rules (no ordering)',
    subtitle: 'Catalogue · menu · recipes · calendar — schools & SPs inherit these',
    steps: [
      {
        n: '2a',
        title: 'Approved catalogue',
        who: 'DBE',
        desc: 'Brands and products that may be bought and served.',
      },
      {
        n: '2b',
        title: 'Menu cycle',
        who: 'DBE',
        desc: 'Breakfast and lunch dishes by weekday — mandated for schools.',
      },
      {
        n: '2c',
        title: 'Recipes · BOMs',
        who: 'DBE',
        desc: 'Portions, ingredients, MPS/MRP quantities for planning.',
      },
      {
        n: '2d',
        title: 'Feeding calendar',
        who: 'DBE',
        desc: 'Which days learners are fed (terms, months, holidays).',
      },
    ],
  },
  {
    title: '3 · School stock-check → order when short',
    subtitle: 'Kitchen vs DBE menu — only schools raise POs',
    steps: [
      {
        n: '3a',
        title: 'Learners on register',
        who: 'School',
        desc: 'Import and verify eligible learners for feed counts.',
      },
      {
        n: '3b',
        title: 'Check kitchen stock',
        who: 'School',
        desc: 'Compare on-hand stock to DBE menu / recipe need and cover days.',
      },
      {
        n: '3c',
        title: 'PO to SP if short',
        who: 'School',
        desc: 'Raise purchase order to linked SP — approved catalogue only.',
      },
    ],
  },
  {
    title: '4 · SP procures and delivers',
    subtitle: 'Service providers supply what schools ordered',
    steps: [
      {
        n: '4a',
        title: 'Receive school PO',
        who: 'SP',
        desc: 'See open POs from linked schools in the fulfil inbox.',
      },
      {
        n: '4b',
        title: 'Procure items',
        who: 'SP',
        desc: 'Buy / pack on-catalogue products needed for the PO.',
      },
      {
        n: '4c',
        title: 'Deliver to school',
        who: 'SP',
        desc: 'Delivery note + photo POD; only approved brands.',
      },
    ],
  },
  {
    title: '5 · School receives → safe kitchen → children fed',
    subtitle: 'GRN · CoA/R638 passport · serve-day micro-log · plates',
    steps: [
      {
        n: '5a',
        title: 'Receive into kitchen',
        who: 'School',
        desc: 'GRN stock; reject off-catalogue lines at the gate.',
      },
      {
        n: '5b',
        title: 'Kitchen safety (CoA / R638)',
        who: 'School',
        desc: 'Valid Certificate of Acceptability, PIC, monthly self-audit — legal kitchen passport.',
      },
      {
        n: '5c',
        title: 'Serve meals + micro-log',
        who: 'School',
        desc: 'Present → meals → waste → R638 daily micro-log (desk or field serve PWA).',
      },
      {
        n: '5d',
        title: 'Children fed',
        who: 'All',
        desc: 'Outcome: learners eat the authorised menu from a compliant kitchen.',
      },
    ],
  },

  {
    title: '6 · Messages (programme network)',
    subtitle: 'DBE · PEU · schools · SPs — in-app',
    steps: [
      {
        n: '6a',
        title: 'School ↔ SP threads',
        who: 'School / SP',
        desc: 'In-app messages on orders, deliveries and POD queries.',
      },
      {
        n: '6b',
        title: 'DBE / PEU coordination',
        who: 'DBE / PEU',
        desc: 'Programme messages for joins, monitoring, kitchen risk and claim queries.',
      },
      {
        n: '6c',
        title: 'Company inbox',
        who: 'All',
        desc: 'External partners stay on the platform inbox — not email as system of record.',
      },
    ],
  },
  {
    title: '7 · Verify, match, pay, reward',
    subtitle: 'Match · SLA · CoA gates · PEU · claims · prizes',
    steps: [
      {
        n: '7a',
        title: 'Three-way match · ops',
        who: 'School / DBE',
        desc: 'PO · DN · POD · GRN cleanliness on supply ops before one-click claim.',
      },
      {
        n: '7b',
        title: 'PEU monitoring + kitchen verify',
        who: 'PEU',
        desc: 'Field visits (desk or PEU PWA), NSNP scores, CoA/R638 kitchen outcome.',
      },
      {
        n: '7c',
        title: 'School claim pack',
        who: 'School',
        desc: 'Submit after feeding when match, SP OTIFEF and kitchen CoA gates pass.',
      },
      {
        n: '7d',
        title: 'DBE reviews claims',
        who: 'DBE',
        desc: 'Approve or query claims — kitchen safety included in audit pack.',
      },
      {
        n: '7e',
        title: 'Kitchen safety register',
        who: 'DBE',
        desc: 'Valid CoA % by district · soft/hard claim gate policy.',
      },
      {
        n: '7f',
        title: 'Prizes & preferred SPs',
        who: 'DBE',
        desc: 'Reward excellence; non-compliant CoA kitchens are prize-blocked.',
      },
    ],
  },
];

export const COMPLIANCE_GATES = [
  {
    title: 'Catalogue hard-stop',
    desc: 'POs and GRNs only allow products on the live DBE approved list.',
  },
  {
    title: 'Active school ↔ SP link',
    desc: 'Schools only order from approved, linked service providers.',
  },
  {
    title: 'Menu + calendar drive demand',
    desc: 'Stock cover and suggested POs come from DBE menu, recipes and feed days.',
  },
  {
    title: 'POD + GRN three-way match',
    desc: 'PO · DN · photo POD · kitchen GRN must align before one-click claim.',
  },
  {
    title: 'SP OTIFEF claim gate',
    desc: 'Linked SPs below ~60% OTIFEF can soft/hard-block school claim submit.',
  },
  {
    title: 'Kitchen CoA / R638',
    desc: 'Valid Certificate of Acceptability + PIC + recent self-audit. Soft claim gate by default; agency can hard-block. Non-compliant kitchens prize-blocked.',
  },
  {
    title: 'PEU field proof',
    desc: 'Monitoring + kitchen verification on desk or field PWA — non-compliant opens compliance.',
  },
  {
    title: 'Messages stay in-app',
    desc: 'DBE, schools and SPs coordinate on OS threads — not a side WhatsApp as system of record.',
  },
  {
    title: 'Claims only after feeding',
    desc: 'DBE pays claims backed by serve-day evidence, match, SLA and kitchen safety pack.',
  },
];

/** System benefits — why this OS beats paper and siloed tools */
export const SYSTEM_BENEFITS = [
  {
    title: 'One programme OS',
    desc: 'Catalogue, menus, stock, kitchen CoA, orders, deliveries, serve logs, monitoring and claims live in one verified network — not scattered spreadsheets.',
  },
  {
    title: 'Legal kitchen passport',
    desc: 'R638 Certificate of Acceptability, PIC training, monthly self-audit and PEU verify — continuous evidence on serve day.',
  },
  {
    title: 'In-app messaging',
    desc: 'Programme network threads for school↔SP and DBE/PEU coordination on the same OS.',
  },
  {
    title: 'Clear role boundaries',
    desc: 'DBE sets rules and checks; schools order, keep kitchens safe and serve; SPs procure and deliver. No confused double order books.',
  },
  {
    title: 'Hard compliance',
    desc: 'Off-catalogue products cannot be ordered or received. Claim gates enforce SP SLA and kitchen food safety.',
  },
  {
    title: 'End-to-end proof trail',
    desc: 'PO → DN → photo POD → kitchen GRN → serve-day + micro-log → PEU kitchen verify → claim — auditable every step.',
  },
  {
    title: 'Stock honesty',
    desc: 'Kitchen cover vs menu demand flags shortfalls early so schools order before empty shelves.',
  },
  {
    title: 'Faster fulfilment',
    desc: 'Linked SPs see school POs immediately; OTIFEF and preferred scoring reward reliable delivery.',
  },
  {
    title: 'Evidence-backed pay',
    desc: 'Claims only after feeding with match + SLA + CoA evidence — reduces waste, fraud risk and query cycles.',
  },
  {
    title: 'National visibility',
    desc: 'DBE/PEU command sees associations, Valid CoA %, exceptions and compliance without chasing phones.',
  },
  {
    title: 'Fair rewards',
    desc: 'Prizes for CoA-compliant schools and preferred SP lists make good performance visible and repeatable.',
  },
  {
    title: 'Field PWAs',
    desc: 'Kitchen serve day and PEU visit links work offline on phones — no desk login required.',
  },
  {
    title: 'SupplierAdvisor® as system of record',
    desc: 'Trade, stock and proof on the verified network — marketing sites stay discovery only.',
  },
];

export const ONE_SENTENCE =
  'DBE sets catalogue, menu and calendar → schools keep CoA/R638 kitchens, stock-check and order from linked SPs → SPs procure and deliver with POD → schools GRN, serve and micro-log → PEU verifies kitchen safety → claims pass match + SLA + CoA gates → prizes reward compliance.';

// ── PDF geometry (A4 landscape | portrait) ──────────────────────────────
// Exactly 2 pages. All text is height-clipped so pdfkit never auto-paginates
// (overflow was creating ~10 blank pages with footers only).

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

type Geo = {
  orientation: ProcessGuideOrientation;
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  contentBottom: number;
  isLandscape: boolean;
};

function geoFor(orientation: ProcessGuideOrientation): Geo {
  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? A4_PORTRAIT_H : A4_PORTRAIT_W;
  const pageH = isLandscape ? A4_PORTRAIT_W : A4_PORTRAIT_H;
  const mx = isLandscape ? 22 : 28;
  const footerY = pageH - 16;
  return {
    orientation,
    pageW,
    pageH,
    mx,
    contentW: pageW - mx * 2,
    footerY,
    contentBottom: footerY - 6,
    isLandscape,
  };
}

const BRAND = PROCESS_PDF.brand;
const BRAND_DEEP = PROCESS_PDF.brandDeep;
const INK = PROCESS_PDF.ink;
const MUTED = PROCESS_PDF.muted;
const LINE = PROCESS_PDF.line;
const SOFT = PROCESS_PDF.soft;
const EMERALD = PROCESS_PDF.emerald;
const AMBER = PROCESS_PDF.amber;
const ROSE = PROCESS_PDF.rose;
const VIOLET = PROCESS_PDF.violet;

const CHAIN_COLORS = [BRAND_DEEP, EMERALD, AMBER, VIOLET, ROSE] as const;

/** PDF-only: keep role cards short so they fit page 1 */
const PDF_ROLE_CARDS = ROLE_CARDS.map((card) => ({
  ...card,
  does: card.does.slice(0, 5),
  doesNot: card.doesNot.slice(0, 2),
}));

/** PDF-only: top benefits so page 2 stays on one sheet */
const PDF_BENEFITS = SYSTEM_BENEFITS.slice(0, 10);

function whoColor(who: string): string {
  const w = who.toLowerCase();
  if (w.includes('dbe') || w.includes('peu')) return BRAND_DEEP;
  if (w.includes('school')) return EMERALD;
  if (w === 'sp' || w.includes('/ sp') || w.startsWith('sp')) return AMBER;
  return VIOLET;
}

type PdfDoc = InstanceType<typeof PDFDocument>;

/** Clip text so pdfkit never auto-creates pages */
function fitText(
  doc: PdfDoc,
  text: string,
  x: number,
  y: number,
  opts: {
    width: number;
    height?: number;
    align?: 'left' | 'center' | 'right';
  }
) {
  doc.text(text, x, y, {
    width: opts.width,
    height: opts.height,
    align: opts.align,
    lineBreak: opts.height != null,
    ellipsis: true,
  });
}

function drawFooter(doc: PdfDoc, g: Geo, pageNum: number, total: number) {
  drawProcessFooter(doc, g, {
    productLine: 'SupplierAdvisor® · SchoolAdvisor® NSNP',
    pageNum,
    total,
  });
}

function drawHero(doc: PdfDoc, g: Geo): number {
  const orientLabel = g.isLandscape
    ? 'A4 LANDSCAPE · 2 PAGES'
    : 'A4 PORTRAIT · 2 PAGES';
  return drawProcessGuideHero(doc, g, {
    eyebrow: `SchoolAdvisor® · end-to-end process · ${orientLabel}`,
    title: 'DBE → Schools → Service providers → Children fed',
    subtitle: g.isLandscape
      ? undefined
      : 'Roles, steps, kitchen safety (CoA/R638), claim gates — system of record.',
    sideNote: g.isLandscape
      ? 'National School Nutrition Programme on SupplierAdvisor® — roles, steps, CoA/R638, claim gates.'
      : undefined,
    landscape: g.isLandscape,
  });
}

function drawChain(doc: PdfDoc, g: Geo, y: number): number {
  y = drawSectionLabel(doc, 'Process chain', g.mx, y, g.contentW, BRAND_DEEP);
  const gap = 5;
  const n = PROCESS_CHAIN.length;
  const boxW = (g.contentW - gap * (n - 1)) / n;
  const boxH = g.isLandscape ? 28 : 34;
  PROCESS_CHAIN.forEach((node, i) => {
    const x = g.mx + i * (boxW + gap);
    const color = CHAIN_COLORS[i] || BRAND;
    drawSoftCard(doc, x, y, boxW, boxH, { accent: color, radius: 5 });
    doc
      .font('Helvetica-Bold')
      .fontSize(g.isLandscape ? 7.5 : 7.5)
      .fillColor(INK);
    fitText(doc, node.label, x + 8, y + 5, { width: boxW - 14 });
    doc.font('Helvetica').fontSize(6).fillColor(MUTED);
    fitText(doc, node.sub, x + 8, y + 16, { width: boxW - 14 });
  });
  return y + boxH + 8;
}

function drawRoleCards(doc: PdfDoc, g: Geo, y: number): number {
  y = drawSectionLabel(doc, 'Who does what', g.mx, y, g.contentW, BRAND_DEEP);

  const gap = 5;
  const colW = (g.contentW - gap * 2) / 3;
  const tones = [BRAND_DEEP, EMERALD, AMBER];
  const h = g.isLandscape ? 90 : 110;

  PDF_ROLE_CARDS.forEach((card, i) => {
    const x = g.mx + i * (colW + gap);
    const tone = tones[i];
    let cy = y + 6;
    const maxY = y + h - 4;

    drawSoftCard(doc, x, y, colW, h, {
      fill: SOFT,
      accent: tone,
      radius: 6,
    });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
    fitText(doc, card.title, x + 8, cy, { width: colW - 14 });
    cy += 11;
    doc.font('Helvetica').fontSize(6).fillColor(MUTED);
    fitText(doc, card.subtitle, x + 8, cy, { width: colW - 14 });
    cy += 10;
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor(tone);
    fitText(doc, 'DOES', x + 8, cy, { width: colW - 14 });
    cy += 8;
    for (const line of card.does) {
      if (cy + 7 > maxY - 22) break;
      doc.font('Helvetica').fontSize(5.5).fillColor(INK);
      fitText(doc, `• ${line}`, x + 8, cy, {
        width: colW - 14,
        height: 7,
      });
      cy += 7.5;
    }
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor(MUTED);
    fitText(doc, 'DOES NOT', x + 8, cy, { width: colW - 14 });
    cy += 8;
    for (const line of card.doesNot) {
      if (cy + 7 > maxY) break;
      doc.font('Helvetica').fontSize(5.5).fillColor(MUTED);
      fitText(doc, `• ${line}`, x + 8, cy, {
        width: colW - 14,
        height: 7,
      });
      cy += 7.5;
    }
  });

  return y + h + 8;
}

function drawPhase(doc: PdfDoc, g: Geo, phase: ProcessPhase, y: number): number {
  const titleH = g.isLandscape ? 11 : 18;
  if (g.isLandscape) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND_DEEP);
    fitText(doc, phase.title, g.mx, y, { width: g.contentW * 0.42 });
    doc.font('Helvetica').fontSize(6).fillColor(MUTED);
    fitText(doc, phase.subtitle, g.mx + g.contentW * 0.42, y + 0.5, {
      width: g.contentW * 0.58,
      align: 'right',
    });
  } else {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND_DEEP);
    fitText(doc, phase.title, g.mx, y, { width: g.contentW });
    doc.font('Helvetica').fontSize(6.5).fillColor(MUTED);
    fitText(doc, phase.subtitle, g.mx, y + 10, { width: g.contentW });
  }
  y += titleH;

  const gap = 4;
  const n = Math.max(1, phase.steps.length);
  const boxW = (g.contentW - gap * (n - 1)) / n;
  const boxH = g.isLandscape ? 38 : 46;

  phase.steps.forEach((step, i) => {
    const x = g.mx + i * (boxW + gap);
    const wc = whoColor(step.who);
    drawSoftCard(doc, x, y, boxW, boxH, { accent: wc, radius: 4 });
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor(wc);
    fitText(doc, step.n, x + 6, y + 4, { width: 18 });
    const badgeW = Math.min(32, boxW - 22);
    doc.roundedRect(x + boxW - badgeW - 3, y + 2.5, badgeW, 8, 2).fill(wc);
    doc.font('Helvetica-Bold').fontSize(5).fillColor('#ffffff');
    fitText(doc, step.who, x + boxW - badgeW - 3, y + 3.5, {
      width: badgeW,
      align: 'center',
    });
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(INK);
    fitText(doc, step.title, x + 3, y + 12, {
      width: boxW - 6,
      height: 9,
    });
    doc.font('Helvetica').fontSize(5.5).fillColor(MUTED);
    fitText(doc, step.desc, x + 3, y + 22, {
      width: boxW - 6,
      height: boxH - 24,
    });
  });

  return y + boxH + (g.isLandscape ? 4 : 6);
}

function drawGates(doc: PdfDoc, g: Geo, y: number): number {
  y = drawSectionLabel(
    doc,
    'Guardrails — children get what was authorised',
    g.mx,
    y,
    g.contentW,
    EMERALD
  );

  const gap = 4;
  const cols = g.isLandscape ? 5 : 3;
  const boxW = (g.contentW - gap * (cols - 1)) / cols;
  const boxH = g.isLandscape ? 30 : 38;
  COMPLIANCE_GATES.forEach((gate, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = g.mx + col * (boxW + gap);
    const gy = y + row * (boxH + gap);
    drawSoftCard(doc, x, gy, boxW, boxH, {
      fill: '#ecfdf5',
      stroke: '#a7f3d0',
      accent: EMERALD,
      radius: 4,
    });
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor(EMERALD);
    fitText(doc, gate.title, x + 6, gy + 4, {
      width: boxW - 10,
      height: 8,
    });
    doc.font('Helvetica').fontSize(5).fillColor(INK);
    fitText(doc, gate.desc, x + 6, gy + 13, {
      width: boxW - 10,
      height: boxH - 16,
    });
  });
  const rows = Math.ceil(COMPLIANCE_GATES.length / cols);
  return y + rows * (boxH + gap) + 6;
}

function drawBenefits(doc: PdfDoc, g: Geo, y: number): number {
  y = drawSectionLabel(
    doc,
    'Benefits of the system',
    g.mx,
    y,
    g.contentW,
    BRAND_DEEP
  );

  const gap = 4;
  const cols = g.isLandscape ? 5 : 2;
  const benefits = PDF_BENEFITS;
  const boxW = (g.contentW - gap * (cols - 1)) / cols;
  const boxH = g.isLandscape ? 28 : 36;

  benefits.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = g.mx + col * (boxW + gap);
    const by = y + row * (boxH + gap);
    drawSoftCard(doc, x, by, boxW, boxH, {
      fill: SOFT,
      accent: BRAND,
      radius: 4,
    });
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor(INK);
    fitText(doc, b.title, x + 8, by + 4, {
      width: boxW - 12,
      height: 7,
    });
    doc.font('Helvetica').fontSize(5).fillColor(MUTED);
    fitText(doc, b.desc, x + 8, by + 13, {
      width: boxW - 12,
      height: boxH - 16,
    });
  });

  const rows = Math.ceil(benefits.length / cols);
  return y + rows * (boxH + gap) + 6;
}

function drawOutcome(doc: PdfDoc, g: Geo, y: number): number {
  const h = g.isLandscape ? 30 : 42;
  const maxY = g.contentBottom - h;
  if (y > maxY) y = maxY;

  drawSoftCard(doc, g.mx, y, g.contentW, h, {
    fill: '#e0f2fe',
    stroke: '#7dd3fc',
    accent: BRAND_DEEP,
    radius: 5,
  });
  doc.font('Helvetica-Bold').fontSize(6).fillColor(BRAND_DEEP);
  fitText(doc, 'ONE SENTENCE — THE FULL LOOP', g.mx + 10, y + 5, {
    width: g.contentW - 18,
  });
  doc.font('Helvetica').fontSize(6.5).fillColor(INK);
  fitText(doc, ONE_SENTENCE, g.mx + 10, y + 14, {
    width: g.contentW - 18,
    height: h - 18,
  });
  return y + h;
}

/**
 * Exactly 2-page A4 process guide PDF (landscape or portrait).
 * Page 1: hero, chain, roles, phases 1–3
 * Page 2: phases 4–7, guardrails, benefits, outcome
 */
export async function buildNsnpProcessGuidePdf(opts?: {
  generatedAt?: Date;
  orientation?: ProcessGuideOrientation;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();
  const orientation: ProcessGuideOrientation =
    opts?.orientation === 'portrait' ? 'portrait' : 'landscape';
  const g = geoFor(orientation);
  const layout = orientation;

  // Normal margins; all text uses fitText height clips so content cannot overflow.
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
        Title:
          'NSNP Process Guide — DBE → Schools → Service providers → Children fed',
        Author: 'SupplierAdvisor®',
        Subject: `National School Nutrition Programme end-to-end process (A4 ${orientation})`,
        Keywords: 'NSNP, DBE, PEU, school nutrition, process guide',
        CreationDate: generated,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── PAGE 1 ────────────────────────────────────────────────────────
    let y = drawHero(doc, g);
    drawProcessPageWash(doc, g, Math.max(0, y - 8));
    y = drawChain(doc, g, y);
    y = drawRoleCards(doc, g, y);

    y = drawSectionLabel(
      doc,
      'Full process — Part A (join → rules → school stock / order)',
      g.mx,
      y,
      g.contentW,
      BRAND_DEEP
    );

    for (const phase of PROCESS_PHASES.slice(0, 3)) {
      y = drawPhase(doc, g, phase, y);
    }

    // ── PAGE 2 (exactly one more) ─────────────────────────────────────
    doc.addPage({
      size: 'A4',
      layout,
      margins: pageMargins,
    });

    y = drawProcessGuidePageHeader(doc, g, {
      eyebrow: 'SchoolAdvisor® · end-to-end process · continued',
      title: g.isLandscape
        ? 'Process continued · Guardrails · Benefits · Outcome'
        : 'Process continued · Guardrails · Benefits · Outcome',
      landscape: g.isLandscape,
    });
    drawProcessPageWash(doc, g, Math.max(0, y - 8));
    y = drawSectionLabel(
      doc,
      'Full process — Part B (SP supply → safe serve → verify · pay · reward)',
      g.mx,
      y,
      g.contentW,
      BRAND_DEEP
    );

    // Phases 4–7; reserve ~110pt for gates + benefits + outcome on landscape
    const reserve = g.isLandscape ? 108 : 160;
    for (const phase of PROCESS_PHASES.slice(3)) {
      if (y + 42 > g.contentBottom - reserve) break;
      y = drawPhase(doc, g, phase, y);
    }

    if (y + 56 < g.contentBottom) {
      y = drawGates(doc, g, y + 1);
    }
    if (y + 48 < g.contentBottom) {
      y = drawBenefits(doc, g, y);
    }
    drawOutcome(doc, g, Math.min(y, g.contentBottom - 28));

    // Footers on the two designed pages only
    const range = doc.bufferedPageRange();
    const total = Math.min(2, range.count);
    for (let i = 0; i < total; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, g, i + 1, 2);
    }

    doc.end();
  });
}

export function parseProcessGuideOrientation(
  raw: string | null | undefined
): ProcessGuideOrientation {
  const v = String(raw || '')
    .toLowerCase()
    .trim();
  if (v === 'portrait' || v === 'p' || v === 'vertical') return 'portrait';
  return 'landscape';
}

export function nsnpProcessGuideFilename(
  orientation: ProcessGuideOrientation = 'landscape',
  d = new Date()
): string {
  const day = d.toISOString().slice(0, 10);
  const orient = orientation === 'portrait' ? 'Portrait' : 'Landscape';
  return `NSNP-Process-Guide-${orient}-${day}.pdf`;
}
