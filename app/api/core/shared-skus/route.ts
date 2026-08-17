import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { loadSharedSkuBundle } from '@/lib/core-os/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { sharedSkuKey, type SharedSkuDraft } from '@/lib/core-os/sku';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const bundle = await loadSharedSkuBundle(companyId);
    return NextResponse.json({ success: true, ...bundle });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** POST — upsert unlinked drafts into Core inventory. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const bundle = await loadSharedSkuBundle(companyId);
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    let created = 0;
    for (const d of bundle.drafts) {
      if (d.linked) continue;
      const draft = d as SharedSkuDraft & { linked: unknown };
      const payload: Record<string, unknown> = {
        profile_id: companyId,
        name: draft.name,
        sku: draft.sku,
        category: draft.category,
        sell_price: draft.price_zar,
        product_type: draft.track_stock ? 'stock' : 'service',
        is_sellable: true,
        status: 'active',
        short_description: draft.description || null,
        metadata: { shared_sku_key: sharedSkuKey(draft.source, draft.source_id) },
        updated_at: now,
      };
      const { error } = await supabase.from('products').insert(payload);
      if (!error) created += 1;
    }
    const next = await loadSharedSkuBundle(companyId);
    return NextResponse.json({ success: true, created, ...next });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
