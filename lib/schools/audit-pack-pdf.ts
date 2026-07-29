/**
 * Sprint C3 — NSNP audit pack PDF (sealed summary for auditors).
 */
import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_BAND = 36;
const CONTENT_BOTTOM = PAGE_H - FOOTER_BAND;
const FOOTER_Y = PAGE_H - 20;

function startPdf(title: string, subject: string): {
  pdf: PdfDoc;
  done: Promise<Buffer>;
} {
  const pdf = new PDFDocument({
    size: 'A4',
    margins: {
      top: MARGIN,
      left: MARGIN,
      right: MARGIN,
      bottom: FOOTER_BAND,
    },
    bufferPages: true,
    info: {
      Title: title,
      Author: 'Supplier Advisor · NSNP',
      Subject: subject,
    },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  return { pdf, done };
}

function ensureSpace(pdf: PdfDoc, yRef: { y: number }, need: number) {
  if (yRef.y + need > CONTENT_BOTTOM - 8) {
    pdf.addPage();
    yRef.y = MARGIN + 8;
  }
}

function footer(pdf: PdfDoc, generated: string, hash: string) {
  const range = pdf.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    pdf.switchToPage(range.start + i);
    const savedBottom = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#94a3b8')
      .text(
        `Supplier Advisor · NSNP Audit · ${generated} · ${hash.slice(0, 24)}… · page ${i + 1}/${total}`,
        MARGIN,
        FOOTER_Y,
        { width: CONTENT_W, align: 'center', lineBreak: false }
      );
    pdf.page.margins.bottom = savedBottom;
  }
}

function h1(pdf: PdfDoc, yRef: { y: number }, text: string) {
  ensureSpace(pdf, yRef, 28);
  pdf
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#0f172a')
    .text(text, MARGIN, yRef.y, { width: CONTENT_W });
  yRef.y = pdf.y + 8;
}

function h2(pdf: PdfDoc, yRef: { y: number }, text: string) {
  ensureSpace(pdf, yRef, 22);
  pdf
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#0369a1')
    .text(text, MARGIN, yRef.y, { width: CONTENT_W });
  yRef.y = pdf.y + 4;
}

function row(
  pdf: PdfDoc,
  yRef: { y: number },
  label: string,
  value: string
) {
  ensureSpace(pdf, yRef, 14);
  pdf
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#64748b')
    .text(label, MARGIN, yRef.y, { width: 140, continued: false });
  pdf
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#0f172a')
    .text(value, MARGIN + 145, yRef.y, { width: CONTENT_W - 145 });
  yRef.y = Math.max(pdf.y, yRef.y + 12) + 2;
}

function kvGrid(
  pdf: PdfDoc,
  yRef: { y: number },
  items: Array<{ label: string; value: string }>
) {
  for (const it of items) row(pdf, yRef, it.label, it.value);
}

export function auditPackPdfFilename(
  pack: Record<string, unknown>,
  from: string,
  to: string
): string {
  const school = (pack.school || {}) as Record<string, unknown>;
  const emis = school.emis || school.id || 'school';
  return `NSNP_Audit_${emis}_${from}_${to}.pdf`;
}

export async function buildAuditPackPdf(
  pack: Record<string, unknown>,
  contentHash?: string
): Promise<Buffer> {
  const school = (pack.school || {}) as Record<string, unknown>;
  const period = (pack.period || {}) as Record<string, unknown>;
  const pos = Array.isArray(pack.purchase_orders)
    ? (pack.purchase_orders as Array<Record<string, unknown>>)
    : [];
  const dels = Array.isArray(pack.deliveries)
    ? (pack.deliveries as Array<Record<string, unknown>>)
    : [];
  const recs = Array.isArray(pack.kitchen_receipts)
    ? (pack.kitchen_receipts as Array<Record<string, unknown>>)
    : [];
  const feed = Array.isArray(pack.feeding_days)
    ? (pack.feeding_days as Array<Record<string, unknown>>)
    : [];
  const claims = Array.isArray(pack.claims)
    ? (pack.claims as Array<Record<string, unknown>>)
    : [];
  const match = (pack.three_way_match || {}) as Record<string, unknown>;
  const msum = (match.summary || {}) as Record<string, unknown>;
  const sim = (pack.funding_simulation || {}) as Record<string, unknown>;
  const simNow =
    ((sim.simulation as Record<string, unknown> | undefined)
      ?.if_submit_now as Record<string, unknown>) || {};
  const inputs = (sim.inputs || {}) as Record<string, unknown>;
  const hash = contentHash || 'sha256:unsealed';
  const generated =
    pack.generated_at != null
      ? String(pack.generated_at).replace('T', ' ').slice(0, 19)
      : new Date().toISOString().replace('T', ' ').slice(0, 19);

  const { pdf, done } = startPdf(
    `NSNP Audit Pack · ${school.name || school.id || 'School'}`,
    `Period ${period.from} – ${period.to}`
  );
  const yRef = { y: MARGIN };

  // Brand bar
  pdf.rect(0, 0, PAGE_W, 8).fill('#0077b6');
  yRef.y = MARGIN + 4;

  h1(pdf, yRef, 'NSNP Audit Pack');
  pdf
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#64748b')
    .text(
      'PO · Delivery note · POD · Kitchen GRN · Feed days · Three-way match · Funding',
      MARGIN,
      yRef.y,
      { width: CONTENT_W }
    );
  yRef.y = pdf.y + 10;

  h2(pdf, yRef, 'School');
  kvGrid(pdf, yRef, [
    { label: 'Name', value: String(school.name || '—') },
    { label: 'EMIS', value: String(school.emis || '—') },
    { label: 'NATEMIS', value: String(school.natemis || '—') },
    {
      label: 'District / Province',
      value: `${school.district || '—'} · ${school.province || '—'}`,
    },
    {
      label: 'Period',
      value: `${period.from || '—'} → ${period.to || '—'}`,
    },
    { label: 'Generated', value: generated },
    { label: 'Content seal', value: hash },
  ]);

  h2(pdf, yRef, 'Summary counts');
  const meals = feed.reduce(
    (n, f) => n + Number(f.served_meals || 0),
    0
  );
  const poTotal = pos.reduce(
    (n, p) => n + Number(p.total_amount || 0),
    0
  );
  kvGrid(pdf, yRef, [
    { label: 'Purchase orders', value: String(pos.length) },
    { label: 'PO value (ZAR)', value: poTotal.toLocaleString('en-ZA') },
    { label: 'Deliveries', value: String(dels.length) },
    { label: 'Kitchen GRNs', value: String(recs.length) },
    {
      label: 'Feed days / meals',
      value: `${feed.length} / ${meals.toLocaleString('en-ZA')}`,
    },
    { label: 'Claims', value: String(claims.length) },
  ]);

  h2(pdf, yRef, 'Three-way match');
  kvGrid(pdf, yRef, [
    {
      label: 'Matched',
      value: `${msum.matched ?? 0} / ${msum.pos ?? pos.length}`,
    },
    { label: 'Partial', value: String(msum.partial ?? 0) },
    { label: 'Gaps', value: String(msum.gaps ?? 0) },
    {
      label: 'Funding path',
      value: msum.funding_path_ready ? 'Ready' : 'Not ready',
    },
  ]);

  h2(pdf, yRef, 'Funding simulation');
  kvGrid(pdf, yRef, [
    {
      label: 'Meals served',
      value: String(inputs.meals_served ?? meals),
    },
    {
      label: 'Approved brand %',
      value:
        inputs.approved_brand_pct != null
          ? `${inputs.approved_brand_pct}%`
          : '—',
    },
    {
      label: 'Claim if submit now',
      value:
        simNow.claim_amount != null
          ? `R ${Number(simNow.claim_amount).toLocaleString('en-ZA')}`
          : '—',
    },
    {
      label: 'Clawback',
      value:
        simNow.clawback_pct != null
          ? `${simNow.clawback_pct}%`
          : 'None',
    },
  ]);

  // POs table (first page set)
  h2(pdf, yRef, 'Purchase orders (period)');
  ensureSpace(pdf, yRef, 18);
  pdf
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#475569')
    .text('PO', MARGIN, yRef.y, { width: 120 })
    .text('Date', MARGIN + 120, yRef.y, { width: 70 })
    .text('Status', MARGIN + 190, yRef.y, { width: 80 })
    .text('Amount', MARGIN + 280, yRef.y, { width: 80, align: 'right' })
    .text('Lines', MARGIN + 370, yRef.y, { width: 50, align: 'right' });
  yRef.y += 12;
  pdf
    .moveTo(MARGIN, yRef.y)
    .lineTo(MARGIN + CONTENT_W, yRef.y)
    .strokeColor('#e2e8f0')
    .stroke();
  yRef.y += 4;

  for (const p of pos.slice(0, 40)) {
    ensureSpace(pdf, yRef, 12);
    const lines = Array.isArray(p.lines) ? p.lines.length : 0;
    pdf
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#0f172a')
      .text(String(p.po_number || p.id), MARGIN, yRef.y, { width: 120 })
      .text(String(p.order_date || '—').slice(0, 10), MARGIN + 120, yRef.y, {
        width: 70,
      })
      .text(String(p.status || '—'), MARGIN + 190, yRef.y, { width: 80 })
      .text(
        Number(p.total_amount || 0).toLocaleString('en-ZA'),
        MARGIN + 280,
        yRef.y,
        { width: 80, align: 'right' }
      )
      .text(String(lines), MARGIN + 370, yRef.y, {
        width: 50,
        align: 'right',
      });
    yRef.y += 12;
  }
  if (pos.length > 40) {
    ensureSpace(pdf, yRef, 12);
    pdf
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#64748b')
      .text(`… and ${pos.length - 40} more POs (see JSON pack)`, MARGIN, yRef.y);
    yRef.y += 14;
  }

  h2(pdf, yRef, 'Deliveries');
  for (const d of dels.slice(0, 25)) {
    ensureSpace(pdf, yRef, 12);
    const meta = (d.metadata || {}) as Record<string, unknown>;
    const pod = meta.has_pod_photo ? 'POD✓' : 'no POD';
    pdf
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#0f172a')
      .text(
        `${d.delivery_number || d.id} · ${d.status} · due ${String(d.expected_date || '—').slice(0, 10)} · ${pod}${d.otif === true ? ' · OTIF✓' : d.otif === false ? ' · late' : ''}`,
        MARGIN,
        yRef.y,
        { width: CONTENT_W }
      );
    yRef.y = pdf.y + 2;
  }
  if (dels.length > 25) {
    ensureSpace(pdf, yRef, 12);
    pdf
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#64748b')
      .text(`… and ${dels.length - 25} more deliveries`, MARGIN, yRef.y);
    yRef.y += 14;
  }

  h2(pdf, yRef, 'Kitchen GRNs');
  let cleanGrn = 0;
  let dirtyGrn = 0;
  for (const r of recs) {
    if (r.compliance_ok === false) dirtyGrn += 1;
    else cleanGrn += 1;
  }
  kvGrid(pdf, yRef, [
    { label: 'Clean (approved brands)', value: String(cleanGrn) },
    { label: 'Off-catalogue flags', value: String(dirtyGrn) },
  ]);

  h2(pdf, yRef, 'Claims');
  if (!claims.length) {
    ensureSpace(pdf, yRef, 12);
    pdf
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text('No claim packs in this extract.', MARGIN, yRef.y);
    yRef.y += 14;
  } else {
    for (const c of claims.slice(0, 15)) {
      ensureSpace(pdf, yRef, 12);
      pdf
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#0f172a')
        .text(
          `#${c.id} · ${c.status} · ${c.period_from}→${c.period_to} · R ${Number(c.claim_amount || 0).toLocaleString('en-ZA')} · brand ${c.approved_brand_pct ?? '—'}%`,
          MARGIN,
          yRef.y,
          { width: CONTENT_W }
        );
      yRef.y = pdf.y + 2;
    }
  }

  ensureSpace(pdf, yRef, 40);
  yRef.y += 8;
  pdf
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text(
      'This PDF is a human-readable seal of the audit pack. Full line-level evidence is in the companion JSON export (same content hash). Policy: PO + DN + photo POD + approved GRN (+ feed days for claim).',
      MARGIN,
      yRef.y,
      { width: CONTENT_W }
    );

  footer(pdf, generated, hash);
  pdf.end();
  return done;
}
