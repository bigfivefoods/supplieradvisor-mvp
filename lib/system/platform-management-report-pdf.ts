/**
 * SupplierAdvisor® platform management report — one-page A4 landscape.
 * Companies, people, commercial, network, trade, Advisor modules.
 * Pure pdfkit. Do not import from client components.
 */
import PDFDocument from 'pdfkit';
import type { ManagementReport } from '@/lib/system/platform-metrics';

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 26;
const CONTENT_W = PAGE_W - MX * 2;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const OK = '#047857';
const RISK = '#be123c';
const FOOTER_Y = PAGE_H - 16;

type PdfDoc = InstanceType<typeof PDFDocument>;

function str(v: string | number | null | undefined) {
  if (v == null) return '—';
  return String(v);
}

function t(
  pdf: PdfDoc,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  align?: 'left' | 'center' | 'right'
) {
  if (y >= PAGE_H - 2 || h <= 0) return;
  pdf.text(text, x, y, {
    width: w,
    height: Math.min(h, PAGE_H - y - 1),
    align: align || 'left',
    lineBreak: true,
    ellipsis: true,
  });
}

function distRows(
  data?: Record<string, number> | null
): Array<[string, string | number]> {
  if (!data) return [];
  return Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => [k, v]);
}

export function platformManagementPdfFilename(d = new Date()) {
  const day = d.toISOString().slice(0, 10);
  return `SupplierAdvisor-Platform-Management-A4-Landscape-${day}.pdf`;
}

export async function buildPlatformManagementReportPdf(
  management: ManagementReport,
  opts?: { companyName?: string }
): Promise<Buffer> {
  const c = management.companies;
  const p = management.people;
  const n = management.network;
  const com = management.commercial;
  const tr = management.trade;
  const mod = management.modules;
  const generated = management.at || new Date().toISOString();

  const kpis: Array<{ label: string; value: string | number }> = [
    { label: 'Total companies', value: c.total },
    { label: 'With members', value: c.withActiveMembers },
    { label: 'Discoverable', value: c.discoverable },
    { label: 'New 7d', value: c.new7d },
    { label: 'New 30d', value: c.new30d },
    { label: 'Active memberships', value: p.activeMemberships },
    { label: 'Distinct users', value: p.distinctUsers },
    { label: 'Owners', value: p.owners },
    { label: 'Invites pending', value: p.invitesPending },
    { label: 'Active paid', value: com.activePaid },
    { label: 'Trial', value: com.trial },
    { label: 'Network edges', value: n.connectionsActive },
  ];

  const highlights = [
    `${c.new7d} new companies in 7 days · ${c.new30d} in 30 days`,
    `${com.activePaid} active paid · ${com.trial} trial · ${com.lifetime} lifetime`,
    `${n.connectionsActive} active network edges · ${n.invites24h} invites (24h)`,
    `${tr.activity24h} trade activity (24h) · ${tr.firstTrade24h} first trades`,
  ];
  const risks = [
    com.pastDueOrCancelled > 0
      ? `${com.pastDueOrCancelled} past due / cancelled subscriptions`
      : 'No past-due / cancelled spike',
    tr.claimsPending > 0
      ? `${tr.claimsPending} claims pending`
      : 'Claims inbox clear',
    p.invitesPending > 0
      ? `${p.invitesPending} team invites pending`
      : 'Team invites under control',
    n.connectionsPending > 0
      ? `${n.connectionsPending} network connections pending`
      : 'Network pending low',
  ];
  const actions = [
    'Review latest sign-ups and verification status',
    'Chase past-due / cancelled commercial accounts',
    'Grow Advisor module adoption where adoption is low',
    'Clear pending network connections and claims',
  ];

  const subRows = distRows(c.bySubscription);
  const verRows = distRows(c.byVerification);
  const moduleRows: Array<[string, string | number]> = [
    ['SchoolAdvisor®', mod.schoolsEnabled],
    ['Health / DoH', mod.healthEnabled],
    ['CropAdvisor®', mod.fieldgraphEnabled],
    ['QuarryAdvisor®', mod.quarrygraphEnabled],
    ['GymAdvisor®', mod.fitgraphEnabled],
    ['PhysioAdvisor®', mod.physiographEnabled],
    ['DentalAdvisor®', mod.dentalgraphEnabled],
    ['MedicalAdvisor®', mod.medicalgraphEnabled],
    ['PsychiatryAdvisor®', mod.psychiatrygraphEnabled],
    ['VetAdvisor®', mod.vetgraphEnabled],
    ['HireAdvisor®', mod.hiregraphEnabled],
    ['RetailAdvisor®', mod.retailgraphEnabled],
  ];

  const recent = (management.recentCompanies || []).slice(0, 6).map((r) => [
    r.trading_name || r.company_name || `#${r.id}`,
    r.subscription_status || '—',
    r.verification_status || '—',
    r.created_at ? String(r.created_at).slice(0, 10) : '—',
    r.country || r.city || '—',
  ]);

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      autoFirstPage: true,
      margins: { top: 0, bottom: PAGE_H - 2, left: MX, right: MX },
      info: {
        Title: 'SupplierAdvisor® platform management report (A4 landscape)',
        Author: 'SupplierAdvisor®',
        Subject: 'Platform companies · commercial · network · trade · Advisors',
        CreationDate: new Date(generated),
      },
    });
    const chunks: Buffer[] = [];
    pdf.on('data', (cbuf: Buffer) => chunks.push(cbuf));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const page = pdf.page;
    page.margins.top = 0;
    page.margins.bottom = 0;
    page.margins.left = 0;
    page.margins.right = 0;

    // Header
    const heroH = 40;
    pdf.rect(0, 0, PAGE_W, heroH).fill(BRAND_DEEP);
    pdf.rect(0, heroH - 2.5, PAGE_W, 2.5).fill(BRAND);
    pdf.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff');
    t(pdf, 'SupplierAdvisor®', MX, 8, CONTENT_W * 0.5, 14);
    pdf.font('Helvetica').fontSize(7.5).fillColor('#bae6fd');
    t(
      pdf,
      'Platform management report · key metrics · one page',
      MX,
      24,
      CONTENT_W * 0.5,
      10
    );
    pdf.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    t(
      pdf,
      opts?.companyName || 'Platform console',
      MX,
      8,
      CONTENT_W,
      12,
      'right'
    );
    pdf.font('Helvetica').fontSize(7).fillColor('#bae6fd');
    t(
      pdf,
      `${generated.slice(0, 16).replace('T', ' ')}  ·  A4 landscape`,
      MX,
      24,
      CONTENT_W,
      10,
      'right'
    );

    let y = heroH + 8;
    pdf.font('Helvetica-Bold').fontSize(11).fillColor(INK);
    t(
      pdf,
      'Platform health pack — sign-ups, subscriptions, network, trade & Advisors',
      MX,
      y,
      CONTENT_W,
      12
    );
    y += 14;

    // KPIs
    const cols = 6;
    const gap = 5;
    const tileW = (CONTENT_W - gap * (cols - 1)) / cols;
    const tileH = 30;
    kpis.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = MX + col * (tileW + gap);
      const ty = y + row * (tileH + gap);
      pdf.roundedRect(x, ty, tileW, tileH, 3).fillAndStroke('#f8fafc', LINE);
      pdf.rect(x, ty, 2.5, tileH).fill(BRAND);
      pdf.font('Helvetica').fontSize(5.5).fillColor(MUTED);
      t(pdf, k.label.toUpperCase(), x + 7, ty + 4, tileW - 10, 8);
      pdf.font('Helvetica-Bold').fontSize(11).fillColor(INK);
      t(pdf, str(k.value), x + 7, ty + 13, tileW - 10, 14);
    });
    y += 2 * (tileH + gap) + 4;

    // Trade strip
    const tradeKpis = [
      { label: 'Activity 24h', value: tr.activity24h },
      { label: 'First trade 24h', value: tr.firstTrade24h },
      { label: 'Claims pending', value: tr.claimsPending },
      { label: 'Claims confirmed 24h', value: tr.claimsConfirmed24h },
      { label: 'Ratings 24h', value: tr.ratingsPublished24h },
      { label: 'Open POs', value: tr.posOpen ?? '—' },
      { label: 'Founding waitlist', value: com.foundingWaitlist ?? '—' },
      { label: 'Listings', value: n.marketplaceListings ?? '—' },
      { label: 'Past due / cancel', value: com.pastDueOrCancelled },
      { label: 'Lifetime', value: com.lifetime },
      { label: 'Pending edges', value: n.connectionsPending },
      { label: 'Invites 24h', value: n.invites24h },
    ];
    const tcols = 6;
    const tW = (CONTENT_W - gap * (tcols - 1)) / tcols;
    const tH = 26;
    tradeKpis.forEach((k, i) => {
      const col = i % tcols;
      const row = Math.floor(i / tcols);
      const x = MX + col * (tW + gap);
      const ty = y + row * (tH + 4);
      pdf.roundedRect(x, ty, tW, tH, 3).fillAndStroke('#f0f9ff', '#bae6fd');
      pdf.font('Helvetica').fontSize(5).fillColor(MUTED);
      t(pdf, k.label.toUpperCase(), x + 5, ty + 3, tW - 8, 7);
      pdf.font('Helvetica-Bold').fontSize(10).fillColor(INK);
      t(pdf, str(k.value), x + 5, ty + 11, tW - 8, 12);
    });
    y += 2 * (tH + 4) + 6;

    // Highlights / risks / actions
    const colW = (CONTENT_W - 10) / 3;
    const secH = 48;
    const sections = [
      { title: 'HIGHLIGHTS', items: highlights, color: OK, bg: '#ecfdf5', border: '#a7f3d0' },
      { title: 'RISKS / WATCH', items: risks, color: RISK, bg: '#fff1f2', border: '#fecdd3' },
      { title: 'OWNER ACTIONS', items: actions, color: BRAND_DEEP, bg: '#e0f2fe', border: '#7dd3fc' },
    ];
    sections.forEach((sec, i) => {
      const x = MX + i * (colW + 5);
      pdf.roundedRect(x, y, colW, secH, 3).fillAndStroke(sec.bg, sec.border);
      pdf.font('Helvetica-Bold').fontSize(6.5).fillColor(sec.color);
      t(pdf, sec.title, x + 5, y + 4, colW - 10, 8);
      let hy = y + 14;
      pdf.font('Helvetica').fontSize(6).fillColor(INK);
      for (const item of sec.items.slice(0, 4)) {
        if (hy > y + secH - 9) break;
        t(pdf, `• ${item}`, x + 5, hy, colW - 10, 9);
        hy += 9;
      }
    });
    y += secH + 6;

    // Three mini tables: subscription · verification · modules
    const miniGap = 8;
    const miniW = (CONTENT_W - miniGap * 2) / 3;
    const minis: Array<{
      title: string;
      headers: string[];
      rows: Array<Array<string | number>>;
    }> = [
      {
        title: 'Subscription mix',
        headers: ['Status', 'Count'],
        rows: subRows.length ? subRows : [['—', '—']],
      },
      {
        title: 'Verification mix',
        headers: ['Status', 'Count'],
        rows: verRows.length ? verRows : [['—', '—']],
      },
      {
        title: 'Advisor modules on',
        headers: ['Module', 'Companies'],
        rows: moduleRows,
      },
    ];
    const maxTableY = FOOTER_Y - 12;
    minis.forEach((table, ti) => {
      const x0 = MX + ti * (miniW + miniGap);
      let ty = y;
      pdf.font('Helvetica-Bold').fontSize(7).fillColor(INK);
      t(pdf, table.title, x0, ty, miniW, 9);
      ty += 10;
      const headers = table.headers;
      const n = headers.length;
      const cw = miniW / n;
      pdf.rect(x0, ty - 1, miniW, 9).fill('#f1f5f9');
      pdf.font('Helvetica-Bold').fontSize(5.5).fillColor(MUTED);
      headers.forEach((h, i) => t(pdf, h, x0 + i * cw + 2, ty, cw - 4, 8));
      ty += 10;
      pdf.font('Helvetica').fontSize(6).fillColor(INK);
      for (const row of table.rows.slice(0, 12)) {
        if (ty > maxTableY - 8) break;
        headers.forEach((_, i) =>
          t(pdf, str(row[i]), x0 + i * cw + 2, ty, cw - 4, 8)
        );
        ty += 9;
      }
    });

    // Optional recent sign-ups strip if room
    if (recent.length && y + 70 < maxTableY) {
      // leave minis as is; recent would crowd — skip on one-pager when minis present
    }

    // Footer
    pdf
      .moveTo(MX, FOOTER_Y - 4)
      .lineTo(MX + CONTENT_W, FOOTER_Y - 4)
      .strokeColor(LINE)
      .lineWidth(0.4)
      .stroke();
    pdf.font('Helvetica').fontSize(5.5).fillColor(MUTED);
    t(
      pdf,
      `SupplierAdvisor® platform · Generated ${generated.slice(0, 16).replace('T', ' ')} · Confidential platform pack`,
      MX,
      FOOTER_Y - 1,
      CONTENT_W * 0.72,
      8
    );
    t(pdf, 'Page 1 of 1 · A4 landscape', MX, FOOTER_Y - 1, CONTENT_W, 8, 'right');

    pdf.end();
  });
}
