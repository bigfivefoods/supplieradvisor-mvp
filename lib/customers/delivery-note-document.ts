/**
 * Printable delivery-note HTML. Same sheet, brand bar and footer as tax invoices,
 * with quantities and units only — no prices, totals, VAT or bank details.
 */
import { formatQty, type PublicDeliveryNote } from '@/lib/customers/delivery-note';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br/>');
}

export function renderDeliveryNoteHtml(note: PublicDeliveryNote): string {
  const sellerName = note.sellerName || 'Seller';
  const initial = esc((sellerName.trim()[0] || 'S').toUpperCase());
  const logo = note.logoUrl
    ? `<img class="logo" src="${esc(note.logoUrl)}" alt="${esc(sellerName)} logo" />`
    : `<div class="logo-fallback" aria-hidden="true">${initial}</div>`;
  const lines = note.lines
    .map((line, i) => {
      const partial = line.deliveredQty + 0.0001 < line.invoicedQty;
      return `<tr>
        <td class="idx">${i + 1}</td>
        <td>
          <div class="item-name">${esc(line.name)}</div>
          ${line.sku ? `<div class="sku">${esc(line.sku)}</div>` : ''}
        </td>
        <td class="num">${esc(formatQty(line.invoicedQty))}</td>
        <td class="num strong">${esc(formatQty(line.deliveredQty))}${
          partial ? ' <span class="partial">partial</span>' : ''
        }</td>
        <td class="num">${esc(line.uom || 'unit')}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Delivery note ${esc(note.number)} · ${esc(sellerName)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    :root {
      --brand: #00b4d8;
      --brand-deep: #0077b6;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --soft: #f8fafc;
    }
    * { box-sizing: border-box; }
    html { background: #eef2f7; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
      color: var(--ink);
      margin: 0;
      padding: 12px 10px 28px;
      background: #eef2f7;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      max-width: 100%;
      margin: 0 auto;
      background: #fff;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
      border: 1px solid #e8eef5;
      display: flex;
      flex-direction: column;
    }
    .topbar { height: 5px; background: linear-gradient(90deg, var(--brand), var(--brand-deep), #48cae4); }
    .pad { padding: 14mm 14mm 8mm; flex: 1; }
    .hero { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .logo { max-height: 56px; max-width: 180px; object-fit: contain; display: block; margin-bottom: 10px; }
    .logo-fallback {
      width: 48px; height: 48px; border-radius: 12px;
      background: linear-gradient(145deg, #00b4d8, #0077b6);
      color: #fff; font-weight: 900; font-size: 20px;
      display: flex; align-items: center; justify-content: center; margin-bottom: 10px;
    }
    .doc-type {
      font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--brand-deep); margin-bottom: 4px;
    }
    h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.03em; }
    .muted { color: var(--muted); font-size: 12px; line-height: 1.45; }
    .seller-block { text-align: right; min-width: 180px; max-width: 48%; }
    .seller-block .name { font-weight: 800; font-size: 14px; }
    .banner {
      margin: 14px 0;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 12px;
      color: #0e7490;
      font-weight: 600;
    }
    .parties { display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; margin-bottom: 14px; }
    .card { background: var(--soft); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
    .card-label {
      font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--muted); margin-bottom: 6px;
    }
    .who { font-weight: 800; font-size: 15px; }
    table.meta { width: 100%; font-size: 12px; border-collapse: collapse; }
    table.meta td { padding: 3px 0; vertical-align: top; }
    table.meta td:first-child { color: var(--muted); width: 42%; }
    table.lines { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.lines th {
      text-align: left; border-bottom: 1.5px solid var(--ink); padding: 8px 6px;
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);
    }
    table.lines td { border-bottom: 1px solid var(--line); padding: 10px 6px; vertical-align: top; }
    .idx { color: var(--muted); width: 28px; }
    .item-name { font-weight: 650; }
    .sku { font-size: 11px; color: var(--muted); }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .strong { font-weight: 800; }
    .partial { color: #b45309; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .sign {
      margin-top: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }
    .sign .box { border: 1px dashed #94a3b8; border-radius: 12px; min-height: 88px; padding: 10px; }
    .sign .lbl { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
    .sign .val { margin-top: 18px; font-size: 14px; border-bottom: 1px solid var(--ink); min-height: 22px; }
    .section { margin-top: 12px; }
    .section h3 {
      margin: 0 0 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--brand-deep);
    }
    .section p { margin: 0; font-size: 12px; line-height: 1.45; color: #334155; }
    .powered {
      margin-top: auto;
      padding: 12px 14mm;
      background: #0f172a;
      color: #94a3b8;
      text-align: center;
      font-size: 11px;
    }
    .powered strong { color: #fff; }
    .powered .reg { color: var(--brand); font-weight: 800; }
    @media (max-width: 640px) {
      body { padding: 0; background: #fff; }
      .sheet { width: 100%; min-height: 0; border: none; box-shadow: none; border-radius: 0; }
      .pad { padding: 18px 14px 12px; }
      .parties, .sign { grid-template-columns: 1fr; }
      .seller-block { text-align: left; max-width: none; }
      h1 { font-size: 22px; }
      table.lines { font-size: 14px; }
    }
    @media print {
      html, body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border: none; width: 100%; min-height: 0; }
    }
  </style>
</head>
<body>
  <article class="sheet">
    <div class="topbar"></div>
    <div class="pad">
      <div class="hero">
        <div>
          ${logo}
          <div class="doc-type">Delivery note</div>
          <h1>${esc(note.number)}</h1>
          <div class="muted">${note.partial ? 'Partial delivery' : 'Delivery'} · quantities and units only</div>
        </div>
        <div class="seller-block">
          <div class="name">${esc(sellerName)}</div>
          ${note.sellerAddress ? `<div class="muted">${esc(note.sellerAddress)}</div>` : ''}
          ${note.sellerEmail ? `<div class="muted">${esc(note.sellerEmail)}</div>` : ''}
          ${note.sellerPhone ? `<div class="muted">${esc(note.sellerPhone)}</div>` : ''}
        </div>
      </div>
      <div class="banner">This delivery note is not a tax invoice. It shows goods delivered, with no prices.</div>
      <div class="parties">
        <div class="card">
          <div class="card-label">Deliver to</div>
          <div class="who">${esc(note.customerName)}</div>
          ${note.contactName ? `<div class="muted">${esc(note.contactName)}</div>` : ''}
          ${note.contactPhone ? `<div class="muted">${esc(note.contactPhone)}</div>` : ''}
          ${note.deliveryAddress ? `<div class="muted">${nl2br(note.deliveryAddress)}</div>` : ''}
        </div>
        <div class="card">
          <div class="card-label">Delivery</div>
          <table class="meta">
            <tr><td>Date</td><td><strong>${esc(note.deliveryDate || '—')}</strong></td></tr>
            <tr><td>Invoice ref</td><td><strong>${esc(note.invoiceNumber)}</strong></td></tr>
            <tr><td>Delivered by</td><td>${esc(note.deliveredBy || '—')}</td></tr>
            <tr><td>Vehicle / reg</td><td>${esc(note.vehicleReg || '—')}</td></tr>
          </table>
        </div>
      </div>
      <table class="lines">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th class="num">Invoiced</th>
            <th class="num">Delivered</th>
            <th class="num">Unit</th>
          </tr>
        </thead>
        <tbody>${lines || '<tr><td colspan="5" class="muted">No lines</td></tr>'}</tbody>
      </table>
      ${
        note.notes
          ? `<div class="section"><h3>Notes</h3><p>${nl2br(note.notes)}</p></div>`
          : ''
      }
      <div class="sign">
        <div class="box">
          <div class="lbl">Received by</div>
          <div class="val">${esc(note.receivedByName || '')}</div>
        </div>
        <div class="box">
          <div class="lbl">Signature</div>
          <div class="val"></div>
        </div>
        <div class="box">
          <div class="lbl">Date</div>
          <div class="val">${esc(note.receivedByDate || '')}</div>
        </div>
      </div>
    </div>
    <footer class="powered">
      <div><strong>Powered by <span class="reg">SupplierAdvisor®</span></strong></div>
      <div>Delivery note · quantities only</div>
    </footer>
  </article>
</body>
</html>`;
}
