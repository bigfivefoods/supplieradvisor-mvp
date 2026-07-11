import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { AccountingSettings, InvoiceLineItem } from './types';
import { DEFAULT_CHART_OF_ACCOUNTS, DEFAULT_TAX_RATES } from './coa';

export function parseCompanyId(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

export async function getOrCreateSettings(profileId: number): Promise<AccountingSettings> {
  const supabase = getSupabaseServer();
  const { data: existing } = await supabase
    .from('accounting_settings')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existing) return existing as AccountingSettings;

  const { data: created, error } = await supabase
    .from('accounting_settings')
    .insert({
      profile_id: profileId,
      base_currency: 'ZAR',
      fiscal_year_start_month: 3,
      default_tax_rate: 15,
      invoice_prefix_ar: 'INV',
      invoice_prefix_ap: 'BILL',
      journal_prefix: 'JE',
      next_ar_number: 1001,
      next_ap_number: 1001,
      next_journal_number: 1,
      require_balanced_journals: true,
    })
    .select('*')
    .single();

  if (error || !created) {
    // Table may not exist yet — return defaults
    return {
      profile_id: profileId,
      base_currency: 'ZAR',
      fiscal_year_start_month: 3,
      default_tax_rate: 15,
      invoice_prefix_ar: 'INV',
      invoice_prefix_ap: 'BILL',
      journal_prefix: 'JE',
      next_ar_number: 1001,
      next_ap_number: 1001,
      next_journal_number: 1,
      require_balanced_journals: true,
    };
  }
  return created as AccountingSettings;
}

export async function nextDocumentNumber(
  profileId: number,
  kind: 'ar' | 'ap' | 'journal'
): Promise<string> {
  const supabase = getSupabaseServer();
  const settings = await getOrCreateSettings(profileId);

  if (kind === 'ar') {
    const n = Number(settings.next_ar_number || 1001);
    const prefix = settings.invoice_prefix_ar || 'INV';
    await supabase
      .from('accounting_settings')
      .update({ next_ar_number: n + 1, updated_at: new Date().toISOString() })
      .eq('profile_id', profileId);
    return `${prefix}-${String(n).padStart(5, '0')}`;
  }
  if (kind === 'ap') {
    const n = Number(settings.next_ap_number || 1001);
    const prefix = settings.invoice_prefix_ap || 'BILL';
    await supabase
      .from('accounting_settings')
      .update({ next_ap_number: n + 1, updated_at: new Date().toISOString() })
      .eq('profile_id', profileId);
    return `${prefix}-${String(n).padStart(5, '0')}`;
  }
  const n = Number(settings.next_journal_number || 1);
  const prefix = settings.journal_prefix || 'JE';
  await supabase
    .from('accounting_settings')
    .update({ next_journal_number: n + 1, updated_at: new Date().toISOString() })
    .eq('profile_id', profileId);
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

export function calcInvoiceTotals(
  items: InvoiceLineItem[] | null | undefined,
  taxRateFallback = 15
): { subtotal: number; tax_amount: number; total_amount: number; tax_rate: number } {
  const lines = Array.isArray(items) ? items : [];
  let subtotal = 0;
  let tax = 0;
  for (const line of lines) {
    const qty = Number(line.quantity ?? 1);
    const price = Number(line.unit_price ?? line.amount ?? 0);
    const amount = line.amount != null ? Number(line.amount) : qty * price;
    const rate = line.tax_rate != null ? Number(line.tax_rate) : taxRateFallback;
    subtotal += amount;
    tax += (amount * rate) / 100;
  }
  if (lines.length === 0) {
    return { subtotal: 0, tax_amount: 0, total_amount: 0, tax_rate: taxRateFallback };
  }
  return {
    subtotal: round2(subtotal),
    tax_amount: round2(tax),
    total_amount: round2(subtotal + tax),
    tax_rate: taxRateFallback,
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function linesAreBalanced(
  lines: Array<{ debit?: number | null; credit?: number | null }>
): { ok: boolean; debit: number; credit: number } {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    debit += Number(l.debit || 0);
    credit += Number(l.credit || 0);
  }
  debit = round2(debit);
  credit = round2(credit);
  return { ok: Math.abs(debit - credit) < 0.005, debit, credit };
}

/** Seed default CoA + tax rates if empty for this company */
export async function ensureDefaultCoa(profileId: number): Promise<{ seeded: number; warning?: string }> {
  const supabase = getSupabaseServer();
  const { data: existing, error } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('profile_id', profileId)
    .limit(1);

  if (error) {
    return { seeded: 0, warning: error.message };
  }
  if (existing && existing.length > 0) {
    return { seeded: 0 };
  }

  const rows = DEFAULT_CHART_OF_ACCOUNTS.map((a, i) => ({
    profile_id: profileId,
    code: a.code,
    name: a.name,
    account_type: a.account_type,
    subtype: a.subtype || null,
    is_active: true,
    is_system: true,
    is_header: a.is_header || false,
    normal_balance: a.normal_balance,
    description: a.description || null,
    currency: 'ZAR',
    sort_order: i,
  }));

  const { data, error: insErr } = await supabase.from('chart_of_accounts').insert(rows).select('id');
  if (insErr) {
    return { seeded: 0, warning: insErr.message };
  }

  // Seed tax rates if empty
  const { data: taxExisting } = await supabase
    .from('tax_rates')
    .select('id')
    .eq('profile_id', profileId)
    .limit(1);
  if (!taxExisting || taxExisting.length === 0) {
    await supabase.from('tax_rates').insert(
      DEFAULT_TAX_RATES.map((t) => ({
        profile_id: profileId,
        code: t.code,
        name: t.name,
        rate: t.rate,
        tax_type: t.tax_type,
        is_default: t.is_default,
        is_recoverable: t.is_recoverable !== false,
        country: t.country,
        category: t.category || 'standard',
        status: 'active',
        metadata: { category: t.category || 'standard' },
      }))
    );
  }

  // Ensure primary entity
  const { data: ent } = await supabase
    .from('accounting_entities')
    .select('id')
    .eq('profile_id', profileId)
    .limit(1);
  if (!ent || ent.length === 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('trading_name, legal_name, country')
      .eq('id', profileId)
      .maybeSingle();
    await supabase.from('accounting_entities').insert({
      profile_id: profileId,
      code: 'HQ',
      name: profile?.trading_name || profile?.legal_name || 'Primary entity',
      legal_name: profile?.legal_name || profile?.trading_name || null,
      country: profile?.country || 'ZA',
      currency: 'ZAR',
      is_primary: true,
      status: 'active',
    });
  }

  await getOrCreateSettings(profileId);

  return { seeded: data?.length || rows.length };
}

export function monthBounds(d = new Date()): { start: string; end: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
