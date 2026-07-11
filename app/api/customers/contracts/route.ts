import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { docNumber } from '@/lib/customers/documents';
import {
  assertCustomersAccess,
  assertSellerCustomerNotSuspended,
} from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const [{ data, error }, { data: customers }] = await Promise.all([
      supabase
        .from('customer_contracts')
        .select('*')
        .eq('profile_id', companyId)
        .order('updated_at', { ascending: false }),
      supabase.from('customers').select('id, trading_name').eq('profile_id', companyId),
    ]);
    if (error) {
      return NextResponse.json({
        success: true,
        contracts: [],
        warning: error.message,
        hint: 'Run 20260709_crm_sales_lifecycle.sql',
      });
    }
    const cMap = Object.fromEntries((customers || []).map((c) => [c.id, c.trading_name]));
    return NextResponse.json({
      success: true,
      contracts: (data || []).map((c) => ({
        ...c,
        customer_name: cMap[c.customer_id] || null,
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.title) {
      return NextResponse.json({ error: 'companyId and title required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_contracts')
      .insert({
        profile_id: companyId,
        customer_id: body.customer_id || null,
        contract_number: body.contract_number || docNumber('CTR'),
        title: String(body.title).trim(),
        status: body.status || 'draft',
        contract_type: body.contract_type || 'supply',
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        auto_renew: !!body.auto_renew,
        value: Number(body.value || 0),
        currency: body.currency || 'ZAR',
        payment_terms: body.payment_terms || null,
        sla_summary: body.sla_summary || null,
        notes: body.notes || null,
        owner_name: body.owner_name || null,
        signed_at: body.status === 'active' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_crm_sales_lifecycle.sql' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, contract: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = [
      'title',
      'status',
      'contract_type',
      'start_date',
      'end_date',
      'auto_renew',
      'value',
      'currency',
      'payment_terms',
      'sla_summary',
      'notes',
      'owner_name',
      'customer_id',
    ] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (body.status === 'active' && body.signed_at === undefined) {
      updates.signed_at = new Date().toISOString();
    }

    const supabase = getSupabaseServer();
    const contractId = Number(body.id);

    // Share-related: shared_with_buyer toggle and/or customer reassignment while shared.
    // New share + reassignment while shared → membership + suspend check + rebind buyer_profile_id.
    // Unshare always allowed; clears buyer_profile_id + shared_at.
    const changingShare = body.shared_with_buyer !== undefined;
    const changingCustomer = body.customer_id !== undefined;

    if (changingShare || changingCustomer) {
      const companyId = Number(body.companyId);

      let existingQ = supabase
        .from('customer_contracts')
        .select('id, profile_id, customer_id, shared_with_buyer, buyer_profile_id')
        .eq('id', contractId);
      if (Number.isFinite(companyId) && companyId > 0) {
        existingQ = existingQ.eq('profile_id', companyId);
      }
      const { data: existing, error: loadErr } = await existingQ.maybeSingle();
      if (loadErr) {
        return NextResponse.json({ error: loadErr.message }, { status: 500 });
      }
      if (!existing) {
        return NextResponse.json({ error: 'Contract not found for this company' }, { status: 404 });
      }

      const wasShared = existing.shared_with_buyer === true;
      const nextShared = changingShare
        ? body.shared_with_buyer === true || body.shared_with_buyer === 'true'
        : wasShared;
      const nextCustomerId = Number(
        body.customer_id !== undefined ? body.customer_id : existing.customer_id
      );
      const customerChanged =
        changingCustomer &&
        Number(body.customer_id || 0) !== Number(existing.customer_id || 0);

      // Share=true path, re-assert shared, or reassignment while remaining shared
      const becomingOrStayingSharedWithChange =
        nextShared && ((changingShare && nextShared) || (wasShared && customerChanged));

      if (becomingOrStayingSharedWithChange) {
        if (!Number.isFinite(companyId) || companyId <= 0) {
          return NextResponse.json(
            { error: 'companyId required when sharing or reassigning a shared contract' },
            { status: 400 }
          );
        }
        const member = await assertCustomersAccess(body.privyUserId, companyId, 'write');
        if (!member.ok) {
          return NextResponse.json({ error: member.error }, { status: member.status });
        }
        if (!Number.isFinite(nextCustomerId) || nextCustomerId <= 0) {
          return NextResponse.json(
            { error: 'Assign a customer before sharing this contract with the buyer' },
            { status: 400 }
          );
        }

        const notSuspended = await assertSellerCustomerNotSuspended(companyId, nextCustomerId);
        if (!notSuspended.ok) {
          return NextResponse.json(
            { error: notSuspended.error },
            { status: notSuspended.status }
          );
        }

        const { data: customer } = await supabase
          .from('customers')
          .select('id, linked_profile_id')
          .eq('id', nextCustomerId)
          .eq('profile_id', companyId)
          .maybeSingle();

        // Server-resolved buyer only — never trust client buyer_profile_id
        updates.shared_with_buyer = true;
        updates.shared_at = new Date().toISOString();
        updates.buyer_profile_id =
          customer?.linked_profile_id != null ? Number(customer.linked_profile_id) : null;
        if (body.customer_id === undefined) {
          updates.customer_id = nextCustomerId;
        }
      } else if (changingShare && !nextShared) {
        // Unshare allowed while suspended — tighten access
        if (Number.isFinite(companyId) && companyId > 0) {
          const member = await assertCustomersAccess(body.privyUserId, companyId, 'write');
          if (!member.ok) {
            return NextResponse.json({ error: member.error }, { status: member.status });
          }
        }
        updates.shared_with_buyer = false;
        updates.shared_at = null;
        updates.buyer_profile_id = null;
      }
    }

    let q = supabase.from('customer_contracts').update(updates).eq('id', contractId);
    if (body.companyId != null && Number.isFinite(Number(body.companyId))) {
      q = q.eq('profile_id', Number(body.companyId));
    }

    const { data, error } = await q.select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, contract: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('customer_contracts').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
