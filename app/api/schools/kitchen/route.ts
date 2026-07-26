import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import type { ReceiptLine } from '@/lib/schools/types';
import {
  filterApprovedProductIds,
  resolveCatalogueContext,
} from '@/lib/schools/approved-catalogue';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const [stockRes, receiptsRes, ordersRes] = await Promise.all([
      supabase
        .from('school_kitchen_stock')
        .select('*')
        .eq('school_profile_id', school.id)
        .order('product_name')
        .limit(500),
      supabase
        .from('school_kitchen_receipts')
        .select('*')
        .eq('school_profile_id', school.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('school_purchase_orders')
        .select(
          'id, po_number, status, order_date, expected_date, total_amount, lines, isp_profile_id, compliance_ok'
        )
        .eq('school_profile_id', school.id)
        .in('status', [
          'draft',
          'submitted',
          'confirmed',
          'open',
          'partially_received',
        ])
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      success: true,
      school,
      stock: stockRes.data || [],
      receipts: receiptsRes.data || [],
      openOrders: ordersRes.data || [],
      warning:
        stockRes.error?.message ||
        receiptsRes.error?.message ||
        ordersRes.error?.message,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST: receive GRN (brand compliance gate) or adjust stock
 */
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
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);

    if (body.action === 'receive' || body.action === 'grn') {
      const rawLines = Array.isArray(body.lines) ? body.lines : [];
      if (!rawLines.length) {
        return NextResponse.json({ error: 'lines required' }, { status: 400 });
      }

      const productIds = rawLines
        .map((l: { approved_product_id?: number }) =>
          Number(l.approved_product_id)
        )
        .filter((n: number) => Number.isFinite(n) && n > 0);

      const catalogue = await resolveCatalogueContext(supabase, companyId, {
        schoolProfileId: schoolId,
      });
      const byId = await filterApprovedProductIds(
        supabase,
        catalogue.agencyProfileId,
        productIds
      );
      const listLabel = catalogue.agencyName
        ? `${catalogue.agencyName} approved foods list`
        : 'NSNP approved brand list';

      const lines: ReceiptLine[] = [];
      let allApproved = true;
      for (const l of rawLines) {
        const pid = Number(l.approved_product_id);
        const prod = byId.get(pid);
        const brand = String(l.brand_name || prod?.brand_name || '').trim();
        const name = String(l.product_name || prod?.name || '').trim();
        const qty = Number(l.qty || 0);
        const isApproved = Boolean(prod && prod.active !== false);
        if (!isApproved) allApproved = false;
        if (!(qty > 0)) continue;
        lines.push({
          approved_product_id: isApproved ? pid : null,
          product_name: name || 'Unknown',
          brand_name: brand || 'Unknown',
          qty,
          uom: String(l.uom || prod?.uom || 'kg'),
          lot: l.lot || null,
          expiry: l.expiry || null,
          approved: isApproved,
        });
      }

      // Strict mode (default): reject entire GRN if any non-approved
      const strict = body.strict !== false;
      if (strict && !allApproved) {
        try {
          await supabase.from('school_compliance_events').insert({
            school_profile_id: schoolId,
            profile_id: companyId,
            kind: 'non_approved_grn_attempt',
            title: 'Blocked off-catalogue GRN',
            status: 'open',
            severity: 'high',
            event_date: new Date().toISOString().slice(0, 10),
            body: `Receive attempt rejected — only items on the ${listLabel} may enter kitchen stock.`,
            metadata: { rejected_lines: lines.filter((l) => !l.approved) },
            created_by: gate.userId || null,
          });
        } catch {
          /* soft */
        }
        return NextResponse.json(
          {
            error: `GRN rejected — kitchens may only receive products on the ${listLabel}`,
            lines,
            compliance_ok: false,
            catalogue: {
              agencyName: catalogue.agencyName,
              source: catalogue.source,
            },
            incentive:
              'Receiving only approved foods protects claim funding and headmaster prize score.',
          },
          { status: 400 }
        );
      }

      const approvedLines = lines.filter((l) => l.approved);
      if (!approvedLines.length) {
        return NextResponse.json(
          { error: 'No approved lines to receive' },
          { status: 400 }
        );
      }

      const poId = body.po_id != null ? Number(body.po_id) : null;
      let poIsp: number | null = body.isp_profile_id
        ? Number(body.isp_profile_id)
        : null;

      // Load PO for ISP + status update
      let po: Record<string, unknown> | null = null;
      if (poId && Number.isFinite(poId)) {
        const { data: poRow } = await supabase
          .from('school_purchase_orders')
          .select('*')
          .eq('id', poId)
          .eq('school_profile_id', schoolId)
          .maybeSingle();
        po = poRow;
        if (po?.isp_profile_id && !poIsp) {
          poIsp = Number(po.isp_profile_id);
        }
      }

      const receiptPayload: Record<string, unknown> = {
        school_profile_id: schoolId,
        profile_id: companyId,
        isp_profile_id: poIsp,
        receipt_number:
          body.receipt_number ||
          `GRN-${Date.now().toString(36).toUpperCase()}`,
        received_at:
          body.received_at || new Date().toISOString().slice(0, 10),
        status: 'posted',
        compliance_ok: allApproved,
        lines: approvedLines,
        notes: body.notes || null,
        created_by: gate.userId || null,
      };
      if (poId && Number.isFinite(poId)) {
        receiptPayload.po_id = poId;
        receiptPayload.purchase_order_id = poId;
      }

      let { data: receipt, error: rErr } = await supabase
        .from('school_kitchen_receipts')
        .insert(receiptPayload)
        .select('*')
        .single();

      // Soft if po_id column missing
      if (rErr && /po_id|purchase_order|column/i.test(rErr.message)) {
        delete receiptPayload.po_id;
        delete receiptPayload.purchase_order_id;
        const retry = await supabase
          .from('school_kitchen_receipts')
          .insert(receiptPayload)
          .select('*')
          .single();
        receipt = retry.data;
        rErr = retry.error;
      }

      if (rErr) {
        return NextResponse.json({ error: rErr.message }, { status: 400 });
      }

      // Upsert stock
      for (const line of approvedLines) {
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
              qty_on_hand:
                Number(existing.qty_on_hand || 0) + Number(line.qty),
              last_received_at: new Date().toISOString(),
              lot_number: line.lot || null,
              expiry_date: line.expiry || null,
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
            lot_number: line.lot || null,
            expiry_date: line.expiry || null,
            last_received_at: new Date().toISOString(),
          });
        }
      }

      // Mark PO received / partially received
      let poStatus: string | null = null;
      if (po && poId) {
        const poLines = Array.isArray(po.lines) ? po.lines : [];
        const orderedQty = poLines.reduce(
          (n: number, l: { qty?: number }) => n + Number(l.qty || 0),
          0
        );
        const receivedQty = approvedLines.reduce(
          (n, l) => n + Number(l.qty || 0),
          0
        );
        // Sum prior GRNs for this PO
        let priorQty = 0;
        try {
          const { data: prior } = await supabase
            .from('school_kitchen_receipts')
            .select('lines')
            .eq('school_profile_id', schoolId)
            .eq('po_id', poId)
            .neq('id', Number(receipt?.id || 0))
            .limit(50);
          for (const r of prior || []) {
            for (const l of (Array.isArray(r.lines) ? r.lines : []) as Array<{
              qty?: number;
            }>) {
              priorQty += Number(l.qty || 0);
            }
          }
        } catch {
          /* soft */
        }
        const totalReceived = priorQty + receivedQty;
        const pct =
          orderedQty > 0
            ? Math.min(100, Math.round((totalReceived / orderedQty) * 1000) / 10)
            : 100;
        poStatus =
          pct >= 99.5
            ? 'received'
            : totalReceived > 0
              ? 'partially_received'
              : String(po.status || 'submitted');

        await supabase
          .from('school_purchase_orders')
          .update({
            status: poStatus,
            received_at: new Date().toISOString(),
            received_pct: pct,
            updated_at: new Date().toISOString(),
          })
          .eq('id', poId)
          .eq('school_profile_id', schoolId);
      }

      return NextResponse.json({
        success: true,
        receipt,
        compliance_ok: allApproved,
        po_id: poId,
        po_status: poStatus,
      });
    }

    // Issue / waste adjustment
    if (body.action === 'issue' || body.action === 'waste') {
      const stockId = Number(body.stock_id);
      const qty = Number(body.qty || 0);
      if (!Number.isFinite(stockId) || !(qty > 0)) {
        return NextResponse.json(
          { error: 'stock_id and qty required' },
          { status: 400 }
        );
      }
      const { data: row } = await supabase
        .from('school_kitchen_stock')
        .select('*')
        .eq('id', stockId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!row) {
        return NextResponse.json({ error: 'Stock line not found' }, { status: 404 });
      }
      const next = Math.max(0, Number(row.qty_on_hand || 0) - qty);
      const { data, error: uErr } = await supabase
        .from('school_kitchen_stock')
        .update({
          qty_on_hand: next,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(typeof row.metadata === 'object' && row.metadata
              ? row.metadata
              : {}),
            last_issue: {
              action: body.action,
              qty,
              at: new Date().toISOString(),
              reason: body.reason || null,
            },
          },
        })
        .eq('id', stockId)
        .select('*')
        .single();
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, stock: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
