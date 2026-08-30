import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { parseCompanyId } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { parseListLimit } from '@/lib/http/tenant-list';
import { assemblePartyRoles } from '@/lib/accounting/party-roles';
import {
  applyPartyBookRole,
  parsePartyBookRole,
} from '@/lib/accounting/party-book-role';

export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(
      request.nextUrl.searchParams.get('companyId')
    );
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const limit = parseListLimit(request.nextUrl.searchParams.get('limit'));
    const [{ data: customers, error: cErr }, { data: suppliers, error: sErr }] =
      await Promise.all([
        supabase
          .from('customers')
          .select(
            'id, trading_name, legal_name, email, status, linked_profile_id, metadata'
          )
          .eq('profile_id', companyId)
          .order('id', { ascending: false })
          .limit(limit),
        supabase
          .from('srm_suppliers')
          .select(
            'id, trading_name, legal_name, email, status, linked_profile_id, metadata'
          )
          .eq('profile_id', companyId)
          .order('id', { ascending: false })
          .limit(limit),
      ]);

    const parties = assemblePartyRoles(customers || [], sErr ? [] : suppliers || []);
    return NextResponse.json({
      success: true,
      parties,
      counts: {
        customers: parties.filter((p) => p.customer_id).length,
        suppliers: parties.filter((p) => p.supplier_id).length,
        both: parties.filter((p) => p.role === 'both').length,
      },
      warning: cErr?.message || sErr?.message,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST { companyId, role, customer_id?, supplier_id? }
 * Set the party as customer / supplier / both and allocate 1180-* / 2180-*.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const role = parsePartyBookRole(body.role);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!role) {
      return NextResponse.json(
        { error: 'role must be customer, supplier, or both' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const result = await applyPartyBookRole({
      profileId: companyId,
      role,
      customerId: body.customer_id ? Number(body.customer_id) : null,
      supplierId: body.supplier_id ? Number(body.supplier_id) : null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed' }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
