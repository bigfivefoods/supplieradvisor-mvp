/**
 * Customer statement PDF. Server-only — do not import from client components.
 */
import PDFDocument from 'pdfkit';
import { formatZar, type CustomerPortal } from './tradegraph';

const CYAN = '#00b4d8';

export function buildStatementPdf(portal: CustomerPortal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 18).fill(CYAN);
    doc.fillColor('#0f172a').fontSize(20).text('Statement', 48, 40);
    doc.fontSize(11).fillColor('#334155').text(portal.brand.brand_name || 'TradeAdvisor®', 48, 68);
    doc.text(portal.customer.name, 48, 84);
    doc.fontSize(9).fillColor('#64748b').text(
      [portal.customer.address, portal.customer.suburb, portal.customer.city]
        .filter(Boolean)
        .join(', '),
      48,
      100
    );

    let y = 140;
    doc.fillColor('#0f172a').fontSize(12).text('Quotes', 48, y);
    y += 18;
    if (!portal.quotes.length) {
      doc.fontSize(10).fillColor('#64748b').text('No quotes shared yet.', 48, y);
      y += 18;
    }
    for (const quote of portal.quotes) {
      const total = quote.lines.reduce(
        (sum, line) => sum + Math.round(line.qty * line.unit_cents),
        0
      );
      doc.fontSize(10).fillColor('#0f172a').text(
        `${quote.number}  ${quote.title}  ${quote.status}  ${formatZar(total)} ex VAT`,
        48,
        y,
        { width: 500 }
      );
      y += 16;
    }

    y += 10;
    doc.fontSize(12).fillColor('#0f172a').text('Invoices', 48, y);
    y += 18;
    for (const invoice of portal.invoices) {
      doc.fontSize(10).text(
        `${invoice.number}  ${invoice.status}  ${formatZar(invoice.total_cents)} incl VAT`,
        48,
        y
      );
      y += 16;
    }
    if (!portal.invoices.length) {
      doc.fontSize(10).fillColor('#64748b').text('No invoices yet.', 48, y);
      y += 16;
    }

    y += 10;
    doc.fillColor('#0f172a').fontSize(12).text('Payments', 48, y);
    y += 18;
    for (const payment of portal.payments) {
      doc.fontSize(10).text(
        `${payment.paid_at.slice(0, 10)}  ${payment.method}  ${formatZar(payment.amount_cents)}`,
        48,
        y
      );
      y += 16;
    }

    y += 16;
    doc.rect(48, y, 500, 36).fill('#f0fdff');
    doc.fillColor('#0f172a').fontSize(13).text(
      `Balance  ${formatZar(portal.balance_cents)}`,
      60,
      y + 10
    );

    doc.fontSize(8).fillColor('#64748b').text(
      'Prepared in TradeAdvisor® on SupplierAdvisor®. This statement is for the named customer only.',
      48,
      760,
      { width: 500 }
    );
    doc.end();
  });
}
