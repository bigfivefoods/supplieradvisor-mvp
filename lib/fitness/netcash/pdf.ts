import PDFDocument from 'pdfkit';
import { formatZar } from '@/lib/fitness/netcash/money';
import type { BillingLine, BillingRun, Mandate } from '@/lib/fitness/netcash/types';

const INK = '#0f172a';
const CYAN = '#00b4d8';

function bufferFrom(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function renderMandatePdf(input: {
  gymName: string;
  mandate: Pick<
    Mandate,
    | 'memberName'
    | 'accountHolder'
    | 'bankName'
    | 'branchCode'
    | 'accountType'
    | 'accountLast4'
    | 'debitDay'
    | 'amountCents'
    | 'consentText'
    | 'signedAt'
    | 'signedIp'
    | 'status'
    | 'netcashRef'
  >;
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const done = bufferFrom(doc);
  doc.rect(0, 0, doc.page.width, 72).fill(CYAN);
  doc.fillColor(INK).fontSize(18).text('GymAdvisor® debit order mandate', 48, 28);
  doc.fillColor(INK).fontSize(11).text(input.gymName, 48, 92);
  doc.moveDown();
  doc.fontSize(10);
  const rows: Array<[string, string]> = [
    ['Member', input.mandate.memberName],
    ['Account holder', input.mandate.accountHolder],
    ['Bank', input.mandate.bankName],
    ['Branch', input.mandate.branchCode],
    ['Account type', input.mandate.accountType],
    ['Account', input.mandate.accountLast4 ? `•••• ${input.mandate.accountLast4}` : ''],
    ['Debit day', String(input.mandate.debitDay)],
    ['Signed amount', formatZar(input.mandate.amountCents)],
    ['Status', input.mandate.status],
    ['Reference', input.mandate.netcashRef],
    ['Signed', input.mandate.signedAt || 'Not signed'],
    ['IP', input.mandate.signedIp || ''],
  ];
  for (const [label, value] of rows) {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value || '—');
  }
  doc.moveDown();
  doc.font('Helvetica-Bold').text('Consent');
  doc.font('Helvetica').text(input.mandate.consentText, { width: 500 });
  doc.moveDown();
  doc.fontSize(8).fillColor('#64748b').text('SupplierAdvisor® · GymAdvisor® · Netcash test mode does not move money.');
  doc.end();
  return done;
}

export async function renderStatementPdf(input: {
  gymName: string;
  memberName: string;
  lines: BillingLine[];
  runs: BillingRun[];
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const done = bufferFrom(doc);
  doc.rect(0, 0, doc.page.width, 72).fill(CYAN);
  doc.fillColor(INK).fontSize(18).text('Member statement', 48, 28);
  doc.fillColor(INK).fontSize(11).text(`${input.gymName} · ${input.memberName}`, 48, 96);
  doc.moveDown();
  const byRun = new Map(input.runs.map((run) => [run.id, run]));
  doc.fontSize(9);
  for (const line of input.lines) {
    const run = byRun.get(line.runId);
    doc.font('Helvetica-Bold').text(`${line.invoiceNumber || 'Draft'} · ${formatZar(line.totalCents)} · ${line.collectionStatus}`);
    doc.font('Helvetica').text(`${line.description}${run ? ` · debit ${run.actionDate}` : ''}${line.netcashReasonText ? ` · ${line.netcashReasonText}` : ''}`);
    if (line.creditNoteNumber) doc.text(`Credit note ${line.creditNoteNumber}`);
    doc.moveDown(0.4);
  }
  if (!input.lines.length) doc.text('No debit order invoices yet.');
  doc.moveDown();
  doc.fontSize(8).fillColor('#64748b').text('SupplierAdvisor® · GymAdvisor®');
  doc.end();
  return done;
}
