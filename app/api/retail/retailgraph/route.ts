/**
 * RetailAdvisor® store — catalogue, customers, sales.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  ensureRetailPublicToken,
  newRetailId,
  readRetailgraphFromMetadata,
  summariseRetailgraph,
  writeRetailgraphToMetadata,
  type RetailSku,
} from '@/lib/retail/retailgraph';
import { expireSession, readTillSessions } from '@/lib/till/sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function load(companyId: number) {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('metadata, trading_name, legal_name')
    .eq('id', companyId)
    .maybeSingle();
  const meta =
    prof?.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  const store = ensureRetailPublicToken(readRetailgraphFromMetadata(meta));
  return {
    supabase,
    meta,
    store,
    brand: String(prof?.trading_name || prof?.legal_name || ''),
  };
}

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
    const { supabase, meta, store, brand } = await load(companyId);
    const nextMeta = writeRetailgraphToMetadata(meta, store);
    if (!readRetailgraphFromMetadata(meta).settings.public_token) {
      await supabase.from('profiles').update({ metadata: nextMeta }).eq('id', companyId);
    }
    const sessions = readTillSessions(nextMeta).map((s) => expireSession(s));
    return NextResponse.json({
      success: true,
      store,
      brand,
      summary: summariseRetailgraph(store, sessions),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const { supabase, meta, store } = await load(companyId);
    const action = String(body.action || '');

    if (action === 'upsert_sku') {
      const name = String(body.name || '').trim();
      const price = Number(body.price_zar);
      if (!name || !Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: 'Name and price required' }, { status: 400 });
      }
      const id = String(body.id || newRetailId('sku'));
      const sku: RetailSku = {
        id,
        name,
        sku: String(body.sku || '').trim() || undefined,
        price_zar: Math.round(price * 100) / 100,
        active: body.active === false ? false : true,
      };
      const idx = store.skus.findIndex((s) => s.id === id);
      if (idx >= 0) store.skus[idx] = sku;
      else store.skus.unshift(sku);
    } else if (action === 'delete_sku') {
      store.skus = store.skus.filter((s) => s.id !== String(body.id || ''));
    } else if (action === 'upsert_customer') {
      const name = String(body.name || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Name required' }, { status: 400 });
      }
      const id = String(body.id || newRetailId('cus'));
      const row = {
        id,
        name,
        email: String(body.email || '').trim() || null,
        phone: String(body.phone || '').trim() || null,
      };
      const idx = store.customers.findIndex((c) => c.id === id);
      if (idx >= 0) store.customers[idx] = row;
      else store.customers.unshift(row);
    } else if (action === 'record_cash_sale') {
      const lines = Array.isArray(body.lines)
        ? (body.lines as Array<{ name: string; qty: number; unit_zar: number }>)
        : [];
      const total = lines.reduce(
        (n, l) => n + (Number(l.qty) || 0) * (Number(l.unit_zar) || 0),
        0
      );
      if (!lines.length || total <= 0) {
        return NextResponse.json({ error: 'Basket empty' }, { status: 400 });
      }
      store.sales.unshift({
        id: newRetailId('sal'),
        created_at: new Date().toISOString(),
        lines,
        total_zar: Math.round(total * 100) / 100,
        status: 'paid',
        paid_via: 'cash',
        till_token: body.till_token ? String(body.till_token) : null,
      });
      store.sales = store.sales.slice(0, 200);
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const nextMeta = writeRetailgraphToMetadata(meta, store);
    const { error } = await supabase
      .from('profiles')
      .update({ metadata: nextMeta })
      .eq('id', companyId);
    if (error) throw new Error(error.message);
    return NextResponse.json({
      success: true,
      store,
      summary: summariseRetailgraph(store, readTillSessions(nextMeta)),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
