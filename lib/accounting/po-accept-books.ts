/**
 * IAS 2 sold-then-buy: when a purchase order is accepted, stock cost is known.
 *
 * 1) Dr 1140 Inventory · Cr supplier AP (2180-* / 2110) at PO goods cost
 * 2) Receive lines into stock_movements with that unit cost
 * 3) If the PO covers an already-issued sale, Dr 5100 · Cr 1140 so COGS
 *    equals the PO amount (not a catalogue list price)
 *
 * Hub (blanket) orders do not post. Idempotent on source po_inventory /
 * invoice_cogs. Catalogue cost_price is never used.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  postBalancedJournal,
  resolveCoaAccountIdByCode,
  type JournalLineInput,
} from '@/lib/accounting/post-journal';
import { round2 } from '@/lib/accounting/server';
import {
  COGS_CODE,
  COGS_SOURCE,
  INVENTORY_CODE,
  cogsJournalLines,
  isCogsManuallyReversed,
  parseInvoiceCogsLines,
} from '@/lib/accounting/inventory-cogs';
import { resolvePartyControlAccountId } from '@/lib/accounting/party-gl-accounts';

export const PO_INVENTORY_SOURCE = 'po_inventory';

const ACCEPTED_STATUSES = new Set([
  'accepted',
  'funded',
  'invoiced',
  'paid',
  'completed',
  'delivered',
]);

const ISSUED_AR = new Set([
  'sent',
  'partial',
  'paid',
  'overdue',
  'issued',
  'viewed',
  'unpaid',
]);

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export type PoCostLine = {
  product_id?: number | null;
  sku?: string | null;
  item_name?: string | null;
  quantity: number;
  unit_price: number;
};

export function parsePoCostLines(items: unknown): PoCostLine[] {
  if (!Array.isArray(items)) return [];
  const out: PoCostLine[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const qty = Number(row.quantity);
    const price = Number(row.unit_price ?? row.unit_cost ?? row.cost_price);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    out.push({
      product_id: row.product_id != null ? Number(row.product_id) : null,
      sku:
        row.sku != null && String(row.sku).trim()
          ? String(row.sku).trim()
          : null,
      item_name:
        row.item_name != null
          ? String(row.item_name)
          : row.name != null
            ? String(row.name)
            : null,
      quantity: qty,
      unit_price: price,
    });
  }
  return out;
}

export function poInventoryAmount(po: Record<string, unknown>): number {
  const lines = parsePoCostLines(po.items);
  if (lines.length) {
    return round2(lines.reduce((s, l) => s + l.quantity * l.unit_price, 0));
  }
  return round2(Number(po.subtotal ?? po.total_amount ?? 0));
}

export function poAcceptsInventoryBooks(po: Record<string, unknown>): boolean {
  const meta = asMeta(po.metadata);
  const kind = String(po.order_kind || meta.order_kind || 'standard').toLowerCase();
  if (kind === 'hub') return false;
  const status = String(po.status || '').toLowerCase();
  if (status === 'cancelled' || status === 'canceled' || status === 'draft') {
    return false;
  }
  return true;
}

export function poStatusPostsAcceptBooks(status?: string | null): boolean {
  return ACCEPTED_STATUSES.has(String(status || '').toLowerCase());
}

export function poRelatedInvoiceRefs(po: Record<string, unknown>): {
  invoiceId: number | null;
  invoiceNumber: string | null;
} {
  const meta = asMeta(po.metadata);
  const id = Number(
    meta.related_invoice_id ||
      meta.sales_invoice_id ||
      meta.cogs_invoice_id ||
      0
  );
  const num = String(
    meta.related_invoice_number ||
      meta.sales_invoice_number ||
      meta.cogs_invoice_number ||
      ''
  )
    .trim();
  return {
    invoiceId: Number.isFinite(id) && id > 0 ? id : null,
    invoiceNumber: num || null,
  };
}

export function overlappingPoCost(
  poLines: PoCostLine[],
  invoiceItems: unknown
): number {
  const inv = parseInvoiceCogsLines(invoiceItems);
  const ids = new Set(
    inv.map((l) => Number(l.product_id || 0)).filter((n) => n > 0)
  );
  const skus = new Set(
    inv
      .map((l) => String(l.sku || '').trim().toLowerCase())
      .filter(Boolean)
  );
  let sum = 0;
  for (const line of poLines) {
    const pid = Number(line.product_id || 0);
    const sku = String(line.sku || '').trim().toLowerCase();
    const hit =
      (pid > 0 && ids.has(pid)) || (Boolean(sku) && skus.has(sku));
    if (hit) sum += line.quantity * line.unit_price;
  }
  return round2(sum);
}

/**
 * Explicitly linked sale → whole PO is that sale's cost.
 * Otherwise only overlapping product lines (auto-match).
 */
export function cogsAmountForAcceptedPo(opts: {
  poAmount: number;
  explicitlyLinked: boolean;
  overlappingLineAmount: number;
}): number {
  if (opts.explicitlyLinked) return round2(Math.max(0, opts.poAmount));
  return round2(Math.max(0, opts.overlappingLineAmount));
}

export function poInventoryJournalLines(opts: {
  inventoryAccountId: number;
  apAccountId: number;
  amount: number;
  memo?: string;
  counterparty?: string | null;
  purchaseOrderId?: number | null;
}): JournalLineInput[] {
  const amount = round2(Math.abs(Number(opts.amount) || 0));
  const memo = opts.memo || 'PO inventory';
  return [
    {
      accountId: opts.inventoryAccountId,
      debit: amount,
      credit: 0,
      memo,
      counterparty: opts.counterparty || null,
      purchaseOrderId: opts.purchaseOrderId || null,
    },
    {
      accountId: opts.apAccountId,
      debit: 0,
      credit: amount,
      memo,
      counterparty: opts.counterparty || null,
      purchaseOrderId: opts.purchaseOrderId || null,
    },
  ];
}

export type PoAcceptBooksResult = {
  ok: boolean;
  skipped?: boolean;
  inventoryJournalId?: number;
  cogsJournalIds?: number[];
  cogsApplied?: number;
  received?: boolean;
  invoiceNumbers?: string[];
  error?: string;
};

async function liveJournals(opts: {
  profileId: number;
  source: string;
  sourceId: string;
}): Promise<Array<{ id: number }>> {
  const supabase = getSupabaseServer();
  const { data: existing } = await supabase
    .from('journal_entries')
    .select('id, metadata, status, source, source_id')
    .eq('profile_id', opts.profileId)
    .eq('source', opts.source)
    .eq('source_id', opts.sourceId)
    .eq('status', 'posted');
  const ids = (existing || []).map((j) => Number(j.id)).filter((n) => n > 0);
  const reversed = new Set<number>();
  if (ids.length) {
    const { data: revs } = await supabase
      .from('journal_entries')
      .select('source_id, metadata')
      .eq('profile_id', opts.profileId)
      .eq('source', 'reversal')
      .in('source_id', ids.map(String));
    for (const r of revs || []) {
      const rid = Number(
        r.source_id || asMeta(r.metadata).reverses_journal_id
      );
      if (rid > 0) reversed.add(rid);
    }
  }
  return (existing || [])
    .filter((j) => {
      const id = Number(j.id);
      return !asMeta(j.metadata).reversed_by_journal_id && !reversed.has(id);
    })
    .map((j) => ({ id: Number(j.id) }))
    .filter((j) => j.id > 0)
    .sort((a, b) => a.id - b.id);
}

function srmSupplierIdFromPo(po: Record<string, unknown>): number | null {
  const meta = asMeta(po.metadata);
  const n = Number(meta.srm_supplier_id || po.srm_supplier_id || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function stampPoMeta(
  profileId: number,
  poId: number,
  prev: Record<string, unknown>,
  patch: Record<string, unknown>
) {
  const supabase = getSupabaseServer();
  await supabase
    .from('purchase_orders')
    .update({
      metadata: { ...prev, ...patch },
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId)
    .eq('buyer_profile_id', profileId);
}

async function stampInvoiceCogs(
  profileId: number,
  invoice: Record<string, unknown>,
  patch: Record<string, unknown>
) {
  const supabase = getSupabaseServer();
  const invId = Number(invoice.id || 0);
  const number = String(invoice.invoice_number || '').trim();
  const meta = { ...asMeta(invoice.metadata), ...patch };
  if (invId > 0) {
    await supabase
      .from('invoices')
      .update({ metadata: meta, updated_at: new Date().toISOString() })
      .eq('id', invId)
      .eq('profile_id', profileId);
  }
  if (number) {
    await supabase
      .from('customer_invoices')
      .update({ metadata: meta, updated_at: new Date().toISOString() })
      .eq('profile_id', profileId)
      .eq('invoice_number', number);
    if (!(invId > 0)) {
      await supabase
        .from('invoices')
        .update({ metadata: meta, updated_at: new Date().toISOString() })
        .eq('profile_id', profileId)
        .eq('invoice_number', number);
    }
  }
  invoice.metadata = meta;
}

function invoiceNeedsPoCogs(inv: Record<string, unknown>): boolean {
  const meta = asMeta(inv.metadata);
  if (Number(meta.cogs_from_po_id || 0) > 0 && Number(meta.cogs_journal_id || 0) > 0) {
    return false;
  }
  if (isCogsManuallyReversed(meta)) return true;
  const skipped = String(meta.cogs_skipped || '');
  if (skipped === 'no_cost' || skipped === 'no_product') return true;
  if (!(Number(meta.cogs_journal_id || 0) > 0)) return true;
  return false;
}

async function loadRelatedSaleInvoices(opts: {
  profileId: number;
  po: Record<string, unknown>;
  poAmount: number;
}): Promise<Array<{ invoice: Record<string, unknown>; amount: number; explicit: boolean }>> {
  const supabase = getSupabaseServer();
  const refs = poRelatedInvoiceRefs(opts.po);
  const poLines = parsePoCostLines(opts.po.items);
  const out: Array<{
    invoice: Record<string, unknown>;
    amount: number;
    explicit: boolean;
  }> = [];

  async function consider(
    inv: Record<string, unknown> | null | undefined,
    explicit: boolean
  ) {
    if (!inv || !inv.id) return;
    if (String(inv.direction || '') === 'payable') return;
    if (!ISSUED_AR.has(String(inv.status || '').toLowerCase()) && !explicit) {
      return;
    }
    const overlap = overlappingPoCost(poLines, inv.items);
    const amount = cogsAmountForAcceptedPo({
      poAmount: opts.poAmount,
      explicitlyLinked: explicit,
      overlappingLineAmount: overlap,
    });
    if (amount < 0.005) return;
    if (!explicit && !invoiceNeedsPoCogs(inv) && overlap < 0.005) return;
    if (!explicit && !invoiceNeedsPoCogs(inv)) return;
    out.push({ invoice: inv, amount, explicit });
  }

  if (refs.invoiceId) {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', refs.invoiceId)
      .eq('profile_id', opts.profileId)
      .maybeSingle();
    await consider((data || null) as Record<string, unknown> | null, true);
  }
  if (refs.invoiceNumber && !out.length) {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('profile_id', opts.profileId)
      .eq('invoice_number', refs.invoiceNumber)
      .maybeSingle();
    if (data) {
      await consider(data as Record<string, unknown>, true);
    } else {
      const { data: crm } = await supabase
        .from('customer_invoices')
        .select('*')
        .eq('profile_id', opts.profileId)
        .eq('invoice_number', refs.invoiceNumber)
        .maybeSingle();
      if (crm) {
        const financeId = Number(asMeta(crm.metadata).finance_invoice_id || 0);
        if (financeId > 0) {
          const { data: fin } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', financeId)
            .eq('profile_id', opts.profileId)
            .maybeSingle();
          if (fin) {
            await consider(fin as Record<string, unknown>, true);
          } else {
            await consider(
              {
                ...(crm as Record<string, unknown>),
                direction: 'receivable',
              },
              true
            );
          }
        } else {
          await consider(
            {
              ...(crm as Record<string, unknown>),
              direction: 'receivable',
            },
            true
          );
        }
      }
    }
  }

  if (out.length) return out;

  const { data: recent } = await supabase
    .from('invoices')
    .select('*')
    .eq('profile_id', opts.profileId)
    .neq('direction', 'payable')
    .order('id', { ascending: false })
    .limit(40);
  const voided: Record<string, unknown>[] = [];
  for (const row of recent || []) {
    const inv = row as Record<string, unknown>;
    if (!ISSUED_AR.has(String(inv.status || '').toLowerCase())) continue;
    if (!invoiceNeedsPoCogs(inv)) continue;
    const overlap = overlappingPoCost(poLines, inv.items);
    if (overlap > 0.005) {
      out.push({
        invoice: inv,
        amount: cogsAmountForAcceptedPo({
          poAmount: opts.poAmount,
          explicitlyLinked: false,
          overlappingLineAmount: overlap,
        }),
        explicit: false,
      });
    } else if (isCogsManuallyReversed(inv.metadata)) {
      voided.push(inv);
    }
  }
  if (!out.length && voided.length === 1) {
    out.push({
      invoice: voided[0],
      amount: cogsAmountForAcceptedPo({
        poAmount: opts.poAmount,
        explicitlyLinked: true,
        overlappingLineAmount: 0,
      }),
      explicit: true,
    });
  }
  return out;
}

/**
 * Post inventory + AP on PO accept, then COGS for linked / matching sales.
 * Safe to call more than once.
 */
export async function applyPoAcceptBooks(opts: {
  companyId: number;
  poId: number;
  createdBy?: string | null;
  force?: boolean;
}): Promise<PoAcceptBooksResult> {
  const supabase = getSupabaseServer();
  const { data: poRow, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', opts.poId)
    .eq('buyer_profile_id', opts.companyId)
    .maybeSingle();
  if (error || !poRow) {
    return { ok: false, error: error?.message || 'Purchase order not found' };
  }
  const po = poRow as Record<string, unknown>;
  if (!poAcceptsInventoryBooks(po)) {
    return { ok: true, skipped: true, error: 'hub_or_not_applicable' };
  }
  if (!opts.force && !poStatusPostsAcceptBooks(String(po.status || ''))) {
    return { ok: true, skipped: true, error: 'not_accepted' };
  }

  const amount = poInventoryAmount(po);
  if (amount < 0.005) {
    return { ok: true, skipped: true, error: 'zero_amount' };
  }

  const meta = asMeta(po.metadata);
  const liveInv = await liveJournals({
    profileId: opts.companyId,
    source: PO_INVENTORY_SOURCE,
    sourceId: String(opts.poId),
  });
  let inventoryJournalId = liveInv[0]?.id;

  if (!inventoryJournalId) {
    const inventoryId = await resolveCoaAccountIdByCode(
      opts.companyId,
      INVENTORY_CODE
    );
    const partyAp = await resolvePartyControlAccountId({
      profileId: opts.companyId,
      kind: 'ap',
      partyId: srmSupplierIdFromPo(po),
      counterpartyName: po.supplier_name ? String(po.supplier_name) : null,
    });
    const apId =
      partyAp || (await resolveCoaAccountIdByCode(opts.companyId, '2110'));
    if (!inventoryId || !apId) {
      return {
        ok: false,
        error: 'COA missing Inventory (1140) or AP — seed Chart of Accounts',
      };
    }
    const supplierName = po.supplier_name ? String(po.supplier_name) : null;
    const memo = `PO #${opts.poId} inventory${supplierName ? ` · ${supplierName}` : ''}`.slice(
      0,
      500
    );
    const entryDate = String(
      po.promised_date || po.updated_at || new Date().toISOString()
    ).slice(0, 10);
    const posted = await postBalancedJournal({
      profileId: opts.companyId,
      entryDate,
      memo,
      source: PO_INVENTORY_SOURCE,
      sourceId: String(opts.poId),
      currency: String(po.currency || 'ZAR'),
      createdBy: opts.createdBy || null,
      metadata: {
        ias2: true,
        po_inventory: true,
        purchase_order_id: opts.poId,
        amount,
        supplier_name: supplierName,
      },
      lines: poInventoryJournalLines({
        inventoryAccountId: inventoryId,
        apAccountId: apId,
        amount,
        memo,
        counterparty: supplierName,
        purchaseOrderId: opts.poId,
      }),
    });
    if (!posted.ok) return { ok: false, error: posted.error };
    inventoryJournalId = posted.journalId;
    await stampPoMeta(opts.companyId, opts.poId, meta, {
      inventory_journal_id: posted.journalId,
      inventory_journal_number: posted.entryNumber,
      ap_allocated_journal_id: posted.journalId,
      inventory_posted_at: new Date().toISOString(),
      inventory_amount: amount,
    });
    meta.inventory_journal_id = posted.journalId;
    meta.ap_allocated_journal_id = posted.journalId;
  }

  let received = Boolean(meta.inventory_received_at);
  try {
    const { receivePurchaseOrderToInventory } = await import(
      '@/lib/procurement/receive-from-po'
    );
    const rec = await receivePurchaseOrderToInventory({
      companyId: opts.companyId,
      poId: opts.poId,
      createMissingProducts: true,
    });
    received = Boolean(rec.ok || rec.alreadyReceived || received);
  } catch (e) {
    console.warn('PO accept receive soft-fail', e);
  }

  const related = await loadRelatedSaleInvoices({
    profileId: opts.companyId,
    po,
    poAmount: amount,
  });
  const cogsJournalIds: number[] = [];
  const invoiceNumbers: string[] = [];
  let cogsApplied = 0;

  const cogsId = await resolveCoaAccountIdByCode(opts.companyId, COGS_CODE);
  const invGlId = await resolveCoaAccountIdByCode(opts.companyId, INVENTORY_CODE);

  for (const row of related) {
    const inv = row.invoice;
    const invId = Number(inv.id || 0);
    const liveCogs =
      invId > 0
        ? await liveJournals({
            profileId: opts.companyId,
            source: COGS_SOURCE,
            sourceId: String(invId),
          })
        : [];
    if (liveCogs.length) {
      cogsJournalIds.push(liveCogs[0].id);
      continue;
    }
    if (!cogsId || !invGlId) {
      return {
        ok: false,
        inventoryJournalId,
        error: 'COA missing 5100 or 1140 — seed Chart of Accounts',
      };
    }
    const invNumber = String(inv.invoice_number || inv.id || '');
    const memo = `COGS ${invNumber} from PO #${opts.poId}`.slice(0, 500);
    const entryDate = String(
      inv.issue_date || po.updated_at || new Date().toISOString()
    ).slice(0, 10);
    const posted = await postBalancedJournal({
      profileId: opts.companyId,
      entryDate,
      memo,
      source: COGS_SOURCE,
      sourceId: invId > 0 ? String(invId) : `po-${opts.poId}`,
      currency: String(inv.currency || po.currency || 'ZAR'),
      createdBy: opts.createdBy || null,
      metadata: {
        ias2: true,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number || null,
        purchase_order_id: opts.poId,
        cogs_amount: row.amount,
        from_po_accept: true,
      },
      lines: cogsJournalLines({
        cogsAccountId: cogsId,
        inventoryAccountId: invGlId,
        amount: row.amount,
        memo,
      }),
    });
    if (!posted.ok) return { ok: false, inventoryJournalId, error: posted.error };
    cogsJournalIds.push(posted.journalId);
    cogsApplied = round2(cogsApplied + row.amount);
    if (invNumber) invoiceNumbers.push(invNumber);
    await stampInvoiceCogs(opts.companyId, inv, {
      cogs_journal_id: posted.journalId,
      cogs_amount: row.amount,
      cogs_posted_at: new Date().toISOString(),
      cogs_skipped: null,
      cogs_voided: false,
      cogs_from_po_id: opts.poId,
      cogs_from_po_amount: row.amount,
    });
  }

  if (cogsJournalIds.length) {
    await stampPoMeta(opts.companyId, opts.poId, asMeta(po.metadata), {
      ...meta,
      cogs_journal_ids: cogsJournalIds,
      cogs_posted_at: new Date().toISOString(),
      cogs_amount: cogsApplied,
      related_invoice_numbers: invoiceNumbers,
    });
  }

  return {
    ok: true,
    inventoryJournalId,
    cogsJournalIds,
    cogsApplied,
    received,
    invoiceNumbers,
  };
}
