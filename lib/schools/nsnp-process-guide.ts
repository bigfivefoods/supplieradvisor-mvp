/**
 * NSNP end-to-end process guide content + PDF.
 * DBE → Schools → Service providers → Children fed
 * Pure pdfkit — works on Vercel serverless.
 */
import PDFDocument from 'pdfkit';

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
  { label: 'DBE / PEU', sub: 'Sets rules & checks' },
  { label: 'Schools', sub: 'Stock · order · serve' },
  { label: 'Service providers', sub: 'Procure · deliver' },
  { label: 'Children fed', sub: 'Authorised meals' },
] as const;

export const ROLE_CARDS = [
  {
    title: 'DBE / PEU',
    subtitle: 'Sets rules & checks compliance',
    does: [
      'Approve schools and service providers',
      'Publish catalogue, menu, recipes, calendar',
      'PEU visits and monitoring',
      'Review and approve claim packs',
      'Run prizes and preferred-SP scoring',
    ],
    doesNot: [
      'Does not raise school POs',
      'Does not receive or GRN deliveries',
      'Does not cook or serve meals',
    ],
  },
  {
    title: 'Schools',
    subtitle: 'Stock → order → receive → serve',
    does: [
      'Join DBE and import learners',
      'Check kitchen stock against DBE menu',
      'Raise PO to SP when short',
      'Receive stock (GRN) into kitchen',
      'Serve meals on feed days · claim',
    ],
    doesNot: [
      'Does not invent the national menu',
      'Does not procure for other schools',
    ],
  },
  {
    title: 'Service providers',
    subtitle: 'PO in → procure → deliver',
    does: [
      'Join DBE and link to schools',
      'Receive purchase orders from schools',
      'Procure approved catalogue items',
      'Deliver with DN + photo POD',
      'Earn preferred score and OTIF',
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
    title: '5 · School receives → children fed',
    subtitle: 'GRN into kitchen, then plates on feed days',
    steps: [
      {
        n: '5a',
        title: 'Receive into kitchen',
        who: 'School',
        desc: 'GRN stock; reject off-catalogue lines at the gate.',
      },
      {
        n: '5b',
        title: 'Serve meals',
        who: 'School',
        desc: 'Log serve-day against the DBE feeding calendar.',
      },
      {
        n: '5c',
        title: 'Children fed',
        who: 'All',
        desc: 'Outcome: learners eat the authorised menu that day.',
      },
    ],
  },
  {
    title: '6 · Verify, pay, reward',
    subtitle: 'Close the loop without DBE ordering food',
    steps: [
      {
        n: '6a',
        title: 'PEU monitoring',
        who: 'PEU',
        desc: 'Field visits and NSNP monitoring scores.',
      },
      {
        n: '6b',
        title: 'School claim pack',
        who: 'School',
        desc: 'Submit claim with evidence after feeding.',
      },
      {
        n: '6c',
        title: 'DBE reviews claims',
        who: 'DBE',
        desc: 'Approve or query claims — not GRN or warehouse.',
      },
      {
        n: '6d',
        title: 'Prizes & preferred SPs',
        who: 'DBE',
        desc: 'Reward school compliance and on-catalogue SPs.',
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
    title: 'POD + GRN match',
    desc: 'SP delivers with photo proof; school receives into kitchen stock.',
  },
  {
    title: 'PEU field proof',
    desc: 'Monitoring checks that meals match the authorised programme.',
  },
  {
    title: 'Claims only after feeding',
    desc: 'DBE pays claims backed by serve-day and compliance evidence.',
  },
];

/** System benefits — why this OS beats paper and siloed tools */
export const SYSTEM_BENEFITS = [
  {
    title: 'One programme OS',
    desc: 'Catalogue, menus, stock, orders, deliveries, serve logs, monitoring and claims live in one verified network — not scattered spreadsheets.',
  },
  {
    title: 'Clear role boundaries',
    desc: 'DBE sets rules and checks; schools order and serve; SPs procure and deliver. No confused double order books.',
  },
  {
    title: 'Hard compliance',
    desc: 'Off-catalogue products cannot be ordered or received. Children get what was authorised.',
  },
  {
    title: 'End-to-end proof trail',
    desc: 'PO → delivery note → photo POD → kitchen GRN → serve-day → PEU visit → claim — auditable every step.',
  },
  {
    title: 'Stock honesty',
    desc: 'Kitchen cover vs menu demand flags shortfalls early so schools order before empty shelves.',
  },
  {
    title: 'Faster fulfilment',
    desc: 'Linked SPs see school POs immediately; OTIF and preferred scoring reward reliable delivery.',
  },
  {
    title: 'Evidence-backed pay',
    desc: 'Claims only after feeding with evidence — reduces waste, fraud risk and query cycles.',
  },
  {
    title: 'National visibility',
    desc: 'DBE/PEU command sees associations, coverage, exceptions and compliance without chasing phones.',
  },
  {
    title: 'Fair rewards',
    desc: 'Prizes for schools and preferred SP lists make good performance visible and repeatable.',
  },
  {
    title: 'SupplierAdvisor® as system of record',
    desc: 'Trade, stock and proof on the verified network — marketing sites stay discovery only.',
  },
];

export const ONE_SENTENCE =
  'DBE sets catalogue, menus and calendar → schools check stock and order from SPs when short → SPs procure and deliver → schools GRN and serve → PEU verifies → DBE pays claims and rewards compliance.';

// ── PDF geometry (A4) ───────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 36;
const CONTENT_W = PAGE_W - MX * 2;

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

function drawFooter(doc: PdfDoc, pageNum: number, total: number) {
  withOpenMargins(doc, () => {
    const y = PAGE_H - 28;
    doc
      .moveTo(MX, y)
      .lineTo(PAGE_W - MX, y)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        'SupplierAdvisor® · National School Nutrition Programme · System of record',
        MX,
        y + 6,
        { width: CONTENT_W * 0.7, align: 'left' }
      );
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(`Page ${pageNum} of ${total}`, MX, y + 6, {
        width: CONTENT_W,
        align: 'right',
      });
  });
}

function drawHero(doc: PdfDoc) {
  withOpenMargins(doc, () => {
    // Full-width gradient-ish band (solid + accent strip)
    doc.rect(0, 0, PAGE_W, 108).fill(BRAND_DEEP);
    doc.rect(0, 100, PAGE_W, 8).fill(BRAND);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#bae6fd')
      .text('DBE / PEU COMMAND  ·  PROCESS GUIDE', MX, 18, {
        width: CONTENT_W,
        characterSpacing: 1.2,
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#ffffff')
      .text('DBE → Schools → Service providers → Children fed', MX, 36, {
        width: CONTENT_W,
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#e0f2fe')
      .text(
        'End-to-end National School Nutrition Programme on SupplierAdvisor® — every role, every step, every guardrail, and why it works.',
        MX,
        72,
        { width: CONTENT_W }
      );
  });
}

function drawChain(doc: PdfDoc, y: number): number {
  const gap = 8;
  const n = PROCESS_CHAIN.length;
  const boxW = (CONTENT_W - gap * (n - 1)) / n;
  const boxH = 42;
  PROCESS_CHAIN.forEach((node, i) => {
    const x = MX + i * (boxW + gap);
    const color = CHAIN_COLORS[i] || BRAND;
    doc.roundedRect(x, y, boxW, boxH, 6).fillAndStroke('#ffffff', color);
    doc.rect(x, y, 4, boxH).fill(color);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(INK)
      .text(node.label, x + 10, y + 10, { width: boxW - 16 });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(node.sub, x + 10, y + 24, { width: boxW - 16 });
    if (i < n - 1) {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(LINE)
        .text('→', x + boxW - 2, y + 14, { width: gap + 4, align: 'center' });
    }
  });
  return y + boxH + 12;
}

function drawRoleCards(doc: PdfDoc, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(MUTED)
    .text('WHO DOES WHAT', MX, y, { characterSpacing: 0.8 });
  y += 14;

  const gap = 8;
  const colW = (CONTENT_W - gap * 2) / 3;
  const tones = [BRAND_DEEP, EMERALD, AMBER];
  let maxBottom = y;

  ROLE_CARDS.forEach((card, i) => {
    const x = MX + i * (colW + gap);
    const tone = tones[i];
    let cy = y + 8;
    // Measure height roughly
    const headerH = 36;
    const doesH = card.does.length * 11 + 14;
    const notH = card.doesNot.length * 10 + 12;
    const h = headerH + doesH + notH + 16;

    doc.roundedRect(x, y, colW, h, 8).fillAndStroke(SOFT, LINE);
    doc.rect(x, y, colW, 4).fill(tone);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(INK)
      .text(card.title, x + 8, cy, { width: colW - 16 });
    cy += 13;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(card.subtitle, x + 8, cy, { width: colW - 16 });
    cy += 14;
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(tone)
      .text('DOES', x + 8, cy, { width: colW - 16 });
    cy += 10;
    card.does.forEach((line) => {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(INK)
        .text(`• ${line}`, x + 8, cy, { width: colW - 16 });
      cy += 11;
    });
    cy += 4;
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(MUTED)
      .text('DOES NOT', x + 8, cy, { width: colW - 16 });
    cy += 10;
    card.doesNot.forEach((line) => {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(`• ${line}`, x + 8, cy, { width: colW - 16 });
      cy += 10;
    });
    maxBottom = Math.max(maxBottom, y + h);
  });

  return maxBottom + 14;
}

function drawPhase(
  doc: PdfDoc,
  phase: ProcessPhase,
  y: number,
  opts?: { compact?: boolean }
): number {
  const compact = opts?.compact ?? false;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(BRAND_DEEP)
    .text(phase.title, MX, y, { width: CONTENT_W });
  y += 12;
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(phase.subtitle, MX, y, { width: CONTENT_W });
  y += compact ? 12 : 14;

  const gap = 6;
  const n = phase.steps.length;
  const boxW = (CONTENT_W - gap * (n - 1)) / n;
  const boxH = compact ? 58 : 64;

  phase.steps.forEach((step, i) => {
    const x = MX + i * (boxW + gap);
    const wc = whoColor(step.who);
    doc.roundedRect(x, y, boxW, boxH, 6).fillAndStroke('#ffffff', LINE);
    // number + who badge
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(wc)
      .text(step.n, x + 6, y + 6, { width: 24 });
    doc
      .roundedRect(x + boxW - 42, y + 5, 36, 12, 3)
      .fill(wc);
    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor('#ffffff')
      .text(step.who, x + boxW - 42, y + 7, {
        width: 36,
        align: 'center',
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(INK)
      .text(step.title, x + 6, y + 20, { width: boxW - 12 });
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(MUTED)
      .text(step.desc, x + 6, y + 34, { width: boxW - 12, height: 26 });
  });

  return y + boxH + (compact ? 10 : 12);
}

function drawGates(doc: PdfDoc, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(MUTED)
    .text('GUARDRAILS — CHILDREN GET WHAT WAS AUTHORISED', MX, y, {
      characterSpacing: 0.6,
    });
  y += 12;

  const gap = 6;
  const cols = 3;
  const boxW = (CONTENT_W - gap * (cols - 1)) / cols;
  const boxH = 48;
  COMPLIANCE_GATES.forEach((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MX + col * (boxW + gap);
    const gy = y + row * (boxH + gap);
    doc.roundedRect(x, gy, boxW, boxH, 6).fillAndStroke('#ecfdf5', '#a7f3d0');
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(EMERALD)
      .text(g.title, x + 8, gy + 8, { width: boxW - 16 });
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(INK)
      .text(g.desc, x + 8, gy + 20, { width: boxW - 16, height: 24 });
  });
  const rows = Math.ceil(COMPLIANCE_GATES.length / cols);
  return y + rows * (boxH + gap) + 4;
}

function drawBenefits(doc: PdfDoc, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(MUTED)
    .text('BENEFITS OF THE SYSTEM', MX, y, { characterSpacing: 0.6 });
  y += 12;

  const gap = 6;
  const cols = 2;
  const boxW = (CONTENT_W - gap) / cols;
  const boxH = 40;

  SYSTEM_BENEFITS.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MX + col * (boxW + gap);
    const by = y + row * (boxH + gap);
    doc.roundedRect(x, by, boxW, boxH, 5).fillAndStroke(SOFT, LINE);
    doc.circle(x + 10, by + 12, 3).fill(BRAND);
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(INK)
      .text(b.title, x + 18, by + 7, { width: boxW - 26 });
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(MUTED)
      .text(b.desc, x + 18, by + 18, { width: boxW - 26, height: 20 });
  });

  const rows = Math.ceil(SYSTEM_BENEFITS.length / cols);
  return y + rows * (boxH + gap) + 8;
}

function drawOutcome(doc: PdfDoc, y: number): number {
  const h = 52;
  doc.roundedRect(MX, y, CONTENT_W, h, 8).fillAndStroke('#e0f2fe', '#7dd3fc');
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(BRAND_DEEP)
    .text('ONE SENTENCE — THE FULL LOOP', MX + 12, y + 10, {
      width: CONTENT_W - 24,
    });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(INK)
    .text(ONE_SENTENCE, MX + 12, y + 24, { width: CONTENT_W - 24 });
  return y + h;
}

/**
 * Beautiful 2-page A4 process guide PDF.
 * Page 1: cover, chain, roles, phases 1–3
 * Page 2: phases 4–6, guardrails, benefits, outcome
 */
export async function buildNsnpProcessGuidePdf(opts?: {
  generatedAt?: Date;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      autoFirstPage: true,
      margins: { top: 0, bottom: 36, left: MX, right: MX },
      info: {
        Title:
          'NSNP Process Guide — DBE → Schools → Service providers → Children fed',
        Author: 'SupplierAdvisor®',
        Subject: 'National School Nutrition Programme end-to-end process',
        Keywords: 'NSNP, DBE, PEU, school nutrition, process guide',
        CreationDate: generated,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── PAGE 1 ────────────────────────────────────────────────────────
    drawHero(doc);
    let y = 120;
    y = drawChain(doc, y);
    y = drawRoleCards(doc, y);

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('FULL PROCESS — START TO CHILDREN FED (PART A)', MX, y, {
        characterSpacing: 0.5,
      });
    y += 14;

    // Phases 1–3 on page 1
    for (const phase of PROCESS_PHASES.slice(0, 3)) {
      y = drawPhase(doc, phase, y, { compact: true });
    }

    // ── PAGE 2 ────────────────────────────────────────────────────────
    doc.addPage();
    withOpenMargins(doc, () => {
      doc.rect(0, 0, PAGE_W, 48).fill(BRAND_DEEP);
      doc.rect(0, 44, PAGE_W, 4).fill(BRAND);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#ffffff')
        .text('Process continued · Guardrails · Benefits', MX, 16, {
          width: CONTENT_W,
        });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#bae6fd')
        .text(
          'Phases 4–6 complete the loop from SP fulfilment to children fed and payment.',
          MX,
          32,
          { width: CONTENT_W }
        );
    });

    y = 60;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('FULL PROCESS — PART B', MX, y, { characterSpacing: 0.5 });
    y += 12;

    for (const phase of PROCESS_PHASES.slice(3)) {
      y = drawPhase(doc, phase, y, { compact: true });
    }

    y = drawGates(doc, y + 2);
    y = drawBenefits(doc, y);
    drawOutcome(doc, y);

    // Footers on all pages
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, i + 1, total);
    }

    doc.end();
  });
}

export function nsnpProcessGuideFilename(d = new Date()): string {
  const day = d.toISOString().slice(0, 10);
  return `NSNP-Process-Guide-DBE-Schools-SP-Children-Fed-${day}.pdf`;
}
