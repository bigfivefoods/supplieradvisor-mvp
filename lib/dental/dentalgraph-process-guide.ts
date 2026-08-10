/**
 * Dentalgraph® end-to-end process guide content + PDF.
 * People → Services · care plans → Diary → Floor → Messages → Website · reports
 * Pure pdfkit — works on Vercel serverless.
 *
 * Do not import from client components (pulls pdfkit into the browser bundle).
 * Client UI should use `@/lib/dental/dentalgraph-process-guide-links` only.
 */
import PDFDocument from 'pdfkit';
import type { DentalgraphProcessGuideOrientation } from '@/lib/dental/dentalgraph-process-guide-links';
export type { DentalgraphProcessGuideOrientation } from '@/lib/dental/dentalgraph-process-guide-links';

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
  { label: 'People', sub: 'Staff · patients' },
  { label: 'Services · plans', sub: 'Catalogue · care plans' },
  { label: 'Diary', sub: 'Schedule · assign' },
  { label: 'Floor', sub: 'Book · attend · feedback' },
  { label: 'Messages', sub: 'Desk · care threads' },
  { label: 'Website · reports', sub: 'Publish · utilisation' },
] as const;

export const ROLE_CARDS = [
  {
    title: 'Practice owner / manager',
    subtitle: 'Team · catalogue · diary · insight',
    does: [
      'Register dentists, hygienists, assistants; roles & rates',
      'Patient register; assign clinician + care plan',
      'Define services and multi-visit care plans',
      'Schedule diary; assign clinicians; public slots',
      'Practice bio, website publish and booking flags',
      'Messages with desk/staff; utilisation reports',
    ],
    doesNot: [
      'Does not leave public slots without a clinician',
      'Does not publish without website settings enabled',
    ],
  },
  {
    title: 'Dentist / hygienist',
    subtitle: 'Diary · clinical · attend · feedback',
    does: [
      'Keep own bio / roles current for website',
      'Update oral-health clinical notes (site, goals, mods)',
      'Medical chart: medical aid, documents, claims',
      'Run appointments; mark attended / no-show',
      'Reply on care threads with desk and patients',
      'Request post-visit feedback after attendance',
    ],
    doesNot: [
      'Does not change other clinicians’ rates',
      'Does not publish the whole practice website alone',
    ],
  },
  {
    title: 'Patient / public',
    subtitle: 'Book · attend · feedback',
    does: [
      'See published practice profile and public diary',
      'Book via desk or website when enabled',
      'Hold care plan entitlement across visits',
      'Receive care messages from the practice',
      'After visit: give feedback when prompted',
    ],
    doesNot: [
      'Does not see private / unpublished slots',
      'Does not access clinician rates or other patients’ charts',
    ],
  },
] as const;

export const PROCESS_PHASES: ProcessPhase[] = [
  {
    title: '1 · People (staff & patients)',
    subtitle: 'Who treats · who is in care · assignment',
    steps: [
      {
        n: '1a',
        title: 'Staff register',
        who: 'Owner',
        desc: 'Dentists, hygienists, assistants; roles, rates, bios.',
      },
      {
        n: '1b',
        title: 'Patients',
        who: 'Owner / reception',
        desc: 'Patient book; status; assign clinician and care plan.',
      },
      {
        n: '1c',
        title: 'Clinical & medical chart',
        who: 'Clinician',
        desc: 'Tooth/site, goals, mods; medical aid, docs, claims.',
      },
    ],
  },
  {
    title: '2 · Services & care plans',
    subtitle: 'What you sell · multi-visit entitlement',
    steps: [
      {
        n: '2a',
        title: 'Services',
        who: 'Owner',
        desc: 'Check-ups, hygiene, restorative — duration and price.',
      },
      {
        n: '2b',
        title: 'Care plans',
        who: 'Owner',
        desc: 'Multi-visit packages with sessions total and price.',
      },
      {
        n: '2c',
        title: 'Assign plan',
        who: 'Owner / reception',
        desc: 'Link care plan on the patient so entitlement is clear.',
      },
    ],
  },
  {
    title: '3 · Diary (schedule · assign)',
    subtitle: 'Slots with clinician and service',
    steps: [
      {
        n: '3a',
        title: 'Schedule appointment',
        who: 'Owner / reception',
        desc: 'Date, time, service, chair; assign clinician.',
      },
      {
        n: '3b',
        title: 'Public flag',
        who: 'Owner',
        desc: 'Mark public so the slot can appear for online booking.',
      },
      {
        n: '3c',
        title: 'Reassign',
        who: 'Owner / reception',
        desc: 'Change clinician anytime; keep diary as system of record.',
      },
    ],
  },
  {
    title: '4 · Floor (book · attend · feedback)',
    subtitle: 'Capacity, attendance, post-visit pulse',
    steps: [
      {
        n: '4a',
        title: 'Book patient',
        who: 'Reception / website',
        desc: 'Book onto slot; waitlist when full; desk or public booking.',
      },
      {
        n: '4b',
        title: 'Mark attended',
        who: 'Clinician / reception',
        desc: 'Attended or no-show; triggers feedback prompt when attended.',
      },
      {
        n: '4c',
        title: 'Visit feedback',
        who: 'Patient',
        desc: 'Patient rates the visit via token link after attendance.',
      },
    ],
  },
  {
    title: '5 · Messages',
    subtitle: 'Desk · staff · patients',
    steps: [
      {
        n: '5a',
        title: 'Care threads',
        who: 'Reception / clinician',
        desc: 'Colleague and patient care messages for hand-offs.',
      },
      {
        n: '5b',
        title: 'Close the loop',
        who: 'Team',
        desc: 'Reply and archive when the episode of care is done.',
      },
    ],
  },
  {
    title: '6 · Website & insights',
    subtitle: 'Public profile · publish · utilisation',
    steps: [
      {
        n: '6a',
        title: 'Practice profile',
        who: 'Owner',
        desc: 'Brand name, bio, contact; show staff / pricing.',
      },
      {
        n: '6b',
        title: 'Publish & booking',
        who: 'Owner',
        desc: 'Enable website and public booking; copy public token.',
      },
      {
        n: '6c',
        title: 'Reports',
        who: 'Owner',
        desc: 'Utilisation by clinician, service, appointments.',
      },
    ],
  },
];

export const GUARDRAILS = [
  {
    title: 'Clinician on every public slot',
    desc: 'Diary assigns a dentist or hygienist; public slots without one are incomplete.',
  },
  {
    title: 'Public = published',
    desc: 'Only public slots and an enabled website profile are ready for online booking.',
  },
  {
    title: 'Care plans track entitlement',
    desc: 'Multi-visit plans live on the patient — not a side spreadsheet.',
  },
  {
    title: 'Clinical notes travel with the patient',
    desc: 'Site, status, mods and goals keep every visit safe and progressive.',
  },
  {
    title: 'Medical chart is first-class',
    desc: 'Medical aid, documents and claims sit on the patient record.',
  },
  {
    title: 'Attend then feedback',
    desc: 'Mark attended before the post-visit feedback token is issued.',
  },
  {
    title: 'Tokenised public surfaces',
    desc: 'Website uses a secret public token — no private PII on open calendars.',
  },
  {
    title: 'One practice book',
    desc: 'People, diary, bookings, messages and website share one Dentalgraph store.',
  },
];

export const SYSTEM_BENEFITS = [
  {
    title: 'Dental practice OS',
    desc: 'Dentists, hygienists and the full team on one diary and patient book.',
  },
  {
    title: 'Care plans',
    desc: 'Multi-visit packages on the patient for clear entitlement.',
  },
  {
    title: 'Clinical + medical chart',
    desc: 'Oral-health notes plus medical aid, docs and claims together.',
  },
  {
    title: 'Diary as system of record',
    desc: 'Who treats whom, when — reassign anytime.',
  },
  {
    title: 'Website-ready',
    desc: 'Publish practice profile and online booking flags from one place.',
  },
  {
    title: 'Messages close hand-offs',
    desc: 'Desk, clinicians and patients stay on one thread.',
  },
  {
    title: 'Post-visit feedback',
    desc: 'Patients rate care after attendance — continuous improvement.',
  },
  {
    title: 'Utilisation reports',
    desc: 'See load by clinician and service without leaving the OS.',
  },
];

export const ONE_SENTENCE =
  'Register staff and patients (clinical + medical chart) → define services and care plans → schedule diary slots with clinicians → book patients and mark attended → message the care team → publish the practice website and review utilisation reports.';

// ── PDF (sky brand) ─────────────────────────────────────────────────────

const A4_PORTRAIT_W = 595.28;
const A4_PORTRAIT_H = 841.89;

type Geo = {
  orientation: DentalgraphProcessGuideOrientation;
  pageW: number;
  pageH: number;
  mx: number;
  contentW: number;
  footerY: number;
  isLandscape: boolean;
};

function geoFor(orientation: DentalgraphProcessGuideOrientation): Geo {
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

const BRAND = '#0284c7';
const BRAND_DEEP = '#0c4a6e';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const TEAL = '#0d9488';
const EMERALD = '#059669';
const AMBER = '#d97706';
const ROSE = '#e11d48';
const CHAIN_COLORS = [BRAND_DEEP, TEAL, AMBER, BRAND, EMERALD, ROSE] as const;

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
        `SupplierAdvisor® · Dentalgraph® · ${orientLabel} · Dental practice OS`,
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
      .text(
        `DENTALGRAPH®  ·  PROCESS DESIGN  ·  ${orientLabel}`,
        g.mx,
        12,
        { width: g.contentW, characterSpacing: 1 }
      );
    const title =
      'Staff → Patients → Services → Diary → Bookings → Website';
    if (g.isLandscape) {
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#ffffff')
        .text(title, g.mx, 28, { width: g.contentW * 0.68 });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#e0f2fe')
        .text(
          'End-to-end dental practice OS on SupplierAdvisor® — diary, care plans, clinical chart, website.',
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
        .fillColor('#e0f2fe')
        .text(
          'Tertiary / services dental OS — people, diary, attendance, messages, website & reports.',
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
  const tones = [BRAND_DEEP, AMBER, TEAL];
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
    doc.roundedRect(x, by, boxW, boxH, 4).fillAndStroke('#f0f9ff', '#7dd3fc');
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
  doc.roundedRect(g.mx, y, g.contentW, h, 6).fillAndStroke('#f0f9ff', '#7dd3fc');
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

export async function buildDentalgraphProcessGuidePdf(opts?: {
  generatedAt?: Date;
  orientation?: DentalgraphProcessGuideOrientation;
}): Promise<Buffer> {
  const generated = opts?.generatedAt || new Date();
  const orientation: DentalgraphProcessGuideOrientation =
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
          'Dentalgraph® Process Design — Staff → Diary → Website',
        Author: 'SupplierAdvisor®',
        Subject: `Dentalgraph dental practice end-to-end process (A4 ${orientation})`,
        Keywords:
          'Dentalgraph, dental, dentist, diary, care plans, process guide',
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
      .text('FULL PROCESS — PART A (PEOPLE → SERVICES → DIARY)', g.mx, y, {
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
          'Process continued · Floor · Messages · Website · Guardrails',
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

export function parseDentalgraphProcessGuideOrientation(
  raw: string | null | undefined
): DentalgraphProcessGuideOrientation {
  const v = String(raw || '').toLowerCase();
  if (v === 'portrait' || v === 'p') return 'portrait';
  return 'landscape';
}

export function dentalgraphProcessGuideFilename(
  orientation: DentalgraphProcessGuideOrientation
): string {
  return `Dentalgraph-Process-Design-A4-${orientation}.pdf`;
}
