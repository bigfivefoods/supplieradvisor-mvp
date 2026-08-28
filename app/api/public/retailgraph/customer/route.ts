/**
 * RetailAdvisor® customer portal (token auth).
 * GET  ?token= — shop, orders, profile
 * POST { token, action: update_profile | upload_photo }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import { saveAdvisorModuleStore } from '@/lib/business/company-data';
import {
  RETAILGRAPH_CUSTOMER_TOKENS_KEY,
  RETAILGRAPH_META_KEY,
  buildRetailCustomerPortalPayload,
  findRetailCustomerByPortalToken,
  parseCompanyIdFromRetailCustomerToken,
  readRetailgraphFromMetadata,
  writeRetailgraphToMetadata,
  type RetailCustomer,
  type RetailgraphStore,
} from '@/lib/retail/retailgraph';
import {
  applyCompanyLogoToSettings,
  pickCompanyLogoUrl,
} from '@/lib/business/company-logo';
import {
  applyPortalProfileUpdate,
  portalProfileSaveMessage,
} from '@/lib/services/portal-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolveCustomer(token: string): Promise<{
  companyId: number;
  meta: Record<string, unknown>;
  store: RetailgraphStore;
  customer: RetailCustomer;
  companyName: string | null;
} | null> {
  const clean = String(token || '').trim();
  if (!clean || clean.length < 8) return null;
  const loaded = await loadAdvisorStoreForPublicToken({
    token: clean,
    moduleKey: RETAILGRAPH_META_KEY,
    read: readRetailgraphFromMetadata,
    parseCompanyId: parseCompanyIdFromRetailCustomerToken,
    indexKeys: [RETAILGRAPH_CUSTOMER_TOKENS_KEY],
  });
  if (!loaded) return null;
  const customer = findRetailCustomerByPortalToken(loaded.store, clean);
  if (!customer) return null;
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, logo_url')
    .eq('id', loaded.companyId)
    .maybeSingle();
  if (!prof) return null;
  applyCompanyLogoToSettings(loaded.store, pickCompanyLogoUrl(prof));
  const companyName = String(
    loaded.store.settings?.brand_name ||
      prof.trading_name ||
      prof.legal_name ||
      ''
  ).trim() || null;
  return {
    companyId: loaded.companyId,
    meta: loaded.meta,
    store: loaded.store,
    customer,
    companyName,
  };
}

async function saveStore(companyId: number, store: RetailgraphStore) {
  await saveAdvisorModuleStore(
    companyId,
    RETAILGRAPH_META_KEY,
    store,
    writeRetailgraphToMetadata
  );
}

function portalJson(
  store: RetailgraphStore,
  customer: RetailCustomer,
  companyName: string | null,
  companyId: number
) {
  return {
    success: true,
    companyId,
    portal: buildRetailCustomerPortalPayload(store, customer, { companyName }),
  };
}

export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-retail-cust:${ip}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    const resolved = await resolveCustomer(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Customer portal not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      portalJson(
        resolved.store,
        resolved.customer,
        resolved.companyName,
        resolved.companyId
      )
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-retail-cust-post:${ip}`,
      limit: 40,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
    const { tryHandlePortalPhotoMultipart } = await import(
      '@/lib/services/person-photo-upload'
    );
    const photoRes = await tryHandlePortalPhotoMultipart(request, {
      kind: 'customer_photo',
      notFound: 'Customer portal not found',
      resolve: resolveCustomer,
      persist: async (resolved, url) => {
        const idx = resolved.store.customers.findIndex(
          (c) => c.id === resolved.customer.id
        );
        if (idx >= 0) {
          resolved.store.customers[idx] = {
            ...resolved.store.customers[idx],
            photo_url: url,
            updated_at: new Date().toISOString(),
          };
        }
        await saveStore(resolved.companyId, resolved.store);
      },
    });
    if (photoRes) return photoRes;
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token || '').trim();
    const action = String(body.action || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    const resolved = await resolveCustomer(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Customer portal not found' },
        { status: 404 }
      );
    }
    const { companyId, store } = resolved;
    const idx = store.customers.findIndex((c) => c.id === resolved.customer.id);
    if (idx < 0) {
      return NextResponse.json(
        { error: 'Customer portal not found' },
        { status: 404 }
      );
    }

    if (action === 'update_profile') {
      const prev = store.customers[idx];
      const person = {
        ...prev,
        email: prev.email || undefined,
        phone: prev.phone || undefined,
        photo_url: prev.photo_url || undefined,
      };
      const result = applyPortalProfileUpdate(person, body, {
        now: new Date().toISOString(),
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.customers[idx] = {
        ...person,
        email: person.email || null,
        phone: person.phone || null,
        photo_url: person.photo_url || null,
      };
      {
        const { attachCrmToAdvisorPerson } = await import(
          '@/lib/b2c/member-account-ar'
        );
        await attachCrmToAdvisorPerson({
          companyId,
          kind: 'retail',
          person: store.customers[idx],
        });
      }
      await saveStore(companyId, store);
      try {
        const { writeThroughPortalIdentity } = await import(
          '@/lib/b2c/wallet-household'
        );
        await writeThroughPortalIdentity({
          id: person.id,
          name: person.name,
          email: person.email,
          phone: person.phone,
          photo_url: person.photo_url,
        });
      } catch {
        /* wallet write-through is best-effort */
      }
      return NextResponse.json({
        ...portalJson(
          store,
          store.customers[idx],
          resolved.companyName,
          companyId
        ),
        message: portalProfileSaveMessage(result, body, 'shop records'),
      });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use: update_profile' },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
