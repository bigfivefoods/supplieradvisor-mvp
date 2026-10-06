import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { mapCreditApplication, maskCreditApplication } from '@/lib/credit/application';

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

    const status = String(request.nextUrl.searchParams.get('status') || '').trim();
    const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    const customerId = Number(request.nextUrl.searchParams.get('customerId') || 0);

    const supabase = getSupabaseServer();
    let query = supabase
      .from('credit_applications')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (status) query = query.eq('status', status);
    if (customerId > 0) query = query.eq('customer_id', customerId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []).map((row) => mapCreditApplication(row as Record<string, unknown>));

    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter((id) => id > 0)));
    const customerById = new Map<number, { trading_name: string; registration_number: string | null }>();
    if (customerIds.length) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, trading_name, registration_number')
        .eq('profile_id', companyId)
        .in('id', customerIds);
      for (const c of customers || []) {
        customerById.set(Number(c.id), {
          trading_name: String(c.trading_name || `Customer #${c.id}`),
          registration_number: c.registration_number ? String(c.registration_number) : null,
        });
      }
    }

    const filtered = rows.filter((row) => {
      if (!q) return true;
      const customer = customerById.get(row.customer_id);
      const hay = [
        row.reference || '',
        customer?.trading_name || '',
        customer?.registration_number || '',
        String((row.business || {}).registration_number || ''),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });

    const counts = filtered.reduce<Record<string, number>>((acc, row) => {
      acc.total = (acc.total || 0) + 1;
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      applications: filtered.map((row) => {
        const customer = customerById.get(row.customer_id);
        return {
          ...maskCreditApplication(row),
          customer_name: customer?.trading_name || `Customer #${row.customer_id}`,
          registration_number:
            String((row.business || {}).registration_number || customer?.registration_number || ''),
        };
      }),
      counts,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
