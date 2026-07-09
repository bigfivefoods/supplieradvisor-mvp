import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCompanyMember,
  assertCustomerConnection,
} from '@/lib/customers/access';

/**
 * GET /api/buyer/documents
 *
 * Server-side buyer read of seller-shared commercial documents.
 * Buyer UI must NEVER select customer_quotes / sales_orders /
 * customer_invoices / customer_contracts via the browser client.
 *
 * Query: buyerCompanyId, privyUserId, type=quote|order|invoice|contract|all,
 *        supplierProfileId? (optional filter to one supplier)
 *
 * AuthZ: membership + accepted customer-type connection (allowSuspended: true)
 *        + visibility=shared / shared_with_buyer=true + ownership by supplier.
 */

type DocType = 'quote' | 'order' | 'invoice' | 'contract';

const DOC_TABLES: Record<Exclude<DocType, 'contract'>, string> = {
  quote: 'customer_quotes',
  order: 'sales_orders',
  invoice: 'customer_invoices',
};

const DOC_TYPES: DocType[] = ['quote', 'order', 'invoice', 'contract'];

function parseType(raw: string | null): DocType | 'all' {
  const t = String(raw || 'all').toLowerCase();
  if (t === 'quote' || t === 'quotes') return 'quote';
  if (t === 'order' || t === 'orders') return 'order';
  if (t === 'invoice' || t === 'invoices') return 'invoice';
  if (t === 'contract' || t === 'contracts') return 'contract';
  return 'all';
}

type SupplierCtx = {
  supplierProfileId: number;
  connectionId: number;
  connectionSuspended: boolean;
  customerIds: number[];
};

async function loadSupplierContexts(
  buyerCompanyId: number,
  supplierFilter: number | null
): Promise<
  | { ok: true; suppliers: SupplierCtx[] }
  | { ok: false; error: string; status: number }
> {
  const supabase = getSupabaseServer();
  const suppliers: SupplierCtx[] = [];

  if (supplierFilter != null) {
    const conn = await assertCustomerConnection(buyerCompanyId, supplierFilter, {
      allowSuspended: true,
    });
    if (!conn.ok) {
      return { ok: false, error: conn.error, status: conn.status };
    }

    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', supplierFilter)
      .eq('linked_profile_id', buyerCompanyId);

    suppliers.push({
      supplierProfileId: supplierFilter,
      connectionId: conn.connection.id,
      connectionSuspended: conn.connection.suspended,
      customerIds: (customers || [])
        .map((c: { id: number }) => Number(c.id))
        .filter((id: number) => id > 0),
    });
    return { ok: true, suppliers };
  }

  // All accepted customer-type edges where buyer is requestee (includes suspended)
  const { data: connections, error } = await supabase
    .from('business_connections')
    .select('id, requester_profile_id, requestee_profile_id, status, connection_type, metadata')
    .eq('requestee_profile_id', buyerCompanyId)
    .eq('connection_type', 'customer')
    .eq('status', 'accepted');

  if (error) {
    console.error('buyer/documents connections error:', error);
    return { ok: false, error: 'Failed to load supplier connections', status: 500 };
  }

  for (const row of connections || []) {
    const supplierProfileId = Number(row.requester_profile_id);
    if (!Number.isFinite(supplierProfileId) || supplierProfileId <= 0) continue;

    const meta =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const suspended = meta.suspended === true || meta.suspended === 'true';

    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', supplierProfileId)
      .eq('linked_profile_id', buyerCompanyId);

    suppliers.push({
      supplierProfileId,
      connectionId: Number(row.id),
      connectionSuspended: suspended,
      customerIds: (customers || [])
        .map((c: { id: number }) => Number(c.id))
        .filter((id: number) => id > 0),
    });
  }

  return { ok: true, suppliers };
}

async function fetchSharedDocs(
  type: Exclude<DocType, 'contract'>,
  ctx: SupplierCtx
): Promise<Record<string, unknown>[]> {
  // Without linked CRM customer ids we cannot attribute docs to this buyer
  if (ctx.customerIds.length === 0) return [];

  const supabase = getSupabaseServer();
  const table = DOC_TABLES[type];

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('profile_id', ctx.supplierProfileId)
    .eq('visibility', 'shared')
    .in('customer_id', ctx.customerIds)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    // Column missing (migration not applied) → empty with soft log
    console.error(`buyer/documents ${table} error:`, error.message);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    doc_type: type,
    supplier_profile_id: ctx.supplierProfileId,
    connection_id: ctx.connectionId,
    connection_suspended: ctx.connectionSuspended,
  }));
}

async function fetchSharedContracts(
  ctx: SupplierCtx,
  buyerCompanyId: number
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseServer();

  let q = supabase
    .from('customer_contracts')
    .select('*')
    .eq('profile_id', ctx.supplierProfileId)
    .eq('shared_with_buyer', true)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (ctx.customerIds.length > 0) {
    q = q.or(
      `buyer_profile_id.eq.${buyerCompanyId},customer_id.in.(${ctx.customerIds.join(',')})`
    );
  } else {
    q = q.eq('buyer_profile_id', buyerCompanyId);
  }

  const { data, error } = await q;
  if (error) {
    console.error('buyer/documents contracts error:', error.message);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    doc_type: 'contract' as const,
    supplier_profile_id: ctx.supplierProfileId,
    connection_id: ctx.connectionId,
    connection_suspended: ctx.connectionSuspended,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const buyerCompanyId = Number(sp.get('buyerCompanyId'));
    const privyUserId = sp.get('privyUserId');
    const type = parseType(sp.get('type'));
    const supplierRaw = sp.get('supplierProfileId');
    const supplierFilter =
      supplierRaw != null && supplierRaw !== '' ? Number(supplierRaw) : null;

    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json({ error: 'buyerCompanyId is required' }, { status: 400 });
    }
    if (supplierFilter != null && !Number.isFinite(supplierFilter)) {
      return NextResponse.json({ error: 'supplierProfileId must be a number' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, buyerCompanyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const ctxResult = await loadSupplierContexts(buyerCompanyId, supplierFilter);
    if (!ctxResult.ok) {
      return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
    }

    const { suppliers } = ctxResult;
    if (suppliers.length === 0) {
      return NextResponse.json({
        success: true,
        documents: [],
        type,
        connectionSuspended: false,
        suppliers: [],
      });
    }

    const typesToFetch: DocType[] = type === 'all' ? DOC_TYPES : [type];
    const documents: Record<string, unknown>[] = [];
    let anySuspended = false;

    for (const ctx of suppliers) {
      if (ctx.connectionSuspended) anySuspended = true;

      for (const t of typesToFetch) {
        if (t === 'contract') {
          documents.push(...(await fetchSharedContracts(ctx, buyerCompanyId)));
        } else {
          documents.push(...(await fetchSharedDocs(t, ctx)));
        }
      }
    }

    documents.sort((a, b) => {
      const ta = String(a.updated_at || a.created_at || '');
      const tb = String(b.updated_at || b.created_at || '');
      return tb.localeCompare(ta);
    });

    return NextResponse.json({
      success: true,
      documents,
      type,
      connectionSuspended: anySuspended,
      suppliers: suppliers.map((s) => ({
        supplierProfileId: s.supplierProfileId,
        connectionId: s.connectionId,
        connectionSuspended: s.connectionSuspended,
      })),
    });
  } catch (e: unknown) {
    console.error('GET /api/buyer/documents error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
