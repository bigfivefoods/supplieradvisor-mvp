/**
 * Customer AR statement PDF — open invoices + recent ledger payments.
 */
import PDFDocument from 'pdfkit';

export type StatementLine = {
  invoiceNumber: string;
  status: string;
  dueDate: string | null;
  promiseDate: string | null;
  balance: number;
  currency: string;
  brokenPromise?: boolean;
};

export type StatementPaymentLine = {
  paidAt: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  reference?: string | null;
  method?: string | null;
  amountBase?: number | null;
  baseCurrency?: string | null;
  fxRate?: number | null;
};

export type StatementInput = {
  sellerName: string;
  customerName: string;
  asOf: string;
  lines: StatementLine[];
  openTotal: number;
  currency: string;
  payments?: StatementPaymentLine[];
  paymentsTotal?: number;
  baseCurrency?: string | null;
};

export async function buildArStatementPdf(
  input: StatementInput
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc
      .fontSize(18)
      .fillColor('#0f172a')
      .text('Account statement', { continued: false });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor('#64748b')
      .text(`${input.sellerName} · as of ${input.asOf}`);
    doc.moveDown(0.8);
    doc
      .fontSize(12)
      .fillColor('#0f172a')
      .text(`Customer: ${input.customerName}`);
    doc
      .fontSize(11)
      .text(
        `Open balance: ${input.currency} ${input.openTotal.toLocaleString(
          undefined,
          { maximumFractionDigits: 2 }
        )}`
      );
    if (input.paymentsTotal != null && input.paymentsTotal > 0) {
      doc
        .fontSize(10)
        .fillColor('#047857')
        .text(
          `Payments on statement period: ${input.currency} ${input.paymentsTotal.toLocaleString(
            undefined,
            { maximumFractionDigits: 2 }
          )}`
        );
    }
    doc.moveDown(0.8);

    doc.fontSize(10).fillColor('#0f172a').text('Open invoices', { underline: false });
    doc.moveDown(0.35);

    doc.fontSize(9).fillColor('#94a3b8').text('Invoice', 48, doc.y, {
      continued: true,
      width: 120,
    });
    doc.text('Status', 170, doc.y, { continued: true, width: 70 });
    doc.text('Due', 250, doc.y, { continued: true, width: 70 });
    doc.text('Promise', 330, doc.y, { continued: true, width: 70 });
    doc.text('Balance', 420, doc.y, { width: 100, align: 'right' });
    doc
      .moveTo(48, doc.y + 4)
      .lineTo(547, doc.y + 4)
      .strokeColor('#e2e8f0')
      .stroke();
    doc.moveDown(0.6);

    for (const line of input.lines) {
      if (doc.y > 720) doc.addPage();
      const y = doc.y;
      doc
        .fontSize(9)
        .fillColor(line.brokenPromise ? '#9f1239' : '#0f172a')
        .text(line.invoiceNumber, 48, y, { width: 120 });
      doc.fillColor('#334155').text(line.status, 170, y, { width: 70 });
      doc.text(line.dueDate || '—', 250, y, { width: 70 });
      doc.text(
        line.promiseDate
          ? `${line.promiseDate}${line.brokenPromise ? ' !' : ''}`
          : '—',
        330,
        y,
        { width: 70 }
      );
      doc.text(
        `${line.currency} ${line.balance.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}`,
        420,
        y,
        { width: 100, align: 'right' }
      );
      doc.moveDown(0.55);
    }

    if (input.payments && input.payments.length > 0) {
      doc.moveDown(0.8);
      if (doc.y > 640) doc.addPage();
      doc
        .fontSize(10)
        .fillColor('#0f172a')
        .text('Payment ledger (recent)');
      doc.moveDown(0.35);
      doc.fontSize(9).fillColor('#94a3b8').text('Date', 48, doc.y, {
        continued: true,
        width: 80,
      });
      doc.text('Invoice', 130, doc.y, { continued: true, width: 100 });
      doc.text('Method / ref', 240, doc.y, { continued: true, width: 140 });
      doc.text('Amount', 420, doc.y, { width: 100, align: 'right' });
      doc
        .moveTo(48, doc.y + 4)
        .lineTo(547, doc.y + 4)
        .strokeColor('#e2e8f0')
        .stroke();
      doc.moveDown(0.55);

      for (const p of input.payments) {
        if (doc.y > 720) doc.addPage();
        const y = doc.y;
        doc
          .fontSize(9)
          .fillColor('#0f172a')
          .text(String(p.paidAt).slice(0, 10), 48, y, { width: 80 });
        doc.fillColor('#334155').text(p.invoiceNumber, 130, y, { width: 100 });
        const meta = [p.method, p.reference].filter(Boolean).join(' · ') || '—';
        doc.text(meta, 240, y, { width: 160 });
        let amt = `${p.currency} ${p.amount.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}`;
        if (
          p.amountBase != null &&
          p.baseCurrency &&
          p.baseCurrency !== p.currency
        ) {
          amt += ` (~${p.baseCurrency} ${Number(p.amountBase).toLocaleString(
            undefined,
            { maximumFractionDigits: 2 }
          )})`;
        }
        doc.text(amt, 400, y, { width: 120, align: 'right' });
        doc.moveDown(0.55);
      }
    }

    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(
        'Generated by SupplierAdvisor® · ledger payments are first-class AR rows (not notes-only)',
        { align: 'left' }
      );

    doc.end();
  });
}
