import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';

/**
 * GET /api/suppliers/directory
 * Authenticated directory of supplier profiles (replaces browser anon PostgREST).
 */
export async function GET(request: NextRequest) {
  const gate = await requireVerifiedUser(request, {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
  if (!gate.ok) return gate.response;

  const q = String(request.nextUrl.searchParams.get('q') || '').trim();
  const status = String(request.nextUrl.searchParams.get('status') || 'all');
  const supabase = getSupabaseServer();
  let query = supabase
    .from('profiles')
    .select(
      'id, public_id, trading_name, email, contact_name, category, supplier_status, invited_at, claimed_at, created_at, wallet_address'
    )
    .eq('relationship_type', 'supplier')
    .order('trading_name', { ascending: true })
    .limit(200);
  if (status === 'active' || status === 'invited') {
    query = query.eq('supplier_status', status);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  let rows = data || [];
  if (q) {
    const term = q.toLowerCase();
    rows = rows.filter(
      (s) =>
        String(s.trading_name || '').toLowerCase().includes(term) ||
        String(s.contact_name || '').toLowerCase().includes(term) ||
        String(s.email || '').toLowerCase().includes(term) ||
        String(s.category || '').toLowerCase().includes(term)
    );
  }
  return NextResponse.json({ success: true, suppliers: rows });
}
