/**
 * Printable NSNP school → SP purchase order HTML.
 */

export type PoParty = {
  name: string;
  trading_name?: string | null;
  emis_number?: string | null;
  district?: string | null;
  province?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  csd_number?: string | null;
};

export type PoLine = {
  product_name?: string | null;
  brand_name?: string | null;
  qty?: number | null;
  unit_price?: number | null;
  uom?: string | null;
  approved_product_id?: number | null;
};

export type PoDocumentInput = {
  po_number: string;
  status: string;
  order_date?: string | null;
  expected_date?: string | null;
  currency?: string | null;
  total_amount?: number | null;
  notes?: string | null;
  compliance_ok?: boolean | null;
  lines: PoLine[];
  school: PoParty;
  isp: PoParty;
  agency_name?: string | null;
  generated_at?: string;
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number, currency = 'ZAR'): string {
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency === 'R' ? 'ZAR' : currency || 'ZAR',
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `R ${n.toFixed(2)}`;
  }
}

function partyBlock(title: string, p: PoParty): string {
  const lines: string[] = [];
  lines.push(`<div class="party-title">${esc(title)}</div>`);
  lines.push(`<div class="party-name">${esc(p.name || '—')}</div>`);
  if (p.trading_name && p.trading_name !== p.name) {
    lines.push(`<div class="muted">t/a ${esc(p.trading_name)}</div>`);
  }
  if (p.emis_number) lines.push(`<div>EMIS: ${esc(p.emis_number)}</div>`);
  if (p.csd_number) lines.push(`<div>CSD: ${esc(p.csd_number)}</div>`);
  if (p.district || p.province) {
    lines.push(
      `<div>${esc([p.district, p.province].filter(Boolean).join(', '))}</div>`
    );
  }
  if (p.address) lines.push(`<div>${esc(p.address)}</div>`);
  if (p.contact_name) lines.push(`<div>Contact: ${esc(p.contact_name)}</div>`);
  if (p.contact_phone) lines.push(`<div>Tel: ${esc(p.contact_phone)}</div>`);
  if (p.contact_email) lines.push(`<div>Email: ${esc(p.contact_email)}</div>`);
  return `<div class="party">${lines.join('')}</div>`;
}

/** Full printable HTML document for a school NSNP PO. */
export function buildSchoolPoHtml(doc: PoDocumentInput): string {
  const currency = doc.currency || 'ZAR';
  const lines = Array.isArray(doc.lines) ? doc.lines : [];
  let subtotal = 0;
  const rows = lines
    .map((l, i) => {
      const qty = Number(l.qty || 0);
      const price = Number(l.unit_price || 0);
      const lineTotal = Math.round(qty * price * 100) / 100;
      subtotal += lineTotal;
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>
          <div class="prod">${esc(l.product_name || 'Product')}</div>
          <div class="brand">${esc(l.brand_name || '')}</div>
        </td>
        <td class="num">${esc(qty)}</td>
        <td>${esc(l.uom || 'kg')}</td>
        <td class="num">${money(price, currency)}</td>
        <td class="num">${money(lineTotal, currency)}</td>
      </tr>`;
    })
    .join('');

  const total =
    doc.total_amount != null && Number.isFinite(Number(doc.total_amount))
      ? Number(doc.total_amount)
      : subtotal;

  const generated =
    doc.generated_at || new Date().toISOString().replace('T', ' ').slice(0, 19);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PO ${esc(doc.po_number)}</title>
  <style>
    :root { --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; --brand: #0077b6; --ok: #047857; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: var(--ink);
      background: #f1f5f9;
      font-size: 13px;
      line-height: 1.4;
    }
    .sheet {
      max-width: 210mm;
      margin: 16px auto;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
    }
    .topbar { height: 6px; background: linear-gradient(90deg, #0077b6, #00b4d8, #10b981); }
    .pad { padding: 20px 22px 24px; }
    .header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    .doc-type { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brand); }
    h1 { margin: 4px 0 0; font-size: 22px; letter-spacing: -0.02em; }
    .meta { text-align: right; font-size: 12px; color: var(--muted); }
    .meta strong { color: var(--ink); }
    .badge {
      display: inline-block;
      margin-top: 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 3px 8px;
      border-radius: 999px;
      background: #f1f5f9;
      border: 1px solid var(--line);
    }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .party {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px 14px;
      background: #f8fafc;
      min-height: 120px;
    }
    .party-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .party-name { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
    .muted { color: var(--muted); font-size: 12px; }
    table.lines {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin: 8px 0 12px;
    }
    table.lines th {
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      border-bottom: 2px solid var(--ink);
      padding: 8px 6px;
    }
    table.lines td {
      border-bottom: 1px solid var(--line);
      padding: 8px 6px;
      vertical-align: top;
    }
    table.lines .num { text-align: right; font-variant-numeric: tabular-nums; }
    .prod { font-weight: 700; }
    .brand { font-size: 11px; color: var(--ok); font-weight: 700; }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    .totals-box {
      min-width: 220px;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-weight: 700;
      font-size: 14px;
    }
    .notes {
      margin-top: 16px;
      border: 1px dashed var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 12px;
    }
    .notes strong { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 4px; }
    .foot {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      font-size: 11px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .sign {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 28px;
    }
    .sign-line {
      border-top: 1px solid var(--ink);
      padding-top: 6px;
      font-size: 11px;
      color: var(--muted);
    }
    .toolbar {
      max-width: 210mm;
      margin: 12px auto 0;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 0 4px;
    }
    .toolbar button {
      border: none;
      border-radius: 999px;
      padding: 8px 14px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-print { background: #0077b6; color: #fff; }
    .btn-close { background: #e2e8f0; color: #0f172a; }
    @media print {
      body { background: #fff; }
      .sheet { margin: 0; border: none; border-radius: 0; box-shadow: none; max-width: none; }
      .toolbar { display: none !important; }
      .topbar { height: 4px; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" class="btn-print" onclick="window.print()">Print PO</button>
    <button type="button" class="btn-close" onclick="window.close()">Close</button>
  </div>
  <div class="sheet">
    <div class="topbar"></div>
    <div class="pad">
      <div class="header">
        <div>
          <div class="doc-type">NSNP · School purchase order</div>
          <h1>${esc(doc.po_number)}</h1>
          ${
            doc.agency_name
              ? `<div class="muted">Programme: ${esc(doc.agency_name)}</div>`
              : ''
          }
          <span class="badge">${esc(doc.status || 'submitted')}</span>
          ${
            doc.compliance_ok !== false
              ? '<span class="badge" style="background:#ecfdf5;border-color:#a7f3d0;color:#047857">Catalogue compliant</span>'
              : ''
          }
        </div>
        <div class="meta">
          <div>Order date: <strong>${esc(String(doc.order_date || '—').slice(0, 10))}</strong></div>
          <div>Required delivery: <strong>${esc(String(doc.expected_date || '—').slice(0, 10))}</strong></div>
          <div>Currency: <strong>${esc(currency)}</strong></div>
        </div>
      </div>

      <div class="parties">
        ${partyBlock('School (buyer)', doc.school)}
        ${partyBlock('Service provider (supplier)', doc.isp)}
      </div>

      <table class="lines">
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Product (approved brand)</th>
            <th class="num">Qty</th>
            <th>UOM</th>
            <th class="num">Unit price</th>
            <th class="num">Line total</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6">No lines</td></tr>'}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="totals-row">
            <span>Total</span>
            <span>${money(total, currency)}</span>
          </div>
        </div>
      </div>

      ${
        doc.notes
          ? `<div class="notes"><strong>Notes</strong>${esc(doc.notes)}</div>`
          : ''
      }

      <div class="sign">
        <div class="sign-line">School authorised signature · date</div>
        <div class="sign-line">SP acknowledgement signature · date</div>
      </div>

      <div class="foot">
        <span>Generated ${esc(generated)} · DBE / PEU approved catalogue only</span>
        <span>SP sources from wholesalers → DN + POD → school GRN → learners fed</span>
      </div>
    </div>
  </div>
  <script>
    (function () {
      try {
        if (new URLSearchParams(location.search).get('autoprint') === '1') {
          window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 300);
          });
        }
      } catch (e) {}
    })();
  </script>
</body>
</html>`;
}
