import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { clampStar } from '@/lib/ratings/company-rating';
import { isSrmBuyerTransitionAllowed } from '@/lib/procurement/types';
import {
  addDays,
  clampDayRange,
  dateEnvelope,
  isoDay,
  seedWaterfallTasks,
} from '@/lib/projects/waterfall';
import { RIAD_STATUSES, RIAD_PRIORITIES, RIAD_TYPES } from '@/lib/containers/riad';
import { portalTaskRiadMark } from '@/lib/portals/trade-portal';

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

    async function assertJointProject(projectId: number) {
      const { data: proj } = await supabase
        .from('pm_projects')
        .select('id, customer_id, supplier_id, profile_id, metadata, start_date, target_date')
        .eq('id', projectId)
        .eq('profile_id', portal.profile_id)
        .maybeSingle();
      if (!proj) return null;
      const meta =
        proj.metadata && typeof proj.metadata === 'object'
          ? (proj.metadata as Record<string, unknown>)
          : {};
      const ok =
        portal.kind === 'customer'
          ? Number(proj.customer_id) === viewer.customer_id ||
            Number(meta.customer_id) === viewer.customer_id
          : Number(proj.supplier_id) === viewer.supplier_id ||
            Number(meta.supplier_id) === viewer.supplier_id;
      return ok ? proj : null;
    }

    if (action === 'project_update') {
      const id = Number(body.id);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const proj = await assertJointProject(id);
      if (!proj) {
        return NextResponse.json({ error: 'Not your project' }, { status: 403 });
      }
      const patch: Record<string, unknown> = { updated_at: now };
      if (typeof body.name === 'string' && body.name.trim()) {
        patch.name = body.name.trim().slice(0, 160);
      }
      if (body.description !== undefined) {
        patch.description =
          String(body.description || '').trim().slice(0, 2000) || null;
      }
      if (Object.keys(patch).length <= 1) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      }
      const { error } = await supabase
        .from('pm_projects')
        .update(patch)
        .eq('id', id)
        .eq('profile_id', portal.profile_id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'task_update') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const { data: task } = await supabase
        .from('pm_tasks')
        .select(
          'id, project_id, profile_id, description, start_date, due_date, assignee, metadata'
        )
        .eq('id', id)
        .eq('profile_id', portal.profile_id)
        .maybeSingle();
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      const proj = await assertJointProject(Number(task.project_id));
      if (!proj) {
        return NextResponse.json({ error: 'Not your project' }, { status: 403 });
      }
      const patch: Record<string, unknown> = { updated_at: now };
      if (typeof body.column_key === 'string' && body.column_key) {
        const col = String(body.column_key).slice(0, 24);
        patch.column_key = col;
        patch.status = col;
      }
      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 200);
      }
      const meta =
        task.metadata && typeof task.metadata === 'object' && !Array.isArray(task.metadata)
          ? { ...(task.metadata as Record<string, unknown>) }
          : {};
      if (body.assignee_viewer_id !== undefined || body.assignee !== undefined) {
        const vid = Number(body.assignee_viewer_id);
        if (Number.isFinite(vid) && vid > 0) {
          let personQ = supabase
            .from('trade_portal_viewers')
            .select('id, name, status')
            .eq('id', vid)
            .eq('profile_id', portal.profile_id)
            .eq('portal_id', portal.id);
          if (portal.kind === 'customer' && viewer.customer_id) {
            personQ = personQ.eq('customer_id', viewer.customer_id);
          } else if (portal.kind === 'supplier' && viewer.supplier_id) {
            personQ = personQ.eq('supplier_id', viewer.supplier_id);
          }
          const { data: person } = await personQ.maybeSingle();
          if (!person || person.status === 'revoked') {
            return NextResponse.json(
              { error: 'Assign someone on this portal' },
              { status: 400 }
            );
          }
          patch.assignee = String(person.name || '').slice(0, 120) || null;
          meta.assignee_viewer_id = person.id;
          meta.assignee_name = person.name;
        } else {
          patch.assignee =
            body.assignee != null && String(body.assignee).trim()
              ? String(body.assignee).trim().slice(0, 120)
              : null;
          delete meta.assignee_viewer_id;
          delete meta.assignee_name;
        }
        patch.metadata = meta;
      }
      if (typeof body.notes === 'string' && body.notes.trim()) {
        patch.description = [task.description, `[${viewer.name}] ${body.notes.trim()}`]
          .filter(Boolean)
          .join('\n');
      }
      const nextStart =
        dayOrNull(body.start_date) ||
        (task.start_date != null ? String(task.start_date).slice(0, 10) : null);
      const nextEnd =
        dayOrNull(body.due_date) ||
        (task.due_date != null ? String(task.due_date).slice(0, 10) : null);
      if (body.start_date !== undefined || body.due_date !== undefined) {
        if (nextStart && nextEnd) {
          const range = clampDayRange(nextStart, nextEnd);
          patch.start_date = range.start;
          patch.due_date = range.end;
        } else if (nextStart) {
          patch.start_date = nextStart;
        } else if (nextEnd) {
          patch.due_date = nextEnd;
        }
      }
      let { error } = await supabase
        .from('pm_tasks')
        .update(patch)
        .eq('id', id)
        .eq('profile_id', portal.profile_id);
      if (error && /column|schema cache|does not exist/i.test(error.message)) {
        const soft = { ...patch };
        delete soft.metadata;
        delete soft.start_date;
        const retry = await supabase
          .from('pm_tasks')
          .update(soft)
          .eq('id', id)
          .eq('profile_id', portal.profile_id);
        error = retry.error;
      }
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await rollupJointProjectDates(supabase, portal.profile_id, Number(task.project_id));
      return NextResponse.json({ success: true });
    }

    if (action === 'project_create') {
      const name = String(body.name || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
      }
      if (portal.kind === 'customer' && !viewer.customer_id) {
        return NextResponse.json({ error: 'No book account' }, { status: 403 });
      }
      if (portal.kind === 'supplier' && !viewer.supplier_id) {
        return NextResponse.json({ error: 'No book account' }, { status: 403 });
      }
      const start =
        dayOrNull(body.start_date) || isoDay(new Date());
      const targetRaw =
        dayOrNull(body.target_date) || addDays(start, 28);
      const { start: startDay, end: target } = clampDayRange(start, targetRaw);
      const description = String(body.description || '').trim().slice(0, 2000);
      const insert: Record<string, unknown> = {
        profile_id: portal.profile_id,
        name: name.slice(0, 160),
        description: description || null,
        status: 'planning',
        health: 'green',
        start_date: startDay,
        target_date: target,
        customer_id: portal.kind === 'customer' ? viewer.customer_id : null,
        supplier_id: portal.kind === 'supplier' ? viewer.supplier_id : null,
        created_by: `portal:${viewer.id}`,
        updated_at: now,
        metadata: {
          source: `${portal.kind}_portal`,
          portal_viewer_id: viewer.id,
          opened_by: viewer.name,
        },
      };
      let ins = await supabase.from('pm_projects').insert(insert).select('id').single();
      if (ins.error && /column|schema cache|does not exist/i.test(ins.error.message)) {
        const soft = { ...insert };
        delete soft.customer_id;
        delete soft.supplier_id;
        delete soft.health;
        delete soft.created_by;
        ins = await supabase.from('pm_projects').insert(soft).select('id').single();
      }
      if (ins.error) {
        return NextResponse.json({ error: ins.error.message }, { status: 500 });
      }
      const projectId = Number(ins.data?.id);
      if (projectId > 0) {
        const seeds = seedWaterfallTasks(startDay, target);
        const rows = seeds.map((s) => ({
          profile_id: portal.profile_id,
          project_id: projectId,
          title: s.title,
          status: s.status,
          column_key: s.column_key,
          start_date: s.start_date,
          due_date: s.due_date,
          phase_key: s.phase_key,
          sort_order: s.sort_order,
          created_by: `portal:${viewer.name}`,
          updated_at: now,
        }));
        const seeded = await supabase.from('pm_tasks').insert(rows);
        if (
          seeded.error &&
          /column|schema cache|does not exist/i.test(seeded.error.message)
        ) {
          await supabase.from('pm_tasks').insert(
            rows.map(({ start_date: _s, phase_key: _p, ...rest }) => rest)
          );
        }
      }
      return NextResponse.json({ success: true, id: projectId || ins.data?.id });
    }

    if (action === 'task_add') {
      const projectId = Number(body.project_id);
      const title = String(body.title || '').trim();
      if (!Number.isFinite(projectId) || !title) {
        return NextResponse.json({ error: 'project_id and title required' }, { status: 400 });
      }
      const proj = await assertJointProject(projectId);
      if (!proj) {
        return NextResponse.json({ error: 'Not your project' }, { status: 403 });
      }
      const { data: existing } = await supabase
        .from('pm_tasks')
        .select('id, start_date, due_date, sort_order')
        .eq('profile_id', portal.profile_id)
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      const env = dateEnvelope(
        (existing || []).map((t) => ({
          start: t.start_date as string | null,
          end: t.due_date as string | null,
        }))
      );
      const defaultStart =
        env?.end ||
        dayOrNull((proj as { start_date?: string | null }).start_date) ||
        isoDay(new Date());
      const start = dayOrNull(body.start_date) || defaultStart;
      const end =
        dayOrNull(body.due_date) || addDays(start, 7);
      const range = clampDayRange(start, end);
      const sortOrder =
        Number(
          (existing || []).reduce(
            (n, t) => Math.max(n, Number(t.sort_order) || 0),
            -1
          )
        ) + 1;
      const row: Record<string, unknown> = {
        profile_id: portal.profile_id,
        project_id: projectId,
        title: title.slice(0, 200),
        status: 'todo',
        column_key: 'todo',
        start_date: range.start,
        due_date: range.end,
        sort_order: sortOrder,
        created_by: `portal:${viewer.name}`,
        updated_at: now,
      };
      if (typeof body.phase_key === 'string' && body.phase_key) {
        row.phase_key = String(body.phase_key).slice(0, 24);
      }
      let { data, error } = await supabase
        .from('pm_tasks')
        .insert(row)
        .select('id')
        .single();
      if (error && /column|schema cache|does not exist/i.test(error.message)) {
        const soft = { ...row };
        delete soft.start_date;
        delete soft.phase_key;
        const retry = await supabase.from('pm_tasks').insert(soft).select('id').single();
        data = retry.data;
        error = retry.error;
      }
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await rollupJointProjectDates(supabase, portal.profile_id, projectId);
      return NextResponse.json({ success: true, id: data?.id });
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
      const entryType = RIAD_TYPES.some((t) => t.key === body.entry_type)
        ? String(body.entry_type)
        : 'issue';
      const status = RIAD_STATUSES.some((s) => s.value === body.status)
        ? String(body.status)
        : 'open';
      const severity = RIAD_PRIORITIES.some((p) => p.value === body.severity)
        ? String(body.severity)
        : String(body.priority || 'medium').slice(0, 20);
      let relatedTaskId: number | null = null;
      let relatedProjectId: number | null = null;
      const wantTask = Number(body.related_task_id);
      if (Number.isFinite(wantTask) && wantTask > 0) {
        const { data: linkedTask } = await supabase
          .from('pm_tasks')
          .select('id, project_id, title')
          .eq('id', wantTask)
          .eq('profile_id', portal.profile_id)
          .maybeSingle();
        if (!linkedTask) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        const linkedProj = await assertJointProject(Number(linkedTask.project_id));
        if (!linkedProj) {
          return NextResponse.json({ error: 'Not your project' }, { status: 403 });
        }
        relatedTaskId = Number(linkedTask.id);
        relatedProjectId = Number(linkedTask.project_id);
      }
      const mark = relatedTaskId ? portalTaskRiadMark(relatedTaskId) : '';
      const notesBody = String(body.notes || '').slice(0, 4000);
      const entry: Record<string, unknown> = {
        profile_id: portal.profile_id,
        entry_type: entryType,
        title: title.slice(0, 200),
        description: String(body.description || '').slice(0, 4000) || null,
        status,
        severity,
        owner_name:
          String(body.owner_name || viewer.name || '').trim().slice(0, 120) ||
          null,
        due_date: dayOrNull(body.due_date),
        category: String(body.category || '').trim().slice(0, 80) || null,
        mitigation_plan:
          String(body.mitigation_plan || '').trim().slice(0, 4000) || null,
        notes: [mark, notesBody].filter(Boolean).join('\n') || null,
        created_by: `portal:${viewer.name}`,
        updated_at: now,
        related_task_id: relatedTaskId,
        related_project_id: relatedProjectId,
      };
      const table =
        portal.kind === 'customer' ? 'customer_riad' : 'supplier_riad';
      const row: Record<string, unknown> = { ...entry };
      if (portal.kind === 'customer') {
        row.customer_id = viewer.customer_id;
      } else {
        row.supplier_id = viewer.supplier_id;
      }
      let { data, error } = await supabase
        .from(table)
        .insert(row as never)
        .select('id')
        .single();
      if (error && /column|schema cache|does not exist/i.test(error.message || '')) {
        const minimal: Record<string, unknown> = {
          profile_id: portal.profile_id,
          entry_type: entryType,
          title: entry.title,
          description: entry.description,
          status,
          severity,
          owner_name: entry.owner_name,
          due_date: entry.due_date,
          notes: entry.notes,
          created_by: entry.created_by,
          updated_at: now,
        };
        if (portal.kind === 'customer') {
          minimal.customer_id = viewer.customer_id;
        } else {
          minimal.supplier_id = viewer.supplier_id;
        }
        const retry = await supabase
          .from(table)
          .insert(minimal as never)
          .select('id')
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, id: data?.id });
    }

    if (action === 'riad_update') {
      const id = Number(body.id);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const table =
        portal.kind === 'customer' ? 'customer_riad' : 'supplier_riad';
      const accountCol =
        portal.kind === 'customer' ? 'customer_id' : 'supplier_id';
      const accountId =
        portal.kind === 'customer' ? viewer.customer_id : viewer.supplier_id;
      if (!accountId) {
        return NextResponse.json({ error: 'No book account' }, { status: 403 });
      }
      const { data: existing } = await supabase
        .from(table)
        .select('id, notes, status')
        .eq('id', id)
        .eq('profile_id', portal.profile_id)
        .eq(accountCol, accountId)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json({ error: 'RIAD not found' }, { status: 404 });
      }
      const updates: Record<string, unknown> = { updated_at: now };
      if (typeof body.title === 'string' && body.title.trim()) {
        updates.title = body.title.trim().slice(0, 200);
      }
      if (body.description !== undefined) {
        updates.description = String(body.description || '').slice(0, 4000) || null;
      }
      if (typeof body.status === 'string' && body.status) {
        const st = RIAD_STATUSES.some((s) => s.value === body.status)
          ? String(body.status)
          : String(body.status).slice(0, 24);
        updates.status = st;
        if (st === 'closed' || st === 'resolved') {
          updates.closed_at = now;
        }
        if (st === 'open' || st === 'in_progress' || st === 'on_hold') {
          updates.closed_at = null;
        }
      }
      if (typeof body.severity === 'string' && body.severity) {
        updates.severity = String(body.severity).slice(0, 20);
      }
      if (body.priority !== undefined && body.severity === undefined) {
        updates.severity = String(body.priority).slice(0, 20);
      }
      if (body.owner_name !== undefined) {
        updates.owner_name = String(body.owner_name || '').trim().slice(0, 120) || null;
      }
      if (body.due_date !== undefined) {
        updates.due_date = dayOrNull(body.due_date);
      }
      if (body.category !== undefined) {
        updates.category = String(body.category || '').trim().slice(0, 80) || null;
      }
      if (body.mitigation_plan !== undefined) {
        updates.mitigation_plan =
          String(body.mitigation_plan || '').trim().slice(0, 4000) || null;
      }
      if (body.resolution !== undefined) {
        updates.resolution = String(body.resolution || '').trim().slice(0, 4000) || null;
      }
      if (typeof body.notes === 'string' && body.notes.trim() && body.append_note) {
        updates.notes = [existing.notes, `[${viewer.name}] ${body.notes.trim()}`]
          .filter(Boolean)
          .join('\n');
      } else if (body.notes !== undefined && !body.append_note) {
        updates.notes = String(body.notes || '').slice(0, 4000) || null;
      }
      let { error } = await supabase
        .from(table)
        .update(updates as never)
        .eq('id', id)
        .eq('profile_id', portal.profile_id)
        .eq(accountCol, accountId);
      if (error && /column|schema cache|does not exist/i.test(error.message || '')) {
        const safe: Record<string, unknown> = { updated_at: now };
        for (const k of [
          'title',
          'description',
          'status',
          'severity',
          'owner_name',
          'due_date',
          'notes',
          'closed_at',
        ]) {
          if (updates[k] !== undefined) safe[k] = updates[k];
        }
        if (updates.resolution) {
          safe.description = [updates.description || existing.status, `Resolution: ${updates.resolution}`]
            .filter(Boolean)
            .join('\n\n');
        }
        const retry = await supabase
          .from(table)
          .update(safe as never)
          .eq('id', id)
          .eq('profile_id', portal.profile_id)
          .eq(accountCol, accountId);
        error = retry.error;
      }
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'riad_delete') {
      const id = Number(body.id);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      const table =
        portal.kind === 'customer' ? 'customer_riad' : 'supplier_riad';
      const accountCol =
        portal.kind === 'customer' ? 'customer_id' : 'supplier_id';
      const accountId =
        portal.kind === 'customer' ? viewer.customer_id : viewer.supplier_id;
      if (!accountId) {
        return NextResponse.json({ error: 'No book account' }, { status: 403 });
      }
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq('profile_id', portal.profile_id)
        .eq(accountCol, accountId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, deleted: true });
    }

    if (action === 'riad_comment') {
      const id = Number(body.id);
      const note = String(body.notes || '').trim();
      if (!Number.isFinite(id) || !note) {
        return NextResponse.json({ error: 'id and notes required' }, { status: 400 });
      }
      const table =
        portal.kind === 'customer' ? 'customer_riad' : 'supplier_riad';
      const accountCol =
        portal.kind === 'customer' ? 'customer_id' : 'supplier_id';
      const accountId =
        portal.kind === 'customer' ? viewer.customer_id : viewer.supplier_id;
      if (!accountId) {
        return NextResponse.json({ error: 'No book account' }, { status: 403 });
      }
      const { data: existing } = await supabase
        .from(table)
        .select('id, notes, profile_id')
        .eq('id', id)
        .eq('profile_id', portal.profile_id)
        .eq(accountCol, accountId)
        .maybeSingle();
      if (!existing) {
        return NextResponse.json({ error: 'RIAD not found' }, { status: 404 });
      }
      const next = [existing.notes, `[${viewer.name}] ${note}`]
        .filter(Boolean)
        .join('\n');
      const { error } = await supabase
        .from(table)
        .update({ notes: next, updated_at: now } as never)
        .eq('id', id)
        .eq('profile_id', portal.profile_id)
        .eq(accountCol, accountId);
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
          const unit = Number(row.unit_price || 0);
          return {
            product_id:
              row.product_id != null && Number(row.product_id) > 0
                ? Number(row.product_id)
                : null,
            name: name.slice(0, 160),
            sku: row.sku != null ? String(row.sku).slice(0, 80) : null,
            qty,
            quantity: qty,
            unit_price: unit,
            line_total: Math.round(qty * unit * 100) / 100,
            uom: row.uom != null ? String(row.uom).slice(0, 24) : 'unit',
          };
        })
        .filter(Boolean) as Array<Record<string, unknown>>;
      if (!lines.length) {
        return NextResponse.json(
          { error: 'Add at least one product with a quantity' },
          { status: 400 }
        );
      }
      const qty = lines.reduce((n, l) => n + Number(l.qty || 0), 0);
      const subtotal = lines.reduce(
        (n, l) => n + Number(l.line_total || 0),
        0
      );
      const amount = Number(body.total_amount || subtotal) || subtotal;
      const poNumber = String(body.po_number || '').trim().slice(0, 60);
      const promised = body.promised_date
        ? String(body.promised_date).slice(0, 10)
        : null;
      const attachment = body.attachment_url
        ? String(body.attachment_url).slice(0, 2000)
        : null;
      const insert: Record<string, unknown> = {
        supplier_profile_id: portal.profile_id,
        seller_customer_id: viewer.customer_id,
        source: 'customer_portal',
        status: 'sent',
        po_number: poNumber || null,
        order_number: poNumber || null,
        description: String(
          body.description ||
            `Customer PO${poNumber ? ` ${poNumber}` : ''} from ${accountName}`
        ).slice(0, 400),
        currency: String(body.currency || 'ZAR').slice(0, 8),
        total_amount: amount,
        subtotal: amount,
        items: lines,
        order_quantity: qty || null,
        promised_date: promised,
        metadata: {
          attachment_url: attachment,
          attachment_name: body.attachment_name
            ? String(body.attachment_name).slice(0, 160)
            : null,
          portal_viewer_id: viewer.id,
          customer_po_number: poNumber || null,
        },
        created_at: now,
        updated_at: now,
      };
      let poIns = await supabase
        .from('purchase_orders')
        .insert(insert)
        .select('id')
        .single();
      if (poIns.error && /column|schema cache|does not exist/i.test(poIns.error.message)) {
        const soft = { ...insert };
        delete soft.po_number;
        delete soft.order_number;
        poIns = await supabase
          .from('purchase_orders')
          .insert(soft)
          .select('id')
          .single();
      }
      if (poIns.error) {
        return NextResponse.json({ error: poIns.error.message }, { status: 500 });
      }

      const { docNumber, calcDocTotals, normalizeItems } = await import(
        '@/lib/customers/documents'
      );
      const soItems = normalizeItems(lines);
      const totals = calcDocTotals(soItems, 0);
      totals.total_amount = amount;
      totals.subtotal = amount;
      const soPayload: Record<string, unknown> = {
        profile_id: portal.profile_id,
        customer_id: viewer.customer_id,
        order_number: docNumber('SO'),
        status: 'confirmed',
        currency: String(body.currency || 'ZAR').slice(0, 8),
        ...totals,
        promised_date: promised,
        customer_name: accountName,
        contact_name: viewer.name,
        contact_email: viewer.email,
        contact_phone: viewer.phone,
        notes: [
          poNumber ? `Customer PO ${poNumber}` : null,
          String(body.description || '').trim() || null,
          attachment ? `Attached: ${attachment}` : null,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 800),
        items: soItems,
        metadata: {
          source: 'customer_portal',
          customer_po_number: poNumber || null,
          inbound_po_id: poIns.data?.id || null,
          attachment_url: attachment,
          portal_viewer_id: viewer.id,
        },
        created_at: now,
        updated_at: now,
      };
      let so = await supabase
        .from('sales_orders')
        .insert(soPayload)
        .select('id, order_number')
        .single();
      if (so.error && /column|schema cache|does not exist/i.test(so.error.message)) {
        const soft = { ...soPayload };
        delete soft.metadata;
        delete soft.promised_date;
        delete soft.contact_phone;
        so = await supabase
          .from('sales_orders')
          .insert(soft)
          .select('id, order_number')
          .single();
      }

      return NextResponse.json({
        success: true,
        id: poIns.data?.id,
        sales_order_id: so.data?.id || null,
        sales_order_number: so.data?.order_number || null,
        warning: so.error?.message,
      });
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

    if (action === 'invite_person') {
      if (portal.kind === 'customer' && !viewer.customer_id) {
        return NextResponse.json({ error: 'No book account' }, { status: 403 });
      }
      if (portal.kind === 'supplier' && !viewer.supplier_id) {
        return NextResponse.json({ error: 'No book account' }, { status: 403 });
      }
      const { inviteTradePortalPerson } = await import(
        '@/lib/portals/trade-portal-people'
      );
      const invited = await inviteTradePortalPerson({
        companyId: portal.profile_id,
        kind: portal.kind,
        name: String(body.name || ''),
        email: body.email != null ? String(body.email) : null,
        phone: body.phone != null ? String(body.phone) : null,
        job_title: body.job_title != null ? String(body.job_title) : null,
        customerId: viewer.customer_id,
        supplierId: viewer.supplier_id,
        sendEmail: body.sendEmail !== false,
      });
      if (!invited.ok) {
        return NextResponse.json(
          { error: invited.error },
          { status: invited.status }
        );
      }
      return NextResponse.json({
        success: true,
        url: invited.url,
        emailSent: invited.emailSent,
        warning: invited.warning,
        existing: invited.existing === true,
        person: {
          id: invited.viewer.id,
          name: invited.viewer.name,
          email: invited.viewer.email,
          job_title: invited.viewer.job_title,
        },
      });
    }

    if (action === 'revoke_person') {
      const id = Number(body.id);
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ error: 'Person required' }, { status: 400 });
      }
      if (id === viewer.id) {
        return NextResponse.json(
          { error: 'You cannot revoke your own access' },
          { status: 400 }
        );
      }
      let q = supabase
        .from('trade_portal_viewers')
        .update({
          status: 'revoked',
          updated_at: now,
        })
        .eq('id', id)
        .eq('profile_id', portal.profile_id)
        .eq('portal_id', portal.id);
      if (portal.kind === 'customer' && viewer.customer_id) {
        q = q.eq('customer_id', viewer.customer_id);
      } else if (portal.kind === 'supplier' && viewer.supplier_id) {
        q = q.eq('supplier_id', viewer.supplier_id);
      } else {
        return NextResponse.json({ error: 'No book account' }, { status: 403 });
      }
      const { error } = await q;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, revoked: true });
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

function dayOrNull(v: unknown): string | null {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function rollupJointProjectDates(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  projectId: number
) {
  const { data } = await supabase
    .from('pm_tasks')
    .select('start_date, due_date')
    .eq('profile_id', companyId)
    .eq('project_id', projectId);
  const env = dateEnvelope(
    (data || []).map((t) => ({
      start: t.start_date as string | null,
      end: t.due_date as string | null,
    }))
  );
  if (!env) return;
  await supabase
    .from('pm_projects')
    .update({
      start_date: env.start,
      target_date: env.end,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('profile_id', companyId);
}
