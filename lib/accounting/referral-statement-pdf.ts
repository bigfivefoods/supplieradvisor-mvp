/**
 * Partner commission statement. No bank details.
 */
import PDFDocument from 'pdfkit';
import { formatMoney } from '@/lib/accounting/types';
import type { PartnerCommissionStatement } from '@/lib/accounting/referral-commission';

function zar(amount: number): string {
  return formatMoney(amount, 'ZAR', { compact: false });
}

function methodLabel(method: string): string {
  if (method === 'offset') return 'Offset';
  if (method === 'credit') return 'Credit note';
  return 'Paid out';
}

export async function buildReferralStatementPdf(opts: {
  statement: PartnerCommissionStatement;
  periodLabel: string;
}): Promise<Buffer> {
  const row = opts.statement;
  const rule =
    row.basis === 'incl_vat'
      ? `${row.rate_pct}% of sales including VAT`
      : `${row.rate_pct}% of sales excluding VAT`;
  const when = row.earn_on === 'invoiced' ? 'when invoiced' : 'when the customer pays';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text('Referral commission statement');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#334155').text(`${row.seller_name} · ${row.partner_name}`);
    doc.text(`${opts.periodLabel}. ${rule}, earned ${when}.`);
    doc.moveDown(0.8);
    doc.fillColor('#0f172a').fontSize(10);
    doc.text(`Sales in period: ${zar(row.period_sales)}`);
    doc.text(`Commission earned: ${zar(row.period_commission)}`);
    doc.text(`Redeemed in period: ${zar(row.period_redeemed)}`);
    doc.text(`Still owing at period end: ${zar(row.owing_at_end)}`);
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(12).text('Earned');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9);
    if (!row.lines.length) doc.text('Nothing earned in this period.');
    for (const line of row.lines) {
      doc.text(
        `${line.earned_on}  ${line.invoice_number}  ${line.customer_name}  sales ${zar(line.sales_amount)}  commission ${zar(line.commission)}`
      );
    }
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(12).text('Redeemed');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9);
    if (!row.redemptions.length) doc.text('Nothing redeemed in this period.');
    for (const item of row.redemptions) {
      doc.text(
        `${item.redeemed_on}  ${methodLabel(item.method)}  ${item.reference || ''}  ${zar(item.amount)}`
      );
    }
    doc.end();
  });
}
