/**
 * NSNP end-to-end process guide content + PDF.
 * DBE → Schools → Service providers → Children fed
 * Pure pdfkit — works on Vercel serverless.
 *
 * Do not import this module from client components (pulls pdfkit into the browser bundle).
 * Client UI should use `@/lib/schools/process-guide-links` only.
 */
import PDFDocument from 'pdfkit';
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

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

type Geo = {
  orientation: ProcessGuideOrientation;
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

function geoFor(orientation: ProcessGuideOrientation): Geo {
  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? A4_PORTRAIT_H : A4_PORTRAIT_W;
  const pageH = isLandscape ? A4_PORTRAIT_W : A4_PORTRAIT_H;
  const mx = isLandscape ? 32 : 36;
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

const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const EMERALD = '#059669';
const AMBER = '#d97706';
const ROSE = '#e11d48';
const VIOLET = '#7c3aed';

const CHAIN_COLORS = [BRAND_DEEP, EMERALD, AMBER, ROSE] as const;

function whoColor(who: string): string {
  const w = who.toLowerCase();
  if (w === 'dbe' || w === 'peu') return BRAND_DEEP;
  if (w === 'school') return EMERALD;
  if (w === 'sp') return AMBER;
  return VIOLET;
}

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

function drawFooter(
  doc: PdfDoc,
  g: Geo,
  pageNum: number,
  total: number
) {
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
        `SupplierAdvisor® · NSNP · ${orientLabel} · System of record`,
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
      .fillColor('#bae6fd')
      .text(`DBE / PEU COMMAND  ·  PROCESS GUIDE  ·  ${orientLabel}`, g.mx, 12, {
        width: g.contentW,
        characterSpacing: 1,
      });
    if (g.isLandscape) {
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#ffffff')
        .text('DBE → Schools → Service providers → Children fed', g.mx, 28, {
          width: g.contentW * 0.72,
        });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#e0f2fe')
        .text(
          'End-to-end National School Nutrition Programme on SupplierAdvisor® — every role, every step, every guardrail, and why it works.',
          g.mx + g.contentW * 0.72,
          28,
          { width: g.contentW * 0.28 }
        );
    } else {
      doc
        .font('Helvetica-Bold')
        .fontSize(15)
        .fillColor('#ffffff')
        .text('DBE → Schools → Service providers → Children fed', g.mx, 30, {
          width: g.contentW,
        });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#e0f2fe')
        .text(
          'End-to-end National School Nutrition Programme on SupplierAdvisor® — every role, every step, every guardrail, and why it works.',
          g.mx,
          62,
          { width: g.contentW }
        );
    }
  });
}

function drawChain(doc: PdfDoc, g: Geo, y: number): number {
  const gap = g.isLandscape ? 10 : 6;
  const n = PROCESS_CHAIN.length;
  const boxW = (g.contentW - gap * (n - 1)) / n;
  const boxH = g.isLandscape ? 36 : 40;
  PROCESS_CHAIN.forEach((node, i) => {
    const x = g.mx + i * (boxW + gap);
    const color = CHAIN_COLORS[i] || BRAND;
    doc.roundedRect(x, y, boxW, boxH, 6).fillAndStroke('#ffffff', color);
    doc.rect(x, y, 4, boxH).fill(color);
    doc
      .font('Helvetica-Bold')
      .fontSize(g.isLandscape ? 10 : 8)
      .fillColor(INK)
      .text(node.label, x + 10, y + 8, { width: boxW - 16 });
    doc
      .font('Helvetica')
      .fontSize(g.isLandscape ? 7.5 : 6.5)
      .fillColor(MUTED)
      .text(node.sub, x + 10, y + 22, { width: boxW - 16 });
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
  const tones = [BRAND_DEEP, EMERALD, AMBER];
  const h = g.isLandscape ? 118 : 132;

  ROLE_CARDS.forEach((card, i) => {
    const x = g.mx + i * (colW + gap);
    const tone = tones[i];
    let cy = y + 7;

    doc.roundedRect(x, y, colW, h, 7).fillAndStroke(SOFT, LINE);
    doc.rect(x, y, colW, 3).fill(tone);
    doc
      .font('Helvetica-Bold')
      .fontSize(g.isLandscape ? 10 : 9)
      .fillColor(INK)
      .text(card.title, x + 8, cy, { width: colW - 16 });
    cy += 12;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(card.subtitle, x + 8, cy, { width: colW - 16 });
    cy += 12;
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(tone)
      .text('DOES', x + 8, cy);
    cy += 9;
    card.does.forEach((line) => {
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(INK)
        .text(`• ${line}`, x + 8, cy, { width: colW - 16 });
      cy += g.isLandscape ? 9.5 : 10.5;
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
        .fontSize(6.5)
        .fillColor(MUTED)
        .text(`• ${line}`, x + 8, cy, { width: colW - 16 });
      cy += 9.5;
    });
  });

  return y + h + 10;
}

function drawPhase(doc: PdfDoc, g: Geo, phase: ProcessPhase, y: number): number {
  if (g.isLandscape) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(BRAND_DEEP)
      .text(phase.title, g.mx, y, {
        width: g.contentW * 0.45,
        continued: false,
      });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(phase.subtitle, g.mx + g.contentW * 0.45, y + 1, {
        width: g.contentW * 0.55,
        align: 'right',
      });
    y += 12;
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(BRAND_DEEP)
      .text(phase.title, g.mx, y, { width: g.contentW });
    y += 11;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(phase.subtitle, g.mx, y, { width: g.contentW });
    y += 11;
  }

  const gap = 5;
  const n = phase.steps.length;
  const boxW = (g.contentW - gap * (n - 1)) / n;
  const boxH = g.isLandscape ? 48 : 58;

  phase.steps.forEach((step, i) => {
    const x = g.mx + i * (boxW + gap);
    const wc = whoColor(step.who);
    doc.roundedRect(x, y, boxW, boxH, 5).fillAndStroke('#ffffff', LINE);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(wc)
      .text(step.n, x + 5, y + 5, { width: 22 });
    const badgeW = Math.min(36, boxW - 28);
    doc.roundedRect(x + boxW - badgeW - 4, y + 4, badgeW, 11, 3).fill(wc);
    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor('#ffffff')
      .text(step.who, x + boxW - badgeW - 4, y + 6, {
        width: badgeW,
        align: 'center',
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(g.isLandscape ? 8 : 7.5)
      .fillColor(INK)
      .text(step.title, x + 5, y + 18, { width: boxW - 10 });
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(MUTED)
      .text(step.desc, x + 5, y + 30, {
        width: boxW - 10,
        height: boxH - 34,
      });
  });

  return y + boxH + (g.isLandscape ? 8 : 10);
}

function drawGates(doc: PdfDoc, g: Geo, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('GUARDRAILS — CHILDREN GET WHAT WAS AUTHORISED', g.mx, y, {
      characterSpacing: 0.5,
    });
  y += 10;

  const gap = 6;
  const cols = g.isLandscape ? 6 : 3;
  const boxW = (g.contentW - gap * (cols - 1)) / cols;
  const boxH = g.isLandscape ? 52 : 48;
  COMPLIANCE_GATES.forEach((gate, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = g.mx + col * (boxW + gap);
    const gy = y + row * (boxH + gap);
    doc.roundedRect(x, gy, boxW, boxH, 5).fillAndStroke('#ecfdf5', '#a7f3d0');
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(EMERALD)
      .text(gate.title, x + 5, gy + 6, { width: boxW - 10 });
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor(INK)
      .text(gate.desc, x + 5, gy + 20, { width: boxW - 10, height: 26 });
  });
  const rows = Math.ceil(COMPLIANCE_GATES.length / cols);
  return y + rows * (boxH + gap) + 6;
}

function drawBenefits(doc: PdfDoc, g: Geo, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('BENEFITS OF THE SYSTEM', g.mx, y, { characterSpacing: 0.5 });
  y += 10;

  const gap = 5;
  const cols = g.isLandscape ? 5 : 2;
  const boxW = (g.contentW - gap * (cols - 1)) / cols;
  const boxH = g.isLandscape ? 46 : 42;

  SYSTEM_BENEFITS.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = g.mx + col * (boxW + gap);
    const by = y + row * (boxH + gap);
    doc.roundedRect(x, by, boxW, boxH, 5).fillAndStroke(SOFT, LINE);
    doc.circle(x + 8, by + 10, 2.5).fill(BRAND);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(INK)
      .text(b.title, x + 14, by + 6, { width: boxW - 20 });
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor(MUTED)
      .text(b.desc, x + 6, by + 18, { width: boxW - 12, height: boxH - 22 });
  });

  const rows = Math.ceil(SYSTEM_BENEFITS.length / cols);
  return y + rows * (boxH + gap) + 6;
}

function drawOutcome(doc: PdfDoc, g: Geo, y: number): number {
  const h = g.isLandscape ? 36 : 48;
  doc
    .roundedRect(g.mx, y, g.contentW, h, 6)
    .fillAndStroke('#e0f2fe', '#7dd3fc');
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(BRAND_DEEP)
    .text('ONE SENTENCE — THE FULL LOOP', g.mx + 12, y + 6, {
      width: g.contentW - 24,
    });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(INK)
    .text(ONE_SENTENCE, g.mx + 12, y + 18, { width: g.contentW - 24 });
  return y + h;
}

/**
 * Beautiful 2-page A4 process guide PDF (landscape or portrait).
 * Page 1: cover, chain, roles, phases 1–3
 * Page 2: phases 4–6, guardrails, benefits, outcome
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

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout,
      bufferPages: true,
      autoFirstPage: true,
      margins: { top: 0, bottom: 28, left: g.mx, right: g.mx },
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
    drawHero(doc, g);
    let y = g.isLandscape ? 78 : 102;
    y = drawChain(doc, g, y);
    y = drawRoleCards(doc, g, y);

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text('FULL PROCESS — PART A (JOIN → RULES → SCHOOL ORDER)', g.mx, y, {
        characterSpacing: 0.4,
      });
    y += 11;

    for (const phase of PROCESS_PHASES.slice(0, 3)) {
      y = drawPhase(doc, g, phase, y);
    }

    // ── PAGE 2 ────────────────────────────────────────────────────────
    doc.addPage({ size: 'A4', layout });
    withOpenMargins(doc, () => {
      const headH = g.isLandscape ? 40 : 48;
      doc.rect(0, 0, g.pageW, headH).fill(BRAND_DEEP);
      doc.rect(0, headH - 4, g.pageW, 4).fill(BRAND);
      doc
        .font('Helvetica-Bold')
        .fontSize(g.isLandscape ? 12 : 11)
        .fillColor('#ffffff')
        .text(
          'Process continued · Guardrails · Benefits of the system',
          g.mx,
          g.isLandscape ? 12 : 14,
          { width: g.contentW }
        );
      if (!g.isLandscape) {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#bae6fd')
          .text(
            'Phases 4–6 complete the loop from SP fulfilment to children fed and payment.',
            g.mx,
            30,
            { width: g.contentW }
          );
      }
    });

    y = g.isLandscape ? 50 : 58;
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(
        'FULL PROCESS — PART B (SP SUPPLY → CHILDREN FED → VERIFY & PAY)',
        g.mx,
        y,
        { characterSpacing: 0.4 }
      );
    y += 11;

    for (const phase of PROCESS_PHASES.slice(3)) {
      y = drawPhase(doc, g, phase, y);
    }

    y = drawGates(doc, g, y + 2);
    y = drawBenefits(doc, g, y);
    drawOutcome(doc, g, y);

    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, g, i + 1, total);
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
  const orient =
    orientation === 'portrait' ? 'Portrait' : 'Landscape';
  return `NSNP-Process-Guide-${orient}-${day}.pdf`;
}
