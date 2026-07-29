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
  loadApprovedProducts,
  resolveCatalogueContext,
} from '@/lib/schools/approved-catalogue';
import {
  buildKitchenStockPlan,
  normalizeCoverPolicy,
  policyFromSchool,
  roundStockQty,
  type StockCoverPolicy,
} from '@/lib/schools/kitchen-stock-plan';
import {
  schoolLearnerCount,
  type Recipe,
  type RecipeLine,
} from '@/lib/schools/recipe-mrp';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    const policy = policyFromSchool(school as Record<string, unknown>);
    const learners = schoolLearnerCount(school as Record<string, unknown>);

    // Demand plan from DBE recipes
    const catalogue = await resolveCatalogueContext(supabase, companyId, {
      schoolProfileId: Number(school.id),
    });
    const recipes = catalogue.agencyProfileId
      ? await loadAgencyRecipes(supabase, catalogue.agencyProfileId)
      : [];
    const products = await loadApprovedProducts(
      supabase,
      catalogue.agencyProfileId,
      { activeOnly: true, includeNationalFallback: !catalogue.agencyProfileId }
    );

    const onHandByProduct = new Map<number, number>();
    for (const s of stockRes.data || []) {
      const pid = Number(s.approved_product_id);
      if (Number.isFinite(pid)) {
        onHandByProduct.set(pid, Number(s.qty_on_hand || 0));
      }
    }

    const stockPlan = buildKitchenStockPlan({
      recipes,
      learners,
      policy,
      onHandByProduct,
      catalogue: (products || []).map((p) => ({
        id: Number(p.id),
        name: String(p.name),
        brand_name: p.brand_name != null ? String(p.brand_name) : null,
        category: p.category != null ? String(p.category) : null,
        uom: p.uom != null ? String(p.uom) : null,
      })),
    });

    const planByPid = new Map(
      stockPlan.products.map((p) => [p.approved_product_id, p])
    );

    const stock = (stockRes.data || []).map((s) => {
      const uom = String(s.uom || 'kg');
      const onHand = roundStockQty(Number(s.qty_on_hand || 0), uom, 'round');
      const planRow = planByPid.get(Number(s.approved_product_id));
      // Prefer explicit reorder_level; else demand-based cover threshold
      const reorderRaw =
        s.reorder_level != null && s.reorder_level !== ''
          ? Number(s.reorder_level)
          : planRow && planRow.reorder_level > 0
            ? planRow.reorder_level
            : null;
      const reorder =
        reorderRaw != null && Number.isFinite(reorderRaw)
          ? roundStockQty(reorderRaw, uom, 'ceil')
          : null;
      const targetRaw =
        s.target_level != null
          ? Number(s.target_level)
          : planRow?.target_qty ?? null;
      const target =
        targetRaw != null && Number.isFinite(targetRaw)
          ? roundStockQty(targetRaw, uom, 'ceil')
          : null;
      const low =
        (reorder != null && Number.isFinite(reorder) && onHand <= reorder) ||
        planRow?.status === 'reorder' ||
        planRow?.status === 'critical';
      return {
        ...s,
        qty_on_hand: onHand,
        reorder_level: reorder,
        min_level:
          s.min_level != null
            ? roundStockQty(Number(s.min_level), uom, 'ceil')
            : null,
        target_level: target,
        low_stock: low,
        daily_usage: planRow?.daily_usage ?? 0,
        days_on_hand: planRow?.days_on_hand ?? null,
        suggested_order_qty: roundStockQty(
          planRow?.suggested_order_qty ?? 0,
          uom,
          'ceil'
        ),
        cover_status: planRow?.status || 'no_demand',
        cover_message: planRow?.message || null,
      };
    });
    const lowStock = stock.filter((s) => s.low_stock);

    return NextResponse.json({
      success: true,
      school,
      stock,
      lowStock,
      receipts: receiptsRes.data || [],
      openOrders: ordersRes.data || [],
      cover_policy: policy,
      learners,
      stock_plan: stockPlan,
      recipes_count: recipes.length,
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

      // Load PO for SP + status update
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

    // School cover policy: how many days of stock to hold
    if (
      body.action === 'set_cover_policy' ||
      body.action === 'set_stock_cover'
    ) {
      const policy = normalizeCoverPolicy({
        cover_days: body.cover_days,
        reorder_cover_days: body.reorder_cover_days,
        lead_time_days: body.lead_time_days,
      });
      const meta =
        school.metadata && typeof school.metadata === 'object'
          ? { ...(school.metadata as Record<string, unknown>) }
          : {};
      meta.kitchen_stock_cover_days = policy.cover_days;
      meta.kitchen_reorder_cover_days = policy.reorder_cover_days;
      meta.kitchen_lead_time_days = policy.lead_time_days;

      const patch: Record<string, unknown> = {
        kitchen_stock_cover_days: policy.cover_days,
        kitchen_reorder_cover_days: policy.reorder_cover_days,
        kitchen_lead_time_days: policy.lead_time_days,
        metadata: meta,
        updated_at: new Date().toISOString(),
      };
      let { data, error: uErr } = await supabase
        .from('school_profiles')
        .update(patch)
        .eq('id', schoolId)
        .select('*')
        .single();
      if (
        uErr &&
        /kitchen_stock_cover|kitchen_reorder|kitchen_lead|column/i.test(
          uErr.message
        )
      ) {
        const soft = {
          metadata: meta,
          updated_at: new Date().toISOString(),
        };
        const retry = await supabase
          .from('school_profiles')
          .update(soft)
          .eq('id', schoolId)
          .select('*')
          .single();
        data = retry.data;
        uErr = retry.error;
      }
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 400 });
      }

      // Optionally recompute & write levels from demand
      if (body.apply_levels !== false) {
        await applyDemandLevels(supabase, companyId, schoolId, school, policy);
      }

      return NextResponse.json({
        success: true,
        cover_policy: policy,
        school: data,
        message: `Hold ${policy.cover_days} days of stock · reorder at ${policy.reorder_cover_days} days cover`,
      });
    }

    // Write reorder/target levels from menu demand × cover days
    if (
      body.action === 'apply_suggested_levels' ||
      body.action === 'apply_cover_levels'
    ) {
      const policy = normalizeCoverPolicy({
        cover_days: body.cover_days ?? policyFromSchool(school as Record<string, unknown>).cover_days,
        reorder_cover_days:
          body.reorder_cover_days ??
          policyFromSchool(school as Record<string, unknown>).reorder_cover_days,
        lead_time_days:
          body.lead_time_days ??
          policyFromSchool(school as Record<string, unknown>).lead_time_days,
      });
      const result = await applyDemandLevels(
        supabase,
        companyId,
        schoolId,
        school,
        policy
      );
      return NextResponse.json({
        success: true,
        cover_policy: policy,
        updated: result.updated,
        plan: result.plan,
        message: `Applied cover levels for ${result.updated} product(s) from menu demand`,
      });
    }

    // Set inventory levels (on-hand + reorder/min/target) for catalogue foods
    if (
      body.action === 'set_levels' ||
      body.action === 'set_stock_levels' ||
      body.action === 'inventory_levels'
    ) {
      const rawLines = Array.isArray(body.lines) ? body.lines : [];
      if (!rawLines.length) {
        return NextResponse.json(
          { error: 'lines required — each product with levels' },
          { status: 400 }
        );
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

      const updated: unknown[] = [];
      for (const l of rawLines) {
        const pid = Number(l.approved_product_id);
        const prod = byId.get(pid);
        if (!prod && !l.product_name) continue;

        const name = String(prod?.name || l.product_name || 'Product');
        const brand = String(prod?.brand_name || l.brand_name || '');
        const uom = String(l.uom || prod?.uom || 'kg');

        const { data: existing } = await supabase
          .from('school_kitchen_stock')
          .select('id, qty_on_hand')
          .eq('school_profile_id', schoolId)
          .eq('approved_product_id', pid)
          .maybeSingle();

        const patch: Record<string, unknown> = {
          product_name: name,
          brand_name: brand,
          uom,
          updated_at: new Date().toISOString(),
        };
        if (l.qty_on_hand !== undefined && l.qty_on_hand !== '') {
          patch.qty_on_hand = roundStockQty(
            Math.max(0, Number(l.qty_on_hand) || 0),
            uom,
            'round'
          );
        }
        if (l.reorder_level !== undefined && l.reorder_level !== '') {
          patch.reorder_level =
            l.reorder_level === null
              ? null
              : roundStockQty(
                  Math.max(0, Number(l.reorder_level) || 0),
                  uom,
                  'ceil'
                );
        }
        if (l.min_level !== undefined && l.min_level !== '') {
          patch.min_level =
            l.min_level === null
              ? null
              : roundStockQty(
                  Math.max(0, Number(l.min_level) || 0),
                  uom,
                  'ceil'
                );
        }
        if (l.target_level !== undefined && l.target_level !== '') {
          patch.target_level =
            l.target_level === null
              ? null
              : roundStockQty(
                  Math.max(0, Number(l.target_level) || 0),
                  uom,
                  'ceil'
                );
        }

        if (existing?.id) {
          const { data, error: uErr } = await supabase
            .from('school_kitchen_stock')
            .update(patch)
            .eq('id', existing.id)
            .select('*')
            .single();
          if (uErr) {
            // Retry without new columns
            if (/reorder_level|min_level|target_level|column/i.test(uErr.message)) {
              const soft = { ...patch };
              delete soft.reorder_level;
              delete soft.min_level;
              delete soft.target_level;
              soft.metadata = {
                reorder_level: patch.reorder_level ?? null,
                min_level: patch.min_level ?? null,
                target_level: patch.target_level ?? null,
              };
              const retry = await supabase
                .from('school_kitchen_stock')
                .update(soft)
                .eq('id', existing.id)
                .select('*')
                .single();
              if (retry.data) updated.push(retry.data);
            }
          } else if (data) {
            updated.push(data);
          }
        } else {
          const insertRow: Record<string, unknown> = {
            school_profile_id: schoolId,
            profile_id: companyId,
            approved_product_id: pid,
            product_name: name,
            brand_name: brand,
            qty_on_hand:
              l.qty_on_hand !== undefined && l.qty_on_hand !== ''
                ? roundStockQty(
                    Math.max(0, Number(l.qty_on_hand) || 0),
                    uom,
                    'round'
                  )
                : 0,
            uom,
            reorder_level:
              l.reorder_level !== undefined && l.reorder_level !== ''
                ? roundStockQty(
                    Math.max(0, Number(l.reorder_level) || 0),
                    uom,
                    'ceil'
                  )
                : null,
            min_level:
              l.min_level !== undefined && l.min_level !== ''
                ? roundStockQty(
                    Math.max(0, Number(l.min_level) || 0),
                    uom,
                    'ceil'
                  )
                : null,
            target_level:
              l.target_level !== undefined && l.target_level !== ''
                ? roundStockQty(
                    Math.max(0, Number(l.target_level) || 0),
                    uom,
                    'ceil'
                  )
                : null,
          };
          const { data, error: iErr } = await supabase
            .from('school_kitchen_stock')
            .insert(insertRow)
            .select('*')
            .single();
          if (iErr && /reorder_level|min_level|target_level|column/i.test(iErr.message)) {
            delete insertRow.reorder_level;
            delete insertRow.min_level;
            delete insertRow.target_level;
            insertRow.metadata = {
              reorder_level: l.reorder_level ?? null,
              min_level: l.min_level ?? null,
              target_level: l.target_level ?? null,
            };
            const retry = await supabase
              .from('school_kitchen_stock')
              .insert(insertRow)
              .select('*')
              .single();
            if (retry.data) updated.push(retry.data);
          } else if (data) {
            updated.push(data);
          }
        }
      }

      return NextResponse.json({
        success: true,
        stock: updated,
        message: `Updated inventory levels for ${updated.length} product(s)`,
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

async function loadAgencyRecipes(
  supabase: ReturnType<typeof getSupabaseServer>,
  agencyProfileId: number
): Promise<Recipe[]> {
  const { data: recipes, error } = await supabase
    .from('nsnp_recipes')
    .select('*')
    .eq('agency_profile_id', agencyProfileId)
    .eq('active', true)
    .limit(200);
  if (error || !recipes?.length) return [];
  const ids = recipes.map((r) => Number(r.id));
  const { data: lines } = await supabase
    .from('nsnp_recipe_lines')
    .select('*')
    .in('recipe_id', ids)
    .order('sort_order');
  const byRecipe = new Map<number, RecipeLine[]>();
  for (const l of lines || []) {
    const rid = Number(l.recipe_id);
    const arr = byRecipe.get(rid) || [];
    arr.push({
      approved_product_id: l.approved_product_id
        ? Number(l.approved_product_id)
        : null,
      product_name: String(l.product_name),
      brand_name: l.brand_name != null ? String(l.brand_name) : null,
      category: l.category != null ? String(l.category) : 'other',
      qty_per_portion: Number(l.qty_per_portion),
      uom: String(l.uom || 'kg'),
      wastage_pct: Number(l.wastage_pct || 0),
    });
    byRecipe.set(rid, arr);
  }
  return recipes.map((r) => {
    const wd =
      r.weekday != null && r.weekday !== '' ? Number(r.weekday) : null;
    return {
      id: Number(r.id),
      agency_profile_id: Number(r.agency_profile_id),
      name: String(r.name),
      meal_type: String(r.meal_type || 'lunch'),
      weekday:
        wd != null && Number.isFinite(wd) && wd >= 1 && wd <= 5 ? wd : null,
      portion_learners: Number(r.portion_learners || 1),
      active: r.active !== false,
      lines: byRecipe.get(Number(r.id)) || [],
    };
  });
}

async function applyDemandLevels(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  schoolId: number,
  school: Record<string, unknown>,
  policy: StockCoverPolicy
): Promise<{ updated: number; plan: ReturnType<typeof buildKitchenStockPlan> }> {
  const learners = schoolLearnerCount(school);
  const catalogue = await resolveCatalogueContext(supabase, companyId, {
    schoolProfileId: schoolId,
  });
  const recipes = catalogue.agencyProfileId
    ? await loadAgencyRecipes(supabase, catalogue.agencyProfileId)
    : [];
  const { data: stockRows } = await supabase
    .from('school_kitchen_stock')
    .select('approved_product_id, qty_on_hand')
    .eq('school_profile_id', schoolId)
    .limit(500);
  const onHand = new Map<number, number>();
  for (const s of stockRows || []) {
    const pid = Number(s.approved_product_id);
    if (Number.isFinite(pid)) onHand.set(pid, Number(s.qty_on_hand || 0));
  }
  const products = await loadApprovedProducts(supabase, catalogue.agencyProfileId, {
    activeOnly: true,
  });
  const plan = buildKitchenStockPlan({
    recipes,
    learners,
    policy,
    onHandByProduct: onHand,
    catalogue: products.map((p) => ({
      id: Number(p.id),
      name: String(p.name),
      brand_name: p.brand_name != null ? String(p.brand_name) : null,
      category: p.category != null ? String(p.category) : null,
      uom: p.uom != null ? String(p.uom) : null,
    })),
  });

  let updated = 0;
  for (const p of plan.products) {
    if (!(p.daily_usage > 0) && !(p.qty_on_hand > 0)) continue;
    const { data: existing } = await supabase
      .from('school_kitchen_stock')
      .select('id, qty_on_hand')
      .eq('school_profile_id', schoolId)
      .eq('approved_product_id', p.approved_product_id)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      product_name: p.product_name,
      brand_name: p.brand_name || '',
      uom: p.uom,
      reorder_level: roundStockQty(p.reorder_level, p.uom, 'ceil'),
      target_level: roundStockQty(p.target_qty, p.uom, 'ceil'),
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('school_kitchen_stock')
        .update(patch)
        .eq('id', existing.id);
      if (!error) updated += 1;
      else if (/reorder_level|target_level|column/i.test(error.message)) {
        await supabase
          .from('school_kitchen_stock')
          .update({
            product_name: p.product_name,
            brand_name: p.brand_name || '',
            uom: p.uom,
            metadata: {
              reorder_level: p.reorder_level,
              target_level: p.target_qty,
              cover_days: policy.cover_days,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        updated += 1;
      }
    } else if (p.daily_usage > 0) {
      const insertRow: Record<string, unknown> = {
        school_profile_id: schoolId,
        profile_id: companyId,
        approved_product_id: p.approved_product_id,
        product_name: p.product_name,
        brand_name: p.brand_name || '',
        qty_on_hand: 0,
        uom: p.uom,
        reorder_level: roundStockQty(p.reorder_level, p.uom, 'ceil'),
        target_level: roundStockQty(p.target_qty, p.uom, 'ceil'),
      };
      const { error } = await supabase
        .from('school_kitchen_stock')
        .insert(insertRow);
      if (!error) updated += 1;
      else if (/reorder_level|target_level|column/i.test(error.message)) {
        delete insertRow.reorder_level;
        delete insertRow.target_level;
        insertRow.metadata = {
          reorder_level: p.reorder_level,
          target_level: p.target_qty,
        };
        await supabase.from('school_kitchen_stock').insert(insertRow);
        updated += 1;
      }
    }
  }
  return { updated, plan };
}
