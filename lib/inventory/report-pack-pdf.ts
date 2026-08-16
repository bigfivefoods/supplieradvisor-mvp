/**
 * One-page landscape inventory metrics PDF.
 * Pure pdfkit — Vercel serverless safe. Never calls addPage.
 */
import PDFDocument from 'pdfkit';
import type { InventoryReportPack } from '@/lib/inventory/report-types';

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MX = 22;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const EMERALD = '#047857';
const AMBER = '#b45309';
const SKY = '#0369a1';
const SLATE = '#334155';

type PdfDoc = InstanceType<typeof PDFDocument>;

function money(n: number, currency = 'ZAR'): string {
  const abs = Math.abs(Number(n) || 0);
  const sign = n < 0 ? '-' : '';
  try {
    return `${sign}${new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(abs)}`;
  } catch {
    return `${sign}${currency} ${abs.toFixed(0)}`;
  }
}

function qty(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}k`;
  return `${sign}${Math.round(abs).toLocaleString('en-ZA')}`;
}

export async function buildInventoryReportPdf(
  pack: InventoryReportPack
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
      info: {
        Title: `Inventory report — ${pack.companyName}`,
        Author: 'SupplierAdvisor',
        Subject: 'Inventory metrics one-pager',
        CreationDate: new Date(),
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, pack);
    drawKpis(doc, pack, 46);
    drawLocationBars(doc, pack, MX, 118, 400, 168);
    drawTypeMix(doc, pack, MX + 412, 118, 396, 168);
    drawSkuTable(doc, pack, MX, 300, 400, 248);
    drawAlerts(doc, pack, MX + 412, 300, 396, 248);
    drawFooter(doc, pack);
    doc.end();
  });
}

function drawHeader(doc: PdfDoc, pack: InventoryReportPack) {
  doc.rect(0, 0, PAGE_W, 38).fill(BRAND_DEEP);
  doc.rect(0, 38, PAGE_W, 3).fill(BRAND);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13);
  doc.text(pack.companyName, MX, 10, { width: 420, ellipsis: true });
  doc.font('Helvetica').fontSize(8).fillColor('#bae6fd');
  doc.text('INVENTORY REPORT  ·  Live stock metrics', MX, 24);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff');
  doc.text('As at ' + pack.asOf.slice(0, 10), PAGE_W - MX - 220, 10, {
    width: 220,
    align: 'right',
  });
  doc.font('Helvetica').fontSize(8).fillColor('#bae6fd');
  doc.text(`${pack.currency}  ·  Warehouse + container + in transit`, PAGE_W - MX - 280, 24, {
    width: 280,
    align: 'right',
  });
}

function drawKpis(doc: PdfDoc, pack: InventoryReportPack, y: number) {
  const s = pack.summary;
  const items = [
    { label: 'Units on hand', value: qty(s.unitsOnHand), sub: `${qty(s.unitsAvailable)} available` },
    { label: 'Value at cost', value: money(s.valueAtCost, pack.currency), sub: `Sell ${money(s.valueAtSell, pack.currency)}` },
    { label: 'SKUs with stock', value: String(s.skusWithStock), sub: `${s.productsActive} active in catalog` },
    {
      label: 'Low stock',
      value: String(s.lowStockSkus),
      sub: `${s.outOfStockSkus} at zero`,
      warn: s.lowStockSkus > 0,
    },
    {
      label: 'Network units',
      value: qty(s.networkUnits),
      sub: `${qty(s.unitsInTransit)} in transit · ${qty(s.containerUnits)} outlet`,
    },
  ];
  const gap = 8;
  const w = (PAGE_W - MX * 2 - gap * 4) / 5;
  items.forEach((it, i) => {
    const x = MX + i * (w + gap);
    doc.roundedRect(x, y, w, 60, 6).fill('#f8fafc');
    doc.roundedRect(x, y, w, 60, 6).strokeColor(LINE).lineWidth(0.6).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(MUTED);
    doc.text(it.label.toUpperCase(), x + 8, y + 8, { width: w - 16 });
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(it.warn ? AMBER : INK);
    doc.text(it.value, x + 8, y + 24, { width: w - 16 });
    doc.font('Helvetica').fontSize(7).fillColor(MUTED);
    doc.text(it.sub, x + 8, y + 42, { width: w - 16 });
  });
}

function panel(doc: PdfDoc, x: number, y: number, w: number, h: number, title: string) {
  doc.roundedRect(x, y, w, h, 6).fill('#ffffff');
  doc.roundedRect(x, y, w, h, 6).strokeColor(LINE).lineWidth(0.7).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK);
  doc.text(title, x + 10, y + 8, { width: w - 20 });
}

function drawLocationBars(
  doc: PdfDoc,
  pack: InventoryReportPack,
  x: number,
  y: number,
  w: number,
  h: number
) {
  panel(doc, x, y, w, h, 'Units by location');
  const rows = pack.locations.filter((l) => l.units > 0).slice(0, 7);
  if (!rows.length) {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text('No on-hand stock at any location.', x + 12, y + 36);
    return;
  }
  const max = Math.max(1, ...rows.map((r) => r.units));
  const labelW = 118;
  const amtW = 48;
  const barMax = w - 28 - labelW - amtW;
  rows.forEach((r, i) => {
    const ry = y + 28 + i * 18;
    doc.font('Helvetica').fontSize(7).fillColor(SLATE);
    doc.text(r.name, x + 10, ry + 2, { width: labelW - 4, ellipsis: true });
    const bw = (r.units / max) * barMax;
    doc.roundedRect(x + 10 + labelW, ry + 2, Math.max(2, bw), 9, 2).fill('#67e8f9');
    doc.font('Helvetica-Bold').fontSize(7).fillColor(INK);
    doc.text(qty(r.units), x + w - 10 - amtW, ry + 2, { width: amtW, align: 'right' });
  });
}

function drawTypeMix(
  doc: PdfDoc,
  pack: InventoryReportPack,
  x: number,
  y: number,
  w: number,
  h: number
) {
  panel(doc, x, y, w, h, 'Mix  ·  cover  ·  30-day movement');
  const s = pack.summary;
  const mix = pack.typeMix.filter((t) => t.units > 0 || t.value_cost > 0);
  const totalU = Math.max(1, mix.reduce((n, t) => n + t.units, 0));
  const barY = y + 30;
  const barW = w - 24;
  let cx = x + 12;
  const colors = ['#0369a1', '#047857', '#64748b'];
  mix.forEach((t, i) => {
    const seg = (t.units / totalU) * barW;
    if (seg > 0.5) doc.rect(cx, barY, seg, 12).fill(colors[i % colors.length]);
    cx += seg;
  });
  doc.roundedRect(x + 12, barY, barW, 12, 2).strokeColor(LINE).lineWidth(0.4).stroke();
  mix.forEach((t, i) => {
    doc.circle(x + 14 + i * 122, barY + 22, 3).fill(colors[i % colors.length]);
    doc.font('Helvetica').fontSize(7).fillColor(SLATE);
    doc.text(`${t.label}  ${qty(t.units)}`, x + 20 + i * 122, barY + 18, {
      width: 116,
    });
  });

  const facts: Array<[string, string]> = [
    ['Cover (days)', s.coverDays != null ? String(Math.round(s.coverDays)) : 'n/a — no issues in 30d'],
    ['Issues last 30d', qty(s.issues30d)],
    ['Receive / transfer / adj', `${qty(pack.movements30d.receive)} / ${qty(pack.movements30d.transfer)} / ${qty(pack.movements30d.adjustment)}`],
    ['Lots expiring 30d', String(s.lotsExpiring30)],
    ['Lots expired', String(s.lotsExpired)],
    ['Open transfers', String(s.openTransfers)],
  ];
  facts.forEach((f, i) => {
    const fy = y + 78 + i * 14;
    doc.font('Helvetica').fontSize(7.5).fillColor(SLATE);
    doc.text(f[0], x + 12, fy, { width: 140 });
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INK);
    doc.text(f[1], x + 150, fy, { width: w - 164, align: 'right' });
  });
}

function drawSkuTable(
  doc: PdfDoc,
  pack: InventoryReportPack,
  x: number,
  y: number,
  w: number,
  h: number
) {
  panel(doc, x, y, w, h, 'Highest-value SKUs (at cost)');
  const rows = pack.topSkus.slice(0, 9);
  if (!rows.length) {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text('No stocked SKUs.', x + 12, y + 36);
    return;
  }
  const cols = [x + 10, x + 168, x + 248, x + 312];
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED);
  doc.text('SKU / name', cols[0], y + 24);
  doc.text('Qty', cols[1], y + 24, { width: 70, align: 'right' });
  doc.text('Cost value', cols[2], y + 24, { width: 70, align: 'right' });
  doc.text('Low', cols[3], y + 24, { width: 70, align: 'right' });
  rows.forEach((r, i) => {
    const ry = y + 38 + i * 22;
    if (ry + 18 > y + h - 8) return;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(INK);
    doc.text(r.name, cols[0], ry, { width: 150, ellipsis: true });
    doc.font('Helvetica').fontSize(6.5).fillColor(MUTED);
    doc.text(r.sku || '', cols[0], ry + 9, { width: 150, ellipsis: true });
    doc.font('Helvetica').fontSize(7).fillColor(SLATE);
    doc.text(qty(r.qty), cols[1], ry, { width: 70, align: 'right' });
    doc.text(money(r.value_cost, pack.currency), cols[2], ry, {
      width: 70,
      align: 'right',
    });
    doc.fillColor(r.is_low ? AMBER : EMERALD);
    doc.text(r.is_low ? 'Yes' : '—', cols[3], ry, { width: 70, align: 'right' });
  });
}

function drawAlerts(
  doc: PdfDoc,
  pack: InventoryReportPack,
  x: number,
  y: number,
  w: number,
  h: number
) {
  panel(doc, x, y, w, h, 'Exceptions  ·  low stock and dated lots');
  doc.font('Helvetica-Bold').fontSize(7).fillColor(AMBER);
  doc.text('LOW STOCK', x + 10, y + 24);
  const lows = pack.lowStock.slice(0, 5);
  if (!lows.length) {
    doc.font('Helvetica').fontSize(7.5).fillColor(EMERALD);
    doc.text('No SKUs at or below reorder.', x + 10, y + 38);
  } else {
    lows.forEach((r, i) => {
      const ry = y + 36 + i * 16;
      doc.font('Helvetica').fontSize(7).fillColor(SLATE);
      doc.text(r.name, x + 10, ry, { width: 200, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(7).fillColor(AMBER);
      doc.text(`${qty(r.qty)} / ${qty(r.reorder_level)}`, x + w - 110, ry, {
        width: 96,
        align: 'right',
      });
    });
  }

  const lotTop = y + 128;
  doc.font('Helvetica-Bold').fontSize(7).fillColor(AMBER);
  doc.text('EXPIRING / EXPIRED LOTS (30d)', x + 10, lotTop);
  const lots = pack.expiringLots.slice(0, 5);
  if (!lots.length) {
    doc.font('Helvetica').fontSize(7.5).fillColor(EMERALD);
    doc.text('No lots expiring in the next 30 days.', x + 10, lotTop + 14);
  } else {
    lots.forEach((l, i) => {
      const ry = lotTop + 14 + i * 16;
      doc.font('Helvetica').fontSize(7).fillColor(SLATE);
      doc.text(
        `${l.lot_number}  ${l.product_name || ''}`.trim(),
        x + 10,
        ry,
        { width: 220, ellipsis: true }
      );
      doc.font('Helvetica-Bold').fontSize(7).fillColor(l.expired ? '#b91c1c' : AMBER);
      doc.text(
        l.expired ? `Expired ${l.expiry_date}` : `${l.days}d  ${l.expiry_date}`,
        x + w - 130,
        ry,
        { width: 116, align: 'right' }
      );
    });
  }
}

function drawFooter(doc: PdfDoc, pack: InventoryReportPack) {
  const y = PAGE_H - 20;
  doc.moveTo(MX, y - 4).lineTo(PAGE_W - MX, y - 4).strokeColor(LINE).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(6).fillColor(MUTED);
  doc.text(
    `Inventory snapshot ${pack.asOf.slice(0, 16).replace('T', ' ')} UTC. Units from stock levels; value uses product cost / sell. Cover = on-hand / average daily issues (30d). SupplierAdvisor Inventory.`,
    MX,
    y,
    { width: PAGE_W - MX * 2 }
  );
}
