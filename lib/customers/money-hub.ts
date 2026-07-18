/**
 * Seller Money hub — single settle-by-default surface.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { listClaimsForSeller } from '@/lib/customers/payment-claims';
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
  claims: Array<
    Record<string, unknown> & {
      ageHours?: number;
      slaBreached?: boolean;
      claimed_at?: string;
    }
  >;
  topOpenInvoices: Array<{
    id: number;
    invoice_number: string | null;
    customer_name: string | null;
    balance: number;
    currency: string;
    due_date: string | null;
    status: string;
  }>;
  /** Open installment schedule rows (table or empty) */
  installments: Array<{
    id: number;
    invoice_id: number;
    due_date: string;
    amount: number;
    amount_paid: number;
    status: string;
    overdue: boolean;
    invoice_number?: string | null;
  }>;
  /** Invoice ids due for dunning send-now */
  dunningInvoiceIds: number[];
  brokenPromises: Array<{
    id: number;
    invoice_number: string | null;
    customer_name: string | null;
    promise_to_pay_date: string;
    balance: number;
    currency: string;
  }>;
  creditAlerts: Array<{
    customerId: number;
    customerName: string;
    creditLimit: number;
    openBalance: number;
    overBy: number;
  }>;
  at: string;
};

export async function loadSellerMoneyHub(
  companyId: number
): Promise<MoneyHubSnapshot> {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  // Soft-select promise_to_pay_date (column may be missing pre-migration)
  let invs: Array<Record<string, unknown>> | null = null;
  {
    const withPtp = await supabase
      .from('customer_invoices')
      .select(
        'id, invoice_number, customer_name, customer_id, total_amount, amount_paid, currency, due_date, status, notes, promise_to_pay_date'
      )
      .eq('profile_id', companyId)
      .in('status', [...OPEN])
      .order('due_date', { ascending: true })
      .limit(200);
    if (withPtp.error) {
      const fallback = await supabase
        .from('customer_invoices')
        .select(
          'id, invoice_number, customer_name, customer_id, total_amount, amount_paid, currency, due_date, status, notes'
        )
        .eq('profile_id', companyId)
        .in('status', [...OPEN])
        .order('due_date', { ascending: true })
        .limit(200);
      invs = (fallback.data || []) as Array<Record<string, unknown>>;
    } else {
      invs = (withPtp.data || []) as Array<Record<string, unknown>>;
    }
  }

  let openAr = 0;
  let overdueCount = 0;
  let partialCount = 0;
  let dunningDue = 0;
  const topOpenInvoices: MoneyHubSnapshot['topOpenInvoices'] = [];
  const brokenPromises: MoneyHubSnapshot['brokenPromises'] = [];
  const openByCustomer = new Map<
    number,
    { name: string; balance: number }
  >();

  // I: batch ledger sums (avoid N+1 sumLedgerPaid)
  const ledgerByInv = new Map<number, number>();
  try {
    const invIds = (invs || []).map((i) => Number(i.id)).filter(Boolean);
    if (invIds.length) {
      const { data: led } = await supabase
        .from('customer_invoice_payments')
        .select('invoice_id, amount')
        .eq('profile_id', companyId)
        .in('invoice_id', invIds.slice(0, 400));
      for (const row of led || []) {
        const id = Number(row.invoice_id);
        ledgerByInv.set(
          id,
          (ledgerByInv.get(id) || 0) + Number(row.amount || 0)
        );
      }
    }
  } catch {
    /* table optional */
  }

  for (const inv of invs || []) {
    const st = String(inv.status || '').toLowerCase();
    let paid = Number(inv.amount_paid || 0);
    const ledPaid = ledgerByInv.get(Number(inv.id));
    if (ledPaid != null) paid = Math.max(paid, ledPaid);
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

    const ptpRaw = inv.promise_to_pay_date;
    const ptp =
      ptpRaw != null && String(ptpRaw).trim()
        ? String(ptpRaw).slice(0, 10)
        : null;
    if (ptp && ptp < today && balance > 0.01 && brokenPromises.length < 15) {
      brokenPromises.push({
        id: Number(inv.id),
        invoice_number: inv.invoice_number
          ? String(inv.invoice_number)
          : null,
        customer_name: inv.customer_name ? String(inv.customer_name) : null,
        promise_to_pay_date: ptp,
        balance: Math.round(balance * 100) / 100,
        currency: String(inv.currency || 'ZAR'),
      });
    }

    const cid = inv.customer_id ? Number(inv.customer_id) : 0;
    if (cid > 0) {
      const prev = openByCustomer.get(cid) || {
        name: String(inv.customer_name || `Customer #${cid}`),
        balance: 0,
      };
      prev.balance += balance;
      openByCustomer.set(cid, prev);
    }
  }

  const creditAlerts: MoneyHubSnapshot['creditAlerts'] = [];
  try {
    const custIds = [...openByCustomer.keys()];
    if (custIds.length) {
      const { data: custs } = await supabase
        .from('customers')
        .select('id, trading_name, legal_name, credit_limit, notes, status')
        .eq('profile_id', companyId)
        .in('id', custIds.slice(0, 80));
      for (const c of custs || []) {
        const limit = Number(c.credit_limit);
        if (!Number.isFinite(limit) || limit <= 0) continue;
        const open = openByCustomer.get(Number(c.id));
        if (!open) continue;
        const hold =
          /\[credit hold\]/i.test(String(c.notes || '')) ||
          String(c.status || '').toLowerCase() === 'credit_hold';
        if (open.balance > limit + 0.01 || hold) {
          creditAlerts.push({
            customerId: Number(c.id),
            customerName: String(
              c.trading_name || c.legal_name || open.name
            ),
            creditLimit: limit,
            openBalance: Math.round(open.balance * 100) / 100,
            overBy: Math.round((open.balance - limit) * 100) / 100,
          });
        }
      }
    }
  } catch {
    /* soft */
  }

  const { claims: rawClaims } = await listClaimsForSeller(companyId, {
    status: 'pending',
    limit: 20,
  });
  const slaHours = Number(process.env.CLAIM_SLA_HOURS || 24);
  const claims = [...rawClaims]
    .map((c) => {
      const claimed = c.claimed_at ? Date.parse(String(c.claimed_at)) : NaN;
      const ageHours = Number.isFinite(claimed)
        ? Math.max(0, Math.round((Date.now() - claimed) / 3600000))
        : 0;
      return {
        ...c,
        ageHours,
        slaBreached: ageHours >= slaHours,
      };
    })
    .sort((a, b) => (b.ageHours || 0) - (a.ageHours || 0));

  let openInstallments = 0;
  let overdueInstallments = 0;
  const installments: MoneyHubSnapshot['installments'] = [];
  const dunningInvoiceIds: number[] = [];
  try {
    const { data: inst } = await supabase
      .from('customer_invoice_installments')
      .select(
        'id, invoice_id, due_date, status, amount, amount_paid, sequence_no'
      )
      .eq('profile_id', companyId)
      .in('status', ['open', 'partial'])
      .order('due_date', { ascending: true })
      .limit(200);
    const invNums = new Map(
      topOpenInvoices.map((i) => [i.id, i.invoice_number])
    );
    for (const r of inst || []) {
      openInstallments += 1;
      const due = String(r.due_date || '').slice(0, 10);
      const overdue = Boolean(due && due < today);
      if (overdue) overdueInstallments += 1;
      installments.push({
        id: Number(r.id),
        invoice_id: Number(r.invoice_id),
        due_date: due,
        amount: Number(r.amount || 0),
        amount_paid: Number(r.amount_paid || 0),
        status: String(r.status || 'open'),
        overdue,
        invoice_number: invNums.get(Number(r.invoice_id)) || null,
      });
    }
  } catch {
    /* table optional */
  }

  for (const inv of topOpenInvoices) {
    if (
      inv.status === 'overdue' ||
      (inv.due_date && inv.due_date < today)
    ) {
      dunningInvoiceIds.push(inv.id);
    }
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
    claims: claims as unknown as MoneyHubSnapshot['claims'],
    topOpenInvoices,
    installments: installments.slice(0, 25),
    dunningInvoiceIds: dunningInvoiceIds.slice(0, 20),
    brokenPromises,
    creditAlerts: creditAlerts.slice(0, 12),
    at: new Date().toISOString(),
  };
}

export async function loadBuyerMoneyHub(buyerCompanyId: number): Promise<{
  companyId: number;
  openInvoices: Array<{
    id: number;
    invoice_number: string | null;
    supplier_profile_id: number | null;
    supplier_name: string | null;
    total_amount: number;
    amount_paid: number;
    balance: number;
    currency: string;
    status: string;
    due_date: string | null;
    claimStatus: string | null;
    bank_name: string | null;
    bank_account: string | null;
    bank_branch: string | null;
  }>;
  claimTimeline: Array<{
    invoice_id: number;
    status: string;
    amount: number;
    currency: string;
    claimed_at?: string;
    resolved_at?: string | null;
    reference?: string | null;
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
  const claimTimeline: Array<{
    invoice_id: number;
    status: string;
    amount: number;
    currency: string;
    claimed_at?: string;
    resolved_at?: string | null;
    reference?: string | null;
  }> = [];
  try {
    const { data: claims } = await supabase
      .from('customer_payment_claims')
      .select(
        'invoice_id, status, amount, currency, claimed_at, resolved_at, reference'
      )
      .eq('buyer_profile_id', buyerCompanyId)
      .order('claimed_at', { ascending: false })
      .limit(80);
    for (const c of claims || []) {
      const id = Number(c.invoice_id);
      if (!claimByInv.has(id)) claimByInv.set(id, String(c.status || ''));
      if (c.status === 'pending') pendingClaims += 1;
      if (c.status === 'confirmed') confirmedClaims += 1;
      claimTimeline.push({
        invoice_id: id,
        status: String(c.status || ''),
        amount: Number(c.amount || 0),
        currency: String(c.currency || 'ZAR'),
        claimed_at: c.claimed_at ? String(c.claimed_at) : undefined,
        resolved_at: c.resolved_at ? String(c.resolved_at) : null,
        reference: c.reference ? String(c.reference) : null,
      });
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
    supplier_name: string | null;
    total_amount: number;
    amount_paid: number;
    balance: number;
    currency: string;
    status: string;
    due_date: string | null;
    claimStatus: string | null;
    bank_name: string | null;
    bank_account: string | null;
    bank_branch: string | null;
  }> = [];

  // Batch supplier bank details
  const bankBySupplier = new Map<
    number,
    {
      name: string | null;
      bank_name: string | null;
      bank_account: string | null;
      bank_branch: string | null;
    }
  >();
  if (supplierIds.length) {
    const { data: sellers } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, bank_name, bank_account_number, branch_code, metadata'
      )
      .in('id', supplierIds.slice(0, 20));
    for (const s of sellers || []) {
      const meta =
        s.metadata && typeof s.metadata === 'object'
          ? (s.metadata as Record<string, unknown>)
          : {};
      const bank =
        meta.bank && typeof meta.bank === 'object'
          ? (meta.bank as Record<string, unknown>)
          : {};
      bankBySupplier.set(Number(s.id), {
        name: String(s.trading_name || s.legal_name || ''),
        bank_name: String(
          s.bank_name || bank.name || bank.bank_name || ''
        ) || null,
        bank_account: String(
          s.bank_account_number || bank.account_number || bank.account || ''
        ) || null,
        bank_branch: String(
          s.branch_code || bank.branch_code || bank.branch || ''
        ) || null,
      });
    }
  }

  for (const sid of supplierIds.slice(0, 20)) {
    const { data: invs } = await supabase
      .from('customer_invoices')
      .select(
        'id, invoice_number, total_amount, amount_paid, currency, status, due_date, visibility, shared_with_buyer, profile_id'
      )
      .eq('profile_id', sid)
      .in('status', [...OPEN, 'partial'])
      .limit(30);
    const seller = bankBySupplier.get(sid);
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
        supplier_name: seller?.name || null,
        total_amount: total,
        amount_paid: paid,
        balance,
        currency: String(inv.currency || 'ZAR'),
        status: String(inv.status || ''),
        due_date: inv.due_date ? String(inv.due_date).slice(0, 10) : null,
        claimStatus: claimByInv.get(Number(inv.id)) || null,
        bank_name: seller?.bank_name || null,
        bank_account: seller?.bank_account || null,
        bank_branch: seller?.bank_branch || null,
      });
    }
  }

  openInvoices.sort((a, b) => b.balance - a.balance);

  return {
    companyId: buyerCompanyId,
    openInvoices: openInvoices.slice(0, 40),
    claimTimeline: claimTimeline.slice(0, 20),
    pendingClaims,
    confirmedClaims,
    at: new Date().toISOString(),
  };
}
