import { centsToRands } from '@/lib/fitness/netcash/money';
import type { BillingLine, InvoiceLineDraft } from '@/lib/fitness/netcash/types';

export type InvoiceIssue = {
  companyId: number;
  number: string;
  memberName: string;
  email: string;
  phone: string;
  crmCustomerId: number | null;
  issueDate: string;
  dueDate: string;
  netCents: number;
  vatCents: number;
  totalCents: number;
  vatBps: number;
  items: InvoiceLineDraft[];
  notes: string;
  kind: 'invoice' | 'credit_note';
  originalNumber?: string;
};

export type InvoicePort = {
  issue(input: InvoiceIssue): Promise<{ ok: true; invoiceId: number | null } | { ok: false; error: string }>;
  markPaid(input: {
    companyId: number;
    invoiceId: number | null;
    number: string;
    totalCents: number;
    reference: string;
    paidAt: string;
  }): Promise<{ ok: boolean; error?: string }>;
};

export function memoryInvoices(): InvoicePort & { rows: InvoiceIssue[]; payments: string[] } {
  const rows: InvoiceIssue[] = [];
  const payments: string[] = [];
  return {
    rows,
    payments,
    async issue(input) {
      rows.push(input);
      return { ok: true, invoiceId: rows.length };
    },
    async markPaid(input) {
      payments.push(input.number);
      return { ok: true };
    },
  };
}

export function invoiceFromLine(line: BillingLine, input: { number: string; issueDate: string; dueDate: string; vatBps: number; kind?: 'invoice' | 'credit_note'; originalNumber?: string }): InvoiceIssue {
  return {
    companyId: line.companyId,
    number: input.number,
    memberName: line.memberName,
    email: line.memberEmail,
    phone: line.memberPhone,
    crmCustomerId: line.crmCustomerId,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    netCents: line.netCents,
    vatCents: line.vatCents,
    totalCents: line.totalCents,
    vatBps: input.vatBps,
    items: line.items,
    notes: 'GymAdvisor® debit order invoice',
    kind: input.kind || 'invoice',
    originalNumber: input.originalNumber,
  };
}

export function documentNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

export function lineItemsForBooks(items: InvoiceLineDraft[]) {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: centsToRands(item.unitCents),
    amount: centsToRands(item.amountCents),
    tax_rate: item.taxBps / 100,
    account_code: item.accountCode,
  }));
}
