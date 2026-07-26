import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import type { ReceiptLine } from '@/lib/schools/types';

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

    const [stockRes, receiptsRes] = await Promise.all([
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
    ]);

    return NextResponse.json({
      success: true,
      school,
      stock: stockRes.data || [],
      receipts: receiptsRes.data || [],
      warning: stockRes.error?.message || receiptsRes.error?.message,
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

      const { data: approved } = await supabase
        .from('nsnp_approved_products')
        .select('id, name, brand_name, uom, active')
        .in('id', productIds.length ? productIds : [0]);

      const byId = new Map((approved || []).map((p) => [Number(p.id), p]));

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

      // Strict mode: reject entire GRN if any non-approved (unless force_reject_line)
      const strict = body.strict !== false;
      if (strict && !allApproved) {
        return NextResponse.json(
          {
            error:
              'GRN rejected — one or more lines are not on the strict NSNP approved brand list',
            lines,
            compliance_ok: false,
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

      const { data: receipt, error: rErr } = await supabase
        .from('school_kitchen_receipts')
        .insert({
          school_profile_id: schoolId,
          profile_id: companyId,
          isp_profile_id: body.isp_profile_id
            ? Number(body.isp_profile_id)
            : null,
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
        })
        .select('*')
        .single();

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

      return NextResponse.json({
        success: true,
        receipt,
        compliance_ok: allApproved,
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
