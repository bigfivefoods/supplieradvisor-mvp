/**
 * Tax / commercial receipt PDF for Core OS + Industry Pack payments.
 * Pure pdfkit — Vercel serverless safe.
 */
import PDFDocument from 'pdfkit';
import type { BillingLedgerEntry } from '@/lib/billing/billing-ledger';
import { getIndustryPack } from '@/lib/product/architecture';

export type ReceiptPdfInput = {
  companyName: string;
  companyId: number;
  billingEmail?: string | null;
  registrationNumber?: string | null;
  entry: BillingLedgerEntry;
  generatedAt?: Date;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 48;
const CONTENT_W = PAGE_W - MX * 2;
const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

export async function buildBillingReceiptPdf(
  input: ReceiptPdfInput
): Promise<Buffer> {
  const generated = input.generatedAt || new Date();
  const e = input.entry;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 48, left: MX, right: MX },
      info: {
        Title: `Receipt ${e.invoiceNumber}`,
        Author: 'SupplierAdvisor®',
        Subject: 'Subscription / Industry Pack payment receipt',
        CreationDate: generated,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header bar
    doc.rect(0, 0, PAGE_W, 64).fill(BRAND_DEEP);
    doc.rect(0, 60, PAGE_W, 4).fill(BRAND);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('SupplierAdvisor®', MX, 22);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#bae6fd')
      .text('Tax invoice / payment receipt', MX, 42);

    let y = 88;
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('Payment receipt', MX, y);
    y += 28;

    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(`Invoice: ${e.invoiceNumber}`, MX, y);
    doc.text(`Date: ${e.at.slice(0, 10)}`, MX + 220, y);
    y += 14;
    doc.text(`Reference: ${e.ref}`, MX, y);
    doc.text(
      `Channel: ${e.channel || 'paystack'}`,
      MX + 220,
      y
    );
    y += 24;

    // Bill to
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(INK)
      .text('Bill to', MX, y);
    y += 14;
    doc.font('Helvetica').fontSize(10);
    doc.text(input.companyName || `Company #${input.companyId}`, MX, y);
    y += 12;
    if (input.billingEmail) {
      doc.fillColor(MUTED).text(input.billingEmail, MX, y);
      y += 12;
    }
    if (input.registrationNumber) {
      doc.text(`Reg: ${input.registrationNumber}`, MX, y);
      y += 12;
    }
    doc.fillColor(MUTED).text(`Company ID: ${input.companyId}`, MX, y);
    y += 20;

    // Line table
    doc.moveTo(MX, y).lineTo(PAGE_W - MX, y).strokeColor(LINE).stroke();
    y += 8;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('Description', MX, y, { width: 280 })
      .text('Qty', MX + 290, y, { width: 40, align: 'right' })
      .text('Amount (ZAR)', MX + 340, y, { width: CONTENT_W - 340, align: 'right' });
    y += 14;
    doc.moveTo(MX, y).lineTo(PAGE_W - MX, y).strokeColor(LINE).stroke();
    y += 10;

    const lines: Array<{ desc: string; amount: number }> = [];
    if (e.kind === 'core' || e.kind === 'core_plus_packs' || e.kind === 'renewal') {
      const term =
        e.months && e.months > 1
          ? `${e.months}-month prepaid Core OS`
          : 'Core OS subscription (monthly)';
      const coreShare =
        e.kind === 'core_plus_packs' && e.packIds?.length
          ? Math.max(
              0,
              e.amountZar -
                (e.packIds.length || 0) *
                  (e.months || 1) *
                  199 *
                  (1 - 0) // display estimate; full amount still totals
            )
          : e.amountZar;
      // Simpler: single line for full amount when core only
      if (e.kind === 'core' || e.kind === 'renewal') {
        lines.push({
          desc: `${term}${e.termId ? ` · ${e.termId}` : ''}`,
          amount: e.amountZar,
        });
      } else {
        lines.push({
          desc: `Core OS · ${e.termId || 'term'}${e.months ? ` · ${e.months} mo` : ''}`,
          amount: Math.round(e.amountZar * 0.6 * 10) / 10, // will fix below
        });
      }
    }

    // Rebuild lines cleanly
    lines.length = 0;
    if (e.kind === 'packs') {
      for (const pid of e.packIds || []) {
        const p = getIndustryPack(pid);
        lines.push({
          desc: `Industry Pack: ${p?.name || pid}${e.months && e.months > 1 ? ` · ${e.months} mo` : ''}`,
          amount: 0, // split equally if multiple
        });
      }
      if (lines.length) {
        const each =
          Math.round((e.amountZar / lines.length) * 100) / 100;
        lines.forEach((l) => {
          l.amount = each;
        });
        // Fix rounding on last
        const sum = lines.reduce((n, l) => n + l.amount, 0);
        if (lines.length && Math.abs(sum - e.amountZar) > 0.01) {
          lines[lines.length - 1].amount +=
            Math.round((e.amountZar - sum) * 100) / 100;
        }
      } else {
        lines.push({ desc: 'Industry Packs', amount: e.amountZar });
      }
    } else if (e.kind === 'core_plus_packs') {
      const packMonthly = (e.packIds || []).length * 199;
      const packList = packMonthly * (e.months || 1);
      // Use discount proportion if total < list
      const packPortion = Math.min(e.amountZar * 0.45, packList);
      const corePortion = Math.round((e.amountZar - packPortion) * 100) / 100;
      lines.push({
        desc: `Core OS · ${e.termId || 'plan'}${e.months ? ` · ${e.months} mo prepaid` : ''}`,
        amount: corePortion,
      });
      for (const pid of e.packIds || []) {
        const p = getIndustryPack(pid);
        const each =
          (e.packIds || []).length > 0
            ? Math.round((packPortion / (e.packIds || []).length) * 100) / 100
            : 0;
        lines.push({
          desc: `Industry Pack: ${p?.name || pid}`,
          amount: each,
        });
      }
      const sum = lines.reduce((n, l) => n + l.amount, 0);
      if (lines.length && Math.abs(sum - e.amountZar) > 0.02) {
        lines[0].amount += Math.round((e.amountZar - sum) * 100) / 100;
      }
    } else {
      lines.push({
        desc: `Core OS subscription${e.termId ? ` · ${e.termId}` : ''}${e.months && e.months > 1 ? ` · ${e.months} months` : ''}`,
        amount: e.amountZar,
      });
    }

    doc.font('Helvetica').fontSize(9).fillColor(INK);
    for (const line of lines) {
      doc.text(line.desc, MX, y, { width: 300 });
      doc.text('1', MX + 290, y, { width: 40, align: 'right' });
      doc.text(line.amount.toFixed(2), MX + 340, y, {
        width: CONTENT_W - 340,
        align: 'right',
      });
      y += 16;
    }

    y += 8;
    doc.moveTo(MX, y).lineTo(PAGE_W - MX, y).strokeColor(LINE).stroke();
    y += 12;
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(INK)
      .text('Total paid', MX, y)
      .text(
        `R ${e.amountZar.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
        MX + 340,
        y,
        { width: CONTENT_W - 340, align: 'right' }
      );
    y += 28;

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        'SupplierAdvisor (Pty) Ltd — B2B supply-chain OS. This receipt confirms payment received via Paystack' +
          (e.channel === 'apple_pay' ? ' (Apple Pay)' : '') +
          '. VAT treatment depends on your tax profile; contact finance@supplieradvisor.com for a formal tax invoice if required.',
        MX,
        y,
        { width: CONTENT_W }
      );
    y += 40;
    doc.text(
      `Generated ${generated.toISOString().slice(0, 19)}Z · supplieradvisor.com`,
      MX,
      y
    );

    doc.end();
  });
}

export function billingReceiptFilename(entry: BillingLedgerEntry): string {
  return `SA-Receipt-${entry.invoiceNumber}.pdf`;
}
