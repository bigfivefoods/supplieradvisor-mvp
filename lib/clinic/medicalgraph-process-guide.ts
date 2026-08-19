/**
 * MedicalAdvisor® end-to-end process guide content + PDF.
 * People (injury · history · referral) → Packs · plans → Diary (rooms+assets · open visit)
 * → Floor (branded emails · board · recall) → Messages → Website · command
 * Pure pdfkit — works on Vercel serverless.
 *
 * Do not import from client components (pulls pdfkit into the browser bundle).
 * Client UI should use `@/lib/clinic/medicalgraph-process-guide-links` only.
 */
import PDFDocument from 'pdfkit';
import {
  drawProcessGuideHero,
  drawProcessGuidePageHeader,
  drawProcessPageWash,
} from '@/lib/pdf/process-guide-chrome';
import type { MedicalgraphProcessGuideOrientation } from '@/lib/clinic/medicalgraph-process-guide-links';
export type { MedicalgraphProcessGuideOrientation } from '@/lib/clinic/medicalgraph-process-guide-links';

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
  { label: 'People', sub: 'Injury · history · share' },
  { label: 'Services · packs', sub: 'VAT invoices · plans' },
  { label: 'Diary', sub: 'Rooms+assets · open visit' },
  { label: 'Floor', sub: 'Emails · board · recall' },
  { label: 'Messages', sub: 'System ID · in-app' },
  { label: 'Website · command', sub: 'Card pay · hub order' },
] as const;

export const ROLE_CARDS = [
  {
    title: 'Practice owner / manager',
    subtitle: 'Team · rooms · referral · command hub',
    does: [
      'Register clinicians; People dual-write; leave blocks the diary',
      'Patients with injury sub-card, POPIA, visit history, invites',
      'Consented GP referral of selected record + practice info',
      'Rooms desk with assets; click a booked slot to open that visit',
      'Branded pre/post emails (logo); outcomes, today board, recalls',
      'Card / Apple Pay to your bank; marketplace; in-app messages',
    ],
    doesNot: [
      'Does not double-book the same clinician diary',
      'Does not surcharge patients — 1% admin is taken from card / Apple Pay settlement',
    ],
  },
  {
    title: 'Practitioner',
    subtitle: 'Open visit · history · attend · rate',
    does: [
      'Clinical notes, injury awareness and medical chart',
      'Visit history shared with the patient on the SA Member PWA',
      'Open the booked visit from the diary — do not create another',
      'Mark attended / no-show; branded post-session rating goes out',
      'Care threads; patients receive in-app when on-system',
    ],
    doesNot: [
      'Does not change other clinicians’ rates or double-book own diary',
      'Does not publish the whole practice website alone',
    ],
  },
  {
    title: 'Patient / public',
    subtitle: 'SA Member · history · rate · consent',
    does: [
      'Keep SA Member profile and ailments current (pre-session reminder)',
      'Book open slots; join waitlist; book household members',
      'See own visit history on the PWA — same record as the practice',
      'Rate the session and the practice after the visit',
      'Consent to share selected info when referred to another practice',
    ],
    doesNot: [
      'Does not see private / unpublished slots or other patients’ charts',
      'Does not pay company SaaS — visit fees settle to the practice (1% on card / Apple Pay)',
    ],
  },
] as const;

export const PROCESS_PHASES: ProcessPhase[] = [
  {
    title: '1 · People (clinicians & patients)',
    subtitle: 'Injury sub-card · visit history · consented referral · invite',
    steps: [
      {
        n: '1a',
        title: 'Practitioners',
        who: 'Owner',
        desc: 'GPs, specialists, nursing; rates, bios. Employed + contractors dual-write to People. Leave blocks assign.',
      },
      {
        n: '1b',
        title: 'Patients · injury · POPIA',
        who: 'Owner / desk',
        desc: 'Injury & recovery is a sub-card on Add patient. Desk order: stats → Add → Existing → Shared → Invite.',
      },
      {
        n: '1c',
        title: 'Chart · visit history',
        who: 'Practitioner',
        desc: 'Clinical chart, medical aid, notes. Visit history on desk and SA Member PWA — both see the same visits.',
      },
      {
        n: '1d',
        title: 'Invite · consented referral',
        who: 'Owner / desk',
        desc: 'Portal invite. With consent, share selected patient + practice info to another practice (GP → physio / psychiatry).',
      },
    ],
  },
  {
    title: '2 · Services & packages',
    subtitle: 'What you sell · packs · step plans',
    steps: [
      {
        n: '2a',
        title: 'Services',
        who: 'Owner',
        desc: 'Consults and procedures — duration and price.',
      },
      {
        n: '2b',
        title: 'Care packages',
        who: 'Owner',
        desc: 'Multi-visit packs with session ledger. Charges post AR + revenue + VAT on Finance.',
      },
      {
        n: '2c',
        title: 'Treatment plans',
        who: 'Owner / desk / clinician',
        desc: 'Step plans on the patient; one-click book next open diary slot.',
      },
    ],
  },
  {
    title: '3 · Diary (rooms · assets · open visit)',
    subtitle: 'Rooms desk + equipment · click booked slot to open it',
    steps: [
      {
        n: '3a',
        title: 'Rooms & assets',
        who: 'Owner / desk',
        desc: 'Rooms desk: consult rooms and surgeries; assign assets (equipment) to each room — not only a website list.',
      },
      {
        n: '3b',
        title: 'Open existing visit',
        who: 'Owner / desk',
        desc: 'Click a booked slot to open that visit. Empty slots book new — never a second appointment on the profile.',
      },
      {
        n: '3c',
        title: 'Practice diary · hours',
        who: 'Owner / desk',
        desc: 'Parallel books; no double-book. Waitlist default-open under the diary; working hours collapsible. Public flag for online booking.',
      },
    ],
  },
  {
    title: '4 · Floor (emails · board · recall)',
    subtitle: 'Book · branded pre/post mail · outcomes · today board',
    steps: [
      {
        n: '4a',
        title: 'Book · family · waitlist',
        who: 'Desk / portal',
        desc: 'Book patient or family; if preferred clinician full, book another or join the waitlist (default-open on the diary).',
      },
      {
        n: '4b',
        title: 'Branded pre / post emails',
        who: 'Owner / system',
        desc: '24h MedicalAdvisor® email with practice logo: update SA Member + ailments. After: rate session + practice.',
      },
      {
        n: '4c',
        title: 'Outcomes · board · recalls',
        who: 'Desk / clinician',
        desc: 'Command: outcomes (30 days) → today’s treatment board → rehab recalls. Mark attended / no-show; Send 24h reminders.',
      },
    ],
  },
  {
    title: '5 · Messages (system ID · care · trade)',
    subtitle: 'In-app first when patient is on SupplierAdvisor',
    steps: [
      {
        n: '5a',
        title: 'Internal team threads',
        who: 'Desk / team',
        desc: 'Colleague chat for hand-offs, schedule notes and practice ops.',
      },
      {
        n: '5b',
        title: 'Care · patient threads',
        who: 'Desk / clinician',
        desc: 'Care messages deliver to company inbox by platform system user ID when linked; email fan-out optional.',
      },
      {
        n: '5c',
        title: 'Company inbox (external)',
        who: 'Owner',
        desc: 'Trade partners on the platform company inbox. Inbound consented referrals land on Shared patients.',
      },
    ],
  },
  {
    title: '6 · Website, pay-out & command',
    subtitle: 'Card / Apple Pay · marketplace · hub order',
    steps: [
      {
        n: '6a',
        title: 'Card / Apple Pay · profile',
        who: 'Owner',
        desc: 'Connect a payout bank on Accounts. Company SaaS stays on SupplierAdvisor; member card / Apple Pay settles to your bank.',
      },
      {
        n: '6b',
        title: 'Publish & marketplace',
        who: 'Owner',
        desc: 'Brand bio, booking settings, embed. Enable website; list on /marketplace/advisors (city + blurb).',
      },
      {
        n: '6c',
        title: 'Command hub · reports',
        who: 'Owner / desk',
        desc: 'Hub order: Card/Apple Pay → stats → outcomes → today board → recalls → this E2E. Reports + staff Today PWA.',
      },
    ],
  },
];

export const GUARDRAILS = [
  {
    title: 'No double-book per clinician',
    desc: 'Each clinician diary is exclusive; the practice can still run many clinicians in parallel.',
  },
  {
    title: 'Click booked slot → open that visit',
    desc: 'A scheduled appointment opens the existing visit. Empty slots book new — never a second record.',
  },
  {
    title: 'Rooms desk + assets',
    desc: 'Consult rooms and surgeries live on Rooms; assign equipment assets to each room.',
  },
  {
    title: 'Branded pre / post emails',
    desc: 'Practice-logo MedicalAdvisor® mail 24h before (update SA Member + ailments) and after (rate session + practice).',
  },
  {
    title: 'Visit history both sides',
    desc: 'Desk and SA Member PWA show the same past visits. Practitioner and patient see one history.',
  },
  {
    title: 'Consented referral only',
    desc: 'A GP may share selected patient + practice info with another practice only after the patient consents.',
  },
  {
    title: 'POPIA on create',
    desc: 'Desk confirms lawful processing / consent when creating a patient; portals show a privacy notice.',
  },
  {
    title: 'One money book',
    desc: 'Visit and pack fees post CRM + Finance. Card / Apple Pay settles to your bank (1% admin). SaaS stays on SA.',
  },
  {
    title: 'Tokenised public surfaces',
    desc: 'Website and portals use secret tokens — no private charts on open calendars.',
  },
];

export const SYSTEM_BENEFITS = [
  {
    title: 'Medical practice OS',
    desc: 'GPs, specialists and nursing on one diary and patient book.',
  },
  {
    title: 'Open the existing visit',
    desc: 'Click a booked slot to open that appointment — never a second record on the profile.',
  },
  {
    title: 'Rooms desk + assets',
    desc: 'Named consult rooms and surgeries with equipment assigned on the Rooms desk.',
  },
  {
    title: 'Branded session emails',
    desc: 'Practice-logo pre-session (SA Member + ailments) and post-session (rate session + practice).',
  },
  {
    title: 'Visit history both sides',
    desc: 'Desk and SA Member PWA share the same past visits and notes.',
  },
  {
    title: 'Consented GP referral',
    desc: 'Share selected patient + practice info with another practice only after consent.',
  },
  {
    title: 'Command hub floor',
    desc: 'Card/Apple Pay → stats → outcomes → today board → recalls → this E2E.',
  },
  {
    title: 'Marketplace discoverability',
    desc: 'Opt-in listing on /marketplace/advisors with city and blurb.',
  },
];

export const ONE_SENTENCE =
  'Register practitioners and patients (injury, visit history, consented referral) → packs and plans → rooms with assets; open the existing visit → branded pre/post emails (SA Member + rate session/practice) → today board and recalls → Card / Apple Pay to your bank — one MedicalAdvisor OS.';


// ── PDF (teal brand) ────────────────────────────────────────────────────

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

type Geo = {
  orientation: MedicalgraphProcessGuideOrientation;
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

function geoFor(orientation: MedicalgraphProcessGuideOrientation): Geo {
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
const BRAND_DEEP = '#064e3b';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const SKY = '#0284c7';
const EMERALD = '#059669';
const AMBER = '#d97706';
const ROSE = '#e11d48';
const CHAIN_COLORS = [BRAND_DEEP, SKY, AMBER, BRAND, EMERALD, ROSE] as const;

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
        `SupplierAdvisor® · MedicalAdvisor® · ${orientLabel} · Clinic services OS`,
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
    eyebrow: 'MedicalAdvisor® · end-to-end process · ' + orientLabel,
    title: 'People → Diary (open visit) → Emails · board → One OS',
    subtitle: g.isLandscape ? undefined : 'Medical practice OS — injury, visit history, rooms+assets, branded emails, consented referral.',
    sideNote: g.isLandscape ? 'MedicalAdvisor® OS — rooms+assets, open visit, branded emails, consented referral, Card / Apple Pay.' : undefined,
    landscape: g.isLandscape,
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
      .fontSize(g.isLandscape ? 7 : 6.5)
      .fillColor(INK)
      .text(node.label, x + 6, y + 7, { width: boxW - 10 });
    doc
      .font('Helvetica')
      .fontSize(g.isLandscape ? 6 : 5.5)
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
  const tones = [BRAND_DEEP, AMBER, SKY];
  const h = g.isLandscape ? 156 : 176;

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
  const boxW = (g.contentW - gap * (steps.length - 1)) / Math.max(1, steps.length);
  const boxH =
    steps.length >= 4
      ? g.isLandscape
        ? 58
        : 64
      : g.isLandscape
        ? 48
        : 54;

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
    doc.roundedRect(x, by, boxW, boxH, 4).fillAndStroke('#ecfdf5', '#6ee7b7');
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
  const h = g.isLandscape ? 44 : 56;
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
    .fontSize(6.8)
    .fillColor(INK)
    .text(ONE_SENTENCE, g.mx + 10, y + 16, { width: g.contentW - 20 });
  return y + h;
}

export async function buildMedicalgraphProcessGuidePdf(opts?: {
  generatedAt?: Date;
  orientation?: MedicalgraphProcessGuideOrientation;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();
  const orientation: MedicalgraphProcessGuideOrientation =
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
          'MedicalAdvisor® Process Design — People → Open visit → Emails · board',
        Author: 'SupplierAdvisor®',
        Subject: `MedicalAdvisor clinic services end-to-end process (A4 ${orientation})`,
        Keywords:
          'MedicalAdvisor, clinic, physio, practitioners, diary, packages, process guide',
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
    y = drawRoleCards(doc, g, y);

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text('FULL PROCESS — PART A (PEOPLE → SERVICES → DIARY)', g.mx, y, {
        characterSpacing: 0.3,
      });
    y += 11;

    for (const phase of PROCESS_PHASES.slice(0, 3)) {
      y = drawPhase(doc, g, phase, y);
    }

    doc.addPage({ size: 'A4', layout });
    y = drawProcessGuidePageHeader(doc, g, {
      eyebrow: 'MedicalAdvisor® · end-to-end process · continued',
      title: 'Process continued · Floor · Messages · One OS · Guardrails',
      landscape: g.isLandscape,
    });
    drawProcessPageWash(doc, g, Math.max(0, y - 8));

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

export function parseMedicalgraphProcessGuideOrientation(
  raw: string | null | undefined
): MedicalgraphProcessGuideOrientation {
  const v = String(raw || '').toLowerCase();
  if (v === 'portrait' || v === 'p') return 'portrait';
  return 'landscape';
}

export function medicalgraphProcessGuideFilename(
  orientation: MedicalgraphProcessGuideOrientation
): string {
  return `MedicalAdvisor-Process-Design-A4-${orientation}.pdf`;
}
