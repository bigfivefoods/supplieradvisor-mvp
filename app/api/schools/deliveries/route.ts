import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import type { DeliveryLine } from '@/lib/schools/deliveries';
import { logNsnpEvent } from '@/lib/schools/events';

/**
 * SP → school deliveries with shared POD / invoice files.
 *
 * GET ?companyId=&role=school|isp|auto&status=
 * POST create / dispatch / deliver / receive / dispute / attach
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const roleParam = String(sp.get('role') || 'auto');
    const status = sp.get('status');
    const deliveryId = sp.get('id') ? Number(sp.get('id')) : null;

    const { data: ispRow } = await supabase
      .from('nsnp_isp_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    let role: 'school' | 'isp' = 'school';
    if (roleParam === 'isp' || (roleParam === 'auto' && ispRow)) {
      role = 'isp';
    }

    if (deliveryId && Number.isFinite(deliveryId)) {
      const { data: d, error } = await supabase
        .from('school_nsnp_deliveries')
        .select('*')
        .eq('id', deliveryId)
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (!d) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      // Access: school company or SP company
      if (
        Number(d.school_company_id) !== companyId &&
        Number(d.isp_profile_id) !== companyId
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { data: files } = await supabase
        .from('school_nsnp_delivery_files')
        .select('*')
        .eq('delivery_id', deliveryId)
        .order('created_at', { ascending: false })
        .limit(100);
      return NextResponse.json({
        success: true,
        role,
        delivery: d,
        files: files || [],
        isp: ispRow,
      });
    }

    let q = supabase
      .from('school_nsnp_deliveries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (role === 'isp') {
      q = q.eq('isp_profile_id', companyId);
    } else {
      const { school, error } = await getOrCreateSchoolProfile(
        supabase,
        companyId
      );
      if (error || !school) {
        return NextResponse.json(
          { error: error || 'School not found' },
          { status: 503 }
        );
      }
      q = q.eq('school_profile_id', Number(school.id));
    }
    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        role,
        deliveries: [],
        warning: error.message,
        isp: ispRow,
      });
    }

    const deliveries = data || [];
    // Open POs for creating deliveries
    let openOrders: Array<Record<string, unknown>> = [];
    if (role === 'isp') {
      const { data: pos } = await supabase
        .from('school_purchase_orders')
        .select('*')
        .eq('isp_profile_id', companyId)
        .in('status', [
          'submitted',
          'confirmed',
          'open',
          'partially_received',
          'dispatched',
        ])
        .order('created_at', { ascending: false })
        .limit(50);
      openOrders = pos || [];
    } else {
      const { school } = await getOrCreateSchoolProfile(supabase, companyId);
      if (school) {
        const { data: pos } = await supabase
          .from('school_purchase_orders')
          .select('*')
          .eq('school_profile_id', school.id)
          .in('status', [
            'submitted',
            'confirmed',
            'open',
            'partially_received',
            'dispatched',
          ])
          .order('created_at', { ascending: false })
          .limit(50);
        openOrders = pos || [];
      }
    }

    const summary = {
      total: deliveries.length,
      awaitingReceive: deliveries.filter((d) =>
        ['dispatched', 'delivered'].includes(String(d.status))
      ).length,
      received: deliveries.filter((d) => d.status === 'received').length,
      disputed: deliveries.filter((d) => d.status === 'disputed').length,
    };

    return NextResponse.json({
      success: true,
      role,
      deliveries,
      openOrders,
      summary,
      isp: ispRow,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const action = String(body.action || 'create');

    // ── Attach file (school or SP) ────────────────────────────────────
    if (action === 'attach') {
      const deliveryId = Number(body.delivery_id);
      if (!Number.isFinite(deliveryId) || !body.file_url) {
        return NextResponse.json(
          { error: 'delivery_id and file_url required' },
          { status: 400 }
        );
      }
      const { data: d } = await supabase
        .from('school_nsnp_deliveries')
        .select('*')
        .eq('id', deliveryId)
        .maybeSingle();
      if (!d) {
        return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
      }
      const isSchool = Number(d.school_company_id) === companyId;
      const isIsp = Number(d.isp_profile_id) === companyId;
      if (!isSchool && !isIsp) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { data: file, error } = await supabase
        .from('school_nsnp_delivery_files')
        .insert({
          delivery_id: deliveryId,
          school_profile_id: d.school_profile_id,
          isp_profile_id: d.isp_profile_id,
          uploaded_by_company_id: companyId,
          uploaded_by_role: isIsp ? 'isp' : 'school',
          kind: String(body.kind || 'other').slice(0, 40),
          file_name: body.file_name || null,
          file_url: String(body.file_url),
          file_size: body.file_size != null ? Number(body.file_size) : null,
          content_type: body.content_type || null,
          notes: body.notes || null,
        })
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, file });
    }

    // ── Attach to PO ───────────────────────────────────────────────────
    if (action === 'attach_po') {
      const poId = Number(body.po_id);
      if (!Number.isFinite(poId) || !body.file_url) {
        return NextResponse.json(
          { error: 'po_id and file_url required' },
          { status: 400 }
        );
      }
      const { data: po } = await supabase
        .from('school_purchase_orders')
        .select('*')
        .eq('id', poId)
        .maybeSingle();
      if (!po) {
        return NextResponse.json({ error: 'PO not found' }, { status: 404 });
      }
      const isSchool = Number(po.profile_id) === companyId;
      const isIsp = Number(po.isp_profile_id) === companyId;
      if (!isSchool && !isIsp) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { data: file, error } = await supabase
        .from('school_nsnp_order_files')
        .insert({
          po_id: poId,
          school_profile_id: po.school_profile_id,
          isp_profile_id: po.isp_profile_id,
          uploaded_by_company_id: companyId,
          uploaded_by_role: isIsp ? 'isp' : 'school',
          kind: String(body.kind || 'other').slice(0, 40),
          file_name: body.file_name || null,
          file_url: String(body.file_url),
          file_size: body.file_size != null ? Number(body.file_size) : null,
          content_type: body.content_type || null,
          notes: body.notes || null,
        })
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, file });
    }

    // ── Status transitions ─────────────────────────────────────────────
    if (
      [
        'confirm',
        'dispatch',
        'mark_delivered',
        'receive',
        'dispute',
        'cancel',
      ].includes(action)
    ) {
      const id = Number(body.id || body.delivery_id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const { data: d } = await supabase
        .from('school_nsnp_deliveries')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!d) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const isSchool = Number(d.school_company_id) === companyId;
      const isIsp = Number(d.isp_profile_id) === companyId;
      if (!isSchool && !isIsp) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      const now = new Date().toISOString();

      if (action === 'confirm' && isIsp) {
        patch.status = 'confirmed';
      } else if (action === 'dispatch' && isIsp) {
        patch.status = 'dispatched';
        patch.dispatched_at = now;
        if (body.vehicle_reg) patch.vehicle_reg = body.vehicle_reg;
        if (body.driver_name) patch.driver_name = body.driver_name;
        if (body.notes_isp !== undefined) patch.notes_isp = body.notes_isp;
        if (body.expected_date) patch.expected_date = body.expected_date;
      } else if (action === 'mark_delivered' && isIsp) {
        patch.status = 'delivered';
        patch.delivered_at = now;
        if (Array.isArray(body.lines)) patch.lines = body.lines;
        if (body.notes_isp !== undefined) patch.notes_isp = body.notes_isp;
        // OTIF: delivered on/before expected_date
        if (d.expected_date) {
          const exp = String(d.expected_date).slice(0, 10);
          const day = now.slice(0, 10);
          patch.otif = day <= exp;
          patch.otif_notes =
            day <= exp
              ? 'On-time (delivered on/before expected date)'
              : `Late vs expected ${exp}`;
        }
      } else if (action === 'receive' && isSchool) {
        patch.status = 'received';
        patch.received_at = now;
        if (body.notes_school !== undefined) patch.notes_school = body.notes_school;
        if (Array.isArray(body.lines)) {
          // Merge qty_received into lines
          patch.lines = body.lines;
        }
        if (d.expected_date && d.otif == null) {
          const exp = String(d.expected_date).slice(0, 10);
          const day = now.slice(0, 10);
          patch.otif = day <= exp;
        }
      } else if (action === 'dispute' && isSchool) {
        patch.status = 'disputed';
        patch.dispute_reason = body.dispute_reason || body.notes_school || 'Disputed';
        if (body.notes_school) patch.notes_school = body.notes_school;
      } else if (action === 'cancel') {
        patch.status = 'cancelled';
      } else {
        return NextResponse.json(
          { error: 'Action not allowed for your role' },
          { status: 403 }
        );
      }

      const { data: updated, error } = await supabase
        .from('school_nsnp_deliveries')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // School receive → post GRN into kitchen stock (approved brands only)
      let grn: Record<string, unknown> | null = null;
      if (action === 'receive' && isSchool) {
        grn = await postGrnFromDelivery(supabase, updated, companyId, gate.userId);
        if (grn?.id) {
          await supabase
            .from('school_nsnp_deliveries')
            .update({ grn_receipt_id: grn.id })
            .eq('id', id);
          updated.grn_receipt_id = grn.id;
        }
        // Update PO status
        if (updated.po_id) {
          await supabase
            .from('school_purchase_orders')
            .update({
              status: 'received',
              delivery_status: 'received',
              received_at: now,
              received_pct: 100,
              updated_at: now,
            })
            .eq('id', updated.po_id);
        }
      }

      if (
        (action === 'dispatch' || action === 'mark_delivered') &&
        updated.po_id
      ) {
        await supabase
          .from('school_purchase_orders')
          .update({
            status: action === 'dispatch' ? 'dispatched' : 'delivered',
            delivery_status: String(patch.status),
            updated_at: now,
          })
          .eq('id', updated.po_id);
      }

      // Soft notifications (Sprint A)
      if (action === 'dispatch' || action === 'mark_delivered') {
        await logNsnpEvent(supabase, {
          companyId,
          targetCompanyId: Number(d.school_company_id),
          schoolProfileId: Number(d.school_profile_id),
          kind: action === 'dispatch' ? 'delivery_dispatched' : 'delivery_delivered',
          title:
            action === 'dispatch'
              ? 'SP food is on the way'
              : 'SP marked delivery complete',
          body: `Delivery ${d.delivery_number || d.id} — open to receive / view POD`,
          href: '/dashboard/schools/deliveries',
          metadata: { delivery_id: d.id, action },
        });
      }
      if (action === 'receive') {
        await logNsnpEvent(supabase, {
          companyId,
          targetCompanyId: Number(d.isp_profile_id),
          schoolProfileId: Number(d.school_profile_id),
          kind: 'delivery_received',
          title: 'School received your delivery',
          body: `Delivery ${d.delivery_number || d.id} confirmed into kitchen stock`,
          href: '/dashboard/schools/deliveries',
          metadata: { delivery_id: d.id, grn_id: grn?.id },
        });
      }

      return NextResponse.json({ success: true, delivery: updated, grn });
    }

    // ── Create delivery (SP or school on behalf of linked SP) ────────
    const poId = body.po_id != null ? Number(body.po_id) : null;
    let schoolProfileId = body.school_profile_id
      ? Number(body.school_profile_id)
      : null;
    let schoolCompanyId = body.school_company_id
      ? Number(body.school_company_id)
      : null;
    let ispProfileId = body.isp_profile_id
      ? Number(body.isp_profile_id)
      : companyId;
    let lines: DeliveryLine[] = Array.isArray(body.lines) ? body.lines : [];

    if (poId && Number.isFinite(poId)) {
      const { data: po } = await supabase
        .from('school_purchase_orders')
        .select('*')
        .eq('id', poId)
        .maybeSingle();
      if (!po) {
        return NextResponse.json({ error: 'PO not found' }, { status: 404 });
      }
      // SP must own the PO, or school owns it
      const schoolOwns = Number(po.profile_id) === companyId;
      const ispOwns = Number(po.isp_profile_id) === companyId;
      if (!schoolOwns && !ispOwns) {
        return NextResponse.json({ error: 'Forbidden for this PO' }, { status: 403 });
      }
      schoolProfileId = Number(po.school_profile_id);
      schoolCompanyId = Number(po.profile_id);
      ispProfileId = Number(po.isp_profile_id || ispProfileId);
      if (!lines.length && Array.isArray(po.lines)) {
        lines = (po.lines as Array<Record<string, unknown>>).map((l) => ({
          approved_product_id: Number(l.approved_product_id) || null,
          product_name: String(l.product_name || ''),
          brand_name: String(l.brand_name || ''),
          qty_ordered: Number(l.qty || 0),
          qty_delivered: Number(l.qty || 0),
          qty_received: 0,
          uom: String(l.uom || 'kg'),
        }));
      }
    } else {
      // Manual create: school must specify SP; SP must specify school
      const { data: ispCheck } = await supabase
        .from('nsnp_isp_profiles')
        .select('profile_id')
        .eq('profile_id', companyId)
        .maybeSingle();
      if (ispCheck) {
        ispProfileId = companyId;
        if (!schoolProfileId) {
          return NextResponse.json(
            { error: 'school_profile_id required for SP create' },
            { status: 400 }
          );
        }
        const { data: sch } = await supabase
          .from('school_profiles')
          .select('id, profile_id')
          .eq('id', schoolProfileId)
          .maybeSingle();
        if (!sch) {
          return NextResponse.json({ error: 'School not found' }, { status: 404 });
        }
        schoolCompanyId = Number(sch.profile_id);
      } else {
        const { school } = await getOrCreateSchoolProfile(supabase, companyId);
        if (!school) {
          return NextResponse.json({ error: 'School not found' }, { status: 503 });
        }
        schoolProfileId = Number(school.id);
        schoolCompanyId = companyId;
        if (!Number.isFinite(ispProfileId) || ispProfileId === companyId) {
          return NextResponse.json(
            { error: 'isp_profile_id required' },
            { status: 400 }
          );
        }
      }
    }

    if (!schoolProfileId || !schoolCompanyId || !ispProfileId) {
      return NextResponse.json(
        { error: 'school and isp required' },
        { status: 400 }
      );
    }

    const payload = {
      school_profile_id: schoolProfileId,
      school_company_id: schoolCompanyId,
      isp_profile_id: ispProfileId,
      po_id: poId && Number.isFinite(poId) ? poId : null,
      delivery_number:
        body.delivery_number ||
        `DN-${Date.now().toString(36).toUpperCase()}`,
      status: body.status || 'confirmed',
      expected_date: body.expected_date || null,
      vehicle_reg: body.vehicle_reg || null,
      driver_name: body.driver_name || null,
      lines,
      notes_isp: body.notes_isp || null,
      notes_school: body.notes_school || null,
      created_by: gate.userId || null,
    };

    const { data, error } = await supabase
      .from('school_nsnp_deliveries')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (payload.po_id) {
      await supabase
        .from('school_purchase_orders')
        .update({
          delivery_status: payload.status,
          status:
            payload.status === 'confirmed' ? 'confirmed' : payload.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.po_id);
    }

    return NextResponse.json({ success: true, delivery: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function postGrnFromDelivery(
  supabase: ReturnType<typeof getSupabaseServer>,
  delivery: Record<string, unknown>,
  companyId: number,
  userId?: string | null
): Promise<Record<string, unknown> | null> {
  try {
    const schoolId = Number(delivery.school_profile_id);
    const schoolCompanyId = Number(
      delivery.school_company_id || companyId
    );
    const lines = (
      Array.isArray(delivery.lines) ? delivery.lines : []
    ) as DeliveryLine[];

    // Re-validate every line against the school's DBE/DoH approved catalogue
    const {
      resolveCatalogueContext,
      filterApprovedProductIds,
    } = await import('@/lib/schools/approved-catalogue');
    const catalogue = await resolveCatalogueContext(
      supabase,
      schoolCompanyId,
      { schoolProfileId: schoolId }
    );
    const productIds = lines
      .map((l) => Number(l.approved_product_id))
      .filter((n) => Number.isFinite(n) && n > 0);
    const byId = await filterApprovedProductIds(
      supabase,
      catalogue.agencyProfileId,
      productIds
    );

    const grnLines = lines
      .map((l) => {
        const qty = Number(
          l.qty_received ?? l.qty_delivered ?? l.qty_ordered ?? 0
        );
        if (!(qty > 0)) return null;
        const pid = Number(l.approved_product_id);
        const prod = Number.isFinite(pid) ? byId.get(pid) : undefined;
        const approved = Boolean(prod && prod.active !== false);
        return {
          approved_product_id: approved ? pid : null,
          product_name: String(
            (prod?.name as string) || l.product_name || 'Unknown'
          ),
          brand_name: String(
            (prod?.brand_name as string) || l.brand_name || 'Unknown'
          ),
          qty,
          uom: String(l.uom || prod?.uom || 'kg'),
          approved,
        };
      })
      .filter(Boolean) as Array<{
      approved_product_id: number | null;
      product_name: string;
      brand_name: string;
      qty: number;
      uom: string;
      approved: boolean;
    }>;

    if (!grnLines.length) return null;

    // Stock only approved lines — off-catalogue never enters kitchen stock
    const approvedStockLines = grnLines.filter((l) => l.approved);
    const complianceOk = grnLines.every((l) => l.approved);

    if (!complianceOk) {
      try {
        await supabase.from('school_compliance_events').insert({
          school_profile_id: schoolId,
          profile_id: schoolCompanyId,
          kind: 'non_approved_delivery',
          title: 'Off-catalogue products on delivery GRN',
          status: 'open',
          severity: 'high',
          event_date: new Date().toISOString().slice(0, 10),
          body: `Delivery ${delivery.delivery_number || delivery.id}: only department-approved foods may be received. SP ${delivery.isp_profile_id || '?'}.`,
          metadata: {
            delivery_id: delivery.id,
            isp_profile_id: delivery.isp_profile_id,
            off_catalogue: grnLines.filter((l) => !l.approved),
            agency: catalogue.agencyName,
          },
          created_by: userId || null,
        });
      } catch {
        /* soft */
      }
    }

    const receiptPayload = {
      school_profile_id: schoolId,
      profile_id: schoolCompanyId,
      isp_profile_id: delivery.isp_profile_id
        ? Number(delivery.isp_profile_id)
        : null,
      po_id: delivery.po_id ? Number(delivery.po_id) : null,
      purchase_order_id: delivery.po_id ? Number(delivery.po_id) : null,
      receipt_number: `GRN-${String(delivery.delivery_number || delivery.id)}`,
      received_at: new Date().toISOString().slice(0, 10),
      status: 'posted',
      compliance_ok: complianceOk,
      // Persist all lines for audit; stock only uses approved
      lines: grnLines,
      notes: `From delivery ${delivery.delivery_number || delivery.id}${
        complianceOk ? '' : ' · OFF-CATALOGUE LINES FLAGGED'
      }`,
      created_by: userId || null,
    };

    const { data: receipt, error } = await supabase
      .from('school_kitchen_receipts')
      .insert(receiptPayload)
      .select('*')
      .single();

    if (error || !receipt) {
      // soft without po_id
      const soft = { ...receiptPayload } as Record<string, unknown>;
      delete soft.po_id;
      delete soft.purchase_order_id;
      soft.receipt_number = `GRN-D${delivery.id}`;
      const retry = await supabase
        .from('school_kitchen_receipts')
        .insert(soft)
        .select('*')
        .single();
      if (retry.error || !retry.data) return null;
      if (approvedStockLines.length) {
        await upsertStock(supabase, schoolId, schoolCompanyId, approvedStockLines);
      }
      return retry.data as Record<string, unknown>;
    }

    if (approvedStockLines.length) {
      await upsertStock(supabase, schoolId, schoolCompanyId, approvedStockLines);
    }
    return receipt as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function upsertStock(
  supabase: ReturnType<typeof getSupabaseServer>,
  schoolId: number,
  companyId: number,
  lines: Array<{
    approved_product_id: number | null;
    product_name: string;
    brand_name: string;
    qty: number;
    uom: string;
  }>
) {
  for (const line of lines) {
    if (!line.approved_product_id) continue;
    const { data: existing } = await supabase
      .from('school_kitchen_stock')
      .select('id, qty_on_hand')
      .eq('school_profile_id', schoolId)
      .eq('approved_product_id', line.approved_product_id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('school_kitchen_stock')
        .update({
          qty_on_hand: Number(existing.qty_on_hand || 0) + line.qty,
          last_received_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('school_kitchen_stock').insert({
        school_profile_id: schoolId,
        profile_id: companyId,
        approved_product_id: line.approved_product_id,
        product_name: line.product_name,
        brand_name: line.brand_name,
        qty_on_hand: line.qty,
        uom: line.uom,
        last_received_at: new Date().toISOString(),
      });
    }
  }
}
