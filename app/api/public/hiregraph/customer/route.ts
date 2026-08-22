/**
 * HireAdvisor® B2C customer portal API (token auth).
 *
 * GET  ?token=  — catalogue, my hires, KYC, quotes context
 * POST { token, action: book | cancel | set_kyc | update_profile | quote }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import { saveAdvisorModuleStore } from '@/lib/business/company-data';
import {
  HIREGRAPH_CUSTOMER_TOKENS_KEY,
  HIREGRAPH_META_KEY,
  HIRE_REQUIREMENT_LABELS,
  applyWalletToHirePortal,
  buildHireCustomerPortalPayload,
  findPortalByToken,
  parseCompanyIdFromHireCustomerToken,
  parseCompanyIdFromHirePublicToken,
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
  applyCompanyLogoToSettings,
  pickCompanyLogoUrl,
} from '@/lib/business/company-logo';
import { identityFromProfile } from '@/lib/b2c/identity';
import { loadB2cProfile } from '@/lib/b2c/profile-store';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
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
  const { data: c, error } = await supabase
    .from('customers')
    .select('id, trading_name, legal_name, email, phone, contact_name, city, status')
    .eq('profile_id', companyId)
    .eq('id', crmId)
    .maybeSingle();
  if (error || !c) return null;
  return {
    id: Number(c.id),
    name: String(
      c.trading_name || c.legal_name || c.contact_name || `Customer #${c.id}`
    ),
    email: c.email,
    phone: c.phone,
    city: c.city,
    status: c.status,
    linked_profile_id: null,
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
  if (!clean || clean.length < 8) return null;
  if (parseCompanyIdFromHirePublicToken(clean) && !parseCompanyIdFromHireCustomerToken(clean)) {
    return null;
  }

  const loaded = await loadAdvisorStoreForPublicToken({
    token: clean,
    moduleKey: HIREGRAPH_META_KEY,
    read: readHiregraphFromMetadata,
    parseCompanyId: parseCompanyIdFromHireCustomerToken,
    indexKeys: [HIREGRAPH_CUSTOMER_TOKENS_KEY],
    fresh: true,
  });
  if (!loaded) return null;

  const { meta, store } = loaded;
  const portal = findPortalByToken(store, clean);
  if (!portal) return null;

  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, logo_url')
    .eq('id', loaded.companyId)
    .maybeSingle();
  applyCompanyLogoToSettings(store, pickCompanyLogoUrl(prof));

  const fromCrm = await loadCoreCustomer(
    loaded.companyId,
    portal.crm_customer_id
  );
  const customer: HireCorePartyRef = fromCrm || {
    id: portal.crm_customer_id,
    name:
      String(portal.preferred_email || '').split('@')[0] ||
      `Customer #${portal.crm_customer_id}`,
    email: portal.preferred_email || null,
    phone: portal.preferred_phone || null,
    city: null,
    status: 'active',
    linked_profile_id: null,
  };

  const companyName = String(
    store.settings?.brand_name ||
      prof?.trading_name ||
      prof?.legal_name ||
      ''
  ).trim() || null;

  return {
    companyId: loaded.companyId,
    meta,
    store,
    portal,
    customer,
    companyName,
  };
}

async function saveStore(
  companyId: number,
  _meta: Record<string, unknown>,
  store: HiregraphStore
) {
  await saveAdvisorModuleStore(
    companyId,
    HIREGRAPH_META_KEY,
    store,
    writeHiregraphToMetadata
  );
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

    // Touch last_seen and, if this visitor is an SA Member, stamp wallet details.
    const key = String(resolved.portal.crm_customer_id);
    let store = resolved.store;
    let portal = {
      ...resolved.portal,
      last_seen_at: new Date().toISOString(),
    };
    store = {
      ...store,
      customer_portals: {
        ...(store.customer_portals || {}),
        [key]: portal,
      },
    };
    try {
      const auth = await requireVerifiedUser(request, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (auth.ok) {
        const userId = getCanonicalUserId(auth.userId);
        const wallet = userId ? await loadB2cProfile(userId) : null;
        if (wallet) {
          const stamped = applyWalletToHirePortal(
            store,
            resolved.portal.crm_customer_id,
            {
              user_id: wallet.user_id,
              full_name: wallet.full_name,
              email: wallet.email,
              phone: wallet.phone,
              photo_url: wallet.photo_url,
              city: wallet.city,
              id_number: wallet.id_number,
              identity: identityFromProfile(wallet),
            }
          );
          store = stamped.store;
          portal = { ...stamped.portal, last_seen_at: portal.last_seen_at };
          if (wallet.full_name) {
            resolved.customer = {
              ...resolved.customer,
              name: wallet.full_name,
              email: wallet.email || resolved.customer.email,
              phone: wallet.phone || resolved.customer.phone,
              city: wallet.city || resolved.customer.city,
            };
          }
        }
      }
    } catch {
      /* portal works without a wallet session */
    }
    try {
      await saveStore(resolved.companyId, resolved.meta, store);
    } catch {
      /* non-fatal */
    }

    return NextResponse.json(
      portalJson(
        store,
        portal,
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
        start_date: body.start_date ? String(body.start_date) : null,
        end_date: body.end_date ? String(body.end_date) : null,
        delivery_address: body.delivery_address
          ? String(body.delivery_address)
          : null,
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

      const qty = Math.max(1, Number(body.qty) || 1);
      const start = body.start_date ? String(body.start_date) : null;
      const end = body.end_date ? String(body.end_date) : null;
      const { applyDateUnits, itemConflict } = await import(
        '@/lib/hire/availability'
      );
      const { findAvailableUnits } = await import(
        '@/lib/hire/true-availability'
      );
      const dated = applyDateUnits(
        {
          start_date: start,
          end_date: end,
          units: Number(body.units) || 1,
        },
        item.rate_unit
      );
      const units = dated.units;
      let assignedUnitId: string | null = null;
      if (dated.start_date) {
        const startDay = new Date(`${dated.start_date}T08:00:00`);
        const endDay = new Date(
          `${dated.end_date || dated.start_date}T18:00:00`
        );
        const unitsHit = findAvailableUnits(store, {
          itemId,
          rentalStart: startDay,
          rentalEnd: endDay,
          qty,
        });
        if ((store.units || []).some((u) => u.item_id === itemId && u.active !== false) && !unitsHit.ok) {
          return NextResponse.json(
            { error: unitsHit.reason || 'That unit is not free for those times' },
            { status: 409 }
          );
        }
        assignedUnitId = unitsHit.units[0]?.id || null;
        const clash = itemConflict(store, {
          itemId: itemId,
          start: dated.start_date,
          end: dated.end_date,
          qty,
        });
        if (clash.conflict) {
          return NextResponse.json(
            {
              error: clash.blocking
                ? `Already hired ${String(clash.blocking.start_date || '').slice(0, 10)} → ${String(clash.blocking.end_date || clash.blocking.start_date || '').slice(0, 10)}. Pick free dates.`
                : 'Those dates overlap an existing hire',
            },
            { status: 409 }
          );
        }
      }
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
        start_date: dated.start_date,
        end_date: dated.end_date,
        delivery_address: delivery,
      });
      const status =
        quote && quote.pending.length > 0
          ? 'awaiting_requirements'
          : 'requested';

      store = upsertEntity(store, 'bookings', {
        code,
        item_id: itemId,
        unit_id: assignedUnitId,
        crm_customer_id: crmId,
        customer_name: customer.name,
        srm_supplier_id: item.srm_supplier_id ?? null,
        supplier_name: item.supplier_name || '',
        start_date: dated.start_date,
        end_date: dated.end_date,
        occupy_start_at: dated.start_date
          ? `${dated.start_date}T08:00:00`
          : null,
        occupy_end_at: dated.end_date
          ? `${dated.end_date}T18:00:00`
          : dated.start_date
            ? `${dated.start_date}T18:00:00`
            : null,
        units,
        qty,
        delivery_address: delivery,
        delivery_fee_zar: quote?.delivery_zar ?? 0,
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
            ? 'Hire requested — finish documents under You, then track it on Coming'
            : 'Hire requested — track when it is coming on the Coming tab',
      });
    }

    if (action === 'extend') {
      const bookingId = String(body.booking_id || body.id || '');
      const newEnd = String(body.end_date || '').slice(0, 10);
      const booking = store.bookings.find(
        (b) =>
          b.id === bookingId &&
          Number(b.crm_customer_id || b.customer_id) === crmId
      );
      if (!booking) {
        return NextResponse.json({ error: 'Hire not found' }, { status: 404 });
      }
      const { canExtendBooking, applyDateUnits } = await import(
        '@/lib/hire/availability'
      );
      const check = canExtendBooking(store, booking, newEnd);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      const dated = applyDateUnits(
        {
          start_date: booking.start_date,
          end_date: newEnd,
          units: booking.units,
        },
        check.item?.rate_unit
      );
      store = upsertEntity(store, 'bookings', {
        ...booking,
        end_date: dated.end_date,
        units: dated.units,
        notes: booking.notes
          ? `${booking.notes}\nCustomer extended to ${newEnd}`
          : `Customer extended to ${newEnd}`,
      });
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        ...portalJson(store, portal, customer, companyName, companyId),
        message: `Hire extended to ${newEnd} — extra ${check.extraUnits} unit(s) quoted`,
      });
    }

    return NextResponse.json(
      {
        error:
          'Unknown action. Use: book, cancel, extend, set_kyc, update_profile, quote',
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
