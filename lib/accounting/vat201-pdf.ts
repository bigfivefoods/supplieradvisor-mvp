/**
 * VAT201 pack PDF. Server-only — do not import from a client component.
 */
import PDFDocument from 'pdfkit';
import type { Vat201Report } from '@/lib/accounting/vat201-model';
import { basisLabel } from '@/lib/accounting/vat201-model';

const BRAND = '#00b4d8';

function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}R ${Math.abs(value).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function buildVat201Pdf(report: Vat201Report): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const writeHeader = () => {
      doc.rect(0, 0, doc.page.width, 46).fill(BRAND);
      doc.fillColor('#ffffff').fontSize(13).text('SupplierAdvisor®  VAT201', 42, 16, { lineBreak: false });
      doc.fillColor('#0f172a');
      doc.y = 62;
    };
    writeHeader();
    doc.fontSize(11).text(report.companyName);
    doc.fontSize(9).fillColor('#475569');
    doc.text(`VAT ${report.settings.vatNumber} · ${basisLabel(report.settings.basis)} · Category ${report.settings.category}`);
    doc.text(`${report.period.label} (${report.period.start} to ${report.period.end}) · due ${report.period.dueOn} · ${report.status}`);
    doc.moveDown(0.6);
    doc.fillColor('#0f172a').fontSize(10);
    doc.text(`Output tax ${money(report.totals.outputTax)}    Input tax ${money(report.totals.inputTax)}    ${report.totals.refundable > 0 ? `Refund ${money(report.totals.refundable)}` : `Payable ${money(report.totals.payable)}`}`);
    doc.moveDown(0.4);
    doc.fontSize(8).fillColor('#64748b').text(report.basisNote);
    doc.moveDown(0.6);
    doc.fillColor('#0f172a').fontSize(11).text('VAT201 fields');
    doc.moveDown(0.3);
    doc.fontSize(8);
    for (const field of report.fields) {
      if (doc.y > 760) {
        doc.addPage();
        writeHeader();
        doc.fontSize(8).fillColor('#0f172a');
      }
      doc.fillColor('#64748b').text(field.code, 42, doc.y, { width: 28, continued: false, lineBreak: false });
      doc.fillColor('#0f172a').text(field.label, 72, doc.y, { width: 360 });
      const valueY = doc.y - 10;
      doc.text(field.copy, 450, valueY, { width: 100, align: 'right' });
    }
    doc.moveDown(0.8);
    doc.fontSize(11).text('Reconciliation to 1150 and 2120');
    doc.moveDown(0.3);
    doc.fontSize(8);
    for (const line of report.reconciliation) {
      if (doc.y > 760) {
        doc.addPage();
        writeHeader();
        doc.fontSize(8);
      }
      const flag = line.flagged ? 'FLAGGED' : line.includedInControl ? 'OK' : 'Info';
      doc.fillColor(line.flagged ? '#b45309' : '#0f172a');
      doc.text(
        `${line.code} ${line.name} · ledger ${money(line.ledgerMovement)} · return ${line.returnAmount == null ? '—' : money(line.returnAmount)} · ${flag}`
      );
      doc.fillColor('#64748b').text(line.note);
    }
    doc.moveDown(0.8);
    doc.fillColor('#0f172a').fontSize(11).text(`Missing tax invoices (${report.missingTaxInvoices.length})`);
    doc.fontSize(8).fillColor('#475569');
    if (!report.missingTaxInvoices.length) doc.text('None in this period.');
    for (const gap of report.missingTaxInvoices) {
      if (doc.y > 760) {
        doc.addPage();
        writeHeader();
        doc.fontSize(8);
      }
      doc.fillColor('#0f172a').text(`${gap.reference} · ${gap.counterparty} · ${money(gap.inclusive)} · ${gap.threshold}`);
      doc.fillColor('#64748b').text(gap.missing.join(', '));
    }
    doc.moveDown(1);
    doc.fontSize(8).fillColor('#64748b').text(
      'SupplierAdvisor® prepared this pack from the posted ledger. It is not a submission to SARS. Copy each field into eFiling, or file the paper VAT201. Do not store a SARS username or password here.'
    );
    doc.end();
  });
}
