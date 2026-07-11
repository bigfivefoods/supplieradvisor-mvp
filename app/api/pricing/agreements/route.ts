import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import {
  assertPricingTradeLink,
} from '@/lib/pricing/access';
import {
  nextAgreementNumber,
  normalizeLineInput,
  type PricingAgreement,
  type PricingAgreementLine,
} from '@/lib/pricing/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&privyUserId=&direction=selling|buying|all&status=&id=
 * List pricing agreements where we are seller and/or buyer.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const direction = (sp.get('direction') || 'all').toLowerCase();
    const status = sp.get('status');
    const id = sp.get('id') ? Number(sp.get('id')) : null;
    const includeLines = sp.get('lines') !== '0';

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const privyUserId = sp.get('privyUserId');

    const supabase = getSupabaseServer();

    if (id && Number.isFinite(id)) {
      const { data: agreement, error } = await supabase
        .from('pricing_agreements')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        return NextResponse.json({
          success: true,
          agreement: null,
          warning: error.message,
          hint: 'Run supabase/migrations/20260710_pricing_agreements.sql',
        });
      }
      if (!agreement) {
        return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
      }
      const sellerId = Number(agreement.seller_profile_id);
      const buyerId = Number(agreement.buyer_profile_id);
      if (sellerId !== companyId && buyerId !== companyId) {
        return NextResponse.json({ error: 'Not a party to this agreement' }, { status: 403 });
      }
      const { data: lines } = await supabase
        .from('pricing_agreement_lines')
        .select('*')
        .eq('agreement_id', id)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      const names = await loadPeerNames([sellerId, buyerId]);
      return NextResponse.json({
        success: true,
        agreement: enrichAgreement(agreement, companyId, names, lines || []),
      });
    }

    let query = supabase
      .from('pricing_agreements')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (direction === 'selling') {
      query = query.eq('seller_profile_id', companyId);
    } else if (direction === 'buying') {
      query = query.eq('buyer_profile_id', companyId);
    } else {
      query = query.or(
        `seller_profile_id.eq.${companyId},buyer_profile_id.eq.${companyId}`
      );
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        agreements: [],
        warning: error.message,
        hint: 'Run supabase/migrations/20260710_pricing_agreements.sql',
      });
    }

    const rows = data || [];
    const peerIds = new Set<number>();
    for (const r of rows) {
      peerIds.add(Number(r.seller_profile_id));
      peerIds.add(Number(r.buyer_profile_id));
    }
    const names = await loadPeerNames(Array.from(peerIds));

    let linesByAgreement = new Map<number, PricingAgreementLine[]>();
    if (includeLines && rows.length) {
      const ids = rows.map((r) => Number(r.id));
      const { data: allLines } = await supabase
        .from('pricing_agreement_lines')
        .select('*')
        .in('agreement_id', ids)
        .order('sort_order', { ascending: true });
      for (const line of allLines || []) {
        const aid = Number(line.agreement_id);
        const list = linesByAgreement.get(aid) || [];
        list.push(line as PricingAgreementLine);
        linesByAgreement.set(aid, list);
      }
    }

    // Counts without full lines when lines=0
    if (!includeLines && rows.length) {
      const ids = rows.map((r) => Number(r.id));
      const { data: counts } = await supabase
        .from('pricing_agreement_lines')
        .select('agreement_id')
        .in('agreement_id', ids);
      const countMap = new Map<number, number>();
      for (const c of counts || []) {
        const aid = Number(c.agreement_id);
        countMap.set(aid, (countMap.get(aid) || 0) + 1);
      }
      linesByAgreement = new Map(
        Array.from(countMap.entries()).map(([aid, n]) => [aid, Array(n).fill({})])
      );
    }

    const agreements: PricingAgreement[] = rows.map((r) => {
      const lines = includeLines
        ? linesByAgreement.get(Number(r.id)) || []
        : undefined;
      const line_count = includeLines
        ? lines?.length || 0
        : (linesByAgreement.get(Number(r.id)) || []).length;
      return {
        ...enrichAgreement(r, companyId, names, lines || []),
        line_count,
        lines: includeLines ? lines : undefined,
      };
    });

    return NextResponse.json({ success: true, agreements });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — create pricing agreement (seller creates for a connected buyer)
 * Body: companyId, privyUserId, buyerProfileId, title, currency?, lines[], status?, …
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const buyerProfileId = Number(body.buyerProfileId || body.buyer_profile_id);
    const title = String(body.title || '').trim();

    if (!Number.isFinite(companyId) || !Number.isFinite(buyerProfileId) || !title) {
      return NextResponse.json(
        { error: 'companyId, buyerProfileId, and title required' },
        { status: 400 }
      );
    }

    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const link = await assertPricingTradeLink(companyId, buyerProfileId);
    if (!link.ok) {
      return NextResponse.json({ error: link.error }, { status: link.status });
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const status = body.status === 'active' ? 'active' : body.status || 'draft';

    // Snapshot product specs onto lines when seller_product_id is set
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    const lines: PricingAgreementLine[] = [];
    for (const raw of rawLines) {
      const line = normalizeLineInput(raw);
      if (!line) continue;
      if (line.seller_product_id && (!line.specs_sheet_url || !line.primary_image_url)) {
        const { data: product } = await supabase
          .from('products')
          .select(
            'id, name, sku, uom, sell_price, specs_sheet_url, specs_sheet_name, primary_image_url, base_currency'
          )
          .eq('id', line.seller_product_id)
          .eq('profile_id', companyId)
          .maybeSingle();
        if (product) {
          if (!line.sku) line.sku = product.sku;
          if (!line.uom) line.uom = product.uom || 'unit';
          if (!line.specs_sheet_url) {
            line.specs_sheet_url = product.specs_sheet_url;
            line.specs_sheet_name = product.specs_sheet_name;
          }
          if (!line.primary_image_url) line.primary_image_url = product.primary_image_url;
          if (!line.list_price && product.sell_price != null) {
            line.list_price = Number(product.sell_price);
          }
        }
      }
      lines.push(line);
    }

    const { data: agreement, error } = await supabase
      .from('pricing_agreements')
      .insert({
        seller_profile_id: companyId,
        buyer_profile_id: buyerProfileId,
        title,
        agreement_number: body.agreement_number || nextAgreementNumber(),
        status,
        currency: body.currency || 'ZAR',
        effective_from: body.effective_from || now.slice(0, 10),
        effective_to: body.effective_to || null,
        payment_terms: body.payment_terms || null,
        notes: body.notes || null,
        connection_id: link.connectionId,
        metadata: body.metadata || { source: 'network_pricing' },
        created_by: mem.userId,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260710_pricing_agreements.sql',
        },
        { status: 500 }
      );
    }

    const agreementId = Number(agreement.id);
    if (lines.length) {
      const payloads = lines.map((l, idx) => ({
        agreement_id: agreementId,
        seller_product_id: l.seller_product_id || null,
        product_name: l.product_name,
        sku: l.sku || null,
        uom: l.uom || 'unit',
        list_price: l.list_price,
        min_qty: l.min_qty ?? 1,
        max_qty: l.max_qty ?? null,
        currency: l.currency || body.currency || 'ZAR',
        discount_pct: l.discount_pct || 0,
        notes: l.notes || null,
        suggested_resale_price: l.suggested_resale_price ?? null,
        specs_sheet_url: l.specs_sheet_url || null,
        specs_sheet_name: l.specs_sheet_name || null,
        primary_image_url: l.primary_image_url || null,
        sort_order: l.sort_order ?? idx,
        updated_at: now,
      }));
      const { error: lineErr } = await supabase
        .from('pricing_agreement_lines')
        .insert(payloads);
      if (lineErr) {
        console.warn('pricing lines insert soft-fail:', lineErr.message);
      }
    }

    const { data: savedLines } = await supabase
      .from('pricing_agreement_lines')
      .select('*')
      .eq('agreement_id', agreementId)
      .order('sort_order', { ascending: true });

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'pricing.agreement_create',
      entity_type: 'pricing_agreements',
      entity_id: String(agreementId),
      summary: `Created pricing agreement "${title}" for buyer #${buyerProfileId}`,
      metadata: { buyerProfileId, lineCount: savedLines?.length || 0, status },
    });

    return NextResponse.json({
      success: true,
      agreement: {
        ...agreement,
        direction: 'selling',
        lines: savedLines || [],
        line_count: savedLines?.length || 0,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — update header and/or replace lines
 * Body: companyId, privyUserId, id, …fields, lines?
 * Only seller can edit; buyer can only suspend from their side via notes (seller owns).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }

    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const { data: existing, error } = await supabase
      .from('pricing_agreements')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !existing) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
    }

    const sellerId = Number(existing.seller_profile_id);
    const buyerId = Number(existing.buyer_profile_id);
    if (sellerId !== companyId && buyerId !== companyId) {
      return NextResponse.json({ error: 'Not a party to this agreement' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };

    // Seller can edit commercial terms; buyer can only acknowledge status flips they care about
    if (sellerId === companyId) {
      for (const f of [
        'title',
        'status',
        'currency',
        'effective_from',
        'effective_to',
        'payment_terms',
        'notes',
      ] as const) {
        if (body[f] !== undefined) updates[f] = body[f];
      }
    } else {
      // Buyer: limited — request suspend via metadata flag only if status suspend
      if (body.status === 'suspended') {
        updates.status = 'suspended';
        updates.metadata = {
          ...(typeof existing.metadata === 'object' && existing.metadata
            ? (existing.metadata as object)
            : {}),
          suspended_by_buyer: mem.userId,
          suspended_at: now,
        };
      }
    }

    const { data: updated, error: upErr } = await supabase
      .from('pricing_agreements')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Replace lines when seller sends lines array
    if (sellerId === companyId && Array.isArray(body.lines)) {
      await supabase.from('pricing_agreement_lines').delete().eq('agreement_id', id);
      const lines: PricingAgreementLine[] = [];
      for (const raw of body.lines) {
        const line = normalizeLineInput(raw);
        if (line) lines.push(line);
      }
      if (lines.length) {
        const payloads = lines.map((l, idx) => ({
          agreement_id: id,
          seller_product_id: l.seller_product_id || null,
          product_name: l.product_name,
          sku: l.sku || null,
          uom: l.uom || 'unit',
          list_price: l.list_price,
          min_qty: l.min_qty ?? 1,
          max_qty: l.max_qty ?? null,
          currency: l.currency || updated.currency || 'ZAR',
          discount_pct: l.discount_pct || 0,
          notes: l.notes || null,
          suggested_resale_price: l.suggested_resale_price ?? null,
          specs_sheet_url: l.specs_sheet_url || null,
          specs_sheet_name: l.specs_sheet_name || null,
          primary_image_url: l.primary_image_url || null,
          sort_order: l.sort_order ?? idx,
          updated_at: now,
        }));
        await supabase.from('pricing_agreement_lines').insert(payloads);
      }
    }

    const { data: savedLines } = await supabase
      .from('pricing_agreement_lines')
      .select('*')
      .eq('agreement_id', id)
      .order('sort_order', { ascending: true });

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'pricing.agreement_update',
      entity_type: 'pricing_agreements',
      entity_id: String(id),
      summary: `Updated pricing agreement #${id}`,
      metadata: { status: updated.status },
    });

    return NextResponse.json({
      success: true,
      agreement: {
        ...updated,
        direction: sellerId === companyId ? 'selling' : 'buying',
        lines: savedLines || [],
        line_count: savedLines?.length || 0,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function enrichAgreement(
  r: Record<string, unknown>,
  companyId: number,
  names: Map<number, string>,
  lines: PricingAgreementLine[]
): PricingAgreement {
  const sellerId = Number(r.seller_profile_id);
  const buyerId = Number(r.buyer_profile_id);
  return {
    ...(r as unknown as PricingAgreement),
    seller_name: names.get(sellerId) || null,
    buyer_name: names.get(buyerId) || null,
    direction: sellerId === companyId ? 'selling' : 'buying',
    lines,
    line_count: lines.length,
  };
}

async function loadPeerNames(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return map;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name')
    .in('id', unique);
  for (const p of data || []) {
    map.set(Number(p.id), p.trading_name || p.legal_name || `Company #${p.id}`);
  }
  return map;
}
