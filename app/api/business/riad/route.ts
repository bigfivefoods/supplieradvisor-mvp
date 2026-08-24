import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  mapCustomerRiad,
  mapOperationsRiad,
  mapSupplierRiad,
  sortCompanyRiad,
  type CompanyRiadRow,
} from '@/lib/riad/company-aggregate';
import { isMissingRelation } from '@/lib/business/company-data';

function asObj(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * GET ?companyId=
 * Aggregate customer, supplier, and operations RIAD onto one company book.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const warnings: string[] = [];
    const items: CompanyRiadRow[] = [];

    const [customers, suppliers, ops, crmBook, srmBook] = await Promise.all([
      supabase
        .from('customer_riad')
        .select('*')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('supplier_riad')
        .select('*')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('riad_logs')
        .select('*')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('customers')
        .select('id, trading_name')
        .eq('profile_id', companyId)
        .limit(400),
      supabase
        .from('srm_suppliers')
        .select('id, trading_name')
        .eq('profile_id', companyId)
        .limit(400),
    ]);

    if (customers.error) {
      if (!isMissingRelation(customers.error)) {
        warnings.push(`Customers: ${customers.error.message}`);
      }
    } else {
      const names = Object.fromEntries(
        (crmBook.data || []).map((c) => [Number(c.id), String(c.trading_name || '')])
      );
      for (const row of customers.data || []) {
        const r = asObj(row);
        const cid = Number(r.customer_id);
        items.push(mapCustomerRiad(r, names[cid] || null));
      }
    }

    if (suppliers.error) {
      if (!isMissingRelation(suppliers.error)) {
        warnings.push(`Suppliers: ${suppliers.error.message}`);
      }
    } else {
      const names = Object.fromEntries(
        (srmBook.data || []).map((c) => [Number(c.id), String(c.trading_name || '')])
      );
      for (const row of suppliers.data || []) {
        const r = asObj(row);
        const sid = Number(r.supplier_id);
        items.push(mapSupplierRiad(r, names[sid] || null));
      }
    }

    if (ops.error) {
      if (!isMissingRelation(ops.error)) {
        warnings.push(`Operations: ${ops.error.message}`);
      }
    } else {
      const rows = ops.data || [];
      const cids = [
        ...new Set(
          rows
            .map((i) => Number((i as { container_id?: number }).container_id))
            .filter((n) => Number.isFinite(n) && n > 0)
        ),
      ];
      const nameMap: Record<number, string> = {};
      if (cids.length) {
        const { data: containers } = await supabase
          .from('containers')
          .select('id, name, container_code')
          .in('id', cids);
        for (const c of containers || []) {
          nameMap[Number(c.id)] = String(c.name || c.container_code || '');
        }
      }
      for (const row of rows) {
        const r = asObj(row);
        const cid = Number(r.container_id);
        if (cid && nameMap[cid] && !r.container_name) r.container_name = nameMap[cid];
        items.push(mapOperationsRiad(r));
      }
    }

    items.sort(sortCompanyRiad);

    const bySource = {
      customer: items.filter((i) => i.source === 'customer').length,
      supplier: items.filter((i) => i.source === 'supplier').length,
      operations: items.filter((i) => i.source === 'operations').length,
    };

    return NextResponse.json({
      success: true,
      items,
      bySource,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
