import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { parseCompanyId } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { assemblePartyRoles } from '@/lib/accounting/party-roles';

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
    const [{ data: customers, error: cErr }, { data: suppliers, error: sErr }] =
      await Promise.all([
        supabase
          .from('customers')
          .select(
            'id, trading_name, legal_name, email, status, linked_profile_id, metadata'
          )
          .eq('profile_id', companyId)
          .limit(5000),
        supabase
          .from('srm_suppliers')
          .select(
            'id, trading_name, legal_name, email, status, linked_profile_id, metadata'
          )
          .eq('profile_id', companyId)
          .limit(5000),
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
