import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  DMAIC_GATE_KEYS,
  isDmaicGate,
  MIGRATION_HINT,
} from '@/lib/projects/types';
import { addDays, isoDay, seedWaterfallTasks } from '@/lib/projects/waterfall';

const PROJECT_STATUSES = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
] as const;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const methodology = sp.get('methodology');
    const programmeId = Number(sp.get('programmeId'));
    const board = sp.get('board'); // dmaic → group by methodology_gate
    const customerId = Number(sp.get('customerId'));
    const supplierId = Number(sp.get('supplierId'));
    const partnerKind = sp.get('partner'); // customer | supplier — any attached partner

    const supabase = getSupabaseServer();
    let q = supabase
      .from('pm_projects')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });
    if (methodology && methodology !== 'all') {
      q = q.eq('methodology', methodology);
    }
    if (Number.isFinite(programmeId) && programmeId > 0) {
      q = q.eq('programme_id', programmeId);
    }
    if (Number.isFinite(customerId) && customerId > 0) {
      q = q.eq('customer_id', customerId);
    }
    if (Number.isFinite(supplierId) && supplierId > 0) {
      q = q.eq('supplier_id', supplierId);
    }
    if (partnerKind === 'customer' && !(Number.isFinite(customerId) && customerId > 0)) {
      q = q.not('customer_id', 'is', null);
    }
    if (partnerKind === 'supplier' && !(Number.isFinite(supplierId) && supplierId > 0)) {
      q = q.not('supplier_id', 'is', null);
    }

    let { data, error } = await q;

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const retry = supabase
        .from('pm_projects')
        .select('*')
        .eq('profile_id', companyId)
        .order('updated_at', { ascending: false });
      const r2 = await retry;
      data = r2.data;
      error = r2.error;
    }

    if (error) {
      return NextResponse.json({
        success: true,
        projects: [],
        warning: error.message,
        migration: '20260711_haccp_esg_pm_suite.sql + 20260723_pm_epm_pmo.sql + 20260824_trade_projects.sql',
        hint: MIGRATION_HINT,
      });
    }

    let projects = data || [];
    if (partnerKind === 'customer' || (Number.isFinite(customerId) && customerId > 0)) {
      projects = projects.filter((p) => {
        const id = Number(p.customer_id);
        const meta = p.metadata && typeof p.metadata === 'object'
          ? (p.metadata as Record<string, unknown>)
          : {};
        const mid = Number(meta.customer_id);
        if (Number.isFinite(customerId) && customerId > 0) {
          return id === customerId || mid === customerId;
        }
        return Number.isFinite(id) || Number.isFinite(mid);
      });
    }
    if (partnerKind === 'supplier' || (Number.isFinite(supplierId) && supplierId > 0)) {
      projects = projects.filter((p) => {
        const id = Number(p.supplier_id);
        const meta = p.metadata && typeof p.metadata === 'object'
          ? (p.metadata as Record<string, unknown>)
          : {};
        const mid = Number(meta.supplier_id);
        if (Number.isFinite(supplierId) && supplierId > 0) {
          return id === supplierId || mid === supplierId;
        }
        return Number.isFinite(id) || Number.isFinite(mid);
      });
    }
    const ids = projects.map((p) => p.id);
    let taskCounts: Record<number, { total: number; done: number }> = {};
    let milestoneCounts: Record<number, { total: number; done: number }> = {};
    let riadCounts: Record<number, number> = {};
    if (ids.length) {
      const [{ data: tasks }, { data: miles }, { data: riads }] =
        await Promise.all([
          supabase
            .from('pm_tasks')
            .select('id, project_id, status, column_key')
            .in('project_id', ids),
          supabase
            .from('pm_milestones')
            .select('id, project_id, done')
            .in('project_id', ids),
          supabase
            .from('pm_project_riads')
            .select('id, project_id, status')
            .in('project_id', ids)
            .in('status', ['open', 'active', 'in_progress']),
        ]);
      for (const t of tasks || []) {
        const c = taskCounts[t.project_id] || { total: 0, done: 0 };
        c.total += 1;
        if (t.column_key === 'done' || t.status === 'done') c.done += 1;
        taskCounts[t.project_id] = c;
      }
      for (const m of miles || []) {
        const c = milestoneCounts[m.project_id] || { total: 0, done: 0 };
        c.total += 1;
        if (m.done) c.done += 1;
        milestoneCounts[m.project_id] = c;
      }
      for (const r of riads || []) {
        riadCounts[r.project_id] = (riadCounts[r.project_id] || 0) + 1;
      }
    }

    const customerNames: Record<number, string> = {};
    const supplierNames: Record<number, string> = {};
    const cids = [
      ...new Set(
        projects
          .map((p) => Number(p.customer_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    const sids = [
      ...new Set(
        projects
          .map((p) => Number(p.supplier_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    if (cids.length) {
      const { data: rows } = await supabase
        .from('customers')
        .select('id, trading_name')
        .eq('profile_id', companyId)
        .in('id', cids);
      for (const r of rows || []) {
        customerNames[Number(r.id)] = String(r.trading_name || `#${r.id}`);
      }
    }
    if (sids.length) {
      const { data: rows } = await supabase
        .from('srm_suppliers')
        .select('id, trading_name')
        .eq('profile_id', companyId)
        .in('id', sids);
      for (const r of rows || []) {
        supplierNames[Number(r.id)] = String(r.trading_name || `#${r.id}`);
      }
    }

    const enriched = projects.map((p) => ({
      ...p,
      task_stats: taskCounts[p.id] || { total: 0, done: 0 },
      milestone_stats: milestoneCounts[p.id] || { total: 0, done: 0 },
      open_riads: riadCounts[p.id] || 0,
      partner_name:
        (p.customer_id && customerNames[Number(p.customer_id)]) ||
        (p.supplier_id && supplierNames[Number(p.supplier_id)]) ||
        null,
    }));

    // DMAIC board: projects per gate
    let dmaicBoard: Record<string, typeof enriched> | undefined;
    if (board === 'dmaic') {
      dmaicBoard = {};
      for (const g of DMAIC_GATE_KEYS) dmaicBoard[g] = [];
      for (const p of enriched) {
        if (p.methodology !== 'dmaic' && p.methodology !== 'hybrid') continue;
        const gate = isDmaicGate(p.methodology_gate)
          ? p.methodology_gate
          : 'define';
        if (!dmaicBoard[gate]) dmaicBoard[gate] = [];
        dmaicBoard[gate].push(p);
      }
    }

    return NextResponse.json({
      success: true,
      projects: enriched,
      dmaicBoard,
      summary: {
        total: projects.length,
        active: projects.filter((p) => p.status === 'active').length,
        completed: projects.filter((p) => p.status === 'completed').length,
        on_hold: projects.filter((p) => p.status === 'on_hold').length,
        dmaic: projects.filter(
          (p) => p.methodology === 'dmaic' || p.methodology === 'hybrid'
        ).length,
        sdg: projects.filter(
          (p) => p.methodology === 'sdg' || p.methodology === 'hybrid'
        ).length,
        withProgramme: projects.filter((p) => p.programme_id).length,
      },
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!String(body.name || '').trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const methodology = String(body.methodology || 'standard');
    const isDmaic = methodology === 'dmaic' || methodology === 'hybrid';
    const gate = isDmaicGate(body.methodology_gate)
      ? body.methodology_gate
      : isDmaic
        ? 'define'
        : null;

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const insertRow: Record<string, unknown> = {
      profile_id: companyId,
      name: String(body.name).trim(),
      description: body.description || null,
      status: PROJECT_STATUSES.includes(body.status) ? body.status : 'planning',
      priority: body.priority || 'medium',
      owner_name: body.owner_name || null,
      budget: body.budget != null ? Number(body.budget) : null,
      currency: body.currency || 'ZAR',
      start_date: body.start_date || null,
      target_date: body.target_date || null,
      health: body.health || 'green',
      methodology,
      methodology_gate: gate,
      project_type: body.project_type || 'initiative',
      programme_id:
        body.programme_id != null && Number(body.programme_id) > 0
          ? Number(body.programme_id)
          : null,
      sdg_goal:
        body.sdg_goal != null && Number(body.sdg_goal) >= 1
          ? Number(body.sdg_goal)
          : null,
      sdg_targets: Array.isArray(body.sdg_targets) ? body.sdg_targets : [],
      problem_statement: body.problem_statement || null,
      goal_statement: body.goal_statement || null,
      charter_date: body.charter_date || null,
      gate_entered_at: gate ? now : null,
      created_by: mem.userId,
      updated_at: now,
      customer_id:
        body.customer_id != null && Number(body.customer_id) > 0
          ? Number(body.customer_id)
          : null,
      supplier_id:
        body.supplier_id != null && Number(body.supplier_id) > 0
          ? Number(body.supplier_id)
          : null,
    };

    let { data, error } = await supabase
      .from('pm_projects')
      .insert(insertRow)
      .select('*')
      .single();

    if (error) {
      // Soft: columns may be missing — retry core fields
      if (/column|schema cache|does not exist/i.test(error.message)) {
        const { data: soft, error: softErr } = await supabase
          .from('pm_projects')
          .insert({
            profile_id: companyId,
            name: String(body.name).trim(),
            description: body.description || null,
            status: PROJECT_STATUSES.includes(body.status)
              ? body.status
              : 'planning',
            priority: body.priority || 'medium',
            owner_name: body.owner_name || null,
            budget: body.budget != null ? Number(body.budget) : null,
            currency: body.currency || 'ZAR',
            start_date: body.start_date || null,
            target_date: body.target_date || null,
            health: body.health || 'green',
            created_by: mem.userId,
            updated_at: now,
            metadata: {
              methodology,
              methodology_gate: gate,
              programme_id: insertRow.programme_id,
              sdg_goal: insertRow.sdg_goal,
              sdg_targets: insertRow.sdg_targets,
              customer_id: insertRow.customer_id,
              supplier_id: insertRow.supplier_id,
            },
          })
          .select('*')
          .single();
        if (softErr) {
          return NextResponse.json(
            {
              error: softErr.message,
              migration: '20260711_haccp_esg_pm_suite.sql',
              hint: MIGRATION_HINT,
            },
            { status: 503 }
          );
        }
        data = soft;
        error = null;
      } else {
        return NextResponse.json(
          {
            error: error.message,
            migration: '20260711_haccp_esg_pm_suite.sql',
            hint: MIGRATION_HINT,
          },
          { status: 503 }
        );
      }
    }

    if (body.seed_waterfall === true && data?.id) {
      const start = String(body.start_date || isoDay(new Date()));
      const end = String(body.target_date || addDays(start, 56));
      const seeds = seedWaterfallTasks(start, end);
      const rows = seeds.map((s) => ({
        profile_id: companyId,
        project_id: data.id,
        title: s.title,
        status: s.status,
        column_key: s.column_key,
        start_date: s.start_date,
        due_date: s.due_date,
        phase_key: s.phase_key,
        sort_order: s.sort_order,
        created_by: mem.userId,
        updated_at: now,
      }));
      const ins = await supabase.from('pm_tasks').insert(rows);
      if (ins.error && /column|schema cache|does not exist/i.test(ins.error.message)) {
        await supabase.from('pm_tasks').insert(
          rows.map(({ start_date: _s, phase_key: _p, ...rest }) => rest)
        );
      }
    }

    return NextResponse.json({ success: true, project: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const action = String(body.action || '').toLowerCase();

    // ── DMAIC gate move (drag-drop stage gate) ───────────────────────────
    if (action === 'move_gate' || body.methodology_gate !== undefined) {
      const toGate = String(body.methodology_gate || body.to_gate || '');
      if (!isDmaicGate(toGate)) {
        return NextResponse.json(
          { error: 'Invalid DMAIC gate (define|measure|analyze|improve|control)' },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from('pm_projects')
        .select('id, methodology_gate, methodology')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const fromGate = existing.methodology_gate
        ? String(existing.methodology_gate)
        : null;
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('pm_projects')
        .update({
          methodology_gate: toGate,
          gate_entered_at: now,
          status:
            body.status ||
            (toGate === 'control' ? 'active' : existing.methodology ? 'active' : undefined) ||
            'active',
          updated_at: now,
        })
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Audit transition (soft if table missing)
      await supabase.from('pm_gate_transitions').insert({
        profile_id: companyId,
        project_id: id,
        from_gate: fromGate,
        to_gate: toGate,
        note: body.note || null,
        checklist: Array.isArray(body.checklist) ? body.checklist : [],
        approved_by: body.approved_by || mem.userId,
        created_by: mem.userId,
      });

      return NextResponse.json({
        success: true,
        project: data,
        from_gate: fromGate,
        to_gate: toGate,
      });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'name',
      'description',
      'status',
      'priority',
      'owner_name',
      'budget',
      'currency',
      'start_date',
      'target_date',
      'progress',
      'health',
      'tags',
      'metadata',
      'programme_id',
      'methodology',
      'project_type',
      'sdg_goal',
      'sdg_targets',
      'problem_statement',
      'goal_statement',
      'charter_date',
      'sort_order',
      'customer_id',
      'supplier_id',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const { data, error } = await supabase
      .from('pm_projects')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, project: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
