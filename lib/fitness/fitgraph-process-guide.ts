/**
 * GymAdvisor® end-to-end process guide content + PDF.
 * People → Plans → Classes → Calendar (rooms) → Floor → Messages → Marketplace · reports
 * Pure pdfkit — works on Vercel serverless.
 *
 * Do not import from client components (pulls pdfkit into the browser bundle).
 * Client UI should use `@/lib/fitness/fitgraph-process-guide-links` only.
 */
import PDFDocument from 'pdfkit';
import {
  drawProcessGuideHero,
  drawProcessGuidePageHeader,
  drawProcessPageWash,
} from '@/lib/pdf/process-guide-chrome';
import type { FitgraphProcessGuideOrientation } from '@/lib/fitness/fitgraph-process-guide-links';
export type { FitgraphProcessGuideOrientation } from '@/lib/fitness/fitgraph-process-guide-links';

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
  { label: 'People', sub: 'Workforce · CRM 360' },
  { label: 'Plans · subs', sub: 'Classes · debit bank' },
  { label: 'Class types', sub: 'Capacity · duration' },
  { label: 'Calendar', sub: 'Leave blocks · rooms' },
  { label: 'Floor', sub: 'Waitlist · actual · recall' },
  { label: 'Messages', sub: 'System ID · in-app' },
  { label: 'Website · One OS', sub: 'Finance · SKUs · 360' },
] as const;

export const ROLE_CARDS = [
  {
    title: 'Gym owner / manager',
    subtitle: 'Brand · people · floor · marketplace',
    does: [
      'Register coaches; employed + contractors dual-write to People; leave blocks their diary',
      'Members land on Customers 360 (classes, debit bank, invoices, household)',
      'Class subscriptions set the fee; debit-order bank completes membership',
      'Schedule with rooms; People leave cannot be assigned; company calendar overlay',
      'Waitlist, reminders, outcomes; attendance writes CRM activity + Intelligence',
      'Card / Apple Pay (1% admin to your bank) or debit-order file from Finance',
      'Website embed, marketplace, shared SKUs with Inventory',
    ],
    doesNot: [
      'Does not surcharge members — 1% admin is taken from card / Apple Pay settlement',
      'Does not keep a second ledger — CRM invoices and Finance journals are the same fee',
    ],
  },
  {
    title: 'Coach',
    subtitle: 'Classes · roster · plan · care threads',
    does: [
      'Open coach portal; update profile / bio',
      'Create one-off or weekly series; class plan members can see',
      'Build a movement library (image / video) and allocate programmes to class or own PT',
      'Share / unshare classes; book walk-ins; rooms when set',
      'Mark plan vs actual (attended / no-show); no-show soft-block',
      'Message desk and members (in-app when member is on-system)',
      'Post-class coach feedback (feel · RPE)',
    ],
    doesNot: [
      'Does not manage other coaches’ sessions (unless owner)',
      'Does not change membership billing or coach rates',
    ],
  },
  {
    title: 'Member / customer',
    subtitle: 'Portal · book · family · feedback',
    does: [
      'Subscribe to the classes they train; fee follows those classes',
      'Submit debit-order bank details on the profile when the gym collects them',
      'Pay card / Apple Pay where offered, or wait for the owner debit file',
      'Accept invite; book covered classes or join waitlist on SA Member / embed',
      'Book household family members; identity verify when asked',
      'In-app messages once on SupplierAdvisor (system user ID)',
    ],
    doesNot: [
      'Does not see private / unpublished sessions',
      'Does not book a class they have not subscribed to when the gym uses class plans',
    ],
  },
] as const;

export const PROCESS_PHASES: ProcessPhase[] = [
  {
    title: '1 · People (coaches & members)',
    subtitle: 'Workforce book · Customers 360 · identity · POPIA',
    steps: [
      {
        n: '1a',
        title: 'Specialty catalogue',
        who: 'Owner',
        desc: 'Create, rename, remove coach specialties gym-wide.',
      },
      {
        n: '1b',
        title: 'Coach register · People',
        who: 'Owner',
        desc: 'Employed on payroll; contractors as a workforce type. Source badge + diary. People leave blocks assign.',
      },
      {
        n: '1c',
        title: 'Engagement · rates · contracts',
        who: 'Owner',
        desc: 'Start/end dates, ZAR rate (session pay), PDF agreements; history on rehire.',
      },
      {
        n: '1d',
        title: 'Members · 360 · family',
        who: 'Owner / desk',
        desc: 'Member book dual-writes CRM; open Customers 360 for classes, debit bank, invoices, household.',
      },
    ],
  },
  {
    title: '2 · Memberships & subscriptions',
    subtitle: 'Class plans · debit bank · VAT invoices',
    steps: [
      {
        n: '2a',
        title: 'Class memberships',
        who: 'Owner',
        desc: 'Edit each class in the list (rate, coach, when). Open a row to change times and repeats. Allocate members at a charged rate.',
      },
      {
        n: '2b',
        title: 'Debit-order bank',
        who: 'Member / desk',
        desc: 'Bank details on the member profile complete membership when the owner runs debit orders.',
      },
      {
        n: '2c',
        title: 'Invoices · VAT · debit file',
        who: 'Owner',
        desc: 'Fees post AR + revenue + VAT (incl.) on Finance. Export the debit-order CSV and match on bank rec.',
      },
    ],
  },
  {
    title: '3 · Class types',
    subtitle: 'What you sell on the floor',
    steps: [
      {
        n: '3a',
        title: 'Define classes',
        who: 'Owner',
        desc: 'HIIT, strength, yoga — default duration and capacity.',
      },
      {
        n: '3b',
        title: 'Categories',
        who: 'Owner',
        desc: 'Group types for calendar filters and reports.',
      },
    ],
  },
  {
    title: '4 · Calendar (rooms · plan · join)',
    subtitle: 'Owner grid + coach week + resources',
    steps: [
      {
        n: '4a',
        title: 'Rooms & schedule',
        who: 'Owner',
        desc: 'Schedule from Classes (date, time, repeats) or the diary grid. Subscribed members book onto those dates. People leave blocks that coach.',
      },
      {
        n: '4b',
        title: 'Coach calendar · concurrent',
        who: 'Owner / coach',
        desc: 'Week plan, series, class plan text; optional concurrent coaches on large floors.',
      },
      {
        n: '4c',
        title: 'Publish & join links',
        who: 'Owner / coach',
        desc: 'Mark public; B2C join URL so members book and save to calendar (.ics).',
      },
    ],
  },
  {
    title: '5 · Floor (waitlist · actual · recall)',
    subtitle: 'Capacity, attendance, outcomes, feedback',
    steps: [
      {
        n: '5a',
        title: 'Book · waitlist · family',
        who: 'Desk / coach / portal',
        desc: 'Book session; auto-waitlist when full; household attendees; treatment-plan book next.',
      },
      {
        n: '5b',
        title: 'Remind · plan vs actual',
        who: 'Coach / desk',
        desc: '24h reminders; mark attended / no-show; soft-block high no-show risk.',
      },
      {
        n: '5c',
        title: 'Feedback · outcomes · recalls',
        who: 'Member · coach · owner',
        desc: 'Class feedback; outcomes; recalls. Attendance and recalls write CRM activity and an Intelligence pulse.',
      },
      {
        n: '5d',
        title: 'Check-ins · staff Today',
        who: 'Desk',
        desc: 'Front-desk log; mobile staff PWA for today’s board.',
      },
    ],
  },
  {
    title: '6 · Messages (system ID · care · trade)',
    subtitle: 'In-app first when member is on SupplierAdvisor',
    steps: [
      {
        n: '6a',
        title: 'Desk · coach threads',
        who: 'Desk / coach',
        desc: 'Internal colleague chat for schedule hand-offs and floor notes.',
      },
      {
        n: '6b',
        title: 'Member care & class groups',
        who: 'Desk / coach · members',
        desc: '1:1 care or whole-class group; deliver by platform system user ID when linked; email optional.',
      },
      {
        n: '6c',
        title: 'Company inbox (trade)',
        who: 'Owner',
        desc: 'External partners (suppliers / customers) on the platform company inbox.',
      },
    ],
  },
  {
    title: '7 · Website, marketplace & insights',
    subtitle: 'Embed · ops · public list · slice & dice',
    steps: [
      {
        n: '7a',
        title: 'Gym profile · rooms · contracts',
        who: 'Owner',
        desc: 'Brand bio, public PDF contracts, room list, reschedule policy.',
      },
      {
        n: '7b',
        title: 'Embed · marketplace',
        who: 'Owner',
        desc: 'Publish calendar/booking; list on /marketplace/advisors (city + blurb).',
      },
      {
        n: '7c',
        title: 'Reports · One OS',
        who: 'Owner',
        desc: 'Fill and utilisation; Customers 360; debit file; shared SKUs with Inventory.',
      },
    ],
  },
];

export const GUARDRAILS = [
  {
    title: 'Coach on every public class',
    desc: 'Scheduled sessions assign a coach; portal only shows their roster.',
  },
  {
    title: 'Public = published',
    desc: 'Only sessions marked public appear on website embed and calendar API.',
  },
  {
    title: 'Capacity & waitlist',
    desc: 'Bookings auto-waitlist when full — desk, coach, portal or website.',
  },
  {
    title: 'Concurrent coaches optional',
    desc: 'Large floors may allow coaches at the same time; toggle under Website ops.',
  },
  {
    title: 'Plan then actual',
    desc: 'Roster plan then mark actual attended / no-show; soft-block chronic no-shows.',
  },
  {
    title: 'Messages: system ID first',
    desc: 'Once the member is on SupplierAdvisor, care threads deliver in-app by platform user ID.',
  },
  {
    title: 'One money book',
    desc: 'Gym fees post CRM + Finance (AR, revenue, VAT incl.). Card / Apple Pay 1% admin; debit orders export a file.',
  },
  {
    title: 'Workforce book',
    desc: 'Employed coaches on payroll; contractors as a People workforce type. Leave on People blocks the diary.',
  },
  {
    title: 'Tokenised portals',
    desc: 'Website and coach portals use secret tokens — no private PII on public calendar.',
  },
  {
    title: 'One gym book',
    desc: 'Coaches, classes, bookings, messages, feedback and website share the same GymAdvisor store.',
  },
];

export const SYSTEM_BENEFITS = [
  {
    title: 'Owner schedules coaches',
    desc: 'Calendar is the system of record for who teaches what and when — with rooms.',
  },
  {
    title: 'Coach self-service',
    desc: 'Portal: profile, class plan, series, walk-ins, actuals, feedback — no desk login.',
  },
  {
    title: 'Waitlist · reminders · recalls',
    desc: 'Fill classes, nudge 24h out, re-engage members who went quiet.',
  },
  {
    title: 'In-app messaging',
    desc: 'Desk/coach/member threads with system-user delivery when on-platform.',
  },
  {
    title: 'Marketplace discoverability',
    desc: 'Opt-in listing on /marketplace/advisors with city and blurb.',
  },
  {
    title: 'Class subscriptions & debit bank',
    desc: 'Members pick classes; fees follow the plan; debit-order bank completes membership.',
  },
  {
    title: 'One OS with Core',
    desc: 'Customers 360, People leave, Finance VAT / debit file, company calendar, shared SKUs.',
  },
  {
    title: 'Staff Today PWA',
    desc: 'Mobile today board for desk and floor without full dashboard.',
  },
  {
    title: 'Slice-and-dice reports',
    desc: 'Fill %, show-up %, feedback and utilisation without leaving the OS.',
  },
];

export const ONE_SENTENCE =
  'Register coaches (People workforce · leave blocks diary) and members (Customers 360 · debit bank) → class subscriptions set the fee → calendar and company week view → book, waitlist, attend (CRM + Intelligence) → messages by system user ID → website, marketplace, VAT journals and debit-order file — one OS with People, Customers, Finance and Inventory.';


// ── PDF (VUKA yellow brand) ─────────────────────────────────────────────

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

type Geo = {
  orientation: FitgraphProcessGuideOrientation;
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

function geoFor(orientation: FitgraphProcessGuideOrientation): Geo {
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

const BRAND = '#E8E830';
const BRAND_DEEP = '#6B6B00';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const SKY = '#0284c7';
const EMERALD = '#059669';
const AMBER = '#d97706';
const ROSE = '#e11d48';
const CHAIN_COLORS = [BRAND_DEEP, SKY, AMBER, BRAND, EMERALD, ROSE, '#c026d3'] as const;

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
        `SupplierAdvisor® · GymAdvisor® · ${orientLabel} · Gym services OS`,
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
    eyebrow: 'GymAdvisor® · end-to-end process · ' + orientLabel,
    title: 'Coaches → Class plans → Floor → One OS',
    subtitle: g.isLandscape ? undefined : 'Gym OS on SupplierAdvisor® — workforce, Customers 360, class subscriptions, debit bank, VAT books, company calendar.',
    sideNote: g.isLandscape ? 'One OS: People workforce + leave, Customers 360, Finance VAT / debit file, company calendar, shared SKUs.' : undefined,
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
  // Taller cards — owners/coaches now have 6 “does” lines
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
  // Taller when 4 steps share a row (narrower boxes need more height for desc)
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
      .fillColor(BRAND_DEEP)
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
    doc.roundedRect(x, by, boxW, boxH, 4).fillAndStroke('#f5f3ff', '#c4b5fd');
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
  doc.roundedRect(g.mx, y, g.contentW, h, 6).fillAndStroke('#f5f3ff', '#a78bfa');
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

export async function buildFitgraphProcessGuidePdf(opts?: {
  generatedAt?: Date;
  orientation?: FitgraphProcessGuideOrientation;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();
  const orientation: FitgraphProcessGuideOrientation =
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
          'GymAdvisor® Process Design — Coaches → Class plans → Floor → One OS',
        Author: 'SupplierAdvisor®',
        Subject: `GymAdvisor gym services end-to-end process (A4 ${orientation})`,
        Keywords: 'GymAdvisor, gym, coaches, calendar, subscriptions, process guide',
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
      .text('FULL PROCESS — PART A (PEOPLE → PLANS → CLASSES → CALENDAR)', g.mx, y, {
        characterSpacing: 0.3,
      });
    y += 11;

    for (const phase of PROCESS_PHASES.slice(0, 3)) {
      y = drawPhase(doc, g, phase, y);
    }

    doc.addPage({ size: 'A4', layout });
    y = drawProcessGuidePageHeader(doc, g, {
      eyebrow: 'GymAdvisor® · end-to-end process · continued',
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

export function parseFitgraphProcessGuideOrientation(
  raw: string | null | undefined
): FitgraphProcessGuideOrientation {
  const v = String(raw || '').toLowerCase();
  if (v === 'portrait' || v === 'p') return 'portrait';
  return 'landscape';
}

export function fitgraphProcessGuideFilename(
  orientation: FitgraphProcessGuideOrientation
): string {
  return `GymAdvisor-Process-Design-A4-${orientation}.pdf`;
}
