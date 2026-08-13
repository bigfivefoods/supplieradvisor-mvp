/**
 * HireAdvisor® B2C customer portal API (token auth).
 *
 * GET  ?token=  — catalogue, my hires, KYC, quotes context
 * POST { token, action: book | cancel | set_kyc | update_profile | quote }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  HIREGRAPH_CUSTOMER_TOKENS_KEY,
  HIRE_REQUIREMENT_LABELS,
  buildHireCustomerPortalPayload,
  findPortalByToken,
  parseCompanyIdFromHireCustomerToken,
  quoteHireBooking,
  readHiregraphFromMetadata,
  upsertEntity,
  writeHiregraphToMetadata,
  type HireCorePartyRef,
  type HireCustomerPortal,
  type HireRequirementKey,
  type HiregraphStore,
} from '@/lib/hire/hiregraph';
import {
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadCoreCustomer(
  companyId: number,
  crmId: number
): Promise<HireCorePartyRef | null> {
  const supabase = getSupabaseServer();
  const { data: c } = await supabase
    .from('customers')
    .select(
      'id, trading_name, legal_name, email, phone, contact_name, city, status, linked_profile_id'
    )
    .eq('profile_id', companyId)
    .eq('id', crmId)
    .maybeSingle();
  if (!c) return null;
  return {
    id: Number(c.id),
    name: String(
      c.trading_name || c.legal_name || c.contact_name || `Customer #${c.id}`
    ),
    email: c.email,
    phone: c.phone,
    city: c.city,
    status: c.status,
    linked_profile_id: c.linked_profile_id
      ? Number(c.linked_profile_id)
      : null,
  };
}

async function resolveCustomer(
  token: string
): Promise<{
  companyId: number;
  meta: Record<string, unknown>;
  store: HiregraphStore;
  portal: HireCustomerPortal;
  customer: HireCorePartyRef;
  companyName: string | null;
} | null> {
  const clean = String(token || '').trim();
  if (!clean || clean.length < 12) return null;
  const supabase = getSupabaseServer();

  let companyId = parseCompanyIdFromHireCustomerToken(clean);

  if (companyId == null) {
    // Slow path: scan token index on metadata
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, metadata')
      .not('metadata', 'is', null)
      .limit(200);
    for (const row of rows || []) {
      const meta =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {};
      const map = meta[HIREGRAPH_CUSTOMER_TOKENS_KEY];
      if (map && typeof map === 'object' && clean in (map as object)) {
        companyId = Number(row.id);
        break;
      }
      const store = readHiregraphFromMetadata(meta);
      if (findPortalByToken(store, clean)) {
        companyId = Number(row.id);
        break;
      }
    }
  }

  if (companyId == null || !Number.isFinite(companyId)) return null;

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, metadata, company_name, trading_name, name')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;

  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  const store = readHiregraphFromMetadata(meta);
  const portal = findPortalByToken(store, clean);
  if (!portal) return null;

  const customer = await loadCoreCustomer(companyId, portal.crm_customer_id);
  if (!customer) return null;

  const companyName = String(
    store.settings?.brand_name ||
      (prof as { trading_name?: string }).trading_name ||
      (prof as { company_name?: string }).company_name ||
      (prof as { name?: string }).name ||
      ''
  ).trim() || null;

  return {
    companyId: Number(prof.id),
    meta,
    store,
    portal,
    customer,
    companyName,
  };
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: HiregraphStore
) {
  const supabase = getSupabaseServer();
  const nextMeta = writeHiregraphToMetadata(meta, store);
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

function portalJson(
  store: HiregraphStore,
  portal: HireCustomerPortal,
  customer: HireCorePartyRef,
  companyName: string | null,
  companyId: number
) {
  return {
    success: true,
    companyId,
    portal: buildHireCustomerPortalPayload(store, portal, customer, {
      companyName,
    }),
    commercial: {
      customer_commission_pct: HIRE_CUSTOMER_COMMISSION_PCT,
      supplier_commission_pct: HIRE_SUPPLIER_COMMISSION_PCT,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-hire-cust:${ip}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const resolved = await resolveCustomer(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Customer portal not found or revoked' },
        { status: 404 }
      );
    }

    // Touch last_seen
    const key = String(resolved.portal.crm_customer_id);
    const portals = { ...(resolved.store.customer_portals || {}) };
    portals[key] = {
      ...resolved.portal,
      last_seen_at: new Date().toISOString(),
    };
    const store = { ...resolved.store, customer_portals: portals };
    try {
      await saveStore(resolved.companyId, resolved.meta, store);
    } catch {
      /* non-fatal */
    }

    return NextResponse.json(
      portalJson(
        store,
        portals[key],
        resolved.customer,
        resolved.companyName,
        resolved.companyId
      )
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-hire-cust-post:${ip}`,
      limit: 40,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const token = String(body.token || '').trim();
    const action = String(body.action || 'book');
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const resolved = await resolveCustomer(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Customer portal not found or revoked' },
        { status: 404 }
      );
    }

    let { store, portal, customer, companyId, meta, companyName } = resolved;
    const crmId = portal.crm_customer_id;

    if (action === 'quote') {
      const q = quoteHireBooking(store, {
        item_id: String(body.item_id || ''),
        units: Number(body.units) || 1,
        qty: Number(body.qty) || 1,
        crm_customer_id: crmId,
      });
      if (!q) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, quote: q });
    }

    if (action === 'set_kyc' || action === 'update_requirements') {
      const reqs = Array.isArray(body.requirements_met)
        ? (body.requirements_met as HireRequirementKey[])
        : Array.isArray(body.kyc)
          ? (body.kyc as HireRequirementKey[])
          : [];
      // Only allow known requirement keys
      const allowed = new Set(Object.keys(HIRE_REQUIREMENT_LABELS));
      const clean = reqs.filter((r) => allowed.has(String(r)));
      store = {
        ...store,
        customer_kyc: {
          ...store.customer_kyc,
          [String(crmId)]: clean,
        },
      };
      // Re-enrich open bookings so pending requirements refresh
      let working = store;
      for (const b of store.bookings) {
        if (Number(b.crm_customer_id || b.customer_id) !== crmId) continue;
        if (
          !['requested', 'awaiting_requirements', 'approved'].includes(
            String(b.status || '')
          )
        ) {
          continue;
        }
        const nextStatus =
          // if was awaiting and now no pending after enrich, flip to requested
          b.status;
        working = upsertEntity(working, 'bookings', {
          ...b,
          status: nextStatus,
        });
        const refreshed = working.bookings.find((x) => x.id === b.id);
        if (
          refreshed &&
          String(refreshed.status) === 'awaiting_requirements' &&
          !(refreshed.requirements_pending || []).length
        ) {
          working = upsertEntity(working, 'bookings', {
            ...refreshed,
            status: 'requested',
          });
        }
      }
      store = working;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        ...portalJson(store, portal, customer, companyName, companyId),
        message: 'Hire requirements updated',
      });
    }

    if (action === 'update_profile' || action === 'update_contact') {
      const key = String(crmId);
      const nextPortal: HireCustomerPortal = {
        ...portal,
        preferred_email:
          body.email != null
            ? String(body.email).trim() || null
            : portal.preferred_email,
        preferred_phone:
          body.phone != null
            ? String(body.phone).trim() || null
            : portal.preferred_phone,
        delivery_default:
          body.delivery_address != null || body.delivery_default != null
            ? String(body.delivery_address || body.delivery_default || '').trim() ||
              null
            : portal.delivery_default,
        last_seen_at: new Date().toISOString(),
      };
      store = {
        ...store,
        customer_portals: {
          ...(store.customer_portals || {}),
          [key]: nextPortal,
        },
      };
      portal = nextPortal;
      // Reflect on customer display for this response
      if (nextPortal.preferred_email) customer = { ...customer, email: nextPortal.preferred_email };
      if (nextPortal.preferred_phone) customer = { ...customer, phone: nextPortal.preferred_phone };
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        ...portalJson(store, portal, customer, companyName, companyId),
        message: 'Contact preferences saved',
      });
    }

    if (action === 'cancel' || action === 'cancel_booking') {
      const bookingId = String(body.booking_id || body.id || '');
      const bi = store.bookings.findIndex(
        (b) =>
          b.id === bookingId &&
          Number(b.crm_customer_id || b.customer_id) === crmId
      );
      if (bi < 0) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      const b = store.bookings[bi];
      if (
        !['requested', 'awaiting_requirements', 'approved'].includes(
          String(b.status || '')
        )
      ) {
        return NextResponse.json(
          {
            error:
              'Only requested / awaiting documents / approved hires can be cancelled from the portal',
          },
          { status: 400 }
        );
      }
      const bookings = [...store.bookings];
      bookings[bi] = {
        ...b,
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      };
      store = { ...store, bookings };
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        ...portalJson(store, portal, customer, companyName, companyId),
        message: 'Hire request cancelled',
      });
    }

    if (action === 'book' || action === 'request_hire' || action === 'request') {
      if (store.settings?.allow_portal_booking === false) {
        return NextResponse.json(
          { error: 'Online hire requests are disabled by the marketplace' },
          { status: 403 }
        );
      }
      const itemId = String(body.item_id || '');
      const item = store.items.find(
        (i) =>
          i.id === itemId &&
          i.active !== false &&
          (i.status === 'listed' || i.status === 'hired_out' || !i.status)
      );
      if (!item) {
        return NextResponse.json(
          { error: 'Item not available for hire' },
          { status: 404 }
        );
      }

      const units = Math.max(1, Number(body.units) || 1);
      const qty = Math.max(1, Number(body.qty) || 1);
      const start = body.start_date ? String(body.start_date) : null;
      const end = body.end_date ? String(body.end_date) : null;
      const delivery =
        String(body.delivery_address || portal.delivery_default || '').trim() ||
        '';
      const notes = body.notes ? String(body.notes) : '';
      const code =
        String(body.code || '').trim() ||
        `H${Date.now().toString(36).toUpperCase().slice(-6)}`;

      // Pre-check requirements for status
      const quote = quoteHireBooking(store, {
        item_id: itemId,
        units,
        qty,
        crm_customer_id: crmId,
      });
      const status =
        quote && quote.pending.length > 0
          ? 'awaiting_requirements'
          : 'requested';

      store = upsertEntity(store, 'bookings', {
        code,
        item_id: itemId,
        crm_customer_id: crmId,
        customer_name: customer.name,
        srm_supplier_id: item.srm_supplier_id ?? null,
        supplier_name: item.supplier_name || '',
        start_date: start,
        end_date: end,
        units,
        qty,
        delivery_address: delivery,
        notes: notes ? `Portal: ${notes}` : 'Customer portal hire request',
        status,
        source: 'customer_portal',
      });

      await saveStore(companyId, meta, store);
      const created = store.bookings[0];
      return NextResponse.json({
        ...portalJson(store, portal, customer, companyName, companyId),
        booking_id: created?.id,
        message:
          status === 'awaiting_requirements'
            ? 'Hire requested — complete outstanding requirements in the Requirements tab'
            : 'Hire requested — the marketplace will confirm shortly',
      });
    }

    return NextResponse.json(
      {
        error:
          'Unknown action. Use: book, cancel, set_kyc, update_profile, quote',
      },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
