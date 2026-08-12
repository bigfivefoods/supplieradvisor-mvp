/**
 * PhysioAdvisor® end-to-end process guide content + PDF.
 * People → Packs · plans → Diary (rooms) → Waitlist · floor → Messages → Marketplace · reports
 * Pure pdfkit — works on Vercel serverless.
 *
 * Do not import from client components (pulls pdfkit into the browser bundle).
 * Client UI should use `@/lib/clinic/physiograph-process-guide-links` only.
 */
import PDFDocument from 'pdfkit';
import {
  drawProcessGuideHero,
  drawProcessGuidePageHeader,
  drawProcessPageWash,
} from '@/lib/pdf/process-guide-chrome';
import type { PhysiographProcessGuideOrientation } from '@/lib/clinic/physiograph-process-guide-links';
export type { PhysiographProcessGuideOrientation } from '@/lib/clinic/physiograph-process-guide-links';

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
  { label: 'People', sub: 'Practitioners · patients · POPIA' },
  { label: 'Services · packs', sub: 'Catalogue · packs · plans' },
  { label: 'Diary', sub: 'Rooms · practice · clinician' },
  { label: 'Floor', sub: 'Waitlist · attend · recall' },
  { label: 'Messages', sub: 'System ID · in-app' },
  { label: 'Website · reports', sub: 'Marketplace · rooms · ops' },
] as const;

export const ROLE_CARDS = [
  {
    title: 'Practice owner / manager',
    subtitle: 'Team · diary · waitlist · marketplace',
    does: [
      'Register clinicians; rates, bios; permanent staff dual-write to People',
      'Patient register with POPIA consent; invites & portals; family / dependents',
      'Services, care packs, treatment plans; one-click book next session',
      'Practice diary (parallel clinicians) + exclusive clinician books; rooms',
      'Waitlist desk, 24h reminders, outcomes & recalls, staff Today PWA',
      'In-app messages (system user ID first); marketplace listing; ops policies',
    ],
    doesNot: [
      'Does not double-book the same clinician diary',
      'Does not take member/patient fees through SupplierAdvisor (platform subscription only)',
    ],
  },
  {
    title: 'Practitioner',
    subtitle: 'Diary · clinical · attend · care plans',
    does: [
      'Keep bio / disciplines current for website',
      'Update clinical notes and medical chart (aid, docs, claims, scripts)',
      'Treatment plan steps; visit notes and outcome scores',
      'Run appointments; mark attended / no-show (progresses care plans)',
      'Reply on care threads; patients receive in-app when on-system',
      'Request post-visit feedback after attendance',
    ],
    doesNot: [
      'Does not change other clinicians’ rates or double-book own diary',
      'Does not publish the whole practice website alone',
    ],
  },
  {
    title: 'Patient / public',
    subtitle: 'Portal · book · family · feedback',
    does: [
      'Accept invite; book open slots (preferred or other clinician when allowed)',
      'Join slot waitlist or next-available practice queue',
      'Book household / family members; identity verify when asked',
      'In-app messages once on SupplierAdvisor (system user ID)',
      'After visit: feedback; see shared care notes when enabled',
    ],
    doesNot: [
      'Does not see private / unpublished slots or other patients’ charts',
      'Does not pay gym/clinic fees through the SA platform (practice bills separately)',
    ],
  },
] as const;

export const PROCESS_PHASES: ProcessPhase[] = [
  {
    title: '1 · People (clinicians & patients)',
    subtitle: 'Who treats · who is in care · POPIA · People dual-write',
    steps: [
      {
        n: '1a',
        title: 'Practitioners',
        who: 'Owner',
        desc: 'Physios, OT, biokinetics; disciplines, rates, bios. Permanent staff dual-write to People (HR).',
      },
      {
        n: '1b',
        title: 'Patients · POPIA · invite',
        who: 'Owner / desk',
        desc: 'Patient book with POPIA consent; email invite & portal; assign practitioner and package.',
      },
      {
        n: '1c',
        title: 'Clinical, chart & identity',
        who: 'Practitioner',
        desc: 'Body region, goals, cautions; medical aid, docs, claims; visit notes & scores. Optional VerifyNow/Didit identity on portal.',
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
        desc: 'Assessments, treatments, home visits — duration and price.',
      },
      {
        n: '2b',
        title: 'Rehab packages',
        who: 'Owner',
        desc: 'Multi-session packs with session ledger (fees outside SA).',
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
    title: '3 · Diary (rooms · practice · clinician)',
    subtitle: 'Parallel practice floor · exclusive clinician books',
    steps: [
      {
        n: '3a',
        title: 'Rooms & schedule',
        who: 'Owner / desk',
        desc: 'Define rooms/room / bays on Website; schedule date, time, service, room; assign clinician.',
      },
      {
        n: '3b',
        title: 'Practice vs clinician view',
        who: 'Owner / desk',
        desc: 'Practice diary shows all clinicians in parallel; each clinician cannot be double-booked.',
      },
      {
        n: '3c',
        title: 'Public flag',
        who: 'Owner',
        desc: 'Mark public so the slot can appear for online / portal booking.',
      },
    ],
  },
  {
    title: '4 · Floor (waitlist · attend · recall)',
    subtitle: 'Book · queue · reminders · outcomes · feedback',
    steps: [
      {
        n: '4a',
        title: 'Book · family · other clinician',
        who: 'Desk / portal',
        desc: 'Book patient (or family member); if preferred clinician full, book another or join waitlist.',
      },
      {
        n: '4b',
        title: 'Waitlist desk',
        who: 'Desk',
        desc: 'Slot waitlists + next-available practice queue; contact, promote, book when a slot frees.',
      },
      {
        n: '4c',
        title: 'Remind · attend · plan · feedback',
        who: 'Desk / clinician',
        desc: 'Send 24h reminders; mark attended / no-show (soft-block risk); care plan progresses; feedback token; recalls board.',
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
        desc: 'Trade partners (suppliers / customers) on the platform company inbox.',
      },
    ],
  },
  {
    title: '6 · Website, marketplace & insights',
    subtitle: 'Rooms · ops · public list · utilisation',
    steps: [
      {
        n: '6a',
        title: 'Profile · rooms · ops',
        who: 'Owner',
        desc: 'Brand bio, room list, reschedule policy; no SA patient payments — platform subscription only.',
      },
      {
        n: '6b',
        title: 'Publish & marketplace',
        who: 'Owner',
        desc: 'Enable website/booking; list on /marketplace/advisors (city + blurb).',
      },
      {
        n: '6c',
        title: 'Reports · staff Today',
        who: 'Owner / desk',
        desc: 'Utilisation and outcomes; staff PWA today board for the floor.',
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
    title: 'Public = published',
    desc: 'Only public slots and an enabled website profile are ready for online booking.',
  },
  {
    title: 'POPIA on create',
    desc: 'Desk confirms lawful processing / consent when creating a patient record; portals show a privacy notice.',
  },
  {
    title: 'Care packs & plans on the patient',
    desc: 'Session packs and treatment steps live on the patient — book next from the plan, not a side sheet.',
  },
  {
    title: 'Waitlist is a desk queue',
    desc: 'Slot waitlist plus next-available practice queue with notify when a place opens.',
  },
  {
    title: 'Attend then feedback · plan progress',
    desc: 'Mark attended before feedback tokens; active treatment plans advance on attendance.',
  },
  {
    title: 'Messages: system ID first',
    desc: 'Once the patient is on SupplierAdvisor, care threads deliver in-app by platform user ID.',
  },
  {
    title: 'SA does not bill patients',
    desc: 'SupplierAdvisor only bills the company platform subscription; clinic fees stay off-platform.',
  },
  {
    title: 'Permanent staff → People',
    desc: 'Permanent clinicians dual-write into the People module; casuals stay on the Advisor book only.',
  },
  {
    title: 'Tokenised public surfaces',
    desc: 'Website and portals use secret tokens — no private charts on open calendars.',
  },
];

export const SYSTEM_BENEFITS = [
  {
    title: 'Allied health OS',
    desc: 'Physio, OT, biokinetics and more in one diary and patient book.',
  },
  {
    title: 'Exclusive clinician diaries',
    desc: 'No double-book per clinician while the floor runs multiple books at once.',
  },
  {
    title: 'Waitlist desk + recalls',
    desc: 'Fill cancellations, work the next-available queue, re-engage overdue patients.',
  },
  {
    title: 'Treatment plans that book',
    desc: 'Step plans with one-click next session on an open diary slot.',
  },
  {
    title: 'Rooms as resources',
    desc: 'Named surgeries / bays / rooms on the calendar, managed under Website.',
  },
  {
    title: 'In-app care messaging',
    desc: 'Desk, clinicians and patients on one thread — system user ID when on-platform.',
  },
  {
    title: 'Marketplace discoverability',
    desc: 'Opt-in listing on /marketplace/advisors with city and blurb.',
  },
  {
    title: 'POPIA-aware desk',
    desc: 'Consent on create and privacy notice on patient portals.',
  },
];

export const ONE_SENTENCE =
  'Register practitioners and patients (POPIA · clinical · medical chart) → services, rehab packs and treatment plans → diary with rooms and exclusive clinician books → book, waitlist desk, reminders, attend, recalls → in-app messages by system user ID → website, marketplace listing and utilisation.';


// ── PDF (teal brand) ────────────────────────────────────────────────────

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

type Geo = {
  orientation: PhysiographProcessGuideOrientation;
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

function geoFor(orientation: PhysiographProcessGuideOrientation): Geo {
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

const BRAND = '#0d9488';
const BRAND_DEEP = '#115e59';
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
        `SupplierAdvisor® · PhysioAdvisor® · ${orientLabel} · Clinic services OS`,
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
    eyebrow: 'PhysioAdvisor® · end-to-end process · ' + orientLabel,
    title: 'Practitioners → Patients → Services → Diary → Bookings → Website',
    subtitle: g.isLandscape ? undefined : 'Tertiary / services clinic OS — people, diary, packages, website & reports.',
    sideNote: g.isLandscape ? 'End-to-end physio clinic OS on SupplierAdvisor® — diary, rehab packs, website booking.' : undefined,
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
  const h = g.isLandscape ? 148 : 168;

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
    doc.roundedRect(x, by, boxW, boxH, 4).fillAndStroke('#f0fdfa', '#5eead4');
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
  doc.roundedRect(g.mx, y, g.contentW, h, 6).fillAndStroke('#f0fdfa', '#5eead4');
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

export async function buildPhysiographProcessGuidePdf(opts?: {
  generatedAt?: Date;
  orientation?: PhysiographProcessGuideOrientation;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();
  const orientation: PhysiographProcessGuideOrientation =
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
          'PhysioAdvisor® Process Design — Practitioners → Diary → Website',
        Author: 'SupplierAdvisor®',
        Subject: `PhysioAdvisor clinic services end-to-end process (A4 ${orientation})`,
        Keywords:
          'PhysioAdvisor, clinic, physio, practitioners, diary, packages, process guide',
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
      eyebrow: 'PhysioAdvisor® · end-to-end process · continued',
      title: 'Process continued · Floor · Messages · Website · Guardrails',
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

export function parsePhysiographProcessGuideOrientation(
  raw: string | null | undefined
): PhysiographProcessGuideOrientation {
  const v = String(raw || '').toLowerCase();
  if (v === 'portrait' || v === 'p') return 'portrait';
  return 'landscape';
}

export function physiographProcessGuideFilename(
  orientation: PhysiographProcessGuideOrientation
): string {
  return `PhysioAdvisor-Process-Design-A4-${orientation}.pdf`;
}
