/**
 * Seller Money hub — single settle-by-default surface.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { listClaimsForSeller } from '@/lib/customers/payment-claims';
import { sumLedgerPaid } from '@/lib/customers/ar-ledger';

const OPEN = ['sent', 'partial', 'overdue', 'viewed', 'unpaid', 'issued'] as const;

export type MoneyHubSnapshot = {
  companyId: number;
  openAr: number;
  openArBase: number | null;
  baseCurrency: string;
  overdueCount: number;
  partialCount: number;
  pendingClaims: number;
  openInstallments: number;
  overdueInstallments: number;
  dunningDue: number;
  recentLedger: Array<{
    id?: number;
    invoice_id: number;
    amount: number;
    currency?: string;
    paid_at: string;
    method?: string | null;
    reference?: string | null;
  }>;
  claims: Array<Record<string, unknown>>;
  topOpenInvoices: Array<{
    id: number;
    invoice_number: string | null;
    customer_name: string | null;
    balance: number;
    currency: string;
    due_date: string | null;
    status: string;
  }>;
  at: string;
};

export async function loadSellerMoneyHub(
  companyId: number
): Promise<MoneyHubSnapshot> {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const { data: invs } = await supabase
    .from('customer_invoices')
    .select(
      'id, invoice_number, customer_name, total_amount, amount_paid, currency, due_date, status, notes'
    )
    .eq('profile_id', companyId)
    .in('status', [...OPEN])
    .order('due_date', { ascending: true })
    .limit(200);

  let openAr = 0;
  let overdueCount = 0;
  let partialCount = 0;
  let dunningDue = 0;
  const topOpenInvoices: MoneyHubSnapshot['topOpenInvoices'] = [];

  for (const inv of invs || []) {
    const st = String(inv.status || '').toLowerCase();
    let paid = Number(inv.amount_paid || 0);
    try {
      const sum = await sumLedgerPaid(companyId, Number(inv.id));
      if (sum.total != null && !sum.tableMissing) paid = Math.max(paid, sum.total);
    } catch {
      /* soft */
    }
    const balance = Math.max(0, Number(inv.total_amount || 0) - paid);
    if (balance <= 0.009) continue;
    openAr += balance;
    if (st === 'partial') partialCount += 1;
    if (st === 'overdue' || (inv.due_date && String(inv.due_date).slice(0, 10) < today)) {
      overdueCount += 1;
    }
    const notes = inv.notes != null ? String(inv.notes) : '';
    if (
      !/\[dunning paused/i.test(notes) &&
      (st === 'overdue' ||
        (inv.due_date && String(inv.due_date).slice(0, 10) < today))
    ) {
      dunningDue += 1;
    }
    if (topOpenInvoices.length < 12) {
      topOpenInvoices.push({
        id: Number(inv.id),
        invoice_number: inv.invoice_number
          ? String(inv.invoice_number)
          : null,
        customer_name: inv.customer_name ? String(inv.customer_name) : null,
        balance: Math.round(balance * 100) / 100,
        currency: String(inv.currency || 'ZAR'),
        due_date: inv.due_date ? String(inv.due_date).slice(0, 10) : null,
        status: st,
      });
    }
  }

  const { claims } = await listClaimsForSeller(companyId, {
    status: 'pending',
    limit: 20,
  });

  let openInstallments = 0;
  let overdueInstallments = 0;
  try {
    const { data: inst } = await supabase
      .from('customer_invoice_installments')
      .select('id, due_date, status, amount, amount_paid')
      .eq('profile_id', companyId)
      .in('status', ['open', 'partial'])
      .limit(200);
    for (const r of inst || []) {
      openInstallments += 1;
      const due = String(r.due_date || '').slice(0, 10);
      if (due && due < today) overdueInstallments += 1;
    }
  } catch {
    /* table optional */
  }

  let recentLedger: MoneyHubSnapshot['recentLedger'] = [];
  try {
    const { data: led } = await supabase
      .from('customer_invoice_payments')
      .select('id, invoice_id, amount, currency, paid_at, method, reference')
      .eq('profile_id', companyId)
      .order('paid_at', { ascending: false })
      .limit(15);
    recentLedger = (led || []).map((r) => ({
      id: r.id != null ? Number(r.id) : undefined,
      invoice_id: Number(r.invoice_id),
      amount: Number(r.amount || 0),
      currency: r.currency ? String(r.currency) : undefined,
      paid_at: String(r.paid_at || ''),
      method: r.method ? String(r.method) : null,
      reference: r.reference ? String(r.reference) : null,
    }));
  } catch {
    recentLedger = [];
  }

  let baseCurrency = 'ZAR';
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('primary_currency')
      .eq('id', companyId)
      .maybeSingle();
    baseCurrency = String(prof?.primary_currency || 'ZAR').toUpperCase();
  } catch {
    /* soft */
  }

  return {
    companyId,
    openAr: Math.round(openAr * 100) / 100,
    openArBase: null,
    baseCurrency,
    overdueCount,
    partialCount,
    pendingClaims: claims.length,
    openInstallments,
    overdueInstallments,
    dunningDue,
    recentLedger,
    claims: claims as unknown as Array<Record<string, unknown>>,
    topOpenInvoices,
    at: new Date().toISOString(),
  };
}

export async function loadBuyerMoneyHub(buyerCompanyId: number): Promise<{
  companyId: number;
  openInvoices: Array<{
    id: number;
    invoice_number: string | null;
    supplier_profile_id: number | null;
    total_amount: number;
    amount_paid: number;
    balance: number;
    currency: string;
    status: string;
    due_date: string | null;
    claimStatus: string | null;
  }>;
  pendingClaims: number;
  confirmedClaims: number;
  at: string;
}> {
  const supabase = getSupabaseServer();

  // Claims by this buyer
  let claimByInv = new Map<number, string>();
  let pendingClaims = 0;
  let confirmedClaims = 0;
  try {
    const { data: claims } = await supabase
      .from('customer_payment_claims')
      .select('invoice_id, status')
      .eq('buyer_profile_id', buyerCompanyId)
      .order('claimed_at', { ascending: false })
      .limit(80);
    for (const c of claims || []) {
      const id = Number(c.invoice_id);
      if (!claimByInv.has(id)) claimByInv.set(id, String(c.status || ''));
      if (c.status === 'pending') pendingClaims += 1;
      if (c.status === 'confirmed') confirmedClaims += 1;
    }
  } catch {
    /* soft */
  }

  // Shared invoices via connections (reuse buyer docs pattern lightly)
  const { data: conns } = await supabase
    .from('business_connections')
    .select('requester_profile_id, requestee_profile_id, status')
    .eq('requestee_profile_id', buyerCompanyId)
    .eq('connection_type', 'customer')
    .eq('status', 'accepted')
    .limit(50);

  const supplierIds = (conns || [])
    .map((c) => Number(c.requester_profile_id))
    .filter((n) => n > 0);

  const openInvoices: Array<{
    id: number;
    invoice_number: string | null;
    supplier_profile_id: number | null;
    total_amount: number;
    amount_paid: number;
    balance: number;
    currency: string;
    status: string;
    due_date: string | null;
    claimStatus: string | null;
  }> = [];

  for (const sid of supplierIds.slice(0, 20)) {
    const { data: invs } = await supabase
      .from('customer_invoices')
      .select(
        'id, invoice_number, total_amount, amount_paid, currency, status, due_date, visibility, shared_with_buyer, profile_id'
      )
      .eq('profile_id', sid)
      .in('status', [...OPEN, 'partial'])
      .limit(30);
    for (const inv of invs || []) {
      const shared =
        inv.shared_with_buyer === true ||
        String(inv.visibility || '').toLowerCase().includes('shared');
      if (!shared && inv.shared_with_buyer !== true) {
        // still include if claim exists
        if (!claimByInv.has(Number(inv.id))) continue;
      }
      const total = Number(inv.total_amount || 0);
      const paid = Number(inv.amount_paid || 0);
      const balance = Math.max(0, total - paid);
      if (balance <= 0.009 && String(inv.status) === 'paid') continue;
      openInvoices.push({
        id: Number(inv.id),
        invoice_number: inv.invoice_number
          ? String(inv.invoice_number)
          : null,
        supplier_profile_id: sid,
        total_amount: total,
        amount_paid: paid,
        balance,
        currency: String(inv.currency || 'ZAR'),
        status: String(inv.status || ''),
        due_date: inv.due_date ? String(inv.due_date).slice(0, 10) : null,
        claimStatus: claimByInv.get(Number(inv.id)) || null,
      });
    }
  }

  openInvoices.sort((a, b) => b.balance - a.balance);

  return {
    companyId: buyerCompanyId,
    openInvoices: openInvoices.slice(0, 40),
    pendingClaims,
    confirmedClaims,
    at: new Date().toISOString(),
  };
}
