/**
 * Signed credit application as a PDF. The seller copy includes the account number.
 */
import PDFDocument from 'pdfkit';
import { formatMoney } from '@/lib/accounting/types';
import {
  creditDocumentLabel,
  CREDIT_DECLARATION,
  type CreditApplication,
} from '@/lib/customers/credit-application';

export async function buildCreditApplicationPdf(opts: {
  sellerName: string;
  application: CreditApplication;
}): Promise<Buffer> {
  const app = opts.application;
  const money = (amount: number | null) =>
    formatMoney(amount, app.currency || 'ZAR', { compact: false });
  const lines: Array<[string, string]> = [
    ['Status', app.status],
    ['Legal name', app.legal_name],
    ['Trading name', app.trading_name],
    ['Registration', app.registration_number],
    ['VAT', app.vat_number],
    ['Industry', app.industry],
    ['Years trading', app.years_trading != null ? String(app.years_trading) : ''],
    ['Billing address', app.billing_address],
    ['Contact', app.contact_name],
    ['Email', app.contact_email],
    ['Phone', app.contact_phone],
    ['Requested limit', money(app.requested_limit)],
    ['Payment terms', app.payment_terms],
    ['Expected monthly', app.expected_monthly != null ? money(app.expected_monthly) : ''],
    ['Bank', app.bank_name],
    ['Account name', app.bank_account_name],
    ['Branch code', app.bank_branch_code],
    ['Account number', app.bank_account_number],
    ['Signatory', [app.signatory_name, app.signatory_title].filter(Boolean).join(', ')],
    ['Declaration', app.declaration_accepted ? 'Accepted' : 'Not accepted'],
  ];
  if (app.status === 'approved') {
    lines.push(['Approved limit', money(app.approved_limit)]);
    lines.push(['Approved terms', app.approved_terms || '']);
  }
  if (app.decision_notes) lines.push(['Decision', app.decision_notes]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text('Trade credit application', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#334155').text(opts.sellerName || 'Seller');
    doc.moveDown(0.8);
    doc.fillColor('#0f172a').fontSize(10);
    for (const [label, value] of lines) {
      doc.font('Helvetica-Bold').text(label, { continued: false });
      doc.font('Helvetica').text(value || '—');
      doc.moveDown(0.35);
    }
    if (app.trade_references.length) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(12).text('Trade references');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10);
      for (const ref of app.trade_references) {
        doc.text(
          [ref.company, ref.contact, ref.phone, ref.email].filter(Boolean).join(' · ') || '—'
        );
      }
    }
    if (app.supporting_documents.length) {
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(12).text('Documents on file');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10);
      for (const file of app.supporting_documents) {
        doc.text(`${creditDocumentLabel(file.kind)} — ${file.name}`);
      }
    }
    doc.moveDown(0.8);
    doc.fontSize(9).fillColor('#475569').text(CREDIT_DECLARATION);
    doc.end();
  });
}
