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

// ── PDF geometry (A4 landscape) ─────────────────────────────────────────
// Landscape uses the wide axis for process steps and role columns.

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 32;
const CONTENT_W = PAGE_W - MX * 2;
const FOOTER_Y = PAGE_H - 22;

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
    const y = FOOTER_Y - 6;
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
        'SupplierAdvisor® · NSNP · A4 landscape · System of record',
        MX,
        y + 4,
        { width: CONTENT_W * 0.72, align: 'left' }
      );
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(`Page ${pageNum} of ${total}`, MX, y + 4, {
        width: CONTENT_W,
        align: 'right',
      });
  });
}

function drawHero(doc: PdfDoc) {
  withOpenMargins(doc, () => {
    doc.rect(0, 0, PAGE_W, 68).fill(BRAND_DEEP);
    doc.rect(0, 64, PAGE_W, 4).fill(BRAND);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#bae6fd')
      .text('DBE / PEU COMMAND  ·  PROCESS GUIDE  ·  A4 LANDSCAPE', MX, 12, {
        width: CONTENT_W,
        characterSpacing: 1,
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#ffffff')
      .text('DBE → Schools → Service providers → Children fed', MX, 28, {
        width: CONTENT_W * 0.72,
      });
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#e0f2fe')
      .text(
        'End-to-end National School Nutrition Programme on SupplierAdvisor® — every role, every step, every guardrail, and why it works.',
        MX + CONTENT_W * 0.72,
        28,
        { width: CONTENT_W * 0.28 }
      );
  });
}

function drawChain(doc: PdfDoc, y: number): number {
  const gap = 10;
  const n = PROCESS_CHAIN.length;
  const boxW = (CONTENT_W - gap * (n - 1)) / n;
  const boxH = 36;
  PROCESS_CHAIN.forEach((node, i) => {
    const x = MX + i * (boxW + gap);
    const color = CHAIN_COLORS[i] || BRAND;
    doc.roundedRect(x, y, boxW, boxH, 6).fillAndStroke('#ffffff', color);
    doc.rect(x, y, 5, boxH).fill(color);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(INK)
      .text(node.label, x + 12, y + 8, { width: boxW - 20 });
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(node.sub, x + 12, y + 21, { width: boxW - 20 });
  });
  return y + boxH + 10;
}

/** Compact role cards — wider landscape columns, denser type */
function drawRoleCards(doc: PdfDoc, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('WHO DOES WHAT', MX, y, { characterSpacing: 0.8 });
  y += 11;

  const gap = 8;
  const colW = (CONTENT_W - gap * 2) / 3;
  const tones = [BRAND_DEEP, EMERALD, AMBER];
  const h = 118;

  ROLE_CARDS.forEach((card, i) => {
    const x = MX + i * (colW + gap);
    const tone = tones[i];
    let cy = y + 7;

    doc.roundedRect(x, y, colW, h, 7).fillAndStroke(SOFT, LINE);
    doc.rect(x, y, colW, 3).fill(tone);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
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
      cy += 9.5;
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
      cy += 9;
    });
  });

  return y + h + 10;
}

function drawPhase(doc: PdfDoc, phase: ProcessPhase, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(BRAND_DEEP)
    .text(phase.title, MX, y, { width: CONTENT_W * 0.45, continued: false });
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(MUTED)
    .text(phase.subtitle, MX + CONTENT_W * 0.45, y + 1, {
      width: CONTENT_W * 0.55,
      align: 'right',
    });
  y += 12;

  const gap = 6;
  const n = phase.steps.length;
  const boxW = (CONTENT_W - gap * (n - 1)) / n;
  const boxH = 48;

  phase.steps.forEach((step, i) => {
    const x = MX + i * (boxW + gap);
    const wc = whoColor(step.who);
    doc.roundedRect(x, y, boxW, boxH, 5).fillAndStroke('#ffffff', LINE);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(wc)
      .text(step.n, x + 6, y + 5, { width: 22 });
    doc.roundedRect(x + boxW - 40, y + 4, 34, 11, 3).fill(wc);
    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor('#ffffff')
      .text(step.who, x + boxW - 40, y + 6, { width: 34, align: 'center' });
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(INK)
      .text(step.title, x + 6, y + 18, { width: boxW - 12 });
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(MUTED)
      .text(step.desc, x + 6, y + 30, { width: boxW - 12, height: 16 });
  });

  return y + boxH + 8;
}

function drawGates(doc: PdfDoc, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('GUARDRAILS — CHILDREN GET WHAT WAS AUTHORISED', MX, y, {
      characterSpacing: 0.5,
    });
  y += 10;

  const gap = 6;
  const cols = 6; // one row across landscape width
  const boxW = (CONTENT_W - gap * (cols - 1)) / cols;
  const boxH = 52;
  COMPLIANCE_GATES.forEach((g, i) => {
    const x = MX + i * (boxW + gap);
    doc.roundedRect(x, y, boxW, boxH, 5).fillAndStroke('#ecfdf5', '#a7f3d0');
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(EMERALD)
      .text(g.title, x + 5, y + 6, { width: boxW - 10 });
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor(INK)
      .text(g.desc, x + 5, y + 20, { width: boxW - 10, height: 28 });
  });
  return y + boxH + 8;
}

function drawBenefits(doc: PdfDoc, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text('BENEFITS OF THE SYSTEM', MX, y, { characterSpacing: 0.5 });
  y += 10;

  const gap = 5;
  const cols = 5; // 2 rows of 5 on landscape
  const boxW = (CONTENT_W - gap * (cols - 1)) / cols;
  const boxH = 46;

  SYSTEM_BENEFITS.forEach((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MX + col * (boxW + gap);
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
      .text(b.desc, x + 6, by + 18, { width: boxW - 12, height: 26 });
  });

  const rows = Math.ceil(SYSTEM_BENEFITS.length / cols);
  return y + rows * (boxH + gap) + 6;
}

function drawOutcome(doc: PdfDoc, y: number): number {
  const h = 36;
  doc.roundedRect(MX, y, CONTENT_W, h, 6).fillAndStroke('#e0f2fe', '#7dd3fc');
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(BRAND_DEEP)
    .text('ONE SENTENCE — THE FULL LOOP', MX + 12, y + 6, {
      width: CONTENT_W - 24,
    });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(INK)
    .text(ONE_SENTENCE, MX + 12, y + 18, { width: CONTENT_W - 24 });
  return y + h;
}

/**
 * Beautiful 2-page A4 landscape process guide PDF.
 * Page 1: cover, chain, roles, phases 1–3
 * Page 2: phases 4–6, guardrails (1 row), benefits (2×5), outcome
 */
export async function buildNsnpProcessGuidePdf(opts?: {
  generatedAt?: Date;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      bufferPages: true,
      autoFirstPage: true,
      margins: { top: 0, bottom: 28, left: MX, right: MX },
      info: {
        Title:
          'NSNP Process Guide — DBE → Schools → Service providers → Children fed',
        Author: 'SupplierAdvisor®',
        Subject:
          'National School Nutrition Programme end-to-end process (A4 landscape)',
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
    let y = 78;
    y = drawChain(doc, y);
    y = drawRoleCards(doc, y);

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text('FULL PROCESS — PART A (JOIN → RULES → SCHOOL ORDER)', MX, y, {
        characterSpacing: 0.4,
      });
    y += 11;

    for (const phase of PROCESS_PHASES.slice(0, 3)) {
      y = drawPhase(doc, phase, y);
    }

    // ── PAGE 2 ────────────────────────────────────────────────────────
    doc.addPage({ size: 'A4', layout: 'landscape' });
    withOpenMargins(doc, () => {
      doc.rect(0, 0, PAGE_W, 40).fill(BRAND_DEEP);
      doc.rect(0, 36, PAGE_W, 4).fill(BRAND);
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#ffffff')
        .text(
          'Process continued · Guardrails · Benefits of the system',
          MX,
          12,
          { width: CONTENT_W }
        );
    });

    y = 50;
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(
        'FULL PROCESS — PART B (SP SUPPLY → CHILDREN FED → VERIFY & PAY)',
        MX,
        y,
        { characterSpacing: 0.4 }
      );
    y += 11;

    for (const phase of PROCESS_PHASES.slice(3)) {
      y = drawPhase(doc, phase, y);
    }

    y = drawGates(doc, y + 2);
    y = drawBenefits(doc, y);
    drawOutcome(doc, y);

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
  return `NSNP-Process-Guide-Landscape-${day}.pdf`;
}
