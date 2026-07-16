import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { transferNumber } from '@/lib/containers/resellers';
import { hasQaHold, qaHoldErrorPayload } from '@/lib/quality/holds';

/**
 * POST — draw stock from a container to a verified reseller.
 * Body: {
 *   companyId, resellerId, containerId,
 *   lines: [{ product_name, sku?, product_id?, quantity, unit?, unit_cost?, lot_number? }]
 *   overrideQaHold?: boolean  // owner/admin only
 * }
 * Only verified resellers may receive stock.
 * Lines with lot_number are blocked when open/failed QA inspections exist (same as warehouse ship).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const resellerId = Number(body.resellerId);
    const containerId = Number(body.containerId);
    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (
      !Number.isFinite(companyId) ||
      !Number.isFinite(resellerId) ||
      !Number.isFinite(containerId)
    ) {
      return NextResponse.json(
        { error: 'companyId, resellerId, containerId required' },
        { status: 400 }
      );
    }
    if (!lines.length) {
      return NextResponse.json(
        { error: 'Add at least one stock line' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();

    const { data: reseller } = await supabase
      .from('container_resellers')
      .select('*')
      .eq('id', resellerId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (!reseller) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 });
    }

    const vStatus = String(reseller.verification_status || '').toLowerCase();
    if (vStatus !== 'verified' && vStatus !== 'mismatch') {
      return NextResponse.json(
        {
          error:
            'Reseller must pass VerifyNow verification before receiving stock',
          verification_status: reseller.verification_status,
        },
        { status: 403 }
      );
    }

    const { data: container } = await supabase
      .from('containers')
      .select('id, name, container_code')
      .eq('id', containerId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (!container) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 });
    }

    // QA hold gate — same control as warehouse stock ship
    {
      const lotNums = lines.map(
        (l: { lot_number?: string | null }) => l.lot_number
      );
      const qa = await hasQaHold(companyId, lotNums);
      if (qa.blocked) {
        const lots = [...new Set(qa.holds.map((h) => h.lot_number))];
        if (body.overrideQaHold) {
          const { getCompanyMembership } = await import('@/lib/business/access');
          const { normalizeTeamRole } = await import('@/lib/business/permissions');
          const mem = await getCompanyMembership(gate.userId, companyId);
          const role = mem.ok ? normalizeTeamRole(mem.role) : null;
          if (!role || !['owner', 'admin'].includes(role)) {
            return NextResponse.json(
              {
                error:
                  'QA hold override requires owner or admin role. Clear inspections first.',
                code: 'QA_OVERRIDE_FORBIDDEN',
                holds: qa.holds,
              },
              { status: 403 }
            );
          }
          void import('@/lib/audit/log').then(({ auditLog }) =>
            auditLog({
              companyId,
              actorUserId: gate.userId,
              action: 'override.qa_hold',
              entityType: 'reseller_stock_transfer',
              entityId: resellerId,
              summary: `QA hold override on reseller draw — lot(s) ${lots.join(', ')}`,
              metadata: { holds: qa.holds, containerId, resellerId },
            })
          );
        } else {
          void import('@/lib/audit/log').then(({ auditLog }) =>
            auditLog({
              companyId,
              actorUserId: gate.userId,
              action: 'qa.hold.ship_blocked',
              entityType: 'reseller_stock_transfer',
              entityId: resellerId,
              summary: `Reseller draw blocked by QA hold on lot(s) ${lots.join(', ')}`,
              metadata: { holds: qa.holds, containerId },
            })
          );
          return NextResponse.json(
            {
              ...qaHoldErrorPayload(qa.holds),
              error: `QA hold: lot(s) ${lots.join(', ')} have open or failed inspections. Clear Quality → Inspections before drawing stock to resellers.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const transferLines: Array<Record<string, unknown>> = [];
    const now = new Date().toISOString();

    for (const line of lines) {
      const productName = String(line.product_name || '').trim();
      const qty = Number(line.quantity);
      if (!productName || !(qty > 0)) continue;

      // Find container inventory line
      let invQ = supabase
        .from('container_inventory')
        .select('*')
        .eq('profile_id', companyId)
        .eq('container_id', containerId)
        .eq('product_name', productName);

      if (line.product_id) {
        invQ = supabase
          .from('container_inventory')
          .select('*')
          .eq('profile_id', companyId)
          .eq('container_id', containerId)
          .eq('product_id', Number(line.product_id));
      }

      const { data: invRow } = await invQ.maybeSingle();
      // fallback by name if product_id miss
      let stock = invRow;
      if (!stock) {
        const { data: byName } = await supabase
          .from('container_inventory')
          .select('*')
          .eq('profile_id', companyId)
          .eq('container_id', containerId)
          .eq('product_name', productName)
          .maybeSingle();
        stock = byName;
      }

      if (!stock) {
        return NextResponse.json(
          {
            error: `No stock line for "${productName}" on container`,
          },
          { status: 400 }
        );
      }

      const onHand = Number(stock.qty_on_hand || 0);
      if (qty > onHand) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${productName} (have ${onHand}, need ${qty})`,
          },
          { status: 400 }
        );
      }

      // Decrement container
      const { error: decErr } = await supabase
        .from('container_inventory')
        .update({
          qty_on_hand: onHand - qty,
          updated_at: now,
        })
        .eq('id', stock.id);

      if (decErr) {
        return NextResponse.json({ error: decErr.message }, { status: 500 });
      }

      // Upsert reseller inventory
      let rInvQ = supabase
        .from('reseller_inventory')
        .select('*')
        .eq('profile_id', companyId)
        .eq('reseller_id', resellerId)
        .eq('product_name', productName);

      const { data: existingR } = await rInvQ.maybeSingle();

      if (existingR) {
        await supabase
          .from('reseller_inventory')
          .update({
            qty_on_hand: Number(existingR.qty_on_hand || 0) + qty,
            container_id: containerId,
            product_id: stock.product_id || line.product_id || null,
            sku: stock.sku || line.sku || null,
            unit: stock.unit || line.unit || 'unit',
            unit_cost: stock.unit_cost ?? line.unit_cost ?? 0,
            last_received_at: now,
            updated_at: now,
          })
          .eq('id', existingR.id);
      } else {
        await supabase.from('reseller_inventory').insert({
          profile_id: companyId,
          reseller_id: resellerId,
          container_id: containerId,
          product_id: stock.product_id || line.product_id || null,
          product_name: productName,
          sku: stock.sku || line.sku || null,
          qty_on_hand: qty,
          unit: stock.unit || line.unit || 'unit',
          unit_cost: stock.unit_cost ?? line.unit_cost ?? 0,
          unit_sell_price: line.unit_sell_price ?? 0,
          last_received_at: now,
          created_at: now,
          updated_at: now,
        });
      }

      transferLines.push({
        product_id: stock.product_id || line.product_id || null,
        product_name: productName,
        sku: stock.sku || line.sku || null,
        qty,
        unit: stock.unit || 'unit',
        unit_cost: stock.unit_cost ?? 0,
        lot_number: line.lot_number ? String(line.lot_number) : null,
        from_inventory_id: stock.id,
      });
    }

    if (!transferLines.length) {
      return NextResponse.json(
        { error: 'No valid transfer lines' },
        { status: 400 }
      );
    }

    const { data: transfer, error: tErr } = await supabase
      .from('reseller_stock_transfers')
      .insert({
        profile_id: companyId,
        reseller_id: resellerId,
        container_id: containerId,
        transfer_number: transferNumber(),
        status: 'completed',
        notes: body.notes || null,
        lines: transferLines,
        created_by: gate.userId,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    }

    // Set primary container if empty
    if (!reseller.primary_container_id) {
      await supabase
        .from('container_resellers')
        .update({
          primary_container_id: containerId,
          updated_at: now,
        })
        .eq('id', resellerId);
    }

    return NextResponse.json({
      success: true,
      transfer,
      message: `Transferred ${transferLines.length} line(s) to ${reseller.full_name}`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const resellerId = request.nextUrl.searchParams.get('resellerId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let q = supabase
      .from('reseller_stock_transfers')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (resellerId) q = q.eq('reseller_id', Number(resellerId));

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        transfers: [],
        warning: error.message,
      });
    }
    return NextResponse.json({ success: true, transfers: data || [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
