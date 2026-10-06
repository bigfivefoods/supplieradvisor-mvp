/** Referral commission: sales a partner company brought in, and what has been redeemed. */

export type ReferralBasis = 'ex_vat' | 'incl_vat';
export type ReferralEarnOn = 'collected' | 'invoiced';
export type ReferralRedeemMethod = 'paid' | 'offset' | 'credit';

export type ReferralAgreement = {
  seller_profile_id: number;
  seller_name: string;
  partner_profile_id: number;
  partner_name: string;
  rate_pct: number;
  basis: ReferralBasis;
  earn_on: ReferralEarnOn;
  status: string;
  notes?: string | null;
};

export type ReferralInvoice = {
  id: number;
  seller_profile_id: number;
  invoice_number: string;
  customer_id: number | null;
  customer_name: string;
  status: string;
  issue_date: string | null;
  subtotal: number;
  total_amount: number;
  amount_paid: number;
  referral_partner_profile_id: number | null;
};

export type ReferralCustomerLink = {
  id: number;
  referral_partner_profile_id: number | null;
};

export type ReferralPayment = {
  id: number;
  invoice_id: number;
  amount: number;
  paid_at: string;
  reference?: string | null;
};

export type ReferralRedemption = {
  id: number;
  seller_profile_id: number;
  partner_profile_id: number;
  amount: number;
  redeemed_on: string;
  method: string;
  reference: string | null;
  notes: string | null;
};

export type ReferralEarnLine = {
  key: string;
  partner_profile_id: number;
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  earned_on: string;
  sales_amount: number;
  rate_pct: number;
  commission: number;
  reference: string | null;
};

export type PartnerCommissionStatement = {
  seller_profile_id: number;
  seller_name: string;
  partner_profile_id: number;
  partner_name: string;
  rate_pct: number;
  basis: ReferralBasis;
  earn_on: ReferralEarnOn;
  status: string;
  notes: string | null;
  period_sales: number;
  period_commission: number;
  period_redeemed: number;
  owing_at_end: number;
  lines: ReferralEarnLine[];
  redemptions: ReferralRedemption[];
};

const CLOSED = new Set(['draft', 'void', 'cancelled', 'canceled']);

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function referralDay(
  value: string | null | undefined,
  timeZone = 'Africa/Johannesburg'
): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

export function normalizeReferralBasis(value: unknown): ReferralBasis {
  return String(value || '').toLowerCase() === 'incl_vat' ? 'incl_vat' : 'ex_vat';
}

export function normalizeReferralEarnOn(value: unknown): ReferralEarnOn {
  return String(value || '').toLowerCase() === 'invoiced' ? 'invoiced' : 'collected';
}

export function normalizeRedeemMethod(value: unknown): ReferralRedeemMethod {
  const method = String(value || '').toLowerCase();
  if (method === 'offset' || method === 'credit') return method;
  return 'paid';
}

function inSpan(day: string, from: string, to: string): boolean {
  return Boolean(day) && day >= from && day <= to;
}

function isClosedInvoice(status: string | null | undefined): boolean {
  return CLOSED.has(String(status || '').toLowerCase());
}

/** Commission base for one gross amount (invoice total or a receipt). */
export function referralSalesBase(
  invoice: Pick<ReferralInvoice, 'subtotal' | 'total_amount'>,
  basis: ReferralBasis,
  gross: number
): number {
  const amount = Number(gross) || 0;
  if (Math.abs(amount) < 0.005) return 0;
  if (basis === 'incl_vat') return roundMoney(amount);
  const total = Number(invoice.total_amount) || 0;
  const sub = Number(invoice.subtotal) || 0;
  if (Math.abs(total) < 0.005) return roundMoney(amount);
  return roundMoney(amount * (sub / total));
}

function partnerOnInvoice(
  invoice: ReferralInvoice,
  customers: Map<number, number | null>
): number | null {
  const onInvoice = Number(invoice.referral_partner_profile_id);
  if (Number.isFinite(onInvoice) && onInvoice > 0) return onInvoice;
  if (!invoice.customer_id) return null;
  const onCustomer = customers.get(invoice.customer_id);
  return onCustomer && onCustomer > 0 ? onCustomer : null;
}

function agreementKey(sellerId: number, partnerId: number): string {
  return `${sellerId}:${partnerId}`;
}

/**
 * Commission earned on referred sales, and redemptions in the same period.
 * Collected agreements use each receipt date. Invoiced agreements use the invoice date.
 * A paused agreement still uses its saved rate so earlier sales stay visible.
 */
export function buildReferralCommission(opts: {
  from: string;
  to: string;
  agreements: ReferralAgreement[];
  invoices: ReferralInvoice[];
  customers: ReferralCustomerLink[];
  payments: ReferralPayment[];
  redemptions: ReferralRedemption[];
}): PartnerCommissionStatement[] {
  const customers = new Map<number, number | null>();
  for (const customer of opts.customers) {
    const partner = Number(customer.referral_partner_profile_id);
    customers.set(
      customer.id,
      Number.isFinite(partner) && partner > 0 ? partner : null
    );
  }

  const agreements = new Map<string, ReferralAgreement>();
  for (const agreement of opts.agreements) {
    agreements.set(
      agreementKey(agreement.seller_profile_id, agreement.partner_profile_id),
      agreement
    );
  }

  const paymentsByInvoice = new Map<number, ReferralPayment[]>();
  for (const payment of opts.payments) {
    const list = paymentsByInvoice.get(payment.invoice_id) || [];
    list.push(payment);
    paymentsByInvoice.set(payment.invoice_id, list);
  }

  const earned = new Map<string, ReferralEarnLine[]>();
  const remember = (sellerId: number, line: ReferralEarnLine) => {
    const key = agreementKey(sellerId, line.partner_profile_id);
    if (!agreements.has(key)) return;
    const list = earned.get(key) || [];
    list.push(line);
    earned.set(key, list);
  };

  for (const invoice of opts.invoices) {
    if (isClosedInvoice(invoice.status)) continue;
    const partnerId = partnerOnInvoice(invoice, customers);
    if (!partnerId) continue;
    const agreementRow = agreements.get(
      agreementKey(invoice.seller_profile_id, partnerId)
    );
    if (!agreementRow) continue;
    const rate = Number(agreementRow.rate_pct) || 0;
    if (rate <= 0) continue;

    const push = (
      earnedOn: string,
      gross: number,
      sourceKey: string,
      reference: string | null
    ) => {
      if (!earnedOn) return;
      const sales = referralSalesBase(invoice, agreementRow.basis, gross);
      const commission = roundMoney((sales * rate) / 100);
      if (Math.abs(sales) < 0.005 && Math.abs(commission) < 0.005) return;
      remember(invoice.seller_profile_id, {
        key: sourceKey,
        partner_profile_id: partnerId,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        earned_on: earnedOn,
        sales_amount: sales,
        rate_pct: rate,
        commission,
        reference,
      });
    };

    if (agreementRow.earn_on === 'invoiced') {
      push(
        referralDay(invoice.issue_date),
        Number(invoice.total_amount) || 0,
        `inv-${invoice.id}`,
        null
      );
      continue;
    }

    const receipts = paymentsByInvoice.get(invoice.id) || [];
    if (receipts.length) {
      for (const payment of receipts) {
        push(
          referralDay(payment.paid_at),
          Number(payment.amount) || 0,
          `pay-${payment.id}`,
          payment.reference || null
        );
      }
      continue;
    }

    const collected = Number(invoice.amount_paid) || 0;
    if (Math.abs(collected) >= 0.005) {
      push(referralDay(invoice.issue_date), collected, `bal-${invoice.id}`, null);
    }
  }

  return opts.agreements.map((agreement) => {
    const key = agreementKey(
      agreement.seller_profile_id,
      agreement.partner_profile_id
    );
    const lines = (earned.get(key) || []).filter((line) =>
      inSpan(line.earned_on, opts.from, opts.to)
    );
    lines.sort((a, b) => a.earned_on.localeCompare(b.earned_on) || a.key.localeCompare(b.key));
    const allLines = earned.get(key) || [];
    const earnedToEnd = allLines
      .filter((line) => line.earned_on && line.earned_on <= opts.to)
      .reduce((sum, line) => sum + line.commission, 0);
    const redemptions = opts.redemptions
      .filter(
        (row) =>
          row.seller_profile_id === agreement.seller_profile_id &&
          row.partner_profile_id === agreement.partner_profile_id &&
          inSpan(row.redeemed_on, opts.from, opts.to)
      )
      .sort((a, b) => a.redeemed_on.localeCompare(b.redeemed_on) || a.id - b.id);
    const redeemedToEnd = opts.redemptions
      .filter(
        (row) =>
          row.seller_profile_id === agreement.seller_profile_id &&
          row.partner_profile_id === agreement.partner_profile_id &&
          row.redeemed_on &&
          row.redeemed_on <= opts.to
      )
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const periodSales = lines.reduce((sum, line) => sum + line.sales_amount, 0);
    const periodCommission = lines.reduce((sum, line) => sum + line.commission, 0);
    const periodRedeemed = redemptions.reduce(
      (sum, row) => sum + (Number(row.amount) || 0),
      0
    );
    return {
      seller_profile_id: agreement.seller_profile_id,
      seller_name: agreement.seller_name,
      partner_profile_id: agreement.partner_profile_id,
      partner_name: agreement.partner_name,
      rate_pct: Number(agreement.rate_pct) || 0,
      basis: agreement.basis,
      earn_on: agreement.earn_on,
      status: agreement.status || 'active',
      notes: agreement.notes || null,
      period_sales: roundMoney(periodSales),
      period_commission: roundMoney(periodCommission),
      period_redeemed: roundMoney(periodRedeemed),
      owing_at_end: roundMoney(earnedToEnd - redeemedToEnd),
      lines,
      redemptions,
    };
  });
}
