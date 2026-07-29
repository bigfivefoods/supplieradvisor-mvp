/**
 * NSNP delivery documents — printable DN, GRN, and PO/DN/GRN matching report.
 * Pure pdfkit for Vercel serverless.
 */
import PDFDocument from 'pdfkit';
import {
  QTY_VARIANCE_AMBER_PCT,
  qtyVariance,
  type QtyVariance,
  type QtyVarianceTone,
} from '@/lib/schools/deliveries';
import type { PoParty } from '@/lib/schools/po-document';

export type DocParty = PoParty;

export type DeliveryDocLine = {
  product_name: string;
  brand_name?: string | null;
  qty_ordered?: number | null;
  qty_delivered?: number | null;
  qty_received?: number | null;
  uom?: string | null;
  approved?: boolean | null;
  other_item?: boolean | null;
  approved_product_id?: number | null;
};

export type MatchException = {
  code: string;
  severity: 'amber' | 'red' | 'info';
  line_index?: number;
  product_name?: string;
  message: string;
};

export type MatchLine = {
  product_name: string;
  brand_name: string;
  uom: string;
  qty_ordered: number;
  qty_delivered: number;
  qty_received: number;
  variance_delivered: QtyVariance;
  variance_received: QtyVariance;
  /** Worst of delivered vs ordered and received vs ordered */
  match_status: 'perfect' | 'amber' | 'red' | 'pending';
  off_catalogue: boolean;
  exceptions: string[];
};

export type MatchingReport = {
  delivery_number: string;
  po_id?: number | null;
  status: string;
  lines: MatchLine[];
  summary: {
    lines_total: number;
    perfect: number;
    amber: number;
    red: number;
    pending: number;
    short_delivered: number;
    over_delivered: number;
    short_received: number;
    over_received: number;
    off_catalogue: number;
    overall_tone: QtyVarianceTone;
    clean: boolean;
  };
  exceptions: MatchException[];
  meta: {
    has_pod: boolean;
    grn_id?: number | null;
    otif?: boolean | null;
    expected_date?: string | null;
    delivered_at?: string | null;
    received_at?: string | null;
    vehicle_reg?: string | null;
    driver_name?: string | null;
  };
};

export type DeliveryDocumentInput = {
  kind: 'dn' | 'grn' | 'match';
  delivery_number: string;
  status: string;
  po_id?: number | null;
  po_number?: string | null;
  expected_date?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  received_at?: string | null;
  vehicle_reg?: string | null;
  driver_name?: string | null;
  notes_isp?: string | null;
  notes_school?: string | null;
  grn_receipt_id?: number | null;
  grn_number?: string | null;
  school: DocParty;
  isp: DocParty;
  agency_name?: string | null;
  lines: DeliveryDocLine[];
  matching?: MatchingReport;
  has_pod?: boolean;
  otif?: boolean | null;
  generated_at?: string;
};

function plain(s: unknown): string {
  return String(s ?? '').trim();
}

function partyLines(p: DocParty): string[] {
  const displayName =
    plain(p.name) ||
    plain(p.trading_name) ||
    plain(p.legal_name) ||
    '—';
  const out: string[] = [displayName];
  if (p.legal_name && plain(p.legal_name) !== displayName) {
    out.push(`Legal: ${plain(p.legal_name)}`);
  } else if (
    p.trading_name &&
    plain(p.trading_name) !== displayName &&
    plain(p.trading_name)
  ) {
    out.push(`t/a ${plain(p.trading_name)}`);
  }
  if (p.kind === 'school' || p.natemis || p.emis_number) {
    if (p.natemis) out.push(`NATEMIS: ${plain(p.natemis)}`);
    if (p.emis_number && plain(p.emis_number) !== plain(p.natemis || '')) {
      out.push(`EMIS: ${plain(p.emis_number)}`);
    }
  }
  if (p.kind === 'isp' || p.csd_number) {
    out.push(
      p.csd_number ? `CSD NUMBER: ${plain(p.csd_number)}` : 'CSD NUMBER: —'
    );
  }
  const loc = [p.district, p.province].filter(Boolean).map(plain).join(', ');
  if (loc) out.push(loc);
  if (p.address) out.push(plain(p.address));
  if (p.contact_name) out.push(`Contact: ${plain(p.contact_name)}`);
  if (p.contact_phone) out.push(`Tel: ${plain(p.contact_phone)}`);
  if (p.contact_email) out.push(`Email: ${plain(p.contact_email)}`);
  return out;
}

function dateStr(v?: string | null): string {
  if (!v) return '—';
  return String(v).replace('T', ' ').slice(0, 16);
}

function toneRank(t: QtyVarianceTone): number {
  if (t === 'red') return 3;
  if (t === 'amber') return 2;
  if (t === 'green') return 1;
  return 0;
}

function worseTone(a: QtyVarianceTone, b: QtyVarianceTone): QtyVarianceTone {
  return toneRank(a) >= toneRank(b) ? a : b;
}

/**
 * Build three-way style match: ordered (PO/DN) vs delivered (SP) vs received (school GRN).
 */
export function buildMatchingReport(input: {
  delivery_number: string;
  po_id?: number | null;
  status: string;
  lines: DeliveryDocLine[];
  has_pod?: boolean;
  grn_id?: number | null;
  otif?: boolean | null;
  expected_date?: string | null;
  delivered_at?: string | null;
  received_at?: string | null;
  vehicle_reg?: string | null;
  driver_name?: string | null;
}): MatchingReport {
  const status = String(input.status || 'draft').toLowerCase();
  const receivedDone = status === 'received' || Boolean(input.received_at);
  const exceptions: MatchException[] = [];
  const lines: MatchLine[] = [];

  let perfect = 0;
  let amber = 0;
  let red = 0;
  let short_delivered = 0;
  let over_delivered = 0;
  let short_received = 0;
  let over_received = 0;
  let off_catalogue = 0;
  let overall: QtyVarianceTone = 'neutral';

  (input.lines || []).forEach((raw, i) => {
    const ordered = Number(raw.qty_ordered ?? 0) || 0;
    const delivered = Number(raw.qty_delivered ?? ordered) || 0;
    const received = receivedDone
      ? Number(raw.qty_received ?? delivered) || 0
      : Number(raw.qty_received ?? 0) || 0;
    const off =
      raw.other_item === true ||
      raw.approved === false ||
      !raw.approved_product_id;
    const vDel = qtyVariance(ordered, delivered);
    const vRec = receivedDone
      ? qtyVariance(ordered, received)
      : qtyVariance(ordered, ordered); // neutral placeholder until receive

    const lineEx: string[] = [];
    if (off) {
      off_catalogue += 1;
      lineEx.push('Off-catalogue / other item');
      exceptions.push({
        code: 'OFF_CATALOGUE',
        severity: 'amber',
        line_index: i,
        product_name: String(raw.product_name || ''),
        message: `${raw.product_name || 'Line'}: not on DBE approved list`,
      });
    }
    if (vDel.tone === 'amber' || vDel.tone === 'red') {
      lineEx.push(`SP delivered ${vDel.label}`);
      exceptions.push({
        code: 'QTY_DELIVERED_VARIANCE',
        severity: vDel.tone === 'red' ? 'red' : 'amber',
        line_index: i,
        product_name: String(raw.product_name || ''),
        message: `${raw.product_name || 'Line'}: delivered ${delivered} vs ordered ${ordered} (${vDel.label})`,
      });
      if (vDel.signed_pct < 0) short_delivered += 1;
      else over_delivered += 1;
    }
    if (receivedDone && (vRec.tone === 'amber' || vRec.tone === 'red')) {
      lineEx.push(`School received ${vRec.label}`);
      exceptions.push({
        code: 'QTY_RECEIVED_VARIANCE',
        severity: vRec.tone === 'red' ? 'red' : 'amber',
        line_index: i,
        product_name: String(raw.product_name || ''),
        message: `${raw.product_name || 'Line'}: received ${received} vs ordered ${ordered} (${vRec.label})`,
      });
      if (vRec.signed_pct < 0) short_received += 1;
      else over_received += 1;
    }
    if (
      receivedDone &&
      Math.abs(delivered - received) > 0.001 &&
      ordered > 0
    ) {
      const gap = qtyVariance(delivered, received);
      if (gap.tone !== 'green') {
        lineEx.push(`Received ≠ delivered (${gap.label})`);
        exceptions.push({
          code: 'DN_GRN_MISMATCH',
          severity: gap.tone === 'red' ? 'red' : 'amber',
          line_index: i,
          product_name: String(raw.product_name || ''),
          message: `${raw.product_name || 'Line'}: GRN ${received} vs DN ${delivered} (${gap.label})`,
        });
      }
    }

    // Line status: qty first, then off-catalogue forces at least amber
    // (perfect only when on-catalogue AND qty matches ordered / received)
    let match_status: MatchLine['match_status'] = 'perfect';
    if (receivedDone) {
      const worst = worseTone(vDel.tone, vRec.tone);
      if (worst === 'red') match_status = 'red';
      else if (worst === 'amber') match_status = 'amber';
      else match_status = 'perfect';
    } else {
      // Pre-receive: score on delivered vs ordered (not "pending" when exact)
      if (vDel.tone === 'red') match_status = 'red';
      else if (vDel.tone === 'amber') match_status = 'amber';
      else match_status = 'perfect';
    }
    if (off && match_status === 'perfect') {
      match_status = 'amber';
    }

    if (match_status === 'red') {
      red += 1;
      overall = worseTone(overall, 'red');
    } else if (match_status === 'amber') {
      amber += 1;
      overall = worseTone(overall, 'amber');
    } else {
      perfect += 1;
      overall = worseTone(overall, 'green');
    }

    lines.push({
      product_name: String(raw.product_name || 'Product'),
      brand_name: String(raw.brand_name || ''),
      uom: String(raw.uom || 'kg'),
      qty_ordered: ordered,
      qty_delivered: delivered,
      qty_received: receivedDone ? received : 0,
      variance_delivered: vDel,
      variance_received: receivedDone
        ? vRec
        : {
            ordered,
            actual: 0,
            variance_pct: 0,
            signed_pct: 0,
            tone: 'neutral',
            label: 'Awaiting receive',
          },
      match_status,
      off_catalogue: off,
      exceptions: lineEx,
    });
  });

  // Header-level exceptions (do not inflate line perfect/amber chips)
  if (!input.has_pod) {
    exceptions.push({
      code: 'POD_MISSING',
      severity: status === 'received' || status === 'delivered' ? 'amber' : 'info',
      message: 'No proof of delivery (POD) photo/file attached yet',
    });
  }
  if (status === 'disputed') {
    exceptions.push({
      code: 'DISPUTED',
      severity: 'red',
      message: 'Delivery is disputed by the school',
    });
    overall = 'red';
  }
  if (input.otif === false) {
    exceptions.push({
      code: 'LATE',
      severity: 'amber',
      message: 'Marked not on-time (OTIF flag)',
    });
    overall = worseTone(overall, 'amber');
  }
  if (
    input.expected_date &&
    input.delivered_at &&
    String(input.delivered_at).slice(0, 10) >
      String(input.expected_date).slice(0, 10)
  ) {
    exceptions.push({
      code: 'LATE_VS_EXPECTED',
      severity: 'amber',
      message: `Delivered ${String(input.delivered_at).slice(0, 10)} after expected ${String(input.expected_date).slice(0, 10)}`,
    });
    overall = worseTone(overall, 'amber');
  }
  if (receivedDone && !input.grn_id) {
    exceptions.push({
      code: 'GRN_MISSING',
      severity: 'amber',
      message: 'Received but no kitchen GRN receipt id linked',
    });
  }

  const lines_total = lines.length;
  if (overall === 'neutral' && lines_total > 0) overall = 'green';

  // Clean only if every line is perfect (on-catalogue + qty match) and not disputed
  const qtyClean =
    red === 0 && amber === 0 && off_catalogue === 0 && status !== 'disputed';

  return {
    delivery_number: input.delivery_number,
    po_id: input.po_id ?? null,
    status,
    lines,
    summary: {
      lines_total,
      // Count perfect as soon as DN qtys match ordered (not only after school receive)
      perfect,
      amber,
      red,
      pending: receivedDone ? 0 : 0,
      short_delivered,
      over_delivered,
      short_received,
      over_received,
      off_catalogue,
      overall_tone: overall === 'neutral' ? 'green' : overall,
      clean: qtyClean,
    },
    exceptions: exceptions.sort((a, b) => {
      const rank = { red: 0, amber: 1, info: 2 } as const;
      return rank[a.severity] - rank[b.severity];
    }),
    meta: {
      has_pod: Boolean(input.has_pod),
      grn_id: input.grn_id ?? null,
      otif: input.otif ?? null,
      expected_date: input.expected_date ?? null,
      delivered_at: input.delivered_at ?? null,
      received_at: input.received_at ?? null,
      vehicle_reg: input.vehicle_reg ?? null,
      driver_name: input.driver_name ?? null,
    },
  };
}

export function deliveryDocFilename(
  kind: 'dn' | 'grn' | 'match',
  deliveryNumber: string
): string {
  const safe = String(deliveryNumber || 'DN')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
  const prefix =
    kind === 'dn' ? 'DN' : kind === 'grn' ? 'GRN' : 'MATCH';
  return `${prefix}-${safe}.pdf`;
}

// ── Shared PDF helpers ───────────────────────────────────────────────────

type PdfDoc = InstanceType<typeof PDFDocument>;

const PAGE_W = 595.28;
/** A4 height in points */
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
/** Reserve bottom band for footer so body never collides */
const FOOTER_BAND = 36;
/** Max Y for body content (above footer) */
const CONTENT_BOTTOM = PAGE_H - FOOTER_BAND;
/** Absolute footer baseline on each page */
const FOOTER_Y = PAGE_H - 20;

function startPdf(title: string, subject: string): {
  pdf: PdfDoc;
  done: Promise<Buffer>;
} {
  const pdf = new PDFDocument({
    size: 'A4',
    // Leave bottom free for absolute footer (avoids auto page-break into page 2)
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

function drawBrandBar(pdf: PdfDoc, color = '#0077b6') {
  pdf.rect(0, 0, PAGE_W, 8).fill(color);
}

function drawPartyBoxes(
  pdf: PdfDoc,
  school: DocParty,
  isp: DocParty,
  y: number
): number {
  const colW = (CONTENT_W - 12) / 2;
  const partyBox = (title: string, p: DocParty, x: number, top: number) => {
    const body = partyLines({
      ...p,
      kind: title.includes('SCHOOL') ? 'school' : 'isp',
    });
    const h = 18 + body.length * 12 + 14;
    pdf.roundedRect(x, top, colW, h, 6).fillAndStroke('#f8fafc', '#e2e8f0');
    pdf
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#64748b')
      .text(title, x + 10, top + 8, { width: colW - 20 });
    let py = top + 22;
    body.forEach((line, i) => {
      pdf
        .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(i === 0 ? 11 : 9)
        .fillColor('#0f172a')
        .text(line, x + 10, py, { width: colW - 20 });
      py = pdf.y + 2;
    });
    return h;
  };
  const h1 = partyBox('SCHOOL', { ...school, kind: 'school' }, MARGIN, y);
  const h2 = partyBox(
    'SERVICE PROVIDER',
    { ...isp, kind: 'isp' },
    MARGIN + colW + 12,
    y
  );
  return y + Math.max(h1, h2) + 12;
}

function ensureSpace(
  pdf: PdfDoc,
  yRef: { y: number },
  need: number,
  onNewPage?: () => void
) {
  // Stay above footer band so content + footer share one page when short enough
  if (yRef.y + need > CONTENT_BOTTOM - 8) {
    pdf.addPage();
    drawBrandBar(pdf);
    yRef.y = MARGIN + 8;
    onNewPage?.();
  }
}

/**
 * Draw footer on every page at a fixed bottom Y.
 * Temporarily clears bottom margin so PDFKit does not auto-add a blank page 2.
 */
function footer(pdf: PdfDoc, generated: string) {
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
        `Supplier Advisor · NSNP · ${generated} · page ${i + 1}/${total}`,
        MARGIN,
        FOOTER_Y,
        {
          width: CONTENT_W,
          align: 'center',
          lineBreak: false,
          // absolute position — do not advance document flow
        }
      );
    pdf.page.margins.bottom = savedBottom;
  }
}

/** Delivery note — SP prints for school hard copy */
export async function buildDeliveryNotePdf(
  doc: DeliveryDocumentInput
): Promise<Buffer> {
  const { pdf, done } = startPdf(
    `NSNP DN ${doc.delivery_number}`,
    'Delivery note — service provider to school'
  );
  const generated =
    doc.generated_at || new Date().toISOString().replace('T', ' ').slice(0, 19);

  drawBrandBar(pdf, '#0284c7');
  let y = MARGIN + 12;

  pdf
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#0284c7')
    .text('NSNP · DELIVERY NOTE', MARGIN, y, { width: CONTENT_W });
  y = pdf.y + 4;

  pdf
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#0f172a')
    .text(plain(doc.delivery_number) || 'DN', MARGIN, y, {
      width: CONTENT_W * 0.55,
    });

  const metaX = MARGIN + CONTENT_W * 0.55;
  let metaY = y;
  const metaLine = (label: string, value: string) => {
    pdf
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(label, metaX, metaY, { width: 90 });
    pdf
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#0f172a')
      .text(value || '—', metaX + 90, metaY, { width: CONTENT_W * 0.45 - 90 });
    metaY += 14;
  };
  metaLine('Status', plain(doc.status));
  metaLine('PO', doc.po_number || (doc.po_id ? `#${doc.po_id}` : '—'));
  metaLine('Expected', dateStr(doc.expected_date).slice(0, 10));
  metaLine('Dispatched', dateStr(doc.dispatched_at));
  metaLine('Driver', plain(doc.driver_name) || '—');
  metaLine('Vehicle', plain(doc.vehicle_reg) || '—');

  y = Math.max(pdf.y, metaY) + 8;
  if (doc.agency_name) {
    pdf
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(`Programme: ${plain(doc.agency_name)}`, MARGIN, y);
    y = pdf.y + 6;
  }

  y = drawPartyBoxes(pdf, doc.school, doc.isp, y);

  // Table: product | ordered | delivering | uom
  const cols = {
    num: MARGIN,
    product: MARGIN + 22,
    ordered: MARGIN + CONTENT_W - 170,
    deliver: MARGIN + CONTENT_W - 100,
    uom: MARGIN + CONTENT_W - 40,
  };
  const drawHeader = () => {
    pdf.rect(MARGIN, y, CONTENT_W, 18).fill('#0c4a6e');
    pdf.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    pdf.text('#', cols.num + 4, y + 5, { width: 16 });
    pdf.text('PRODUCT', cols.product, y + 5, {
      width: cols.ordered - cols.product - 4,
    });
    pdf.text('ORDERED', cols.ordered, y + 5, { width: 55, align: 'right' });
    pdf.text('DELIVERING', cols.deliver, y + 5, { width: 55, align: 'right' });
    pdf.text('UOM', cols.uom, y + 5, { width: 36 });
    y += 22;
  };
  drawHeader();

  const yRef = { y };
  const lines = doc.lines || [];
  lines.forEach((l, i) => {
    const name = plain(l.product_name) || 'Product';
    const brand = plain(l.brand_name);
    const ordered = Number(l.qty_ordered ?? 0);
    const delivered = Number(l.qty_delivered ?? ordered);
    const v = qtyVariance(ordered, delivered);
    const rowH = brand ? 30 : 18;
    ensureSpace(pdf, yRef, rowH + 4, () => {
      y = yRef.y;
      drawHeader();
      yRef.y = y;
    });
    y = yRef.y;

    const bg =
      v.tone === 'red'
        ? '#fff1f2'
        : v.tone === 'amber'
          ? '#fffbeb'
          : i % 2 === 0
            ? '#f8fafc'
            : '#ffffff';
    pdf.rect(MARGIN, y - 2, CONTENT_W, rowH).fill(bg);
    pdf.font('Helvetica').fontSize(9).fillColor('#0f172a');
    pdf.text(String(i + 1), cols.num + 4, y, { width: 16 });
    pdf.font('Helvetica-Bold').text(name, cols.product, y, {
      width: cols.ordered - cols.product - 6,
    });
    if (brand) {
      pdf
        .font('Helvetica')
        .fontSize(8)
        .fillColor(l.other_item || l.approved === false ? '#b45309' : '#047857')
        .text(brand, cols.product, y + 12, {
          width: cols.ordered - cols.product - 6,
        });
    }
    pdf.font('Helvetica').fontSize(9).fillColor('#0f172a');
    pdf.text(String(ordered), cols.ordered, y, { width: 55, align: 'right' });
    pdf
      .font('Helvetica-Bold')
      .fillColor(
        v.tone === 'red' ? '#be123c' : v.tone === 'amber' ? '#b45309' : '#0f172a'
      )
      .text(String(delivered), cols.deliver, y, { width: 55, align: 'right' });
    pdf
      .font('Helvetica')
      .fillColor('#0f172a')
      .text(plain(l.uom) || 'kg', cols.uom, y, { width: 36 });
    y += rowH;
    yRef.y = y;
  });

  y = yRef.y + 10;
  ensureSpace(pdf, yRef, 80);
  y = yRef.y;

  pdf
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#64748b')
    .text(
      `Variance: green = exact · amber ≤ ${QTY_VARIANCE_AMBER_PCT}% · red > ${QTY_VARIANCE_AMBER_PCT}%. Highlighted rows need attention.`,
      MARGIN,
      y,
      { width: CONTENT_W }
    );
  y = pdf.y + 10;

  if (doc.notes_isp) {
    pdf
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0f172a')
      .text('SP notes', MARGIN, y);
    y = pdf.y + 2;
    pdf
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#334155')
      .text(plain(doc.notes_isp), MARGIN, y, { width: CONTENT_W });
    y = pdf.y + 10;
  }

  // Sign-off
  ensureSpace(pdf, { y }, 70);
  y = Math.max(y, pdf.y) + 8;
  pdf
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#0f172a')
    .text('Sign-off (hard copy)', MARGIN, y);
  y = pdf.y + 14;
  const sigW = (CONTENT_W - 16) / 2;
  pdf
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text('SP driver / representative', MARGIN, y)
    .text('School receiver', MARGIN + sigW + 16, y);
  y += 28;
  pdf
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + sigW - 10, y)
    .strokeColor('#94a3b8')
    .stroke();
  pdf
    .moveTo(MARGIN + sigW + 16, y)
    .lineTo(MARGIN + CONTENT_W, y)
    .stroke();
  y += 6;
  pdf
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94a3b8')
    .text('Name / signature / date', MARGIN, y)
    .text('Name / signature / date', MARGIN + sigW + 16, y);

  footer(pdf, generated);
  pdf.end();
  return done;
}

/** Goods received note — school prints for SP / kitchen file */
export async function buildGrnPdf(doc: DeliveryDocumentInput): Promise<Buffer> {
  const grnNo =
    plain(doc.grn_number) ||
    (doc.grn_receipt_id
      ? `GRN-${doc.delivery_number || doc.grn_receipt_id}`
      : `GRN-${doc.delivery_number || 'draft'}`);

  const { pdf, done } = startPdf(
    `NSNP ${grnNo}`,
    'Goods received note — school kitchen'
  );
  const generated =
    doc.generated_at || new Date().toISOString().replace('T', ' ').slice(0, 19);

  drawBrandBar(pdf, '#059669');
  let y = MARGIN + 12;

  pdf
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#059669')
    .text('NSNP · GOODS RECEIVED NOTE (GRN)', MARGIN, y);
  y = pdf.y + 4;

  pdf
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#0f172a')
    .text(grnNo, MARGIN, y, { width: CONTENT_W * 0.55 });

  const metaX = MARGIN + CONTENT_W * 0.55;
  let metaY = y;
  const metaLine = (label: string, value: string) => {
    pdf
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(label, metaX, metaY, { width: 90 });
    pdf
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#0f172a')
      .text(value || '—', metaX + 90, metaY, { width: CONTENT_W * 0.45 - 90 });
    metaY += 14;
  };
  metaLine('DN', plain(doc.delivery_number));
  metaLine('PO', doc.po_number || (doc.po_id ? `#${doc.po_id}` : '—'));
  metaLine('Received', dateStr(doc.received_at));
  metaLine('Status', plain(doc.status));
  metaLine('Driver', plain(doc.driver_name) || '—');
  metaLine('Vehicle', plain(doc.vehicle_reg) || '—');

  y = Math.max(pdf.y, metaY) + 8;
  if (doc.agency_name) {
    pdf
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(`Programme: ${plain(doc.agency_name)}`, MARGIN, y);
    y = pdf.y + 6;
  }

  y = drawPartyBoxes(pdf, doc.school, doc.isp, y);

  const cols = {
    num: MARGIN,
    product: MARGIN + 22,
    ordered: MARGIN + CONTENT_W - 200,
    deliver: MARGIN + CONTENT_W - 140,
    recv: MARGIN + CONTENT_W - 75,
    uom: MARGIN + CONTENT_W - 30,
  };
  const drawHeader = () => {
    pdf.rect(MARGIN, y, CONTENT_W, 18).fill('#064e3b');
    pdf.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff');
    pdf.text('#', cols.num + 4, y + 5, { width: 16 });
    pdf.text('PRODUCT', cols.product, y + 5, {
      width: cols.ordered - cols.product - 4,
    });
    pdf.text('ORDERED', cols.ordered, y + 5, { width: 50, align: 'right' });
    pdf.text('DN QTY', cols.deliver, y + 5, { width: 50, align: 'right' });
    pdf.text('RECEIVED', cols.recv, y + 5, { width: 50, align: 'right' });
    pdf.text('UOM', cols.uom, y + 5, { width: 28 });
    y += 22;
  };
  drawHeader();

  const yRef = { y };
  (doc.lines || []).forEach((l, i) => {
    const name = plain(l.product_name) || 'Product';
    const brand = plain(l.brand_name);
    const ordered = Number(l.qty_ordered ?? 0);
    const delivered = Number(l.qty_delivered ?? ordered);
    const received = Number(l.qty_received ?? delivered);
    const v = qtyVariance(ordered, received);
    const rowH = brand ? 30 : 18;
    ensureSpace(pdf, yRef, rowH + 4, () => {
      y = yRef.y;
      drawHeader();
      yRef.y = y;
    });
    y = yRef.y;
    const bg =
      v.tone === 'red'
        ? '#fff1f2'
        : v.tone === 'amber'
          ? '#fffbeb'
          : i % 2 === 0
            ? '#f0fdf4'
            : '#ffffff';
    pdf.rect(MARGIN, y - 2, CONTENT_W, rowH).fill(bg);
    pdf.font('Helvetica').fontSize(9).fillColor('#0f172a');
    pdf.text(String(i + 1), cols.num + 4, y, { width: 16 });
    pdf.font('Helvetica-Bold').text(name, cols.product, y, {
      width: cols.ordered - cols.product - 6,
    });
    if (brand) {
      pdf
        .font('Helvetica')
        .fontSize(8)
        .fillColor(l.other_item || l.approved === false ? '#b45309' : '#047857')
        .text(brand, cols.product, y + 12, {
          width: cols.ordered - cols.product - 6,
        });
    }
    pdf.font('Helvetica').fontSize(9).fillColor('#0f172a');
    pdf.text(String(ordered), cols.ordered, y, { width: 50, align: 'right' });
    pdf.text(String(delivered), cols.deliver, y, { width: 50, align: 'right' });
    pdf
      .font('Helvetica-Bold')
      .fillColor(
        v.tone === 'red' ? '#be123c' : v.tone === 'amber' ? '#b45309' : '#065f46'
      )
      .text(String(received), cols.recv, y, { width: 50, align: 'right' });
    pdf
      .font('Helvetica')
      .fillColor('#0f172a')
      .text(plain(l.uom) || 'kg', cols.uom, y, { width: 28 });
    y += rowH;
    yRef.y = y;
  });

  y = yRef.y + 10;
  if (doc.notes_school) {
    pdf
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0f172a')
      .text('School notes', MARGIN, y);
    y = pdf.y + 2;
    pdf
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#334155')
      .text(plain(doc.notes_school), MARGIN, y, { width: CONTENT_W });
    y = pdf.y + 10;
  }

  ensureSpace(pdf, { y }, 60);
  y = Math.max(y, pdf.y) + 8;
  pdf
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#64748b')
    .text(
      'This GRN confirms goods into school kitchen stock (approved lines). Copy may be given to the service provider.',
      MARGIN,
      y,
      { width: CONTENT_W }
    );
  y = pdf.y + 16;
  const sigW = (CONTENT_W - 16) / 2;
  pdf
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text('School store / kitchen', MARGIN, y)
    .text('SP acknowledgement (optional)', MARGIN + sigW + 16, y);
  y += 28;
  pdf
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + sigW - 10, y)
    .strokeColor('#94a3b8')
    .stroke();
  pdf
    .moveTo(MARGIN + sigW + 16, y)
    .lineTo(MARGIN + CONTENT_W, y)
    .stroke();

  footer(pdf, generated);
  pdf.end();
  return done;
}

/** Matching report with exceptions — school + SP */
export async function buildMatchingReportPdf(
  doc: DeliveryDocumentInput
): Promise<Buffer> {
  const match =
    doc.matching ||
    buildMatchingReport({
      delivery_number: doc.delivery_number,
      po_id: doc.po_id,
      status: doc.status,
      lines: doc.lines,
      has_pod: doc.has_pod,
      grn_id: doc.grn_receipt_id,
      otif: doc.otif,
      expected_date: doc.expected_date,
      delivered_at: doc.delivered_at,
      received_at: doc.received_at,
      vehicle_reg: doc.vehicle_reg,
      driver_name: doc.driver_name,
    });

  const { pdf, done } = startPdf(
    `NSNP Match ${doc.delivery_number}`,
    'PO · DN · GRN matching report with exceptions'
  );
  const generated =
    doc.generated_at || new Date().toISOString().replace('T', ' ').slice(0, 19);

  drawBrandBar(pdf, '#7c3aed');
  let y = MARGIN + 12;

  pdf
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#7c3aed')
    .text('NSNP · MATCHING REPORT (PO · DN · GRN)', MARGIN, y);
  y = pdf.y + 4;

  pdf
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#0f172a')
    .text(plain(doc.delivery_number) || 'DN', MARGIN, y, {
      width: CONTENT_W * 0.5,
    });

  const tone = match.summary.overall_tone;
  const toneLabel =
    tone === 'green'
      ? 'CLEAN MATCH'
      : tone === 'amber'
        ? 'EXCEPTIONS (AMBER)'
        : tone === 'red'
          ? 'EXCEPTIONS (RED)'
          : 'PENDING';
  const toneColor =
    tone === 'green' ? '#047857' : tone === 'amber' ? '#b45309' : '#be123c';

  pdf
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(toneColor)
    .text(toneLabel, MARGIN + CONTENT_W * 0.5, y, {
      width: CONTENT_W * 0.5,
      align: 'right',
    });
  y = Math.max(pdf.y, y + 18) + 6;

  // Summary chips
  const chips = [
    `Lines: ${match.summary.lines_total}`,
    `Perfect: ${match.summary.perfect}`,
    `Amber: ${match.summary.amber}`,
    `Red: ${match.summary.red}`,
    `Off-cat: ${match.summary.off_catalogue}`,
    `POD: ${match.meta.has_pod ? 'yes' : 'no'}`,
    `GRN: ${match.meta.grn_id ? `#${match.meta.grn_id}` : '—'}`,
  ];
  pdf.font('Helvetica').fontSize(9).fillColor('#334155');
  pdf.text(chips.join('  ·  '), MARGIN, y, { width: CONTENT_W });
  y = pdf.y + 8;

  y = drawPartyBoxes(pdf, doc.school, doc.isp, y);

  // Line table
  const cols = {
    num: MARGIN,
    product: MARGIN + 18,
    o: MARGIN + CONTENT_W - 195,
    d: MARGIN + CONTENT_W - 145,
    r: MARGIN + CONTENT_W - 95,
    st: MARGIN + CONTENT_W - 50,
  };
  const drawHeader = () => {
    pdf.rect(MARGIN, y, CONTENT_W, 18).fill('#4c1d95');
    pdf.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff');
    pdf.text('#', cols.num + 2, y + 5, { width: 14 });
    pdf.text('PRODUCT', cols.product, y + 5, {
      width: cols.o - cols.product - 4,
    });
    pdf.text('ORD', cols.o, y + 5, { width: 40, align: 'right' });
    pdf.text('DN', cols.d, y + 5, { width: 40, align: 'right' });
    pdf.text('GRN', cols.r, y + 5, { width: 40, align: 'right' });
    pdf.text('STATUS', cols.st, y + 5, { width: 48 });
    y += 22;
  };
  drawHeader();

  const yRef = { y };
  match.lines.forEach((l, i) => {
    const rowH = l.exceptions.length ? 32 : 18;
    ensureSpace(pdf, yRef, rowH + 4, () => {
      y = yRef.y;
      drawHeader();
      yRef.y = y;
    });
    y = yRef.y;
    const bg =
      l.match_status === 'red'
        ? '#fff1f2'
        : l.match_status === 'amber'
          ? '#fffbeb'
          : l.match_status === 'perfect'
            ? '#ecfdf5'
            : '#f8fafc';
    pdf.rect(MARGIN, y - 2, CONTENT_W, rowH).fill(bg);
    pdf.font('Helvetica').fontSize(8).fillColor('#0f172a');
    pdf.text(String(i + 1), cols.num + 2, y, { width: 14 });
    pdf
      .font('Helvetica-Bold')
      .text(l.product_name, cols.product, y, {
        width: cols.o - cols.product - 4,
      });
    if (l.exceptions.length) {
      pdf
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#9f1239')
        .text(l.exceptions.join('; '), cols.product, y + 12, {
          width: cols.o - cols.product - 4,
        });
    }
    pdf.font('Helvetica').fontSize(8).fillColor('#0f172a');
    pdf.text(String(l.qty_ordered), cols.o, y, { width: 40, align: 'right' });
    pdf.text(String(l.qty_delivered), cols.d, y, { width: 40, align: 'right' });
    pdf.text(
      String(
        doc.status === 'received' || doc.received_at
          ? l.qty_received
          : '—'
      ),
      cols.r,
      y,
      { width: 40, align: 'right' }
    );
    const stColor =
      l.match_status === 'red'
        ? '#be123c'
        : l.match_status === 'amber'
          ? '#b45309'
          : l.match_status === 'perfect'
            ? '#047857'
            : '#64748b';
    pdf
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(stColor)
      .text(l.match_status.toUpperCase(), cols.st, y, { width: 48 });
    y += rowH;
    yRef.y = y;
  });

  y = yRef.y + 12;
  ensureSpace(pdf, yRef, 40);
  y = yRef.y;

  pdf
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#0f172a')
    .text('Exceptions', MARGIN, y);
  y = pdf.y + 6;

  if (!match.exceptions.length) {
    pdf
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#047857')
      .text('No exceptions — quantities and docs align.', MARGIN, y);
  } else {
    match.exceptions.forEach((ex) => {
      ensureSpace(pdf, { y }, 22);
      y = Math.max(y, pdf.y);
      const c =
        ex.severity === 'red'
          ? '#be123c'
          : ex.severity === 'amber'
            ? '#b45309'
            : '#64748b';
      pdf
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(c)
        .text(`[${ex.severity.toUpperCase()}] ${ex.code}`, MARGIN, y, {
          width: CONTENT_W,
        });
      y = pdf.y + 1;
      pdf
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#334155')
        .text(ex.message, MARGIN + 8, y, { width: CONTENT_W - 8 });
      y = pdf.y + 6;
    });
  }

  y = Math.max(y, pdf.y) + 10;
  pdf
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text(
      `Thresholds: exact match = green · ≤${QTY_VARIANCE_AMBER_PCT}% variance = amber · >${QTY_VARIANCE_AMBER_PCT}% = red. Report shared by school and service provider.`,
      MARGIN,
      y,
      { width: CONTENT_W }
    );

  footer(pdf, generated);
  pdf.end();
  return done;
}
