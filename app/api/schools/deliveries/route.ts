import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import type { DeliveryLine } from '@/lib/schools/deliveries';
import { logNsnpEvent } from '@/lib/schools/events';
import { scoreDeliveryLines } from '@/lib/schools/incentives';
import { podGate } from '@/lib/schools/golden-path';
import {
  buildDeliveryNotePdf,
  buildGrnPdf,
  buildMatchingReport,
  buildMatchingReportPdf,
  deliveryDocFilename,
  type DeliveryDocumentInput,
  type DocParty,
} from '@/lib/schools/delivery-documents';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * SP → school deliveries with shared POD / invoice files.
 *
 * GET ?companyId=&role=school|isp|auto&status=
 * GET ?companyId=&id= · detail + matching report JSON
 * GET ?companyId=&id=&format=dn|grn|match|print · PDF (inline / print)
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
    const format = String(sp.get('format') || 'json').toLowerCase();

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

      const hasPod = Boolean(
        (files || []).some(
          (f) =>
            String(f.kind || '').toLowerCase() === 'pod' ||
            String(f.kind || '').toLowerCase() === 'photo'
        ) || d.pod_photo_url
      );

      const lines = (
        Array.isArray(d.lines) ? d.lines : []
      ) as Array<Record<string, unknown>>;

      const matching = buildMatchingReport({
        delivery_number: String(d.delivery_number || `DN-${d.id}`),
        po_id: d.po_id != null ? Number(d.po_id) : null,
        status: String(d.status || 'draft'),
        lines: lines.map((l) => ({
          product_name: String(l.product_name || ''),
          brand_name: String(l.brand_name || ''),
          qty_ordered: Number(l.qty_ordered ?? l.qty ?? 0),
          qty_delivered: Number(
            l.qty_delivered ?? l.qty_ordered ?? l.qty ?? 0
          ),
          qty_received: Number(
            l.qty_received ?? l.qty_delivered ?? l.qty_ordered ?? 0
          ),
          uom: String(l.uom || 'kg'),
          approved: l.approved !== false,
          other_item:
            l.other_item === true ||
            l.approved === false ||
            !l.approved_product_id,
          approved_product_id:
            l.approved_product_id != null
              ? Number(l.approved_product_id)
              : null,
        })),
        has_pod: hasPod,
        grn_id: d.grn_receipt_id != null ? Number(d.grn_receipt_id) : null,
        otif: d.otif == null ? null : Boolean(d.otif),
        expected_date: d.expected_date ? String(d.expected_date) : null,
        delivered_at: d.delivered_at ? String(d.delivered_at) : null,
        received_at: d.received_at ? String(d.received_at) : null,
        vehicle_reg: d.vehicle_reg ? String(d.vehicle_reg) : null,
        driver_name: d.driver_name ? String(d.driver_name) : null,
      });

      const wantsPdf = ['dn', 'grn', 'match', 'print', 'pdf'].includes(format);
      if (wantsPdf) {
        const kind: 'dn' | 'grn' | 'match' =
          format === 'grn'
            ? 'grn'
            : format === 'match'
              ? 'match'
              : 'dn';

        if (kind === 'grn') {
          const st = String(d.status || '').toLowerCase();
          if (st !== 'received' && !d.grn_receipt_id) {
            return NextResponse.json(
              {
                error:
                  'GRN not available until the school receives this delivery',
              },
              { status: 400 }
            );
          }
        }

        const doc = await buildDeliveryDocumentInput(supabase, d, {
          hasPod,
          matching,
          files: files || [],
        });
        doc.kind = kind;

        let pdf: Buffer;
        if (kind === 'grn') pdf = await buildGrnPdf(doc);
        else if (kind === 'match') pdf = await buildMatchingReportPdf(doc);
        else pdf = await buildDeliveryNotePdf(doc);

        const filename = deliveryDocFilename(
          kind,
          String(d.delivery_number || d.id)
        );
        const disposition =
          sp.get('download') === '1' ? 'attachment' : 'inline';
        return new NextResponse(new Uint8Array(pdf), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${disposition}; filename="${filename}"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      return NextResponse.json({
        success: true,
        role,
        delivery: d,
        files: files || [],
        matching,
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
      const kind = String(body.kind || 'other').slice(0, 40);
      const isPodPhoto =
        kind === 'pod' ||
        kind === 'photo' ||
        Boolean(body.as_pod) ||
        (body.content_type || '').toString().startsWith('image');

      const { data: file, error } = await supabase
        .from('school_nsnp_delivery_files')
        .insert({
          delivery_id: deliveryId,
          school_profile_id: d.school_profile_id,
          isp_profile_id: d.isp_profile_id,
          uploaded_by_company_id: companyId,
          uploaded_by_role: isIsp ? 'isp' : 'school',
          kind: body.as_pod ? 'pod' : kind,
          file_name: body.file_name || null,
          file_url: String(body.file_url),
          file_size: body.file_size != null ? Number(body.file_size) : null,
          content_type: body.content_type || null,
          notes:
            body.notes ||
            (body.as_pod
              ? `POD photo · ${isIsp ? 'SP' : 'school'}`
              : null),
        })
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Soft flags on delivery for SP prize POD + three-way match invoice
      if (isPodPhoto || body.as_pod || kind === 'invoice') {
        const meta = {
          ...((d.metadata as Record<string, unknown>) || {}),
          ...(isPodPhoto || body.as_pod
            ? {
                has_pod_photo: true,
                pod_photo_at: new Date().toISOString(),
                pod_uploaded_by: isIsp ? 'isp' : 'school',
              }
            : {}),
          ...(kind === 'invoice'
            ? {
                has_invoice: true,
                invoice_at: new Date().toISOString(),
              }
            : {}),
        };
        await supabase
          .from('school_nsnp_deliveries')
          .update({
            metadata: meta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deliveryId);
      }

      return NextResponse.json({
        success: true,
        file,
        pod: Boolean(body.as_pod || isPodPhoto),
        message: body.as_pod
          ? 'POD photo attached — counts toward SP prize POD discipline'
          : 'File attached',
      });
    }

    // ── SP adds/updates lines (catalogue + optional other items) ─────
    // SP: OOS substitute — same-category approved brand only (half score)
    if (action === 'substitute_line') {
      const id = Number(body.id || body.delivery_id);
      const lineIndex = Number(body.line_index);
      const subPid = Number(body.substitute_product_id);
      if (!Number.isFinite(id) || !Number.isFinite(lineIndex) || !(subPid > 0)) {
        return NextResponse.json(
          {
            error:
              'id, line_index, and substitute_product_id required for OOS substitute',
          },
          { status: 400 }
        );
      }
      const { data: d } = await supabase
        .from('school_nsnp_deliveries')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!d) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (Number(d.isp_profile_id) !== companyId) {
        return NextResponse.json({ error: 'Only the SP can substitute' }, { status: 403 });
      }
      if (String(d.status) === 'received') {
        return NextResponse.json(
          { error: 'Cannot substitute after school GRN' },
          { status: 400 }
        );
      }
      const lines = Array.isArray(d.lines)
        ? [...(d.lines as Array<Record<string, unknown>>)]
        : [];
      if (lineIndex < 0 || lineIndex >= lines.length) {
        return NextResponse.json({ error: 'Invalid line_index' }, { status: 400 });
      }
      const {
        resolveCatalogueContext,
        filterApprovedProductIds,
      } = await import('@/lib/schools/approved-catalogue');
      const catalogue = await resolveCatalogueContext(
        supabase,
        Number(d.school_company_id),
        { schoolProfileId: Number(d.school_profile_id) }
      );
      const byId = await filterApprovedProductIds(
        supabase,
        catalogue.agencyProfileId,
        [subPid]
      );
      const prod = byId.get(subPid);
      if (!prod) {
        return NextResponse.json(
          {
            error:
              'Substitute must be on the department approved list. Unapproved brands are not allowed.',
            hard_block: true,
          },
          { status: 400 }
        );
      }
      const { applyOosSubstitute } = await import('@/lib/schools/order-process');
      const result = applyOosSubstitute({
        line: lines[lineIndex],
        substitute_product_id: subPid,
        substitute_product: {
          id: Number(prod.id),
          name: String(prod.name),
          brand_name: prod.brand_name != null ? String(prod.brand_name) : null,
          category: prod.category != null ? String(prod.category) : null,
          uom: prod.uom != null ? String(prod.uom) : null,
          active: prod.active !== false,
        },
        reason: body.reason || 'Out of stock',
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error, hard_block: true }, { status: 400 });
      }
      lines[lineIndex] = result.line;
      const scored = scoreDeliveryLines(lines);
      const meta = {
        ...((d.metadata as Record<string, unknown>) || {}),
        compliance_pct: scored.compliance_pct,
        full_compliance: scored.full_compliance,
        brand_exact_pct: scored.brand_exact_pct ?? null,
        substitute_line_count: scored.substitute_line_count ?? 0,
        last_substitute: {
          at: new Date().toISOString(),
          line_index: lineIndex,
          fidelity: result.fidelity,
          reason: body.reason || 'Out of stock',
        },
      };
      const { data: updated, error } = await supabase
        .from('school_nsnp_deliveries')
        .update({
          lines,
          metadata: meta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      // Notify school of substitute
      try {
        const { logNsnpEvent } = await import('@/lib/schools/events');
        await logNsnpEvent(supabase, {
          companyId,
          targetCompanyId: Number(d.school_company_id),
          schoolProfileId: Number(d.school_profile_id),
          kind: 'brand_substitute',
          title: 'SP used approved brand substitute (OOS)',
          body: result.message,
          href: '/dashboard/schools/deliveries',
          metadata: { delivery_id: id, fidelity: result.fidelity },
        });
      } catch {
        /* soft */
      }
      return NextResponse.json({
        success: true,
        delivery: updated,
        substitute: {
          fidelity: result.fidelity,
          credit: result.credit,
          message: result.message,
        },
        compliance: scored,
      });
    }

    if (action === 'update_lines' || action === 'add_extra_lines') {
      const deliveryId = Number(body.id || body.delivery_id);
      if (!Number.isFinite(deliveryId)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const { data: d } = await supabase
        .from('school_nsnp_deliveries')
        .select('*')
        .eq('id', deliveryId)
        .maybeSingle();
      if (!d) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const isIsp = Number(d.isp_profile_id) === companyId;
      const isSchool = Number(d.school_company_id) === companyId;
      if (!isIsp && !isSchool) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (String(d.status) === 'received') {
        return NextResponse.json(
          { error: 'Cannot change lines after school receive' },
          { status: 400 }
        );
      }

      let lines = Array.isArray(body.lines)
        ? (body.lines as Array<Record<string, unknown>>)
        : Array.isArray(d.lines)
          ? ([...(d.lines as Array<Record<string, unknown>>)] as Array<
              Record<string, unknown>
            >)
          : [];

      if (Array.isArray(body.extra_lines) && body.extra_lines.length) {
        for (const x of body.extra_lines as Array<Record<string, unknown>>) {
          const name = String(x.product_name || x.name || '').trim();
          const qty = Number(x.qty_delivered ?? x.qty ?? 0);
          if (!name || !(qty > 0)) continue;
          lines.push({
            approved_product_id: x.approved_product_id
              ? Number(x.approved_product_id)
              : null,
            product_name: name,
            brand_name: String(x.brand_name || x.brand || 'Other'),
            qty_ordered: 0,
            qty_delivered: qty,
            qty_received: 0,
            uom: String(x.uom || 'unit'),
            approved: false,
            other_item: true,
            notes: x.notes || 'Additional item (not on DBE list)',
          });
        }
      }

      // Re-validate catalogue flags for product ids
      const schoolCompanyId = Number(d.school_company_id);
      const {
        resolveCatalogueContext,
        filterApprovedProductIds,
      } = await import('@/lib/schools/approved-catalogue');
      const catalogue = await resolveCatalogueContext(
        supabase,
        schoolCompanyId,
        { schoolProfileId: Number(d.school_profile_id) }
      );
      const pids = lines
        .map((l) => Number(l.approved_product_id))
        .filter((n) => Number.isFinite(n) && n > 0);
      const byId = await filterApprovedProductIds(
        supabase,
        catalogue.agencyProfileId,
        pids
      );
      // PO ordered products = school-selected brands (fidelity baseline)
      const poOrdered = new Map<
        number,
        { product_id: number; category: string; brand_name: string }
      >();
      if (d.po_id) {
        const { data: po } = await supabase
          .from('school_purchase_orders')
          .select('lines')
          .eq('id', Number(d.po_id))
          .maybeSingle();
        const poLines = Array.isArray(po?.lines)
          ? (po!.lines as Array<Record<string, unknown>>)
          : [];
        for (const pl of poLines) {
          const opid = Number(pl.approved_product_id);
          if (!Number.isFinite(opid) || opid <= 0) continue;
          poOrdered.set(opid, {
            product_id: opid,
            category: String(pl.category || ''),
            brand_name: String(pl.brand_name || ''),
          });
        }
      }

      lines = lines.map((l) => {
        const pid = Number(l.approved_product_id);
        const prod = Number.isFinite(pid) ? byId.get(pid) : undefined;
        const approved = Boolean(prod && prod.active !== false);
        const orderedPid =
          l.ordered_product_id != null
            ? Number(l.ordered_product_id)
            : Number(l.po_product_id) ||
              (Number.isFinite(pid) && poOrdered.has(pid)
                ? pid
                : Number(l.ordered_product_id) || null);
        // Prefer explicit ordered id; else match by original PO line product
        let ordered_product_id =
          orderedPid && Number.isFinite(orderedPid) ? orderedPid : null;
        let ordered_category = String(
          l.ordered_category || l.category || ''
        );
        if (!ordered_product_id && l.po_line_product_id) {
          ordered_product_id = Number(l.po_line_product_id) || null;
        }
        // If still missing, use original line snapshot fields
        if (!ordered_product_id && l._ordered_product_id) {
          ordered_product_id = Number(l._ordered_product_id) || null;
        }
        const orderedSnap =
          ordered_product_id != null
            ? poOrdered.get(ordered_product_id)
            : undefined;
        if (orderedSnap?.category) ordered_category = orderedSnap.category;
        const deliveredCat = String(
          prod?.category || l.category || ordered_category || ''
        );
        return {
          ...l,
          approved,
          other_item: approved ? false : Boolean(l.other_item) || !approved,
          product_name: approved
            ? String(prod?.name || l.product_name || '')
            : String(l.product_name || ''),
          brand_name: approved
            ? String(prod?.brand_name || l.brand_name || '')
            : String(l.brand_name || 'Other'),
          category: deliveredCat,
          ordered_product_id,
          ordered_category: ordered_category || deliveredCat,
        };
      });

      // Hard block unapproved brands — SP cannot ship off-list on NSNP DN
      const unapproved = lines.filter(
        (l) =>
          Number(l.qty_delivered ?? l.qty ?? 0) > 0 &&
          (l.approved === false || l.other_item === true)
      );
      if (unapproved.length) {
        return NextResponse.json(
          {
            error: `Cannot deliver unapproved brands (${unapproved.length} line(s)). Use only the department approved list. If the school brand is OOS, substitute another approved brand in the same category (half score credit).`,
            hard_block: true,
            unapproved_lines: unapproved.slice(0, 10).map((l) => ({
              product_name: l.product_name,
              brand_name: l.brand_name,
            })),
          },
          { status: 400 }
        );
      }

      const scored = scoreDeliveryLines(lines);
      const meta = {
        ...((d.metadata as Record<string, unknown>) || {}),
        compliance_pct: scored.compliance_pct,
        full_compliance: scored.full_compliance,
        brand_exact_pct: scored.brand_exact_pct ?? null,
        substitute_line_count: scored.substitute_line_count ?? 0,
        unapproved_line_count: scored.unapproved_line_count ?? 0,
        other_item_count: lines.filter((l) => l.other_item || l.approved === false)
          .length,
        brand_fidelity_note:
          (scored.substitute_line_count || 0) > 0
            ? 'Approved same-category brand substitute(s) score half credit vs exact school brand.'
            : null,
      };

      const { data: updated, error } = await supabase
        .from('school_nsnp_deliveries')
        .update({
          lines,
          metadata: meta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deliveryId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        delivery: updated,
        compliance: scored,
        message: scored.full_compliance
          ? 'Lines updated — exact school brands (max SP prize points on this DN)'
          : (scored.substitute_line_count || 0) > 0
            ? `Lines updated — ${scored.compliance_pct}% brand-fidelity credit (approved same-category substitutes score half; unapproved blocked)`
            : `Lines updated — ${scored.compliance_pct}% on-catalogue brand fidelity`,
      });
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

    // ── One-click delivery note from open PO ─────────────────────────
    if (action === 'create_from_po') {
      const poIdOnly = Number(body.po_id);
      if (!Number.isFinite(poIdOnly)) {
        return NextResponse.json({ error: 'po_id required' }, { status: 400 });
      }
      const created = await createDeliveryFromPo(supabase, {
        poId: poIdOnly,
        companyId,
        userId: gate.userId,
        expectedDate: body.expected_date || null,
        status: body.status || 'confirmed',
      });
      if (!created.ok) {
        return NextResponse.json(
          { error: created.error, success: false },
          { status: created.status || 400 }
        );
      }
      return NextResponse.json({
        success: true,
        delivery: created.delivery,
        remaining: created.remaining || null,
        message: created.remaining?.partial
          ? 'Partial delivery note created — only remaining PO qty on lines'
          : 'Delivery note created from PO — dispatch when the truck leaves',
        one_click: true,
      });
    }

    // ── Status transitions ─────────────────────────────────────────────
    if (
      [
        'confirm',
        'dispatch',
        'mark_delivered',
        'receive',
        'receive_quick',
        'dispute',
        'credit_note',
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
      const isReceive =
        (action === 'receive' || action === 'receive_quick') && isSchool;
      let podWarning: string | undefined;

      if (action === 'confirm' && isIsp) {
        patch.status = 'confirmed';
      } else if (action === 'dispatch' && isIsp) {
        // Soft POD warning: recommend photo before truck leaves
        patch.status = 'dispatched';
        patch.dispatched_at = now;
        if (body.vehicle_reg) patch.vehicle_reg = body.vehicle_reg;
        if (body.driver_name) patch.driver_name = body.driver_name;
        if (body.notes_isp !== undefined) patch.notes_isp = body.notes_isp;
        if (body.expected_date) patch.expected_date = body.expected_date;
        // Sprint B2 — allow line qty edits on dispatch for partial ship
        if (Array.isArray(body.lines)) {
          patch.lines = body.lines;
        }
        // Sync PO trail
        if (d.po_id) {
          try {
            const { appendStatusTrail } = await import(
              '@/lib/schools/order-process'
            );
            const { data: po } = await supabase
              .from('school_purchase_orders')
              .select('id, metadata, status')
              .eq('id', Number(d.po_id))
              .maybeSingle();
            if (po) {
              const m =
                po.metadata && typeof po.metadata === 'object'
                  ? (po.metadata as Record<string, unknown>)
                  : {};
              await supabase
                .from('school_purchase_orders')
                .update({
                  status: 'dispatched',
                  metadata: appendStatusTrail(m, {
                    status: 'dispatched',
                    label: 'DN dispatched',
                    by_role: 'isp',
                  }),
                  updated_at: now,
                })
                .eq('id', Number(d.po_id));
            }
          } catch {
            /* soft */
          }
        }
      } else if (action === 'mark_delivered' && isIsp) {
        // Prefer POD before delivered (hard if env or require_pod)
        {
          const meta0 = (d.metadata || {}) as Record<string, unknown>;
          let hasPod = Boolean(meta0.has_pod_photo);
          if (!hasPod) {
            const { count } = await supabase
              .from('school_nsnp_delivery_files')
              .select('*', { count: 'exact', head: true })
              .eq('delivery_id', id)
              .in('kind', ['pod', 'photo']);
            hasPod = (count || 0) > 0;
          }
          const hard =
            body.require_pod === true ||
            body.require_pod === 1 ||
            body.require_pod === '1' ||
            process.env.NSNP_POD_HARD_GATE === '1';
          if (!hasPod && hard) {
            return NextResponse.json(
              {
                error:
                  'Attach a photo POD before marking delivered — proof of delivery is required.',
                pod_required: true,
              },
              { status: 400 }
            );
          }
          if (!hasPod) {
            podWarning =
              'Marked delivered without POD photo — attach POD soon to protect SP prize points.';
          }
        }
        patch.status = 'delivered';
        patch.delivered_at = now;
        let linesForScore = Array.isArray(d.lines)
          ? (d.lines as Array<Record<string, unknown>>)
          : [];
        if (Array.isArray(body.lines)) {
          linesForScore = body.lines as Array<Record<string, unknown>>;
          patch.lines = body.lines;
        }
        if (Array.isArray(body.extra_lines) && body.extra_lines.length) {
          for (const x of body.extra_lines as Array<Record<string, unknown>>) {
            const name = String(x.product_name || '').trim();
            const qty = Number(x.qty_delivered ?? x.qty ?? 0);
            if (!name || !(qty > 0)) continue;
            linesForScore.push({
              approved_product_id: null,
              product_name: name,
              brand_name: String(x.brand_name || 'Other'),
              qty_ordered: 0,
              qty_delivered: qty,
              qty_received: 0,
              uom: String(x.uom || 'unit'),
              approved: false,
              other_item: true,
            });
          }
          patch.lines = linesForScore;
        }
        const scored = scoreDeliveryLines(linesForScore);
        patch.metadata = {
          ...((d.metadata as Record<string, unknown>) || {}),
          compliance_pct: scored.compliance_pct,
          full_compliance: scored.full_compliance,
        };
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
      } else if (isReceive) {
        if (String(d.status) === 'received') {
          return NextResponse.json({
            success: true,
            delivery: d,
            message: 'Already received',
          });
        }

        // Sprint A — POD gate (soft by default; hard if require_pod=1)
        const meta = (d.metadata || {}) as Record<string, unknown>;
        let hasPod = Boolean(meta.has_pod_photo);
        if (!hasPod) {
          const { count } = await supabase
            .from('school_nsnp_delivery_files')
            .select('*', { count: 'exact', head: true })
            .eq('delivery_id', id)
            .in('kind', ['pod', 'photo']);
          hasPod = (count || 0) > 0;
        }
        const hard =
          body.require_pod === true ||
          body.require_pod === 1 ||
          body.require_pod === '1' ||
          process.env.NSNP_POD_HARD_GATE === '1';
        const gatePod = podGate({ hasPod, requireHard: hard });
        if (!gatePod.ok) {
          return NextResponse.json(
            {
              error: gatePod.message,
              pod_required: true,
              success: false,
            },
            { status: 400 }
          );
        }
        podWarning =
          gatePod.mode === 'soft' ? gatePod.message : undefined;

        patch.status = 'received';
        patch.received_at = now;
        if (body.notes_school !== undefined) {
          patch.notes_school = body.notes_school;
        }
        // One-tap: accept delivered qty as received
        const baseLines = (
          Array.isArray(body.lines)
            ? body.lines
            : Array.isArray(d.lines)
              ? d.lines
              : []
        ) as Array<Record<string, unknown>>;
        patch.lines = baseLines.map((l) => {
          const ordered = Number(l.qty_ordered ?? l.qty ?? 0);
          const delivered = Number(l.qty_delivered ?? ordered);
          const received =
            action === 'receive_quick'
              ? delivered
              : Number(l.qty_received ?? delivered);
          return {
            approved_product_id: l.approved_product_id ?? null,
            product_name: String(l.product_name || ''),
            brand_name: String(l.brand_name || ''),
            qty_ordered: ordered,
            qty_delivered: delivered,
            qty_received: received,
            uom: String(l.uom || 'kg'),
          };
        });
        if (d.expected_date && d.otif == null) {
          const exp = String(d.expected_date).slice(0, 10);
          const day = now.slice(0, 10);
          patch.otif = day <= exp;
        }
      } else if (action === 'dispute' && isSchool) {
        patch.status = 'disputed';
        patch.dispute_reason =
          body.dispute_reason || body.notes_school || 'Disputed';
        if (body.notes_school) patch.notes_school = body.notes_school;
        // Sprint B3 — optional line-level dispute qtys + credit note request
        const meta: Record<string, unknown> = {
          ...((d.metadata as Record<string, unknown>) || {}),
          dispute: {
            reason: patch.dispute_reason,
            at: now,
            by_role: 'school',
            credit_note_requested: Boolean(body.credit_note_requested),
            disputed_lines: Array.isArray(body.disputed_lines)
              ? body.disputed_lines
              : null,
          },
        };
        if (body.credit_note_requested) {
          meta.credit_note_requested = true;
          meta.credit_note_status = 'requested';
        }
        patch.metadata = meta;
        if (Array.isArray(body.lines)) {
          patch.lines = body.lines;
        }
      } else if (action === 'credit_note' && isIsp) {
        // SP attaches / records credit note against disputed delivery
        const meta = {
          ...((d.metadata as Record<string, unknown>) || {}),
          credit_note: {
            number: body.credit_note_number || body.number || null,
            amount: body.credit_note_amount ?? body.amount ?? null,
            notes: body.notes_isp || body.notes || null,
            at: now,
            status: 'issued',
          },
          credit_note_status: 'issued',
          credit_note_requested: false,
        };
        patch.metadata = meta;
        if (body.notes_isp) patch.notes_isp = body.notes_isp;
        // Keep disputed status unless school already received
        if (String(d.status) === 'disputed') {
          patch.status = 'disputed';
        }
      } else if (action === 'cancel') {
        patch.status = 'cancelled';
      } else {
        return NextResponse.json(
          { error: 'Action not allowed for your role' },
          { status: 403 }
        );
      }

      // Prize snapshot before GRN (for live delta)
      let prizeBefore: Awaited<
        ReturnType<typeof import('@/lib/schools/prize').livePrizeSnapshot>
      > = null;
      if (isReceive) {
        const { livePrizeSnapshot } = await import('@/lib/schools/prize');
        prizeBefore = await livePrizeSnapshot(supabase, {
          schoolProfileId: Number(d.school_profile_id),
          companyId,
        });
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
      let prizeDelta: Record<string, unknown> | null = null;
      let backorder: Awaited<
        ReturnType<
          typeof import('@/lib/schools/po-backorder').applyPoBackorderAfterGrn
        >
      > = null;
      if (isReceive) {
        grn = await postGrnFromDelivery(supabase, updated, companyId, gate.userId);
        if (grn?.id) {
          await supabase
            .from('school_nsnp_deliveries')
            .update({ grn_receipt_id: grn.id })
            .eq('id', id);
          updated.grn_receipt_id = grn.id;
        }
        // Priority 2 — partial GRN → remaining backorder on PO
        if (updated.po_id) {
          const { applyPoBackorderAfterGrn } = await import(
            '@/lib/schools/po-backorder'
          );
          backorder = await applyPoBackorderAfterGrn(supabase, {
            poId: Number(updated.po_id),
            now,
          });
          if (backorder && !backorder.fully_received) {
            await logNsnpEvent(supabase, {
              companyId,
              targetCompanyId: Number(d.isp_profile_id),
              schoolProfileId: Number(d.school_profile_id),
              kind: 'po_backorder',
              title: 'Partial GRN — remaining qty still due',
              body: `${backorder.backorder_lines.length} line(s) remaining (${backorder.received_pct}% received) on PO #${updated.po_id}`,
              href: '/dashboard/schools/orders',
              metadata: {
                po_id: updated.po_id,
                delivery_id: id,
                backorder_lines: backorder.backorder_lines,
                received_pct: backorder.received_pct,
              },
            });
          }
        }

        const { livePrizeSnapshot, formatPrizeDelta } = await import(
          '@/lib/schools/prize'
        );
        const prizeAfter = await livePrizeSnapshot(supabase, {
          schoolProfileId: Number(d.school_profile_id),
          companyId,
        });
        const fmt = formatPrizeDelta(
          prizeBefore?.total ?? null,
          prizeAfter?.total ?? null
        );
        prizeDelta = {
          before: prizeBefore?.total ?? null,
          after: prizeAfter?.total ?? null,
          delta: fmt.delta,
          message: fmt.message,
          approved_brand_pct: prizeAfter?.approvedBrandPct ?? null,
          non_approved_events: prizeAfter?.nonApprovedEvents ?? null,
          period: prizeAfter?.periodName ?? null,
          grn_compliance_ok: grn?.compliance_ok ?? null,
        };

        // Preferred / probation SP rules
        try {
          const { recomputeSpTier } = await import('@/lib/schools/sp-tier');
          await recomputeSpTier(supabase, Number(d.isp_profile_id));
        } catch {
          /* soft */
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
      let backorderOut: {
        fully_received: boolean;
        received_pct: number;
        backorder_lines: Array<Record<string, unknown>>;
        po_status: string;
      } | null = null;
      if (isReceive && backorder) {
        backorderOut = {
          fully_received: backorder.fully_received,
          received_pct: backorder.received_pct,
          backorder_lines:
            backorder.backorder_lines as unknown as Array<
              Record<string, unknown>
            >,
          po_status: backorder.po_status,
        };
      }
      if (isReceive) {
        await logNsnpEvent(supabase, {
          companyId,
          targetCompanyId: Number(d.isp_profile_id),
          schoolProfileId: Number(d.school_profile_id),
          kind: 'delivery_received',
          title:
            backorderOut && !backorderOut.fully_received
              ? 'Partial school GRN — backorder remaining'
              : 'School received your delivery',
          body:
            backorderOut && !backorderOut.fully_received
              ? `Delivery ${d.delivery_number || d.id} — ${backorderOut.received_pct}% of PO received; remaining lines still due`
              : `Delivery ${d.delivery_number || d.id} confirmed into kitchen stock`,
          href: '/dashboard/schools/deliveries',
          metadata: {
            delivery_id: d.id,
            grn_id: grn?.id,
            prize_delta: prizeDelta?.delta ?? null,
            backorder: backorderOut,
          },
        });
      }

      // Sprint B2 — matching report snapshot on dispatch / deliver / dispute
      let matching: ReturnType<typeof buildMatchingReport> | null = null;
      if (
        action === 'dispatch' ||
        action === 'mark_delivered' ||
        action === 'dispute' ||
        action === 'credit_note' ||
        isReceive
      ) {
        try {
          const linesArr = (
            Array.isArray(updated.lines) ? updated.lines : []
          ) as Array<Record<string, unknown>>;
          matching = buildMatchingReport({
            delivery_number: String(
              updated.delivery_number || updated.id || ''
            ),
            po_id: updated.po_id != null ? Number(updated.po_id) : null,
            status: String(updated.status || ''),
            lines: linesArr.map((l) => ({
              product_name: String(l.product_name || ''),
              brand_name: String(l.brand_name || ''),
              qty_ordered: Number(l.qty_ordered ?? l.qty ?? 0),
              qty_delivered: Number(
                l.qty_delivered ?? l.qty_ordered ?? l.qty ?? 0
              ),
              qty_received: Number(
                l.qty_received ??
                  (isReceive
                    ? l.qty_delivered ?? l.qty_ordered ?? 0
                    : 0)
              ),
              uom: String(l.uom || 'kg'),
              approved: l.approved !== false && !l.other_item,
              other_item: Boolean(l.other_item),
              approved_product_id:
                l.approved_product_id != null
                  ? Number(l.approved_product_id)
                  : null,
            })),
            has_pod: Boolean(
              (updated.metadata as { has_pod_photo?: boolean } | null)
                ?.has_pod_photo
            ),
            grn_id:
              updated.grn_receipt_id != null
                ? Number(updated.grn_receipt_id)
                : grn?.id != null
                  ? Number(grn.id)
                  : null,
            otif:
              updated.otif === true || updated.otif === false
                ? Boolean(updated.otif)
                : null,
            expected_date:
              updated.expected_date != null
                ? String(updated.expected_date)
                : null,
            delivered_at:
              updated.delivered_at != null
                ? String(updated.delivered_at)
                : null,
            received_at:
              updated.received_at != null
                ? String(updated.received_at)
                : null,
          });
        } catch {
          matching = null;
        }
      }

      let message: string | undefined;
      if (isReceive) {
        if (backorderOut && !backorderOut.fully_received) {
          message = `Partial GRN — ${backorderOut.received_pct}% of PO received; ${backorderOut.backorder_lines.length} line(s) still due from SP. ${String(prizeDelta?.message || '')}`;
        } else {
          message = grn
            ? `Received — kitchen GRN posted. ${String(prizeDelta?.message || '')}`
            : 'Delivery received';
        }
      } else if (action === 'dispatch') {
        message = matching?.summary.clean
          ? 'Dispatched — matching report clean so far (await school GRN)'
          : 'Dispatched — review matching report for short/over lines';
      } else if (action === 'dispute') {
        message = body.credit_note_requested
          ? 'Disputed — credit note requested from SP'
          : 'Disputed — SP will be notified';
      } else if (action === 'credit_note') {
        message = 'Credit note recorded against delivery';
      }

      return NextResponse.json({
        success: true,
        delivery: updated,
        grn,
        prize: prizeDelta,
        pod_warning: podWarning,
        matching,
        backorder: backorderOut,
        message,
      });
    }

    // ── Create delivery (SP or school on behalf of linked SP) ────────
    if (body.action === 'create' || !body.action) {
      /* fall through */
    }
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

async function createDeliveryFromPo(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: {
    poId: number;
    companyId: number;
    userId?: string | null;
    expectedDate?: string | null;
    status?: string;
  }
): Promise<
  | {
      ok: true;
      delivery: Record<string, unknown>;
      remaining?: {
        partial: boolean;
        lines: Array<Record<string, unknown>>;
      };
    }
  | { ok: false; error: string; status?: number }
> {
  const { data: po } = await supabase
    .from('school_purchase_orders')
    .select('*')
    .eq('id', opts.poId)
    .maybeSingle();
  if (!po) {
    return { ok: false, error: 'PO not found', status: 404 };
  }

  const schoolOwns = Number(po.profile_id) === opts.companyId;
  const ispOwns = Number(po.isp_profile_id) === opts.companyId;
  if (!schoolOwns && !ispOwns) {
    return { ok: false, error: 'Forbidden for this PO', status: 403 };
  }

  if (!po.isp_profile_id) {
    return {
      ok: false,
      error: 'PO has no service provider — school must assign an SP first',
      status: 400,
    };
  }

  // Sprint B1 — remaining qty: sum qty already on non-cancelled DNs for this PO
  const { data: priorDns } = await supabase
    .from('school_nsnp_deliveries')
    .select('id, status, lines')
    .eq('po_id', opts.poId)
    .neq('status', 'cancelled')
    .limit(50);

  // Open (not yet received) DN → return it (idempotent)
  const openExisting = (priorDns || []).find((d) =>
    ['draft', 'confirmed', 'dispatched', 'delivered', 'disputed'].includes(
      String(d.status)
    )
  );
  if (openExisting) {
    const { data: full } = await supabase
      .from('school_nsnp_deliveries')
      .select('*')
      .eq('id', openExisting.id)
      .maybeSingle();
    return {
      ok: true,
      delivery: (full || openExisting) as Record<string, unknown>,
    };
  }

  type DnLine = {
    approved_product_id: number | null;
    /** School-selected brand on the PO — SP should buy this when available */
    ordered_product_id?: number | null;
    ordered_category?: string;
    category?: string;
    product_name: string;
    brand_name: string;
    qty_ordered: number;
    qty_delivered: number;
    qty_received: number;
    uom: string;
    qty_already_delivered?: number;
    qty_remaining?: number;
  };

  const alreadyByProduct = new Map<string, number>();
  for (const d of priorDns || []) {
    if (!['received', 'partially_received'].includes(String(d.status))) continue;
    const dLines = Array.isArray(d.lines)
      ? (d.lines as Array<Record<string, unknown>>)
      : [];
    for (const l of dLines) {
      const key =
        l.approved_product_id != null
          ? `id:${Number(l.approved_product_id)}`
          : `n:${String(l.product_name || '').toLowerCase()}`;
      const qty = Number(
        l.qty_delivered ?? l.qty_received ?? l.qty_ordered ?? 0
      );
      alreadyByProduct.set(key, (alreadyByProduct.get(key) || 0) + qty);
    }
  }

  const rawPoLines = Array.isArray(po.lines)
    ? (po.lines as Array<Record<string, unknown>>)
    : [];
  const lines: DnLine[] = [];
  for (const l of rawPoLines) {
    const ordered = Number(l.qty || 0);
    const pid = Number(l.approved_product_id) || null;
    const key = pid
      ? `id:${pid}`
      : `n:${String(l.product_name || '').toLowerCase()}`;
    const already = alreadyByProduct.get(key) || 0;
    const remaining = Math.max(0, ordered - already);
    if (!(remaining > 0)) continue; // fully delivered line — skip
    lines.push({
      approved_product_id: pid,
      // School-selected brand on the PO — SP must buy this when available
      ordered_product_id: pid,
      ordered_category: String(l.category || ''),
      category: String(l.category || ''),
      product_name: String(l.product_name || ''),
      brand_name: String(l.brand_name || ''),
      qty_ordered: ordered,
      qty_already_delivered: already,
      qty_remaining: remaining,
      qty_delivered: remaining, // default this DN ships remaining
      qty_received: 0,
      uom: String(l.uom || 'kg'),
    });
  }

  if (!lines.length) {
    // Fully fulfilled already
    if ((priorDns || []).length) {
      return {
        ok: false,
        error:
          'PO is fully delivered — no remaining quantity for a new delivery note',
        status: 400,
      };
    }
    return { ok: false, error: 'PO has no lines to deliver', status: 400 };
  }

  // Hard gate: only catalogue lines (product id present)
  const missing = lines.filter((l: DnLine) => !l.approved_product_id);
  if (missing.length) {
    return {
      ok: false,
      error:
        'PO has lines without approved product ids — only catalogue POs can become deliveries',
      status: 400,
    };
  }

  const partial = lines.some(
    (l) => (l.qty_already_delivered || 0) > 0 || l.qty_delivered < l.qty_ordered
  );
  const status = opts.status || 'confirmed';
  const payload = {
    school_profile_id: Number(po.school_profile_id),
    school_company_id: Number(po.profile_id),
    isp_profile_id: Number(po.isp_profile_id),
    po_id: opts.poId,
    delivery_number: `DN-${opts.poId}-${Date.now().toString(36).toUpperCase()}`,
    status,
    expected_date: opts.expectedDate || po.expected_date || null,
    lines,
    notes_isp: partial
      ? 'Created from PO (partial remaining qty)'
      : 'Created from PO (one-click)',
    metadata: {
      partial_fulfilment: partial,
      remaining_lines: lines.length,
    },
    created_by: null as string | null,
  };

  const { data, error } = await supabase
    .from('school_nsnp_deliveries')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message || 'Could not create delivery',
      status: 400,
    };
  }

  await supabase
    .from('school_purchase_orders')
    .update({
      delivery_status: status,
      status: partial
        ? 'partially_received'
        : status === 'confirmed'
          ? 'confirmed'
          : String(po.status),
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.poId);

  return {
    ok: true,
    delivery: data as Record<string, unknown>,
    remaining: {
      partial,
      lines: lines.map((l) => ({
        product_name: l.product_name,
        qty_ordered: l.qty_ordered,
        qty_already_delivered: l.qty_already_delivered,
        qty_remaining: l.qty_remaining,
      })),
    },
  };
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

    // Re-validate every line against the school's DBE/PEU approved catalogue
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
        // Explicit false/other_item = off-catalogue (allowed on DN, not stocked)
        const explicitOther =
          (l as { other_item?: boolean; approved?: boolean }).other_item ===
            true ||
          (l as { approved?: boolean }).approved === false;
        const approved =
          !explicitOther && Boolean(prod && prod.active !== false);
        return {
          approved_product_id: approved ? pid : null,
          product_name: String(
            (prod?.name as string) || l.product_name || 'Unknown'
          ),
          brand_name: String(
            (prod?.brand_name as string) || l.brand_name || 'Other'
          ),
          qty,
          uom: String(l.uom || prod?.uom || 'kg'),
          approved,
          other_item: !approved,
        };
      })
      .filter(Boolean) as Array<{
      approved_product_id: number | null;
      product_name: string;
      brand_name: string;
      qty: number;
      uom: string;
      approved: boolean;
      other_item?: boolean;
    }>;

    if (!grnLines.length) return null;

    // Stock only approved lines — other items stay on the DN for audit only
    const approvedStockLines = grnLines.filter((l) => l.approved);
    const complianceOk = grnLines.every((l) => l.approved);
    const scored = scoreDeliveryLines(
      grnLines.map((l) => ({
        approved: l.approved,
        qty_received: l.qty,
      }))
    );

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

    // Update delivery metadata with compliance for SP prize scoring
    try {
      await supabase
        .from('school_nsnp_deliveries')
        .update({
          metadata: {
            ...((delivery.metadata as Record<string, unknown>) || {}),
            compliance_pct: scored.compliance_pct,
            full_compliance: scored.full_compliance,
            received_compliance_pct: scored.compliance_pct,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', delivery.id);
    } catch {
      /* soft */
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
        complianceOk
          ? ' · 100% DBE-approved (max SP + school prize impact)'
          : ` · ${scored.compliance_pct}% on-catalogue · other items not stocked`
      }`,
      created_by: null as string | null,
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

// ── Document party + PDF payload helpers ─────────────────────────────────

type Sb = ReturnType<typeof getSupabaseServer>;

async function resolveSchoolParty(
  supabase: Sb,
  schoolProfileId: number
): Promise<DocParty> {
  let schoolRow: Record<string, unknown> | null = null;
  const full = await supabase
    .from('school_profiles')
    .select(
      'id, school_name, emis_number, natemis, district, province, address, city, principal_name, principal_phone, principal_email, nsnp_coordinator_name, nsnp_coordinator_email, profile_id, primary_agency_profile_id'
    )
    .eq('id', schoolProfileId)
    .maybeSingle();
  if (full.error && /natemis|column/i.test(full.error.message)) {
    const soft = await supabase
      .from('school_profiles')
      .select(
        'id, school_name, emis_number, district, province, address, city, principal_name, principal_phone, principal_email, nsnp_coordinator_name, nsnp_coordinator_email, profile_id, primary_agency_profile_id'
      )
      .eq('id', schoolProfileId)
      .maybeSingle();
    schoolRow = (soft.data as Record<string, unknown>) || null;
  } else {
    schoolRow = (full.data as Record<string, unknown>) || null;
  }

  const address = [schoolRow?.address, schoolRow?.city]
    .filter(Boolean)
    .map(String)
    .join(', ');

  return {
    kind: 'school',
    name: String(schoolRow?.school_name || `School ${schoolProfileId}`),
    emis_number:
      schoolRow?.emis_number != null ? String(schoolRow.emis_number) : null,
    natemis:
      schoolRow?.natemis != null && String(schoolRow.natemis).trim()
        ? String(schoolRow.natemis).trim()
        : null,
    district: schoolRow?.district != null ? String(schoolRow.district) : null,
    province: schoolRow?.province != null ? String(schoolRow.province) : null,
    address: address || null,
    contact_name:
      schoolRow?.principal_name != null
        ? String(schoolRow.principal_name)
        : schoolRow?.nsnp_coordinator_name != null
          ? String(schoolRow.nsnp_coordinator_name)
          : null,
    contact_phone:
      schoolRow?.principal_phone != null
        ? String(schoolRow.principal_phone)
        : null,
    contact_email:
      schoolRow?.principal_email != null
        ? String(schoolRow.principal_email)
        : schoolRow?.nsnp_coordinator_email != null
          ? String(schoolRow.nsnp_coordinator_email)
          : null,
  };
}

async function resolveIspPartyDoc(
  supabase: Sb,
  ispKey: number | null | undefined
): Promise<DocParty> {
  if (!ispKey || !Number.isFinite(Number(ispKey))) {
    return { kind: 'isp', name: 'Service provider' };
  }
  const key = Number(ispKey);
  let isp: Record<string, unknown> | null = null;
  {
    const { data } = await supabase
      .from('nsnp_isp_profiles')
      .select(
        'id, profile_id, trading_name, contact_name, contact_phone, contact_email, csd_number, province, district, metadata'
      )
      .eq('profile_id', key)
      .maybeSingle();
    isp = (data as Record<string, unknown>) || null;
  }
  if (!isp) {
    const { data } = await supabase
      .from('nsnp_isp_profiles')
      .select(
        'id, profile_id, trading_name, contact_name, contact_phone, contact_email, csd_number, province, district, metadata'
      )
      .eq('id', key)
      .maybeSingle();
    isp = (data as Record<string, unknown>) || null;
  }

  const companyId =
    isp?.profile_id != null && Number.isFinite(Number(isp.profile_id))
      ? Number(isp.profile_id)
      : key;

  const { data: ispProf } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, city, province, phone, email, address, contact_name, contact_phone'
    )
    .eq('id', companyId)
    .maybeSingle();

  const meta =
    isp?.metadata && typeof isp.metadata === 'object'
      ? (isp.metadata as Record<string, unknown>)
      : {};

  const pick = (...vals: unknown[]) => {
    for (const v of vals) {
      const s = v != null ? String(v).trim() : '';
      if (s && !/^service provider\s+\d+$/i.test(s) && !/^sp\s+\d+$/i.test(s)) {
        return s;
      }
    }
    return '';
  };

  const name =
    pick(
      isp?.trading_name,
      ispProf?.trading_name,
      ispProf?.legal_name,
      meta.trading_name,
      meta.name,
      meta.company_name
    ) || `Service provider ${companyId}`;

  return {
    kind: 'isp',
    name,
    trading_name: pick(isp?.trading_name, ispProf?.trading_name) || null,
    legal_name: pick(ispProf?.legal_name) || null,
    csd_number:
      pick(isp?.csd_number, meta.csd_number, meta.csd, meta.CSD_NUMBER) || null,
    district: isp?.district != null ? String(isp.district) : null,
    province:
      isp?.province != null
        ? String(isp.province)
        : ispProf?.province != null
          ? String(ispProf.province)
          : null,
    address: ispProf?.address != null ? String(ispProf.address) : null,
    contact_name: pick(isp?.contact_name, ispProf?.contact_name) || null,
    contact_phone: pick(
      isp?.contact_phone,
      ispProf?.phone,
      ispProf?.contact_phone
    ) || null,
    contact_email: pick(isp?.contact_email, ispProf?.email) || null,
  };
}

async function buildDeliveryDocumentInput(
  supabase: Sb,
  d: Record<string, unknown>,
  opts: {
    hasPod: boolean;
    matching: ReturnType<typeof buildMatchingReport>;
    files: Array<Record<string, unknown>>;
  }
): Promise<DeliveryDocumentInput> {
  const schoolProfileId = Number(d.school_profile_id);
  const ispKey = Number(d.isp_profile_id);
  const school = await resolveSchoolParty(supabase, schoolProfileId);
  const isp = await resolveIspPartyDoc(supabase, ispKey);

  let po_number: string | null = null;
  if (d.po_id != null && Number.isFinite(Number(d.po_id))) {
    const { data: po } = await supabase
      .from('school_purchase_orders')
      .select('po_number')
      .eq('id', Number(d.po_id))
      .maybeSingle();
    if (po?.po_number) po_number = String(po.po_number);
  }

  let grn_number: string | null = null;
  if (d.grn_receipt_id != null) {
    const { data: grn } = await supabase
      .from('school_kitchen_receipts')
      .select('id, receipt_number')
      .eq('id', Number(d.grn_receipt_id))
      .maybeSingle();
    if (grn?.receipt_number) grn_number = String(grn.receipt_number);
    else grn_number = `GRN-${d.delivery_number || d.id}`;
  }

  let agency_name: string | null = null;
  try {
    const { resolveCatalogueContext } = await import(
      '@/lib/schools/approved-catalogue'
    );
    const cat = await resolveCatalogueContext(
      supabase,
      Number(d.school_company_id) || 0,
      { schoolProfileId }
    );
    agency_name = cat.agencyName;
  } catch {
    /* soft */
  }

  const lines = (Array.isArray(d.lines) ? d.lines : []) as Array<
    Record<string, unknown>
  >;

  return {
    kind: 'dn',
    delivery_number: String(d.delivery_number || `DN-${d.id}`),
    status: String(d.status || 'draft'),
    po_id: d.po_id != null ? Number(d.po_id) : null,
    po_number,
    expected_date: d.expected_date ? String(d.expected_date) : null,
    dispatched_at: d.dispatched_at ? String(d.dispatched_at) : null,
    delivered_at: d.delivered_at ? String(d.delivered_at) : null,
    received_at: d.received_at ? String(d.received_at) : null,
    vehicle_reg: d.vehicle_reg ? String(d.vehicle_reg) : null,
    driver_name: d.driver_name ? String(d.driver_name) : null,
    notes_isp: d.notes_isp ? String(d.notes_isp) : null,
    notes_school: d.notes_school ? String(d.notes_school) : null,
    grn_receipt_id:
      d.grn_receipt_id != null ? Number(d.grn_receipt_id) : null,
    grn_number,
    school,
    isp,
    agency_name,
    lines: lines.map((l) => ({
      product_name: String(l.product_name || ''),
      brand_name: String(l.brand_name || ''),
      qty_ordered: Number(l.qty_ordered ?? l.qty ?? 0),
      qty_delivered: Number(l.qty_delivered ?? l.qty_ordered ?? l.qty ?? 0),
      qty_received: Number(
        l.qty_received ?? l.qty_delivered ?? l.qty_ordered ?? 0
      ),
      uom: String(l.uom || 'kg'),
      approved: l.approved !== false,
      other_item:
        l.other_item === true ||
        l.approved === false ||
        !l.approved_product_id,
      approved_product_id:
        l.approved_product_id != null ? Number(l.approved_product_id) : null,
    })),
    matching: opts.matching,
    has_pod: opts.hasPod,
    otif: d.otif == null ? null : Boolean(d.otif),
    generated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}
