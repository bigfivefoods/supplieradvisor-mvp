import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  HIRE_CATEGORIES,
  HIRE_REQUIREMENT_LABELS,
  deleteEntity,
  hireCustomerPortalPath,
  hireCustomerPortalUrl,
  issueCustomerPortal,
  readHiregraphFromMetadata,
  summariseHiregraph,
  upsertEntity,
  writeHiregraphToMetadata,
  ensureHirePublicToken,
  issueHirePublicToken,
  type HireCorePartyRef,
  type HireEntity,
  type HiregraphStore,
  type HirePublicSettings,
  type HireRequirementKey,
} from '@/lib/hire/hiregraph';
import {
  HIRE_COMMERCIAL_COPY,
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_PLATFORM_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';
import {
  hireInviteWhatsAppText,
  memberAppLink,
  whatsappShareUrl,
} from '@/lib/b2c/member-app';
import {
  hireCustomerInviteEmailHtml,
  hireCustomerInviteEmailText,
} from '@/lib/b2c/hire-invite-email';
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { listInventoryProductForHire } from '@/lib/hire/list-from-inventory';
import {
  applyAnnouncementAction,
  isAnnouncementAction,
} from '@/lib/services/member-announcements';

export const runtime = 'nodejs';

const ENTITIES: HireEntity[] = ['items', 'bookings', 'handovers'];

function isEntity(v: unknown): v is HireEntity {
  return typeof v === 'string' && (ENTITIES as string[]).includes(v);
}

async function loadStore(companyId: number) {
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
  const companyName = String(
    prof?.trading_name || prof?.legal_name || `Company #${companyId}`
  );
  return {
    meta,
    store: readHiregraphFromMetadata(meta),
    supabase,
    companyName,
  };
}

async function loadCoreBooks(companyId: number) {
  const supabase = getSupabaseServer();
  const [{ data: srm }, { data: crm }] = await Promise.all([
    supabase
      .from('srm_suppliers')
      .select(
        'id, trading_name, legal_name, email, phone, contact_name, city, status, linked_profile_id'
      )
      .eq('profile_id', companyId)
      .order('trading_name')
      .limit(500),
    supabase
      .from('customers')
      .select(
        'id, trading_name, legal_name, email, phone, contact_name, city, status, linked_profile_id, address'
      )
      .eq('profile_id', companyId)
      .order('trading_name')
      .limit(500),
  ]);

  const coreSuppliers: HireCorePartyRef[] = (srm || []).map((s) => ({
    id: Number(s.id),
    name: String(s.trading_name || s.legal_name || `Supplier #${s.id}`),
    email: s.email,
    phone: s.phone,
    city: s.city,
    status: s.status,
    linked_profile_id: s.linked_profile_id
      ? Number(s.linked_profile_id)
      : null,
  }));

  const coreCustomers: HireCorePartyRef[] = (crm || []).map((c) => ({
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
  }));

  return { coreSuppliers, coreCustomers };
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
  return nextMeta;
}

function denormaliseNames(
  store: HiregraphStore,
  coreSuppliers: HireCorePartyRef[],
  coreCustomers: HireCorePartyRef[]
) {
  const sMap = new Map(coreSuppliers.map((s) => [s.id, s]));
  const cMap = new Map(coreCustomers.map((c) => [c.id, c]));
  for (const item of store.items) {
    const sid = Number(item.srm_supplier_id);
    if (sid && sMap.has(sid)) {
      item.supplier_name = sMap.get(sid)!.name;
    }
  }
  for (const b of store.bookings) {
    const sid = Number(b.srm_supplier_id);
    const cid = Number(b.crm_customer_id || b.customer_id);
    if (sid && sMap.has(sid)) b.supplier_name = sMap.get(sid)!.name;
    if (cid && cMap.has(cid)) {
      b.customer_name = cMap.get(cid)!.name;
      b.crm_customer_id = cid;
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const companyId = Number(req.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const access = await requireCompanyAccess(req, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(req),
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const loaded = await loadStore(companyId);
    let store = ensureHirePublicToken(loaded.store, companyId);
    if (!loaded.store.settings?.public_token) {
      await saveStore(companyId, loaded.meta, store);
    }
    const { coreSuppliers, coreCustomers } = await loadCoreBooks(companyId);
    denormaliseNames(store, coreSuppliers, coreCustomers);

    return NextResponse.json({
      success: true,
      store,
      coreSuppliers,
      coreCustomers,
      summary: summariseHiregraph(store, {
        coreSupplierCount: coreSuppliers.length,
        coreCustomerCount: coreCustomers.length,
      }),
      categories: HIRE_CATEGORIES,
      requirementLabels: HIRE_REQUIREMENT_LABELS,
      commercial: {
        supplier_commission_pct: HIRE_SUPPLIER_COMMISSION_PCT,
        customer_commission_pct: HIRE_CUSTOMER_COMMISSION_PCT,
        platform_commission_pct: HIRE_PLATFORM_COMMISSION_PCT,
        copy: HIRE_COMMERCIAL_COPY,
      },
      links: {
        suppliersModule: '/dashboard/suppliers',
        customersModule: '/dashboard/customers',
        note: 'HireAdvisor uses Core OS Suppliers (SRM) and Customers (CRM). Add parties there, then link them on catalogue and bookings.',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const access = await requireCompanyAccess(req, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(req, body),
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const action = String(body.action || 'upsert');
    const { meta, store, companyName } = await loadStore(companyId);
    const { coreSuppliers, coreCustomers } = await loadCoreBooks(companyId);
    let next: HiregraphStore = store;

    if (action === 'list_from_inventory') {
      const productId = Number(body.productId || body.inventory_product_id);
      if (!Number.isFinite(productId) || productId <= 0) {
        return NextResponse.json(
          { error: 'productId required' },
          { status: 400 }
        );
      }
      const categoryId = String(body.category_id || body.categoryId || '').trim();
      if (!categoryId) {
        return NextResponse.json(
          { error: 'category_id required' },
          { status: 400 }
        );
      }
      let supplierName = String(body.supplier_name || '').trim() || companyName;
      const srmId = Number(body.srm_supplier_id);
      if (Number.isFinite(srmId) && srmId > 0) {
        const s = coreSuppliers.find((x) => x.id === srmId);
        if (!s) {
          return NextResponse.json(
            { error: `Supplier #${srmId} not found in Core Suppliers` },
            { status: 400 }
          );
        }
        supplierName = s.name;
      }
      if (!next.settings?.brand_name) {
        next = {
          ...next,
          settings: {
            ...(next.settings || {}),
            brand_name: companyName,
            allow_portal_booking: true,
          },
        };
      }
      const listed = await listInventoryProductForHire(next, {
        companyId,
        productId,
        categoryId,
        rateZar: Number(body.rate_zar) || 0,
        rateUnit: body.rate_unit ? String(body.rate_unit) : undefined,
        depositZar:
          body.deposit_zar === '' || body.deposit_zar == null
            ? null
            : Number(body.deposit_zar),
        qtyAvailable:
          body.qty_available == null || body.qty_available === ''
            ? null
            : Number(body.qty_available),
        location: body.location ? String(body.location) : null,
        srmSupplierId:
          Number.isFinite(srmId) && srmId > 0 ? srmId : null,
        supplierName,
        description: body.description ? String(body.description) : null,
      });
      next = listed.store;
      await saveStore(companyId, meta, next);
      denormaliseNames(next, coreSuppliers, coreCustomers);
      return NextResponse.json({
        success: true,
        store: next,
        coreSuppliers,
        coreCustomers,
        itemId: listed.itemId,
        listingId: listed.listingId,
        listingWarning: listed.listingWarning || null,
        summary: summariseHiregraph(next, {
          coreSupplierCount: coreSuppliers.length,
          coreCustomerCount: coreCustomers.length,
        }),
        message: listed.listingId
          ? 'Inventory item listed for hire on the marketplace'
          : 'Added to HireAdvisor catalogue' +
            (listed.listingWarning ? ` (${listed.listingWarning})` : ''),
      });
    }

    // Update hire KYC for a core CRM customer
    if (action === 'set_kyc') {
      const crmId = Number(body.crm_customer_id || body.customer_id);
      if (!Number.isFinite(crmId) || crmId <= 0) {
        return NextResponse.json(
          { error: 'crm_customer_id required' },
          { status: 400 }
        );
      }
      const reqs = Array.isArray(body.requirements_met)
        ? (body.requirements_met as HireRequirementKey[])
        : [];
      next = {
        ...store,
        customer_kyc: {
          ...store.customer_kyc,
          [String(crmId)]: reqs,
        },
      };
      await saveStore(companyId, meta, next);
      denormaliseNames(next, coreSuppliers, coreCustomers);
      return NextResponse.json({
        success: true,
        store: next,
        coreSuppliers,
        coreCustomers,
        summary: summariseHiregraph(next, {
          coreSupplierCount: coreSuppliers.length,
          coreCustomerCount: coreCustomers.length,
        }),
      });
    }

    if (isAnnouncementAction(action)) {
      try {
        const result = applyAnnouncementAction(store.announcements, action, body);
        next = { ...store, announcements: result.list };
        await saveStore(companyId, meta, next);
        denormaliseNames(next, coreSuppliers, coreCustomers);
        return NextResponse.json({
          success: true,
          store: next,
          coreSuppliers,
          coreCustomers,
          summary: summariseHiregraph(next, {
            coreSupplierCount: coreSuppliers.length,
            coreCustomerCount: coreCustomers.length,
          }),
          message: result.message,
        });
      } catch (e: unknown) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Announcement failed' },
          { status: 400 }
        );
      }
    }

    // B2C portal brand settings
    if (action === 'update_settings') {
      const patch =
        body.settings && typeof body.settings === 'object'
          ? (body.settings as HirePublicSettings)
          : {};
      next = ensureHirePublicToken(
        {
          ...store,
          settings: {
            ...(store.settings || {}),
            ...patch,
          },
        },
        companyId
      );
      if (body.rotate_token === true) {
        next = {
          ...next,
          settings: {
            ...(next.settings || {}),
            public_token: issueHirePublicToken(companyId),
          },
        };
      }
      await saveStore(companyId, meta, next);
      denormaliseNames(next, coreSuppliers, coreCustomers);
      return NextResponse.json({
        success: true,
        store: next,
        coreSuppliers,
        coreCustomers,
        summary: summariseHiregraph(next, {
          coreSupplierCount: coreSuppliers.length,
          coreCustomerCount: coreCustomers.length,
        }),
      });
    }

    // Issue / re-issue B2C customer portal link
    if (action === 'issue_portal' || action === 'issue_customer_portal') {
      const crmId = Number(body.crm_customer_id || body.customer_id);
      if (!Number.isFinite(crmId) || crmId <= 0) {
        return NextResponse.json(
          { error: 'crm_customer_id required' },
          { status: 400 }
        );
      }
      const customer = coreCustomers.find((c) => c.id === crmId);
      if (!customer) {
        return NextResponse.json(
          {
            error: `Customer #${crmId} not in Core Customers — add them under Customers first`,
          },
          { status: 400 }
        );
      }
      const issued = issueCustomerPortal(store, crmId, {
        companyId,
        invite_email:
          body.invite_email != null
            ? String(body.invite_email)
            : customer.email || null,
      });
      next = issued.store;
      await saveStore(companyId, meta, next);
      denormaliseNames(next, coreSuppliers, coreCustomers);
      const path = hireCustomerPortalPath(issued.portal.portal_token);
      const origin = getAppUrl();
      const appLink = memberAppLink(issued.portal.portal_token);
      const portalLink = hireCustomerPortalUrl(origin, issued.portal.portal_token);
      const brand =
        next.settings?.brand_name || customer.name || 'Hire marketplace';
      const wa = whatsappShareUrl(
        hireInviteWhatsAppText({
          customerName: customer.name,
          brand,
          appLink,
        })
      );
      void import('@/lib/b2c/directory').then(({ indexBrandPerson }) =>
        indexBrandPerson({
          kind: 'hire',
          companyId,
          companyName: brand,
          brand,
          refId: String(crmId),
          refLabel: customer.name,
          email: issued.portal.invite_email || customer.email,
          phone: customer.phone,
          portalToken: issued.portal.portal_token,
          portalPath: path,
          capabilities: ['order', 'book', 'track', 'kyc', 'review'],
        })
      );

      let emailWarning: string | undefined;
      const sendEmail = body.send_email !== false && Boolean(customer.email);
      if (sendEmail && customer.email) {
        try {
          const resend = getResend();
          const { error: emailError } = await resend.emails.send({
            from: getResendFrom(),
            replyTo: getResendReplyTo(),
            to: customer.email,
            subject: `${brand} — open SA Member to hire gear`,
            html: hireCustomerInviteEmailHtml({
              customerName: customer.name,
              brand,
              appLink,
              portalLink,
            }),
            text: hireCustomerInviteEmailText({
              customerName: customer.name,
              brand,
              appLink,
              portalLink,
            }),
          });
          if (emailError) {
            emailWarning = `Portal issued but email failed: ${emailError.message}`;
          }
        } catch (e: unknown) {
          emailWarning =
            e instanceof Error
              ? `Portal issued but email failed: ${e.message}`
              : 'Portal issued but email failed';
        }
      }

      return NextResponse.json({
        success: true,
        store: next,
        portal: issued.portal,
        portal_token: issued.portal.portal_token,
        portal_path: path,
        member_app_link: appLink,
        whatsapp_link: wa,
        coreSuppliers,
        coreCustomers,
        summary: summariseHiregraph(next, {
          coreSupplierCount: coreSuppliers.length,
          coreCustomerCount: coreCustomers.length,
        }),
        email_sent: sendEmail && !emailWarning,
        warning: emailWarning,
        message: emailWarning
          ? emailWarning
          : sendEmail
            ? `Portal issued and invite emailed to ${customer.email}`
            : `Portal issued for ${customer.name}`,
      });
    }

    if (action === 'revoke_portal' || action === 'revoke_customer_portal') {
      const crmId = Number(body.crm_customer_id || body.customer_id);
      if (!Number.isFinite(crmId) || crmId <= 0) {
        return NextResponse.json(
          { error: 'crm_customer_id required' },
          { status: 400 }
        );
      }
      const key = String(crmId);
      const prev = store.customer_portals?.[key];
      if (!prev) {
        return NextResponse.json(
          { error: 'No portal for this customer' },
          { status: 404 }
        );
      }
      next = {
        ...store,
        customer_portals: {
          ...(store.customer_portals || {}),
          [key]: { ...prev, active: false, portal_token: '' },
        },
      };
      await saveStore(companyId, meta, next);
      denormaliseNames(next, coreSuppliers, coreCustomers);
      return NextResponse.json({
        success: true,
        store: next,
        coreSuppliers,
        coreCustomers,
        summary: summariseHiregraph(next, {
          coreSupplierCount: coreSuppliers.length,
          coreCustomerCount: coreCustomers.length,
        }),
        message: 'Portal revoked',
      });
    }

    if (action === 'extend_booking') {
      const bookingId = String(body.booking_id || body.id || '');
      const newEnd = String(body.end_date || '').slice(0, 10);
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
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
      next = upsertEntity(store, 'bookings', {
        ...booking,
        end_date: dated.end_date,
        units: dated.units,
        notes: booking.notes
          ? `${booking.notes}\nExtended to ${newEnd}`
          : `Extended to ${newEnd}`,
      });
      await saveStore(companyId, meta, next);
      denormaliseNames(next, coreSuppliers, coreCustomers);
      return NextResponse.json({
        success: true,
        store: next,
        coreSuppliers,
        coreCustomers,
        summary: summariseHiregraph(next, {
          coreSupplierCount: coreSuppliers.length,
          coreCustomerCount: coreCustomers.length,
        }),
        message: `Hire extended to ${newEnd}`,
      });
    }

    const entity = body.entity;
    if (!isEntity(entity)) {
      return NextResponse.json(
        {
          error: `entity must be one of: ${ENTITIES.join(', ')} (suppliers/customers live in Core OS modules)`,
        },
        { status: 400 }
      );
    }

    if (action === 'delete') {
      const id = String(body.id || body.record?.id || '');
      if (!id) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      next = deleteEntity(store, entity, id);
    } else {
      const record =
        body.record && typeof body.record === 'object'
          ? (body.record as Record<string, unknown>)
          : body;
      const { companyId: _c, entity: _e, action: _a, ...rest } = record;

      // Resolve names from core books (parties are never stored locally)
      if (entity === 'items') {
        const sid = Number(rest.srm_supplier_id || rest.supplier_id);
        const fromInventory = Number(rest.inventory_product_id) > 0;
        if (Number.isFinite(sid) && sid > 0) {
          const s = coreSuppliers.find((x) => x.id === sid);
          if (!s) {
            return NextResponse.json(
              {
                error: `Supplier #${sid} not found in this company's Core Suppliers book`,
              },
              { status: 400 }
            );
          }
          rest.srm_supplier_id = sid;
          rest.supplier_name = s.name;
          delete rest.supplier_id;
        } else if (fromInventory) {
          rest.srm_supplier_id = null;
          rest.supplier_name = rest.supplier_name || companyName;
        } else {
          return NextResponse.json(
            {
              error:
                'srm_supplier_id required — list items against Core Suppliers (SRM), or hire out an inventory product',
            },
            { status: 400 }
          );
        }
      }
      if (entity === 'bookings') {
        const cid = Number(rest.crm_customer_id || rest.customer_id);
        if (!Number.isFinite(cid) || cid <= 0) {
          return NextResponse.json(
            {
              error:
                'crm_customer_id required — book against Core Customers (CRM)',
            },
            { status: 400 }
          );
        }
        const c = coreCustomers.find((x) => x.id === cid);
        if (!c) {
          return NextResponse.json(
            {
              error: `Customer #${cid} not found in this company's Core Customers book`,
            },
            { status: 400 }
          );
        }
        rest.crm_customer_id = cid;
        rest.customer_name = c.name;

        let sid = Number(rest.srm_supplier_id);
        if ((!Number.isFinite(sid) || sid <= 0) && rest.item_id) {
          const item = store.items.find((i) => i.id === rest.item_id);
          if (item?.srm_supplier_id) {
            sid = Number(item.srm_supplier_id);
            rest.supplier_name = item.supplier_name;
          }
        }
        if (Number.isFinite(sid) && sid > 0) {
          const s = coreSuppliers.find((x) => x.id === sid);
          if (s) {
            rest.srm_supplier_id = sid;
            rest.supplier_name = s.name;
          } else {
            rest.srm_supplier_id = sid;
          }
        }
        if (rest.item_id && (rest.start_date || rest.end_date)) {
          const { itemConflict } = await import('@/lib/hire/availability');
          const clash = itemConflict(store, {
            itemId: String(rest.item_id),
            start: rest.start_date ? String(rest.start_date) : null,
            end: rest.end_date ? String(rest.end_date) : null,
            qty: Number(rest.qty) || 1,
            excludeBookingId: rest.id ? String(rest.id) : null,
          });
          if (clash.conflict) {
            return NextResponse.json(
              {
                error: clash.blocking
                  ? `Item already hired ${String(clash.blocking.start_date || '').slice(0, 10)} → ${String(clash.blocking.end_date || clash.blocking.start_date || '').slice(0, 10)}`
                  : 'Item is already booked for those dates',
              },
              { status: 409 }
            );
          }
        }
      }

      next = upsertEntity(store, entity, rest);
    }

    await saveStore(companyId, meta, next);
    denormaliseNames(next, coreSuppliers, coreCustomers);

    return NextResponse.json({
      success: true,
      store: next,
      coreSuppliers,
      coreCustomers,
      summary: summariseHiregraph(next, {
        coreSupplierCount: coreSuppliers.length,
        coreCustomerCount: coreCustomers.length,
      }),
      commercial: {
        supplier_commission_pct: HIRE_SUPPLIER_COMMISSION_PCT,
        customer_commission_pct: HIRE_CUSTOMER_COMMISSION_PCT,
        platform_commission_pct: HIRE_PLATFORM_COMMISSION_PCT,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
