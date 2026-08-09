/**
 * Fitgraph® end-to-end process guide content + PDF.
 * Coaches → Members → Plans → Calendar → Bookings → Website
 * Pure pdfkit — works on Vercel serverless.
 *
 * Do not import from client components (pulls pdfkit into the browser bundle).
 * Client UI should use `@/lib/fitness/fitgraph-process-guide-links` only.
 */
import PDFDocument from 'pdfkit';
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
  { label: 'People', sub: 'Coaches · members' },
  { label: 'Plans · subs', sub: 'Memberships' },
  { label: 'Class types', sub: 'Capacity · duration' },
  { label: 'Calendar', sub: 'Schedule coaches' },
  { label: 'Floor', sub: 'Book · check-in' },
  { label: 'Website', sub: 'Embed · portal' },
] as const;

export const ROLE_CARDS = [
  {
    title: 'Gym owner / manager',
    subtitle: 'Brand · schedule · money',
    does: [
      'Register coaches and issue portal links',
      'Define membership plans & subscriptions',
      'Schedule classes and assign coaches',
      'Publish public calendar & embed on website',
      'Review attendance and utilisation reports',
    ],
    doesNot: [
      'Does not leave coaches unassigned on public classes',
      'Does not publish without website settings enabled',
    ],
  },
  {
    title: 'Coach',
    subtitle: 'Classes · roster · share',
    does: [
      'Open coach portal with private token',
      'Share / unshare classes on public calendar',
      'Book walk-in guests onto sessions',
      'Mark attendance on roster',
      'Update capacity and public notes',
    ],
    doesNot: [
      'Does not manage other coaches’ sessions',
      'Does not change membership billing',
    ],
  },
  {
    title: 'Member / customer',
    subtitle: 'Book · attend · subscribe',
    does: [
      'See public schedule on gym website / embed',
      'Book online (or join waitlist when full)',
      'Hold active subscription or class pack',
      'Check in at front desk or class',
      'Buy PT packs with a preferred coach',
    ],
    doesNot: [
      'Does not see private / unpublished sessions',
      'Does not access coach portal tokens',
    ],
  },
] as const;

export const PROCESS_PHASES: ProcessPhase[] = [
  {
    title: '1 · People (coaches & members)',
    subtitle: 'Who trains · who attends',
    steps: [
      {
        n: '1a',
        title: 'Coach register',
        who: 'Owner',
        desc: 'Specialties, public bio, contact; issue coach portal token.',
      },
      {
        n: '1b',
        title: 'Clients / members',
        who: 'Owner',
        desc: 'Member book, status, assigned coach, emergency contact.',
      },
      {
        n: '1c',
        title: 'Coach portal link',
        who: 'Owner',
        desc: 'Copy private URL so coaches manage and share their classes.',
      },
    ],
  },
  {
    title: '2 · Memberships & subscriptions',
    subtitle: 'Plans sell · subs track entitlement',
    steps: [
      {
        n: '2a',
        title: 'Membership plans',
        who: 'Owner',
        desc: 'Unlimited, packs, drop-in; price, credits, public pricing flag.',
      },
      {
        n: '2b',
        title: 'Subscriptions',
        who: 'Owner',
        desc: 'Active / trial / paused / cancelled; remaining class credits.',
      },
      {
        n: '2c',
        title: 'PT packs',
        who: 'Owner',
        desc: 'Issue personal-training session packs per client and coach.',
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
    title: '4 · Calendar (schedule coaches)',
    subtitle: 'Owner puts coaches on the grid',
    steps: [
      {
        n: '4a',
        title: 'Schedule session',
        who: 'Owner',
        desc: 'Date, time, room, class type, assign coach, capacity override.',
      },
      {
        n: '4b',
        title: 'Publish public',
        who: 'Owner',
        desc: 'Mark session public + notes so it appears on website embed.',
      },
      {
        n: '4c',
        title: 'Reassign coach',
        who: 'Owner',
        desc: 'Change coach on any session; portal reflects ownership.',
      },
    ],
  },
  {
    title: '5 · Floor (bookings · check-ins · coach share)',
    subtitle: 'Capacity, waitlist, attendance',
    steps: [
      {
        n: '5a',
        title: 'Book members',
        who: 'Desk / coach',
        desc: 'Book into session; auto-waitlist when full; source desk/coach/web.',
      },
      {
        n: '5b',
        title: 'Check-ins',
        who: 'Desk',
        desc: 'Front-desk or class attendance log by day.',
      },
      {
        n: '5c',
        title: 'Coach share',
        who: 'Coach',
        desc: 'Portal: share class publicly, book guests, mark attended.',
      },
    ],
  },
  {
    title: '6 · Website, embed & insights',
    subtitle: 'Customer-facing gym on SupplierAdvisor®',
    steps: [
      {
        n: '6a',
        title: 'Website settings',
        who: 'Owner',
        desc: 'Publish calendar, brand colour, booking on/off, rotate token.',
      },
      {
        n: '6b',
        title: 'Embed / API',
        who: 'Owner',
        desc: 'Iframe page or JSON API for the gym’s own website.',
      },
      {
        n: '6c',
        title: 'Reports',
        who: 'Owner',
        desc: 'Attendance by class, members, PT remaining, utilisation.',
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
    desc: 'Bookings auto-waitlist when capacity is full — desk, coach or website.',
  },
  {
    title: 'Subscriptions sync status',
    desc: 'Sub pause/cancel updates client membership status for floor truth.',
  },
  {
    title: 'Tokenised portals',
    desc: 'Website and coach portals use secret tokens — no private PII on public calendar.',
  },
  {
    title: 'One gym book',
    desc: 'Coaches, classes, bookings and website all share the same Fitgraph store.',
  },
];

export const SYSTEM_BENEFITS = [
  {
    title: 'Owner schedules coaches',
    desc: 'Calendar is the system of record for who teaches what and when.',
  },
  {
    title: 'Coach self-service',
    desc: 'Portal lets coaches share classes and manage walk-ins without desk login.',
  },
  {
    title: 'Website-ready',
    desc: 'Branded embed and JSON API for the gym’s own site — not a separate app.',
  },
  {
    title: 'Subscriptions first-class',
    desc: 'Plans and active subs with credits — not a spreadsheet side system.',
  },
  {
    title: 'Waitlist built-in',
    desc: 'Full classes still capture demand for operators.',
  },
  {
    title: 'PT packs tracked',
    desc: 'Remaining personal-training sessions per client and coach.',
  },
  {
    title: 'Attendance insights',
    desc: 'Utilisation by class type for programming decisions.',
  },
  {
    title: 'Tertiary / services pack',
    desc: 'Fitness & wellness industry module on SupplierAdvisor®.',
  },
];

export const ONE_SENTENCE =
  'Register coaches and members → sell plans and track subscriptions → define class types → schedule coaches onto sessions and publish → book and check in on the floor (or coach portal) → embed the public calendar on the gym website and review attendance.';

// ── PDF (violet brand) ──────────────────────────────────────────────────

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

const BRAND = '#7c3aed';
const BRAND_DEEP = '#4c1d95';
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
        `SupplierAdvisor® · Fitgraph® · ${orientLabel} · Gym services OS`,
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
      .fillColor('#ddd6fe')
      .text(
        `FITGRAPH®  ·  PROCESS DESIGN  ·  ${orientLabel}`,
        g.mx,
        12,
        { width: g.contentW, characterSpacing: 1 }
      );
    const title =
      'Coaches → Members → Plans → Calendar → Bookings → Website';
    if (g.isLandscape) {
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#ffffff')
        .text(title, g.mx, 28, { width: g.contentW * 0.68 });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#ede9fe')
        .text(
          'End-to-end gym services OS on SupplierAdvisor® — schedule, subscriptions, coach portal, website embed.',
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
        .fillColor('#ede9fe')
        .text(
          'Tertiary / services fitness OS — coaches, calendar, bookings and public website.',
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
          'Fitgraph® Process Design — Coaches → Calendar → Website',
        Author: 'SupplierAdvisor®',
        Subject: `Fitgraph gym services end-to-end process (A4 ${orientation})`,
        Keywords: 'Fitgraph, gym, coaches, calendar, subscriptions, process guide',
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
      .text('FULL PROCESS — PART A (PEOPLE → PLANS → CLASSES → CALENDAR)', g.mx, y, {
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
          'Process continued · Floor · Website · Guardrails',
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
  return `Fitgraph-Process-Design-A4-${orientation}.pdf`;
}
