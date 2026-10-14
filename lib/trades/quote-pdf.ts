/**
 * Branded quote PDF. Server-only.
 */
import PDFDocument from 'pdfkit';
import { formatZar, quoteTotals, type TradeCustomer, type TradeQuote, type TradeSettings } from './tradegraph';

const CYAN = '#00b4d8';

export function buildQuotePdf(input: {
  settings: TradeSettings;
  customer: TradeCustomer;
  quote: TradeQuote;
}): Promise<Buffer> {
  const totals = quoteTotals(input.quote.lines, input.settings.vat_rate);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.rect(0, 0, doc.page.width, 18).fill(CYAN);
    doc.fillColor('#0f172a').fontSize(12).text('TradeAdvisor®', 48, 36);
    doc.fontSize(22).text(input.settings.brand_name || 'Quote', 48, 54);
    doc.fontSize(10).fillColor('#334155').text(`${input.settings.city} · ${input.settings.phone}`, 48, 84);
    doc.fontSize(14).fillColor('#0f172a').text(`${input.quote.number} · ${input.quote.title}`, 48, 120);
    doc.fontSize(11).text(input.customer.name, 48, 144);
    doc.fontSize(10).fillColor('#64748b').text(
      [input.customer.address, input.customer.suburb, input.customer.city].filter(Boolean).join(', '),
      48,
      162
    );
    let y = 200;
    for (const line of input.quote.lines) {
      doc.fillColor('#0f172a').fontSize(10).text(line.description, 48, y, { width: 320 });
      doc.text(String(line.qty), 380, y, { width: 40, align: 'right' });
      doc.text(formatZar(Math.round(line.qty * line.unit_cents)), 430, y, { width: 110, align: 'right' });
      y += 22;
      if (y > 700) {
        doc.addPage();
        y = 48;
      }
    }
    y += 12;
    doc.fontSize(11).text(`${formatZar(totals.subtotal_cents)} ex VAT`, 48, y);
    y += 16;
    doc.text(`VAT 15%  ${formatZar(totals.vat_cents)}`, 48, y);
    y += 18;
    doc.fontSize(14).text(`${formatZar(totals.total_cents)} incl VAT`, 48, y);
    doc.fontSize(8).fillColor('#64748b').text('Prepared in TradeAdvisor® on SupplierAdvisor®.', 48, 760, { width: 500 });
    doc.end();
  });
}
