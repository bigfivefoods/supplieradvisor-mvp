import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/suppliers/access';
import { computeTrustScore } from '@/lib/suppliers/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&status=&invite_status=&q=&privyUserId=
 * List company-scoped srm_suppliers (buyer book).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    const status = sp.get('status');
    const inviteStatus = sp.get('invite_status');
    const q = (sp.get('q') || '').trim().toLowerCase();

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    let query = supabase
      .from('srm_suppliers')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (status && status !== 'all') query = query.eq('status', status);
    if (inviteStatus && inviteStatus !== 'all') query = query.eq('invite_status', inviteStatus);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        suppliers: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260709_srm_supplier_module.sql',
      });
    }

    let suppliers = data || [];
    if (q) {
      suppliers = suppliers.filter((s) => {
        const hay = [
          s.trading_name,
          s.legal_name,
          s.email,
          s.industry,
          s.city,
          s.country,
          s.contact_name,
          ...(s.certifications || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // Connection suspended flags
    const connIds = suppliers.map((s) => s.connection_id).filter(Boolean);
    const suspMap: Record<number, boolean> = {};
    if (connIds.length) {
      const { data: conns } = await supabase
        .from('business_connections')
        .select('id, metadata, status')
        .in('id', connIds);
      for (const c of conns || []) {
        const meta =
          c.metadata && typeof c.metadata === 'object' ? (c.metadata as Record<string, unknown>) : {};
        suspMap[Number(c.id)] =
          meta.suspended === true || meta.suspended === 'true' || c.status === 'suspended';
      }
    }

    // Pull platform logos for linked SA profiles
    const linkedIds = [
      ...new Set(
        suppliers
          .map((s) => Number(s.linked_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    const logoByProfile: Record<number, string | null> = {};
    if (linkedIds.length) {
      const { data: logos } = await supabase
        .from('profiles')
        .select('id, logo_url')
        .in('id', linkedIds);
      for (const p of logos || []) {
        logoByProfile[Number(p.id)] = p.logo_url ? String(p.logo_url) : null;
      }
    }

    const enriched = suppliers.map((s) => ({
      ...s,
      logo_url:
        (s as { logo_url?: string | null }).logo_url ||
        (s.linked_profile_id
          ? logoByProfile[Number(s.linked_profile_id)] || null
          : null),
      connection_suspended: s.connection_id ? !!suspMap[Number(s.connection_id)] : false,
      trust_score:
        s.trust_score ||
        computeTrustScore({
          otifef: s.otifef_pct,
          ratingAvg: s.rating_avg,
          verified: s.verified,
        }),
    }));

    return NextResponse.json({ success: true, suppliers: enriched });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * POST — create supplier in buyer book (may invite later).
 * Body: companyId, privyUserId?, trading_name, ...metadata
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.trading_name) {
      return NextResponse.json({ error: 'companyId and trading_name required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    if (body.privyUserId) {
      const mem = await assertCompanyMember(body.privyUserId, companyId);
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const certs = Array.isArray(body.certifications)
      ? body.certifications.map(String)
      : typeof body.certifications === 'string' && body.certifications
        ? body.certifications.split(',').map((c: string) => c.trim()).filter(Boolean)
        : [];

    const payload = {
      profile_id: companyId,
      trading_name: String(body.trading_name).trim(),
      legal_name: body.legal_name || body.trading_name || null,
      email: body.email ? String(body.email).toLowerCase().trim() : null,
      phone: body.phone || null,
      contact_name: body.contact_name || null,
      job_title: body.job_title || null,
      website: body.website || null,
      industry: body.industry || null,
      sub_industry: body.sub_industry || null,
      category: body.category || null,
      city: body.city || null,
      region: body.region || null,
      province: body.province || null,
      country: body.country || 'South Africa',
      continent: body.continent || null,
      address: body.address || null,
      postal_code: body.postal_code || null,
      status: body.status || 'prospect',
      invite_status: 'not_invited',
      linked_profile_id: body.linked_profile_id || null,
      wallet_address: body.wallet_address || null,
      certifications: certs,
      bee_level: body.bee_level || null,
      verified: !!body.verified,
      owner_name: body.owner_name || null,
      notes: body.notes || null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      created_by: body.created_by || body.privyUserId || null,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('srm_suppliers').insert(payload).select('*').single();
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_srm_supplier_module.sql' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, supplier: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH — update supplier book row
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const companyId = Number(body.companyId);
    const fields = [
      'trading_name',
      'legal_name',
      'email',
      'phone',
      'contact_name',
      'job_title',
      'website',
      'industry',
      'sub_industry',
      'category',
      'city',
      'region',
      'province',
      'country',
      'continent',
      'address',
      'postal_code',
      'status',
      'invite_status',
      'wallet_address',
      'certifications',
      'bee_level',
      'verified',
      'owner_name',
      'notes',
      'tags',
      'linked_profile_id',
      'connection_id',
      'otifef_pct',
      'trust_score',
      'rating_avg',
      'rating_count',
    ] as const;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    const supabase = getSupabaseServer();
    let q = supabase.from('srm_suppliers').update(updates).eq('id', Number(body.id));
    if (Number.isFinite(companyId)) q = q.eq('profile_id', companyId);
    const { data, error } = await q.select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, supplier: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
