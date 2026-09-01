import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isClosedLike, isOpenLike } from '@/lib/suppliers/riad';

/**
 * GET ?companyId=&supplierId=&type=&status=
 * List supplier RIADs with container-style status buckets + summary (SRM).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const supplierId = sp.get('supplierId') ? Number(sp.get('supplierId')) : null;
    const type = sp.get('type');
    const status = sp.get('status');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    let q = supabase
      .from('supplier_riad')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (type && type !== 'all') q = q.eq('entry_type', type);
    if (supplierId && Number.isFinite(supplierId)) q = q.eq('supplier_id', supplierId);

    const [{ data, error }, { data: bookSuppliers }] = await Promise.all([
      q,
      supabase.from('srm_suppliers').select('id, trading_name').eq('profile_id', companyId),
    ]);
    if (error) {
      return NextResponse.json({
        success: true,
        entries: [],
        items: [],
        summary: emptySummary(),
        counts: emptyCounts(),
        warning: error.message,
        hint: 'Run 20260709_supplier_riad.sql',
      });
    }
    const cMap = Object.fromEntries((bookSuppliers || []).map((c) => [c.id, c.trading_name]));
    let entries = (data || []).map((e) => ({
      ...e,
      supplier_name: e.supplier_id ? cMap[e.supplier_id] : null,
      // UI aliases aligned with container register
      riad_type: e.entry_type,
      priority: e.severity || 'medium',
    }));

    const norm = (s?: string | null) => String(s || 'open').toLowerCase();
    const byStatus: Record<string, number> = {};
    for (const i of entries) {
      const s = norm(i.status);
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    const open = entries.filter((i) => isOpenLike(i.status)).length;
    const closed = entries.filter((i) => isClosedLike(i.status)).length;
    const inProgress = entries.filter((i) => norm(i.status) === 'in_progress').length;
    const onHold = entries.filter((i) => norm(i.status) === 'on_hold').length;
    const critical = entries.filter(
      (i) =>
        isOpenLike(i.status) && String(i.severity || i.priority || '').toLowerCase() === 'critical'
    ).length;

    const statusFilter = status && status !== 'all' ? status : null;
    if (statusFilter) {
      if (statusFilter === 'open' || statusFilter === 'open_bucket') {
        entries = entries.filter((i) => isOpenLike(i.status));
      } else if (statusFilter === 'closed' || statusFilter === 'closed_bucket') {
        entries = entries.filter((i) => isClosedLike(i.status));
      } else if (statusFilter === 'critical') {
        entries = entries.filter(
          (i) =>
            isOpenLike(i.status) &&
            String(i.severity || i.priority || '').toLowerCase() === 'critical'
        );
      } else {
        entries = entries.filter((i) => norm(i.status) === statusFilter.toLowerCase());
      }
    }

    const counts = {
      risk: entries.filter((e) => e.entry_type === 'risk' && isOpenLike(e.status)).length,
      issue: entries.filter((e) => e.entry_type === 'issue' && isOpenLike(e.status)).length,
      action: entries.filter((e) => e.entry_type === 'action' && isOpenLike(e.status)).length,
      decision: entries.filter((e) => e.entry_type === 'decision' && isOpenLike(e.status)).length,
      open,
    };

    const summary = {
      total: (data || []).length,
      open,
      closed,
      inProgress,
      onHold,
      critical,
      byStatus,
    };

    return NextResponse.json({
      success: true,
      entries,
      items: entries,
      counts,
      summary,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

function emptySummary() {
  return {
    total: 0,
    open: 0,
    closed: 0,
    inProgress: 0,
    onHold: 0,
    critical: 0,
    byStatus: {} as Record<string, number>,
  };
}

function emptyCounts() {
  return { risk: 0, issue: 0, action: 0, decision: 0, open: 0 };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.title) {
      return NextResponse.json({ error: 'companyId and title required' }, { status: 400 });
    }
    const entryType = body.entry_type || body.riad_type || 'risk';
    const severity = body.severity || body.priority || 'medium';
    const supabase = getSupabaseServer();

    const payload: Record<string, unknown> = {
      profile_id: companyId,
      supplier_id: body.supplier_id || body.supplierId || null,
      entry_type: entryType,
      title: String(body.title).trim(),
      description: body.description || null,
      status: body.status || 'open',
      severity,
      owner_name: body.owner_name || null,
      due_date: body.due_date || null,
      related_po_id: body.related_po_id || body.related_order_id || null,
      created_by: body.created_by || body.created_by_name || null,
      updated_at: new Date().toISOString(),
    };
    // Optional richer columns if migration added them
    if (body.category != null) payload.category = body.category || null;
    if (body.mitigation_plan != null) payload.mitigation_plan = body.mitigation_plan || null;
    if (body.notes != null) payload.notes = body.notes || null;
    if (body.resolution != null) payload.resolution = body.resolution || null;

    let { data, error } = await supabase
      .from('supplier_riad')
      .insert(payload)
      .select('*')
      .single();

    if (error && /column|schema cache/i.test(error.message || '')) {
      const minimal = {
        profile_id: companyId,
        supplier_id: payload.supplier_id,
        entry_type: entryType,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        severity,
        owner_name: payload.owner_name,
        due_date: payload.due_date,
        updated_at: payload.updated_at,
      };
      const retry = await supabase.from('supplier_riad').insert(minimal).select('*').single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_supplier_riad.sql' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      entry: data,
      item: data
        ? {
            ...data,
            riad_type: data.entry_type,
            priority: data.severity,
          }
        : data,
    });
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
      'description',
      'status',
      'severity',
      'owner_name',
      'due_date',
      'entry_type',
      'supplier_id',
      'related_po_id',
      'category',
      'mitigation_plan',
      'notes',
      'resolution',
    ] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (body.priority !== undefined && body.severity === undefined) {
      updates.severity = body.priority;
    }
    if (body.riad_type !== undefined && body.entry_type === undefined) {
      updates.entry_type = body.riad_type;
    }
    if (body.status === 'closed' || body.status === 'resolved') {
      updates.closed_at = body.closed_at || new Date().toISOString();
    }
    if (body.closed_at !== undefined) updates.closed_at = body.closed_at;

    const supabase = getSupabaseServer();
    let { data, error } = await supabase
      .from('supplier_riad')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();

    if (error && /column|schema cache/i.test(error.message || '')) {
      const safe: Record<string, unknown> = { updated_at: updates.updated_at };
      for (const k of [
        'title',
        'description',
        'status',
        'severity',
        'owner_name',
        'due_date',
        'entry_type',
        'supplier_id',
        'closed_at',
      ]) {
        if (updates[k] !== undefined) safe[k] = updates[k];
      }
      // Fold resolution into description if column missing
      if (body.resolution && !safe.description) {
        /* keep */
      } else if (body.resolution) {
        safe.description = [body.description, `Resolution: ${body.resolution}`]
          .filter(Boolean)
          .join('\n\n');
      }
      const retry = await supabase
        .from('supplier_riad')
        .update(safe)
        .eq('id', Number(body.id))
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      success: true,
      entry: data,
      item: data
        ? {
            ...data,
            riad_type: data.entry_type,
            priority: data.severity,
          }
        : data,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('supplier_riad').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
