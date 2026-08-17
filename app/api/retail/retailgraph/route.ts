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
  issueRetailPublicToken,
  newRetailId,
  readRetailgraphFromMetadata,
  summariseRetailgraph,
  writeRetailgraphToMetadata,
  RETAILGRAPH_META_KEY,
  type RetailPublicSettings,
  type RetailSku,
} from '@/lib/retail/retailgraph';
import {
  loadAdvisorModuleStore,
  saveAdvisorModuleStore,
} from '@/lib/business/company-data';
import {
  applyAnnouncementAction,
  isAnnouncementAction,
} from '@/lib/services/member-announcements';
import { expireSession, readTillSessions } from '@/lib/till/sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function load(companyId: number) {
  const supabase = getSupabaseServer();
  const [{ meta, store: raw }, { data: prof }] = await Promise.all([
    loadAdvisorModuleStore(
      companyId,
      RETAILGRAPH_META_KEY,
      readRetailgraphFromMetadata,
      ['till_sessions']
    ),
    supabase
      .from('profiles')
      .select('trading_name, legal_name')
      .eq('id', companyId)
      .maybeSingle(),
  ]);
  const store = ensureRetailPublicToken(raw, companyId);
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
    const { meta, store, brand } = await load(companyId);
    if (!readRetailgraphFromMetadata(meta).settings.public_token) {
      await saveAdvisorModuleStore(
        companyId,
        RETAILGRAPH_META_KEY,
        store,
        writeRetailgraphToMetadata
      );
    }
    const sessions = readTillSessions(meta).map((s) => expireSession(s));
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
    let message = 'Saved';

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
    } else if (action === 'update_settings') {
      const patch =
        body.settings && typeof body.settings === 'object'
          ? (body.settings as RetailPublicSettings)
          : {};
      store.settings = {
        ...store.settings,
        ...patch,
      };
      const next = ensureRetailPublicToken(store, companyId);
      if (body.rotate_token === true) {
        next.settings.public_token = issueRetailPublicToken(companyId);
      }
      Object.assign(store, next);
    } else if (isAnnouncementAction(action)) {
      try {
        const result = applyAnnouncementAction(store.announcements, action, body);
        store.announcements = result.list;
        message = result.message;
      } catch (e: unknown) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Announcement failed' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    await saveAdvisorModuleStore(
      companyId,
      RETAILGRAPH_META_KEY,
      store,
      writeRetailgraphToMetadata
    );
    return NextResponse.json({
      success: true,
      store,
      message,
      summary: summariseRetailgraph(store, readTillSessions(meta)),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
