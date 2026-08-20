import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { clampStar } from '@/lib/ratings/company-rating';
import { isSrmBuyerTransitionAllowed } from '@/lib/procurement/types';

const SUPPLIER_STATUS = ['accepted', 'invoiced'] as const;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token || '').trim();
    const action = String(body.action || '').trim();
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
    const rl = checkRateLimit({
      key: `portal-act:${token.slice(0, 24)}:${ip}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const guest = await resolveGuestViewer(token);
    if (!guest.ok) {
      return NextResponse.json({ error: guest.error }, { status: guest.status });
    }
    const { portal, viewer, linkedProfileId, accountName } = guest.ctx;
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    if (action === 'profile') {
      const patch: Record<string, unknown> = {
        updated_at: now,
      };
      const map: Record<string, string> = {
        trading_name: 'trading_name',
        legal_name: 'legal_name',
        contact_name: 'contact_name',
        job_title: 'job_title',
        email: 'email',
        phone: 'phone',
        website: 'website',
        vat_number: 'vat_number',
        registration_number: 'registration_number',
        city: 'city',
        country: 'country',
        payment_terms: 'payment_terms',
        industry: 'industry',
      };
      for (const [k, col] of Object.entries(map)) {
        if (body[k] != null) patch[col] = String(body[k]).trim().slice(0, 240);
      }
      if (body.address != null) {
        if (portal.kind === 'customer') patch.billing_address = String(body.address).trim().slice(0, 500);
        else patch.address = String(body.address).trim().slice(0, 500);
      }
      if (patch.email) patch.email = String(patch.email).toLowerCase();
      if (portal.kind === 'customer' && viewer.customer_id) {
        const { error } = await supabase
          .from('customers')
          .update(patch)
          .eq('id', viewer.customer_id)
          .eq('profile_id', portal.profile_id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else if (portal.kind === 'supplier' && viewer.supplier_id) {
        const { error } = await supabase
          .from('srm_suppliers')
          .update(patch)
          .eq('id', viewer.supplier_id)
          .eq('profile_id', portal.profile_id);
        if (error) {
          const retry: Record<string, unknown> = { ...patch };
          delete retry.vat_number;
          delete retry.registration_number;
          delete retry.payment_terms;
          const r2 = await supabase
            .from('srm_suppliers')
            .update(retry)
            .eq('id', viewer.supplier_id)
            .eq('profile_id', portal.profile_id);
          if (r2.error) {
            return NextResponse.json({ error: r2.error.message }, { status: 500 });
          }
        }
      } else {
        return NextResponse.json({ error: 'No book account' }, { status: 403 });
      }
      const viewerPatch: Record<string, unknown> = {};
      if (patch.contact_name) viewerPatch.name = String(patch.contact_name).slice(0, 120);
      if (patch.email) viewerPatch.email = String(patch.email).slice(0, 240);
      if (patch.phone) viewerPatch.phone = String(patch.phone).slice(0, 40);
      if (patch.job_title) viewerPatch.job_title = String(patch.job_title).slice(0, 120);
      if (Object.keys(viewerPatch).length) {
        await supabase
          .from('trade_portal_viewers')
          .update(viewerPatch)
          .eq('id', viewer.id)
          .eq('profile_id', portal.profile_id);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'message') {
      const text = String(body.body || '').trim().slice(0, 4000);
      if (!text) {
        return NextResponse.json({ error: 'Message required' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('trade_portal_messages')
        .insert({
          portal_id: portal.id,
          viewer_id: viewer.id,
          profile_id: portal.profile_id,
          author: 'guest',
          body: text,
        })
        .select('id, author, body, created_at')
        .single();
      if (error) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run supabase/migrations/20260823_trade_portal_workspace.sql',
          },
          { status: /exist/i.test(error.message) ? 503 : 500 }
        );
      }
      return NextResponse.json({ success: true, message: data });
    }

    if (action === 'riad_add') {
      const title = String(body.title || '').trim();
      if (!title) {
        return NextResponse.json({ error: 'Title required' }, { status: 400 });
      }
      const entry = {
        profile_id: portal.profile_id,
        entry_type: ['risk', 'issue', 'action', 'decision'].includes(
          String(body.entry_type)
        )
          ? String(body.entry_type)
          : 'issue',
        title: title.slice(0, 200),
        description: String(body.description || '').slice(0, 4000) || null,
        status: 'open',
        severity: String(body.severity || 'medium').slice(0, 20),
        notes: String(body.notes || '').slice(0, 4000) || null,
        created_by: `portal:${viewer.name}`,
        updated_at: now,
      };
      const table =
        portal.kind === 'customer' ? 'customer_riad' : 'supplier_riad';
      const extra =
        portal.kind === 'customer'
          ? { customer_id: viewer.customer_id }
          : { supplier_id: viewer.supplier_id };
      const { data, error } = await supabase
        .from(table)
        .insert({ ...entry, ...extra })
        .select('id')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, id: data?.id });
    }

    if (action === 'riad_comment') {
      const id = Number(body.id);
      const note = String(body.notes || '').trim();
      if (!Number.isFinite(id) || !note) {
        return NextResponse.json({ error: 'id and notes required' }, { status: 400 });
      }
      const table =
        portal.kind === 'customer' ? 'customer_riad' : 'supplier_riad';
      const { data: existing } = await supabase
        .from(table)
        .select('id, notes, profile_id')
        .eq('id', id)
        .eq('profile_id', portal.profile_id)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json({ error: 'RIAD not found' }, { status: 404 });
      }
      const next = [existing.notes, `[${viewer.name}] ${note}`]
        .filter(Boolean)
        .join('\n');
      const { error } = await supabase
        .from(table)
        .update({ notes: next, updated_at: now })
        .eq('id', id)
        .eq('profile_id', portal.profile_id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'po_update') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const { data: po, error: loadErr } = await supabase
        .from('purchase_orders')
        .select(
          'id, status, metadata, buyer_profile_id, supplier_id, supplier_profile_id, seller_customer_id'
        )
        .eq('id', id)
        .maybeSingle();
      if (loadErr || !po) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      const allowed =
        portal.kind === 'supplier'
          ? Number(po.buyer_profile_id) === portal.profile_id &&
            (Number(po.supplier_id) === viewer.supplier_id ||
              Number(po.supplier_profile_id) === (linkedProfileId || -1))
          : Number(po.supplier_profile_id) === portal.profile_id &&
            Number(po.seller_customer_id) === viewer.customer_id;
      if (!allowed) {
        return NextResponse.json({ error: 'Not your order' }, { status: 403 });
      }

      const patch: Record<string, unknown> = { updated_at: now };
      const meta = {
        ...(po.metadata && typeof po.metadata === 'object'
          ? (po.metadata as Record<string, unknown>)
          : {}),
      };
      if (typeof body.promised_date === 'string' && body.promised_date) {
        patch.promised_date = String(body.promised_date).slice(0, 10);
      }
      if (body.delivered_quantity != null) {
        patch.delivered_quantity = Number(body.delivered_quantity);
      }
      if (body.damaged_quantity != null) {
        patch.damaged_quantity = Number(body.damaged_quantity);
      }
      if (body.order_quantity != null) {
        patch.order_quantity = Number(body.order_quantity);
      }
      if (typeof body.attachment_url === 'string' && body.attachment_url.trim()) {
        meta.attachment_url = String(body.attachment_url).trim().slice(0, 2000);
        patch.metadata = meta;
      }
      if (body.stock_on_hand != null) {
        meta.supplier_stock_on_hand = Number(body.stock_on_hand);
        patch.metadata = meta;
      }
      if (typeof body.status === 'string' && body.status) {
        const to = String(body.status).toLowerCase();
        const from = String(po.status || '').toLowerCase();
        const ok =
          portal.kind === 'supplier'
            ? (from === 'sent' && to === 'accepted') ||
              (from === 'accepted' && (to === 'invoiced' || to === 'completed'))
            : isSrmBuyerTransitionAllowed(from, to) ||
              (from === 'sent' && to === 'cancelled');
        if (!ok) {
          return NextResponse.json(
            { error: `Cannot move order from ${from} to ${to}` },
            { status: 400 }
          );
        }
        patch.status = to;
      }
      const { error } = await supabase
        .from('purchase_orders')
        .update(patch)
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'po_create') {
      if (portal.kind !== 'customer' || !viewer.customer_id) {
        return NextResponse.json(
          { error: 'Only customers on our books can raise a PO here' },
          { status: 403 }
        );
      }
      const items = Array.isArray(body.items) ? body.items : [];
      const lines = items
        .map((it) => {
          const row = asObj(it);
          const qty = Number(row.qty || row.quantity || 0);
          const name = String(row.name || row.sku || '').trim();
          if (!name || !(qty > 0)) return null;
          return {
            name: name.slice(0, 160),
            sku: row.sku != null ? String(row.sku).slice(0, 80) : null,
            qty,
            quantity: qty,
            unit_price: Number(row.unit_price || 0),
          };
        })
        .filter(Boolean);
      const qty = lines.reduce((n, l) => n + Number(l && l.qty), 0);
      const amount = Number(body.total_amount || 0);
      const insert: Record<string, unknown> = {
        supplier_profile_id: portal.profile_id,
        seller_customer_id: viewer.customer_id,
        source: 'customer_portal',
        status: 'sent',
        description: String(body.description || `PO from ${accountName}`).slice(
          0,
          400
        ),
        currency: String(body.currency || 'ZAR').slice(0, 8),
        total_amount: amount,
        subtotal: amount,
        items: lines,
        order_quantity: qty || null,
        promised_date: body.promised_date
          ? String(body.promised_date).slice(0, 10)
          : null,
        metadata: {
          attachment_url: body.attachment_url
            ? String(body.attachment_url).slice(0, 2000)
            : null,
          portal_viewer_id: viewer.id,
        },
        created_at: now,
        updated_at: now,
      };
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert(insert)
        .select('id')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, id: data?.id });
    }

    if (action === 'rate') {
      const overall = clampStar(body.overall);
      if (!overall) {
        return NextResponse.json({ error: 'Overall rating 1–5 required' }, { status: 400 });
      }
      const dims = {
        quality: clampStar(body.quality),
        delivery: clampStar(body.delivery),
        communication: clampStar(body.communication),
        value: clampStar(body.value),
        payment: clampStar(body.payment),
        reliability: clampStar(body.reliability),
      };
      const comment =
        body.comment != null ? String(body.comment).slice(0, 2000) : null;
      const rateeRole = portal.kind === 'supplier' ? 'customer' : 'supplier';

      if (linkedProfileId && linkedProfileId !== portal.profile_id) {
        const row = {
          rater_profile_id: linkedProfileId,
          ratee_profile_id: portal.profile_id,
          ratee_role: rateeRole,
          overall,
          ...dims,
          comment,
          status: 'published',
          created_by: `portal:${viewer.id}`,
          updated_at: now,
        };
        const { data: existing } = await supabase
          .from('company_ratings')
          .select('id')
          .eq('rater_profile_id', linkedProfileId)
          .eq('ratee_profile_id', portal.profile_id)
          .eq('ratee_role', rateeRole)
          .eq('status', 'published')
          .maybeSingle();
        if (existing?.id) {
          await supabase.from('company_ratings').update(row).eq('id', existing.id);
        } else {
          await supabase
            .from('company_ratings')
            .insert({ ...row, created_at: now });
        }
      } else {
        await supabase.from('invoice_feedback').insert({
          profile_id: portal.profile_id,
          invoice_id: null,
          feedback_type: 'portal_rate',
          rating: overall,
          title: `Portal rating from ${viewer.name}`,
          body: comment,
          contact_name: viewer.name,
          contact_email: viewer.email,
          metadata: {
            viewer_id: viewer.id,
            overall,
            ...dims,
            kind: portal.kind,
          },
          created_at: now,
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}
